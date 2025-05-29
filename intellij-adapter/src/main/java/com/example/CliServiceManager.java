package com.example;

import com.intellij.openapi.components.Service;
import com.intellij.openapi.diagnostic.Logger;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.application.PathManager;
import org.json.JSONObject;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.PosixFilePermission;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Service to manage the CLI tool process
 * Handles starting and stopping a long-running server process for better performance
 */
@Service(Service.Level.PROJECT)
public final class CliServiceManager implements AutoCloseable {
    private static final Logger LOG = Logger.getInstance(CliServiceManager.class);
    private static final int DEFAULT_PORT = 9229;
    private static final int SERVER_START_TIMEOUT_SECONDS = 15; // Increased timeout
    private static final boolean USE_DIRECT_EXECUTION = true; // Fallback to direct execution for now

    private final Project project;
    private Process serverProcess;
    private int serverPort = DEFAULT_PORT;
    private String securityToken;
    private final AtomicBoolean serverRunning = new AtomicBoolean(false);

    public CliServiceManager(Project project) {
        this.project = project;
        this.securityToken = generateSecurityToken();
    }

    /**
     * Get the instance of the service for the current project
     */
    public static CliServiceManager getInstance(Project project) {
        return project.getService(CliServiceManager.class);
    }

    /**
     * Start the server if it's not already running
     */
    public synchronized boolean ensureServerRunning() {
        // If we're configured to use direct execution only, don't try server mode
        if (USE_DIRECT_EXECUTION) {
            LOG.info("Direct CLI execution mode is enabled, skipping server mode");
            return false;
        }
        
        if (serverRunning.get() && serverProcess != null && serverProcess.isAlive()) {
            LOG.info("Server is already running on port " + serverPort);
            return true;  // Server already running
        }

        try {
            String cliToolPath = findCliToolPath();
            if (cliToolPath == null) {
                LOG.error("Cannot find CLI tool path for server mode");
                return false;
            }
            LOG.info("Attempting to start server with CLI tool: " + cliToolPath + " in directory: " + project.getBasePath());

            // Choose a random port in the higher range
            serverPort = 49152 + (int)(Math.random() * (65535 - 49152));
            
            // Test the CLI tool first to make sure it's working
            try {
                Process testProcess = new ProcessBuilder(cliToolPath).start();
                testProcess.waitFor(5, TimeUnit.SECONDS);
                if (testProcess.isAlive()) {
                    testProcess.destroyForcibly();
                }
                LOG.info("CLI tool test successful, exit code: " + testProcess.exitValue());
            } catch (Exception e) {
                LOG.error("CLI tool test failed", e);
                return false;
            }
            
            ProcessBuilder processBuilder = new ProcessBuilder(
                    cliToolPath, 
                    "server", 
                    "--port", 
                    String.valueOf(serverPort)
            );
            
            // Set environment variables
            processBuilder.environment().put("PLUGIN_SECURITY_TOKEN", securityToken);
            
            // Add NODE_OPTIONS to help with pkg issues
            processBuilder.environment().put("NODE_OPTIONS", "--no-warnings");
            
            // Try to set the NODE_PATH to help with dependency resolution
            String projectPath = project.getBasePath();
            if (projectPath != null) {
                File nodeModules = new File(projectPath, "node_modules");
                if (nodeModules.exists() && nodeModules.isDirectory()) {
                    processBuilder.environment().put("NODE_PATH", nodeModules.getAbsolutePath());
                }
                
                // Also check one level up in case plugin is in subdirectory
                File parentPath = new File(projectPath).getParentFile();
                if (parentPath != null && parentPath.exists()) {
                    File parentNodeModules = new File(parentPath, "node_modules");
                    if (parentNodeModules.exists() && parentNodeModules.isDirectory()) {
                        String nodePath = processBuilder.environment().getOrDefault("NODE_PATH", "");
                        if (!nodePath.isEmpty()) {
                            nodePath += File.pathSeparator;
                        }
                        nodePath += parentNodeModules.getAbsolutePath();
                        processBuilder.environment().put("NODE_PATH", nodePath);
                    }
                }
            }
            
            // Try to ensure we can find the Node.js runtime if needed
            tryAddNodeToPath(processBuilder);
            
            // Debug - show environment variables
            LOG.info("Environment variables for server process:");
            processBuilder.environment().forEach((key, value) -> {
                LOG.info("  " + key + "=" + value);
            });
            
            // Redirect errors to output so we can read them
            processBuilder.redirectErrorStream(true);
            processBuilder.directory(new File(project.getBasePath()));
            
            // Start the process
            LOG.info("Starting server process with command: " + cliToolPath + " server --port " + serverPort);
            serverProcess = processBuilder.start();
            
            // Make sure the process started successfully
            if (!serverProcess.isAlive()) {
                LOG.error("Server process failed to start. Exit code: " + serverProcess.exitValue());
                return false;
            }
            LOG.info("Server process started with PID: " + serverProcess.pid());
            
            // Read the process output to check for successful startup
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(serverProcess.getInputStream()))) {
                String line;
                boolean serverStarted = false;
                
                // Give it time to start up
                long startTime = System.currentTimeMillis();
                long timeoutMillis = SERVER_START_TIMEOUT_SECONDS * 1000;
                
                while (System.currentTimeMillis() - startTime < timeoutMillis) {
                    if (!serverProcess.isAlive()) {
                        int exitCode = serverProcess.exitValue();
                        LOG.error("Server process exited prematurely with code: " + exitCode);
                        return false;
                    }
                    
                    if (!reader.ready()) {
                        Thread.sleep(100);
                        continue;
                    }
                    
                    line = reader.readLine();
                    if (line == null) {
                        LOG.warn("Server output stream ended unexpectedly");
                        break;
                    }
                    
                    LOG.info("Server output: " + line);
                    if (line.contains("Server started on port")) {
                        serverStarted = true;
                        break;
                    }
                    
                    // Check for common error messages
                    if (line.contains("Error: Cannot find module") || 
                        line.contains("Error: EACCES: permission denied") ||
                        line.contains("SyntaxError:")) {
                        LOG.error("Server startup failed with error: " + line);
                        break;
                    }
                }
                
                if (!serverStarted) {
                    LOG.error("Server failed to start within " + SERVER_START_TIMEOUT_SECONDS + " seconds");
                    
                    // Try to read a bit more output if available for better diagnostics
                    for (int i = 0; i < 10; i++) {
                        if (reader.ready()) {
                            String extraLine = reader.readLine();
                            if (extraLine != null) {
                                LOG.info("Additional server output: " + extraLine);
                            }
                        } else {
                            break;
                        }
                    }
                    
                    stopServer();
                    return false;
                }
            }
            
