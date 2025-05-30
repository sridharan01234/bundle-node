import * as React from "react";
import { DatabaseItem } from "../DatabaseApp";

interface ItemsTableProps {
  items: DatabaseItem[];
  onEdit: (itemId: string, currentName: string) => void;
  onDelete: (itemId: string, itemName: string) => void;
  onViewDetails: (itemId: string) => void;
}

export const ItemsTable: React.FC<ItemsTableProps> = ({
  items,
  onEdit,
  onDelete,
  onViewDetails,
}) => {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h3>No items found</h3>
        <p>
          Add your first item using the form above or initialize the database.
        </p>
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Created At</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.id}</td>
            <td>{item.name}</td>
            <td>{item.created_at}</td>
            <td>
              <div className="item-actions">
                <button onClick={() => onEdit(item.id, item.name)}>Edit</button>
                <button onClick={() => onViewDetails(item.id)}>View</button>
                <button onClick={() => onDelete(item.id, item.name)}>
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
