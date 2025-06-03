import {
  AnalyzeCodeFunction,
  FormatCodeFunction,
  CommandHandler,
} from "../types/index.js";
import { AnalyzeCommand } from "./AnalyzeCommand.js";
import { FormatCommand } from "./FormatCommand.js";
import { HomeCommand } from "./HomeCommand.js";
import { ServerCommand } from "./ServerCommand.js";

/**
 * Command Registry
 * Manages command registration and execution
 */
export class CommandRegistry {
  private commands = new Map<string, CommandHandler>();

  constructor(
    analyzeCode: AnalyzeCodeFunction,
    formatCode: FormatCodeFunction,
  ) {
    this.registerCommands(analyzeCode, formatCode);
  }

  /**
   * Register all available commands
   */
  private registerCommands(
    analyzeCode: AnalyzeCodeFunction,
    formatCode: FormatCodeFunction,
  ): void {
    const analyzeCommand = new AnalyzeCommand(analyzeCode);
    const formatCommand = new FormatCommand(formatCode);
    const homeCommand = new HomeCommand();
    const serverCommand = new ServerCommand(analyzeCode, formatCode);

    this.commands.set("analyze", analyzeCommand.handle);
    this.commands.set("format", formatCommand.handle);
    this.commands.set("home", homeCommand.handle);
    this.commands.set("server", serverCommand.handle);
  }

  /**
   * Execute a command by name
   */
  public execute(commandName: string, args: string[]): boolean {
    const command = this.commands.get(commandName);
    if (command) {
      command(args);
      return true;
    }
    return false;
  }

  /**
   * Get list of available commands
   */
  public getAvailableCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Check if a command exists
   */
  public hasCommand(commandName: string): boolean {
    return this.commands.has(commandName);
  }
}
