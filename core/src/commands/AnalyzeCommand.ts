import * as path from "path";
import { CommandHandler, AnalyzeCodeFunction } from "../types/index.js";
import { FileValidator } from "../utils/FileValidator.js";

/**
 * Analyze Command Handler
 * Handles code analysis operations
 */
export class AnalyzeCommand {
  constructor(private analyzeCode: AnalyzeCodeFunction) {}

  handle: CommandHandler = (args: string[]) => {
    try {
      const filePath = FileValidator.validateFilePath(args[0], "analyze");
      const code = FileValidator.readFileContent(filePath);
      const fileName = path.basename(filePath);
      const result = this.analyzeCode(code, fileName);

      console.log(JSON.stringify(result, null, 2));
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  };
}
