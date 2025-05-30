import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import { DatabasePanelManager } from "./panels/databasePanel";
import { showError, showInfo } from "./utils/common";

// Create output channel for logging that's visible to the user
export const outputChannel = vscode.window.createOutputChannel(
  "SQLite Database Manager"
);

/**
 * Activates the extension
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
  // Log extension activation
  logInfo('Extension "sqlite-database-manager" is now active');

  // Determine binary name based on platform
  const binaryName = getBinaryNameForPlatform();
  if (!binaryName) {
    return; // Exit if platform not supported
  }

  // Set path to the binary in the workspace
  const workspacePath = "/home/asplap1937/Documents/bundle-node";
  const binaryPath = path.join(workspacePath, "bin", binaryName);
  logInfo(`Binary path: ${binaryPath}`);

  // Register commands
  const disposables = [
    // Database Manager Command
    vscode.commands.registerCommand("extension.openDatabaseManager", () => {
      try {
        logInfo("Opening Database Manager panel...");
        DatabasePanelManager.getInstance(context.extensionUri, binaryPath);
      } catch (error: any) {
        logError(`Failed to open Database Manager: ${error.message}`);
        showError(`Failed to open Database Manager: ${error.message}`);
      }
    }),

    // Command to show logs
    vscode.commands.registerCommand("extension.showDatabaseLogs", () => {
      outputChannel.show();
    }),
  ];

  // Add all disposables to the context
  context.subscriptions.push(...disposables);

  // Show welcome message on first activation
  showWelcomeMessage(context);
}

/**
 * Determines the binary name based on the current platform
 * @returns The binary name for the current platform or undefined if not supported
 */
function getBinaryNameForPlatform(): string | undefined {
  const platform = os.platform();

  switch (platform) {
    case "win32":
      return "cross-platform-tool-win.exe";
    case "darwin":
      return "cross-platform-tool-macos";
    case "linux":
      return "cross-platform-tool-linux";
    default:
      vscode.window.showErrorMessage(`Unsupported platform: ${platform}`);
      return undefined;
  }
}

/**
 * Shows a welcome message on first activation
 * @param context The extension context
 */
function showWelcomeMessage(context: vscode.ExtensionContext): void {
  const hasShownWelcome = context.globalState.get("hasShownWelcome");
  if (!hasShownWelcome) {
    showInfo(
      "Welcome to SQLite Database Manager! Get started by opening the Database Manager panel.",
      "Open Database Manager"
    ).then((selection) => {
      if (selection === "Open Database Manager") {
        vscode.commands.executeCommand("extension.openDatabaseManager");
      }
    });

    context.globalState.update("hasShownWelcome", true);
  }
}

/**
 * Logs an informational message to console and output channel
 * @param message The message to log
 */
export function logInfo(message: string): void {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [INFO] ${message}`;
  console.log(formattedMessage);
  outputChannel.appendLine(formattedMessage);
}

/**
 * Logs an error message to console and output channel
 * @param message The error message to log
 */
export function logError(message: string): void {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [ERROR] ${message}`;
  console.error(formattedMessage);
  outputChannel.appendLine(formattedMessage);
}

/**
 * Logs a warning message to console and output channel
 * @param message The warning message to log
 */
export function logWarning(message: string): void {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [WARNING] ${message}`;
  console.warn(formattedMessage);
  outputChannel.appendLine(formattedMessage);
}

/**
 * Deactivates the extension
 */
export function deactivate() {
  logInfo('Extension "sqlite-database-manager" is now deactivated');
}
