import * as React from "react";

interface ActionsPanelProps {
  onAddItem: () => void;
  onRefresh: () => void;
  onInitDatabase: () => void;
  onClearDatabase: () => void;
  onExportData: () => void;
  newItemName: string;
  setNewItemName: (value: string) => void;
}

export const ActionsPanel: React.FC<ActionsPanelProps> = ({
  onAddItem,
  onRefresh,
  onInitDatabase,
  onClearDatabase,
  onExportData,
  newItemName,
  setNewItemName,
}) => {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onAddItem();
    }
  };

  return (
    <div className="actions">
      <div className="row" style={{ marginRight: "10px" }}>
        <input
          type="text"
          placeholder="Enter item name"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyPress={handleKeyPress}
          style={{ marginRight: "5px" }}
        />
        <button onClick={onAddItem}>Add Item</button>
      </div>
      <button onClick={onRefresh}>Refresh</button>
      <button onClick={onInitDatabase}>Initialize Database</button>
      <button onClick={onClearDatabase}>Clear All</button>
      <button onClick={onExportData}>Export Data</button>
    </div>
  );
};
