import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { execSync, spawn, ChildProcess } from "child_process";
import * as os from "os";
import fetch from "node-fetch";

// Keep track of current panel
let currentPanel: vscode.WebviewPanel | undefined = undefined;

// Track the server process
let serverProcess: ChildProcess | undefined = undefined;
let serverPort: number = 0;

// This method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {
  console.log("Cross-platform extension is now active");

  // Get the appropriate binary based on platform
  const platform = os.platform();
  let binaryName = "cross-platform-tool";

  if (platform === "win32") {
    binaryName = "cross-platform-tool-win.exe";
  } else if (platform === "darwin") {
    binaryName = "cross-platform-tool-macos";
  } else if (platform === "linux") {
    binaryName = "cross-platform-tool-linux";
  }

  // Path to the binary relative to extension
  const binaryPath = path.join(context.extensionPath, "..", "bin", binaryName);

  // Start server if configured to use server mode
  const config = vscode.workspace.getConfiguration("cross-platform-extension");
  if (config.get("useServerMode", false)) {
    await startServer(binaryPath);
  }

  // Register analyze file command
  let analyzeCommand = vscode.commands.registerCommand(
    "cross-platform-extension.analyzeFile",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found");
        return;
      }

      const document = editor.document;

      try {
        let results;
        if (serverProcess && serverPort > 0) {
          // Use server mode if available
          results = await callServerForAnalysis(document.fileName);
        } else {
          // Fall back to CLI mode
          const output = execSync(
            `"${binaryPath}" analyze "${document.fileName}" 2>/dev/null`,
          ).toString();
          results = JSON.parse(output);
        }

        // For now, show results in a simple message to test if analysis works
        const functionCount = results.functions?.length || 0;
        const classCount = results.classes?.length || 0;
        const dependencyCount = results.dependencies?.length || 0;
        const variableCount = results.variables?.length || 0;
      } catch (error) {
        vscode.window.showErrorMessage(`Analysis failed: ${error}`);
      }
    },
  );

  // Register command to toggle server mode
  let toggleServerCommand = vscode.commands.registerCommand(
    "cross-platform-extension.toggleServerMode",
    async () => {
      const config = vscode.workspace.getConfiguration(
        "cross-platform-extension",
      );
      const currentMode = config.get("useServerMode", false);

      // Toggle the mode
      await config.update(
        "useServerMode",
        !currentMode,
        vscode.ConfigurationTarget.Global,
      );

      if (!currentMode) {
        // Starting server mode
        if (!serverProcess) {
          await startServer(binaryPath);
          vscode.window.showInformationMessage(
            "Server mode enabled for faster analysis",
          );
        }
      } else {
        // Stopping server mode
        stopServer();
        vscode.window.showInformationMessage("Server mode disabled");
      }
    },
  );

  context.subscriptions.push(analyzeCommand, toggleServerCommand);
}

/**
 * Starts the CLI tool in server mode
 */
async function startServer(binaryPath: string): Promise<void> {
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
function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = undefined;
    serverPort = 0;
    console.log("Analysis server stopped");
  }
}

/**
 * Calls the server for file analysis
 */
async function callServerForAnalysis(filePath: string): Promise<any> {
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
 * Creates or shows the webview panel for displaying analysis results
 */
function createResultsPanel(
  extensionUri: vscode.Uri,
  results: any,
): vscode.WebviewPanel {
  const columnToShowIn = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined;

  // If we already have a panel, show it in the target column
  if (currentPanel) {
    currentPanel.reveal(columnToShowIn);
    updateResultsPanel(currentPanel, results);
    return currentPanel;
  }

  // Otherwise, create a new panel
  currentPanel = vscode.window.createWebviewPanel(
    "analysisResults",
    "Analysis Results",
    columnToShowIn || vscode.ViewColumn.One,
    {
      enableScripts: false,
      localResourceRoots: [],
    },
  );

  updateResultsPanel(currentPanel, results);

  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined;
    },
    null,
    [],
  );

  return currentPanel;
}

/**
 * Updates the content of the results panel with new analysis data
 */
function updateResultsPanel(panel: vscode.WebviewPanel, results: any) {
  panel.webview.html = getResultsHtml(panel.webview, results);
}

/**
 * Generate the HTML for the results panel
 */
