# Twin Cakery ERP — Implementation Plan

> Version: 1.2 | Date: 2026-10-19 | Branch: `main` | App: `erp/erp-interface-design` → target `erp/` root + `erp/erp-interface-design/` frontend
> Decisions confirmed: local Postgres, raw `pg`, pure React+Vite+TS, remove Lovable + all references. JWT default pending.
> Progress 2026-10-19: Phases **0 / A / B / C / D DONE** (D-06 + C-03 gates pass). Phase **E: E1–E5 DONE** (E3 gate 22/22 on 10-16; E4 gate `_e4_gate.ps1` PASS 10-19; E5 permission-aware nav + RBAC admin + live analytics 10-19). Next: **E6** (public site + order form + WhatsApp stub) → **E7** (Staff & Salary) → **Phase F** (hardening/handover).
> Currency decision: switch display + data from KSh/KES (Kenya, en-KE, Nairobi) to UGX/USh (Uganda, en-UG, Kampala/Africa/Kampala) — see §9.
> References: `Twin_Cakery_ERP_Architecture Updated.md` (**3325 lines, GOVERNING contract since 2026-10-09** — adds §5 customer order history/reminders, §18 Staff & Salary, rules 26–34; contains duplicate `## 19` heading — old §18 renumbered, numbering bug noted), `docs/erp-specification.md` (2541 lines, superseded baseline), `erp_design.md` (586 lines), `erp-design-system.md`, `DashboardDesignPattern.md`, `dark-mode-light-mode-guide.md` (Orizon + light/dark avif), `Twin_Cakery_ERP_Architecture (1).md` (original)
> Goals: (1) Standard ERP design (2) Light + Dark themes (3) Move `server/` to `erp/` root (4) Create + connect `twin_cakery` Postgres DB + seed (5) Implement spec gaps (6) Migrate to pure React + Vite + TS, zero TanStack/Lovable.

## 0. Baseline (verified 2026-10-08)

- Frontend: React 19.2 + TS + Vite 8.1.5 + **TanStack Start 1.168.60 / Router 1.170.41 / Query 5.101** + Tailwind 4.2.1 + shadcn/ui (~45 Radix) + RHF + zod + recharts. Entry via TanStack file-router (`src/router.tsx`, `src/routeTree.gen.ts`, `src/start.ts`, `src/server.ts`, `src/routes/{__root,index,workspace.$module}.tsx`). No `index.html` (SSR generates it). Proxy `/api → localhost:4000`.
- UI core: `src/components/erp/{data.ts (modules[10], initialOrders[6] TC-1048..TC-1043, stock[6], tone(), moduleRows()), store.tsx (in-memory WorkspaceProvider), workspace.tsx (~1000 lines, all UI)}`.
- Backend: Express 5.2.1 + TS, `server/{index.ts, database/{index.ts file-store server/data/store.json, store.ts Store class, types.ts ~640 lines}, routes/{api.ts + 17 domain routers}, services/{auth,business,notification,rbac}, middleware/auth, utils/errors}`. No `migrations/` content, placeholder password hashes, open CORS `*`, ad-hoc `{error}` format, no pagination.
- Env: `psql` found at `C:\pgsql\bin\psql.exe`, node `pg` driver MISSING, Postgres service status unknown — installer step required.
- TanStack/Lovable footprint (must remove): `package.json:{@tanstack/react-query,react-router,react-start,router-plugin, @lovable.dev/vite-tanstack-config, nitro}`, `vite.config.ts (defineConfig from @lovable.dev/...)`, `src/router.tsx, routeTree.gen.ts, start.ts, server.ts, routes/*, lib/{lovable-error-reporting,error-capture,error-page}.ts`, `workspace.tsx: Link from @tanstack/react-router`, `test/app-routing.test.tsx`, `AGENTS.md LOVABLE block`, `bunfig.toml lovable excludes`, `eslint.config.js TanStack message`, `.lovable/project.json`, `.tanstack/` cache.

## 1. Phase 0 — Migrate to pure React + Vite + TS (remove TanStack + Lovable)

**Target:** `npm run dev` = Vite SPA (`index.html + src/main.tsx + src/App.tsx`), `react-router-dom@7` (already in deps `^7.7.1`) for routing, native `fetch` + `src/lib/api.ts` + hooks (no `@tanstack/*`). Express stays separate on `:4000`.

