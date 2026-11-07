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
    logger.failure("db", "DATABASE_URL is not set — set it in server/.env (local) or as an environment variable (production).");
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
    }
    catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
    }
    finally {
        client.release();
    }
}
export function isDatabaseConfigured() {
    return Boolean(process.env.DATABASE_URL);
}
//# sourceMappingURL=db.js.map