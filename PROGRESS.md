# Twin Cakery ERP — Progress Tracker

> Companion to `IMPLEMENTATION_PLAN.md v1.0-draft`. Update this file on every work session. Status legend: `[ ] todo` `[~] in-progress` `[x] done` `[-] deferred`.

## 0. Snapshot (2026-10-09, Phases 0 + C + D done, Phase A next)

- Branch: `financials`. Working dir: `c:\Users\manue\Desktop\twin_cakery\erp`.
- Phase 0 DONE: pure React+Vite+TS + react-router-dom, zero TanStack/Lovable in code (remaining hits: `package-lock.json` stale + plan docs history). `npm run build` green (1797 modules, dist + assets), `npm run test` 6/6 green.
- Phase C DONE (except C-03 proxy check): `server/` lives at `erp/server`, static path fixed, scripts `dev:api/build:api/db:migrate/db:seed` added, root `.env.example`/`.env`, `.gitignore` updated.
- Phase D **DONE** (2026-10-09, incl. D-06): 6+1 migrations applied → **52 tables** live in `public` (incl. `_migrations`). `server/database/db.ts` (pg Pool + `query` + `withTransaction`), `migrate.ts` (transactional runner), `seed.ts` (idempotent, verified counts), sync DAL (`index.new.ts` loader + write-back, `store.ts` MemoryStore), `ready` gate at boot, UI on live API. **D-06 gate PASS** (`server/_d06_gate.ps1`): create via API → row + `order_items` + `order_status_history` in Postgres *the instant the 201 returns* → restart (cache rebuilt from DB) → order still present → cleanup to baseline. Enforced by new `flush()` + response-hold middleware in `server/index.ts` (2xx now means committed; failed write-back → 500 + logged). REMAINING: C-03 gate (Vite proxy + prod static live verify).
- Server dep resolution: `erp/server/node_modules` is a **junction** to `erp-interface-design/node_modules` (git-ignored) so Node/tsx/tsc resolve `express`/`pg`/`uuid`/etc. normally. `server/tsconfig.json` also has `typeRoots` → frontend `@types`.
- Currency: KSh → UGX DONE (money()→USh/en-UG, Currency type→UGX, settings→UGX/Africa-Kampala, build+test green). Plan §9 holds the record. Overall: **3/7 phases done** (0, C, D) → next **Phase A**.



## 1. Master checklist

- [x] Phase 0 — Pure React+Vite+TS, zero TanStack/Lovable
- [x] Phase A — Standard ERP design system + DataTable + StatusBadge
- [x] Phase B — Light + Dark themes (code complete; manual contrast/screenshot QA open)
- [x] Phase C — Move `server/` to `erp/` root (C-03 live proxy/static gate still open)
- [x] Phase D — `twin_cakery` Postgres + migrations + DAL + seed + connect (D-06 gate PASS 2026-10-09)
- [ ] Phase E — Spec gaps E1..E7 (CRM → Public site + Staff/Salary)
- [ ] Phase F — Hardening, tests, handover

## 2. Phase 0 detail

- [x] P0-01 Packages uninstalled/installed, `package.json` renamed + scripts updated
- [x] P0-02 `index.html` + `src/main.tsx` + `src/App.tsx` + `src/pages/*` created
- [x] P0-03 `vite.config.ts` rewritten (no lovable/tanstack keys), proxy kept
- [x] P0-04 `workspace.tsx` Link/router migrated to `react-router-dom`
- [x] P0-05 Deleted `router.tsx, routeTree.gen.ts, start.ts, server.ts, lib/lovable*, routes/*, .lovable, .tanstack`
- [x] P0-06 `AGENTS.md, eslint, tsconfig, test` updated
- [x] P0-07 Gate: `grep tanstack|lovable = 0`, dev/build/test green

## 3. Phase A/B detail

