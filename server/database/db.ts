import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { logger } from "../utils/logger.js";

// server/ lives outside the frontend package, so resolve runtime deps
// (dotenv, pg) from the frontend's node_modules explicitly.
const requireFromFrontend = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "erp-interface-design", "package.json"),
);
const dotenvModule = requireFromFrontend("dotenv") as { config: () => void };
dotenvModule.config();

const pgModule = requireFromFrontend("pg") as typeof import("pg");
const { Pool } = pgModule;

const connectionString =
  process.env.DATABASE_URL || "postgres://postgres:90210@localhost:5432/twin_cakery";

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