import {
  CodeAnalysisResult,
  AnalyzeCodeFunction,
  FormatCodeFunction,
} from "../types/index.js";

/**
 * Analyze JavaScript/TypeScript code
 */
export const analyzeCode: AnalyzeCodeFunction = (
  code: string,
  fileName: string,
): CodeAnalysisResult => {
  const lines = code.split("\n");
  const functions: string[] = [];
  const classes: string[] = [];
  const variables: string[] = [];
  const dependencies: string[] = [];

  // Simple regex patterns for analysis
  const functionRegex =
    /(?:function\s+(\w+)|(\w+)\s*:\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{)|(?:async\s+)?(\w+)\s*\([^)]*\)\s*{|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)/g;
  const classRegex = /class\s+(\w+)/g;
  const variableRegex = /(?:const|let|var)\s+(\w+)/g;
  const importRegex =
    /(?:import.*from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;

  // Extract functions
  let match;
  while ((match = functionRegex.exec(code)) !== null) {
    const funcName = match[1] || match[2] || match[3] || match[4];
    if (funcName && !functions.includes(funcName)) {
      functions.push(funcName);
    }
  }

  // Extract classes
  while ((match = classRegex.exec(code)) !== null) {
    if (match[1] && !classes.includes(match[1])) {
      classes.push(match[1]);
    }
  }

  // Extract variables (excluding functions)
  while ((match = variableRegex.exec(code)) !== null) {
    const varName = match[1];
    if (
      varName &&
      !functions.includes(varName) &&
      !variables.includes(varName)
    ) {
      variables.push(varName);
    }
  }

  // Extract dependencies
  while ((match = importRegex.exec(code)) !== null) {
    const dep = match[1] || match[2];
    if (dep && !dependencies.includes(dep)) {
      dependencies.push(dep);
    }
  }

  // Calculate complexity (simple heuristic)
  const complexityKeywords =
    /\b(if|else|while|for|switch|case|catch|&&|\|\||\?)\b/g;
  const complexity = Math.max(1, (code.match(complexityKeywords) || []).length);

  return {
    fileName,
    functions,
    classes,
    variables,
    dependencies,
    complexity,
    lines: lines.length,
  };
};

/**
 * Format JavaScript/TypeScript code
 */
export const formatCode: FormatCodeFunction = (code: string): string => {
  // Simple formatting implementation
  const lines = code.split("\n");
  let indentLevel = 0;
  const formattedLines: string[] = [];

  for (let line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      formattedLines.push("");
      continue;
    }

    // Decrease indent for closing braces
    if (
      trimmed.startsWith("}") ||
      trimmed.startsWith("]") ||
      trimmed.startsWith(")")
    ) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // Add proper indentation
    const indent = "  ".repeat(indentLevel);
    formattedLines.push(indent + trimmed);

    // Increase indent for opening braces
    if (
      trimmed.endsWith("{") ||
      trimmed.endsWith("[") ||
      trimmed.endsWith("(")
    ) {
      indentLevel++;
    }
  }

  return formattedLines.join("\n");
};
