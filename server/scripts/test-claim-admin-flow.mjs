// server/scripts/test-claim-admin-flow.mjs
// E2E lock-in for the first-run admin bootstrap (docs: initial setup).
//
// Guards the only path to an admin account: POST /auth/claim-admin with a
// freshly minted admin code. Asserts:
//   1. valid admin code + payload → 201 with a session token
//   2. the user comes back as isAdmin with the Admin / Proprietor role
//   3. permissions are the full admin set (not the empty sidebar bug)
//   4. the DB has a user_roles row pointing at role-admin
// then removes everything it created so the workspace stays first-run clean.
//
// Requires the API on :4000 (npm run dev in server/). Exit code 0 = PASS.
// The claim endpoint rate-limits to 5 attempts / 15 min — one run = one attempt.

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

const reqPg = createRequire(path.resolve(__dirname, "..", "package.json"));
const pg = reqPg("pg");
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

// 1) Mint a fresh admin code (plaintext once, hashed at rest) — same shape as
//    scripts/code-admin.ts.
const rnd = () => Math.random().toString(36).substring(2, 6).toUpperCase();
const code = `TWIN-ADM-${rnd()}-${rnd()}`;
const codeHash = crypto.createHash("sha256").update(code).digest("hex");
const codeId = `ac-${Date.now()}-e2e`;
await pool.query(
  `INSERT INTO activation_codes (id, code, type, created_at, expires_at)
   VALUES ($1, $2, 'admin', now(), now() + interval '7 days')`,
  [codeId, codeHash],
);

const username = `e2e-admin-${Date.now().toString(36)}`;
let userId = null;
try {
  // 2) Claim through the exact endpoint ClaimAdminPage uses.
  const res = await fetch(`${API}/auth/claim-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      username,
      displayName: "E2E Admin Test",
      email: `${username}@example.test`,
      password: "e2e-pass-1",
      confirmPassword: "e2e-pass-1",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== 201) {
    fail(`POST /auth/claim-admin expected 201, got ${res.status}: ${JSON.stringify(body)}`);
  }
  userId = body.user?.id;
  console.log(`claim-admin: 201, user=${userId}`);

  // 3) The claim must bootstrap a real admin session.
  if (!body.token) fail("claim-admin returned no session token");
  if (body.user?.isAdmin !== true) fail(`expected isAdmin=true, got ${JSON.stringify(body.user)}`);
  if (body.user?.role !== "Admin / Proprietor") fail(`unexpected role: ${body.user?.role}`);
  console.log(`session: token issued, role=${body.user.role}`);

  // 4) Admin permissions must be the full set (empty sidebar bug would be back).
  const perms = body.permissions || [];
  if (perms.length === 0) fail("claim-admin returned an empty permissions list");
  for (const required of ["roles.manage", "orders.confirm", "finance.record_payment"]) {
    if (!perms.includes(required)) {
      fail(`expected admin permission ${required}, got: ${perms.join(", ")}`);
    }
  }
  console.log(`permissions: ${perms.length} (includes roles.manage, orders.confirm, finance.record_payment)`);

  // 5) The role row must exist in the DB, mapped to role-admin.
  const rows = await pool.query(`SELECT role_id FROM user_roles WHERE user_id = $1`, [userId]);
  const roleId = rows.rows[0]?.role_id;
  if (roleId !== "role-admin") {
    fail(`user_roles row missing or wrong (expected role-admin, got ${roleId})`);
  }
  console.log(`user_roles: ${roleId}`);

  // 6) An admin code is single-use: a second claim must be rejected (400/409).
  const reuse = await fetch(`${API}/auth/claim-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, username: `${username}-b`, password: "e2e-pass-1", confirmPassword: "e2e-pass-1" }),
  });
  if (reuse.status === 201) fail("admin code was accepted twice — single-use guard is broken");
  console.log(`code reuse rejected: ${reuse.status}`);

  console.log("PASS: claim-admin flow is locked in (201 + admin session + role-admin + single-use)");
} catch (err) {
  console.error(`FAIL: ${err.message}`);
  process.exitCode = 1;
} finally {
  // 7) Cleanup so the workspace returns to its first-run state. Covers stale
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
