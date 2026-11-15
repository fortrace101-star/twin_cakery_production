// server/scripts/repair-stuck-production-jobs.ts
//
// Repairs jobs left in `DONE` by the pre-fix "Mark Production Complete" bug.
// Such a job belongs to an order that is still IN_PRODUCTION, so it has no
// column the board recognises (the UI shows it as Queued) and no dialog action
// can move it forward. The repair puts the job back on the Decorating step; the
// order's station is derived from the job status, so it follows automatically
// and `Set to Ready` becomes available again.
//
// Usage (from server/):
//   npx tsx scripts/repair-stuck-production-jobs.ts                    # dry run, list every candidate
//   npx tsx scripts/repair-stuck-production-jobs.ts --order TC-1234     # dry run, one order
//   npx tsx scripts/repair-stuck-production-jobs.ts --apply --order TC-1234
//   npx tsx scripts/repair-stuck-production-jobs.ts --apply --all
//
// Safety:
// - `--apply` needs either `--order <order number>` or `--all`, so a bare run
//   never writes.
// - Refuses to write while the API is listening on PORT (it mirrors the whole
//   database in memory and flushes that cache back to the tables on every
//   write). Pass --force only if you know the API is pointed at another DB.
// - Takes a pg_dump snapshot into server/backups/ before writing when pg_dump
//   is available.
// - Writes inside one transaction and re-checks every row it touches.

import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { pool, withTransaction } from "../database/db.js";

interface Options {
  apply: boolean;
  all: boolean;
  force: boolean;
  orderNumber: string | null;
}

interface CandidateRow {
  job_id: string;
  order_id: string;
  order_number: string;
  job_status: string;
  job_stage: string;
  progress: number;
  order_status: string;
  required_by: string | null;
  updated_at: string;
}

const CANDIDATE_SQL = `
  SELECT j.id            AS job_id,
         j.order_id      AS order_id,
         o.order_number  AS order_number,
         j.status        AS job_status,
         j.stage         AS job_stage,
         j.progress      AS progress,
         o.status        AS order_status,
         o.required_by   AS required_by,
         j.updated_at    AS updated_at
  FROM production_jobs j
  JOIN orders o ON o.id = j.order_id
  WHERE j.status = 'DONE' AND o.status = 'IN_PRODUCTION'
    AND ($1::text IS NULL OR lower(o.order_number) = lower($1))
  ORDER BY o.required_by NULLS LAST, j.id`;

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const opts: Options = { apply: false, all: false, force: false, orderNumber: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--all") opts.all = true;
    else if (arg === "--force") opts.force = true;
    else if (arg === "--order") opts.orderNumber = args[++i] ?? null;
    else if (arg.startsWith("--order=")) opts.orderNumber = arg.slice("--order=".length);
    else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }
  if (opts.all && opts.orderNumber) {
    console.error("Pass either --order <order number> or --all, not both.");
    process.exit(1);
  }
  if (opts.apply && !opts.all && !opts.orderNumber) {
    console.error("--apply needs a target: pass --order <order number> or --all.");
    console.error("");
    printUsage();
    process.exit(1);
  }
  if (opts.orderNumber) opts.orderNumber = opts.orderNumber.trim();
  return opts;
}

function printUsage(): void {
  console.error("Usage: npx tsx scripts/repair-stuck-production-jobs.ts [--order <order number> | --all] [--apply] [--force]");
  console.error("");
  console.error("  (no flags)              dry run over every stuck job");
  console.error("  --order TC-1234         limit to one order number");
  console.error("  --apply                 write the repair (requires --order or --all)");
  console.error("  --force                 write even if the API is listening locally");
}

// Never print the password: only host + database, so you can confirm which
// database the .env currently points at before touching production.
function describeTarget(): { label: string; remote: boolean } {
  const raw = process.env.DATABASE_URL?.trim() ?? "";
  if (!raw) return { label: "(DATABASE_URL is not set)", remote: true };
  try {
    const url = new URL(raw);
    const db = url.pathname.replace(/^\//, "") || "(no database)";
    const host = url.hostname || "(no host)";
    const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
    return { label: `${host}:${url.port || 5432}/${db}`, remote: !local };
  } catch {
    return { label: "(unparseable DATABASE_URL)", remote: true };
  }
}

async function apiIsRunning(): Promise<boolean> {
  const port = Number(process.env.PORT || 4000);
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (up: boolean) => {
      socket.destroy();
      resolve(up);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(1500, () => done(false));
  });
}

