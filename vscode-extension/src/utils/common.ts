import * as vscode from "vscode";

/**
 * Generate a nonce for the Content Security Policy
 * @returns A random string nonce
 */
export function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Show an information message with optional items
 * @param message The message to display
 * @param items The items to show in the message
 */
export async function showInfo(
  message: string,
  ...items: string[]
): Promise<string | undefined> {
  return vscode.window.showInformationMessage(message, ...items);
}

/**
 * Show an error message with optional items
 * @param message The message to display
 * @param items The items to show in the message
 */
export async function showError(
  message: string,
  ...items: string[]
): Promise<string | undefined> {
  return vscode.window.showErrorMessage(message, ...items);
}

/**
 * Show a warning message with optional items
 * @param message The message to display
 * @param items The items to show in the message
 */
export async function showWarning(
  message: string,
  ...items: string[]
): Promise<string | undefined> {
  return vscode.window.showWarningMessage(message, ...items);
}
