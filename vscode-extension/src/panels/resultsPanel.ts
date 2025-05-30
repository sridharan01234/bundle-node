import * as vscode from "vscode";
import { getResultsHtml } from "./webviewUtils";

/**
 * Manages the results panel webview
 */
export class ResultsPanelManager {
  private static instance: ResultsPanelManager | undefined;
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];

  /**
   * Creates a new ResultsPanelManager
   * @param extensionUri URI of the extension
   */
  private constructor(extensionUri: vscode.Uri) {
    this.createPanel(extensionUri);
  }

  /**
   * Gets the singleton instance of ResultsPanelManager
   * @param extensionUri URI of the extension
   * @returns The ResultsPanelManager instance
   */
  public static getInstance(extensionUri: vscode.Uri): ResultsPanelManager {
    if (!ResultsPanelManager.instance) {
      ResultsPanelManager.instance = new ResultsPanelManager(extensionUri);
    } else {
      // If panel is already created, just reveal it
      ResultsPanelManager.instance.panel?.reveal();
    }
    return ResultsPanelManager.instance;
  }

  /**
   * Creates the webview panel
   * @param extensionUri URI of the extension
   */
  private createPanel(extensionUri: vscode.Uri): void {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    this.panel = vscode.window.createWebviewPanel(
      "resultsPanel",
      "Analysis Results",
      columnToShowIn || vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true,
      },
    );

    // Initial HTML with loading indicator
    this.panel.webview.html = this.getLoadingHtml();

    this.panel.onDidDispose(
      () => {
        this.dispose();
      },
      null,
      this.disposables,
    );
  }

  /**
   * Updates the panel with analysis results
   * @param results The analysis results to display
   * @param title An optional title for the panel
   */
  public updateResults(results: any, title?: string): void {
    if (!this.panel) {
      return;
    }

    if (title) {
      this.panel.title = title;
    }

    this.panel.webview.html = getResultsHtml(this.panel.webview, results);
  }

  /**
   * Shows a loading indicator in the panel
   */
  public showLoading(): void {
    console.log("Showing loading indicator in results panel");
    if (this.panel) {
      this.panel.webview.html = this.getLoadingHtml();
    }
  }

  /**
   * Gets HTML for the loading indicator
   * @returns HTML string for the loading indicator
   */
  private getLoadingHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Loading Results...</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-editor-foreground);
          background-color: var(--vscode-editor-background);
          padding: 20px;
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
        }
        .spinner {
          border: 4px solid var(--vscode-panel-border);
          border-top: 4px solid var(--vscode-button-background);
          border-radius: 50%;
          width: 40px;
          height: 40px;
          margin-bottom: 20px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .message {
          margin-top: 20px;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <div class="spinner"></div>
      <div class="message">Analyzing code and generating results...</div>
    </body>
    </html>`;
  }

  /**
   * Shows an error message in the panel
   * @param errorMessage The error message to display
   */
  public showError(errorMessage: string): void {
    if (this.panel) {
      this.panel.webview.html = `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
          }
          .error-icon {
            color: #F44336;
            font-size: 48px;
            margin-bottom: 20px;
          }
          .error-message {
            color: #F44336;
            margin-bottom: 20px;
            text-align: center;
            max-width: 600px;
          }
          pre {
            background-color: var(--vscode-editor-lineHighlightBackground);
            padding: 15px;
            border-radius: 4px;
            overflow: auto;
            max-width: 80%;
          }
        </style>
      </head>
      <body>
        <div class="error-icon">⚠️</div>
        <h2>Analysis Error</h2>
        <div class="error-message">${errorMessage}</div>
        <pre>Please check the console for more details or try again.</pre>
      </body>
      </html>`;
    }
  }

  /**
   * Disposes this panel manager
   */
  public dispose(): void {
    ResultsPanelManager.instance = undefined;

    this.panel?.dispose();

    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
