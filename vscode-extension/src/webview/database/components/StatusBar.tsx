import * as React from "react";

interface StatusBarProps {
  message: string;
  type: "info" | "success" | "error";
}

export const StatusBar: React.FC<StatusBarProps> = ({ message, type }) => {
  if (!message) {
    return null;
  }

  return <div className={`status ${type}`}>{message}</div>;
};
