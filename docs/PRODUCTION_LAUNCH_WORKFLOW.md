# Production Launch Workflow — Implementation Exploration Report

**Source:** Derived from the `spiro` application on the desktop (`Production_Protocol.md`, `reset.md`, `reset_progress.md`, `forward.md`).
**Target:** Twin Cakery ERP (`c:\Users\manue\Desktop\twin_cakery\erp`).
**Status:** Exploration / plan — nothing implemented yet.
**Guiding rule (from Spiro):** In production, *nobody* gets in except through a code you issued — and structure is never destroyed, only data.

---

## 1. What Spiro does (the reference workflow)

Spiro's production launch is a 4-phase, code-gated, auditable flow:

| Phase | Deliverable | Purpose |
|---|---|---|
| **A — Wipe** | `reset-production.js` + guards + `pg_dump` backup + `npm run wipe` | Reset production to factory: data gone, structure intact |
| **B — Admin Code** | Schema migration on `activation_codes` (`kind`/`purpose`/`reset_user_id`), claim-admin flow, drop dead `admin_recovery_codes` | Bootstrap the first admin after a wipe (no credentials exist) OR reclaim admin later |
| **C — Staff reset codes + codes UI** | Reset-code endpoint + "Reset credentials" in staff UI + `rotate-admin` | Staff who forgot credentials get re-credentialed without the old password |
| **D — Devices & runbook** | POS "Reset device data" + final runbook pass | Re-point terminals at a wiped server |

