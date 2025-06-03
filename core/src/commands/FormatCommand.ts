import * as path from "path";
import { CommandHandler, FormatCodeFunction } from "../types/index.js";
import { FileValidator } from "../utils/FileValidator.js";

/**
 * Format Command Handler
 * Handles code formatting operations
 */
export class FormatCommand {
  constructor(private formatCode: FormatCodeFunction) {}

  handle: CommandHandler = (args: string[]) => {
    try {
      const filePath = FileValidator.validateFilePath(args[0], "format");
      const code = FileValidator.readFileContent(filePath);
      const fileName = path.basename(filePath);
      const formattedCode = this.formatCode(code);

      if (formattedCode !== code) {
        FileValidator.writeFileContent(filePath, formattedCode);
        console.error(`File '${fileName}' has been formatted`);
      } else {
        console.error(`File '${fileName}' is already properly formatted`);
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  };
}
