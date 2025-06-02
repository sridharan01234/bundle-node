import * as vscode from "vscode";

/**
 * Centralized logging utility
 */
export class Logger {
  private static outputChannel: vscode.OutputChannel;

  public static initialize(): void {
    this.outputChannel = vscode.window.createOutputChannel(
      "SQLite Database Manager",
    );
  }

  public static info(message: string): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [INFO] ${message}`;
    console.log(formattedMessage);
    this.outputChannel?.appendLine(formattedMessage);
  }

  public static error(message: string): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [ERROR] ${message}`;
    console.error(formattedMessage);
    this.outputChannel?.appendLine(formattedMessage);
  }

  public static warning(message: string): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [WARNING] ${message}`;
    console.warn(formattedMessage);
    this.outputChannel?.appendLine(formattedMessage);
  }

  public static debug(message: string): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [DEBUG] ${message}`;
    console.debug(formattedMessage);
    this.outputChannel?.appendLine(formattedMessage);
  }

  public static show(): void {
    this.outputChannel?.show();
  }
}
