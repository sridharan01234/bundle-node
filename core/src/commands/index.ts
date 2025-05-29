import * as fs from "fs";
import * as path from "path";
import { DatabaseManager } from "../database/DatabaseManager.js";
import { HttpServer } from "../server/HttpServer.js";
import {
  CommandHandler,
  AnalyzeCodeFunction,
  FormatCodeFunction,
  SQLite3DatabaseInstance,
} from "../types/index.js";

/**
 * Analyze Command Handler
 */
export class AnalyzeCommand {
  constructor(private analyzeCode: AnalyzeCodeFunction) {}

  handle: CommandHandler = (args: string[]) => {
    const filePath = args[0];

    if (!filePath) {
      console.error("Error: File path is required");
      process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
      console.error(`Error: File '${filePath}' does not exist`);
      process.exit(1);
    }

    const code = fs.readFileSync(filePath, "utf-8");
    const fileName = path.basename(filePath);
    const result = this.analyzeCode(code, fileName);

    console.log(JSON.stringify(result, null, 2));
  };
}

/**
 * Format Command Handler
 */
export class FormatCommand {
  constructor(private formatCode: FormatCodeFunction) {}

  handle: CommandHandler = (args: string[]) => {
    const filePath = args[0];

    if (!filePath) {
      console.error("Error: File path is required");
      process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
      console.error(`Error: File '${filePath}' does not exist`);
      process.exit(1);
    }

    const code = fs.readFileSync(filePath, "utf-8");
    const fileName = path.basename(filePath);
    const formattedCode = this.formatCode(code);

    if (formattedCode !== code) {
      fs.writeFileSync(filePath, formattedCode);
      console.error(`File '${fileName}' has been formatted`);
    } else {
      console.error(`File '${fileName}' is already properly formatted`);
    }
  };
}

/**
 * Home Command Handler (SQLite Demo)
 */
export class HomeCommand {
  private dbManager: DatabaseManager;

  constructor() {
    this.dbManager = new DatabaseManager();
  }

  handle: CommandHandler = (args: string[]) => {
    this.dbManager.createConnection(
      (err: Error | null, db?: SQLite3DatabaseInstance) => {
        if (err || !db) {
          console.error("Failed to connect to database:", err?.message);
          process.exit(1);
        }

        // Process home subcommands
        if (args.includes("--init")) {
          this.dbManager.initDatabase(db, () => {
            this.closeDatabase(db);
          });
        } else if (args.includes("--list")) {
          this.dbManager.listItems(db, () => {
            this.closeDatabase(db);
          });
        } else if (args.includes("--add")) {
          const itemIndex = args.indexOf("--add");
          if (itemIndex !== -1 && args[itemIndex + 1]) {
            this.dbManager.addItem(db, args[itemIndex + 1], () => {
              this.closeDatabase(db);
            });
          } else {
            console.error("Error: Item value is required with --add flag");
            this.closeDatabase(db);
            process.exit(1);
          }
        } else if (args.includes("--remove")) {
          const itemIndex = args.indexOf("--remove");
          if (itemIndex !== -1 && args[itemIndex + 1]) {
            this.dbManager.removeItem(db, args[itemIndex + 1], () => {
              this.closeDatabase(db);
            });
          } else {
            console.error("Error: Item value is required with --remove flag");
            this.closeDatabase(db);
            process.exit(1);
          }
        } else if (args.includes("--clear")) {
          this.dbManager.clearItems(db, () => {
            this.closeDatabase(db);
          });
        } else {
          this.dbManager.showDatabaseInfo(db, () => {
            this.closeDatabase(db);
          });
        }
      },
    );
  };

  private closeDatabase(db: SQLite3DatabaseInstance): void {
    db.close((err: Error | null) => {
      if (err) {
        console.error("Error closing database:", err.message);
        process.exit(1);
      }
    });
  }
}

/**
 * Server Command Handler
 */
export class ServerCommand {
  constructor(
    private analyzeCode: AnalyzeCodeFunction,
    private formatCode: FormatCodeFunction,
  ) {}

  handle: CommandHandler = (args: string[]) => {
    // Default port is 9229, but allow override via --port flag
    let port = 9229;
    const portArgIndex = args.indexOf("--port");
    if (portArgIndex !== -1 && args[portArgIndex + 1]) {
      port = parseInt(args[portArgIndex + 1], 10);
    }

    const server = new HttpServer(this.analyzeCode, this.formatCode);
    server.start(port);
  };
}
