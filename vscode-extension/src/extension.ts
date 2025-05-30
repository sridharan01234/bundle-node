import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import { DatabasePanelManager } from "./panels/databasePanel";
import { ResultsPanelManager } from "./panels/resultsPanel";
import {
  callServerForAnalysis,
  startServer,
  stopServer,
} from "./utils/serverManager";
import { showError, showInfo } from "./utils/common";

// Create output channel for logging that's visible to the user
export const outputChannel = vscode.window.createOutputChannel(
  "SQLite Database Manager",
);

export function activate(context: vscode.ExtensionContext) {
  // Log to both console and output channel
  logInfo('Extension "sqlite-database-manager" is now active');

  // Check operating system for binary name
  const platform = os.platform();
  let binaryName = "";

  switch (platform) {
    case "win32":
      binaryName = "cross-platform-tool-win.exe";
      break;
    case "darwin":
      binaryName = "cross-platform-tool-macos";
      break;
    case "linux":
      binaryName = "cross-platform-tool-linux";
      break;
    default:
      vscode.window.showErrorMessage(`Unsupported platform: ${platform}`);
      return;
  }

  // Fix: Use the correct path to the binary in the workspace
  const workspacePath = "/home/asplap1937/Documents/bundle-node";
  const binaryPath = path.join(workspacePath, "bin", binaryName);

  logInfo(`Binary path: ${binaryPath}`);

  // Register commands
  const disposables = [
    // Database Manager Command
    vscode.commands.registerCommand("extension.openDatabaseManager", () => {
      try {
        logInfo("Opening Database Manager panel...");
        // Create or show the database panel
        DatabasePanelManager.getInstance(context.extensionUri, binaryPath);
      } catch (error: any) {
        logError(`Failed to open Database Manager: ${error.message}`);
        showError(`Failed to open Database Manager: ${error.message}`);
      }
    }),

    // Analyze Current File Command
    vscode.commands.registerCommand(
      "extension.analyzeCurrentFile",
      async () => {
        const activeEditor = vscode.window.activeTextEditor;

        if (!activeEditor) {
          vscode.window.showWarningMessage(
            "No active editor found. Please open a file first.",
          );
          return;
        }

        try {
          // Create or show the results panel
          const resultsPanel = ResultsPanelManager.getInstance(
            context.extensionUri,
          );
          resultsPanel.showLoading();

          // Start the analysis server if not already running
          await startServer(binaryPath);

          // Get the path to the current file
          const filePath = activeEditor.document.uri.fsPath;
          const results = await callServerForAnalysis(filePath);

          // Update the panel with the results
          resultsPanel.updateResults(
            results,
            `Analysis: ${path.basename(filePath)}`,
          );
        } catch (error: any) {
          logError(`Analysis failed: ${error.message}`);
          showError(`Analysis failed: ${error.message}`);

          // Show error in the results panel if it exists
          const resultsPanel = ResultsPanelManager.getInstance(
            context.extensionUri,
          );
          resultsPanel.showError(error.message);
        }
      },
    ),

    // Command to show logs
    vscode.commands.registerCommand("extension.showDatabaseLogs", () => {
      outputChannel.show();
    }),
  ];

  // Handle extension deactivation
  context.subscriptions.push(...disposables, { dispose: () => stopServer() });

  // Optional: Show a welcome message on first activation
  const hasShownWelcome = context.globalState.get("hasShownWelcome");
  if (!hasShownWelcome) {
    showInfo(
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

export function deactivate() {
  // Clean up resources when the extension is deactivated
  logInfo('Extension "sqlite-database-manager" is now deactivated');
  stopServer();
}
