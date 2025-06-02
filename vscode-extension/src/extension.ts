import * as vscode from "vscode";
import { ConfigManager } from "./config/ConfigManager";
import { WebviewManager } from "./webview/WebviewManager";
import { Logger } from "./utils/Logger";
import { UIUtils } from "./utils/UIUtils";

/**
 * Main extension activation function
 */
export function activate(context: vscode.ExtensionContext) {
  try {
    // Initialize core services with extension context
    Logger.initialize();
    Logger.info("SQLite Database Manager extension activated");

    const config = ConfigManager.getInstance(context);
    const binaryPath = config.getBinaryPath();

    Logger.info(`Binary path: ${binaryPath}`);
    Logger.info(`Platform: ${process.platform}`);
    Logger.info(`Architecture: ${process.arch}`);

    // Validate binary exists and is accessible
    if (!config.validateBinary()) {
      const errorMsg = `Binary not found or not accessible at: ${binaryPath}`;
      Logger.error(errorMsg);
      UIUtils.showError(errorMsg);
      return;
    }

    Logger.info("Binary validation successful");

    // Register commands
    const commands = [
      vscode.commands.registerCommand(
        "extension.openDatabaseManager",
        async () => {
          try {
            // Additional validation before opening webview
            if (!config.validateBinary()) {
              throw new Error(`Binary not accessible at: ${binaryPath}`);
            }

            WebviewManager.createOrShow(context.extensionUri, binaryPath);
          } catch (error: any) {
            Logger.error(`Failed to open Database Manager: ${error.message}`);
            UIUtils.showError(
              `Failed to open Database Manager: ${error.message}`,
            );
          }
        },
      ),

      vscode.commands.registerCommand("extension.showDatabaseLogs", () => {
        Logger.show();
      }),
    ];

    // Add disposables to context
    context.subscriptions.push(...commands);

    // Show welcome message on first activation
    showWelcomeMessage(context);

    Logger.info("Extension activation completed successfully");
  } catch (error: any) {
    Logger.error(`Extension activation failed: ${error.message}`);
    UIUtils.showError(`Extension activation failed: ${error.message}`);
  }
}

/**
 * Shows welcome message on first activation
 */
function showWelcomeMessage(context: vscode.ExtensionContext): void {
  const hasShownWelcome = context.globalState.get("hasShownWelcome");
  if (!hasShownWelcome) {
    UIUtils.showInfo(
      "Welcome to SQLite Database Manager! Get started by opening the Database Manager panel.",
      "Open Database Manager",
    ).then((selection) => {
      if (selection === "Open Database Manager") {
        vscode.commands.executeCommand("extension.openDatabaseManager");
      }
    });

    context.globalState.update("hasShownWelcome", true);
  }
}

/**
 * Extension deactivation function
 */
export function deactivate() {
  Logger.info("SQLite Database Manager extension deactivated");
}
