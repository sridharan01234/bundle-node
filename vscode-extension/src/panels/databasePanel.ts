import * as vscode from "vscode";
import * as fs from "fs";
import { getDatabaseHtml } from "./webviewUtils";
import {
  addItem,
  clearDatabase,
  deleteItem,
  duplicateItem,
  exportData,
  getItemDetails,
  initializeDatabase,
  listItems,
  updateItem,
} from "../database/dbOperations";
import {
  DbResponseMessage,
  ItemDetails,
  WebviewMessage,
} from "../database/dbTypes";
import { showError } from "../utils/common";
import { logError, logInfo, logWarning, outputChannel } from "../extension";

/**
 * Manages the database panel webview
 */
export class DatabasePanelManager {
  private static instance: DatabasePanelManager | undefined;
  private panel: vscode.WebviewPanel | undefined;
  private readonly binaryPath: string;
  private disposables: vscode.Disposable[] = [];
  private isInitializing: boolean = false;
  private initRetries: number = 0;
  private readonly MAX_RETRIES = 3;

  /**
   * Creates a new DatabasePanelManager
   * @param extensionUri URI of the extension
   * @param binaryPath Path to the binary
   */
  private constructor(extensionUri: vscode.Uri, binaryPath: string) {
    this.binaryPath = binaryPath;

    // Verify binary exists before creating panel
    if (!fs.existsSync(binaryPath)) {
      const errorMsg = `Binary not found at path: ${binaryPath}`;
      logError(errorMsg);
      throw new Error(errorMsg);
    }

    logInfo(`Creating database panel with binary: ${binaryPath}`);
    this.createPanel(extensionUri);
  }

  /**
   * Gets the singleton instance of DatabasePanelManager
   * @param extensionUri URI of the extension
   * @param binaryPath Path to the binary
   * @returns The DatabasePanelManager instance
   */
  public static getInstance(
    extensionUri: vscode.Uri,
    binaryPath: string,
  ): DatabasePanelManager {
    if (!DatabasePanelManager.instance) {
      logInfo("Creating new database panel instance");
      DatabasePanelManager.instance = new DatabasePanelManager(
        extensionUri,
        binaryPath,
      );
    } else {
      logInfo("Using existing database panel instance");
      // If panel is already created, just reveal it
      DatabasePanelManager.instance.panel?.reveal();

      // Also refresh data
      DatabasePanelManager.instance.refreshData().catch((error) => {
        logError(`Error refreshing data on reveal: ${error.message || error}`);
      });
    }
    return DatabasePanelManager.instance;
  }

  /**
   * Creates the webview panel
   * @param extensionUri URI of the extension
   */
  private createPanel(extensionUri: vscode.Uri): void {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    logInfo("Creating webview panel");
    this.panel = vscode.window.createWebviewPanel(
      "databaseManager",
      "SQLite Database Manager",
      columnToShowIn || vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true,
      },
    );

    logInfo("Setting webview HTML content");
    this.panel.webview.html = getDatabaseHtml(this.panel.webview, extensionUri);
    this.setupMessageHandling();

    this.panel.onDidDispose(
      () => {
        logInfo("Database panel disposed");
        this.dispose();
      },
      null,
      this.disposables,
    );

    // Add a button to show logs in the title bar
    this.panel.title = "SQLite Database Manager";
    this.panel.iconPath = vscode.Uri.joinPath(
      extensionUri,
      "media",
      "icon.svg",
    );

