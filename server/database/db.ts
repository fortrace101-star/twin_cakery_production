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
  logger.error("db", "pool error", { error: err.message });
});

/** Collapse a SQL statement to one line and cap its length for log readability. */
function summarizeSql(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 300 ? `${oneLine.slice(0, 297)}...` : oneLine;
}

function elapsedMs(startedAt: bigint): string {
  return `${(Number(process.hrtime.bigint() - startedAt) / 1e6).toFixed(1)}ms`;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const startedAt = process.hrtime.bigint();
  const sql = summarizeSql(text);
  try {
    const res = await pool.query(text, params as unknown[] | undefined);
    const rows = res.rowCount ?? res.rows.length;
    logger.info("db", `query ${sql}`, {
      rows,
      params: params?.length ? params : undefined,
      durationMs: elapsedMs(startedAt),
    });
    return res.rows as T[];
  } catch (err) {
    logger.error("db", `query failed ${sql}`, {
      error: err instanceof Error ? err.message : String(err),
      params: params?.length ? params : undefined,
      durationMs: elapsedMs(startedAt),
    });
    throw err;
  }
}

export async function withTransaction<T>(fn: (client: TxClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  const startedAt = process.hrtime.bigint();
  logger.info("db", "transaction BEGIN");
  try {
    await client.query("BEGIN");
    const tx: TxClient = {
      query: async (text: string, params?: unknown[]) => {
        const txStartedAt = process.hrtime.bigint();
        const sql = summarizeSql(text);
        try {
          const res = await client.query(text, params as unknown[] | undefined);
          logger.info("db", `tx query ${sql}`, {
            rows: res.rowCount ?? res.rows.length,
            params: params?.length ? params : undefined,
            durationMs: elapsedMs(txStartedAt),
          });
          return res.rows as Record<string, unknown>[];
        } catch (err) {
          logger.error("db", `tx query failed ${sql}`, {
            error: err instanceof Error ? err.message : String(err),
            params: params?.length ? params : undefined,
            durationMs: elapsedMs(txStartedAt),
          });
          throw err;
        }
      },
    };
    const result = await fn(tx);
    await client.query("COMMIT");
    logger.info("db", `transaction COMMIT (${elapsedMs(startedAt)})`);
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    logger.error("db", `transaction ROLLBACK (${elapsedMs(startedAt)})`, {
      error: err instanceof Error ? err.message : String(err),
    });
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