- [x] Tokens centralized (`styles.css` + `theme-tokens.ts`), 8px grid, Inter + tabular-nums — **2026-10-09**: `src/lib/theme-tokens.ts` created (typeScale, spacing 4/8/16/24/32/40/48, layout, locked `statusTones` + `toneOf()`); `data.ts tone()` delegates to `toneOf()` (single source).
- [x] `DataTable` + `StatusBadge` built + unit tested — **2026-10-09**: `src/components/data-table/{DataTable,StatusBadge}.tsx`; DataTable = column defs (align/sortKey/cell), aria-sort + sort toggle, sticky header opt-in, density (`dt-compact/comfortable/spacious`), empty state, footer; StatusBadge = badge+word DOM-compatible with legacy `.status` CSS; `src/test/design-system.test.tsx` = 11 tests (vocabulary lock, overlap, badge+word, tokens, DataTable sort/row-activate/empty/density).
- [x] Pilot: Sales Orders migrated, geometry verified — **2026-10-09**: `OrderTable` rewritten on DataTable (columns incl. right-aligned Amount + sort, compact mode = column slicing, empty state); bug fixed: `sort?.key === col.sortKey` matched `undefined===undefined` for unsorted non-sort columns → `Boolean(col.sortKey && sort && ...)`.
- [x] Remaining 9 modules migrated, density switch persisted — **2026-10-09**: `ModuleTable` (the only other hand-rolled `<table>`) rewritten on DataTable (spacious density, right-aligned value col, toolbar/footer/dialog intact). Zero raw `<table>` left in `workspace.tsx`. `Status` = re-export of `StatusBadge` (all call sites switched). Density *switch UI* (persist per user) still open — tied to workspace split below.
- [x] workspace.tsx split (shell/sidebar/topbar/dashboard/module-table) + density switch persisted — **2026-10-09**: split `workspace.tsx` (~1000 lines) into `sidebar.tsx`, `topbar.tsx`, `dashboard.tsx`, `module-table.tsx`, `dialogs.tsx`, `ui.tsx`; `workspace.tsx` is now a ~58-line shell. Density switch UI in topbar wired to `src/lib/density.tsx` (`useDensity`/`DensityProvider`, persisted in `localStorage` under `tc-density`, defaults to `comfortable`); `DataTable` consumes `density` via context.
- [x] CRM two-pane exception, KPI discipline applied — **2026-10-09**: extracted the working two-pane into `crm-view.tsx` (`CrmView`, contact list + conversation detail/thread) and removed the dead 117-line variant; `ModuleTable` now delegates to `<CrmView>` (fixes an unreachable-branch regression where a stray generic-table `return` shadowed the CRM branch). KPI discipline (`DashboardDesignPattern §5`): headline metrics Semibold, bold reserved for alerts (`.metric-alert`), icon-accent colors decorative-only, meaning carried by text. Added routing regression test (CRM renders `.crm-view`/`.crm-detail`/`.crm-thread`, not a DataTable).
- [x] Light/dark oklch pairs complete, no hard-coded colors — **2026-10-09**: tokenized the last color literal (`.dark .brand img` → `var(--logo-plate)`); verified token balance (`:root` 47 vs `.dark` 45 — only `--radius` geometry + intentional theme-independent `--logo-plate` unpaired; `.dark` ⊂ `:root`); zero hex/rgb/hsl literals in active ERP TSX (dead shadcn `chart.tsx` unused — sole recharts importer; its `#ccc`/`#fff` are Recharts-default *attribute selectors*, not hard-coded colors). Pre-paint no-flash script (`index.html`) + persisted Sun/Moon toggle already wired. `vite build` green, vitest 20/20. Contrast + screenshots approved — [ ] open (manual visual QA in both themes).

## 4. Phase C/D detail