function backup(): string | null {
  const dir = path.resolve(__dirname, "..", "backups");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `pre-repair-${stamp}.sql`);
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  try {
    execFileSync("pg_dump", ["--no-owner", "--no-privileges", "--file", file, url], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    return file;
  } catch (err) {
    const reason = (err as { code?: string }).code === "ENOENT" ? "pg_dump is not on PATH" : "pg_dump failed";
    console.warn(`WARNING: no backup taken (${reason}). Snapshot the database through your provider first if you need one.`);
    return null;
  }
}

async function fetchCandidates(orderNumber: string | null): Promise<CandidateRow[]> {
  const res = await pool.query<CandidateRow>(CANDIDATE_SQL, [orderNumber]);
  return res.rows;
}

async function siblingJobs(orderId: string): Promise<Array<{ id: string; status: string; stage: string; progress: number }>> {
  const res = await pool.query(
    `SELECT id, status, stage, progress FROM production_jobs WHERE order_id = $1 ORDER BY id`,
    [orderId],
  );
  return res.rows as Array<{ id: string; status: string; stage: string; progress: number }>;
}

async function setReadyPermissionExists(): Promise<boolean> {
  try {
    const res = await pool.query(`SELECT 1 FROM permissions WHERE key = 'production.set_ready'`);
    return res.rowCount !== null && res.rowCount > 0;
  } catch {
    return false;
  }
}

async function describeProductionOrders(): Promise<void> {
  const res = await pool.query(
    `SELECT o.order_number, o.status AS order_status, j.id AS job_id, j.status AS job_status,
            j.stage AS job_stage, j.progress
     FROM orders o
     LEFT JOIN production_jobs j ON j.order_id = o.id
     WHERE o.status = 'IN_PRODUCTION'
     ORDER BY o.order_number, j.id
     LIMIT 40`,
  );
  if (res.rows.length === 0) {
    console.log("  (no orders are currently IN_PRODUCTION in this database)");
    return;
  }
  let current = "";
  for (const row of res.rows as Array<Record<string, string | number | null>>) {
    const orderNumber = String(row.order_number);
    if (orderNumber !== current) {
      console.log(`  ${orderNumber}  (order status: ${row.order_status})`);
      current = orderNumber;
    }
    if (row.job_id) {
      console.log(`    job ${row.job_id}: ${row.job_status} / ${row.job_stage} / ${row.progress}%`);
    } else {
      console.log("    (no production job)");
    }
  }
}

