# Production Runbook — Twin Cakery ERP

## Pre-flight
1. Back up the database: `pg_dump -Fc twin_cakery > backups/pre-launch-<timestamp>.dump`.
2. Verify migrations applied: `_migrations` table contains `018_activation_codes`.
3. Verify roles: only `Admin`, `Production Manager`, `Sales Manager` (no CSR).
4. Verify `DATABASE_URL` points at the production database.

## Wipe
1. Run `npm run wipe -- --confirm "WIPE PRODUCTION"` from `server/`.
2. Confirm backup path printed and Admin Code minted.
3. Restart the server so the in-memory store reloads from the empty DB.

## Bootstrap
1. Run `npm run code:admin` → prints one Admin Code (shown once). Share out-of-band (in person / phone). Never email.
2. Admin opens `/claim-admin` → enters Admin Code + account details → account created, auto sign-in.

## Seed (optional)
- `npm run seed` only for training/demo data. Never in production.

## Staff onboarding
1. Admin → Settings → Users → create staff record → mint register code (`npm run code:staff` or Users tab).
2. Share register code out-of-band.
3. Staff opens `/signup` → enters register code + account details → account created.

## Client cache clearing
- On first load after wipe, the app detects an empty DB (no active users), clears `localStorage`/`sessionStorage`, and redirects to `/claim-admin`.
- Manually clear browser cache on all terminals if needed.

## Verify
1. Login as each role (Admin, Production Manager, Sales Manager).
2. Check permissions match role.
3. Check `audit_logs` for `wipe_production` and `claim_admin` entries.

## Emergency
- Master-key access is never an HTTP endpoint. Use CLI scripts only.
- Reset a forgotten password via Settings → Users → "Reset credentials" (returns temp password).