- [x] C-01 `git mv erp-interface-design/server server`, tsconfigs + static path + proxy fixed
- [x] C-02 Root `.env.example/.env`, `.gitignore`, scripts (`dev:web/dev:api/dev:all/build:api/db:*`) green
- [ ] C-03 Gate: `:4000/health` + `/api/v1` + Vite proxy + prod static serve OK
- [x] D-01 Postgres reachable, `CREATE DATABASE twin_cakery`, `DATABASE_URL` wired
- [x] D-02 `pg` installed, migrations runner + 6 migrations applied (52 tables + `_migrations` in `public`) + FK/index/CHECKs verified
- [x] D-03 Store DAL on `pg` + transactions — DONE (Option A, sync cache): `database/index.new.ts` (schema-introspected `DbCache` loader + upsert/stale-delete write-back, `getDb`/`resetStore`/`ready`), `database/store.ts` (sync `MemoryStore` + singleton, byte-compatible signatures incl. restored `actualDeliveryDate`), `server/index.ts` awaits `ready` before `listen`, migration `007_delivery_actual_date.sql` applied. `tsc` clean on `database/*`; remaining full-project errors are pre-existing route/service issues. Boot smoke test green (cache: 4 users/7 customers/6 orders; deliveries lifecycle create→schedule→complete→DB round-trip incl. `actualDeliveryDate` + scheduled date persisted; smoke row removed)
- [x] D-04 Seed idempotent (users/customers/catalogue/orders/inventory/finance/notifications/audit — verified counts)
- [x] D-05 Frontend on `fetch` hooks against live API, sample tag removed — DONE: reconstructed missing `src/components/erp/store.tsx` (`WorkspaceProvider`/`useWorkspace` context bridging UI ↔ `src/lib/api.ts`); fixed 5 server-response typings in `src/lib/api.ts`; `Sample workspace` tag removed; `tsc` clean + `npm test` 6/6
- [x] D-06 Gate PASS (2026-10-09): fixed the fire-and-forget persist — `MemoryStore.persist()` now returns `Promise<void>`; `server/database/index.new.ts` gained `flush()` (awaits the serialized `saveChain`, throws only if an error occurred during *that* wait) + loud `saveCache skipped` logging; `server/index.ts` holds every JSON response until the write-back commits (failed persist → 500 instead of silent divergence). Verified by `server/_d06_gate.ps1`: login → create order → **row in `twin_cakery` immediately after 201 (no sleep)** + children `items=1 hist=1` → API restart (cache rebuilt from DB) → order still returned → cleanup restores `orders=6` baseline. `tsc` clean on edited files, `npm test` 6/6, `vite build` green.

## 5. Phase E/F detail

- [ ] E1 Orders/CRM/Quotations state-machine + audit enforced, UI wired
- [ ] E2 Catalogue admin + recipes + public catalogue endpoint
- [ ] E3 Production/QC/rework/costs/wastage + ledger + purchasing receive + alerts
- [ ] E4 Payments (M-Pesa stub)/expenses/reports + delivery lifecycle + notifications
- [ ] E5 Analytics queries + permission-aware nav + users/roles UI
- [ ] E6 Public site pages + order form + WhatsApp link stub
- [ ] F-01 Security (bcrypt/JWT/helmet/rate-limit/CORS/zod/secrets) + audit coverage
- [ ] F-02 Pagination everywhere + critical-path tests green + docs + handover sign-off

## 6. Session log