### 1.1 Packages
- Remove: `@tanstack/react-query`, `@tanstack/react-router`, `@tanstack/react-start`, `@tanstack/router-plugin`, `@lovable.dev/vite-tanstack-config`, `nitro`. Keep for now: `react-router-dom`, `vite-tsconfig-paths` (or use native `resolve.tsconfigPaths`).
- `npm uninstall <above> && npm install -D @vitejs/plugin-react` (already present, verify) + ensure `pg`, `bcryptjs`, `jsonwebtoken`, `helmet`, `express-rate-limit`, `cors`, `dotenv`, `zod` (server-side) added in Phase D.
- Rename `package.json:name tanstack_start_ts → twin-cakery-erp`, scripts: `dev (vite)`, `dev:api (tsx ../server/index.ts)`, `dev:all (concurrently)`, `build (tsc && vite build)`, `preview`, `lint`, `test`, `db:migrate`, `db:seed`.

### 1.2 Files to delete / rewrite (exact)
- Delete: `src/router.tsx`, `src/routeTree.gen.ts`, `src/start.ts`, `src/server.ts`, `src/lib/lovable-error-reporting.ts`, `src/lib/error-capture.ts`, `src/lib/error-page.ts`, `src/routes/*` (after porting), `.lovable/`, `.tanstack/`, `dist-server/` (regenerate at root).
- Create: `index.html` (root of `erp-interface-design/`, `#root`, `/src/main.tsx`, fonts, favicon, `tc-theme` pre-paint script moved from `__root.tsx`), `src/main.tsx` (StrictMode + BrowserRouter + App), `src/App.tsx` (layout + `<Routes><Route path=/ …><Route path=/workspace/:module …><Route * 404>`), `src/pages/{DashboardPage.tsx, ModulePage.tsx, NotFound.tsx}`, `src/components/layout/{AppShell.tsx, Sidebar.tsx, Topbar.tsx}`, `src/lib/api.ts` (fetch wrapper, base `/api/v1`, token header, consistent error parse), `src/hooks/{useApi.ts,useTheme.ts}`.
- Rewrite: `vite.config.ts` → `defineConfig from vite + react() + tailwindcss() + tsconfigPaths(), server.proxy /api → 4000`, no `tanstackStart` key. `tsconfig.json` → remove `server/` reference (server gets own tsconfig at root), keep `@/*`. `eslint.config.js` → drop TanStack message. `AGENTS.md` → replace TanStack-Start bullet with React+Vite+RRD bullet, delete LOVABLE block. `src/test/app-routing.test.tsx` → rewrite to RRD `MemoryRouter` render test. `workspace.tsx` → replace `Link from @tanstack/react-router` with `react-router-dom` (`to=/workspace/${id}`, `useParams`, `useNavigate`).

### 1.3 Verification gate
`npm run dev` boots without `@tanstack|lovable` imports (`grep -r tanstack|lovable src vite.config.ts` = 0), `/` renders Dashboard, `/workspace/sales` renders, refresh on deep link works (SPA fallback), `npm run build` outputs `dist/index.html`, `npm test` passes.

## 2. Phase A — Standard ERP design (`erp-design-system.md` + `erp_design.md` + `DashboardDesignPattern.md`)

### A1. Tokens (single source of truth)
- Font: **Inter** (spec §2, Google Fonts link already in `__root.tsx` head → move to `index.html`). Fallback `system-ui`. All money/qty: `font-variant-numeric: tabular-nums`.
- Type scale: `xs 11/400 meta · sm 12/400 label · base 13–14/400 body/cell · md 15/500 emphasis · lg 16–18/600 section · xl 20–24/600 page · total 14–16/600–700 money`. Line-height 1.3–1.5. Bold 700 reserved for alerts/overdue only.
- Spacing strict 8px: `4,8,16,24,32,40,48` in `src/styles.css @theme inline` (okchl) + new `src/lib/theme-tokens.ts`. Migrate stray `12px` one module at a time (`erp_design.md §3.2 Space3` decision).
- Layout: sidebar `260px` (collapsed `68px`) + topbar `64px` + content `24px`. Pattern: page-title → toolbar/filter row → table (sticky header, zebra optional, right-aligned numerics, status badge) → footer count/totals.
- Status vocabulary (lock in code + test): green `Paid/Ready/Completed/Delivered/In stock/Approved/Active/Passed` · blue `In production/Sent/Dispatched` · red `Low stock/Unpaid/Rejected/Out of stock/Error` · amber `Pending` · violet `Confirmed/Accepted` · gray `Draft/Inactive`. Always badge + word, never coloured text alone.

