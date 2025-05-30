import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { VSCodeMessage, VSCodeApi } from "../vscodeTypes";

// Import components
import { StatusBar } from "./components/StatusBar";
import { ActionsPanel } from "./components/ActionsPanel";
import { ItemsTable } from "./components/ItemsTable";
import { LoadingIndicator } from "./components/LoadingIndicator";

// Import types
export interface DatabaseItem {
  id: string;
  name: string;
  created_at: string;
}

export interface ItemDetails extends DatabaseItem {
  length: number;
  words: number;
}

interface VSCodeState {
  items: DatabaseItem[];
}

// Extend the globalThis type to include our _vscodeApi property
declare global {
  interface Window {
    _vscodeApi?: VSCodeApi;
  }
  var _vscodeApi: VSCodeApi | undefined;
}

// Get VS Code API
declare function acquireVsCodeApi(): VSCodeApi;
// Ensure we only call acquireVsCodeApi() once
const vscode = (function () {
  // Check if we already have a reference to the VS Code API
  if (typeof globalThis._vscodeApi !== "undefined") {
    return globalThis._vscodeApi;
  }
  // Otherwise acquire it and store it on the global object
  globalThis._vscodeApi = acquireVsCodeApi();
  return globalThis._vscodeApi;
})();

export const DatabaseApp: React.FC = () => {
  // State
  const [items, setItems] = useState<DatabaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Loading database items...",
  );
  const [statusType, setStatusType] = useState<"info" | "success" | "error">(
    "info",
  );
  const [newItemName, setNewItemName] = useState("");

  // Handle messages from the extension
  const handleMessage = useCallback((event: MessageEvent) => {
    const message = event.data as VSCodeMessage;
    console.log("Received message:", message);

    switch (message.command) {
      case "showLoading":
        setIsLoading(true);
        setStatusMessage(message.message || "Loading...");
        setStatusType("info");
        break;

      case "updateItems":
        setIsLoading(false);
        if (message.success && message.items) {
          try {
            // Try to parse items
            if (typeof message.items === "string") {
              try {
                const parsedItems = JSON.parse(message.items);
                setItems(parsedItems);

                if (parsedItems.length > 0) {
                  setStatusMessage(`Loaded ${parsedItems.length} items`);
                  setStatusType("success");
                  setTimeout(() => setStatusMessage(""), 3000);
                } else {
                  setStatusMessage(
                    "No items found. Add an item or initialize the database.",
                  );
                  setStatusType("info");
                }
              } catch (jsonError) {
                console.error("Error parsing items:", jsonError);
                setItems([]);
                setStatusMessage(
                  `Error parsing data: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`,
                );
                setStatusType("error");
              }
            } else {
              setItems([]);
              setStatusMessage("Invalid data format received");
              setStatusType("error");
            }
          } catch (err) {
            console.error("Error processing items:", err);
            setStatusMessage(
              `Error processing data: ${err instanceof Error ? err.message : String(err)}`,
            );
            setStatusType("error");
            setItems([]);
          }
        } else {
          setItems([]);
          setStatusMessage(message.error || "Failed to load items");
          setStatusType("error");
        }
        break;

      case "showSuccess":
        setStatusMessage(message.message || "");
        setStatusType("success");
        setIsLoading(false);
        setTimeout(() => setStatusMessage(""), 3000);
        break;

      case "showError":
        setStatusMessage(message.message || "");
        setStatusType("error");
        setIsLoading(false);
        break;

      case "showInfo":
        setStatusMessage(message.message || "");
        setStatusType("info");
        break;

      case "showItemDetails":
        if (message.details) {
          // In a real app, you might want a modal component instead of an alert
          alert(
            `Item Details:\n\n` +
              `ID: ${message.details.id}\n` +
              `Name: ${message.details.name}\n` +
              `Created: ${message.details.created_at}\n` +
              `Character Length: ${message.details.length}\n` +
              `Word Count: ${message.details.words}`,
          );
        }
        break;
    }
  }, []);

  // Setup message listener
  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Initialize by refreshing items
  useEffect(() => {
    refreshItems();
  }, []);

  // Actions
  function refreshItems() {
    setStatusMessage("Refreshing items...");
    setStatusType("info");
    setIsLoading(true);

    vscode.postMessage({
      command: "refresh",
    });
  }

  function initDatabase() {
    if (confirm("Are you sure you want to initialize the database?")) {
      setStatusMessage("Initializing database...");
      setStatusType("info");
      setIsLoading(true);

      vscode.postMessage({
        command: "initDatabase",
      });
    }
  }

  function clearDatabase() {
    if (
      confirm(
        "Are you sure you want to clear all items? This cannot be undone.",
      )
    ) {
      setStatusMessage("Clearing database...");
      setStatusType("info");
      setIsLoading(true);

      vscode.postMessage({
        command: "clearDatabase",
      });
    }
  }

  function exportData() {
    setStatusMessage("Exporting data...");
    setStatusType("info");

    vscode.postMessage({
      command: "exportData",
    });
  }

  function addItem() {
    const name = newItemName.trim();

    if (!name) {
      setStatusMessage("Please enter an item name");
      setStatusType("error");
      return;
    }

    setStatusMessage("Adding item...");
    setStatusType("info");
    setIsLoading(true);

    vscode.postMessage({
      command: "addItem",
      itemName: name,
    });

    setNewItemName("");
  }

  function deleteItem(itemId: string, itemName: string) {
    if (confirm(`Are you sure you want to delete "${itemName}"?`)) {
      setStatusMessage("Deleting item...");
      setStatusType("info");
      setIsLoading(true);

      vscode.postMessage({
        command: "deleteItem",
        itemId,
      });
    }
  }

  function editItem(itemId: string, currentName: string) {
    const newName = prompt("Enter new name for item:", currentName);

    if (newName && newName.trim() && newName !== currentName) {
      setStatusMessage("Updating item...");
      setStatusType("info");
      setIsLoading(true);

      vscode.postMessage({
        command: "updateItem",
        itemId,
        newName: newName.trim(),
      });
    }
  }

  function viewItemDetails(itemId: string) {
    setStatusMessage("Loading item details...");
    setStatusType("info");

    vscode.postMessage({
      command: "viewItemDetails",
      itemId,
    });
  }

  return (
    <div className="container">
      <h1>SQLite Database Manager</h1>
      <p>Manage your database items through the bundled SQLite binary.</p>

      <StatusBar message={statusMessage} type={statusType} />

      <ActionsPanel
        onAddItem={addItem}
        onRefresh={refreshItems}
        onInitDatabase={initDatabase}
        onClearDatabase={clearDatabase}
        onExportData={exportData}
        newItemName={newItemName}
        setNewItemName={setNewItemName}
      />

      {isLoading ? (
        <LoadingIndicator />
      ) : (
        <ItemsTable
          items={items}
          onEdit={editItem}
          onDelete={deleteItem}
          onViewDetails={viewItemDetails}
        />
      )}
    </div>
  );
};

export default DatabaseApp;
