import { DatabaseManager } from "../database/DatabaseManager.js";
import { SQLite3DatabaseInstance } from "../types/index.js";

/**
 * Database Operations Utility
 * Provides higher-level database operations for commands
 */
export class DatabaseOperations {
  private dbManager: DatabaseManager;

  constructor() {
    this.dbManager = new DatabaseManager();
  }

  /**
   * Execute a database operation with automatic connection handling
   */
  public async executeOperation(
    operation: (db: SQLite3DatabaseInstance) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.dbManager.createConnection(
        (err: Error | null, db?: SQLite3DatabaseInstance) => {
          if (err || !db) {
            reject(new Error(`Failed to connect to database: ${err?.message}`));
            return;
          }

          try {
            operation(db);
            this.closeDatabase(db, resolve, reject);
          } catch (error) {
            this.closeDatabase(db, () => reject(error), reject);
          }
        },
      );
    });
  }

  /**
   * Initialize database with proper error handling
   */
  public initializeDatabase(): Promise<void> {
    return this.executeOperation((db) => {
      this.dbManager.initDatabase(db, () => {
        console.log("Database initialized successfully");
      });
    });
  }

  /**
   * List all items with proper error handling
   */
  public listItems(): Promise<void> {
    return this.executeOperation((db) => {
      this.dbManager.listItems(db, () => {
        // Completion handled by DatabaseManager
      });
    });
  }

  /**
   * Add an item with proper error handling
   */
  public addItem(itemName: string): Promise<void> {
    return this.executeOperation((db) => {
      this.dbManager.addItem(db, itemName, () => {
        console.log(`Item "${itemName}" added successfully`);
      });
    });
  }

  /**
   * Remove an item with proper error handling
   */
  public removeItem(itemId: string): Promise<void> {
    return this.executeOperation((db) => {
      this.dbManager.removeItem(db, itemId, () => {
        console.log(`Item with ID "${itemId}" removed successfully`);
      });
    });
  }

  /**
   * Update an item with proper error handling
   */
  public updateItem(itemId: string, newName: string): Promise<void> {
    return this.executeOperation((db) => {
      this.dbManager.updateItem(db, itemId, newName, () => {
        console.log(`Item with ID "${itemId}" updated successfully`);
      });
    });
  }

  /**
   * Clear all items with proper error handling
   */
  public clearItems(): Promise<void> {
    return this.executeOperation((db) => {
      this.dbManager.clearItems(db, () => {
        console.log("All items cleared successfully");
      });
    });
  }

  /**
   * Show database info with proper error handling
   */
  public showDatabaseInfo(): Promise<void> {
    return this.executeOperation((db) => {
      this.dbManager.showDatabaseInfo(db, () => {
        // Completion handled by DatabaseManager
      });
    });
  }

  /**
   * Safely close database connection
   */
  private closeDatabase(
    db: SQLite3DatabaseInstance,
    onSuccess: () => void,
    onError: (error: Error) => void,
  ): void {
    db.close((err: Error | null) => {
      if (err) {
        onError(new Error(`Error closing database: ${err.message}`));
      } else {
        onSuccess();
      }
    });
  }
}
