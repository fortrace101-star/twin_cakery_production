import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load server/.env BEFORE importing ./db.js (ESM imports are hoisted).
// Respect a real env-provided DATABASE_URL, but fill it when missing/empty.
// Try multiple locations so it works from source (server/database/*),
// compiled output (server/dist/database/*), and when cwd is server/.
for (const candidate of [
    path.resolve(__dirname, "..", ".env"),
    path.resolve(__dirname, "../..", ".env"),
    path.resolve(process.cwd(), ".env"),
]) {
    if (!fs.existsSync(candidate))
        continue;
    const loaded = dotenv.config({ path: candidate, override: false });
    if (!process.env.DATABASE_URL?.trim() && loaded.parsed?.DATABASE_URL?.trim()) {
        process.env.DATABASE_URL = loaded.parsed.DATABASE_URL.trim();
    }
    if (process.env.DATABASE_URL?.trim())
        break;
}
const { pool } = await import("./db.js");
// Source: server/database -> server/migrations. Compiled: dist/database -> dist/migrations.
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");
async function ensureMigrationsTable() {
    await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
}
async function appliedNames() {
    const res = await pool.query(`SELECT name FROM _migrations`);
    return new Set(res.rows.map((r) => r.name));
}
export async function migrate() {
    await ensureMigrationsTable();
    const applied = await appliedNames();
    const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort();
    const done = [];
    for (const file of files) {
        if (applied.has(file))
            continue;
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(sql);
            await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
            await client.query("COMMIT");
            done.push(file);
            console.log(`[migrate] applied ${file}`);
        }
        catch (err) {
            await client.query("ROLLBACK");
            console.error(`[migrate] failed ${file}`, err);
            throw err;
        }
        finally {
            client.release();
        }
    }
    if (done.length === 0)
        console.log("[migrate] up to date");
    return done;
}
const invokedDirectly = process.argv[1] !== undefined &&
    path.resolve(process.argv[1]) === path.resolve(__filename);
if (invokedDirectly) {
    migrate()
        .then(() => pool.end())
        .catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=migrate.js.map