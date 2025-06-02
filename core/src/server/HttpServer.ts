import * as http from "http";
import * as url from "url";
import * as fs from "fs";
import * as path from "path";
import { DatabaseManager } from "../database/DatabaseManager.js";
import {
  ServerRequestBody,
  AnalyzeCodeFunction,
  FormatCodeFunction,
  SQLite3DatabaseInstance,
} from "../types/index.js";

/**
 * HTTP Server for handling analyze/format/database requests
 * Provides better performance for frequent calls
 */
export class HttpServer {
  private validTokens: Set<string>;
  private analyzeCode: AnalyzeCodeFunction;
  private formatCode: FormatCodeFunction;
  private dbManager: DatabaseManager;

  constructor(
    analyzeCode: AnalyzeCodeFunction,
    formatCode: FormatCodeFunction,
  ) {
    this.analyzeCode = analyzeCode;
    this.formatCode = formatCode;
    this.dbManager = new DatabaseManager();
    this.validTokens = new Set<string>();
    this.setupValidTokens();
  }

  /**
   * Setup valid security tokens
   */
  private setupValidTokens(): void {}

  /**
   * Start the HTTP server
   */
  start(port: number): void {
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Start the server
    server.listen(port, () => {
      console.log(`Server started on port ${port}`);
    });

    // Handle server errors
    server.on("error", (err) => {
      console.error("Server error:", err);
      process.exit(1);
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    // Parse URL
    const parsedUrl = url.parse(req.url || "", true);

    // Set CORS headers for development ease
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Handle ping endpoint for health checks (GET request)
    if (req.method === "GET" && parsedUrl.pathname === "/ping") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("pong");
      return;
    }

    // Handle GET request for root path
    if (req.method === "GET" && parsedUrl.pathname === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "running",
          endpoints: [
            "/ping",
            "/analyze",
            "/format",
            "/database/init",
            "/database/items",
            "/database/clear",
          ],
        }),
      );
      return;
    }

    // Only accept POST requests for API endpoints
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    // Route the request
    if (parsedUrl.pathname === "/analyze") {
      this.handleAnalyzeRequest(req, res);
    } else if (parsedUrl.pathname === "/format") {
      this.handleFormatRequest(req, res);
    } else if (parsedUrl.pathname === "/database/init") {
      this.handleDatabaseInit(req, res);
    } else if (parsedUrl.pathname === "/database/items") {
      this.handleDatabaseItems(req, res);
    } else if (parsedUrl.pathname === "/database/clear") {
      this.handleDatabaseClear(req, res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  }

  /**
   * Handle database initialization
   */
  private handleDatabaseInit(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      try {
        const body = JSON.parse(data);

        this.dbManager.createConnection((err, db) => {
          if (err || !db) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Database connection failed" }));
            return;
          }

          this.dbManager.initDatabase(db, () => {
            db.close(() => {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  success: true,
                  message: "Database initialized",
                }),
              );
            });
          });
        });
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
  }

  /**
   * Handle database items operations (list, add, delete, update)
   */
  private handleDatabaseItems(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      try {
        const body = JSON.parse(data);

        this.dbManager.createConnection((err, db) => {
          if (err || !db) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Database connection failed" }));
            return;
          }

          const { action } = body;

          switch (action) {
            case "list":
              this.handleListItems(db, res);
              break;
            case "add":
              this.handleAddItem(db, res, body.name);
              break;
            case "delete":
              this.handleDeleteItem(db, res, body.id);
              break;
            case "update":
              this.handleUpdateItem(db, res, body.id, body.name);
              break;
            default:
              db.close();
              res.writeHead(400);
              res.end(JSON.stringify({ error: "Invalid action" }));
          }
        });
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
  }

  /**
   * Handle list items
   */
  private handleListItems(
    db: SQLite3DatabaseInstance,
    res: http.ServerResponse,
  ): void {
    db.all("SELECT * FROM items ORDER BY id", [], (err, rows) => {
      db.close();

      if (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Failed to fetch items" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ items: rows || [] }));
    });
  }

  /**
   * Handle add item
   */
  private handleAddItem(
    db: SQLite3DatabaseInstance,
    res: http.ServerResponse,
    name: string,
  ): void {
    if (!name?.trim()) {
      db.close();
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Item name is required" }));
      return;
    }

    this.dbManager.addItem(db, name.trim(), () => {
      db.close();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "Item added" }));
    });
  }

  /**
   * Handle delete item
   */
  private handleDeleteItem(
    db: SQLite3DatabaseInstance,
    res: http.ServerResponse,
    id: string,
  ): void {
    if (!id) {
      db.close();
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Item ID is required" }));
      return;
    }

    this.dbManager.removeItem(db, id, () => {
      db.close();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "Item deleted" }));
    });
  }

  /**
   * Handle update item
   */
  private handleUpdateItem(
    db: SQLite3DatabaseInstance,
    res: http.ServerResponse,
    id: string,
    name: string,
  ): void {
    if (!id || !name?.trim()) {
      db.close();
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Item ID and name are required" }));
      return;
    }

    this.dbManager.updateItem(db, id, name.trim(), () => {
      db.close();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "Item updated" }));
    });
  }

  /**
   * Handle database clear
   */
  private handleDatabaseClear(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      try {
        const body = JSON.parse(data);

        this.dbManager.createConnection((err, db) => {
          if (err || !db) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Database connection failed" }));
            return;
          }

          this.dbManager.clearItems(db, () => {
            db.close();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ success: true, message: "Database cleared" }),
            );
          });
        });
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
  }

  /**
   * Handle analyze requests
   */
  private handleAnalyzeRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      try {
        // Parse the request body
        const body: ServerRequestBody = JSON.parse(data);
        const { filePath, code } = body;

        // Either use provided code or read from file
        let sourceCode: string;
        let fileName: string;

        if (code) {
          sourceCode = code;
          fileName = filePath ? path.basename(filePath) : "unknown";
        } else if (filePath) {
          // Ensure file exists
          if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: `File '${filePath}' not found` }));
            return;
          }

          sourceCode = fs.readFileSync(filePath, "utf-8");
          fileName = path.basename(filePath);
        } else {
          res.writeHead(400);
          res.end(
            JSON.stringify({
              error: "Either code or filePath must be provided",
            }),
          );
          return;
        }

        // Analyze the code
        const result = this.analyzeCode(sourceCode, fileName);

        // Send the response
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error("Error handling analyze request:", error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
  }

  /**
   * Handle format requests
   */
  private handleFormatRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      try {
        // Parse the request body
        const body: ServerRequestBody = JSON.parse(data);
        const { filePath, code, saveToFile } = body;

        // Either use provided code or read from file
        let sourceCode: string;

        if (code) {
          sourceCode = code;
        } else if (filePath) {
          // Ensure file exists
          if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: `File '${filePath}' not found` }));
            return;
          }

          sourceCode = fs.readFileSync(filePath, "utf-8");
        } else {
          res.writeHead(400);
          res.end(
            JSON.stringify({
              error: "Either code or filePath must be provided",
            }),
          );
          return;
        }

        // Format the code
        const formattedCode = this.formatCode(sourceCode);

        // Save to file if requested
        if (saveToFile && filePath) {
          fs.writeFileSync(filePath, formattedCode);
        }

        // Send the response
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            formatted: formattedCode,
            changed: formattedCode !== sourceCode,
          }),
        );
      } catch (error) {
        console.error("Error handling format request:", error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
  }
}
