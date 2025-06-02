import { DatabaseItem, ItemDetails } from "../types";
import { Logger } from "../utils/Logger";

/**
 * Optimized HTTP-based Database service for better performance
 * Communicates with the binary in server mode via REST API
 * Supports multiple VS Code instances without conflicts
 */
export class DatabaseService {
  private baseUrl: string;
  private serverProcess: any = null;
  private serverStatus: "unknown" | "running" | "starting" | "failed" =
    "unknown";
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // Check every 30 seconds
  private connectionPromise: Promise<void> | null = null;

  constructor(
    private binaryPath: string,
    port: number = 9090,
  ) {
    this.baseUrl = `http://localhost:${port}`;
  }

  /**
   * Smart server connection management - only checks when needed
   */
  private async ensureServerRunning(): Promise<void> {
    // If we're already in the process of connecting, wait for it
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // If server status is known to be running and recent, skip check
    const now = Date.now();
    if (
      this.serverStatus === "running" &&
      now - this.lastHealthCheck < this.healthCheckInterval
    ) {
      return;
    }

    // Create connection promise to avoid parallel checks
    this.connectionPromise = this._ensureConnection();

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async _ensureConnection(): Promise<void> {
    // Quick health check
    if (await this.isServerRunning()) {
      this.serverStatus = "running";
      this.lastHealthCheck = Date.now();
      return;
    }

    // Server not running, start it
    if (this.serverStatus !== "starting") {
      await this.startServer();
    }
  }

  /**
   * Start the server
   */
  private async startServer(): Promise<void> {
    this.serverStatus = "starting";
    Logger.info("Starting database server...");

    const { spawn } = await import("child_process");

    // Start server in background - don't manage shutdown
    this.serverProcess = spawn(this.binaryPath, ["server", "--port", "9090"], {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Log server output
    this.serverProcess.stdout?.on("data", (data: Buffer) => {
      Logger.info(`Server: ${data.toString().trim()}`);
    });

    this.serverProcess.stderr?.on("data", (data: Buffer) => {
      Logger.error(`Server Error: ${data.toString().trim()}`);
    });

    // Detach from parent process
    this.serverProcess.unref();

    // Wait for server to become available
    await this.waitForServer();
    this.serverStatus = "running";
    this.lastHealthCheck = Date.now();
  }

  /**
   * Optimized server health check with caching
   */
  private async isServerRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/ping`, {
        method: "GET",
        signal: AbortSignal.timeout(1000), // Reduced timeout for faster checks
      });
      return response.ok;
    } catch (error) {
      this.serverStatus = "failed";
      return false;
    }
  }

  /**
   * Wait for server to become available
   */
  private async waitForServer(maxAttempts: number = 10): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.isServerRunning()) {
        Logger.info("Server is ready");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    this.serverStatus = "failed";
    throw new Error("Server failed to start within timeout period");
  }

  /**
   * Optimized HTTP request with connection reuse and error handling
   */
  private async makeRequest(endpoint: string, data: any): Promise<any> {
    let retries = 2;

    while (retries > 0) {
      try {
        await this.ensureServerRunning();

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        retries--;

        // If connection failed, mark server as failed and retry
        if (error instanceof TypeError && error.message.includes("fetch")) {
          this.serverStatus = "failed";
          this.lastHealthCheck = 0; // Force health check on next request

          if (retries > 0) {
            Logger.info("Connection failed, retrying...");
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
        }

        throw error;
      }
    }
  }

  /**
   * Parse database items from server response
   */
  private parseItems(data: any): DatabaseItem[] {
    if (!data || !Array.isArray(data.items)) {
      return [];
    }

    return data.items.map((item: any) => ({
      id: String(item.id),
      name: String(item.name),
      created_at: String(item.created_at),
    }));
  }

  async initializeDatabase(): Promise<void> {
    Logger.info("Initializing database via HTTP");
    await this.makeRequest("/database/init", {});
  }

  async addItem(name: string): Promise<void> {
    if (!name?.trim()) {
      throw new Error("Item name cannot be empty");
    }

    Logger.info(`Adding item: ${name}`);
    await this.makeRequest("/database/items", {
      action: "add",
      name: name.trim(),
    });
  }

  async deleteItem(id: string): Promise<void> {
    if (!id) {
      throw new Error("Item ID is required");
    }

    Logger.info(`Deleting item: ${id}`);
    await this.makeRequest("/database/items", {
      action: "delete",
      id: id,
    });
  }

  async updateItem(id: string, name: string): Promise<void> {
    if (!id || !name?.trim()) {
      throw new Error("Item ID and name are required");
    }

    Logger.info(`Updating item ${id}: ${name}`);
    await this.makeRequest("/database/items", {
      action: "update",
      id: id,
      name: name.trim(),
    });
  }

  async listItems(): Promise<DatabaseItem[]> {
    Logger.info("Fetching items via HTTP");
    const response = await this.makeRequest("/database/items", {
      action: "list",
    });

    return this.parseItems(response);
  }

  async getItemDetails(id: string): Promise<ItemDetails | undefined> {
    const items = await this.listItems();
    const item = items.find((i) => i.id === id);

    if (!item) {
      return undefined;
    }

    return {
      ...item,
      length: item.name.length,
      words: item.name.split(" ").length,
    };
  }

  async clearDatabase(): Promise<void> {
    Logger.info("Clearing database via HTTP");
    await this.makeRequest("/database/clear", {});
  }

  async exportData(): Promise<DatabaseItem[]> {
    return await this.listItems();
  }

  /**
   * Cleanup - no longer stops server to support multiple instances
   */
  dispose(): void {
    // Remove server shutdown logic
    // Server will continue running for other VS Code instances
    Logger.info(
      "DatabaseService disposed - server continues running for other instances",
    );
  }
}