            // Start a monitoring thread to keep reading the output
            new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(serverProcess.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        LOG.info("Server output: " + line);
                    }
                } catch (IOException e) {
                    LOG.error("Error reading server output", e);
                } finally {
                    // If we get here, the stream has closed, meaning the process likely exited
                    if (serverRunning.get()) {
                        LOG.warn("Server process appears to have exited unexpectedly");
                        serverRunning.set(false);
                    }
                }
            }, "CLI-Server-Monitor").start();
            
            // Server successfully started
            serverRunning.set(true);
            
            // Test server with a ping
            try {
                boolean pingSuccess = pingServer();
                if (!pingSuccess) {
                    LOG.error("Server ping failed after startup");
                    stopServer();
                    return false;
                }
                LOG.info("Server ping successful");
            } catch (Exception e) {
                LOG.error("Server ping failed with exception", e);
                stopServer();
                return false;
            }
            
            return true;
            
        } catch (Exception e) {
            LOG.error("Failed to start server", e);
            stopServer();
            return false;
        }
    }
    
    /**
     * Send a ping request to the server to verify it's responsive
     */
    private boolean pingServer() {
        try {
            URL url = new URL("http://localhost:" + serverPort + "/ping");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(3000); // 3 seconds timeout
            connection.connect();
            
            int responseCode = connection.getResponseCode();
            return responseCode == 200;
        } catch (Exception e) {
            LOG.error("Error pinging server", e);
            return false;
        }
    }
    
    /**
     * Add Node.js to the PATH environment variable if it's not already there
     */
    private void tryAddNodeToPath(ProcessBuilder processBuilder) {
        try {
            // Common locations for Node.js
            String[] nodePaths = {
                "/usr/bin", 
                "/usr/local/bin", 
                "/opt/homebrew/bin",
                System.getProperty("user.home") + "/.nvm/versions/node/*/bin", // NVM installs
                "C:\\Program Files\\nodejs", 
                "C:\\Program Files (x86)\\nodejs"
            };
            
            // Try to find node executable
            String nodePath = null;
            for (String path : nodePaths) {
                File nodeFile = new File(path, System.getProperty("os.name").toLowerCase().contains("win") ? "node.exe" : "node");
                if (nodeFile.exists() && nodeFile.canExecute()) {
                    nodePath = path;
                    break;
                }
            }
            
            if (nodePath != null) {
                String path = processBuilder.environment().get("PATH");
                if (path == null) path = "";
                if (!path.contains(nodePath)) {
                    path = nodePath + File.pathSeparator + path;
                    processBuilder.environment().put("PATH", path);
                    LOG.info("Added Node.js path to PATH: " + nodePath);
                }
            }
        } catch (Exception e) {
            LOG.error("Error while trying to add Node.js to PATH", e);
        }
    }
    
    /**
     * Stop the server if it's running
     */
    public synchronized void stopServer() {
        if (serverProcess != null) {
            try {
                LOG.info("Stopping server process");
                serverProcess.destroy();
                boolean terminated = serverProcess.waitFor(3, TimeUnit.SECONDS);
                
                if (!terminated) {
                    // Force terminate if it didn't exit gracefully
                    LOG.warn("Server process didn't terminate gracefully, using destroyForcibly");
                    serverProcess.destroyForcibly();
                    serverProcess.waitFor(2, TimeUnit.SECONDS);
                }
                
                LOG.info("Server process stopped");
                
            } catch (Exception e) {
                LOG.error("Error stopping server process", e);
            } finally {
                serverProcess = null;
                serverRunning.set(false);
            }
        }
    }
    
    /**
     * Check if the server is running
     */
    public boolean isServerRunning() {
        return serverRunning.get() && serverProcess != null && serverProcess.isAlive();
    }
    
    /**
     * Analyze a file using the CLI tool
     * Will use server mode if available, otherwise falls back to one-off process
     */
    public JSONObject analyzeFile(String filePath) throws IOException {
        
        // Fall back to one-off process execution
        LOG.info("Using direct CLI execution to analyze file: " + filePath);
        return executeCliCommand("analyze", filePath);
    }
    
    /**
     * Format a file using the CLI tool
     */
    public JSONObject formatFile(String filePath) throws IOException {
        // Similar implementation as analyzeFile, but for formatting
        return executeCliCommand("format", filePath);
    }
    
    /**
     * Execute a CLI command directly (not using server mode)
     */
    private JSONObject executeCliCommand(String command, String filePath) throws IOException {
        String cliToolPath = findCliToolPath();
        if (cliToolPath == null) {
            throw new IOException("Cannot find CLI tool path");
        }
        
        LOG.info("Executing CLI command: " + command + " " + filePath + " using: " + cliToolPath);
        
        ProcessBuilder processBuilder = new ProcessBuilder(cliToolPath, command, filePath);
        processBuilder.redirectErrorStream(true);
        
        // Try to ensure we can find the Node.js runtime if needed
        tryAddNodeToPath(processBuilder);
        
        Process process = processBuilder.start();
        
        // Read the process output
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                LOG.info("CLI output: " + line);
            }
        }
        
        // Wait for the process to complete
        try {
            boolean completed = process.waitFor(30, TimeUnit.SECONDS);
            if (!completed) {
                process.destroy();
                throw new IOException("Analysis timed out");
            }
            
            int exitCode = process.exitValue();
            if (exitCode != 0) {
                LOG.error("CLI process exited with code: " + exitCode);
                throw new IOException("Analysis failed with exit code: " + exitCode);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Analysis interrupted", e);
        }
        
        // Parse output as JSON
        String outputStr = output.toString().trim();
        if (outputStr.isEmpty()) {
            throw new IOException("CLI command returned empty output");
        }
        
        try {
            // Extract JSON from the output - find the first '{' character and parse from there
            int jsonStartIndex = outputStr.indexOf('{');
            if (jsonStartIndex == -1) {
                LOG.error("No JSON object found in output: " + outputStr);
                throw new IOException("No JSON object found in CLI output");
            }
            
            String jsonStr = outputStr.substring(jsonStartIndex);
            LOG.info("Extracted JSON: " + jsonStr);
            
            return new JSONObject(jsonStr);
        } catch (Exception e) {
            LOG.error("Failed to parse CLI output as JSON: " + outputStr, e);
            throw new IOException("Failed to parse CLI output as JSON", e);
        }
    }
    
    /**
     * Find the CLI tool path
     */
    private String findCliToolPath() {
        try {
            // First, look for the CLI tool in the plugin's resources directory
            String osName = System.getProperty("os.name").toLowerCase();
            String executableName;

            if (osName.contains("win")) {
                executableName = "cross-platform-tool-win.exe";
            } else if (osName.contains("mac")) {
                executableName = "cross-platform-tool-macos";
            } else {
                executableName = "cross-platform-tool-linux";
            }
            
            LOG.info("Looking for CLI tool: " + executableName + " for OS: " + osName);

            // First check in plugin lib directory
            Path pluginLibDir = Paths.get(PathManager.getPluginsPath(), "intellij-adapter", "lib");
            Path pluginBinInLib = pluginLibDir.resolve("bin").resolve(executableName);
            if (Files.exists(pluginBinInLib)) {
                ensureExecutable(pluginBinInLib.toFile());
                LOG.info("Found CLI tool in plugin lib directory: " + pluginBinInLib);
                return pluginBinInLib.toString();
            }
            
            // Then check in resources
            InputStream inputStream = getClass().getClassLoader().getResourceAsStream("bin/" + executableName);
            if (inputStream != null) {
                // Create a persistent file in the plugin's data directory instead of a temp file
                Path pluginDataDir = Paths.get(PathManager.getPluginTempPath(), "intellij-adapter");
                Files.createDirectories(pluginDataDir);
                
                File cliToolFile = pluginDataDir.resolve(executableName).toFile();
                
                // Only extract if the file doesn't exist or is too old
                boolean needToExtract = !cliToolFile.exists();
                if (!needToExtract && System.currentTimeMillis() - cliToolFile.lastModified() > 86400000) {
                    // File exists but is more than a day old, re-extract
                    LOG.info("CLI tool exists but is older than 24 hours, refreshing: " + cliToolFile);
                    needToExtract = true;
                }
                
                if (needToExtract) {
                    LOG.info("Extracting CLI tool to: " + cliToolFile);
                    try (FileOutputStream outputStream = new FileOutputStream(cliToolFile)) {
                        byte[] buffer = new byte[1024];
                        int bytesRead;
                        while ((bytesRead = inputStream.read(buffer)) != -1) {
                            outputStream.write(buffer, 0, bytesRead);
                        }
                    }
                    inputStream.close();

                    ensureExecutable(cliToolFile);
                } else {
                    LOG.info("Using existing CLI tool: " + cliToolFile);
                    inputStream.close();
                }

                return cliToolFile.getAbsolutePath();
            } else {
                LOG.warn("CLI tool not found in resources at path: bin/" + executableName);
            }

            // Try to find the CLI tool in common locations
            String projectPath = project.getBasePath();
            if (projectPath != null) {
                // Check in the project's root bin directory
                File binDir = new File(projectPath, "bin");
                File cliToolFile = new File(binDir, executableName);
                
                if (cliToolFile.exists()) {
                    ensureExecutable(cliToolFile);
                    LOG.info("Found CLI tool in project bin directory: " + cliToolFile.getAbsolutePath());
                    return cliToolFile.getAbsolutePath();
                }
                
                // Check one level up, in case the IntelliJ plugin is in a subdirectory
                File parentDir = new File(projectPath).getParentFile();
                if (parentDir != null) {
                    File parentBinDir = new File(parentDir, "bin");
                    cliToolFile = new File(parentBinDir, executableName);
                    
                    if (cliToolFile.exists()) {
                        ensureExecutable(cliToolFile);
                        LOG.info("Found CLI tool in parent bin directory: " + cliToolFile.getAbsolutePath());
                        return cliToolFile.getAbsolutePath();
                    }
                }
            }
            
            LOG.error("Could not find CLI tool in any location");
            return null;
        } catch (Exception e) {
            LOG.error("Error finding CLI tool path", e);
            return null;
        }
    }
    
    /**
     * Ensure a file is executable using multiple approaches
     */
    private void ensureExecutable(File file) {
        String osName = System.getProperty("os.name").toLowerCase();
        if (osName.contains("win")) {
            // Windows doesn't need executable permissions
            return;
        }
        
        LOG.info("Setting executable permissions on: " + file.getAbsolutePath());
        
        // Try multiple approaches to set executable permissions
        
        // Approach 1: Java API
        boolean success = file.setExecutable(true, false);
        if (success) {
            LOG.info("Successfully set executable permission using Java API");
            return;
        }
        LOG.warn("Failed to set executable permission using Java API");
        
        // Approach 2: Java NIO (POSIX)
        try {
            Path path = file.toPath();
            Set<PosixFilePermission> perms = new HashSet<>();
            perms.add(PosixFilePermission.OWNER_READ);
            perms.add(PosixFilePermission.OWNER_WRITE);
            perms.add(PosixFilePermission.OWNER_EXECUTE);
            perms.add(PosixFilePermission.GROUP_READ);
            perms.add(PosixFilePermission.GROUP_EXECUTE);
            perms.add(PosixFilePermission.OTHERS_READ);
            perms.add(PosixFilePermission.OTHERS_EXECUTE);
            
            Files.setPosixFilePermissions(path, perms);
            LOG.info("Successfully set executable permission using NIO POSIX API");
            return;
        } catch (Exception e) {
            LOG.warn("Failed to set executable permission using NIO POSIX API: " + e.getMessage());
        }
        
        // Approach 3: chmod command
        try {
            Process process = Runtime.getRuntime().exec(new String[]{"chmod", "+x", file.getAbsolutePath()});
            int exitCode = process.waitFor();
            if (exitCode == 0) {
                LOG.info("Successfully set executable permission using chmod command");
                return;
            }
            LOG.warn("chmod command failed with exit code: " + exitCode);
        } catch (Exception e) {
            LOG.error("Error running chmod command", e);
        }
        
        // Check if the file is now executable
        if (!file.canExecute()) {
            LOG.error("Failed to set executable permission on CLI tool using any method");
        }
    }
    
    /**
     * Generate a security token for server communication
     */
    private String generateSecurityToken() {
        return UUID.randomUUID().toString();
    }
    
    @Override
    public void close() {
        stopServer();
    }
}