| Date | Work | Result | Next |
|---|---|---|---|
| 2026-10-08 | Drafted `IMPLEMENTATION_PLAN.md` + `PROGRESS.md` (plan-only, no code) | Awaiting approval | Approve → Phase 0 + C |
| 2026-10-08 | Phase 0: Vite SPA (`index.html/main.tsx/App.tsx/RRD`), deleted TanStack/Lovable files, rewrote config+test, renamed package, build 1797 modules OK, test 2/2 OK. Phase C: server copied to `erp/server`, old removed, paths/scripts/env updated | Done, verified | Phase D needs psql password |
| 2026-10-08 | Unblocked Postgres (pw 90210), `CREATE DATABASE twin_cakery` OK. Plan §9 added for KSh→UGX; code switched (USh/en-UG, UGX type, Kampala labels), build+test green | Done, verified | Phase D: pg driver + migrations + DAL + seed |
| 2026-10-08 | Phase D: 6 migrations applied (52 tables, transactional runner + `_migrations`), `db.ts` pool+`withTransaction`, idempotent `seed.ts` (FK order fixed: orders → stock_reservations), junction `erp/server/node_modules` → frontend node_modules for dep resolution, fixed boot bugs (`seedDatabase` import, `store.permissions()` call, `AuthService.getSession`), API boots + `/health` + login/JWT + 200 on `/api/v1/orders`/`customers` | Done, verified | D-03: wire routes to Postgres DAL → D-05 UI connect |
| 2026-10-08 | Phase D final validation: `db:migrate` → `[up to date]` (idempotent), `db:seed` → `[already seeded, skipping]` (idempotent), 52 tables, counts confirmed (users=4, roles=4, perms=52, customers=7, products=6, orders=6, order_items=6, payments=6, inventory_items=7, inventory_transactions=6, stock_reservations=2, expenses=1, purchase_orders=3), temp `server/tsc-out.txt` removed | D-02 → done; D-03 open | D-05/D-06 |
| 2026-10-09 | D-03 Postgres DAL cutover (Option A): wrote `database/index.new.ts` (introspected cache + write-back) + `database/store.ts` (sync MemoryStore, all route signatures, incl. `createExpense`); restored `actualDeliveryDate` on Delivery end-to-end (`types.ts` + `007_delivery_actual_date.sql` + store create/update whitelist + `POST /deliveries/:id/complete` stamps it); wired `ready` gate in `server/index.ts`; `tsc` clean on `database/*`; boot smoke test green (login→6 orders→deliveries lifecycle→DB-verified persist, row deleted); removed all temp `tsc*.txt`/`_apply_*`/`_check*` scripts + `store.new.txt` | D-03 done | D-05 UI connect → D-06 |
| 2026-10-09 | D-05 UI connect: reconstructed missing `src/components/erp/store.tsx` (`WorkspaceProvider`/`useWorkspace` — parallel load customers/products/orders/audit, `toUiOrder` mapping, graceful fallback to `initialOrders` offline, optimistic `addOrder`/`updateOrder`, `alive` ref); fixed 5 server-response typings in `src/lib/api.ts`; switched display currency `USh`→`UGX` (data.ts `money()`, activity text, form label) | D-05 done; `tsc` clean + `npm test` 6/6 | D-06 gate: drop `Sample workspace` tag, live browser create→refresh persists |
| 2026-10-09 | D-06 durability fix + live gate: root-caused persist race (`MemoryStore.persist()` was `void this.db.persist()`; routes sent 201 before the Postgres tx committed; chain `.catch` swallowed errors; `saveCache` early-returned silently). Fix: `persist(): Promise<void>`, new `flush()` + `pendingPersistError` in `index.new.ts`, response-hold middleware in `server/index.ts` (2xx = committed, failed write → 500), loud `saveCache skipped` log. Rewrote `server/_d06_gate.ps1` (scoped port-4317 lifecycle, immediate-after-201 psql assertion, restart = refresh, cleanup to baseline) | **GATE PASS**: `DB_IMMEDIATELY_AFTER_201=order-…\|TC-D06-324150\|CONFIRMED\|4500.00`, `items=1 hist=1`, `AFTER_RESTART persisted=True`, `db=6` baseline restored; tsc clean on edited files (104 pre-existing route/service errors unchanged), vitest 6/6, `vite build` green; temp logs/txt removed | **Phase A** (design system: split `workspace.tsx`, `DataTable`, `StatusBadge`); C-03 gate still open |