function getResultsHtml(webview: vscode.Webview, results: any): string {
  // Handle the actual structure from our analysis tool
  const functionCount = results.functions?.length || 0;
  const classCount = results.classes?.length || 0;
  const dependencyCount = results.dependencies?.length || 0;
  const variableCount = results.variables?.length || 0;

  // For backward compatibility, check if old structure exists
  const errorCount = results.errors?.length || 0;
  const suggestionCount = results.suggestions?.length || 0;
  const hasOldStructure =
    results.errors !== undefined || results.suggestions !== undefined;

  const totalIssues = errorCount + suggestionCount;

  // CSS class for panel
  let statusClass = "status-ok";
  if (errorCount > 0) {
    statusClass = "status-error";
  } else if (suggestionCount > 0) {
    statusClass = "status-warning";
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src vscode-resource: https: data:; font-src vscode-resource: https:;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Analysis Results</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
        }
        .status-indicator {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            margin-right: 10px;
        }
        .status-ok {
            background-color: #4CAF50;
        }
        .status-warning {
            background-color: #FFC107;
        }
        .status-error {
            background-color: #F44336;
        }
        .summary {
            margin-bottom: 20px;
            padding: 15px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border-radius: 4px;
        }
        .issues-container, .analysis-container {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin-top: 10px;
            overflow: hidden;
        }
        .issues-section, .analysis-section {
            margin-bottom: 20px;
        }
        .issues-header, .analysis-header {
            padding: 8px 12px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            font-weight: bold;
        }
        .issue-item, .analysis-item {
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .issue-item:last-child, .analysis-item:last-child {
            border-bottom: none;
        }
        .error {
            color: #F44336;
        }
        .suggestion {
            color: #FFC107;
        }
        .function {
            color: #4CAF50;
        }
        .class {
            color: #2196F3;
        }
        .dependency {
            color: #FF9800;
        }
        .file-info {
            margin-bottom: 20px;
        }
        .metric {
            display: inline-block;
            margin-right: 20px;
            padding: 5px 10px;
            background-color: var(--vscode-button-background);
            border-radius: 3px;
            color: var(--vscode-button-foreground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="status-indicator ${statusClass}"></div>
        <h2>Analysis Results</h2>
    </div>
    
    <div class="file-info">
        <div><strong>File:</strong> ${results.fileName || "Unknown"}</div>
        <div><strong>Lines:</strong> ${results.lines || results.lineCount || 0}</div>
        <div><strong>Complexity:</strong> ${results.complexity || "N/A"}</div>
    </div>
    
    <div class="summary">
        <div class="metric">Functions: ${functionCount}</div>
        <div class="metric">Classes: ${classCount}</div>
        <div class="metric">Dependencies: ${dependencyCount}</div>
        <div class="metric">Variables: ${variableCount}</div>
    </div>

    ${
      hasOldStructure && totalIssues > 0
        ? `
    <div class="summary">
        <strong>Issues:</strong> Found ${totalIssues} issues (${errorCount} errors, ${suggestionCount} suggestions)
    </div>
    
    ${
      errorCount > 0
        ? `
    <div class="issues-section">
        <div class="issues-header">Errors</div>
        <div class="issues-container">
            ${results.errors
              .map(
                (error: string) => `
                <div class="issue-item error">${error}</div>
            `,
              )
              .join("")}
        </div>
    </div>
    `
        : ""
    }
    
    ${
      suggestionCount > 0
        ? `
    <div class="issues-section">
        <div class="issues-header">Suggestions</div>
        <div class="issues-container">
            ${results.suggestions
              .map(
                (suggestion: string) => `
                <div class="issue-item suggestion">${suggestion}</div>
            `,
              )
              .join("")}
        </div>
    </div>
    `
        : ""
    }
    `
        : ""
    }

    ${
      functionCount > 0
        ? `
    <div class="analysis-section">
        <div class="analysis-header">Functions</div>
        <div class="analysis-container">
            ${results.functions
              .map(
                (func: any) => `
                <div class="analysis-item function">
                    <strong>${func.name}</strong> (Line ${func.line}) - ${func.type}
                </div>
            `,
              )
              .join("")}
        </div>
    </div>
    `
        : ""
    }

    ${
      classCount > 0
        ? `
    <div class="analysis-section">
        <div class="analysis-header">Classes</div>
        <div class="analysis-container">
            ${results.classes
              .map(
                (cls: any) => `
                <div class="analysis-item class">
                    <strong>${cls.name}</strong> (Line ${cls.line})
                </div>
            `,
              )
              .join("")}
        </div>
    </div>
    `
        : ""
    }

    ${
      dependencyCount > 0
        ? `
    <div class="analysis-section">
        <div class="analysis-header">Dependencies</div>
        <div class="analysis-container">
            ${results.dependencies
              .map(
                (dep: any) => `
                <div class="analysis-item dependency">
                    Line ${dep.line}: <code>${dep.statement}</code>
                </div>
            `,
              )
              .join("")}
        </div>
    </div>
    `
        : ""
    }

    ${
      variableCount > 0
        ? `
    <div class="analysis-section">
        <div class="analysis-header">Variables</div>
        <div class="analysis-container">
            ${results.variables
              .map(
                (variable: any) => `
                <div class="analysis-item">
                    <strong>${variable.name}</strong> (${variable.type}) - Line ${variable.line}
                </div>
            `,
              )
              .join("")}
        </div>
    </div>
    `
        : ""
    }
    
    ${
      !hasOldStructure &&
      functionCount === 0 &&
      classCount === 0 &&
      dependencyCount === 0 &&
      variableCount === 0
        ? `
    <div style="text-align: center; margin-top: 50px; color: #4CAF50;">
        <h3>✓ Analysis Complete</h3>
        <p>No notable code structures found in this file.</p>
    </div>
    `
        : ""
    }

    ${
      hasOldStructure && totalIssues === 0
        ? `
    <div style="text-align: center; margin-top: 50px; color: #4CAF50;">
        <h3>✓ No issues found</h3>
        <p>Your code looks good!</p>
    </div>
    `
        : ""
    }

</body>
</html>`;
}

/**
 * Generate a nonce for the CSP
 */
function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// This method is called when your extension is deactivated
export function deactivate() {
  stopServer();
}
