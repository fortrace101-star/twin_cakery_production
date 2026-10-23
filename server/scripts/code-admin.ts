// server/scripts/code-admin.ts
// Mint an Admin Code (CLI-only). Prints plaintext once.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requireFromFrontend = createRequire(
  path.resolve(__dirname, "..", "..", "erp-interface-design", "package.json"),
);
const dotenvModule = requireFromFrontend("dotenv") as { config: (opts?: unknown) => void };
dotenvModule.config({ path: path.resolve(__dirname, "..", "..", ".env") });

import { pool } from "../database/db.js";

async function main() {
  const segments = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  const code = `TWIN-ADM-${segments()}-${segments()}`;
  const hash = crypto.createHash("sha256").update(code).digest("hex");

  await pool.query(
    `INSERT INTO activation_codes (id, code, type, created_at, expires_at)
     VALUES ($1, $2, 'admin', now(), now() + interval '7 days')`,
    [uuidv4(), hash],
  );

  console.log("=== ADMIN CODE (save this — shown once) ===");
  console.log(`  ${code}`);
  console.log("===========================================");

  await pool.end();
}

main().catch((err) => { console.error("Failed:", err); process.exit(1); });