### A2. Shared components (split `workspace.tsx` ~1000 lines)
- New: `src/components/data-table/DataTable.tsx` (toolbar slot, `columns{header,width,align,cell}`, sort indicator, `IsStickyHeader` opt-in internal scroll, count, totals row, empty/loading/error, density `Compact/Comfortable/Spacious` → `RowPadding 16,4/16,10/16,14` persisted per user), `src/components/data-table/StatusBadge.tsx` (enum → brush + label).
- Split shell: `src/components/erp/{workspace-shell.tsx, sidebar.tsx, topbar.tsx, dashboard/*.tsx, module-table.tsx, dialogs/*.tsx}`. CRM exception: two-pane chat layout ok.
- Dashboard widgets per `DashboardDesignPattern.md`: `Card → List → inset item (muted bg, radius 8, pad 10/8, gap 6)`. Reuse for activity/notifications/audit/alerts. KPI discipline: headline `28 SemiBold`, info `20 SemiBold`, attention `20 Bold amber/red` only.

### A3. Migration order + gate
1. Pilot **Sales Orders** (richest columns + CSV export exists) → verify header/row alignment narrow/typical/wide, truncation+tooltip, 24px targets, keyboard walk. 2. Inventory → Production → Finance → Purchasing → Delivery → CRM → Catalogue → Analytics → Admin. Gate: `lint + test` green, per-module checklist (`DashboardDesignPattern §4`).

## 3. Phase B — Light + Dark themes (`dark-mode-light-mode-guide.md`, Orizon refs)

- Light (airy warm paper, like `Light mode.avif`): warm off-white bg, white cards, hairline warm borders, chocolate primary `oklch(.265 .045 48)`, gold accent/ring, muted secondary text; inset items darker than card.
- Dark (deep elevated, like `Dark mode crypto.avif`): deep espresso-charcoal (not black), 1-level elevated cards, warm-gray borders, lightened chocolate, brightened gold; inset items lighter than card + accent dot.
- Work: complete `:root` + `.dark` oklch pairs (`surface-inset, text-muted, status ×6, chart-1..5, sidebar`), delete hard-coded colors, keep `tc-theme` localStorage + pre-paint script (move to `index.html`), Sun/Moon toggle persisted, focus rings both themes, keep `prefers-reduced-motion`.
- Gate: contrast AA on badges/buttons/inputs, no-flash toggle, screenshots 1440/1024/700px × light/dark approved.

## 4. Phase C — Move `server/` to `erp/` root

Target: `erp/erp-interface-design/` (frontend) + `erp/server/` (moved: index, database, 17 routers, 4 services, middleware, utils, migrations/, seeds/) + `IMPLEMENTATION_PLAN.md` + `PROGRESS.md` + `.env.example/.env (DATABASE_URL, JWT_SECRET, PORT)` + `dist-server/` (gitignored).

Steps: `git mv erp-interface-design/server server` (no rebase/force-push per AGENTS.md). Update `server/tsconfig outDir ../dist-server`, drop `server/` ref from frontend tsconfig, fix static path `../dist → ../erp-interface-design/dist`, fix `DATA_DIR` (retire after Postgres; JSON fallback only when `DATABASE_URL` unset). Scripts: `dev:web, dev:api (tsx server/index.ts), dev:all, build:api, db:migrate, db:seed`. Gitignore `.env*, dist-server/, server/data/store.json`. Note in AGENTS.md (Lovable builds `src/` only — safe).
Gate: `:4000/health` + `/api/v1` + Vite proxy + prod static serve OK.

## 5. Phase D — `twin_cakery` Postgres: create, connect, seed

