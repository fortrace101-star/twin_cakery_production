import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(__dirname, "..", "migrations");
const dest = path.resolve(__dirname, "..", "dist", "migrations");

fs.mkdirSync(dest, { recursive: true });
if (!fs.existsSync(src)) {
  console.log("[copy-migrations] no migrations dir found, skipping");
  process.exit(0);
}
const files = fs.readdirSync(src).filter((f) => f.endsWith(".sql"));
for (const f of files) {
  fs.copyFileSync(path.join(src, f), path.join(dest, f));
}
console.log(`[copy-migrations] copied ${files.length} migration(s) to dist/migrations`);
