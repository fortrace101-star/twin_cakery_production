// server/scripts/reset-production.ts
// Production wipe script — resets the database to factory state while
// preserving structure, roles, permissions, and _migrations.

import readline from "node:readline";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requireFromFrontend = createRequire(
  path.resolve(__dirname, "..", "..", "erp-interface-design", "package.json"),
);
const dotenvModule = requireFromFrontend("dotenv") as { config: (opts?: unknown) => void };
dotenvModule.config({ path: path.resolve(__dirname, "..", "..", ".env") });

import { pool } from "../database/db.js";

const TABLES_TO_TRUNCATE = [
  "users", "user_roles", "customers", "customer_addresses", "customer_interactions",
  "customer_feedback", "inquiries", "quotations", "quotation_items", "orders",
  "order_items", "order_status_history", "products", "product_categories",
  "recipes", "recipe_ingredients", "inventory_items", "inventory_transactions",
  "suppliers", "purchase_orders", "purchase_order_items", "payments", "expenses",
  "deliveries", "notifications", "notification_recipients",
  "notification_preferences", "notification_templates", "audit_logs", "staff",
  "staff_attendance", "staff_advances",
  "remuneration_periods", "remuneration_items", "remuneration_payments", "blog_posts", "blog_categories",
  "website_users", "activation_codes",
];

const KEEP_TABLES = ["roles", "permissions", "role_permissions", "_migrations", "expense_categories"];


function parseArgs(): { confirm: string; force: boolean } {
  const args = process.argv.slice(2);
  let confirm = process.env.WIPE_CONFIRM ?? "";
  let force = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--confirm") {
      const parts: string[] = [];
      i++;
      while (i < args.length && !args[i].startsWith("--")) {
        parts.push(args[i]);
        i++;
      }
      i--;
      confirm = parts.join(" ");
    } else if (args[i] === "--force") { force = true; }
  }
  return { confirm, force };
}

async function askConfirm(): Promise<string> {
  if (process.env.WIPE_CONFIRM) return process.env.WIPE_CONFIRM;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Type "WIPE PRODUCTION" to confirm (or set WIPE_CONFIRM env var): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function tableExists(name: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`, [name],
  );
  return res.rows.length > 0;
}

async function countRows(table: string): Promise<number> {
  if (!(await tableExists(table))) return 0;
  const res = await pool.query(`SELECT COUNT(*)::int AS c FROM "${table}"`);
  return (res.rows[0] as { c: number }).c;
}

async function main() {
  const { confirm: argConfirm, force } = parseArgs();
  let confirm = argConfirm;
  if (!confirm) {
    confirm = await askConfirm();
  }

  if (confirm !== "WIPE PRODUCTION") {
    console.error('ERROR: Must pass --confirm "WIPE PRODUCTION"');
    console.error('Usage: npm run wipe -- --confirm "WIPE PRODUCTION"');
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production" && !force) {
    console.error("ERROR: NODE_ENV is production. Pass --force to override.");
    process.exit(1);
  }

  console.log("=== Twin Cakery ERP — Production Wipe ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV ?? "(unset)"}`);
  console.log("");

  const hasActivationCodes = await tableExists("activation_codes");
  const hasPasswordHash = (await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash'`,
  )).rows.length > 0;

  if (!hasActivationCodes || !hasPasswordHash) {
    console.warn("WARNING: Migration 018 not applied. Admin Code minting skipped.");
    console.warn("         Run Phase B migration first, then re-run wipe.");
    console.log("");
  }

  console.log("Row counts BEFORE wipe:");
  const beforeCounts: Record<string, number> = {};
  for (const t of TABLES_TO_TRUNCATE) {
    beforeCounts[t] = await countRows(t);
    console.log(`  ${t}: ${beforeCounts[t]}`);
  }
  console.log("");

  const backupDir = path.resolve(__dirname, "..", "..", "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `pre-wipe-${ts}.sql`);
  const dbUrl = process.env.DATABASE_URL || "postgres://postgres:90210@localhost:5432/twin_cakery";

  try {
    execSync(`pg_dump "${dbUrl}" -f "${backupPath}"`, { stdio: "inherit" });
    console.log(`Backup created: ${backupPath}`);
  } catch (err) {
    console.warn("WARNING: pg_dump failed or not available. Skipping backup.");
    console.warn(`  ${(err as Error).message}`);
  }
  console.log("");

  console.log("Truncating transactional tables...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const t of TABLES_TO_TRUNCATE) {
      if (await tableExists(t)) {
        await client.query(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE`);
        console.log(`  Truncated: ${t}`);
      } else {
        console.log(`  Skipped (not found): ${t}`);
      }
    }
    await client.query("COMMIT");
    console.log("Truncate complete.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("TRUNCATE failed:", (err as Error).message);
    process.exit(1);
  } finally {
    client.release();
  }
  console.log("");

  console.log("Kept tables (should be non-empty):");
  for (const t of KEEP_TABLES) {
    console.log(`  ${t}: ${await countRows(t)} rows`);
  }
  console.log("");

  let adminCode: string | null = null;
  if (hasActivationCodes && hasPasswordHash) {
    const segments = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    adminCode = `TWIN-ADM-${segments()}-${segments()}`;
    const crypto = await import("node:crypto");
    const hash = crypto.createHash("sha256").update(adminCode).digest("hex");
    await pool.query(
      `INSERT INTO activation_codes (id, code, type, created_at, expires_at) VALUES ($1, $2, 'admin', now(), now() + interval '7 days')`,
      [ (await import("uuid")).v4(), hash ],
    );
    console.log("=== ADMIN CODE (save this — shown once) ===");
    console.log(`  ${adminCode}`);
    console.log("===========================================");
    console.log("");
  }

  const auditId = `audit-wipe-${Date.now()}`;
  await pool.query(
    `INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, reason, timestamp, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, now(), now(), now())`,
    [auditId, "system", "wipe_production", "system", "production", "Production wipe executed"],
  );
  console.log(`Audit log inserted: ${auditId} (action: wipe_production)`);

  console.log("");
  console.log("=== WIPE SUMMARY ===");
  console.log(`Tables truncated: ${TABLES_TO_TRUNCATE.length}`);
  console.log(`Backup: ${fs.existsSync(backupPath) ? backupPath : "(none)"}`);
  if (adminCode) { console.log(`Admin Code: ${adminCode}`); }
  else { console.log("Admin Code: (skipped — run Phase B migration first)"); }
  console.log("Server in-memory store must be restarted to reflect changes.");
  console.log("====================");

  await pool.end();
}

main().catch((err) => { console.error("Wipe failed:", err); process.exit(1); });
