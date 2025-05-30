import * as vscode from "vscode";
import {
  executeDatabaseCommand,
  parseDbItemsFromOutput,
  findItemById,
} from "./dbCommandExecutor";
import { DbItem, ItemDetails } from "./dbTypes";
import { showError, showInfo } from "../utils/common";

/**
 * Initialize the database
 * @param binaryPath Path to the binary
 */
export async function initializeDatabase(binaryPath: string): Promise<void> {
  try {
    await executeDatabaseCommand(binaryPath, "home", ["--init"]);
    showInfo("Database initialized successfully");
    return Promise.resolve();
  } catch (error: any) {
    showError(`Failed to initialize database: ${error.message}`);
    return Promise.reject(error);
  }
}

/**
 * Add an item to the database
 * @param binaryPath Path to the binary
 * @param itemName Name of the item to add
 */
export async function addItem(
  binaryPath: string,
  itemName: string,
): Promise<void> {
  try {
    if (!itemName || itemName.trim() === "") {
      return Promise.reject(new Error("Item name cannot be empty"));
    }

    await executeDatabaseCommand(binaryPath, "home", [
      "--add",
      itemName.trim(),
    ]);
    showInfo(`Added item: ${itemName}`);
    return Promise.resolve();
  } catch (error: any) {
    showError(`Failed to add item: ${error.message}`);
    return Promise.reject(error);
  }
}

/**
 * Delete an item from the database
 * @param binaryPath Path to the binary
 * @param itemId ID of the item to delete
 */
export async function deleteItem(
  binaryPath: string,
  itemId: string,
): Promise<void> {
  try {
    if (!itemId) {
      return Promise.reject(new Error("Invalid item ID"));
    }

    // Using --remove flag instead of --delete to match the CLI implementation
    await executeDatabaseCommand(binaryPath, "home", ["--remove", itemId]);
    showInfo(`Deleted item with ID: ${itemId}`);
    return Promise.resolve();
  } catch (error: any) {
    showError(`Failed to delete item: ${error.message}`);
    return Promise.reject(error);
  }
}

/**
 * Update an item in the database
 * @param binaryPath Path to the binary
 * @param itemId ID of the item to update
 * @param newName New name for the item
 */
export async function updateItem(
  binaryPath: string,
  itemId: string,
  newName: string,
): Promise<void> {
  try {
    if (!itemId || !newName || newName.trim() === "") {
      return Promise.reject(new Error("Invalid item ID or name"));
    }

    await executeDatabaseCommand(binaryPath, "home", [
      "--update",
      itemId,
      newName.trim(),
    ]);
    showInfo(`Updated item: ${newName}`);
    return Promise.resolve();
  } catch (error: any) {
    showError(`Failed to update item: ${error.message}`);
    return Promise.reject(error);
  }
}

/**
 * Get all items from the database
 * @param binaryPath Path to the binary
 * @returns List of database items
 */
export async function listItems(binaryPath: string): Promise<DbItem[]> {
  try {
    const output = await executeDatabaseCommand(binaryPath, "home", ["--list"]);
    return parseDbItemsFromOutput(output);
  } catch (error: any) {
    showError(`Failed to list items: ${error.message}`);
    return Promise.reject(error);
  }
}

/**
 * Gets details for a specific item
 * @param binaryPath Path to the binary
 * @param itemId ID of the item to get details for
 * @returns Item details with additional metadata
 */
export async function getItemDetails(
  binaryPath: string,
  itemId: string,
): Promise<ItemDetails | undefined> {
  try {
    const items = await executeDatabaseCommand(binaryPath, "home", ["--list"]);
    const item = findItemById(items, itemId);

    if (!item) {
      return undefined;
    }

    // Enhanced with additional metadata
    return {
      ...item,
      length: item.name.length,
      words: item.name.split(" ").length,
    };
  } catch (error: any) {
    showError(`Failed to get item details: ${error.message}`);
    return Promise.reject(error);
  }
}

/**
 * Duplicate an item in the database
 * @param binaryPath Path to the binary
 * @param itemId ID of the item to duplicate
 */
export async function duplicateItem(
  binaryPath: string,
  itemId: string,
): Promise<void> {
  try {
    if (!itemId) {
      return Promise.reject(new Error("Invalid item ID"));
    }

    // Get the original item to duplicate
    const items = await executeDatabaseCommand(binaryPath, "home", ["--list"]);
    const originalItem = findItemById(items, itemId);

    if (!originalItem) {
      return Promise.reject(new Error(`Item with ID ${itemId} not found`));
    }

    const copyName = `${originalItem.name} (Copy)`;
    await executeDatabaseCommand(binaryPath, "home", ["--add", copyName]);
    showInfo(`Duplicated item: ${copyName}`);
    return Promise.resolve();
  } catch (error: any) {
    showError(`Failed to duplicate item: ${error.message}`);
    return Promise.reject(error);
  }
}

/**
 * Export database data to JSON
 * @param binaryPath Path to the binary
 */
export async function exportData(binaryPath: string): Promise<void> {
  try {
    try {
      // Try native export function if available
      const data = await executeDatabaseCommand(binaryPath, "home", [
        "--export",
      ]);

      // Save to file
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file("database_export.json"),
        filters: {
          "JSON Files": ["json"],
          "All Files": ["*"],
        },
      });

      if (saveUri) {
        await vscode.workspace.fs.writeFile(saveUri, Buffer.from(data, "utf8"));
        showInfo(`Database exported to ${saveUri.fsPath}`);
      }
    } catch (error) {
      // Fallback: get list and format as JSON
      const listOutput = await executeDatabaseCommand(binaryPath, "home", [
        "--list",
      ]);
      const items = parseDbItemsFromOutput(listOutput);

      const exportData = {
        timestamp: new Date().toISOString(),
        data: items,
      };

      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file("database_export.json"),
        filters: {
          "JSON Files": ["json"],
          "All Files": ["*"],
        },
      });

      if (saveUri) {
        await vscode.workspace.fs.writeFile(
          saveUri,
          Buffer.from(JSON.stringify(exportData, null, 2), "utf8"),
        );
        showInfo(`Database exported to ${saveUri.fsPath}`);
      }
    }
    return Promise.resolve();
  } catch (error: any) {
    showError(`Failed to export data: ${error.message}`);
    return Promise.reject(error);
  }
}

/**
 * Clear all items from the database
 * @param binaryPath Path to the binary
 */
export async function clearDatabase(binaryPath: string): Promise<void> {
  try {
    // Try clear command if available
    try {
      await executeDatabaseCommand(binaryPath, "home", ["--clear"]);
      showInfo("Database cleared successfully");
      return Promise.resolve();
    } catch (primaryError) {
      // If command doesn't exist, try reinitializing
      console.log("Clear command not available, trying reinitialization...");
      await executeDatabaseCommand(binaryPath, "home", ["--init"]);
      showInfo("Database cleared via reinitialization");
      return Promise.resolve();
    }
  } catch (error: any) {
    showError(`Failed to clear database: ${error.message}`);
    return Promise.reject(error);
  }
}
