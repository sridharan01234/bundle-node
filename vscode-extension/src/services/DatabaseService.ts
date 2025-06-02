import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { Logger } from "../utils/Logger";

/**
 * Enhanced database service with improved binary handling and server management
 */
export class DatabaseService {
  private binaryPath: string;
  private serverProcess: ChildProcess | null = null;
  private serverPort: number = 0;
  private isServerRunning: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  constructor(binaryPath: string) {
    this.binaryPath = binaryPath;
    this.validateBinary();
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
   * Start the internal HTTP server with retry logic
   */
  private async startServer(): Promise<void> {
    if (this.isServerRunning) {
      return;
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.attemptServerStart();
        this.isServerRunning = true;
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
      // Find an available port
      this.serverPort = 8000 + Math.floor(Math.random() * 1000);

      const args = ["--server", "--port", this.serverPort.toString()];

      Logger.info(
        `Starting database server: ${this.binaryPath} ${args.join(" ")}`,
      );

      this.serverProcess = spawn(this.binaryPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        detached: false,
      });

      let startupOutput = "";
      const startupTimeout = setTimeout(() => {
        reject(new Error(`Server startup timeout. Output: ${startupOutput}`));
      }, 10000);

      this.serverProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        startupOutput += output;
        Logger.info(`Server stdout: ${output.trim()}`);

        // Look for server ready indicators
        if (
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
      });

      this.serverProcess.on("error", (error) => {
        clearTimeout(startupTimeout);
        reject(new Error(`Failed to spawn server process: ${error.message}`));
      });

      this.serverProcess.on("exit", (code, signal) => {
        clearTimeout(startupTimeout);
        this.isServerRunning = false;
        this.serverProcess = null;

        if (code !== 0) {
          reject(
            new Error(
              `Server process exited with code ${code}, signal ${signal}. Output: ${startupOutput}`,
            ),
          );
        }
      });

      // Give the server a moment to start
      setTimeout(() => {
        if (this.serverProcess && !this.serverProcess.killed) {
          clearTimeout(startupTimeout);
          resolve();
        }
      }, 2000);
    });
  }

  /**
   * Execute a command with improved error handling and fallback mechanisms
   */
  private async executeCommand(args: string[]): Promise<any> {
    // Try server-based approach first
    if (this.isServerRunning) {
      try {
        return await this.executeViaServer(args);
      } catch (error) {
        Logger.warning(
          `Server-based execution failed, falling back to direct execution: ${error}`,
        );
        this.isServerRunning = false;
      }
    }

    // Fallback to direct binary execution
    return await this.executeDirectly(args);
  }

  /**
   * Execute command via HTTP server
   */
  private async executeViaServer(args: string[]): Promise<any> {
    // Implementation would depend on your server's HTTP API
    // This is a placeholder for server-based communication
    throw new Error("Server-based execution not implemented");
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
            // If JSON parsing fails, return raw output
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

      // Set a timeout for long-running commands
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
      await this.startServer();
      await this.executeCommand(["init"]);
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
      const result = await this.executeCommand(["list"]);
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
      await this.executeCommand(["add", name.trim()]);
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
      await this.executeCommand(["delete", id.trim()]);
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
      await this.executeCommand(["update", id.trim(), newName.trim()]);
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
      await this.executeCommand(["clear"]);
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
      const result = await this.executeCommand(["export"]);
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
      const result = await this.executeCommand(["details", id.trim()]);
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
      await this.executeCommand(["ping"]);
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
  } {
    return {
      isServerRunning: this.isServerRunning,
      serverPort: this.serverPort,
      binaryPath: this.binaryPath,
    };
  }

  /**
   * Dispose of the service and cleanup resources
   */
  public dispose(): void {
    if (this.serverProcess && !this.serverProcess.killed) {
      Logger.info("Shutting down database server...");
      this.serverProcess.kill();
      this.serverProcess = null;
    }
    this.isServerRunning = false;
  }
}
