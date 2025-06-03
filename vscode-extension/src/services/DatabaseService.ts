import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { Logger } from "../utils/Logger";

/**
 * Enhanced database service with improved binary handling and server management
 * Implements singleton pattern to prevent multiple server instances
 */
export class DatabaseService {
  private static readonly FIXED_SERVER_PORT = 9229; // Fixed port for all instances
  private static readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private static readonly STARTUP_TIMEOUT = 15000; // 15 seconds
  private static globalServerRunning = false;
  private static lastHealthCheck = 0;

  private binaryPath: string;
  private serverProcess: ChildProcess | null = null;
  private serverPort: number = DatabaseService.FIXED_SERVER_PORT;
  private isServerRunning: boolean = false;
  private maxRetries: number = 3;
  private healthCheckTimer: NodeJS.Timer | null = null;

  constructor(binaryPath: string) {
    this.binaryPath = binaryPath;
    this.validateBinary();

    // Start the server automatically when the service is initialized
    this.ensureServerRunning().catch((error) => {
      Logger.error(
        `Failed to ensure server is running on initialization: ${error}`,
      );
    });

    // Start periodic health checks
    this.startHealthCheckTimer();
  }

  /**
   * Validate that the binary exists and is executable
   */
  private validateBinary(): void {
    if (!fs.existsSync(this.binaryPath)) {
      throw new Error(`Database binary not found at: ${this.binaryPath}`);
    }

    const stats = fs.statSync(this.binaryPath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${this.binaryPath}`);
    }

    // Check executable permissions on Unix-like systems
    if (process.platform !== "win32") {
      if (!(stats.mode & parseInt("111", 8))) {
        Logger.warning(
          `Binary is not executable, attempting to fix permissions: ${this.binaryPath}`,
        );
        try {
          fs.chmodSync(this.binaryPath, "755");
          Logger.info(`Fixed permissions for binary: ${this.binaryPath}`);
        } catch (error) {
          throw new Error(
            `Binary is not executable and cannot fix permissions: ${this.binaryPath}. Error: ${error}`,
          );
        }
      }
    }

    Logger.info(`Binary validated successfully: ${this.binaryPath}`);
  }

  /**
   * Start periodic health checks to monitor server status
   */
  private startHealthCheckTimer(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const isHealthy = await this.performHealthCheck();
        if (!isHealthy && this.isServerRunning) {
          Logger.warning("Health check failed, server appears to be down");
          this.isServerRunning = false;
          DatabaseService.globalServerRunning = false;

          // Attempt to restart server
          await this.ensureServerRunning();
        }
      } catch (error) {
        Logger.error(`Health check error: ${error}`);
      }
    }, DatabaseService.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Perform a quick health check on the server
   */
  private async performHealthCheck(): Promise<boolean> {
    // Avoid too frequent health checks
    const now = Date.now();
    if (now - DatabaseService.lastHealthCheck < 5000) {
      return this.isServerRunning;
    }
    DatabaseService.lastHealthCheck = now;

    try {
      const http = require("http");

      return new Promise<boolean>((resolve) => {
        const options = {
          hostname: "localhost",
          port: this.serverPort,
          path: "/ping",
          method: "GET",
          timeout: 3000,
        };

        const req = http.request(options, (res: any) => {
          let responseData = "";
          res.on("data", (chunk: any) => {
            responseData += chunk;
          });
          res.on("end", () => {
            const isHealthy = res.statusCode === 200;
            Logger.info(
              `Health check response: status=${res.statusCode}, data=${responseData}`,
            );
            resolve(isHealthy);
          });
        });

        req.on("error", (error: any) => {
          Logger.warning(`Health check error: ${error.message}`);
          resolve(false);
        });

        req.on("timeout", () => {
          Logger.warning("Health check timeout");
          req.destroy();
          resolve(false);
        });

        req.setTimeout(3000);
        req.end();
      });
    } catch (error) {
      Logger.warning(`Health check exception: ${error}`);
      return false;
    }
  }

  /**
   * Ensure server is running - implements singleton pattern with proper health validation
   */
  private async ensureServerRunning(): Promise<void> {
    // First, check if a server is already running on the fixed port and it's our SQLite server
    const isExistingServerHealthy = await this.performHealthCheck();

    if (isExistingServerHealthy) {
      Logger.info(
        `SQLite server already running on port ${this.serverPort}, reusing existing instance`,
      );
      this.isServerRunning = true;
      DatabaseService.globalServerRunning = true;
      return;
    }

    // If we think we have a server running but health check failed, clean up
    if (this.isServerRunning || DatabaseService.globalServerRunning) {
      Logger.warning(
        "Server was marked as running but health check failed, cleaning up",
      );
      this.isServerRunning = false;
      DatabaseService.globalServerRunning = false;
      this.killServerProcess();
    }

    // Check if the fixed port is available
    const isFixedPortFree = await this.checkPortAvailability(
      DatabaseService.FIXED_SERVER_PORT,
    );

    if (!isFixedPortFree) {
      // Port is occupied by something else, find an alternative port
      Logger.warning(
        `Fixed port ${DatabaseService.FIXED_SERVER_PORT} is occupied by another service, searching for alternative port`,
      );
      const alternativePort = await this.findAvailablePort();
      if (alternativePort) {
        Logger.info(`Using alternative port: ${alternativePort}`);
        this.serverPort = alternativePort;
      } else {
        throw new Error(
          `No available ports found in range ${DatabaseService.FIXED_SERVER_PORT}-${DatabaseService.FIXED_SERVER_PORT + 10}`,
        );
      }
    }

    if (!DatabaseService.globalServerRunning) {
      await this.startNewServer();
    }
  }

  /**
   * Check if the port is available
   */
  private async checkPortAvailability(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require("net");
      const server = net.createServer();

      server.listen(port, () => {
        server.once("close", () => {
          resolve(true);
        });
        server.close();
      });

      server.on("error", () => {
        resolve(false);
      });
    });
  }

  /**
   * Find an available port starting from the fixed port
   */
  private async findAvailablePort(): Promise<number | null> {
    const startPort = DatabaseService.FIXED_SERVER_PORT;
    const maxPort = startPort + 10; // Check up to 10 ports above the fixed port

    for (let port = startPort; port <= maxPort; port++) {
      const isAvailable = await this.checkPortAvailability(port);
      if (isAvailable) {
        return port;
      }
    }

    return null;
  }

  /**
   * Attempt to terminate existing server on the port
   */
  private async terminateExistingServer(): Promise<void> {
    try {
      Logger.info(
        `Attempting to terminate existing server on port ${this.serverPort}`,
      );

      // Try to find and kill the process using the port
      const { spawn } = require("child_process");

      // Use lsof to find the process using the port
      const lsofProcess = spawn("lsof", ["-ti", `:${this.serverPort}`], {
        stdio: "pipe",
      });

      let pidOutput = "";
      lsofProcess.stdout.on("data", (data: any) => {
        pidOutput += data.toString();
      });

      lsofProcess.on("close", (code: number) => {
        if (code === 0 && pidOutput.trim()) {
          const pids = pidOutput
            .trim()
            .split("\n")
            .filter((pid) => pid.trim());
          Logger.info(
            `Found processes using port ${this.serverPort}: ${pids.join(", ")}`,
          );

          // Kill each process
          pids.forEach((pid) => {
            try {
              process.kill(parseInt(pid.trim()), "SIGTERM");
              Logger.info(`Sent SIGTERM to process ${pid}`);
            } catch (error) {
              Logger.warning(`Failed to kill process ${pid}: ${error}`);
            }
          });
        }
      });

      lsofProcess.on("error", (error: any) => {
        Logger.warning(`lsof command failed: ${error.message}`);
      });
    } catch (error) {
      Logger.warning(`Failed to terminate existing server: ${error}`);
    }
  }

  /**
   * Start a new server instance
   */
  private async startNewServer(): Promise<void> {
    if (DatabaseService.globalServerRunning) {
      return; // Another instance beat us to it
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.attemptServerStart();
        this.isServerRunning = true;
        DatabaseService.globalServerRunning = true;
        Logger.info(
          `Database server started successfully on port ${this.serverPort} (attempt ${attempt})`,
        );
        return;
      } catch (error) {
        Logger.warning(`Server start attempt ${attempt} failed: ${error}`);

        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
          Logger.info(`Retrying server start in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw new Error(
            `Failed to start database server after ${this.maxRetries} attempts. Last error: ${error}`,
          );
        }
      }
    }
  }

  /**
   * Single attempt to start the server
   */
  private async attemptServerStart(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use fixed port for singleton behavior
      const args = ["server", "--port", this.serverPort.toString()];
      const binaryDir = path.dirname(this.binaryPath);

      Logger.info(`Starting database server with binary: ${this.binaryPath}`);
      Logger.info(`Server working directory: ${binaryDir}`);
      Logger.info(`Server arguments: ${args.join(" ")}`);

      // Check if binary exists
      if (!fs.existsSync(this.binaryPath)) {
        return reject(
          new Error(`Binary not found at path: ${this.binaryPath}`),
        );
      }

      // Set environment variables
      const env = {
        ...process.env,
        BINARY_DIR: binaryDir,
        NODE_ENV: process.env.NODE_ENV || "production",
      };

      this.serverProcess = spawn(this.binaryPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        detached: false,
        cwd: binaryDir,
        env: env,
      });

      let startupOutput = "";
      const startupTimeout = setTimeout(() => {
        this.killServerProcess();
        reject(new Error(`Server startup timeout. Output: ${startupOutput}`));
      }, DatabaseService.STARTUP_TIMEOUT);

      this.serverProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        startupOutput += output;
        Logger.info(`Server stdout: ${output.trim()}`);

        // Look for server ready indicators
        if (
          output.includes("Server started on port") ||
          output.includes("Server listening") ||
          output.includes("HTTP server started")
        ) {
          clearTimeout(startupTimeout);
          resolve();
        }
      });

      this.serverProcess.stderr?.on("data", (data) => {
        const error = data.toString();
        startupOutput += error;
        Logger.warning(`Server stderr: ${error.trim()}`);

        // Check for port already in use (another instance started first)
        if (
          error.includes("EADDRINUSE") ||
          (error.includes("port") && error.includes("already"))
        ) {
          clearTimeout(startupTimeout);
          Logger.info(
            "Port already in use, checking if existing server is healthy",
          );

          // Give the existing server a moment, then check health
          setTimeout(async () => {
            const isHealthy = await this.performHealthCheck();
            if (isHealthy) {
              Logger.info("Existing server is healthy, using it");
              this.killServerProcess();
              resolve();
            } else {
              this.killServerProcess();
              reject(
                new Error("Port in use but existing server is not healthy"),
              );
            }
          }, 1000);
        }
      });

      this.serverProcess.on("error", (error) => {
        clearTimeout(startupTimeout);
        this.killServerProcess();
        reject(new Error(`Failed to spawn server process: ${error.message}`));
      });

      this.serverProcess.on("exit", (code, signal) => {
        clearTimeout(startupTimeout);
        this.isServerRunning = false;
        this.serverProcess = null;

        if (code !== 0 && code !== null) {
          reject(
            new Error(
              `Server process exited with code ${code}, signal ${signal}. Output: ${startupOutput}`,
            ),
          );
        }
      });

      // Additional verification after startup delay
      setTimeout(async () => {
        if (this.serverProcess && !this.serverProcess.killed) {
          const isHealthy = await this.performHealthCheck();
          if (isHealthy) {
            clearTimeout(startupTimeout);
            resolve();
          }
        }
      }, 2000);
    });
  }

  /**
   * Safely kill the server process
   */
  private killServerProcess(): void {
    if (this.serverProcess && !this.serverProcess.killed) {
      try {
        this.serverProcess.kill("SIGTERM");

        // Force kill after timeout
        setTimeout(() => {
          if (this.serverProcess && !this.serverProcess.killed) {
            this.serverProcess.kill("SIGKILL");
          }
        }, 5000);
      } catch (error) {
        Logger.warning(`Error killing server process: ${error}`);
      }
      this.serverProcess = null;
    }
  }

  /**
   * Stop the server
   */
  private async stopServer(): Promise<void> {
    Logger.info("Stopping database server");
    this.isServerRunning = false;
    DatabaseService.globalServerRunning = false;
    this.killServerProcess();
  }

  /**
   * Execute a command with improved error handling and fallback mechanisms
   */
  private async executeCommand(args: string[]): Promise<any> {
    // Ensure server is running before executing commands
    await this.ensureServerRunning();

    // Always try server-based approach first if the server is running
    if (this.isServerRunning) {
      try {
        return await this.executeViaServer(args);
      } catch (error: any) {
        Logger.warning(`Server-based execution failed: ${error}`);

        // If it's a connection error, mark server as down and retry once
        if (error.code === "ECONNREFUSED" || error.code === "ECONNRESET") {
          this.isServerRunning = false;
          DatabaseService.globalServerRunning = false;

          // Try to restart server and retry once
          try {
            await this.ensureServerRunning();
            return await this.executeViaServer(args);
          } catch (retryError) {
            Logger.warning(`Server retry failed: ${retryError}`);
          }
        }
      }
    }

    // Fallback to direct binary execution
    Logger.warning(
      `Falling back to direct CLI execution for: ${args.join(" ")}`,
    );
    return await this.executeDirectly(args);
  }

  /**
   * Execute command via HTTP server
   */
  private async executeViaServer(args: string[]): Promise<any> {
    Logger.info(`Executing via HTTP API: ${args.join(" ")}`);

    try {
      const http = require("http");

      // Map CLI commands to API endpoints and request bodies
      let endpoint = "";
      let requestBody: any = {};

      if (args[0] === "home") {
        if (args[1] === "--list") {
          endpoint = "/database/items";
          requestBody = { action: "list" };
        } else if (args[1] === "--add") {
          endpoint = "/database/items";
          requestBody = { action: "add", name: args[2] };
        } else if (args[1] === "--delete") {
          endpoint = "/database/items";
          requestBody = { action: "delete", id: args[2] };
        } else if (args[1] === "--update") {
          endpoint = "/database/items";
          requestBody = { action: "update", id: args[2], name: args[3] };
        } else if (args[1] === "--init") {
          endpoint = "/database/init";
          requestBody = {};
        } else if (args[1] === "--clear") {
          endpoint = "/database/clear";
          requestBody = {};
        } else if (args[1] === "--export") {
          endpoint = "/database/items";
          requestBody = { action: "list" };
        } else if (args[1] === "--details") {
          endpoint = "/database/items";
          requestBody = { action: "list" };
        }
      } else if (args[0] === "ping") {
        return new Promise((resolve, reject) => {
          const options = {
            hostname: "localhost",
            port: this.serverPort,
            path: "/ping",
            method: "GET",
            timeout: 5000,
          };

          const req = http.request(options, (res: any) => {
            if (res.statusCode === 200) {
              resolve({ status: "ok" });
            } else {
              reject(new Error(`Ping failed with status ${res.statusCode}`));
            }
          });

          req.on("error", reject);
          req.setTimeout(5000);
          req.end();
        });
      }

      if (!endpoint) {
        throw new Error(`Unknown command: ${args.join(" ")}`);
      }

      const requestData = JSON.stringify(requestBody);
      Logger.info(
        `Sending API request to endpoint: ${endpoint}, body: ${requestData}`,
      );

      return new Promise((resolve, reject) => {
        const options = {
          hostname: "localhost",
          port: this.serverPort,
          path: endpoint,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(requestData),
          },
          timeout: 10000,
        };

        const req = http.request(options, (res: any) => {
          let data = "";

          res.on("data", (chunk: any) => {
            data += chunk;
          });

          res.on("end", () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const result = data ? JSON.parse(data) : {};
                Logger.info(`Server response received: ${res.statusCode}`);

                if (result.items) {
                  resolve(result.items);
                } else if (result.success) {
                  resolve(result);
                } else {
                  resolve(result);
                }
              } catch (parseError: any) {
                Logger.error(`Error parsing server response: ${parseError}`);
                reject(
                  new Error(
                    `Failed to parse server response: ${parseError.message}`,
                  ),
                );
              }
            } else {
              Logger.error(`Server returned error status: ${res.statusCode}`);
              reject(
                new Error(
                  `Server returned status code ${res.statusCode}: ${data || "No response body"}`,
                ),
              );
            }
          });
        });

        req.on("error", (error: any) => {
          Logger.error(`HTTP request error: ${error.message}`);
          reject(error);
        });

        req.setTimeout(10000);
        req.write(requestData);
        req.end();
      });
    } catch (error: any) {
      Logger.error(`executeViaServer error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute command directly via binary spawn
   */
  private async executeDirectly(args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      Logger.info(`Executing: ${this.binaryPath} ${args.join(" ")}`);

      const process = spawn(this.binaryPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      process.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("error", (error) => {
        reject(new Error(`Process spawn error: ${error.message}`));
      });

      process.on("close", (code) => {
        if (code === 0) {
          try {
            const result = stdout.trim() ? JSON.parse(stdout) : {};
            resolve(result);
          } catch (parseError) {
            resolve({ output: stdout.trim() });
          }
        } else {
          reject(
            new Error(
              `Command failed with code ${code}. Error: ${stderr || "No error output"}`,
            ),
          );
        }
      });

      setTimeout(() => {
        if (!process.killed) {
          process.kill();
          reject(new Error("Command execution timeout"));
        }
      }, 30000);
    });
  }

  /**
   * Initialize database with retry logic
   */
  public async initializeDatabase(): Promise<void> {
    try {
      await this.executeCommand(["home", "--init"]);
      Logger.info("Database initialized successfully");
    } catch (error) {
      Logger.error(`Failed to initialize database: ${error}`);
      throw error;
    }
  }

  /**
   * List all items in the database
   */
  public async listItems(): Promise<any[]> {
    try {
      const result = await this.executeCommand(["home", "--list"]);
      return Array.isArray(result) ? result : result.items || [];
    } catch (error) {
      Logger.error(`Failed to list items: ${error}`);
      // Return empty array on error to prevent UI crash
      return [];
    }
  }

  /**
   * Add a new item to the database
   */
  public async addItem(name: string): Promise<void> {
    if (!name?.trim()) {
      throw new Error("Item name cannot be empty");
    }

    try {
      await this.executeCommand(["home", "--add", name.trim()]);
      Logger.info(`Added item: ${name}`);
    } catch (error) {
      Logger.error(`Failed to add item: ${error}`);
      throw error;
    }
  }

  /**
   * Delete an item from the database
   */
  public async deleteItem(id: string): Promise<void> {
    if (!id?.trim()) {
      throw new Error("Item ID cannot be empty");
    }

    try {
      await this.executeCommand(["home", "--delete", id.trim()]);
      Logger.info(`Deleted item: ${id}`);
    } catch (error) {
      Logger.error(`Failed to delete item: ${error}`);
      throw error;
    }
  }

  /**
   * Update an existing item
   */
  public async updateItem(id: string, newName: string): Promise<void> {
    if (!id?.trim() || !newName?.trim()) {
      throw new Error("Item ID and new name cannot be empty");
    }

    try {
      await this.executeCommand([
        "home",
        "--update",
        id.trim(),
        newName.trim(),
      ]);
      Logger.info(`Updated item ${id} to: ${newName}`);
    } catch (error) {
      Logger.error(`Failed to update item: ${error}`);
      throw error;
    }
  }

  /**
   * Clear all items from the database
   */
  public async clearDatabase(): Promise<void> {
    try {
      await this.executeCommand(["home", "--clear"]);
      Logger.info("Database cleared successfully");
    } catch (error) {
      Logger.error(`Failed to clear database: ${error}`);
      throw error;
    }
  }

  /**
   * Export all data from the database
   */
  public async exportData(): Promise<any[]> {
    try {
      const result = await this.executeCommand(["home", "--export"]);
      return Array.isArray(result) ? result : result.data || [];
    } catch (error) {
      Logger.error(`Failed to export data: ${error}`);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific item
   */
  public async getItemDetails(id: string): Promise<any> {
    if (!id?.trim()) {
      throw new Error("Item ID cannot be empty");
    }

    try {
      const result = await this.executeCommand([
        "home",
        "--details",
        id.trim(),
      ]);
      return result;
    } catch (error) {
      Logger.error(`Failed to get item details: ${error}`);
      throw error;
    }
  }

  /**
   * Check if the database service is healthy
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.performHealthCheck();
      return true;
    } catch (error) {
      Logger.warning(`Health check failed: ${error}`);
      return false;
    }
  }

  /**
   * Get service status information
   */
  public getStatus(): {
    isServerRunning: boolean;
    serverPort: number;
    binaryPath: string;
    globalServerRunning: boolean;
  } {
    return {
      isServerRunning: this.isServerRunning,
      serverPort: this.serverPort,
      binaryPath: this.binaryPath,
      globalServerRunning: DatabaseService.globalServerRunning,
    };
  }

  /**
   * Dispose of the service and cleanup resources
   */
  public dispose(): void {
    Logger.info("Disposing DatabaseService");

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Only stop the server if this instance started it
    if (this.serverProcess) {
      this.stopServer();
    }
  }
}
