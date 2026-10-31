# Optim_security_rbac.md — Security, Authentication & RBAC

**Owns change set:** CS-01 (security baseline), and the security parts of CS-02, CS-03, CS-08, CS-12, CS-14.
**Evidence base:** `server/middleware/auth.ts`, `server/middleware/rateLimit.ts`, `server/services/auth.service.ts`, `server/services/rbac.service.ts`, `server/routes/auth.ts`, `server/routes/rbac.ts`, `server/routes/purchasing.ts`, `server/index.ts`, `server/migrations/001_core.sql`, `014_role_permissions.sql`, `018_activation_codes.sql`, `erp-interface-design/src/lib/api.ts`, `src/components/erp/data.ts`.
**Not run:** the app was read, not executed. Snippets follow your code style (`.js` import suffixes, `store`, `rbacService`, `withTransaction`) but were not compiled against the repo.

---

## How to read this document

Every finding has an ID (`SEC-nn`), a severity, the exact place in the code, what happens, and a realistic scenario. Part B gives the fix for each, with code, database, API and UI changes. Each fix ends with a **Ripple** table: every other module that must change for the fix to be complete. Part C lists new UI/features. Part D lists adjustments to existing UI.

Severity: **Critical** = exploitable now by a logged-in user or anonymous caller; **High** = serious weakness or data leak; **Medium** = weakness that matters at scale or when combined with others; **Low** = hygiene.

---

# PART A — ASSESSMENT

## What is already good
- Permissions are database-backed (`user_roles → role_permissions → permissions`) and resolved live from Postgres in `rbac.service.ts`, so a grant takes effect without a restart.
- Almost every route is wrapped in a `required("<permission>")` check, and the permission keys are action-shaped (`payments.record`, `purchasing.receive`).
- Activation codes are stored as SHA-256 hashes and expire (`activation_codes`), and `/claim-admin` is rate-limited.
- The user list endpoint (`GET /rbac/users`) projects a safe subset and never returns `password_hash`.
- The frontend hides modules the user cannot access (`MODULE_PERMISSIONS`, `visibleModules`, `nav-permissions.test.ts`).

## Findings

### SEC-01 · `requireRole` never checks the role — Medium (latent)
**Where:** `server/middleware/auth.ts`, `requireRole(roles)`.
**What happens:** It receives a `roles` array, ignores it, checks only that a session exists, then calls `next()`.
**Reality check:** I searched the server for imports of `requireRole` outside the middleware and `auth.service.ts` and found none, so nothing is exposed today. It is a trap: the first developer who writes `router.get("/x", requireRole(["Admin"]), …)` will believe the route is protected.
**Scenario:** A new "month-end close" route is guarded with `requireRole(["Admin / Proprietor"])`. Any signed-in baker can call it.

### SEC-02 · Purchasing routes with no real enforcement — Critical
**Where:** `server/routes/purchasing.ts`.
- `POST /purchasing/suppliers` has **no** auth middleware at all. It is reachable by anyone who can reach the API, even without a token. (`attachAuth` only attaches a session; it does not require one.)
- `POST /purchasing/orders` runs `rbacService.requirePermission(...).catch(() => {})` and then calls `next()` regardless. The promise rejection is swallowed, so the check cannot block anything.
- Also in this file: `PATCH /suppliers/:id` and `DELETE /suppliers/:id` require `purchasing.create`, not an edit/delete permission, and `POST /orders/:id/receive` has no check that the PO was approved.

**Scenario:** A competitor posts 500 fake suppliers, then posts purchase orders that fall back to "the first active supplier" (see PUR-02). Your goods-receipt screen shows orders you never made, and a receiving clerk books stock that never arrived.

### SEC-03 · The permission guard is copy-pasted into ~20 routers and re-queries Postgres on every call — Medium
**Where:** the `required = (perm) => async (req,res,next) => {…}` block at the top of every file in `server/routes/`.
**What happens:** Each router re-implements the guard, calls `authService.requireAuth(extractToken(...))` (which re-parses the header even though `attachAuth` already did) and then runs a `SELECT DISTINCT p.key … JOIN …` per request. A dashboard page that fires 8 requests runs 8 permission queries.
**Risk:** Drift. Two of the copies already behave differently (purchasing, above). There is no deny-by-default: a router file that forgets the guard is public.

