import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import pg from "pg";
import { logger } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from server/.env only (or real environment variables).
const serverEnvPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(serverEnvPath)) {
  const loaded = dotenv.config({ path: serverEnvPath, override: false });
  if (!process.env.DATABASE_URL?.trim() && loaded.parsed?.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = loaded.parsed.DATABASE_URL.trim();
  }
}

if (!process.env.DATABASE_URL?.trim()) {
  logger.failure(
    "db",
    "DATABASE_URL is not set — set it in server/.env (local) or as an environment variable (production).",
  );
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
  throw new Error("DATABASE_URL is required. Set it in server/.env (see server/.env.example).");
}

const connectionString = process.env.DATABASE_URL;
export const pool = new pg.Pool({ connectionString });

pool.on("error", (err) => {
  logger.failure("db", `pool error: ${err.message}`);
});

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
  return Boolean(process.env.DATABASE_URL);
}
