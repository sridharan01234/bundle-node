import * as React from "react";
import * as ReactDOM from "react-dom";
import { DatabaseApp } from "./DatabaseApp";

// Initialize React app when the document is ready
document.addEventListener("DOMContentLoaded", () => {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    ReactDOM.render(<DatabaseApp />, rootElement);
  }
});