async function main(): Promise<void> {
  const opts = parseArgs();
  const target = describeTarget();

  console.log("=== Twin Cakery ERP — repair stuck production jobs ===");
  console.log(`Target DB: ${target.label}${target.remote ? "  (REMOTE)" : "  (local)"}`);
  console.log(`Mode:      ${opts.apply ? "APPLY (writes)" : "dry run (no writes)"}${opts.orderNumber ? `, order ${opts.orderNumber}` : ""}${opts.all ? ", all orders" : ""}`);
  console.log("");

  const candidates = await fetchCandidates(opts.orderNumber);
  if (candidates.length === 0) {
    console.log("No stuck jobs found (no job is DONE while its order is still IN_PRODUCTION).");
    console.log("");
    console.log("Orders currently IN_PRODUCTION and their jobs:");
    await describeProductionOrders();
    console.log("");
    console.log("Nothing was written. If the order you mean is not listed above, check that");
    console.log("server/.env points at the database you expect (see Target DB).");
    return;
  }

  console.log(`Stuck jobs found: ${candidates.length}`);
  for (const c of candidates) {
    console.log("");
    console.log(`  order ${c.order_number} (order status ${c.order_status}, due ${c.required_by ?? "n/a"})`);
    console.log(`    job ${c.job_id}: ${c.job_status} / ${c.job_stage} / ${c.progress}%  ->  DECORATING / QC / 80%`);
    const siblings = await siblingJobs(c.order_id);
    if (siblings.length > 1) {
      for (const s of siblings) {
        const marker = s.id === c.job_id ? "  (this job)" : "";
        console.log(`    other job on this order: ${s.id}: ${s.status} / ${s.stage} / ${s.progress}%${marker}`);
      }
    }
  }
  console.log("");

  if (!opts.apply) {
    console.log("Dry run — nothing was written. Each candidate would run:");
    for (const c of candidates) {
      console.log(`  UPDATE production_jobs SET status='DECORATING', stage='QC', progress=80, updated_at=now() WHERE id='${c.job_id}' AND status='DONE';`);
    }
    console.log("");
    console.log("Re-run with --apply (plus --order <order number> or --all) to write the repair.");
    return;
  }

  if (await apiIsRunning()) {
    console.error(`ERROR: the API is listening on port ${process.env.PORT || 4000}.`);
    console.error("");
    console.error("The API keeps the database in memory and flushes that cache back to the");
    console.error("tables on every write, so a repair made underneath it can be overwritten.");
    console.error("Stop it first, run this script, then start it again.");
    console.error("");
    if (!opts.force) {
      console.error("Re-run with --force only if that API process points at a different database.");
      process.exit(1);
    }
    console.warn("WARNING: --force passed — applying while the API is running.");
    console.warn("");
  }

  if (target.remote) {
    console.log("Remote target confirmed; taking a snapshot before writing...");
    const file = backup();
    if (file) console.log(`Backup: ${file}`);
    console.log("");
  }

  // One transaction for the whole repair: every row is re-checked, and a single
  // unexpected state rolls all of it back.
  const repaired = await withTransaction(async (tx) => {
    const done: Array<{ jobId: string; orderNumber: string; status: string; stage: string; progress: number }> = [];
    for (const c of candidates) {
      const orderRows = await tx.query(`SELECT status FROM orders WHERE id = $1 FOR UPDATE`, [c.order_id]);
      if (orderRows[0]?.status !== "IN_PRODUCTION") {
        throw new Error(`order ${c.order_number} is now ${String(orderRows[0]?.status)}; re-run the dry run`);
      }
      const rows = await tx.query(
        `UPDATE production_jobs
            SET status = 'DECORATING', stage = 'QC', progress = 80, updated_at = now()
          WHERE id = $1 AND status = 'DONE'
          RETURNING id, status, stage, progress`,
        [c.job_id],
      );
      const row = rows[0] as { id: string; status: string; stage: string; progress: number } | undefined;
      if (!row) {
        throw new Error(`job ${c.job_id} is no longer DONE; re-run the dry run`);
      }
      done.push({
        jobId: row.id,
        orderNumber: c.order_number,
        status: row.status,
        stage: row.stage,
        progress: row.progress,
      });
    }
    return done;
  });

  console.log(`Repaired ${repaired.length} job(s):`);
  for (const r of repaired) {
    console.log(`  ${r.jobId} (order ${r.orderNumber}): ${r.status} / ${r.stage} / ${r.progress}%`);
  }

  const remaining = await fetchCandidates(opts.orderNumber);
  console.log("");
  console.log(`Verification: ${remaining.length} stuck job(s) left${remaining.length === 0 ? " ✓" : ""}.`);
  if (remaining.length > 0) {
    console.log("  Some jobs still match the signature; inspect them before restarting the API.");
  }

  if (!(await setReadyPermissionExists())) {
    console.log("");
    console.log("WARNING: 'production.set_ready' is missing from this database's permissions.");
    console.log("         Set to Ready will answer 403 here. Apply server/migrations/024_production_workflow.sql");
    console.log("         (or run `npm run db:migrate`) against this database, then restart the API.");
  }

  console.log("");
  console.log("Next: start the API against this database, open Production — the job is in");
  console.log("Decorating and its dialog offers Set to Ready.");
}

main()
  .catch((err) => {
    console.error("");
    console.error("Repair failed:", err instanceof Error ? err.message : err);
    console.error("Nothing was committed (single transaction, rolled back).");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
