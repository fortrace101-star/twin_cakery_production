import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { logger } from "../utils/logger.cjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const requireFromFrontend = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "erp-interface-design", "package.json"),
);
const dotenvModule = requireFromFrontend("dotenv");
dotenvModule.config();

const serverEnvPath = path.resolve(__dirname, ".env");
if (fs.existsSync(serverEnvPath)) {
  dotenvModule.config({ path: serverEnvPath });
}

dotenvModule.config({ path: serverEnvPath });

const pgModule = requireFromFrontend("pg");
const { Pool } = pgModule;

if (!process.env.DATABASE_URL) {
  logger.failure("db", "DATABASE_URL is not set — copy server/.env.example to server/.env and set it");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Set it in server/.env (see server/.env.example).");
}
export const pool = new Pool({ connectionString });

pool.on("error", (err) => {
  logger.failure("db", `pool error: ${err.message}`);
});

// Intentionally unused: request logging lives in server/index.ts as a single
// line per HTTP request; the pool stays silent.

// SQL text is deliberately never logged: raw statements are noisy and can leak
// schema/PII into console + log drains. Request logging lives in
// server/index.ts as a single line per HTTP request; the pool stays silent.

export async function query(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx = {
      query: async (text, params) => {
        const res = await client.query(text, params);
        return res.rows;
      },
    };
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL || connectionString);
}
