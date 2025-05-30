import {
  CodeAnalysisResult,
  AnalyzeCodeFunction,
  FormatCodeFunction,
} from "../types/index.js";

/**
 * Load analyze and format functions with fallback
 */
export function loadCodeProcessors(): {
  analyzeCode: AnalyzeCodeFunction;
  formatCode: FormatCodeFunction;
} {
  let analyzeCode: AnalyzeCodeFunction;
  let formatCode: FormatCodeFunction;

  try {
    // Try to load the index module
    const indexModule = require("./code-actions");
    analyzeCode = indexModule.analyzeCode;
    formatCode = indexModule.formatCode;
    console.error("Successfully loaded index module");
  } catch (err: any) {
    console.error("Error loading local module:", err.message);
    console.error(
      "Using stub implementations for analyze and format functions",
    );

    // Provide stub implementations
    analyzeCode = function (
      code: string,
      fileName: string,
    ): CodeAnalysisResult {
      return {
        fileName: fileName,
        functions: [],
        classes: [],
        variables: [],
        dependencies: [],
        complexity: 1,
        lines: code.split("\n").length,
      };
    };

    formatCode = function (code: string): string {
      // Simple formatting - just return the code as-is
      return code;
    };
  }

  return { analyzeCode, formatCode };
}

/**
 * Parse command line arguments
 */
export function parseArgs(): { command: string; args: string[] } {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return { command: "help", args: [] };
  }

  return {
    command: args[0],
    args: args.slice(1),
  };
}

/**
 * Show usage information
 */
export function showUsage(): void {
  console.error("Usage:");
  console.error("  analyze <file-path> - Analyze the specified file");
  console.error("  format <file-path> - Format the specified file");
  console.error(
    "  home [--init | --list | --add <item>] - Home directory and SQLite demo",
  );
  console.error(
    "  server [--port <port>] - Start in server mode on specified port (default: 9229)",
  );
}
