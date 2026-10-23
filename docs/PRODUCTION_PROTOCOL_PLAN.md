# Production Protocol Implementation Plan — Twin Cakery ERP

**Roles scope:** Admin, Production Manager, Sales Manager only (CSR role removed).
**Source:** Spiro's `Production_Protocol.md` adapted to Twin Cakery's RBAC/Postgres/React stack.
**Companion doc:** `PRODUCTION_LAUNCH_WORKFLOW.md` (exploration report).

---

## 0. Role Restriction — Remove CSR

### What changes
- **Seed (`server/seeds/seed.ts`)**: Remove `role-csr` from the roles INSERT. Remove the `usr-priya` / priya user. Remove the `roleGrants["role-csr"]` block.
- **Frontend**: Any references to "Customer Service Representative" or `role-csr` in UI dropdowns, filters, or permission checks must be removed.
- **Migrations**: No migration needed — `role-csr` simply won't be seeded on fresh DBs. On existing dev DBs, a cleanup script can DELETE the role and its user_roles.

### Files to touch
| File | Change |
|---|---|
| `server/seeds/seed.ts` | Remove `role-csr` INSERT, `usr-priya` user, `role-csr` grants |
| `erp-interface-design/src/` (search for `csr`/`CSR`/`role-csr`) | Remove CSR references in role dropdowns, filters, permissions |

---

## Phase A — Production Wipe Script

### Goal
Reset production to factory: all transactional data gone, structure intact, roles/permissions preserved, `_migrations` preserved, backup created, Admin Code printed.

### New file: `server/scripts/reset-production.ts`

**Guard:** Requires `--confirm "WIPE PRODUCTION"` CLI phrase. Aborts otherwise.

**Steps:**
1. Verify `NODE_ENV` is not `production` OR `--force` flag passed (safety).
2. Verify migration `018_activation_codes.sql` has been applied (columns exist on `users` and `activation_codes` table exists).
3. `pg_dump` → `backups/pre-wipe-<timestamp>.sql`.
4. TRUNCATE all transactional tables CASCADE RESTART IDENTITY (explicit list, see below).
5. Keep: `roles`, `permissions`, `role_permissions`, `_migrations`.
6. Reload in-memory store (`store.reload()` or restart server).
7. Mint a fresh Admin Code (call `code-admin` logic) → print plaintext to console.
8. Audit: insert `wipe_production` into `audit_logs`.
9. Print summary: row counts before/after, backup path, Admin Code.

### Tables to TRUNCATE (explicit list)
```
users, user_roles, customers, customer_addresses, customer_interactions,
customer_feedback, inquiries, quotations, orders, order_items, order_status_history,
products, product_categories, recipes, recipe_ingredients, inventory_items,
inventory_transactions, suppliers, purchase_orders, purchase_order_items,
payments, expenses, expense_categories, deliveries, notifications,
notification_recipients, notification_preferences, notification_templates,
audit_logs, staff, remuneration_records, payroll_periods, blog_posts,
blog_categories, website_users, activation_codes
```

**Keep:** `roles`, `permissions`, `role_permissions`, `_migrations`, `expense_categories` (seeded defaults).

### New npm script
```json

---

## Phase B — Admin Code System

### Migration: `server/migrations/018_activation_codes.sql`

```sql
-- Make password_hash nullable (for "null until activation" accounts)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Activation codes table
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

### New file: `server/scripts/code-admin.ts`

CLI script: `npm run code:admin [--ttl 24h]`
- Generates `TWIN-ADM-XXXX-XXXX` (8 × base32 ≈ 40 bits)
- Stores sha256(normalized) in `activation_codes` with `kind='admin'`, `purpose='register'`
- Prints plaintext code to console (once)
- Audit: `mint_admin_code`

### New endpoint: `POST /api/v1/auth/claim-admin`

Public, rate-limited (5/15 min/IP). Body: `{ code, username, displayName, email, password }`.

Server transaction:
1. Normalize code → sha256
2. Lookup `kind='admin'` AND `code=hash` AND `used_at IS NULL` AND `expires_at > now()`
3. If no active admin exists → create user as `role-admin`, `is_admin=TRUE`, assign `role-admin` in `user_roles`
4. If an admin with that email exists → reset password in place
5. Mark code `used_at`/`claimed_by`
6. Audit `claim_admin`
7. Sign token → auto sign-in
8. `store.persist()`

### Modified: `server/routes/auth.ts`
- Add `POST /claim-admin` route
- Add `purpose='register'` guard to `/register` (require valid staff register code)
- Add `POST /reset-password` route (Phase C)

### New file: `erp-interface-design/src/pages/ClaimAdminPage.tsx`
- Admin Code input + name/email/password form
- Replaces `SignUpPage` as first-run landing

### Modified: `erp-interface-design/src/App.tsx`
- When `hasExistingUser()` is false → route to `ClaimAdminPage` instead of `SignUpPage`

### New file: `server/middleware/rateLimit.ts`
- In-memory IP limiter: 5 requests per 15 minutes

### New npm script
```json
"code:admin": "tsx server/scripts/code-admin.ts"
```

