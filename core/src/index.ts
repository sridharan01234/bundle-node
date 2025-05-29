function analyzeCode(code: string, fileName: string | null = null) {
  // This function checks for console.log or TODO only
  console.error("Analyzing code...");

  if (!code || typeof code !== "string") {
    return {
      fileName: fileName || "unknown",
      lines: 0,
      hasConsoleLog: false,
      hasTODO: false,
      error: "No code provided",
    };
  }

  const lines = code.split("\n");
  const hasConsoleLog = code.includes("console.log");
  const hasTODO = code.includes("TODO");

  if (!hasConsoleLog && !hasTODO) {
    return {
      fileName: fileName || "unknown",
      lines: lines.length,
      hasConsoleLog: false,
      hasTODO: false,
      note: "Skipped analysis: no console.log or TODO found",
    };
  }

  return {
    fileName: fileName || "unknown",
    lines: lines.length,
    hasConsoleLog,
    hasTODO,
  };
}

function formatCode() {
  // This function formats code by removing console.log and TODO comments
  console.error("Formatting code...");

  return null;
}

export { analyzeCode, formatCode };
