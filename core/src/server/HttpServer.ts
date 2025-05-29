import * as http from "http";
import * as url from "url";
import * as fs from "fs";
import * as path from "path";
import {
  ServerRequestBody,
  AnalyzeCodeFunction,
  FormatCodeFunction,
} from "../types/index.js";

/**
 * HTTP Server for handling analyze/format requests
 * Provides better performance for frequent calls
 */
export class HttpServer {
  private validTokens: Set<string>;
  private analyzeCode: AnalyzeCodeFunction;
  private formatCode: FormatCodeFunction;

  constructor(
    analyzeCode: AnalyzeCodeFunction,
    formatCode: FormatCodeFunction,
  ) {
    this.analyzeCode = analyzeCode;
    this.formatCode = formatCode;
    this.validTokens = new Set<string>();
    this.setupValidTokens();
  }

  /**
   * Setup valid security tokens
   */
  private setupValidTokens(): void {
    // Add environment token if provided
    if (process.env.PLUGIN_SECURITY_TOKEN) {
      this.validTokens.add(process.env.PLUGIN_SECURITY_TOKEN);
    }

    // Add common client tokens for development
    this.validTokens.add("vscode-client");
  }

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

    // Add proper shutdown handling
    process.on("SIGINT", () => {
      console.log("Server shutting down...");
      server.close(() => {
        console.log("Server stopped");
        process.exit(0);
      });
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
    res.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Only accept POST requests
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("Method Not Allowed");
      return;
    }

    // Route the request
    if (parsedUrl.pathname === "/analyze") {
      this.handleAnalyzeRequest(req, res);
    } else if (parsedUrl.pathname === "/format") {
      this.handleFormatRequest(req, res);
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
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
        const { filePath, securityToken, code } = body;

        // Validate security token
        if (!securityToken || !this.validTokens.has(securityToken)) {
          res.writeHead(403);
          res.end(JSON.stringify({ error: "Invalid security token" }));
          return;
        }

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
        const { filePath, securityToken, code, saveToFile } = body;

        // Validate security token
        if (!securityToken || !this.validTokens.has(securityToken)) {
          res.writeHead(403);
          res.end(JSON.stringify({ error: "Invalid security token" }));
          return;
        }

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