Provision local Postgres 16+ (psql present; verify/start service): `CREATE DATABASE twin_cakery;` + `DATABASE_URL=postgres://user:pass@localhost:5432/twin_cakery`. Default raw `pg` Pool + SQL migrations.
Deps: `pg, @types/pg, dotenv, bcryptjs, jsonwebtoken, helmet, express-rate-limit, cors` (replace `*`), server `zod`.
Migrations `server/migrations/*.sql` + `server/database/migrate.ts` (`_migrations` table): ~35 tables (customers+addresses+interactions, inquiries, quotations+items, orders+items+history, catalogue cats/types/products/variants/options/recipes, inventory_items sku-unique, inventory_transactions ledger signed-qty, reservations, locations, suppliers, requirements, POs+items, receipts+items, price history, payments, expense cats/expenses, deliveries, feedback, notifications ×4, audit_logs, roles/permissions/users-bcrypt/user_roles/role_perms) with FKs + indexes + status CHECKs; order/payment/delivery statuses separate (spec §41).
Seed `server/seeds/seed.twin_cakery.sql` (idempotent, `db:seed`/`db:reset` guarded): 4 users (Manager/Admin, Alex/Production, Jordan/Sales, Priya/CSR; dev pw rotate after) + roles/perms; 7 customers (Sarah Mwangi, David Ochieng, Grace Wanjiku, James Kamau, Faith Akinyi, Peter Njoroge, Wholesale); catalogue (Chocolate/Red Velvet/Vanilla/Carrot/Wedding, 1kg/1.5kg/2kg/12/24pcs/3tiers, recipes v1.2); 7 inventory items (flour 8kg, butter 2.5kg, cocoa 1.2kg low + rest) + opening balances + 2 reservations; 6 orders mirroring `initialOrders` + quotes/inquiries + payments/expenses + 3 POs + deliveries + feedback + notifications + price history + audit.
Connect UI: `WorkspaceProvider` → `fetch` hooks (`src/lib/api.ts`), drop `Sample workspace` tag. Gate: `orders ≥ 6`, `GET /api/v1/orders` live, create→refresh persists. — **DONE 2026-10-09**: D-06 gate PASS via `server/_d06_gate.ps1` (row+children in Postgres immediately after 201; restart ⇒ cache rebuilt from DB; cleanup to baseline); durability enforced by `flush()` in `server/database/index.new.ts` + response-hold middleware in `server/index.ts`.

## 6. Phase E — Spec gaps (§3–§42 vs today)

Roles/nav (§3-4): static → RBAC tables + `required(perm)` + hide modules. CRM/quotes/orders (§5-12): synthesis → CRUD + `INQUIRY→…→COMPLETED` + audit. Catalogue (§13-15): hard-code → admin + versions + `GET /public/catalogue`. Production (§16-18): partial service → jobs/QC/rework/costs/wastage + shortage→purchase loop. Inventory (§19-21): flat list → ledger + alerts + history. Finance (§22-24): math → payments (M-Pesa stub)/expenses/reports. Delivery (§25): filter → lifecycle. Analytics (§26): static → DB queries. Public site (§28-30): missing → pages + order-proposal (Admin confirm, server validation). WhatsApp (§31): links now, events later. Errors/pagination (§32-33): Phase D standard. Audit (§34): memory → table. Security (§35): harden. TX/migrations/tests (§36-41): Phase D+F.
Order: E1 Orders/CRM/Quotes → E2 Catalogue → E3 Prod/Inv/Purch → E4 Finance/Delivery/Notif → E5 Analytics/Admin → E6 Public+WhatsApp → E7 Staff & Salary.

### 6.1 Added by Updated architecture doc (2026-10-09)

**E1 extension — Customer Order History & Repeat Orders (Updated §5, §40 rules 26–29):**
- Canonical `customer_id` on every order + immutable `order_customer_snapshots` (name/phone/address at order time); name-only matching forbidden; duplicate customers flagged for merge.
- History view from Customers *and* Orders pages: timeline newest→oldest; filters (date range, status, occasion, product/category, payment status); print/export (`GET /customers/:id/order-history/print`) with auth parity.
- Completed orders preserve production snapshots (ingredients, recipe version, prices) — immutable; profile edits never rewrite history.
- **Repeat Order** action → new draft from template (product, options, customization, production specs, notes); original order never mutated; new order number/status history/payment/production records.
- **Recurring event reminders**: `customer_event_reminders` (annual occasions: birthdays, anniversaries, graduations) → internal reminder near the date next year, **never auto-contact the customer**; shown in Notifications area with profile/previous-order links; staff mark Reminded/Contacted + outcome; printable list (next 7/30 days).
- New endpoints: `GET /customers/:id/orders`, `GET|POST /customers/:id/events`, `GET /customer-reminders`, `PATCH /customer-reminders/:id/contacted`.

