import { DatabaseManager } from "../database/DatabaseManager.js";
import { CommandHandler, SQLite3DatabaseInstance } from "../types/index.js";

/**
 * Home Command Handler
 * Handles SQLite database demonstration operations
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
            console.error("Error: Item ID is required with --remove flag");
            this.closeDatabase(db);
            process.exit(1);
          }
        } else if (args.includes("--update")) {
          const itemIndex = args.indexOf("--update");
          if (itemIndex !== -1 && args[itemIndex + 1] && args[itemIndex + 2]) {
            this.dbManager.updateItem(
              db,
              args[itemIndex + 1],
              args[itemIndex + 2],
              () => {
                this.closeDatabase(db);
              },
            );
          } else {
            console.error(
              "Error: Item ID and new name are required with --update flag",
            );
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
