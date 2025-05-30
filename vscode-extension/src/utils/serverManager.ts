import { ChildProcess, spawn } from "child_process";
import fetch from "node-fetch";

// Track the server process
let serverProcess: ChildProcess | undefined = undefined;
let serverPort: number = 0;

/**
 * Starts the CLI tool in server mode
 * @param binaryPath Path to the binary to execute
 */
export async function startServer(binaryPath: string): Promise<void> {
  if (serverProcess) {
    return; // Server already running
  }

  return new Promise((resolve, reject) => {
    try {
      // Start the tool in server mode on a random port
      serverPort = Math.floor(Math.random() * (65535 - 49152) + 49152);
      serverProcess = spawn(binaryPath, [
        "server",
        "--port",
        serverPort.toString(),
      ]);

      let startupData = "";

      // Listen for successful startup message
      if (serverProcess?.stdout) {
        serverProcess.stdout.on("data", (data: Buffer) => {
          startupData += data.toString();
          if (startupData.includes("Server started on port")) {
            console.log(`Analysis server started on port ${serverPort}`);
            resolve();
          }
        });
      }

      if (serverProcess?.stderr) {
        serverProcess.stderr.on("data", (data: Buffer) => {
          console.error(`Server error: ${data.toString()}`);
        });
      }

      if (serverProcess) {
        serverProcess.on("close", (code: number) => {
          console.log(`Server process exited with code ${code}`);
          serverProcess = undefined;
          serverPort = 0;
        });
      }

      // Set timeout for startup
      setTimeout(() => {
        if (serverProcess && !startupData.includes("Server started on port")) {
          reject(new Error("Server startup timed out"));
        }
      }, 5000);
    } catch (error) {
      console.error("Failed to start server:", error);
      serverProcess = undefined;
      reject(error);
    }
  });
}

/**
 * Stops the server if it's running
 */
export function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = undefined;
    serverPort = 0;
    console.log("Analysis server stopped");
  }
}

/**
 * Checks if the server is running
 * @returns True if the server is running
 */
export function isServerRunning(): boolean {
  return !!serverProcess && serverPort > 0;
}

/**
 * Gets the current server port
 * @returns The port number or 0 if not running
 */
export function getServerPort(): number {
  return serverPort;
}

/**
 * Calls the server for file analysis
 * @param filePath Path to the file to analyze
 */
export async function callServerForAnalysis(filePath: string): Promise<any> {
  if (!isServerRunning()) {
    throw new Error("Server is not running");
  }

  // Simple HTTP call to the server
  const response = await fetch(`http://localhost:${serverPort}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filePath: filePath,
      securityToken: process.env.VSCODE_SECURITY_TOKEN || "vscode-client",
    }),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Calls the server for file formatting
 * @param filePath Path to the file to format
 */
export async function callServerForFormat(filePath: string): Promise<any> {
  if (!isServerRunning()) {
    throw new Error("Server is not running");
  }

  const response = await fetch(`http://localhost:${serverPort}/format`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filePath: filePath,
      securityToken: process.env.VSCODE_SECURITY_TOKEN || "vscode-client",
      saveToFile: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.statusText}`);
  }

  return await response.json();
}
