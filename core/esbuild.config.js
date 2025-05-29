import { build } from "esbuild";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { copyFileSync, mkdirSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const config = {
  entryPoints: [join(__dirname, "src/cli.ts")],
  bundle: true,
  platform: "node",
  target: "node16",
  format: "cjs",
  outfile: join(__dirname, "dist/cli.cjs"), // Changed to .cjs extension
  external: ["sqlite3", "node-loader"],
  minify: false,
  sourcemap: false,
  treeShaking: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
};

try {
  // Ensure dist directory exists
  const distDir = join(__dirname, "dist");
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  // Build the main TypeScript file
  await build(config);

  console.log("Build completed successfully!");
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
