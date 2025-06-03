import { HttpServer } from "../server/HttpServer.js";
import {
  CommandHandler,
  AnalyzeCodeFunction,
  FormatCodeFunction,
} from "../types/index.js";

/**
 * Server Command Handler
 * Handles HTTP server operations for API endpoints
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
