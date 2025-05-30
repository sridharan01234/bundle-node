/**
 * Interface for the VS Code API
 */
export interface VSCodeApi<T = unknown> {
  /**
   * Post a message to the VS Code extension
   */
  postMessage(message: any): void;

  /**
   * Get the persistent state stored for this webview
   */
  getState(): T | undefined;

  /**
   * Set the persistent state stored for this webview
   */
  setState<K extends keyof T>(state: Pick<T, K>): void;
}

/**
 * Database item interface
 */
export interface DatabaseItem {
  id: string;
  name: string;
  created_at: string;
}

/**
 * Item details with additional metadata
 */
export interface ItemDetails extends DatabaseItem {
  length: number;
  words: number;
}

/**
 * Messages from VS Code extension to webview
 */
export type VSCodeMessage =
  | { command: "showLoading"; message?: string }
  | { command: "updateItems"; success: boolean; items?: string; error?: string }
  | { command: "showSuccess"; message: string }
  | { command: "showError"; message: string }
  | { command: "showInfo"; message: string }
  | { command: "showItemDetails"; details: ItemDetails };

/**
 * Messages from webview to VS Code extension
 */
export type WebviewMessage =
  | { command: "refresh" }
  | { command: "initDatabase" }
  | { command: "addItem"; itemName: string }
  | { command: "deleteItem"; itemId: string }
  | { command: "updateItem"; itemId: string; newName: string }
  | { command: "clearDatabase" }
  | { command: "exportData" }
  | { command: "viewItemDetails"; itemId: string };