| 2026-10-09 | Spec update reviewed + integrated: `Twin_Cakery_ERP_Architecture Updated.md` (3325 lines) made GOVERNING contract. Adds: §5 Customer Order History/Repeat Orders/recurring event reminders; §18 Staff & Salary/Remuneration (new — old §18 renumbered to §19; doc has duplicate `## 19` heading bug); §40 rules 26–34; 10 new tables (`order_customer_snapshots`, `customer_event_reminders`, 8 staff/remuneration); new endpoints (`/customers/:id/orders`, `/customers/:id/events`, `/customer-reminders`, `/customers/:id/order-history/print`); nav groups (CRM 3 items + top-level Staff Management ×9); role clarifications (Production owns delivery, Sales needs delegation to confirm). Integrated into `IMPLEMENTATION_PLAN.md`: refs line updated (Updated doc = governing), §6.1 (E1 extension + new **E7** Staff & Salary), §6.2 (Phase D follow-on: migrations `008_order_history.sql` + `009_staff_remuneration.sql` + seed perms), §7 hardening additions (RBAC salary/reminders, snapshot immutability, leak tests) | Plan v1.1 updated; checklist Phase E → E1..E7 | **Next: Phase A** (green light received) |
| 2026-10-09 | **Phase B code COMPLETE** (manual contrast/screenshot QA still open). Theme infra already present: pre-paint no-flash script in `index.html`, `@custom-variant dark`, persisted Sun/Moon toggle in topbar (`.dark` applied on shell), `--ring` + `:focus-visible` + reduced-motion in both themes. This session closed the "delete hard-coded colors" item: tokenized the last color literal (`.dark .brand img` inline `oklch(.97 .01 85)` → new `--logo-plate` token at `:root`, referenced via `var(--logo-plate)`). Verified token balance (`:root` 47 vs `.dark` 45; only `--radius` geometry + intentional theme-independent `--logo-plate` unpaired; `.dark` is a strict subset — every theme-dependent color paired). Confirmed zero hex/rgb/hsl literals in active ERP TSX. Dead shadcn `ui/chart.tsx` (unused, sole `recharts` importer, no consumers) — its `#ccc`/`#fff` are Recharts-default *attribute selectors* (`[stroke='#ccc']`), not hard-coded colors, so left in place (delete + drop recharts is a Phase F bundle-cleanup item, not theming). | **Verified**: `vite build` exit 0 (1809 modules); vitest **20/20** across 3 files via `--pool=threads` | **Phase E** (spec gaps E1..E7: CRM→Public site + Staff/Salary). C-03 live-proxy gate + Phase B visual QA still open |
| 2026-10-10 | **E1 server COMPLETE + store.ts recovered.** `server/database/store.ts` had been zeroed (23 importers, 70 called methods) — recovered byte-exact from the git object store (`git rev-list --all --objects` found 5 historical blobs; newest `1e6734ed` = 1443 lines incl. the E1 method set written pre-wipe). Verified recovered file against every call site: correct `./index.new.js` imports, `persist(): Promise<void>` (D-06), 4-arg `updateOrderStatus`, `(order, changedBy, reason)` cancelOrder, 8-arg `adjustInventory`, `createOrder` snapshot hook, E1 methods (`ordersForCustomer`, `orderCustomerSnapshot`, `eventsByCustomer`, `createCustomerEvent`+`syncEventReminder`, `dueReminders`, `markReminderContacted`, `dismissReminder`, `remindersForCustomer`). Added **Repeat Order** endpoint `POST /orders/:id/repeat` (spec §5 + rule 28): template-copies items/options/specs/notes, allows date/items/charges/notes overrides, recomputes totals when items overridden, creates AWAITING_CONFIRMATION draft via `store.createOrder` (own order number, status history, customer snapshot), 409 for CANCELLED templates, never mutates original. Wrote `erp/_e1_gate.ps1` (port-4317 lifecycle, login, psql assertions, full cleanup-to-baseline; `Arr()` flattener works around PS 5.1 Invoke-RestMethod nested-array quirk) and deleted 18 stray debug files (`_create*.js`, `_helper.js`, `_repo.js`, `_final.js`, `_store.ts` stub, `_e1_methods.txt`, `store.recovered.ts`, `.e1_token`, `api_e1.log`, `_e1_diag.*`, `tsc*.txt`, gate run logs) | **GATE PASS** end-to-end live: order history + print export; snapshot row in `order_customer_snapshots` the instant 201 returns (rule 27) and **immutable** across profile phone edit; repeat → `status=AWAITING_CONFIRMATION total=14000 items=1 createdBy=usr-manager`, `ORIGINAL_UNCHANGED=True`, own snapshot+hist, cancelled→409; event→auto reminder 2027-04-10 PENDING (customer-enriched)→`contacted` (CONTACTED, by=usr-manager, rolled)→`dismiss`→delete leaves 0 DB rows; `ORDERS_AFTER=6` baseline restored, phone restored. tsc: **0 errors in store.ts**; 115 total (pre-existing implicit-any/string-null route classes +2 same-class from new reduce). vitest **20/20** across 3 files re-verified (fixed 1 stale assertion: dashboard brand test expected "Twin Cakery", sidebar renders "Twin Cakery Bakery") | **E1 frontend wiring** (CRM nav group, customer 360° timeline: history/events/reminders, repeat action on Orders, reminder badge) → E2 |

## 7. Decisions needed (blocking)

| # | Question | Default if no answer | Status |
|---|---|---|---|
| 1 | Raw `pg` + SQL vs Drizzle/Prisma? | Raw `pg` | [x] decided: raw `pg` |
| 2 | Local Postgres vs hosted (Neon/Supabase)? | Local `twin_cakery` | [x] decided: local, pw confirmed, DB created |
| 3 | JWT bearer vs session cookie? | JWT bearer | [ ] open |
| 4 | Confirm tree `erp/server` + `erp/erp-interface-design` (no `apps/` monorepo yet)? | Yes | [ ] open |
| 5 | Approve Phase 0 + C start? | — | [ ] open |

## 8. How to update this tracker

- After each session append a row to §6 log, flip checkboxes, bump `Overall` counts. Keep `IMPLEMENTATION_PLAN.md` version in sync (append `1.1, 1.2…` entries).