    // Show a notification that users can view logs if needed
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Loading SQLite Database Manager",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Initializing database connection..." });

        try {
          // Load initial data after panel is created
          await this.refreshData();
          return Promise.resolve();
        } catch (error) {
          logError(`Failed to initialize database: ${error}`);
          vscode.window
            .showErrorMessage(
              "Failed to initialize database. Click 'Show Logs' to see details.",
              "Show Logs",
            )
            .then((selection) => {
              if (selection === "Show Logs") {
                outputChannel.show();
              }
            });
          return Promise.resolve();
        }
      },
    );
  }

  /**
   * Sets up message handling from the webview
   */
  private setupMessageHandling(): void {
    this.panel?.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        try {
          logInfo(`Received message from webview: ${message.command}`);

          switch (message.command) {
            case "addItem":
              if (!message.itemName || message.itemName.trim() === "") {
                this.sendResponseToWebview({
                  command: "showError",
                  message: "Please enter a valid item name",
                });
                return;
              }

              try {
                logInfo(`Adding item: ${message.itemName}`);
                await addItem(this.binaryPath, message.itemName.trim());
                await this.refreshData();

                this.sendResponseToWebview({
                  command: "showSuccess",
                  message: `Successfully added item: ${message.itemName}`,
                });
              } catch (error: any) {
                this.handleError("Failed to add item", error);
              }
              break;

            case "deleteItem":
              if (!message.itemId) {
                this.sendResponseToWebview({
                  command: "showError",
                  message: "Invalid item ID",
                });
                return;
              }

              try {
                logInfo(`Deleting item with ID: ${message.itemId}`);
                await deleteItem(this.binaryPath, message.itemId);

                // Show loading while refreshing
                this.sendResponseToWebview({
                  command: "showLoading",
                  message: "Refreshing after delete...",
                });

                // Add a small delay to ensure the database operation completes
                await new Promise((resolve) => setTimeout(resolve, 500));

                // Refresh data from database
                await this.refreshData();

                this.sendResponseToWebview({
                  command: "showSuccess",
                  message: "Item deleted successfully",
                });
              } catch (error: any) {
                this.handleError("Failed to delete item", error);
              }
              break;

            case "updateItem":
              if (!message.itemId || !message.newName) {
                this.sendResponseToWebview({
                  command: "showError",
                  message: "Invalid item ID or name",
                });
                return;
              }

              try {
                logInfo(
                  `Updating item ${message.itemId} to: ${message.newName}`,
                );
                await updateItem(
                  this.binaryPath,
                  message.itemId,
                  message.newName,
                );

                // Show loading while refreshing
                this.sendResponseToWebview({
                  command: "showLoading",
                  message: "Refreshing after update...",
                });

                // Add a small delay to ensure the database operation completes
                await new Promise((resolve) => setTimeout(resolve, 500));

                // Refresh data from database
                await this.refreshData();

                this.sendResponseToWebview({
                  command: "showSuccess",
                  message: "Item updated successfully",
                });
              } catch (error: any) {
                this.handleError("Failed to update item", error);
              }
              break;

            case "initDatabase":
              try {
                logInfo("Manually initializing database");

                // Show that we're initializing to the user
                this.sendResponseToWebview({
                  command: "showLoading",
                  message: "Initializing database...",
                });

                await initializeDatabase(this.binaryPath);
                await this.refreshData();

                this.sendResponseToWebview({
                  command: "showSuccess",
                  message: "Database initialized successfully",
                });
              } catch (error: any) {
                this.handleError("Failed to initialize database", error);
              }
              break;

            case "refresh":
              logInfo("Manual refresh requested");
              // Show that we're refreshing to the user
              this.sendResponseToWebview({
                command: "showLoading",
                message: "Refreshing database items...",
              });

              await this.refreshData();
              break;

            case "clearDatabase":
              try {
                logInfo("Clear database requested");
                const response = await vscode.window.showWarningMessage(
                  "Are you sure you want to clear all database items? This action cannot be undone.",
                  { modal: true },
                  "Yes, Clear All",
                  "Cancel",
                );

                if (response === "Yes, Clear All") {
                  logInfo("Clearing database confirmed");
                  await clearDatabase(this.binaryPath);
                  await this.refreshData();

                  this.sendResponseToWebview({
                    command: "showSuccess",
                    message: "Database cleared successfully",
                  });
                } else {
                  logInfo("Clear database cancelled by user");
                }
              } catch (error: any) {
                this.handleError("Failed to clear database", error);
              }
              break;

            case "exportData":
              try {
                logInfo("Exporting database data");
                await exportData(this.binaryPath);

                this.sendResponseToWebview({
                  command: "showSuccess",
                  message: "Database exported successfully",
                });
              } catch (error: any) {
                this.handleError("Failed to export data", error);
              }
              break;

            case "duplicateItem":
              if (!message.itemId) {
                this.sendResponseToWebview({
                  command: "showError",
                  message: "Invalid item ID",
                });
                return;
              }

              try {
                logInfo(`Duplicating item with ID: ${message.itemId}`);
                await duplicateItem(this.binaryPath, message.itemId);
                await this.refreshData();

                this.sendResponseToWebview({
                  command: "showSuccess",
                  message: "Item duplicated successfully",
                });
              } catch (error: any) {
                this.handleError("Failed to duplicate item", error);
              }
              break;

            case "viewItemDetails":
              if (!message.itemId) {
                this.sendResponseToWebview({
                  command: "showError",
                  message: "Invalid item ID",
                });
                return;
              }

              try {
                logInfo(`Viewing details for item ID: ${message.itemId}`);
                const details = await getItemDetails(
                  this.binaryPath,
                  message.itemId,
                );

                if (details) {
                  this.sendResponseToWebview({
                    command: "showItemDetails",
                    details: details,
                  });
                } else {
                  throw new Error(`Item with ID ${message.itemId} not found`);
                }
              } catch (error: any) {
                this.handleError("Failed to get item details", error);
              }
              break;

            case "copyToClipboard":
              if (!message.text) {
                this.sendResponseToWebview({
                  command: "showError",
                  message: "No text to copy",
                });
                return;
              }

              try {
                logInfo("Copying to clipboard");
                await vscode.env.clipboard.writeText(message.text);

                this.sendResponseToWebview({
                  command: "showSuccess",
                  message: "Copied to clipboard successfully",
                });
              } catch (error: any) {
                this.handleError("Failed to copy to clipboard", error);
              }
              break;

            case "markAsFavorite":
              // Feature placeholder
              logInfo("Mark as favorite requested (feature not implemented)");
              vscode.window.showInformationMessage(
                "Favorite feature coming soon!",
              );
              this.sendResponseToWebview({
                command: "showSuccess",
                message: "Feature coming soon: Mark as favorite",
              });
              break;

            case "addTag":
              if (!message.itemId || !message.tag) {
                this.sendResponseToWebview({
                  command: "showError",
                  message: "Invalid item ID or tag",
                });
                return;
              }

              // Feature placeholder
              logInfo(
                `Add tag requested (feature not implemented): ${message.tag}`,
              );
              vscode.window.showInformationMessage(
                `Tag feature coming soon! Would add tag: ${message.tag}`,
              );
              this.sendResponseToWebview({
                command: "showSuccess",
                message: "Feature coming soon: Tags system",
              });
              break;

            case "showLogs":
              logInfo("Show logs requested");
              outputChannel.show();
              break;

            case "debugInfo":
              this.sendDebugInfo();
              break;

            default:
              logWarning(`Unknown command: ${message.command}`);
          }
        } catch (error: any) {
          logError(`Database operation failed: ${error.message || error}`);
          this.handleError("Database operation failed", error);
        }
      },
      undefined,
      this.disposables,
    );
  }

  /**
   * Handles errors and sends them to the webview
   * @param contextMessage Context message for the error
   * @param error The error object
   */
  private handleError(contextMessage: string, error: Error): void {
    const errorMessage = error.message || "An unknown error occurred";
    logError(`${contextMessage}: ${errorMessage}`);

    showError(`${contextMessage}: ${errorMessage}`);

    this.sendResponseToWebview({
      command: "showError",
      message: errorMessage,
    });

    // Add a button to view more detailed logs
    this.sendResponseToWebview({
      command: "showDebugButton",
    });
  }

  /**
   * Refreshes the data in the panel
   */
  private async refreshData(): Promise<void> {
    if (!this.panel) {
      logInfo("No panel to refresh");
      return;
    }

    // Don't start another refresh if one is already in progress
    if (this.isInitializing) {
      logInfo("Refresh already in progress, skipping");
      return;
    }

    this.isInitializing = true;
    logInfo("Refreshing database data...");

    // Show loading indicator in the webview
    this.sendResponseToWebview({
      command: "showLoading",
      message: "Loading database items...",
    });

    try {
      // Check if binary exists
      if (!fs.existsSync(this.binaryPath)) {
        const errorMsg = `Binary not found at path: ${this.binaryPath}`;
        logError(errorMsg);

        this.sendResponseToWebview({
          command: "updateItems",
          items: "",
          success: false,
          error: `Binary not found at path: ${this.binaryPath}. Please check the extension installation.`,
        });

        this.isInitializing = false;
        return;
      }

      // Check if binary is executable
      try {
        fs.accessSync(this.binaryPath, fs.constants.X_OK);
        logInfo(`Binary is executable: ${this.binaryPath}`);
      } catch (error) {
        logWarning(
          `Binary is not executable, attempting to make it executable: ${this.binaryPath}`,
        );
        try {
          // Make binary executable (chmod +x)
          fs.chmodSync(this.binaryPath, "755");
          logInfo(`Made binary executable: ${this.binaryPath}`);
        } catch (chmodError) {
          logError(`Failed to make binary executable: ${chmodError}`);

          this.sendResponseToWebview({
            command: "updateItems",
            items: "",
            success: false,
            error: `Binary exists but lacks execute permissions. Please run: chmod +x "${this.binaryPath}"`,
          });

          this.isInitializing = false;
          return;
        }
      }

      logInfo(`Using binary at: ${this.binaryPath}`);

      // First try to list items
      try {
        logInfo("Attempting to list items...");
        const items = await listItems(this.binaryPath);
        const output = this.formatItemsAsTable(items);

        logInfo(`Found ${items.length} items in database`);
        this.sendResponseToWebview({
          command: "updateItems",
          items: output,
          success: true,
        });

        // Reset retry counter on success
        this.initRetries = 0;

        this.isInitializing = false;
        return;
      } catch (listError: any) {
        logWarning(`List operation failed: ${listError.message || listError}`);

        // Check if this is a "not initialized" error
        if (
          listError.message &&
          (listError.message.includes("no such table") ||
            listError.message.includes("not initialized") ||
            listError.message.includes("not found"))
        ) {
          logInfo("Database not initialized, attempting to initialize...");

          try {
            // Show initializing message to user
            this.sendResponseToWebview({
              command: "showInfo",
              message: "Database not initialized. Initializing database...",
            });

            await initializeDatabase(this.binaryPath);
            logInfo("Database initialized successfully");

            await new Promise((resolve) => setTimeout(resolve, 1000)); // Small delay

            // Try again after initialization
            logInfo("Listing items after initialization...");
            const items = await listItems(this.binaryPath);
            const output = this.formatItemsAsTable(items);

            this.sendResponseToWebview({
              command: "updateItems",
              items: output,
              success: true,
            });

            this.sendResponseToWebview({
              command: "showSuccess",
              message: "Database initialized successfully",
            });

            // Reset retry counter on success
            this.initRetries = 0;

            this.isInitializing = false;
            return;
          } catch (initError: any) {
            logError(
              `Auto-initialization failed: ${initError.message || initError}`,
            );

            // Increment retry counter
            this.initRetries++;

            if (this.initRetries < this.MAX_RETRIES) {
              logInfo(
                `Retrying initialization (attempt ${this.initRetries + 1}/${this.MAX_RETRIES})...`,
              );
              this.isInitializing = false;

              // Wait a bit longer between retries
              setTimeout(() => {
                this.refreshData().catch((retryError) => {
                  logError(
                    `Retry ${this.initRetries} failed: ${retryError.message || retryError}`,
                  );
                });
              }, 2000);
              return;
            }

            this.sendResponseToWebview({
              command: "updateItems",
              items: "",
              success: false,
              error: `Database initialization failed after ${this.MAX_RETRIES} attempts: ${initError.message || "Unknown error"}`,
            });
          }
        } else {
          // Other errors
          logError(`Error loading database: ${listError.message || listError}`);
          this.sendResponseToWebview({
            command: "updateItems",
            items: "",
            success: false,
            error: listError.message || "Failed to load database items",
          });
        }
      }
    } catch (error: any) {
      logError(`Failed to refresh database panel: ${error.message || error}`);

      this.sendResponseToWebview({
        command: "updateItems",
        items: "",
        success: false,
        error:
          error.message ||
          "An unexpected error occurred while accessing the database",
      });
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Sends debug information to the webview
   */
  private sendDebugInfo(): void {
    const debugInfo = {
      binary: this.binaryPath,
      exists: fs.existsSync(this.binaryPath),
      isExecutable: false,
      platform: process.platform,
      timestamp: new Date().toISOString(),
    };

    try {
      fs.accessSync(this.binaryPath, fs.constants.X_OK);
      debugInfo.isExecutable = true;
    } catch (error) {
      // Not executable
    }

    logInfo("Sending debug info to webview");
    this.sendResponseToWebview({
      command: "showDebugInfo",
    });

    // Also show the log channel
    outputChannel.show();
  }

  /**
   * Formats items as a table for the webview
   * @param items Array of database items
   * @returns Table formatted string
   */
  private formatItemsAsTable(
    items: { id: string; name: string; created_at: string }[],
  ): string {
    if (items.length === 0) {
      return 'No items found in database. Click "Add Item" to create a new item.';
    }

    // Format as JSON to avoid newline parsing issues
    return JSON.stringify(items);
  }

  /**
   * Sends a response to the webview
   * @param response The response message
   */
  private sendResponseToWebview(response: DbResponseMessage): void {
    if (this.panel) {
      logInfo(`Sending response to webview: ${response.command}`);
      this.panel.webview.postMessage(response);
    } else {
      logWarning(
        `Cannot send response to webview: panel is undefined. Command: ${response.command}`,
      );
    }
  }

  /**
   * Disposes this panel manager
   */
  public dispose(): void {
    logInfo("Disposing database panel manager");
    DatabasePanelManager.instance = undefined;

    this.panel?.dispose();

    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
