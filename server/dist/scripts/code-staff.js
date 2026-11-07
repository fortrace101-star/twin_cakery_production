// server/scripts/code-staff.ts
// Mint a Staff Register Code (CLI-only). Prints plaintext once.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import crypto from "node:crypto";
import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
import { pool } from "../database/db.js";
async function main() {
    const segments = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `TWIN-STF-${segments()}-${segments()}`;
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    await pool.query(`INSERT INTO activation_codes (id, code, type, created_at, expires_at)
     VALUES ($1, $2, 'staff', now(), now() + interval '7 days')`, [uuidv4(), hash]);
    console.log("=== STAFF REGISTER CODE (save this — shown once) ===");
    console.log(`  ${code}`);
    console.log("===================================================");
    await pool.end();
}
main().catch((err) => { console.error("Failed:", err); process.exit(1); });
//# sourceMappingURL=code-staff.js.map