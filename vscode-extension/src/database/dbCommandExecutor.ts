import { exec, execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const execPromise = promisify(exec);

/**
 * Execute database command via CLI with better error handling
 * @param binaryPath Path to the binary to execute
 * @param command The command to execute (e.g., "home")
 * @param args Arguments for the command
 * @returns Promise with command result string
 */
export async function executeDatabaseCommand(
  binaryPath: string,
  command: string,
  args: string[],
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`Checking binary at path: ${binaryPath}`);

      // First check if binary exists
      if (!fs.existsSync(binaryPath)) {
        console.error(`Binary not found at path: ${binaryPath}`);
        reject(new Error(`Binary not found at path: ${binaryPath}`));
        return;
      }

      // Ensure binary is executable
      try {
        fs.accessSync(binaryPath, fs.constants.X_OK);
        console.log(`Binary is executable: ${binaryPath}`);
      } catch (error) {
        console.warn(
          `Binary is not executable, attempting to make it executable: ${binaryPath}`,
        );
        try {
          // Make binary executable (chmod +x)
          fs.chmodSync(binaryPath, "755");
          console.log(`Made binary executable: ${binaryPath}`);
        } catch (chmodError) {
          console.error(`Failed to make binary executable:`, chmodError);
          reject(
            new Error(
              `Binary exists but lacks execute permissions. Please run: chmod +x "${binaryPath}"`,
            ),
          );
          return;
        }
      }

      const fullArgs = [command, ...args];
      const commandStr = `"${binaryPath}" ${fullArgs.map((arg) => `"${arg}"`).join(" ")}`;
      console.log(`Executing database command: ${commandStr}`);

      try {
        const { stdout, stderr } = await execPromise(commandStr, {
          encoding: "utf8",
          timeout: 15000, // 15 second timeout
          maxBuffer: 2 * 1024 * 1024, // 2MB buffer
        });

        if (stderr && stderr.trim() !== "") {
          console.warn(`Warning from command: ${stderr}`);
        }

        console.log(`Database command result length: ${stdout.length} chars`);
        resolve(stdout);
      } catch (execError: any) {
        console.error(`Database command failed:`, execError);

        // Handle specific error cases
        if (execError.code === "ENOENT") {
          reject(
            new Error(
              "Binary not found. Please ensure the cross-platform tool is properly installed.",
            ),
          );
        } else if (execError.signal === "SIGTERM") {
          reject(new Error("Database operation timed out"));
        } else {
          const errorMsg =
            execError.stderr || execError.message || "Unknown error";
          reject(new Error(`Database operation failed: ${errorMsg}`));
        }
      }
    } catch (error: any) {
      console.error(`Unexpected error in database command execution:`, error);
      reject(new Error(`Unexpected error: ${error.message}`));
    }
  });
}

/**
 * Parse database items from table format output
 * @param output The command output to parse
 * @returns Array of database items
 */
export function parseDbItemsFromOutput(
  output: string,
): { id: string; name: string; created_at: string }[] {
  if (!output || output.trim() === "") {
    return [];
  }

  try {
    const lines = output.trim().split("\n");
    const items: { id: string; name: string; created_at: string }[] = [];

    // Check if output is valid
    console.log(`Parsing output with ${lines.length} lines`);

    // Look for table data (skip headers and separators)
    let foundTable = false;
    for (let line of lines) {
      // Skip empty lines
      if (!line.trim()) {
        continue;
      }

      // If we find a line with ID | Name, we're in the table header
      if (line.includes("ID | Name")) {
        foundTable = true;
        continue;
      }

      // Skip separator lines
      if (line.includes("---")) {
        continue;
      }

      // If we're past the header and find a line with pipes, it's data
      if (foundTable && line.includes("|")) {
        const parts = line.split("|").map((p) => p.trim());
        if (parts.length >= 3 && parts[0] && parts[1]) {
          items.push({
            id: parts[0],
            name: parts[1],
            created_at: parts[2] || "Unknown",
          });
        }
      }
    }

    console.log(`Found ${items.length} items in output`);
    return items;
  } catch (error) {
    console.error("Error parsing database output:", error);
    return [];
  }
}

/**
 * Find an item by ID in the database output
 * @param output The command output to search
 * @param itemId The item ID to find
 * @returns The found item or undefined
 */
export function findItemById(
  output: string,
  itemId: string,
): { id: string; name: string; created_at: string } | undefined {
  const items = parseDbItemsFromOutput(output);
  return items.find((item) => item.id === itemId);
}
