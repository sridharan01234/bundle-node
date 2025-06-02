import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { Logger } from "../utils/Logger";

/**
 * Enhanced configuration manager with robust binary path resolution
 */
export class ConfigManager {
  private context: vscode.ExtensionContext;
  private binaryPath: string | null = null;
  private static instance: ConfigManager | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.binaryPath = this.resolveBinaryPath();
  }

  /**
   * Singleton instance for ConfigManager
   */
  public static getInstance(context: vscode.ExtensionContext): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(context);
    }
    return ConfigManager.instance;
  }

  /**
   * Resolve binary path using multiple fallback strategies
   */
  private resolveBinaryPath(): string {
    const platform = this.getPlatform();
    const binaryName = `cross-platform-tool-${platform}${platform === "win" ? ".exe" : ""}`;

    Logger.info(
      `Resolving binary path for platform: ${platform}, binary name: ${binaryName}`,
    );

    // Strategy 1: Extension's bin directory (packaged extension)
    const extensionBinPath = path.join(
      this.context.extensionPath,
      "bin",
      binaryName,
    );
    if (this.validateBinaryPath(extensionBinPath)) {
      Logger.info(`Found binary via extension path: ${extensionBinPath}`);
      return extensionBinPath;
    }

    // Strategy 2: Try relative to the extension root
    const relativeBinPath = path.join(
      this.context.extensionPath,
      "..",
      "bin",
      binaryName,
    );
    if (this.validateBinaryPath(relativeBinPath)) {
      Logger.info(`Found binary via relative path: ${relativeBinPath}`);
      return relativeBinPath;
    }

    // Strategy 3: Try using require.resolve for npm-like packages
    try {
      const packageBinPath = require.resolve(
        `@your-org/database-tool/bin/${binaryName}`,
      );
      if (this.validateBinaryPath(packageBinPath)) {
        Logger.info(`Found binary via require.resolve: ${packageBinPath}`);
        return packageBinPath;
      }
    } catch (error) {
      Logger.debug(`require.resolve failed: ${error}`);
    }

    // Strategy 4: Check node_modules/.bin (if installed as dependency)
    const nodeModulesBinPath = path.join(
      this.context.extensionPath,
      "node_modules",
      ".bin",
      binaryName,
    );
    if (this.validateBinaryPath(nodeModulesBinPath)) {
      Logger.info(`Found binary in node_modules/.bin: ${nodeModulesBinPath}`);
      return nodeModulesBinPath;
    }

    // Strategy 5: Check global installation paths
    const globalPaths = this.getGlobalBinaryPaths(binaryName);
    for (const globalPath of globalPaths) {
      if (this.validateBinaryPath(globalPath)) {
        Logger.info(`Found binary in global path: ${globalPath}`);
        return globalPath;
      }
    }

    // Strategy 6: Check PATH environment variable
    const pathBinary = this.findInPath(binaryName);
    if (pathBinary && this.validateBinaryPath(pathBinary)) {
      Logger.info(`Found binary in PATH: ${pathBinary}`);
      return pathBinary;
    }

    // Strategy 7: Development fallback (workspace root)
    const devPath = path.join(
      this.context.extensionPath,
      "..",
      "..",
      "bin",
      binaryName,
    );
    if (this.validateBinaryPath(devPath)) {
      Logger.warning(`Using development fallback path: ${devPath}`);
      return devPath;
    }

    // Strategy 8: Try alternative binary names
    const alternativeNames = [
      `database-tool-${platform}${platform === "win" ? ".exe" : ""}`,
      `sqlite-manager-${platform}${platform === "win" ? ".exe" : ""}`,
      `bundle-tool-${platform}${platform === "win" ? ".exe" : ""}`,
    ];

    for (const altName of alternativeNames) {
      const altPath = path.join(this.context.extensionPath, "bin", altName);
      if (this.validateBinaryPath(altPath)) {
        Logger.info(`Found binary with alternative name: ${altPath}`);
        return altPath;
      }
    }

    // Final fallback: throw detailed error with all attempted paths
    const attemptedPaths = [
      extensionBinPath,
      relativeBinPath,
      nodeModulesBinPath,
      ...globalPaths,
      devPath,
    ];

    const errorMessage = `Binary not found. Attempted paths:\n${attemptedPaths.map((p) => `  - ${p}`).join("\n")}\n\nPlatform: ${platform}\nExtension path: ${this.context.extensionPath}`;

    Logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  /**
   * Validate that a binary path exists and is executable
   */
  private validateBinaryPath(binaryPath: string): boolean {
    try {
      if (!fs.existsSync(binaryPath)) {
        Logger.debug(`Binary not found at: ${binaryPath}`);
        return false;
      }

      const stats = fs.statSync(binaryPath);
      if (!stats.isFile()) {
        Logger.debug(`Path is not a file: ${binaryPath}`);
        return false;
      }

      // Check executable permissions on Unix-like systems
      if (process.platform !== "win32") {
        if (!(stats.mode & parseInt("111", 8))) {
          Logger.debug(`Binary is not executable: ${binaryPath}`);
          // Try to fix permissions
          try {
            fs.chmodSync(binaryPath, "755");
            Logger.info(`Fixed permissions for: ${binaryPath}`);
            return true;
          } catch (error) {
            Logger.debug(`Cannot fix permissions for: ${binaryPath}`);
            return false;
          }
        }
      }

      Logger.debug(`Binary validated: ${binaryPath}`);
      return true;
    } catch (error) {
      Logger.debug(`Error validating binary path ${binaryPath}: ${error}`);
      return false;
    }
  }

  /**
   * Validate if the binary is accessible
   */
  public validateBinary(): boolean {
    try {
      const binaryPath = this.getBinaryPath();
      if (!fs.existsSync(binaryPath)) {
        Logger.error(`Binary not found at: ${binaryPath}`);
        return false;
      }

      const stats = fs.statSync(binaryPath);
      if (!stats.isFile()) {
        Logger.error(`Binary path is not a file: ${binaryPath}`);
        return false;
      }

      // Check executable permissions on Unix-like systems
      if (process.platform !== "win32" && !(stats.mode & parseInt("111", 8))) {
        Logger.error(`Binary is not executable: ${binaryPath}`);
        return false;
      }

      Logger.info(`Binary is accessible: ${binaryPath}`);
      return true;
    } catch (error) {
      Logger.error(`Error validating binary: ${error}`);
      return false;
    }
  }

  /**
   * Get platform-specific binary suffix
   */
  private getPlatform(): string {
    switch (process.platform) {
      case "win32":
        return "win";
      case "darwin":
        return "macos";
      case "linux":
        return "linux";
      default:
        Logger.warning(
          `Unsupported platform: ${process.platform}, defaulting to linux`,
        );
        return "linux";
    }
  }

  /**
   * Get potential global installation paths
   */
  private getGlobalBinaryPaths(binaryName: string): string[] {
    const paths: string[] = [];

    // Common global installation directories
    const globalDirs = [
      "/usr/local/bin",
      "/usr/bin",
      "/opt/local/bin",
      path.join(process.env.HOME || "", ".local", "bin"),
      path.join(process.env.APPDATA || "", "npm"),
      path.join(process.env.USERPROFILE || "", "AppData", "Roaming", "npm"),
    ];

    for (const dir of globalDirs) {
      if (dir) {
        paths.push(path.join(dir, binaryName));
      }
    }

    return paths;
  }

  /**
   * Find binary in PATH environment variable
   */
  private findInPath(binaryName: string): string | null {
    const pathEnv = process.env.PATH || "";
    const pathSeparator = process.platform === "win32" ? ";" : ":";
    const paths = pathEnv.split(pathSeparator);

    for (const dirPath of paths) {
      if (dirPath.trim()) {
        const fullPath = path.join(dirPath.trim(), binaryName);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
    }

    return null;
  }

  /**
   * Get the resolved binary path
   */
  public getBinaryPath(): string {
    if (!this.binaryPath) {
      throw new Error(
        "Binary path not resolved. Extension may not be properly installed.",
      );
    }
    return this.binaryPath;
  }

  /**
   * Re-resolve binary path (useful for troubleshooting)
   */
  public refreshBinaryPath(): string {
    this.binaryPath = this.resolveBinaryPath();
    return this.binaryPath;
  }

  /**
   * Get diagnostic information about binary resolution
   */
  public getDiagnostics(): any {
    const platform = this.getPlatform();
    const binaryName = `cross-platform-tool-${platform}${platform === "win" ? ".exe" : ""}`;

    return {
      platform: process.platform,
      resolvedPlatform: platform,
      binaryName,
      extensionPath: this.context.extensionPath,
      currentBinaryPath: this.binaryPath,
      pathEnvironment: process.env.PATH,
      nodeVersion: process.version,
      extensionMode: this.context.extensionMode,
      attemptedPaths: {
        extensionBin: path.join(this.context.extensionPath, "bin", binaryName),
        relativeBin: path.join(
          this.context.extensionPath,
          "..",
          "bin",
          binaryName,
        ),
        nodeModulesBin: path.join(
          this.context.extensionPath,
          "node_modules",
          ".bin",
          binaryName,
        ),
        devPath: path.join(
          this.context.extensionPath,
          "..",
          "..",
          "bin",
          binaryName,
        ),
      },
    };
  }

  /**
   * Check if we're running in development mode
   */
  public isDevelopmentMode(): boolean {
    return this.context.extensionMode === vscode.ExtensionMode.Development;
  }

  /**
   * Get extension configuration
   */
  public getConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("sqliteManager");
  }

  /**
   * Get configuration value with type safety
   */
  public getConfigValue<T>(key: string, defaultValue: T): T {
    const config = this.getConfiguration();
    return config.get<T>(key, defaultValue);
  }

  /**
   * Set configuration value
   */
  public async setConfigValue(
    key: string,
    value: any,
    target?: vscode.ConfigurationTarget,
  ): Promise<void> {
    const config = this.getConfiguration();
    await config.update(
      key,
      value,
      target || vscode.ConfigurationTarget.Global,
    );
  }

  /**
   * Get extension context
   */
  public getContext(): vscode.ExtensionContext {
    return this.context;
  }
}