### SEC-04 · CORS is `Access-Control-Allow-Origin: *` — High
**Where:** `server/index.ts`, first `app.use`.
**What happens:** Any website a staff member visits can call your API from their browser. Because tokens are sent as `Authorization: Bearer`, the wildcard alone does not let another site *read* responses with the token (it doesn't have the token), but it does enable cross-site scripted calls to the public endpoints (`/public/inquiries`) and removes a layer that should protect `/auth/login`.
**Also missing:** `Access-Control-Allow-Credentials` handling for a future cookie model, `Vary: Origin`, and the preflight `OPTIONS` short-circuit.

### SEC-05 · Sessions are an in-memory `Map`, tokens are guessable in principle, and logout does nothing — Critical
**Where:** `server/services/auth.service.ts` (`SESSIONS`, `generateToken`), `server/routes/auth.ts` (`POST /logout`).
**What happens:**
- Token = `tc_` + `Date.now()` in base 36 + an incrementing counter + 6 chars of `Math.random()`. The time is public knowledge, the counter is sequential, and `Math.random()` is not cryptographically secure. An attacker who knows roughly when someone logged in has a small search space.
- Sessions live in a process-memory `Map`. Every restart signs everyone out; a second server instance would see no sessions.
- `POST /auth/logout` extracts the token and then **never calls `authService.logout(token)`**; it just returns `{ ok: true }`. A stolen token survives "sign out" for its full 7-day TTL.
- `JWT_SECRET` exists in `.env` and `.env.example` but is not used anywhere in `server/`.
- Role/permission changes do not affect existing sessions' cached `role` and `isAdmin` snapshot. A user demoted from Admin keeps `session.isAdmin === true` (which drives notification fan-out, see NOT-02) until the token expires.

**Scenario:** A driver's phone is stolen. The owner deactivates the account (if there were a way to — see SEC-15) and the driver "logs out" remotely. The thief's token keeps working for a week.

### SEC-06 · Hard-coded dev password accepted for any account with a blank or placeholder hash — Critical
**Where:** `auth.service.ts`, `login()`:
```ts
if (!ok && (hash === "" || hash === "$2b$10$placeholder")) {
  ok = credentials.password === "placeholder" || credentials.password === "TwinCakery123!";
}
```
Migration `018_activation_codes.sql` made `users.password_hash` nullable, and `020_users_email_empty_placeholder.sql` introduced placeholder emails. Any user row created without a hash (an import, a half-finished registration, a seed) can be logged into with a password that is written in your source code. The seed file also creates `manager`, `alex` and `jordan` accounts.

### SEC-07 · `/auth/register` trusts `isAdmin` and `role` from the request body — High
**Where:** `server/routes/auth.ts`.
```ts
const { …, role, isAdmin, registerCode } = req.body || {};
…
role: String(role ?? "Staff"),
isAdmin: Boolean(isAdmin),
```
A valid staff code is still required, but anyone holding a staff code can create a user whose `users.is_admin = true`. The permission set comes from `user_roles` (mapped from a label allow-list, falling back to `role-csr`), so this does **not** grant admin permissions. It does matter, though, because `is_admin` is used for notification fan-out (every admin gets every alert, see NOT-02) and for the CRM follow-up recipients (`requestCustomerFollowUp` loops `store.users().filter(u => u.isAdmin)`). The free-text `role` column is also stored unvalidated and is what `ROLES_FOR_EVENT` matches on.
**Also:** the registrant chooses the role label, not the person who issued the code. A code meant for a baker can create a "Sales Manager".

### SEC-08 · Rate limiting covers `/claim-admin` only — High
**Where:** `server/routes/auth.ts` (`claimRateLimit`), `server/middleware/rateLimit.ts`.
`/auth/login`, `/auth/register`, `/public/inquiries` and `/public/order-proposals` have none. The limiter itself is per-process, keyed on `req.ip` (behind a reverse proxy this is the proxy's IP unless `trust proxy` is set, so everyone shares one bucket or the limiter is bypassable by spoofing headers), and the `buckets` map never evicts old entries.
**Scenario:** A script tries 10,000 passwords per minute against `manager`. Nothing slows it down and nothing is logged.

### SEC-09 · Roles are too coarse and the seed over-grants — High
**Where:** `seeds/seed.ts`, `migrations/014_role_permissions.sql`, `ROLES_FOR_EVENT`.
- Only three seeded roles plus a CSR role added by migration. There is no Finance/Accountant, no Baker/Decorator, no Delivery driver, although the notification routing table already refers to a "Finance" role that does not exist.
- Seed user `alex` is "Production Manager" with `is_admin = TRUE`.
- Production Manager holds `orders.confirm`, which is the permission guarding `PATCH /orders/:id`, a route that accepts any status, `total`, `paymentStatus` and `customerId` (see ORD-02).
- Sales Manager holds `payments.record` and `orders.cancel`, so the same person can take money, edit the order, and cancel it, with no second pair of eyes.
- `deliveries.view` guards `PATCH /deliveries/:id`, which sets status, times and fee (see DEL-03).
- Cost data (`inventory_items.cost`, `/inventory/ledger` unit costs, `production_costs`) is readable by anyone with the basic `view` permission of that module.

### SEC-10 · No approval workflow or separation of duties — High
Refunds, voids, discounts, expense approval, stock write-offs and permission changes are single-actor operations. Payroll has `approvePeriod(periodId, actor)` but nothing stops the person who created or calculated the period from approving it (see STF-01). `roles.manage` lets a user grant **any** permission, including to the role they themselves hold, with only a log line.

### SEC-11 · Secrets and defaults — Medium
- `db.ts` falls back to `postgres://postgres:90210@localhost:5432/twin_cakery` when `DATABASE_URL` is unset. A production deployment that forgets the variable will try a known password.
- `.env` is inside the zip (and `.gitignore` lists it). Treat every value in it as exposed if the repository was ever shared with it. Rotate the DB password and any secrets.
- `JWT_SECRET` is configured but unused, which hides the fact that no signing is happening.

### SEC-12 · The actor in audit rows and money records comes from the request body — High
**Where (examples):**
- `payments.ts`: `receivedBy: receivedBy || "admin"` and the audit row's `actor: String(receivedBy || "admin")`.
- `expenses.ts`: `recordedBy: recordedBy || "admin"`, and `PATCH` lets you overwrite `recordedBy`.
- `inventory.ts`: `user: user || "admin"` on adjustments.
- `purchasing.ts`: `requestedBy: requestedBy || "admin"`.
- The frontend's finance screen sends `receivedBy` typed by the user (`finance-view.tsx`).

An audit trail that records whatever name the caller typed is not an audit trail.
**Scenario:** Cash goes missing. The payment row says `receivedBy: "Alex"`. Alex never recorded it; the person who did typed Alex's name.

### SEC-13 · Over-broad PATCH handlers spread request bodies into records — High
`PATCH /orders/:id` spreads `...patch` into `store.updateOrder`; the store whitelists keys (`applyPatch`) but the whitelist includes `total`, `paymentStatus`, `status`, `customerId`, `createdBy`. `PATCH /deliveries/:id` assigns fields straight onto the cached object. `PATCH /customers/:id` passes the whole body to `store.updateCustomer`. Details and fixes live in the owning modules (ORD-02, DEL-03, CRM-05); the **pattern** is a security finding: routes should whitelist per action with a validator, not rely on a store-level list that is shared by every caller.

### SEC-14 · Credential reset and activation-code handling — Medium
- `POST /auth/reset-credentials` generates `Math.random().toString(36).slice(-10) + "A1!"`, hashes it, and **returns the plaintext temp password in the JSON response**. It is not cryptographically random, the user is not forced to change it, and the response may be logged by proxies or browser tools.
- `activation_codes.type` is documented in the migration as `'admin' | 'reset' | 'register'`, but the route queries `type = 'staff'`. Either the doc or the code is wrong; the column has no `CHECK`.
- Passwords need only 6 characters; bcrypt cost is 10 (acceptable, but 12 is the current norm).
- No code is ever invalidated on failed attempts for `register`; only `/claim-admin` is throttled.

### SEC-15 · There is no user lifecycle — High
There are endpoints to **list** users (`GET /rbac/users`) and **reset** a password, but none to deactivate a user, change a user's role, or revoke their sessions. `user_roles` rows are only ever created in `/register` and `/claim-admin` by pushing into the in-memory array. A departed employee's account can only be disabled by editing the database.

### SEC-16 · Tokens in `localStorage` in both apps — Medium
`erp-interface-design/src/lib/api.ts` stores the token in `localStorage` (`TOKEN_KEY`). Any XSS bug in either the ERP or the website lets a script read it. Combined with SEC-05 (logout doesn't revoke), a stolen token is a week-long master key.

### SEC-17 · No record-level scoping — Medium
A Sales user sees every order and every customer's `totalSpend`. A Production user sees order `total`, `discount` and customer contact data. A baker would see everything the module shows. RBAC currently answers "may this role touch this *kind* of record", never "may this person touch *this* record".

### SEC-18 · HTTP hardening gaps — Medium
No `helmet`-style headers (no CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`). No `trust proxy` setting. The global error handler returns `err.message` for any error, so a Postgres error text can reach a client on a 500. `express.urlencoded({ extended: true })` is enabled without need. There is no request ID on log lines.

### SEC-19 · Permission naming is inconsistent — Low
`finance.record_payment` (in `canUserDo`) and `payments.record` (in the route) mean the same thing; `deliveries.view` guards writes; `orders.confirm` guards edits; `quotations.accept` guards `send`. Several 403s in the past (see the comments in migrations 012 and 015) came from permission keys used in routes but never seeded. There is no test that every `required("x")` key exists in `permissions`.

---

# PART B — OPTIMIZATION, CORRECTION & IMPROVEMENT

## B-01 · One permission middleware, deny-by-default (fixes SEC-01, SEC-03, SEC-19)

**Code — `server/middleware/auth.ts`:**
```ts
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { rbacService } from "../services/rbac.service.js";
import type { AuthSession } from "../services/auth.service.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: { token: string | null; session: AuthSession | null };
    perms?: ReadonlySet<string>;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.session) { res.status(401).json({ error: "Authentication required" }); return; }
  next();
}

/** Every listed permission is required. Use requireAny() for "one of". */
export function requirePermission(...needed: string[]): RequestHandler {
  return async (req, res, next) => {
    const session = req.auth?.session;
    if (!session) return res.status(401).json({ error: "Authentication required" });
    try {
      const granted = await rbacService.permissionSet(session.userId); // cached, see below
      const missing = needed.filter((p) => !granted.has(p));
      if (missing.length) return res.status(403).json({ error: "Forbidden", missing });
      req.perms = granted;
      next();
    } catch (err) { next(err); }
  };
}

export function requireAny(...needed: string[]): RequestHandler {
  return async (req, res, next) => {
    const session = req.auth?.session;
    if (!session) return res.status(401).json({ error: "Authentication required" });
    const granted = await rbacService.permissionSet(session.userId);
    if (!needed.some((p) => granted.has(p))) return res.status(403).json({ error: "Forbidden" });
    req.perms = granted; next();
  };
}

/** The actor for audit/money rows. Never read an actor from req.body. */
export const actorOf = (req: Request): string => {
  const id = req.auth?.session?.userId;
  if (!id) throw new Error("actorOf() called on an unauthenticated request");
  return id;
};
```
**Delete** `requireRole` and `AuthService.requireRole` (role names are labels; permissions are the contract).

**Cache in `rbac.service.ts`** (30-second TTL, invalidated on grant/revoke so changes are immediate):
```ts
private cache = new Map<string, { exp: number; perms: Set<string> }>();
async permissionSet(userId: string): Promise<ReadonlySet<string>> {
  const hit = this.cache.get(userId);
  if (hit && hit.exp > Date.now()) return hit.perms;
  const perms = new Set(await this.getPermissionsForUser(userId));
  this.cache.set(userId, { exp: Date.now() + 30_000, perms });
  return perms;
}
invalidate(userId?: string) { userId ? this.cache.delete(userId) : this.cache.clear(); }
// call this.invalidate() at the end of assignPermissionToRole / removePermissionFromRole,
// and invalidate(userId) whenever a user's roles change.
```

**Deny-by-default router — `server/routes/api.ts`:** mount the public surface first, then one `requireAuth` gate, then everything else:
```ts
apiRouter.use("/auth", authRouter);       // login/register/claim-admin; /me and /logout enforce auth inside
apiRouter.use("/public", publicRouter);   // unauthenticated by design, rate limited (WEB doc)
apiRouter.use(requireAuth);               // <- from here on, no token = 401, even if a route forgets its guard
apiRouter.use("/catalogue", catalogueRouter);
// … all other routers unchanged …
```
**Then** replace each router's local `required` with `import { requirePermission as required } from "../middleware/auth.js"` (a one-line change per file keeps the diff small), and delete the duplicated blocks.

**Fix purchasing (SEC-02):**
```ts
router.post("/suppliers", requirePermission("suppliers.create"), …);
router.patch("/suppliers/:id", requirePermission("suppliers.edit"), …);
router.delete("/suppliers/:id", requirePermission("suppliers.archive"), …);
router.post("/orders", requirePermission("purchasing.create"), …);   // no .catch(() => {})
```

**Guard test (prevents SEC-19 and future drift)** — `server/tests/permissions-seeded.test.ts`:
```ts
// Scans routes for required("…") / requirePermission("…") keys and asserts each exists in permissions.
import { readdirSync, readFileSync } from "node:fs";
import { query } from "../database/db.js";
const keys = new Set<string>();
for (const f of readdirSync("server/routes")) {
  for (const m of readFileSync(`server/routes/${f}`, "utf8").matchAll(/(?:required|requirePermission|requireAny)\(\s*"([a-z_]+\.[a-z_]+)"/g)) keys.add(m[1]);
}
const seeded = new Set((await query<{ key: string }>("SELECT key FROM permissions")).map((r) => r.key));
const missing = [...keys].filter((k) => !seeded.has(k));
if (missing.length) throw new Error(`Permission keys used in routes but not seeded: ${missing.join(", ")}`);
```
**Second guard test:** a route table walk that asserts every non-public route returns 401 without a token.

**Ripple (CS-01):**
| Module | What changes | How |
|---|---|---|
| All routers | Replace local guard; use `actorOf(req)` | one import per file; remove `receivedBy/recordedBy/user/requestedBy` from bodies (B-05) |
| Purchasing | Real checks on suppliers and PO creation | B-01 snippet; new `suppliers.*` permission keys (B-06) |
| Frontend | Request errors 403 show "You don't have permission for X" using `missing` | `lib/api.ts` `safe()` wrapper surfaces `missing[]` to `onNotice` |
| Tests | Two new guard tests | above |

---

## B-02 · Real sessions: random tokens, hashed at rest, revocable, short-lived (fixes SEC-05)

**Migration `022_security_sessions.sql`:**
```sql
-- Twin Cakery ERP — 022 sessions, login throttling, user lifecycle
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,            -- sha256(token); the token itself is never stored
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  revoked_reason TEXT,
  ip            TEXT,
  user_agent    TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS login_attempts (
  id          BIGSERIAL PRIMARY KEY,
  username    TEXT NOT NULL,
  ip          TEXT NOT NULL,
  success     BOOLEAN NOT NULL,
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_time ON login_attempts(username, at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time   ON login_attempts(ip, at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;            -- encrypted at rest (see B-07)
ALTER TABLE activation_codes ADD COLUMN IF NOT EXISTS role_id TEXT REFERENCES roles(id);
ALTER TABLE activation_codes ADD CONSTRAINT chk_activation_type CHECK (type IN ('admin','staff','reset'));
```
**Important:** `sessions` and `login_attempts` are **not** added to the `MIRRORS` list in `database/index.new.ts`. They are written with direct SQL (`query`, `withTransaction`). The mirror's `deleteStale` only touches tables in `MIRRORS`, so it can never delete a session row. See `Optim_architecture.md` ARC-02 for why direct-SQL tables are the safe seam.

**Code — `server/services/auth.service.ts` (core of the rewrite):**
```ts
import crypto from "node:crypto";
import { query } from "../database/db.js";

const SESSION_IDLE_MS = 8 * 60 * 60 * 1000;      // 8 h sliding idle timeout
const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000; // 12 h hard cap (a bakery shift, not a week)
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string, ip: string, ua: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  await query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [crypto.randomUUID(), userId, sha256(token), new Date(now + SESSION_ABSOLUTE_MS), ip, ua.slice(0, 200)],
  );
  return token; // returned once; only the hash is stored
}

export async function resolveSession(token: string | null) {
  if (!token) return null;
  const rows = await query<any>(
    `SELECT s.id, s.user_id, s.created_at, s.last_seen_at, s.expires_at,
            u.username, u.display_name, u.role, u.is_admin, u.status, u.must_change_password
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [sha256(token)],
  );
  const r = rows[0];
  if (!r || r.status !== "Active") return null;
  if (Date.now() - new Date(r.last_seen_at).getTime() > SESSION_IDLE_MS) return null;
  // sliding touch, at most once a minute
  if (Date.now() - new Date(r.last_seen_at).getTime() > 60_000)
    void query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [r.id]);
  return { sessionId: r.id, userId: r.user_id, username: r.username, displayName: r.display_name,
           role: r.role, isAdmin: r.is_admin, mustChangePassword: r.must_change_password };
}

export const revokeSession = (token: string) =>
  query(`UPDATE sessions SET revoked_at = now(), revoked_reason = 'logout' WHERE token_hash = $1`, [sha256(token)]);
export const revokeAllForUser = (userId: string, reason: string) =>
  query(`UPDATE sessions SET revoked_at = now(), revoked_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL`, [userId, reason]);
```
**`attachAuth` becomes async** (`const session = await resolveSession(token)`). Add a 60-second in-process cache keyed by `token_hash` for hot paths; `revokeSession` and `revokeAllForUser` delete cache entries so revocation is immediate on a single instance.

**Fix logout:**
```ts
router.post("/logout", async (req, res) => {
  if (req.auth?.token) await revokeSession(req.auth.token);
  res.json({ ok: true });
});
```
**Remove the session snapshot of `role`/`isAdmin`**: the SQL above reads them live from `users`, so demoting a user takes effect on their next request.

**Ripple (CS-01):**
| Module | What changes | How |
|---|---|---|
| Notifications | Stop using `session.isAdmin` to decide recipients | resolve by permission (see `Optim_notifications_audit.md` NOT-02) |
| Frontend | On 401 clear token and redirect to login; on `mustChangePassword` force the change-password screen | `lib/api.ts` response handler; new `ChangePasswordPage` |
| Architecture | `attachAuth` async; `ready` boot unaffected | middleware order unchanged |
| Admin UI | Active sessions list + "sign out everywhere" | Part C |

---

## B-03 · Login hardening: remove the dev password, lockout, timing, password policy (fixes SEC-06, SEC-08, SEC-14)

**1. Delete the fallback.** Remove the block quoted in SEC-06. Provide a one-off script for the real fix: `server/scripts/set-password.ts <username>` that prompts for a password, hashes it and writes it. Add a migration that **disables** (not deletes) any user with a blank/placeholder hash so nobody is silently locked in:
```sql
UPDATE users SET status = 'Inactive', deactivated_at = now()
 WHERE password_hash IS NULL OR password_hash = '' OR password_hash = '$2b$10$placeholder';
```
Run `set-password.ts` for the accounts you actually use before this migration goes live.

**2. Throttle login (per username *and* per IP), persistent:**
```ts
async function assertNotLocked(username: string, ip: string) {
  const [u] = await query<{ n: string }>(
    `SELECT count(*) n FROM login_attempts WHERE username = $1 AND NOT success AND at > now() - interval '15 minutes'`, [username]);
  const [i] = await query<{ n: string }>(
    `SELECT count(*) n FROM login_attempts WHERE ip = $1 AND NOT success AND at > now() - interval '15 minutes'`, [ip]);
  if (Number(u.n) >= 5 || Number(i.n) >= 20) throw new TooManyAttemptsError("Too many attempts. Try again in 15 minutes.");
}
```
Record every attempt (`INSERT INTO login_attempts`). Return the same `401 Invalid credentials` for unknown user and wrong password, and run a dummy `bcrypt.compare` against a fixed hash when the user is not found so response time doesn't reveal which usernames exist.

**3. Policy:** minimum 10 characters, reject the top-1000 common passwords, bcrypt cost 12 for new hashes (re-hash on successful login if the stored cost is lower).

**4. Replace the plaintext temp password in `/reset-credentials`** with a single-use activation code of type `reset`, which the table already supports:
```ts
const code = crypto.randomBytes(9).toString("base64url");          // shown once to the admin
await query(`INSERT INTO activation_codes (id, code, type, user_id, expires_at)
             VALUES ($1,$2,'reset',$3, now() + interval '24 hours')`,
            [crypto.randomUUID(), sha256(code), user.id]);
await query(`UPDATE users SET must_change_password = TRUE WHERE id = $1`, [user.id]);
await revokeAllForUser(user.id, "admin reset");
res.json({ userId: user.id, resetCode: code, expiresInHours: 24 });   // no password in the response
```
Add `POST /auth/redeem-reset` (code + new password) and `POST /auth/change-password` (current + new).

**5. Apply `rateLimit` to** `/auth/register`, `/auth/redeem-reset`, `/public/inquiries`, `/public/order-proposals`. Replace the Map limiter with the table-backed throttle above for login, and keep the in-memory limiter (with eviction of expired buckets) for the public endpoints. Set `app.set("trust proxy", 1)` if behind exactly one reverse proxy.

**Ripple:**
| Module | What changes | How |
|---|---|---|
| Website | Public endpoints rate limited | `Optim_website.md` WEB-01 |
| Frontend | Login page shows lockout message and a "forgot password → ask admin for a reset code" path; new redeem/change password pages | `LoginPage.tsx`, new pages |
| Audit | `login.success`, `login.failed`, `login.locked`, `password.changed`, `password.reset_issued` events | event spine (NOT doc) |

---

## B-04 · Registration: the code decides the role (fixes SEC-07)

Add `activation_codes.role_id` (migration 022) so the **issuer** picks the role when generating a code. `/register` stops reading `role` and `isAdmin`:
```ts
const { username, displayName, email, phone, password, confirmPassword, registerCode } = req.body;
const codeRow = await consumeCode(registerCode, "staff");        // atomic: UPDATE … SET used_at = now() WHERE used_at IS NULL RETURNING role_id
const roleId = codeRow.role_id ?? "role-csr";                     // least privileged default
const user = store.createUser({ …, role: roleLabel(roleId), isAdmin: false, status: "Active", passwordHash });
```
`consumeCode` must be a single atomic statement (`UPDATE … WHERE used_at IS NULL AND expires_at > now() RETURNING …`), so two simultaneous registrations cannot both use one code. `is_admin` is set to true only by `/claim-admin`, and in B-08 the column stops driving behaviour at all.

Update `scripts/code-staff.ts` to accept `--role role-baker`.

**Ripple:** Notifications (stop reading `is_admin`), CRM (follow-up recipients by permission `crm.followup`), Admin UI (code generator with a role picker), Frontend SignUp page (it already has no role field; good, keep it that way).

---

## B-05 · Remove the actor from request bodies (fixes SEC-12)

Rule: **the server decides who did it.** Replace in every route:
```ts
// before
receivedBy: receivedBy || "admin"
// after
receivedBy: actorOf(req)
```
Concrete edits: `payments.ts` (create + callback), `finance.ts` `/payments`, `expenses.ts` (create/patch/delete), `inventory.ts` (`/adjustments`), `purchasing.ts` (`requestedBy`), `production-costs.ts` (`recordedBy`). Delete the matching optional fields from the frontend payloads (`recordPayment({ …, receivedBy })` in `finance-view.tsx`). If a user legitimately records money on behalf of someone else, add an explicit `onBehalfOf` field that is stored in a separate column, never in `received_by`.

**Test:** a grep-based unit test fails the build if `req.body` is destructured for a key matching `/(By|Actor|User)$/` in `server/routes/`.

**Ripple:** Finance (CS-03 stores `received_by` from session), Inventory, Purchasing, Production costs, Frontend forms (drop the "received by" text boxes; show "Recorded by: you").

---

## B-06 · Role model, permission catalogue and approval rules (fixes SEC-09, SEC-10)

**Roles to add** (migration `022b` or the same file): `role-finance` (Finance / Accountant), `role-baker` (Baker / Decorator), `role-driver` (Delivery), and keep `role-admin`, `role-production`, `role-sales`, `role-csr`.

**New permission keys** (add to `permissions`, then grant per the matrix). Keep old keys during transition and add aliases so nothing 403s mid-deploy.
`orders.edit_details`, `orders.reschedule`, `orders.override_price`, `orders.amend`, `payments.record`, `payments.reverse`, `payments.refund`, `payments.approve_refund`, `payments.view_all`, `deliveries.update`, `deliveries.assign`, `deliveries.collect_payment`, `deliveries.confirm_remittance`, `finance.view_ledger`, `finance.post_journal`, `finance.close_period`, `finance.view_margins`, `expenses.approve`, `quotations.send`, `suppliers.create|edit|archive`, `purchasing.approve_po`, `bills.record`, `bills.pay`, `inventory.writeoff`, `inventory.stocktake`, `inventory.view_costs`, `recipes.view|edit|approve`, `production.view_assigned`, `analytics.operations|finance|customers|staff`, `crm.followup`, `crm.export`, `users.deactivate`, `users.assign_role`, `approvals.decide`.

**Matrix (✔ = granted, ◐ = own/assigned records only, ✖ = none):**

| Capability | Admin | Finance | Production Mgr | Baker | Sales | CSR | Driver |
|---|---|---|---|---|---|---|---|
| orders view / create | ✔ | view | view | ◐ | ✔ | view | ◐ |
| orders confirm / cancel | ✔ | ✖ | ✖ | ✖ | ✔ (cancel needs reason) | ✖ | ✖ |
| orders edit price / total | ✔ | ✖ | ✖ | ✖ | ✖ (override = approval) | ✖ | ✖ |
| payments record | ✔ | ✔ | ✖ | ✖ | ✔ (≤ threshold) | ✖ | collect only via delivery |
| payments reverse / refund | ✔ | request | ✖ | ✖ | ✖ | ✖ | ✖ |
| refund approve | ✔ | ✖ (maker ≠ checker) | ✖ | ✖ | ✖ | ✖ | ✖ |
| production start/complete/QC | ✔ | ✖ | ✔ | ◐ | ✖ | ✖ | ✖ |
| recipes edit | ✔ | ✖ | ✔ (approve = Admin) | ✖ | ✖ | ✖ | ✖ |
| inventory view | ✔ | ✔ | ✔ | ◐ | ✖ | ✖ | ✖ |
| inventory view **costs** | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ |
| ledger / reports / margins | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ |
| analytics.operations | ✔ | ✔ | ✔ | ◐ | ✖ | ✖ | ✖ |
| analytics.customers | ✔ | ✔ | ✖ | ✖ | ✔ | ✔ | ✖ |
| payroll / salary data | ✔ | ✔ (process) | ✖ | ✖ | ✖ | ✖ | ✖ |
| users / roles manage | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |

**Approvals (maker–checker).** Migration `022c_approvals.sql`:
```sql
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
INSERT INTO app_settings(key,value) VALUES
 ('approval.thresholds', '{"discount_pct":10,"refund_ugx":50000,"writeoff_ugx":100000,"expense_ugx":200000,"po_ugx":500000}')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS approval_requests (
  id            TEXT PRIMARY KEY,
  action        TEXT NOT NULL,       -- 'payment.refund','payment.reverse','discount.over_limit','expense.approve','po.approve','stock.writeoff','journal.manual','period.reopen','payroll.approve'
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  requested_by  TEXT NOT NULL REFERENCES users(id),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED')),
  decided_by    TEXT REFERENCES users(id),
  decided_at    TIMESTAMPTZ,
  decision_note TEXT,
  CONSTRAINT chk_maker_checker CHECK (decided_by IS NULL OR decided_by <> requested_by)
);
CREATE INDEX IF NOT EXISTS idx_approvals_pending ON approval_requests(status, action) WHERE status = 'PENDING';
```
The database itself enforces "the approver is not the requester". **Service — `approvals.service.ts`:**
```ts
export async function requestApproval(action: string, entityType: string, entityId: string, payload: object, requestedBy: string) { /* INSERT + emit approval.requested */ }
export async function decide(id: string, decidedBy: string, approve: boolean, note: string) {
  return withTransaction(async (tx) => {
    const [row] = await tx.query(`SELECT * FROM approval_requests WHERE id = $1 FOR UPDATE`, [id]);
    if (!row || row.status !== "PENDING") throw new ConflictError("Already decided");
    if (row.requested_by === decidedBy) throw new ForbiddenError("You cannot approve your own request");
    await tx.query(`UPDATE approval_requests SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4 WHERE id = $1`,
                   [id, approve ? "APPROVED" : "REJECTED", decidedBy, note]);
    return row;           // caller executes the approved action inside the same transaction
  });
}
```
Each guarded action calls `needsApproval(action, amountOrPct)` against `approval.thresholds`; above the threshold the API returns `202 { approvalRequestId }` and the action only executes when `decide()` approves. Below it, the action runs directly but is still evented.

**Ripple (CS-01 → everything):**
| Module | What changes | How |
|---|---|---|
| Finance | Refund, reversal, manual journal, period reopen go through approvals | `Optim_finance.md` FIN-03/FIN-09 |
| Orders | Discount over threshold and price override need approval | `Optim_orders.md` ORD-03 |
| Inventory | Write-offs and stock-take variance need approval | `Optim_inventory.md` INV-03 |
| Purchasing | POs above threshold need approval | `Optim_purchasing.md` PUR-04 |
| Staff & payroll | Approver ≠ creator/calculator | `Optim_staff_payroll.md` STF-01 |
| Notifications | `approval.requested` (requires ack), `approval.decided` events | NOT doc rule table |
| Analytics | Approval turnaround, rejection rate (Staff-level views Admin only) | `Optim_analytics.md` |
| Frontend | Approvals inbox, "Awaiting approval" badges, request dialogs | Part C |

---

## B-07 · Admin 2FA, session visibility, and user lifecycle (fixes SEC-15, adds hardening)

**User lifecycle API (new):**
```
POST   /rbac/users/:id/deactivate   users.deactivate  → users.status='Inactive', deactivated_at=now(), revoke all sessions, event user.deactivated
POST   /rbac/users/:id/activate     users.deactivate
PUT    /rbac/users/:id/role         users.assign_role  → replace user_roles row, invalidate permission cache, revoke sessions, event user.role_changed (old/new)
POST   /rbac/users/:id/revoke-sessions
GET    /rbac/sessions               users.manage       → who is signed in, from where, last seen
```
Guards: you cannot deactivate yourself, cannot remove the last active Admin, and role changes for Admin require an approval request (B-06). All write to `user_roles` via SQL in a transaction **and** update the in-memory `store.userRoles()` array so the mirror does not resurrect the old row on the next `persist()` (see ARC-02). Safer: move `users`, `user_roles`, `role_permissions` out of `MIRRORS` entirely and read them through a repository, since they are security data; do this first when you start migrating off the mirror.

**TOTP 2FA (optional, mandatory for Admin and Finance):** add `speakeasy`/`otplib`; enrol endpoint returns an `otpauth://` URI; `totp_secret` is encrypted with AES-256-GCM using a key from the environment (`APP_ENC_KEY`), never stored plain. Login returns `{ requires2fa: true, challengeId }` after the password step.

**Ripple:** Frontend (enrolment screen, 2FA prompt), Audit (`user.deactivated`, `user.role_changed`, `2fa.enabled`), Notifications (admin alert on role change and repeated failed logins), HR/Staff (link `staff.user_id` so deactivating an employee deactivates their login; see STF doc).

---

## B-08 · Cookie-based sessions for the browser apps (fixes SEC-16)

Move the token from `localStorage` to an `HttpOnly; Secure; SameSite=Lax` cookie, with a CSRF token for state-changing calls:
```ts
res.cookie("tc_session", token, { httpOnly: true, secure: IS_PRODUCTION, sameSite: "lax", maxAge: SESSION_ABSOLUTE_MS, path: "/" });
res.cookie("tc_csrf", csrf, { httpOnly: false, secure: IS_PRODUCTION, sameSite: "lax" });
// middleware: for POST/PATCH/PUT/DELETE require header X-CSRF-Token === cookie tc_csrf
```
`extractToken` reads the cookie first and falls back to the `Authorization` header (so scripts and tests keep working). In production the ERP SPA is served from the same origin as the API (`express.static(distDir)` in `index.ts`), so cookies "just work". For the public website on a separate origin, use CORS with an allow-list and `credentials: true`, and only for website-user endpoints.

**Frontend:** `lib/api.ts` — remove `localStorage` token handling, add `credentials: "include"`, read the `tc_csrf` cookie and send it as `X-CSRF-Token`.

**CORS allow-list (fixes SEC-04):**
```ts
const ALLOWED = (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
```
Public, read-only catalogue/blog endpoints may keep `Access-Control-Allow-Origin: *` on `/public/catalogue` and `/public/blog` only.

---

## B-09 · Record-level scoping (fixes SEC-17)

Introduce `.own` / `.assigned` permission variants and a scoping helper that every list query goes through:
```ts
export function scopeOrders(orders: Order[], session: AuthSession, perms: ReadonlySet<string>) {
  if (perms.has("orders.view")) return orders;                       // full view
  if (perms.has("orders.view_own")) return orders.filter((o) => o.salespersonId === session.userId || o.createdBy === session.userId);
  return [];
}
export function scopeJobs(jobs: ProductionJob[], session: AuthSession, perms: ReadonlySet<string>) {
  if (perms.has("production.view")) return jobs;
  if (perms.has("production.view_assigned")) return jobs.filter((j) => j.assignedTo === session.userId);
  return [];
}
```
Needs `production_jobs.assigned_to` (see PRD doc) and a `deliveries.driver_user_id` (see DEL doc). Field-level redaction for cost and margin: a `redact(obj, perms)` helper removes `cost`, `unitCost`, `margin`, `totalSpend` unless `finance.view_margins` / `inventory.view_costs` is held. Apply it in the **serializer** of inventory, production-costs, orders, customers, analytics so a new route cannot forget.

**Ripple:** Orders list, Customers list/detail (hide `totalSpend` from non-sales/finance), Inventory (`cost`, `/ledger.unitCost`), Production (`/jobs/:id/costs`), Analytics (`dashboard` mixes revenue, margin and expenses and is gated by `sales.analytics`; see ANA-03), Frontend (columns not rendered when the field is absent).

---

## B-10 · HTTP hardening (fixes SEC-18, SEC-11)

```ts
import helmet from "helmet";
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 0));
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", "data:", "https:"], connectSrc: ["'self'"] } } }));
app.use((req, res, next) => { req.id = crypto.randomUUID(); res.setHeader("X-Request-Id", req.id); next(); });
// error handler
app.use((err, req, res, _next) => {
  const status = err.statusCode ?? 500;
  logger.failure("server", `${req.id} ${req.method} ${req.originalUrl} ${status}`);
  res.status(status).json({ error: status >= 500 ? "Internal server error" : err.message, requestId: req.id });
});
```
Remove the hard-coded DB fallback in `db.ts`: `if (!process.env.DATABASE_URL && IS_PRODUCTION) throw new Error("DATABASE_URL is required")`. Rotate the DB password and any secrets that were in `.env`. Use `JWT_SECRET` for nothing (delete it) or, if you add signed password-reset links, as the HMAC key. Add `.env`, `backups/`, `*.log`, `*.err`, `erp.db` to `.gitignore` (see `Optim_architecture.md` ARC-07).

---

# PART C — NEW FUNCTIONALITY & UI

| UI element | Purpose | Details |
|---|---|---|
| **Administration → Users** tab | Full user lifecycle | Table (name, role, status, last login, 2FA on/off, sessions); row actions: Deactivate/Activate, Change role (opens approval flow for Admin), Reset password (shows the one-time code in a copy dialog, never a password), Sign out everywhere |
| **Administration → Roles & permissions** | Safe role editing | Permission matrix grouped by module with search; unsaved-changes diff ("will add: payments.reverse; will remove: orders.edit_details"); confirm dialog; every save writes a `role.permission_changed` event; warning banner when editing a role that has active users |
| **Administration → Access codes** | Issue staff/admin/reset codes | Choose role, expiry, copy once; list of unused/used codes with who used them |
| **Approvals inbox** (top-bar bell sub-tab + dedicated page) | Maker–checker | Pending requests with amount, requester, reason, entity link; Approve/Reject with required note; own requests shown read-only with "waiting for another approver" |
| **Active sessions** (My profile) | Self-service security | List of devices/IP/last seen, revoke each |
| **Change password / forgot-password** pages | Credential hygiene | Strength meter, policy text, forced on `mustChangePassword` |
| **2FA enrolment** | Protect Admin/Finance | QR, backup codes |
| **Security log** | Evidence | Filter by user/event (login failed, role changed, permission changed, approval decided) with CSV export |
| **403 explainer** | Clarity | Friendly page naming the missing permission and who to ask |

# PART D — ADJUSTMENTS TO EXISTING UI & FEATURES

- `components/erp/store.tsx` already holds `permissions`. Add a `can(key)` hook and use it at **action** level: hide or disable "Cancel order", "Complete delivery", "Record payment", "Delete expense", with a tooltip explaining the missing permission. `MODULE_PERMISSIONS` stays for navigation. The server remains the real gate.
- `LoginPage.tsx`: show lockout countdown; remove any hint of default credentials; add "Forgot password" link.
- `SignUpPage.tsx`: keep it role-less; show the role granted by the code after redemption.
- `finance-view.tsx`: remove the "received by" input (B-05).
- `data.ts` `MODULE_PERMISSIONS`: `analytics: 'sales.analytics'` becomes `analytics.operations | analytics.finance | analytics.customers` (any-of). Add `finance: 'finance.view'` stays; add modules `approvals` (always visible, content scoped).
- Every table that shows cost, margin or total spend consumes redacted payloads and conditionally renders those columns.

---

# PART E — MIGRATIONS, ROLLOUT ORDER, TESTS

**Migrations (in order):** `022_security_sessions.sql` (sessions, login_attempts, user columns, activation role, CHECK) → `022b_roles_permissions.sql` (new roles/keys/grants + aliases) → `022c_approvals.sql`.

**Rollout order**
1. Rotate secrets; delete the dev-password fallback; `set-password.ts` for real accounts (SEC-06, SEC-11). *Same day.*
2. Fix purchasing auth and add `requireAuth` deny-by-default (SEC-02, B-01). *Same day.*
3. Fix logout; random tokens in the `sessions` table (B-02).
4. Rate limits and lockout (B-03). CORS allow-list (B-08 part 2).
5. Actor from session (B-05) — coordinate with Finance (CS-03) because it changes the payment payload.
6. Roles, permissions, approvals (B-06), then user lifecycle (B-07).
7. Cookies/CSRF, record scoping, helmet (B-08, B-09, B-10).

**Tests to add first**
- 401 on every non-public route without a token (route-table walk).
- 403 on every route for a user with zero grants; 200 for the owning role.
- Logout revokes: the same token returns 401 afterwards.
- Demoted user loses access on the next request (cache invalidation).
- Login lockout after 5 failures; correct password still blocked during lockout.
- `register` ignores `isAdmin` and `role` in the body; two parallel registrations with one code → exactly one succeeds.
- Approver equals requester → 403 and DB `CHECK` violation if bypassed.
- Every `required("…")` key exists in `permissions`.
