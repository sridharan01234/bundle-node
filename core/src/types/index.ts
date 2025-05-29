/**
 * SQLite3 Database Instance Interface
 */
export interface SQLite3DatabaseInstance {
  run(sql: string, params?: any, callback?: (err: Error | null) => void): this;
  run(sql: string, callback?: (err: Error | null) => void): this;
  get(sql: string, callback: (err: Error | null, row?: any) => void): this;
  get(
    sql: string,
    params: any,
    callback: (err: Error | null, row?: any) => void,
  ): this;
  all<T = any>(
    sql: string,
    params: any[],
    callback: (err: Error | null, rows: T[]) => void,
  ): this;
  serialize(callback: () => void): void;
  prepare(sql: string): SQLite3Statement;
  close(callback?: (err: Error | null) => void): void;
}

/**
 * SQLite3 Statement Interface
 */
export interface SQLite3Statement {
  run(params: any, callback?: (err: Error | null) => void): this;
  finalize(callback?: (err: Error | null) => void): void;
}

/**
 * Database Item Row Interface
 */
export interface ItemRow {
  id: number;
  name: string;
  created_at: string;
}

/**
 * Code Analysis Result Interface
 */
export interface CodeAnalysisResult {
  fileName: string;
  functions: string[];
  classes: string[];
  variables: string[];
  dependencies: string[];
  complexity: number;
  lines: number;
}

/**
 * Server Request Body Interface
 */
export interface ServerRequestBody {
  filePath?: string;
  securityToken: string;
  code?: string;
  saveToFile?: boolean;
}

/**
 * Command Handler Function Type
 */
export type CommandHandler = (args: string[]) => void | Promise<void>;

/**
 * Code Analysis Function Type
 */
export type AnalyzeCodeFunction = (
  code: string,
  fileName: string,
) => CodeAnalysisResult;

/**
 * Code Formatting Function Type
 */
export type FormatCodeFunction = (code: string) => string;
