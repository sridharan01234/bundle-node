#!/usr/bin/env node

import { loadCodeProcessors, parseArgs, showUsage } from "./utils/index.js";
import {
  AnalyzeCommand,
  FormatCommand,
  HomeCommand,
  ServerCommand,
} from "./commands/index.js";

/**
 * Main CLI Application
 */
class CLI {
  private analyzeCommand: AnalyzeCommand;
  private formatCommand: FormatCommand;
  private homeCommand: HomeCommand;
  private serverCommand: ServerCommand;

  constructor() {
    // Load code processors
    const { analyzeCode, formatCode } = loadCodeProcessors();

    // Initialize command handlers
    this.analyzeCommand = new AnalyzeCommand(analyzeCode);
    this.formatCommand = new FormatCommand(formatCode);
    this.homeCommand = new HomeCommand();
    this.serverCommand = new ServerCommand(analyzeCode, formatCode);
  }

  /**
   * Run the CLI application
   */
  run(): void {
    const { command, args } = parseArgs();

    switch (command) {
      case "analyze":
        this.analyzeCommand.handle(args);
        break;

      case "format":
        this.formatCommand.handle(args);
        break;

      case "home":
        this.homeCommand.handle(args);
        break;

      case "server":
        this.serverCommand.handle(args);
        break;

      case "help":
        showUsage();
        process.exit(0);
        break;

      default:
        console.error(`Error: Unknown command '${command}'`);
        showUsage();
        process.exit(1);
    }
  }
}

// Run the CLI application
const cli = new CLI();
cli.run();