**NEW E7 — Staff Management & Salary / Remuneration (Updated §18.1–18.8, §40 rules 30–34):**
- Lightweight staff module (identity, roles, schedules/attendance, notes) — explicitly not a full HR suite. New top-level nav group with 9 Admin-only items (Profiles, Attendance, Salary & Remuneration, Periods, Process Salary, Advances & Deductions, Payments, Payslips, Reports).
- Salary/remuneration = **Admin/Proprietor-only** (granular perms, not role-name hardcoding). Default Admin (Manager) view only; other roles see nothing unless granted.
- **Admin-defined payment periods**: weekly, biweekly, monthly, quarterly, custom date ranges — no assumed monthly.
- Workflow: `CREATE PERIOD → SELECT ITEMS → CALCULATE → REVIEW/ADJUST → APPROVE → RECORD PAYMENT → MARK PAID → CLOSE`; statuses `OPEN/PROCESSING/APPROVED/PARTIALLY_PAID/PAID/CLOSED`; closed periods never silently rewritten — adjustment records only.
- Advances/repayments (separate outstanding balance), allowances, deductions, bonuses/commissions; printable payslips, salary statements, period summaries, advance reports (Admin-only download).

### 6.2 Phase D follow-on (migrations + seed for Updated-doc additions)

New migration `008_order_history.sql`: `order_customer_snapshots`, `customer_event_reminders` (+ indexes on `customer_id`, `next_reminder_at`).
New migration `009_staff_remuneration.sql`: `staff`, `staff_attendance`, `salary_profiles`, `remuneration_periods`, `remuneration_items`, `staff_advances`, `remuneration_payments`, `payslips` (FKs to `users`/`roles`, CHECKs on statuses, `period_type` in `weekly|biweekly|monthly|quarterly|custom`).
Seed additions: reminder perms (`customer_reminders.read/create/update`), staff perms (`staff.read/manage`), remuneration perms (`remuneration.view/approve/pay`, `payslip.print`) → mapped to Admin only (+ `staff.read` for Managers); sample: 1 event reminder, 1 closed salary period.

## 7. Phase F — Hardening + handover

### 7.1 Request logging (locked spec)

**One log line per HTTP request** — exactly five fields, nothing more:

1. **source** — always `http`
2. **endpoint** — the TypeScript route path (`req.originalUrl`), e.g. `/api/v1/catalogue/products`. **NEVER** the SQL query text (SQL is noisy and can leak schema/PII into logs).
3. **method** — HTTP method (GET / POST / PUT / PATCH / DELETE)
4. **response time** — e.g. `3.3ms`
5. **response code** — e.g. `200`

Implemented in `server/index.ts` (`logger.request` in `server/utils/logger.ts`); the `pg` pool (`server/database/db.ts`) stays silent. Format: `{ source: 'http', endpoint: '...', method: 'GET', time: '3.3ms', status: 200 }`.

Security §35 all routers, audit §34 coverage, pagination §33 everywhere, vitest critical path (confirm→produce→QC→deliver→pay, cancel, perms), docs (`README/AGENTS/roadmap`), runbook (`db:migrate/seed`, creds rotation, URLs).
Updated-doc hardening: RBAC checks on salary/remuneration + customer-reminder endpoints (Admin-only, rule 30); snapshot-immutability audit (orders history + recipe snapshots never rewritten, rule 27); notification leak tests (supplier costs, private notes, salary never leak to non-authorized roles, §27 leak rules); reminder "internal-only" test (no outbound contact fired automatically).

## 8. Risks + execution

Risks: Lovable resync (no rewrite, stable paths) · 12px→16px churn (per-module) · PG down (JSON fallback) · `workspace.tsx` conflicts (split early) · seed placeholder pw (rotate).
Sequence: `0 Vite switch → C move → D DB+seed → A+B design+themes (parallel E) → E1..E6 → F`. Defaults need confirm: raw `pg`, local `twin_cakery`, JWT bearer, tree `erp/server + erp/erp-interface-design`. Say `approved` to start Phase 0 + C.

## 9. Currency switch KSh → UGX (added 2026-10-08)

Scope: display + data + seed from Kenyan shilling to Ugandan shilling. UGX has no subunits — format whole numbers.
Edits: (1) `src/components/erp/data.ts money()`: `'KSh '+toLocaleString('en-KE')` → `'USh '+toLocaleString('en-UG',{maximumFractionDigits:0})`. (2) `workspace.tsx` Admin → Business settings: currency select `KES — Kenyan shilling` → `UGX — Ugandan shilling` (default first), timezone `Africa/Nairobi (UTC+3)` → `Africa/Kampala (UTC+3)`. (3) `server/database/types.ts`: `Currency = "KES"|"USD"|"TZS"` → `"UGX"|"USD"|"TZS"`. (4) Seed + migrations default currency `UGX`; amounts stay numeric (re-price in UGX during E4 if needed). (5) Spec text `KES` → `UGX` note in docs pass.
Gate: no `KSh/KES/en-KE/Nairobi` in `src/` or `server/` (docs history excepted), UI shows `USh`, tests green.

