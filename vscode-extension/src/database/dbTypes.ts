/**
 * Database item interface
 */
export interface DbItem {
  id: string;
  name: string;
  created_at: string;
}

/**
 * Item details with additional metadata
 */
export interface ItemDetails extends DbItem {
  length: number;
  words: number;
}

/**
 * Message to be sent to webview
 */
export interface WebviewMessage {
  command: string;
  [key: string]: any;
}

/**
 * Message response from database operation
 */
export interface DbResponseMessage {
  command: string;
  success?: boolean;
  message?: string;
  error?: string;
  items?: string;
  details?: ItemDetails;
}
