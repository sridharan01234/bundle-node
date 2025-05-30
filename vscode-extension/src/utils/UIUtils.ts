import * as vscode from "vscode";

/**
 * UI utility functions for notifications and dialogs
 */
export class UIUtils {
  public static showError(message: string): void {
    vscode.window.showErrorMessage(message);
  }

  public static showInfo(
    message: string,
    ...actions: string[]
  ): Thenable<string | undefined> {
    return vscode.window.showInformationMessage(message, ...actions);
  }

  public static showWarning(message: string): void {
    vscode.window.showWarningMessage(message);
  }

  public static async showSaveDialog(
    defaultName: string,
  ): Promise<vscode.Uri | undefined> {
    return vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: {
        "JSON Files": ["json"],
        "All Files": ["*"],
      },
    });
  }

  public static async writeFile(
    uri: vscode.Uri,
    content: string,
  ): Promise<void> {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
  }
}
