# Codebase map (verified from the project zip on 2026-10-31)

Verified by listing and grepping the files; **the app was not run**. Correct this file when you find something wrong.

## Layout

| Area | Path | Notes |
|---|---|---|
| Root | `package.json` | Scripts delegate to `erp-interface-design` (`dev`, `build`, `build:api`, `db:migrate`, `db:seed`, `test`, `lint`) |
| Admin frontend | `erp-interface-design/` | React + Vite + TypeScript; ERP views in `src/components/erp/`; pages in `src/pages/` (Login, SignUp, ClaimAdmin only); API client `src/lib/api.ts`; tests `src/test/*.test.ts(x)` (vitest, config includes only `src/**`) |
| Server | `server/` | Express + TypeScript, REST under `/api/v1`; entry `server/index.ts`; routes `server/routes/*.ts`; services `server/services/`; middleware `server/middleware/auth.ts`, `rateLimit.ts`; data `server/database/`; migrations `server/migrations/` (001 to 021); seeds `server/seeds/` |
| Website | `sweet-moments-cakery-web/` | Separate Vite app; pages in `src/pages/`; has an `erp/` folder duplicating server files and a `supabase/` folder |
| Docs | `docs/`, `erp-interface-design/*.md` | Specs and design guides: `erp-design-system.md`, `dark-mode-light-mode-guide.md`, `DashboardDesignPattern.md`, `deliveries.md`, `crm.md`, `AGENTS.md` |

## ERP view files (`erp-interface-design/src/components/erp/`)

`dashboard.tsx`, `finance-view.tsx`, `analytics-view.tsx`, `deliveries-view.tsx` (+ `deliveries-panels.tsx`, `deliveries-filters.tsx`), `production-view.tsx`, `inventory-view.tsx`, `purchasing-view.tsx`, `crm-view.tsx` (+ `crm-panels.tsx`), `staff-view.tsx`, `OrderProposalsView.tsx`, `workspace.tsx` (module router and orders/quotations/etc.), `dialogs.tsx`, `module-table.tsx`, `topbar.tsx` (notification bell), `sidebar.tsx`, `ui.tsx` (shared UI, status badges), `store.tsx`, `data.ts`, `web-app.tsx`, `PrivateRoute.tsx`. Shared table components in `src/components/data-table/`.

## Server facts relevant to the plan

- **Auth middleware:** `server/middleware/auth.ts`. `requireRole(roles)` (line ~26) only checks that a session exists, then calls `next()`.
- **CORS:** `server/index.ts` lines ~35-38 set `Access-Control-Allow-Origin: *` manually.
- **Rate limit:** `server/middleware/rateLimit.ts` is used only for `/claim-admin` in `server/routes/auth.ts` (line ~36).
- **Data layer:** `server/database/store.ts` (~94 KB) is an in-memory store with write-back; it imports `./index.new.js`. `server/index.ts` and `routes/auth.ts` also import `index.new.js`, so **`index.new.ts` is the live module**. `server/database/index.ts` and `store.legacy.ts` appear unreferenced: confirm with grep before deleting.
- **Write cost:** `erp-interface-design/AGENTS.md` notes each persist flushes the whole cache and `POST /orders/:id/confirm` persists about 6 times (up to ~20 s on the dev box). This supports `ARC-04`.
- **Migrations:** `server/database/migrate.ts` already tracks applied files in `_migrations` (sorted by file name, one transaction per file). There are two `020_*` files (`020_production_fixed_costs.sql`, `020_users_email_empty_placeholder.sql`). Next free number is `022`.
- **Business logic:** `server/services/business.service.ts` (~40 KB): `markOrderPaid` (~line 576), `confirmOrder`, `reserveStock`, `adjustInventory`, `markProductionStarted`. `notification.service.ts` has `publishEvent`, `notifyUser`, `ROLES_FOR_EVENT`.
- **Deliveries:** `server/routes/deliveries.ts` `/:id/complete` (~line 74) calls `businessService.markOrderPaid` (~line 90) inside a try/catch whose comment says payment anomalies must never roll back a completed delivery.
- **Analytics UI:** `analytics-view.tsx` line ~54 hardcodes `182080` and `"64% gross margin"` as fallbacks.

## Known stale documentation

`erp-interface-design/AGENTS.md` says the backend lives in `erp/server`; it is actually `server/` at the project root. Verify any path in that file before relying on it.

## Junk that should not be in version control (for `ARC-10`)

`backups/*.sql` (15 files), `server/erp.db`, `server/tmp-check.js`, `*.err`, `*.log`, `*.out`, `files.txt`, `*.bak`, `temp*.txt`, `dist-server/`, `build_out*.txt`, `.env` (check git history), `sweet-moments-cakery-web/erp/`.

## Commands (from `erp-interface-design/` unless noted)

| Need | Command |
|---|---|
| Frontend tests | `npm run test` |
| Frontend build | `npm run build` |
| Server type-check | `npm run build:api` or `npx tsc -p ../server/tsconfig.json --noEmit` |
| Lint | `npm run lint` |
| Migrate | `npm run db:migrate` (needs Postgres and `.env`) |
| Seed | `npm run db:seed` |
| Dev (both) | `npm run dev:all` |
