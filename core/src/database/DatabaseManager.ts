import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";
import { SQLite3DatabaseInstance, ItemRow } from "../types/index.js";

let sqlite3: any;
try {
  sqlite3 = require("sqlite3").verbose();
  console.log("SQLite3 loaded successfully");
} catch (err) {
  console.error("Failed to load sqlite3:", err);
  throw err;
}

/**
 * Database Manager Class
 * Handles all SQLite database operations
 */
export class DatabaseManager {
  private appDir: string;
  private dbPath: string;

  constructor() {
    const homeDir = homedir();
    this.appDir = path.join(homeDir, ".my-app");
    this.dbPath = path.join(this.appDir, "data.sqlite");
    this.ensureAppDirectory();
  }

  /**
   * Ensure application directory exists
   */
  private ensureAppDirectory(): void {
    if (!fs.existsSync(this.appDir)) {
      fs.mkdirSync(this.appDir, { recursive: true });
      console.log(`Created app directory: ${this.appDir}`);
    }
  }

  /**
   * Get database path
   */
  getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Get app directory path
   */
  getAppDir(): string {
    return this.appDir;
  }

  /**
   * Create a new database connection
   */
  createConnection(
    callback: (err: Error | null, db?: SQLite3DatabaseInstance) => void,
  ): void {
    const db = new sqlite3.Database(this.dbPath, (err: Error | null) => {
      if (err) {
        console.error("Error opening database:", err.message);
        callback(err);
        return;
      }
      callback(null, db);
    });
  }

  /**
   * Initialize the database with required tables
   */
  initDatabase(db: SQLite3DatabaseInstance, callback: () => void): void {
    console.log("Initializing database...");

    db.serialize(() => {
      // Drop table if exists for clean initialization
      db.run("DROP TABLE IF EXISTS items", (err: Error | null) => {
        if (err) {
          console.error("Error dropping table:", err.message);
          callback();
          return;
        }

        // Create a new table
        db.run(
          `CREATE TABLE items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
          (err: Error | null) => {
            if (err) {
              console.error("Error creating table:", err.message);
              callback();
              return;
            }

            console.log("Database initialized successfully");

            // Add some initial data
            const initialItems = ["Test Item 1", "Test Item 2", "Test Item 3"];
            this.insertInitialItems(db, initialItems, callback);
          },
        );
      });
    });
  }

  /**
   * Insert initial items into the database
   */
  private insertInitialItems(
    db: SQLite3DatabaseInstance,
    items: string[],
    callback: () => void,
  ): void {
    let completed = 0;
    const total = items.length;

    items.forEach((item) => {
      db.run(
        "INSERT INTO items (name) VALUES (?)",
        [item],
        function (err: Error | null) {
          if (err) {
            console.error("Error inserting item:", err.message);
          }

          completed++;

          if (completed === total) {
            console.log(`Added ${completed} initial items`);
            callback();
          }
        },
      );
    });
  }

  /**
   * List all items from the database
   */
  listItems(db: SQLite3DatabaseInstance, callback: () => void): void {
    console.log("Listing items from database:");

    db.all<ItemRow>(
      "SELECT * FROM items ORDER BY id",
      [],
      (err: Error | null, rows: ItemRow[]) => {
        if (err) {
          console.error("Error querying database:", err.message);
          callback();
          return;
        }

        if (rows.length === 0) {
          console.log("No items found. Use --init to initialize the database.");
        } else {
          console.log("ID | Name | Created At");
          console.log("-".repeat(50));

          rows.forEach((row: ItemRow) => {
            console.log(`${row.id} | ${row.name} | ${row.created_at}`);
          });
        }

        callback();
      },
    );
  }

  /**
   * Add a new item to the database
   */
  addItem(
    db: SQLite3DatabaseInstance,
    itemName: string,
    callback: () => void,
  ): void {
    console.log(`Adding new item: "${itemName}"`);

    db.run(
      "INSERT INTO items (name) VALUES (?)",
      [itemName],
      function (this: any, err: Error | null) {
        if (err) {
          console.error("Error adding item:", err.message);
        } else {
          console.log(`Item added successfully with ID: ${this.lastID}`);
        }
        callback();
      },
    );
  }

  /**
   * Clear all items from the database
   */
  clearItems(db: SQLite3DatabaseInstance, callback: () => void): void {
    console.log("Clearing all items from the database...");
    db.run("DELETE FROM items", [], function (this: any, err: Error | null) {
      if (err) {
        console.error("Error clearing items:", err.message);
      } else {
        console.log(`Cleared ${this.changes} items from the database`);
      }
      callback();
    });
  }

  /**
   * Show database information
   */
  showDatabaseInfo(db: SQLite3DatabaseInstance, callback: () => void): void {
    console.log("Home Feature - SQLite3 Demo");
    console.log("-".repeat(30));
    console.log(`Application directory: ${this.appDir}`);
    console.log(`Database path: ${this.dbPath}`);

    // Check if database is initialized
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='items'",
      (err: Error | null, row: any) => {
        if (err) {
          console.error("Error checking database:", err.message);
        } else {
          if (row) {
            console.log("Database status: Initialized");
            console.log("Available commands:");
            console.log("  --list: List all items");
            console.log("  --add <item>: Add a new item");
          } else {
            console.log("Database status: Not initialized");
            console.log("Run with --init to initialize the database");
          }
        }

        callback();
      },
    );
  }

  /**
   * Remove an item from the database
   */
  removeItem(
    db: SQLite3DatabaseInstance,
    itemId: string,
    callback: () => void,
  ): void {
    console.log(`Removing item with ID: ${itemId}`);
    db.run(
      "DELETE FROM items WHERE id = ?",
      [itemId],
      function (this: any, err: Error | null) {
        if (err) {
          console.error("Error removing item:", err.message);
          callback();
          return;
        }

        if (this.changes > 0) {
          console.log(`Item with ID ${itemId} removed successfully`);
        } else {
          console.log(`No item found with ID ${itemId}`);
        }
        callback();
      },
    );
  }

  /**
   * Update an item in the database
   */
  updateItem(
    db: SQLite3DatabaseInstance,
    itemId: string,
    newName: string,
    callback: () => void,
  ): void {
    console.log(`Updating item ${itemId} to: "${newName}"`);

    db.run(
      "UPDATE items SET name = ? WHERE id = ?",
      [newName, itemId],
      function (this: any, err: Error | null) {
        if (err) {
          console.error("Error updating item:", err.message);
          callback();
          return;
        }

        if (this.changes > 0) {
          console.log(`Item with ID ${itemId} updated successfully`);
        } else {
          console.log(`No item found with ID ${itemId}`);
        }
        callback();
      },
    );
  }
}
