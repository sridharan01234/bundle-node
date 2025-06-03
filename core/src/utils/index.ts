import path from "path";
import os from "os";
import fs from "fs";
import {
  CodeAnalysisResult,
  AnalyzeCodeFunction,
  FormatCodeFunction,
} from "../types/index.js";

// Type declaration for pkg detection
declare global {
  namespace NodeJS {
    interface Process {
      pkg?: any;
    }
  }
}

/**
 * Detect the current platform and return the appropriate native module path
 */
function getNativeModulePath(): string | null {
  const platform = os.platform();
  const arch = os.arch();

  let moduleFileName: string;

  switch (platform) {
    case "linux":
      moduleFileName = "sqlite3.node";
      break;
    case "win32":
      moduleFileName = "node_sqlite3_win.node";
      break;
    case "darwin":
      moduleFileName = "sqlite3.node";
      break;
    default:
      console.warn(`Unsupported platform: ${platform}`);
      return null;
  }

  // Check if we're running in a pkg bundled environment
  const isPkgBundle = typeof (process as any).pkg !== "undefined";

  if (isPkgBundle) {
    // For pkg bundled environment, the asset is bundled with platform-specific filename
    // The asset path is just the filename since each binary only contains its own .node file
    const assetPath = moduleFileName;
    console.log(
      `PKG environment detected. Using platform-specific asset: ${assetPath}`,
    );
    return assetPath;
  }

  // For non-pkg environments, try multiple possible locations
  const platformDir =
    platform === "linux"
      ? "linux-x64"
      : platform === "win32"
        ? "win32-x64"
        : platform === "darwin"
          ? "darwin-x64"
          : null;

  if (!platformDir) {
    console.warn(`Unsupported platform directory for: ${platform}`);
    return null;
  }

  const possiblePaths = [
    // For VS Code extension environment
    path.join(
      path.dirname(process.execPath),
      "prebuilds",
      platformDir,
      moduleFileName,
    ),
    // For development environment
    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "prebuilds",
      platformDir,
      moduleFileName,
    ),
    // Alternative development path
    path.join(process.cwd(), "prebuilds", platformDir, moduleFileName),
  ];

  // Try each path until we find one that exists
  for (const modulePath of possiblePaths) {
    console.log(`Checking for native module at: ${modulePath}`);
    if (fs.existsSync(modulePath)) {
      console.log(`Found native module at: ${modulePath}`);
      return modulePath;
    }
  }

  console.warn(
    `No native module found for ${platform}-${arch}. Checked paths:`,
    possiblePaths,
  );
  return null;
}

/**
 * Load native SQLite3 module with OS detection
 */
