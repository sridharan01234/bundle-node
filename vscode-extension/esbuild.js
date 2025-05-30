const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

// Since we're no longer using React, we can remove the webview build process
// The webview is now pure HTML/CSS/JS embedded in the webviewUtils.ts file

console.log("No webview bundling needed - using inline HTML/CSS/JS approach");
console.log("Extension compilation handled by TypeScript compiler");