Risks: Lovable resync (no rewrite, stable paths) · 12px→16px churn (per-module) · PG down (JSON fallback) · `workspace.tsx` conflicts (split early) · seed placeholder pw (rotate).
Sequence: `0 Vite switch → C move → D DB+seed → A+B design+themes (parallel E) → E1..E6 → F`. Defaults need confirm: raw `pg`, local `twin_cakery`, JWT bearer, tree `erp/server + erp/erp-interface-design`. Say `approved` to start Phase 0 + C.
## 10. Production materials — manual consumption entry (added 2026-10-19)

**Gap:** production jobs read ingredients from inventory, but the job dialog only *displays* consumption. Nothing lets a baker enter "used 3 kg flour, 1 L cream" and have stock actually drop. The server pieces already exist (`production_consumption` table, `store.adjustInventory` with `PRODUCTION_CONSUMPTION` type, `publishLowStockAlert`, `ProductionCost` roll-ups) — the wastage route (`POST /jobs/:id/wastage`, perm `production.record_wastage`) is the working model to copy. The existing `businessService.recordConsumption` is unwired (no route), auto-derives entries from *order items* (productIds treated as inventory ids), consumes only reserved quantities and force-advances the job to QUALITY_CHECK — unsuitable; keep it but mark deprecated, don't route to it.

### 10.1 Server
1. **Migration `013_production_consumption.sql`** (mirror 012 pattern, safe re-run): insert permission `production.record_consumption`; map to `role-admin` + `role-production` (seed's production role already owns `production.*`). Add the key to `server/services/rbac.service.ts` allow-list + seed permissions for fresh DBs.
2. **`business.service.ts` → `recordMaterialsUsed(jobId, userId, entries[])`**: per entry `{itemId, quantity, notes?}` — job must exist and be consumable (`IN_PRODUCTION` or `REWORK_REQUIRED`, else 409); inventory item must exist; `quantity > 0` and `<= physicalStock` (409 with item name + available/required, like `reserveStock`); then in one pass: `adjustInventory(itemId, -qty, unit, "PRODUCTION_CONSUMPTION", "Materials used for <orderId>", userId, item.cost, notes)` (stock down + ledger row) → `publishLowStockAlert` → `createProductionConsumption({jobId, itemId, quantity, unit, recipeVersion: job.recipeVersion, unitCost, actualCost, notes})`; release matching `stockReservations` rows (same rule as old `recordConsumption`); finally one `createProductionCost({status:"ACTUAL", ingredientCost: ΣactualCost, total})` row per submission; `store.persist()`.
3. **Route `POST /production/jobs/:id/materials`** (`required("production.record_consumption")`): body `{items:[{itemId, quantity, notes}]}` — 400 on empty array/invalid entries, 404 unknown job/item, 409 bad state/insufficient stock; responds `{consumption:[…]}`.

### 10.2 Frontend (`erp-interface-design`)
4. **`lib/api.ts`**: `recordJobMaterials(id, items)` POST wrapper + `ServerMaterialInput` type (locked in api-map test).
5. **`production-view.tsx` detail dialog — "Materials used" section** replaces the read-only Consumption list:
   - Recorded rows: ingredient name (from `invItems`), qty · unit, actual cost, notes.
   - Entry line: item `<select>` (name + unit + "N in stock"), qty number input, optional notes → **Add** appends to a pending list (remove supported, subtotals shown); inline red warning + submit block when qty > physicalStock (server re-validates).
   - **Record materials used** button → `recordJobMaterials` → refetch jobs + openDetail (consumption/costs) + `listInventoryItems` so stock chips update; RBAC failure → existing "check your permissions" notice.
   - Section visible only for `IN_PRODUCTION` / `REWORK_REQUIRED` jobs; read-only history for the rest.

### 10.3 Gate
`tsc --noEmit` clean; vitest green incl. new `production-materials.test.tsx` (add/remove pending rows, over-stock client block, payload shape on submit); E3-style live pass: start job → record 2 materials → `inventory_items.physical_stock` down, `inventory_transactions` rows typed `PRODUCTION_CONSUMPTION`, ACTUAL cost row present, low-stock alert fires when crossing minimum.