**Key design decisions in Spiro:**
1. **No "super user app"** — the developer's control channel is the server host itself (CLI: `npm run wipe`, `npm run code:admin`), never an HTTP endpoint. Master-key access = physical presence at the server.
2. **Wipe = data only** — `TRUNCATE … CASCADE RESTART IDENTITY` over an explicit table list; structure, indexes, constraints never touched. A pre-wipe `pg_dump` backup is mandatory.
3. **One codes system, three purposes** — Admin Code (bootstrap/reclaim admin), staff register code (already exists), staff reset code (new). All stored hashed, single-use, audited.
4. **`admin_recovery_codes` is dead weight** — schema-only, unusable by design (`created_by NOT NULL` can't survive a wipe); drop it and fold its job into `activation_codes`.
5. **Streamlined build order** is Phase A → B → C → D, each independently testable on the dev DB.

**The three code types (Spiro):**

| Code type | Minted by | Purpose | Claim result |
|---|---|---|---|
| Admin Code (`kind='admin'`) | `npm run code:admin` (CLI, developer's hands) | Bootstrap first admin after wipe OR reclaim admin later | Code + name + email + new password → if no active admin exists, account created/upserted as `admin`; if one exists with that email, password reset in place |
| Staff register code (`kind='staff'`, `purpose='register'`) | Admin via UI | Staff self-register via `POST /api/auth/register` | Code + chosen username/password → new user with the code's role |
| Staff reset code (`kind='staff'`, `purpose='reset'`) | Admin via UI (for a specific user) | Re-credential a forgotten account | Code + new password → that user's password reset, auto sign-in |

---

## 2. Twin Cakery ERP — current state (verified in code)

### What already exists (reuse)

| Asset | Location | Notes |
|---|---|---|
| `users` table | `server/migrations/001_core.sql:28` | `password_hash TEXT NOT NULL` — **must become nullable** for activation flow |
| RBAC roles | `server/migrations/001_core.sql` + `server/seeds/seed.ts` | 3 roles: `role-admin` (Admin/Proprietor), `role-production`, `role-sales` |
| `audit_logs` table | `server/migrations/006_finance_delivery.sql:114` | Already used for audit trail |
| `/signup` page | `erp-interface-design/src/pages/SignUpPage.tsx` | Anyone can create an account — **no gating** |
| `hasExistingUser()` | `erp-interface-design/src/lib/api.ts:433` | Routes first visitor to `/signup` if no active users |
| `/auth/user-count` | `server/routes/auth.ts:111` | Returns `hasHistory` |
| `/auth/register` | `server/routes/auth.ts:35` | Creates user with password, no code validation |
| Migration runner | `server/database/migrate.ts` | `_migrations` table, runs `.sql` files in order |
| Seed script | `server/seeds/seed.ts` | Seeds 4 users with password `TwinCakery123!`, guarded by `count("users") > 0` |

### What is missing (the gaps this plan closes)

1. **No production wipe script** — `seed.ts` only skips if users exist; no TRUNCATE-based factory reset, no backup, no guards.
2. **No admin code / activation code system** — `users.password_hash` is `NOT NULL`; no `activation_codes` table; `/signup` is open to anyone.
3. **No "forgot password" / reset credentials flow** — `/register` creates new users only; no password reset without old password.
4. **No admin UI for minting staff codes / reset codes** — RBAC Users page exists but no code management.
5. **No device-side reset** — N/A for web ERP (no offline POS terminal), but the web client caches could be cleared.

### Architectural differences from Spiro

| Aspect | Spiro | Twin Cakery ERP |
|---|---|---|
| Frontend | React+Vite admin + POS PWA | Single React+Vite ERP (no separate POS) |
| User model | `users` with `password_hash` nullable, roles as TEXT | `users` with `password_hash` NOT NULL, RBAC via `roles`/`user_roles`/`role_permissions` |
| Codes | `activation_codes` table with CHECK constraints | No codes table yet |
| Auth | JWT via `auth.service.js` | JWT via `auth.service.ts` |
| Storage | Postgres (live) | Postgres + in-memory cache (`store.ts` / `index.new.ts`) with `persist()` |
| Seed | `seed.js` (demo data) | `seed.ts` (full demo data) |
| Wipe | `seed.js` clears demo-prefixed rows only | No wipe at all |

---

## 3. Proposed design — adapted for Twin Cakery

### 3.1 One codes system, three purposes (adapted)

Create an `activation_codes` table (new migration `018_activation_codes.sql`):

```sql
CREATE TABLE IF NOT EXISTS activation_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'staff',
  purpose TEXT NOT NULL DEFAULT 'register',
  reset_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  claimed_by TEXT REFERENCES users(id),
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_activation_codes_reset_user ON activation_codes(reset_user_id);
```

**Role CHECK (enforced in code):** `'admin'` kind is legal only when `kind='admin'`. In Twin Cakery terms, admin codes create users with `is_admin=TRUE` and assign `role-admin`.

### 3.2 Make `password_hash` nullable

Migration `018_activation_codes.sql` also:
```sql
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
```
This allows "null until activation" accounts created via codes. The seed still provides hashed passwords.

### 3.3 The three code types

| Code type | Minted by | Purpose | Claim result |
|---|---|---|---|
| **Admin Code** (`kind='admin'`) | `npm run code:admin` (CLI, developer's hands) | Bootstrap first admin after wipe OR reclaim admin later | Code + name + email + new password → if no active admin exists, account created/upserted as admin; if one exists with that email, password reset in place |
| **Staff register code** (`kind='staff'`, `purpose='register'`) | Admin via UI (Users & Roles) | Staff self-register | Code + chosen username/password → new user with the code's role |
| **Staff reset code** (`kind='staff'`, `purpose='reset'`) | Admin via UI (per user) | Re-credential a forgotten account | Code + new password → that user's password reset, auto sign-in |

### 3.4 Admin Code claim (the only unauthenticated privileged endpoint)

- `POST /api/v1/auth/claim-admin` — public, rate-limited 5/15 min/IP
- Body: `{ code, username, displayName, email, password }`
- Server transaction:
  1. Normalize code → sha256
  2. Lookup `kind='admin'` AND `code=hash` AND `used_at IS NULL` AND `expires_at > now()`
  3. If no active admin exists → create/upsert user as `role-admin`, `is_admin=TRUE`
  4. If an admin with that email exists → reset password in place
  5. Mark code `used_at`/`claimed_by` → one-time
  6. Audit `claim_admin`
  7. Sign token → auto sign-in

### 3.5 Staff reset code flow (mirrors Spiro's reset.md)

- Admin mints: `POST /api/v1/rbac/users/:id/reset-code` (admin-only)
  - Target exists, active, role ≠ admin
  - DELETE prior unused reset codes for this user
  - Mint `TWIN-RST-XXXX-XXXX` (8 × base32 ≈ 40 bits)
  - Store sha256(normalized) — plaintext never persisted
  - `purpose='reset'`, `reset_user_id`, TTL 24h (admin can pick 1–7 days)
  - Audit `create_reset_code`
  - Return plaintext ONCE
- Staff claims: `POST /api/v1/auth/reset-password` (public, rate-limited)
  - Normalize → sha256 → FOR UPDATE claim → bcrypt → consume code → audit → token
  - Auto sign-in (shaped like `/login`)

### 3.6 Production wipe script (Phase A)

Create `server/scripts/reset-production.ts`:
- Guard: requires `--confirm "WIPE PRODUCTION"` phrase
- Pre-wipe: `pg_dump` to `backups/pre-wipe-<timestamp>.sql`
- TRUNCATE all transactional tables CASCADE RESTART IDENTITY (explicit list)
- **Keep structure**: roles, permissions, role_permissions (so RBAC still works)
- **Keep `_migrations`** (so migrations aren't re-run)
- After wipe: print a fresh Admin Code (mint one) so the developer can bootstrap
- Audit: `wipe_production` entry

### 3.7 Admin UI changes

- **Users & Roles page**: add "Reset credentials" section per staff card (hidden for admin rows) + one-time copy banner
- **First-run flow**: when `hasExistingUser()` is false → `/signup` becomes an **Admin Code claim page** (not open registration). The admin enters the Admin Code + their details.
- **After first admin exists**: `/signup` is disabled/removed; new staff are created by admin via Users & Roles (or via staff register codes).

### 3.8 Dev-wipe endpoint retirement

Ensure no dev-wipe HTTP endpoint exists in production. Gate any dev-only wipe behind `NODE_ENV !== 'production'`.

---

## 4. Files to touch (estimated)

### New files
| File | Purpose |
|---|---|
| `server/migrations/018_activation_codes.sql` | `activation_codes` table + `users.password_hash` nullable |
| `server/scripts/reset-production.ts` | Guarded wipe script |
| `server/scripts/code-admin.ts` | Mint Admin Code CLI |
| `server/scripts/activation-db-test.ts` | Automated test for code flow |
| `server/middleware/rateLimit.ts` | In-memory IP limiter (5/15 min) |
| `erp-interface-design/src/pages/ClaimAdminPage.tsx` | Admin Code claim page (replaces open signup on first run) |

### Modified files
| File | Change |
|---|---|
| `server/routes/auth.ts` | Add `POST /claim-admin`, `POST /reset-password`; add `purpose='register'` guard to `/register` |
| `server/routes/rbac.ts` | Add mint/status endpoints for reset codes |
| `server/seeds/seed.ts` | Make idempotent against wipe (already guarded by `count("users") > 0`) |
| `server/package.json` | Add `wipe`, `code:admin`, `test:activation` scripts |
| `erp-interface-design/src/App.tsx` | Route first-run to `ClaimAdminPage` instead of `SignUpPage` |
| `erp-interface-design/src/lib/api.ts` | Add `claimAdmin`, `resetPassword`, `createResetCode`, `getResetCodeStatus` |
| `erp-interface-design/src/components/erp/module-table.tsx` (Users tab) | Add reset-credentials section + banner |

---

## 5. Rollout — step by step (each phase independently testable)

- **Phase A — Wipe script.** `reset-production.ts` + guards + backup + `npm run wipe`. Test on dev DB: run → row counts 0 everywhere, structure intact, backup file exists, Admin Code printed, guards abort on wrong phrase.
- **Phase B — Admin Code.** Migration 018 + claim-admin flow. Test: wipe → claim → login → both events in `audit_logs`.
- **Phase C — Staff reset codes + codes UI.** Reset-code endpoint + "Reset credentials" in Users tab. Test: staff forgets password → admin mints → staff reclaims without old password; used/expired codes rejected.
- **Phase D — Runbook.** Final runbook pass + frontend cache clearing. Test: wiped server + stale browser session → full recovery.

---

## 6. Known migration gotcha (from Spiro)

`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` are **no-ops on a live DB** for existing objects. Phase B must ship a one-time migration file (`018_activation_codes.sql`) run via the migration runner, and the wipe script must verify the new columns exist before minting.

Also: `users.password_hash` is currently `NOT NULL`. The migration must `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;` — but note that `store.ts` / `index.new.ts` cache may need a reload after migration.

---

## 7. Security summary

| Requirement | Mechanism |
|---|---|
| Stored hashed | sha256 hex in `code`; plaintext only in mint response |
| Single-use | `used_at` set inside the claim transaction (`FOR UPDATE`) |
| Account-bound | `reset_user_id` FK; claim updates that row only |
| Expiry | 24h default (admin can pick 1–7 days) |
| Brute force | ~40-bit code + 5/15 min/IP limiter + generic errors |
| Regeneration | Mint deletes prior unused code for that user |
| Audit | `claim_admin`, `create_reset_code`, `reset_password`, `wipe_production` in `audit_logs` |
| Admin codes | Mint restricted to CLI (physical server access) |
| Master-key access | Never an HTTP endpoint |

---

## 8. Feedback on applicability to Twin Cakery

### What fits well
- **The code-gated first-run flow** is exactly what Twin Cakery needs. Currently `/signup` is open to anyone, which is a production risk. The Spiro model (Admin Code minted by developer → claim → first admin) closes this.
- **The nullable `password_hash`** pattern aligns with the existing `hasExistingUser()` / `/signup` first-run detection.
- **The audit trail** (`audit_logs`) already exists and is well-structured — just add new action types.
- **The migration runner** (`migrate.ts`) handles new migrations cleanly.

### What needs adaptation
- **RBAC complexity**: Twin Cakery has a full RBAC system (roles, permissions, user_roles, role_permissions) vs Spiro's simpler `role TEXT` column. The codes system must integrate with RBAC — minting a code should assign a `role_id`, and claiming should create the `user_roles` row.
- **In-memory cache**: Twin Cakery's `store.ts` caches users in memory and persists via `persist()`. Code claim/reset flows must call `store.persist()` after mutations, and the cache must be reloaded after a wipe.
- **No offline POS**: Spiro's Phase D (device reset) doesn't apply. Instead, clear browser `localStorage`/`sessionStorage` on the client.
- **Seed idempotency**: The seed is already guarded by `count("users") > 0`, so after a wipe it will re-seed demo data unless we also guard the wipe. Actually, after a wipe the seed should NOT auto-run — the wipe script should leave the DB empty and print the Admin Code.

### Risks / open questions
1. **Seed vs. wipe conflict**: After `npm run wipe`, running `npm run seed` would re-populate demo data. The wipe script should set a flag or the seed should check for a `production_mode` env var.
2. **Cache invalidation**: After wipe, the in-memory `store.ts` cache is stale. The wipe script should restart the server or the server should detect empty DB on boot.
3. **Admin Code delivery**: Spiro says "hand out-of-band (in person/phone, never email)". For Twin Cakery, this means the developer physically shares the code.
4. **First-run detection**: Currently `hasExistingUser()` checks `store.users().some(u => u.status === "Active")`. After wipe, this returns false → routes to claim page. Good.
5. **The `/register` endpoint**: Currently open. After Phase B, it should require a valid staff register code (or be disabled entirely in favor of admin-created users).

### Recommended first move
**Phase A (wipe script)** — it is self-contained, testable on the dev DB in one session, and unblocks everything else. It also forces us to enumerate every table, which validates the migration list.

---

## 9. References

- Spiro `Production_Protocol.md` — full protocol plan (Phases A–D)
- Spiro `reset.md` — POS password reset architecture
- Spiro `reset_progress.md` — completed implementation tracker
- Spiro `forward.md` — unimplemented work + dev-wipe landmine warning
- Twin Cakery `IMPLEMENTATION_PLAN.md` — overall ERP plan
- Twin Cakery `PROGRESS.md` — current progress
- Twin Cakery `server/database/migrate.ts` — migration runner
- Twin Cakery `server/seeds/seed.ts` — seed script
- Twin Cakery `server/routes/auth.ts` — auth routes
- Twin Cakery `server/routes/rbac.ts` — RBAC routes