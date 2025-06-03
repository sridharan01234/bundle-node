import { loadCodeProcessors, parseArgs, showUsage } from "../utils/index.js";
import { CommandRegistry } from "../commands/CommandRegistry.js";

/**
 * CLI Application
 * Main application class that handles command-line interface operations
 */
export class CLIApplication {
  private commandRegistry: CommandRegistry;

  constructor() {
    // Load code processors
    const { analyzeCode, formatCode } = loadCodeProcessors();

    // Initialize command registry with loaded processors
    this.commandRegistry = new CommandRegistry(analyzeCode, formatCode);
  }

  /**
   * Run the CLI application
   */
  public run(): void {
    try {
      const { command, args } = parseArgs();

      // Handle help command
      if (command === "help") {
        this.showHelp();
        process.exit(0);
      }

      // Execute command via registry
      if (!this.commandRegistry.execute(command, args)) {
        this.handleUnknownCommand(command);
      }
    } catch (error: any) {
      console.error(`CLI Error: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    showUsage();
    console.log("\nAvailable commands:");
    const commands = this.commandRegistry.getAvailableCommands();
    commands.forEach((cmd) => {
      console.log(`  ${cmd}`);
    });
  }

  /**
   * Handle unknown command
   */
  private handleUnknownCommand(command: string): void {
    console.error(`Error: Unknown command '${command}'`);
    console.log(
      `Available commands: ${this.commandRegistry.getAvailableCommands().join(", ")}`,
    );
    showUsage();
    process.exit(1);
  }
}
