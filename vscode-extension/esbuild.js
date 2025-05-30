const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const buildDir = path.join(__dirname, "out", "webview-dist");

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Bundle the React application
esbuild.buildSync({
  entryPoints: [
    path.join(__dirname, "src", "webview", "database", "index.tsx"),
  ],
  bundle: true,
  minify: true,
  sourcemap: true,
  format: "esm",
  outfile: path.join(buildDir, "database-bundle.js"),
  external: ["vscode"],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
