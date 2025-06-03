import * as fs from "fs";

/**
 * File Validator Utility
 * Provides common file validation methods used across commands
 */
export class FileValidator {
  /**
   * Validate that a file path is provided and exists
   */
  public static validateFilePath(
    filePath: string | undefined,
    commandName: string,
  ): string {
    if (!filePath) {
      throw new Error(`${commandName}: File path is required`);
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`${commandName}: File '${filePath}' does not exist`);
    }

    return filePath;
  }

  /**
   * Read file content safely with error handling
   */
  public static readFileContent(filePath: string): string {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (error: any) {
      throw new Error(`Failed to read file '${filePath}': ${error.message}`);
    }
  }

  /**
   * Write file content safely with error handling
   */
  public static writeFileContent(filePath: string, content: string): void {
    try {
      fs.writeFileSync(filePath, content);
    } catch (error: any) {
      throw new Error(`Failed to write file '${filePath}': ${error.message}`);
    }
  }
}
