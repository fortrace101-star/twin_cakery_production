import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import pg from "pg";
import { logger } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from server/.env only (or real environment variables).
// Try multiple locations so it works from source (server/database/*),
// compiled output (server/dist/database/*), and when cwd is server/.
for (const candidate of [
  path.resolve(__dirname, "..", ".env"),
  path.resolve(__dirname, "../..", ".env"),
  path.resolve(process.cwd(), ".env"),
]) {
  if (!fs.existsSync(candidate)) continue;
  const loaded = dotenv.config({ path: candidate, override: false });
  if (!process.env.DATABASE_URL?.trim() && loaded.parsed?.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = loaded.parsed.DATABASE_URL.trim();
  }
  if (process.env.DATABASE_URL?.trim()) break;
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

const connectionString = process.env.DATABASE_URL?.trim() as string;

function resolveSsl(conn: string): pg.PoolConfig["ssl"] | undefined {
  // Explicit override: DATABASE_SSL=require|true -> require TLS (no cert verification,
  // common for managed Postgres). DATABASE_SSL=disable|false -> no TLS.
  const explicit = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (explicit === "disable" || explicit === "false" || explicit === "0") return undefined;
  if (explicit === "require" || explicit === "true" || explicit === "1" || explicit === "no-verify") {
    return { rejectUnauthorized: false };
  }
  if (explicit === "verify") return { rejectUnauthorized: true };

  let sslmode = process.env.PGSSLMODE?.trim().toLowerCase();
  let hostname = "";
  try {
    const u = new URL(conn);
    sslmode = (u.searchParams.get("sslmode") || sslmode || "").toLowerCase();
    hostname = u.hostname;
  } catch {
    // connection string may be in keyword format; fall through to env-based decision
  }

  if (sslmode === "disable") return undefined;
  if (sslmode === "require" || sslmode === "prefer") return { rejectUnauthorized: false };
  if (sslmode === "verify-ca" || sslmode === "verify-full") return { rejectUnauthorized: true };

  // No sslmode specified: require TLS for non-local hosts (managed DBs) to avoid
  // "SSL/TLS required" failures; keep local dev simple.
  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "";
  if (!local) return { rejectUnauthorized: false };
  return undefined;
}

export const pool = new pg.Pool({ connectionString, ssl: resolveSsl(connectionString) });

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