### Test plan
- Wipe → run `npm run code:admin` → claim via API → login → verify both `claim_admin` and `mint_admin_code` in audit_logs.
- Expired code → 401. Used code → 401. Wrong code → 401 (generic).
- Rate limiter → 6th request in 15 min → 429.
"wipe": "tsx server/scripts/reset-production.ts"
```

### Test plan
- Run on dev DB → verify row counts 0 on all truncated tables.
- Verify `roles` (3 rows), `permissions`, `role_permissions`, `_migrations` intact.
- Verify backup file exists in `backups/`.
- Verify Admin Code printed to console.
- Verify guards abort on wrong phrase / missing phrase.
- Verify structure (tables, indexes, constraints) unchanged.

---

## Phase C — Staff Reset Codes + Admin UI

### New endpoints

**Mint (admin-only):** `POST /api/v1/rbac/users/:id/reset-code`
- Target must exist, active, role ≠ admin (only Production Manager / Sales Manager)
- DELETE prior unused reset codes for this user
- Mint `TWIN-RST-XXXX-XXXX`
- Store sha256(normalized)
- `purpose='reset'`, `reset_user_id`, TTL 24h (admin can pick 1–7 days)
- Audit `create_reset_code`
- Return plaintext ONCE
- `store.persist()`

**Claim (public, rate-limited):** `POST /api/v1/auth/reset-password`
- Body: `{ code, newPassword }`
- Normalize → sha256 → `SELECT ... FOR UPDATE` → verify → bcrypt → consume code → audit → token
- Auto sign-in (shaped like `/login`)

### Modified: `server/routes/rbac.ts`
- Add `POST /users/:id/reset-code` endpoint
- Add `GET /users/:id/reset-code-status` endpoint (admin-only, shows active code expiry)

### Modified: `erp-interface-design/src/lib/api.ts`
- Add `claimAdmin`, `resetPassword`, `createResetCode`, `getResetCodeStatus`

### Modified: `erp-interface-design/src/components/erp/module-table.tsx` (Users tab)
- Add "Reset credentials" section per staff card (hidden for admin rows)
- One-time copy banner with plaintext code + expiry
- Status indicator: "Active code (expires in Xh)" or "No active code"

### Modified: Staff register flow
- `/register` now requires a valid staff register code (`purpose='register'`)
- Admin mints register codes via Users & Roles (or a dedicated "Invite Staff" flow)

### Test plan
- Staff forgets password → admin mints reset code → staff claims with new password → auto sign-in.
- Used code → rejected. Expired code → rejected. Wrong code → rejected (generic).
- Admin rows → no reset button shown.
- Minting deletes prior unused code for that user.

---

## Phase D — Runbook & Frontend Cache

### Final runbook (`docs/PRODUCTION_RUNBOOK.md`)
1. Pre-flight: backup DB, verify migrations applied, verify roles (3 only: Admin, Production Manager, Sales Manager).
2. Wipe: `npm run wipe` → enter phrase → confirm backup + Admin Code.
3. Bootstrap: run `npm run code:admin` → share code out-of-band (in person/phone, never email).
4. Claim: admin opens `/signup` → enters Admin Code → creates account.
5. Seed (optional): `npm run seed` only if demo data needed for training (NOT in production).
6. Staff onboarding: admin creates staff via Users & Roles → mints register codes → shares out-of-band.
7. Client cache: clear browser `localStorage`/`sessionStorage` on all terminals.
8. Verify: login as each role (Admin, Production Manager, Sales Manager) → check permissions → check audit log.

### Frontend cache clearing
- On first load after wipe, detect empty DB (no active users) → clear `localStorage`/`sessionStorage` → redirect to claim page.
- Add `?v=` cache-busting query param to static assets.

### Test plan
- Wiped server + stale browser session → full recovery (clear cache → claim page → login).
- All 3 roles can log in with correct permissions.

---

## Migration Gotcha (from Spiro)

`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` are **no-ops on a live DB** for existing objects. Each migration must be a real `.sql` file run via the migration runner. The wipe script must verify new columns/tables exist before minting codes.

---

## Security Summary

| Requirement | Mechanism |
|---|---|
| Stored hashed | sha256 hex in `code`; plaintext only in mint response |
| Single-use | `used_at` set inside claim transaction (`FOR UPDATE`) |
| Account-bound | `reset_user_id` FK; claim updates that row only |
| Expiry | 24h default (admin can pick 1–7 days) |
| Brute force | ~40-bit code + 5/15 min/IP limiter + generic errors |
| Regeneration | Mint deletes prior unused code for that user |
| Audit | `claim_admin`, `create_reset_code`, `reset_password`, `wipe_production`, `mint_admin_code` in `audit_logs` |
| Admin codes | Mint restricted to CLI (physical server access) |
| Master-key access | Never an HTTP endpoint |
| Roles | Only Admin, Production Manager, Sales Manager |

---

## Execution Order

```
Phase 0 (Role Restriction) → Phase A (Wipe) → Phase B (Admin Code) → Phase C (Reset Codes + UI) → Phase D (Runbook)
```

Each phase is independently testable on the dev DB. Phase 0 can be done in parallel with Phase A.

### Recommended first move
**Phase 0 + Phase A together** — remove CSR role from seed and build the wipe script. This unblocks everything else and validates the table enumeration.