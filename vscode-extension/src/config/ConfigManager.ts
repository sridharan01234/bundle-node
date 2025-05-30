import * as path from "path";
import * as os from "os";
import { ExtensionConfig } from "../types";

/**
 * Configuration manager for the extension
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: ExtensionConfig;

  private constructor() {
    this.config = this.initializeConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private initializeConfig(): ExtensionConfig {
    const workspacePath = "/home/asplap1937/Documents/bundle-node";
    const binaryName = this.getBinaryName();
    const binaryPath = path.join(workspacePath, "bin", binaryName);

    return {
      binaryPath,
      workspacePath,
    };
  }

  private getBinaryName(): string {
    const platform = os.platform();
    switch (platform) {
      case "win32":
        return "cross-platform-tool-win.exe";
      case "darwin":
        return "cross-platform-tool-macos";
      case "linux":
        return "cross-platform-tool-linux";
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  public getConfig(): ExtensionConfig {
    return this.config;
  }

  public getBinaryPath(): string {
    return this.config.binaryPath;
  }
}