function loadNativeModule(): any {
  const platform = os.platform();

  let moduleFileName: string;
  switch (platform) {
    case "linux":
      moduleFileName = "sqlite3.node";
      break;
    case "win32":
      moduleFileName = "node_sqlite3_win.node";
      break;
    case "darwin":
      moduleFileName = "sqlite3.node";
      break;
    default:
      console.warn(`Unsupported platform: ${platform}`);
      return null;
  }

  // Check if we're running in a pkg bundled environment
  const isPkgBundle = typeof (process as any).pkg !== "undefined";

  if (isPkgBundle) {
    try {
      console.log(
        "PKG environment detected - loading platform-specific native SQLite3 module",
      );

      // Try multiple possible asset paths in pkg - Windows needs special handling
      const platformDir =
        platform === "linux"
          ? "linux-x64"
          : platform === "win32"
            ? "win32-x64"
            : platform === "darwin"
              ? "darwin-x64"
              : null;

      let possibleAssetPaths: string[] = [];

      if (platform === "win32") {
        // Windows-specific paths for pkg
        possibleAssetPaths = [
          // Direct asset filename (most likely for platform-specific builds)
          moduleFileName,
          // Windows-style snapshot paths
          `prebuilds\\win32-x64\\${moduleFileName}`,
          `prebuilds/win32-x64/${moduleFileName}`,
          // Try with drive-like paths that pkg might use on Windows
          `C:\\snapshot\\${moduleFileName}`,
          `C:\\snapshot\\prebuilds\\win32-x64\\${moduleFileName}`,
          `/snapshot/${moduleFileName}`,
          // Alternative direct paths
          path.resolve(moduleFileName),
          path.join(process.cwd(), moduleFileName),
          // Try relative to executable
          path.join(path.dirname(process.execPath), moduleFileName),
        ];
      } else {
        // Linux/macOS paths
        const platformDir =
          platform === "linux"
            ? "linux-x64"
            : platform === "darwin"
              ? "darwin-x64"
              : null;

        if (platformDir) {
          possibleAssetPaths = [
            moduleFileName,
            `prebuilds/${platformDir}/${moduleFileName}`,
            path.join("prebuilds", platformDir, moduleFileName),
            path.join(
              __dirname,
              "..",
              "..",
              "prebuilds",
              platformDir,
              moduleFileName,
            ),
            path.join(
              path.dirname(process.execPath),
              "prebuilds",
              platformDir,
              moduleFileName,
            ),
          ];
        } else {
          possibleAssetPaths = [moduleFileName];
        }
      }

      let assetData: Buffer | null = null;
      let usedPath: string | null = null;

      // Try each possible path
      for (const assetPath of possibleAssetPaths) {
        try {
          console.log(`Trying to load asset from: ${assetPath}`);
          assetData = fs.readFileSync(assetPath);
          usedPath = assetPath;
          console.log(`Successfully found asset at: ${assetPath}`);
          break;
        } catch (error: any) {
          console.log(`Asset not found at: ${assetPath}`);
          continue;
        }
      }

      if (!assetData || !usedPath) {
        console.warn(
          `No native module asset found for ${platform}. Tried paths: ${possibleAssetPaths.join(", ")}`,
        );
        return null;
      }

      // For pkg bundled apps, extract the asset to a temporary location
      const tempDir = require("os").tmpdir();
      const tempModulePath = path.join(
        tempDir,
        `bundle-node-utils-${process.pid}-${moduleFileName}`,
      );

      // Write it to a temporary location
      fs.writeFileSync(tempModulePath, assetData);
      console.log(
        `Extracted native module to temporary location: ${tempModulePath}`,
      );

      // Load from the temporary location
      const nativeModule = require(tempModulePath);

      // Clean up on process exit
      process.on("exit", () => {
        try {
          fs.unlinkSync(tempModulePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      });

      console.log("Successfully loaded native SQLite3 module from pkg bundle");
      return nativeModule;
    } catch (error: any) {
      console.error(
        `Failed to load native module from pkg bundle:`,
        error.message,
      );
      return null;
    }
  }

  // For non-pkg environments, try multiple possible locations
  const platformDir =
    platform === "linux"
      ? "linux-x64"
      : platform === "win32"
        ? "win32-x64"
        : platform === "darwin"
          ? "darwin-x64"
          : null;

  if (!platformDir) {
    console.warn(`Unsupported platform directory for: ${platform}`);
    return null;
  }

  const possiblePaths = [
    // For VS Code extension environment
    path.join(
      path.dirname(process.execPath),
      "prebuilds",
      platformDir,
      moduleFileName,
    ),
    // For development environment
    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "prebuilds",
      platformDir,
      moduleFileName,
    ),
    // Alternative development path
    path.join(process.cwd(), "prebuilds", platformDir, moduleFileName),
  ];

  // Try each path until we find one that exists
  for (const modulePath of possiblePaths) {
    console.log(`Checking for native module at: ${modulePath}`);
    if (fs.existsSync(modulePath)) {
      console.log(`Found native module at: ${modulePath}`);
      try {
        const nativeModule = require(modulePath);
        console.log("Successfully loaded native SQLite3 module");
        return nativeModule;
      } catch (error: any) {
        console.error(
          `Failed to load native module from ${modulePath}:`,
          error.message,
        );
        continue;
      }
    }
  }

  console.warn(
    `No native module found for ${platform}. Checked paths:`,
    possiblePaths,
  );
  return null;
}

/**
 * Load analyze and format functions with fallback
 */
export function loadCodeProcessors(): {
  analyzeCode: AnalyzeCodeFunction;
  formatCode: FormatCodeFunction;
} {
  let analyzeCode: AnalyzeCodeFunction;
  let formatCode: FormatCodeFunction;

  // Try to load the native module first
  const nativeModule = loadNativeModule();

  try {
    // Try to load the index module
    const indexModule = require("./code-actions");
    analyzeCode = indexModule.analyzeCode;
    formatCode = indexModule.formatCode;
    console.log("Successfully loaded code processors");

    // If native module is available, you can enhance the processors with native functionality
    if (nativeModule) {
      console.log(
        "Native SQLite3 module is available for enhanced functionality",
      );
    }
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
