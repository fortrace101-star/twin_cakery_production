import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { logger } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// server/ lives outside the frontend package, so resolve runtime deps
// (dotenv, pg) from the frontend's node_modules explicitly.
const requireFromFrontend = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "erp-interface-design", "package.json"),
);
const dotenvModule = requireFromFrontend("dotenv") as { config: () => void };
dotenvModule.config();

// If the runtime was started from the server folder, also load that .env so
// DATABASE_URL / APP_BASE_URL can live next to the server code.
const serverEnvPath = path.resolve(__dirname, ".env");
if (fs.existsSync(serverEnvPath)) {
  dotenvModule.config({ path: serverEnvPath });
}

dotenvModule.config({ path: serverEnvPath });

const pgModule = requireFromFrontend("pg") as typeof import("pg");
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

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query(text, params as unknown[] | undefined);
  return res.rows as T[];
}

export async function withTransaction<T>(fn: (client: TxClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx: TxClient = {
      query: async (text: string, params?: unknown[]) => {
        const res = await client.query(text, params as unknown[] | undefined);
        return res.rows as Record<string, unknown>[];
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

export interface TxClient {
  query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || connectionString);
}