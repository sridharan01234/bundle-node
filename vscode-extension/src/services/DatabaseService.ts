import { spawn } from "child_process";
import { DatabaseItem, ItemDetails } from "../types";
import { Logger } from "../utils/Logger";

/**
 * Database service for executing commands and parsing results
 */
export class DatabaseService {
  constructor(private binaryPath: string) {}

  /**
   * Execute a database command
   */
  private async executeCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      Logger.info(`Executing command: ${this.binaryPath} ${args.join(" ")}`);

      const process = spawn(this.binaryPath, args);
      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr || `Command failed with code ${code}`));
        }
      });

      process.on("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse database items from command output
   */
  private parseItems(output: string): DatabaseItem[] {
    if (!output || output.trim() === "") {
      return [];
    }

    const lines = output.split("\n").filter((line) => line.trim());
    const items: DatabaseItem[] = [];

    // Skip header lines and find data rows
    let foundData = false;
    for (const line of lines) {
      // Skip header and separator lines
      if (line.includes("ID | Name | Created At") || line.includes("--")) {
        foundData = true;
        continue;
      }

      // Skip info lines before the table
      if (
        !foundData ||
        line.includes("SQLite3 loaded") ||
        line.includes("Successfully loaded") ||
        line.includes("Listing items")
      ) {
        continue;
      }

      // Parse data rows
      if (line.includes(" | ")) {
        const parts = line.split(" | ").map((part) => part.trim());
        if (parts.length >= 3) {
          items.push({
            id: parts[0],
            name: parts[1],
            created_at: parts[2],
          });
        }
      }
    }

    return items;
  }

  async initializeDatabase(): Promise<void> {
    await this.executeCommand(["home", "--init"]);
  }

  async addItem(name: string): Promise<void> {
    if (!name?.trim()) {
      throw new Error("Item name cannot be empty");
    }
    await this.executeCommand(["home", "--add", name.trim()]);
  }

  async deleteItem(id: string): Promise<void> {
    if (!id) {
      throw new Error("Item ID is required");
    }
    await this.executeCommand(["home", "--remove", id]);
  }

  async updateItem(id: string, name: string): Promise<void> {
    if (!id || !name?.trim()) {
      throw new Error("Item ID and name are required");
    }
    await this.executeCommand(["home", "--update", id, name.trim()]);
  }

  async listItems(): Promise<DatabaseItem[]> {
    const output = await this.executeCommand(["home", "--list"]);
    return this.parseItems(output);
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
    await this.executeCommand(["home", "--clear"]);
  }

  async exportData(): Promise<DatabaseItem[]> {
    return await this.listItems();
  }
}
