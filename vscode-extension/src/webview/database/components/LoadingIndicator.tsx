import * as React from "react";

export const LoadingIndicator: React.FC = () => {
  return (
    <div className="loading">
      <div className="spinner" />
      Loading data...
    </div>
  );
};
