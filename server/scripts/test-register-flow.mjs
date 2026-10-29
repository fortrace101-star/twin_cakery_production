// server/scripts/test-register-flow.mjs
// E2E lock-in for the staff signup flow (docs: staff registration).
//
// Guards the fix where POST /auth/register created a user but no user_roles
// row, so the sidebar resolved to zero visible modules and every required()
// route returned 403. Asserts:
//   1. a valid staff code + payload → 201
//   2. the response carries a non-empty permissions list (role-csr)
//   3. the DB has a user_roles row pointing at role-csr
// then removes everything it created so the workspace stays first-run clean.
//
// Requires the API on :4000 (npm run dev in server/). Exit code 0 = PASS.

import { createRequire } from "node:module";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Same dotenv wiring as scripts/code-admin.ts: config comes from the repo root.
const requireFromFrontend = createRequire(
  path.resolve(__dirname, "..", "..", "erp-interface-design", "package.json"),
);
const dotenv = requireFromFrontend("dotenv");
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

const { default: pg } = await import("pg");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const API = process.env.API_BASE_URL || "http://localhost:4000/api/v1";
// Throws instead of process.exit so the `finally` cleanup below always runs.
const fail = (msg) => {
  throw new Error(msg);
};

// 0) API must be up.
try {
  const r = await fetch(`${API}/auth/user-count`);
  if (!r.ok) fail(`API not healthy: ${r.status}`);
} catch (err) {
  fail(`API unreachable at ${API} — start it with \`npm run dev\` first (${err.message})`);
}

// 1) Mint a fresh staff register code (plaintext once, hashed at rest).
const code = `TWIN-STF-${rnd()}-${rnd()}`;
function rnd() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}
const codeHash = crypto.createHash("sha256").update(code).digest("hex");
const codeId = `ac-${Date.now()}-e2e`;
await pool.query(
  `INSERT INTO activation_codes (id, code, type, created_at, expires_at)
   VALUES ($1, $2, 'staff', now(), now() + interval '7 days')`,
  [codeId, codeHash],
);

const username = `e2e-reg-${Date.now().toString(36)}`;
let userId = null;
try {
  // 2) Register through the exact endpoint SignUpPage uses.
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registerCode: code,
      username,
      displayName: "E2E Register Test",
      email: `${username}@example.test`,
      password: "e2e-pass-1",
      confirmPassword: "e2e-pass-1",
      role: "Customer Service Representative",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== 201) {
    fail(`POST /auth/register expected 201, got ${res.status}: ${JSON.stringify(body)}`);
  }
  userId = body.user?.id;
  console.log(`register: 201, user=${userId}`);

  // 3) The sidebar must have something to render: permissions non-empty.
  const perms = body.permissions || [];
  if (!Array.isArray(perms) || perms.length === 0) {
    fail("register returned an empty permissions list (empty-sidebar bug is back)");
  }
  if (!perms.includes("orders.view")) {
    fail(`expected CSR permission orders.view, got: ${perms.join(", ")}`);
  }
  console.log(`permissions: ${perms.length} (includes orders.view)`);

  // 4) The role row must exist in the DB, mapped to role-csr.
  const rows = await pool.query(`SELECT role_id FROM user_roles WHERE user_id = $1`, [userId]);
  const roleId = rows.rows[0]?.role_id;
  if (roleId !== "role-csr") {
    fail(`user_roles row missing or wrong (expected role-csr, got ${roleId})`);
  }
  console.log(`user_roles: ${roleId}`);

  console.log("PASS: staff register flow is locked in (201 + permissions + role-csr)");
} catch (err) {
  console.error(`FAIL: ${err.message}`);
  process.exitCode = 1;
} finally {
  // 5) Cleanup so the workspace returns to its first-run state. Covers stale
  //    rows from earlier failed runs too (username prefix e2e-), because the
  //    API's in-memory store re-flushes anything still cached.
  try {
    await pool.query(`DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e-%')`);
    await pool.query(`DELETE FROM users WHERE username LIKE 'e2e-%'`);
    await pool.query(`DELETE FROM activation_codes WHERE id = $1`, [codeId]);
  } catch (err) {
    console.error(`cleanup warning: ${err.message.split("\n")[0]}`);
  }
  await pool.end();
}
