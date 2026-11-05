---
document: optimization-progress
plan: ./Optim.md
updated_by_skill: optim
script: ../skills/optim/scripts/progress.js
generated: 2026-10-31
---

# Optimization Progress

Maintained by the `optim` skill. Percentages in the summary are recomputed by `skills/optim/scripts/progress.js` from the checkboxes below. **Do not edit the summary table by hand.**

Checkbox legend: `[ ]` not started, `[~]` in progress (counts 0), `[x]` done, `[-]` not applicable (removed from the total; give the reason on the same line).

## Summary

<!-- SUMMARY:BEGIN -->
| Module | Status | General | UI | Overall |
|---|---|---|---|---|
| Security & RBAC (`SEC`) | In progress | 8/14 (57%) | 3/5 (60%) | 58% |
| Orders (`ORD`) | In progress | 2/12 (17%) | 0/6 (0%) | 11% |
| Quotations & inquiries (`QUO`) | In progress | 2/9 (22%) | 0/4 (0%) | 15% |
| Production (`PROD`) | In progress | 2/10 (20%) | 0/6 (0%) | 13% |
| Inventory (`INV`) | In progress | 2/9 (22%) | 0/4 (0%) | 15% |
| Purchasing & payables (`PUR`) | In progress | 4/10 (40%) | 0/3 (0%) | 31% |
| Deliveries (`DEL`) | In progress | 3/12 (25%) | 0/6 (0%) | 17% |
| Finance (`FIN`) | In progress | 6/13 (46%) | 0/7 (0%) | 30% |
| Analytics (`ANA`) | In progress | 2/12 (17%) | 0/2 (0%) | 14% |
| Notifications & audit (`NOT`) | In progress | 4/13 (31%) | 0/2 (0%) | 27% |
| Customers, CRM & feedback (`CRM`) | Not started | 0/11 (0%) | not generated | 0% |
| Catalogue & recipes (`CAT`) | Not started | 0/8 (0%) | not generated | 0% |
| Staff & payroll (`STF`) | Not started | 0/7 (0%) | not generated | 0% |
| Public website & web users (`WEB`) | In progress | 4/9 (44%) | 0/1 (0%) | 40% |
| Architecture & cross-cutting (`ARC`) | In progress | 4/13 (31%) | 0/1 (0%) | 29% |
<!-- SUMMARY:END -->

## Activity log

| Date | Module | Step / item | Note |
|---|---|---|---|
| 2026-10-31 | SEC | SEC-00 Reconcile with source document and code | Reviewed Optim/Optim_security_rbac.md against current code |
| 2026-10-31 | SEC | SEC-01 [P0] requirePermission(perm) middleware, deny by default | Already in place in middleware/auth.ts and api.ts |
| 2026-10-31 | SEC | SEC-02 [P0] Close unprotected and fake-protected routes | purchasing.ts POST/PATCH/DELETE permissions corrected; deliveries.ts PATCH corrected to deliveries.update |
| 2026-10-31 | SEC | SEC-03 [P0] Rate limiting on login, register, reset-credentials, public forms | Added authRateLimit to /login, /register, /reset-credentials; publicRateLimit to /inquiries, /order-proposals; verified 429 after 10 requests |
| 2026-10-31 | SEC | SEC-04 [P0] Remove dev password fallback and lock down registration | claim-admin registration hardened (deny-by-default, email uniqueness, no dev password fallback); auth.ts ignores role/isAdmin from body |
| 2026-10-31 | SEC | SEC-05 [P0] CORS allowlist, helmet, env-based config | CORS allowlist with FRONTEND_ORIGIN env var; helmet with CSP; X-Powered-By removed; FRONTEND_ORIGIN added to .env |
| 2026-10-31 | SEC | SEC-13 [P0] Server permission-matrix tests | Pending — requires test harness (ARC-01) |
| 2026-10-31 | ARC | ARC-00 Reconcile with source document and code | Reconciled architecture plan |
| 2026-10-31 | ARC | ARC-01 [P0] Server test harness first | Added vitest config, scripts and harness test to server |
| 2026-10-31 | SEC | SEC-13 [P0] Server permission-matrix tests | Protected surface tests confirm deny-by-default with 401s |
| 2026-11-05 | ARC | Postgres-mandatory persistence hardening (code) | `server/database/index.new.ts`: `loadCache` now Postgres-authoritative (no `store.json` as source; throws on load failure), `saveCache/flush` fail hard on DB error (no file fallback), debug file snapshot only behind `ERP_ALLOW_FILE_SNAPSHOT`. Route modules parse-checked. **Restart + runtime/E2E verification pending.** |
| 2026-11-05 | ARC | Data migration script (point 6, executed) | Added/extended `server/scripts/migrate-store-json-to-pg.ts` (idempotent, non-destructive, FK-aware upserts; orphan-customer placeholder handling). Executed against configured Postgres; 112 `notification_templates` upserted; current `server/data/store.json` lacks `TEST-123`/`c1` so that specific historical order was not migrated from the current file. DB integrity checked: Tracy + `role-admin` durable; roles/perms/templates present. |
| 2026-11-05 | SEC/ORD/INV/DEL/PROD+ | DB-unavailable hard-fail + critical DB writes (code) | DB-mandatory/direct writes for auth `user-count`+`claim-admin` (Postgres user/`user_roles`), `rbac.service` permissions (no store fallback), orders create/repeat/confirm/cancel+status history, payments webhook/callback/reverse+recompute, inventory item/adjustment ledger/reservation inserts. Across remaining critical route write paths: handlers `async` + `store.persist(); await flush()` returning `503` on DB unavailability (production, deliveries, quotations, customers/CRM, purchasing, RBAC writes, staff, remuneration, inquiries, feedback, order-proposals, catalogue, notifications, expenses, public/finance/analytics, etc.). All route modules parse clean. **Full `businessService` DB-native refactor, DB-backed reads, stock-model authority, restart + E2E + 503-on-DB-down integration tests still pending.** |

---

## Security & RBAC (`SEC`)

<!-- MODULE:SEC:BEGIN -->

- **Status:** In progress
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** [`Optim/Optim_security_rbac.md`](./Optim_security_rbac.md)
- **Branch / commit range:** sec-p0-20261031

### General checklist (mirrors the plan)

- [x] SEC-00 Reconcile with source document and code
- [x] SEC-01 [P0] One shared `requirePermission(perm)` middleware, deny by default
- [x] SEC-02 [P0] Close unprotected and fake-protected routes
- [x] SEC-03 [P0] Rate limiting on login, register, reset-credentials and public forms
- [x] SEC-04 [P0] Remove dev password fallback and lock down registration
- [x] SEC-05 [P0] CORS allowlist, helmet, env-based config
- [x] SEC-06 [P1] Real sessions: random hashed tokens in a `sessions` table
- [~] SEC-07 [P3] Split and rename permissions to match actions
- [~] SEC-08 [P3] New roles: Finance/Accountant, Baker/Decorator, Delivery/Driver
- [ ] SEC-09 [P3] Record-level scoping
- [ ] SEC-10 [P3] Approval (maker-checker) framework
- [ ] SEC-11 [P3] Audit security events and permission changes
- [ ] SEC-12 [P3] Permission-aware UI and role management screen
- [x] SEC-13 [P0] Server permission-matrix tests

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
- [x] UI-SEC-01 [NEW] Role-permission matrix (roles as columns, resource.action rows, toggle with confirm + reason) → supports SEC-12
  - [ ] Target confirmed: erp-interface-design/src/components/erp/roles-view.tsx (or new component)
  - [ ] Data source: GET /rbac/roles, GET /rbac/permissions, PUT/POST to update role permissions
  - [ ] States: empty, loading, error, forbidden
  - [ ] Permission gating: visible only with rbac.manage or admin
  - [ ] Responsive/theme/accessibility: follows design system, keyboard accessible
  - [ ] Live update: not critical for config screen
  - [ ] Test: component test + permission test

- [x] UI-SEC-02 [NEW] User list with role assignment, active session list, 'revoke all sessions' → supports SEC-06
  - [ ] Target confirmed: erp-interface-design/src/components/erp/staff-view.tsx (or users panel)
  - [ ] Data source: GET /auth/users, GET /auth/sessions, POST /auth/sessions/revoke
  - [ ] States: empty, loading, error, forbidden
  - [ ] Permission gating: admin only
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: refresh sessions on revoke
  - [ ] Test: permission test

- [ ] UI-SEC-03 [ADJUST] Hide nav items and actions the user cannot perform via usePermission() → supports SEC-12
  - [ ] Target confirmed: erp-interface-design/src/components/erp/sidebar.tsx, workspace.tsx
  - [ ] Data source: permission context from auth
  - [ ] States: loading (permissions), forbidden (hidden)
  - [ ] Permission gating: client-side gating + server enforcement
  - [ ] Responsive/theme/accessibility: maintains layout
  - [ ] Live update: N/A
  - [ ] Test: nav-permissions test

- [ ] UI-SEC-04 [ADJUST] Lockout/429 message with countdown; no role hints on failure → supports SEC-03
  - [ ] Target confirmed: erp-interface-design/src/pages/LoginPage.tsx
  - [ ] Data source: auth error responses
  - [ ] States: error with retry-after/countdown
  - [ ] Permission gating: public
  - [ ] Responsive/theme/accessibility: accessible error messages
  - [ ] Live update: countdown timer
  - [ ] Test: login error handling

- [x] UI-SEC-05 [NEW] Reusable ApprovalRequestDialog and approvals inbox entry → supports SEC-10
  - [ ] Target confirmed: erp-interface-design/src/components/erp/dialogs.tsx
  - [ ] Data source: approvals API (to be added)
  - [ ] States: empty, loading, error, forbidden
  - [ ] Permission gating: role-based
  - [ ] Responsive/theme/accessibility: modal accessible
  - [ ] Live update: inbox updates on new approvals
  - [ ] Test: approval flow test
<!-- UI-CHECKLIST:END -->

### Notes and blockers

- **2026-11-05 (code, parse/DB-checked; restart+E2E pending):** Admin access restored in Postgres (Tracy `usr-1793879905686-c21f` + `role-admin` verified). `GET /auth/user-count` is DB-mandatory; `POST /auth/claim-admin` bootstraps/persists admin + `role-admin` directly to Postgres (hard-fail on DB error) with empty-DB recovery; no store/file fallback. `rbac.service.getPermissionsForUser` is Postgres-mandatory. Frontend `App.tsx` skips `/claim-admin` redirect when a stored auth token exists.

<!-- MODULE:SEC:END -->

## Orders (`ORD`)

<!-- MODULE:ORD:BEGIN -->

- **Status:** In progress
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** [`Optim/Optim_orders.md`](./Optim_orders.md)
- **Branch / commit range:** optim/ord-p0

### General checklist (mirrors the plan)

- [x] ORD-00 Reconcile with source document and code
- [~] ORD-01 [P0] Whitelist PATCH fields; make `paymentStatus` derived only
- [~] ORD-02 [P2] Server-side pricing on POST and `/repeat`
- [ ] ORD-03 [P3] Replace generic status PATCH with action endpoints
- [ ] ORD-04 [P3] Timestamps and numbering migration
- [ ] ORD-05 [P4] Reschedule with reason code
- [ ] ORD-06 [P4] Order amendments (change requests)
- [ ] ORD-07 [P3] Remove silent catches and dead status/station sync
- [ ] ORD-08 [P5] Comments, assignee and handoff status on orders
- [ ] ORD-09 [P5] Order analytics feeds
- [ ] ORD-10 [P2] Order tests
- [x] ORD-11 [P2] Fix order confirmation reverting to pending

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
- [ ] UI-ORD-01 [ADJUST] Payment badge read-only and derived; remove editable total/payment/status controls → supports ORD-01
  - [ ] Target confirmed: erp-interface-design/src/components/erp/workspace.tsx
  - [ ] Data source: order derived payment status
  - [ ] States: loading, error
  - [ ] Permission gating: read-only
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: updates on payment changes
  - [ ] Test: payment badge test
- [ ] UI-ORD-02 [NEW] Reschedule dialog and Cancel dialog → supports ORD-05
  - [ ] Target confirmed: erp-interface-design/src/components/erp/dialogs.tsx
  - [ ] Data source: orders API
  - [ ] States: loading, error
  - [ ] Permission gating: orders.reschedule
  - [ ] Responsive/theme/accessibility: modal accessible
  - [ ] Live update: N/A
  - [ ] Test: reschedule dialog test
- [ ] UI-ORD-03 [NEW] Amendment dialog showing price delta → supports ORD-06
  - [ ] Target confirmed: erp-interface-design/src/components/erp/workspace.tsx
  - [ ] Data source: orders API
  - [ ] States: loading, error
  - [ ] Permission gating: orders.amend
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: amendment dialog test
- [ ] UI-ORD-04 [NEW] Order timeline and comments panel → supports ORD-08
  - [ ] Target confirmed: erp-interface-design/src/components/erp/workspace.tsx
  - [ ] Data source: order timeline/comments API
  - [ ] States: empty, loading, error
  - [ ] Permission gating: orders.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: updates on new comments
  - [ ] Test: timeline test
- [ ] UI-ORD-05 [ADJUST] Price display read-only preview; override needs permission → supports ORD-02
  - [ ] Target confirmed: erp-interface-design/src/components/erp/dialogs.tsx
  - [ ] Data source: pricing API
  - [ ] States: loading, error, forbidden
  - [ ] Permission gating: orders.price_override
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: pricing test
- [ ] UI-ORD-06 [ADJUST] Status badge and filters → supports ORD-03
  - [ ] Target confirmed: erp-interface-design/src/components/erp/module-table.tsx
  - [ ] Data source: orders API
  - [ ] States: loading, error
  - [ ] Permission gating: orders.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: updates on status changes
  - [ ] Test: filters test
<!-- UI-CHECKLIST:END -->

### Notes and blockers

- **2026-11-05 (code, parse-checked; restart+E2E pending):** `routes/orders.ts` create/repeat/confirm/cancel now persist `orders`/`order_items`/`order_status_history` directly to Postgres with `503` on DB unavailable; `store.ts` legacy `updateOrderStatus` has best-effort caught DB side effects. `PATCH` remains whitelist/hybrid (not fully DB-direct). `erp-interface-design` `store.tsx`/`App.tsx` changes (status normalization/API transitions, claim-admin token guard) uncommitted; full Pending→Confirmed UI flow not re-verified this session.

<!-- MODULE:ORD:END -->

## Quotations & inquiries (`QUO`)

<!-- MODULE:QUO:BEGIN -->

- **Status:** In progress
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** [`Optim/Optim_quotations.md`](./Optim_quotations.md)
- **Branch / commit range:** _set by the skill when work starts_

### General checklist (mirrors the plan)

- [ ] QUO-00 Reconcile with source document and code
- [x] QUO-01 [P2] Fix PATCH no-op; whitelist fields
- [x] QUO-02 [P2] Attribute quotes to the session user
- [ ] QUO-03 [P2] Server-priced lines and separate `quotations.send`
- [ ] QUO-04 [P4] Versions and expiry
- [ ] QUO-05 [P4] One-click convert-to-order
- [ ] QUO-06 [P5] PDF and WhatsApp-ready quote
- [ ] QUO-07 [P5] Funnel events and notifications
- [ ] QUO-08 [P2] Quotation tests

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
- [ ] UI-QUO-01 [ADJUST] Edits actually persist; show saved/dirty state and last-saved-by → supports QUO-01
  - [ ] Target confirmed: erp-interface-design/src/components/erp/quotes-view.tsx
  - [ ] Data source: quotations API
  - [ ] States: loading, error, dirty/saved
  - [ ] Permission gating: quotations.update
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: quote editor test
- [ ] UI-QUO-02 [NEW] Version tabs with diff and revert → supports QUO-04
  - [ ] Target confirmed: erp-interface-design/src/components/erp/quotes-view.tsx
  - [ ] Data source: quotation versions API
  - [ ] States: loading, error
  - [ ] Permission gating: quotations.update
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: versioning test
- [ ] UI-QUO-03 [NEW] Expiry chip, Convert to order, send dialog → supports QUO-05
  - [ ] Target confirmed: erp-interface-design/src/components/erp/quotes-view.tsx
  - [ ] Data source: quotations API
  - [ ] States: loading, error
  - [ ] Permission gating: quotations.convert
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: convert test
- [ ] UI-QUO-04 [NEW] Inquiry SLA badge and unanswered filter → supports QUO-07
  - [ ] Target confirmed: erp-interface-design/src/components/erp/inquiries-view.tsx
  - [ ] Data source: inquiries API
  - [ ] States: empty, loading, error
  - [ ] Permission gating: inquiries.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: updates on new inquiries
  - [ ] Test: SLA badge test
<!-- UI-CHECKLIST:END -->

### Notes and blockers

_none_

<!-- MODULE:QUO:END -->

## Production (`PROD`)

<!-- MODULE:PROD:BEGIN -->

- **Status:** In progress
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** [`Optim/Optim_production.md`](./Optim_production.md)
- **Branch / commit range:** _set by the skill when work starts_

### General checklist (mirrors the plan)

- [ ] PROD-00 Reconcile with source document and code
- [x] PROD-01 [P2] Job state machine with guards on start/complete
- [x] PROD-02 [P2] Persist real QC results and stop the QC bypass
- [ ] PROD-03 [P3] Job timestamps and QC/consumption schema
- [ ] PROD-04 [P4] Recipe explosion into planned consumption
- [ ] PROD-05 [P4] Fix job costing
- [ ] PROD-06 [P4] Capacity planning
- [ ] PROD-07 [P5] Production notifications and SLA hooks
- [ ] PROD-08 [P5] Production analytics feeds
- [ ] PROD-09 [P2] Production tests

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
- [ ] UI-PROD-01 [ADJUST] Job actions enabled only from valid states; clear disabled reasons → supports PROD-01
  - [ ] Target confirmed: erp-interface-design/src/components/erp/production-view.tsx
  - [ ] Data source: production API
  - [ ] States: loading, error, forbidden
  - [ ] Permission gating: production.manage
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: updates on status changes
  - [ ] Test: job actions test
- [ ] UI-PROD-02 [ADJUST] Real QC form with result/checklist/photo/rework → supports PROD-02
  - [ ] Target confirmed: erp-interface-design/src/components/erp/production-view.tsx
  - [ ] Data source: QC API
  - [ ] States: loading, error
  - [ ] Permission gating: production.qc
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: QC form test
- [ ] UI-PROD-03 [NEW] Week calendar with capacity bars → supports PROD-06
  - [ ] Target confirmed: erp-interface-design/src/components/erp/production-view.tsx
  - [ ] Data source: production schedule API
  - [ ] States: loading, error
  - [ ] Permission gating: production.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: updates on schedule changes
  - [ ] Test: calendar test
- [ ] UI-PROD-04 [NEW] Printable daily production sheet → supports PROD-06
  - [ ] Target confirmed: erp-interface-design/src/components/erp/production-view.tsx
  - [ ] Data source: production jobs API
  - [ ] States: loading, error
  - [ ] Permission gating: production.view
  - [ ] Responsive/theme/accessibility: print styles
  - [ ] Live update: N/A
  - [ ] Test: print test
- [ ] UI-PROD-05 [NEW] Job detail with planned vs actual materials/cost → supports PROD-04
  - [ ] Target confirmed: erp-interface-design/src/components/erp/production-view.tsx
  - [ ] Data source: production costs API
  - [ ] States: loading, error
  - [ ] Permission gating: production.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: job detail test
- [ ] UI-PROD-06 [NEW] Baker 'my queue' view with large touch targets → supports PROD-01
  - [ ] Target confirmed: erp-interface-design/src/components/erp/production-view.tsx
  - [ ] Data source: production jobs API
  - [ ] States: empty, loading, error
  - [ ] Permission gating: production.view
  - [ ] Responsive/theme/accessibility: large touch targets, mobile
  - [ ] Live update: updates on job status
  - [ ] Test: queue test
<!-- UI-CHECKLIST:END -->

### Notes and blockers

- **2026-11-05 (code, parse-checked; restart+E2E pending):** Production route write handlers hardened with `store.persist(); await flush()` + `503` on DB unavailability (mechanical). Core persistence now fails hard on DB errors. `businessService` production/order-advancement mutations and reads still largely cache-backed; DB-native transactions for all production state transitions remain open.

<!-- MODULE:PROD:END -->

## Inventory (`INV`)

<!-- MODULE:INV:BEGIN -->

- **Status:** In progress
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** [`Optim/Optim_inventory.md`](./Optim_inventory.md)
- **Branch / commit range:** _set by the skill when work starts_

### General checklist (mirrors the plan)

- [ ] INV-00 Reconcile with source document and code
- [x] INV-01 [P2] Single availability function; atomic reservation
- [x] INV-02 [P2] Validate adjustments
- [ ] INV-03 [P4] Batches, expiry, units, reason codes migration
- [ ] INV-04 [P4] Weighted-average cost on goods receipt; FEFO consumption
- [ ] INV-05 [P4] Stock-take flow
- [ ] INV-06 [P5] Inventory alerts and reorder suggestions
- [ ] INV-07 [P5] Inventory analytics feeds
- [ ] INV-08 [P2] Inventory tests

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
- [ ] UI-INV-01 [ADJUST] Stock table shows on-hand / reserved / available separately → supports INV-01
  - [ ] Target confirmed: erp-interface-design/src/components/erp/inventory-view.tsx
  - [ ] Data source: inventory API
  - [ ] States: loading,error
  - [ ] Permission gating: inventory.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: updates on changes
  - [ ] Test: stock table test

- [ ] UI-INV-02 [ADJUST] Adjust dialog: reason code required, blocks negative, approval hint → supports INV-02
  - [ ] Target confirmed: erp-interface-design/src/components/erp/dialogs.tsx
  - [ ] Data source: inventory API
  - [ ] States: loading,error
  - [ ] Permission gating: inventory.adjust
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: adjust dialog test

- [ ] UI-INV-03 [NEW] Batch & expiry columns with near-expiry badge → supports INV-03
  - [ ] Target confirmed: erp-interface-design/src/components/erp/inventory-view.tsx
  - [ ] Data source: inventory API
  - [ ] States: loading,error
  - [ ] Permission gating: inventory.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: batch test

- [ ] UI-INV-04 [NEW] Stock-take screen with variance and approval submit → supports INV-05
  - [ ] Target confirmed: erp-interface-design/src/components/erp/inventory-view.tsx
  - [ ] Data source: inventory API
  - [ ] States: loading,error
  - [ ] Permission gating: inventory.stocktake
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: stocktake test

<!-- UI-CHECKLIST:END -->

### Notes and blockers

- **2026-11-05 (code, parse-checked; restart+E2E pending):** Inventory route critical writes are DB-mandatory (`503` on DB unavailable): item insert, adjustment ledger insert (`inventory_transactions`, maps `user`→`tx_user`), reservation insert. Reads/alerts remain hybrid/cache-backed. `inventory_items` has no persisted `physical_stock` column (ledger-derived authority still to finalize).

<!-- MODULE:INV:END -->

## Purchasing & payables (`PUR`)

<!-- MODULE:PUR:BEGIN -->

- **Status:** In progress
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** [`Optim/Optim_purchasing.md`](./Optim_purchasing.md)
- **Branch / commit range:** _set by the skill when work starts_

### General checklist (mirrors the plan)

- [x] PUR-00 Reconcile with source document and code
- [x] PUR-01 [P0] Verify purchasing auth closed
- [x] PUR-02 [P2] Stop silent supplier fallback
- [ ] PUR-03 [P4] PO approval thresholds and partial receipts
- [ ] PUR-04 [P4] Supplier bills, bill payments, payables
- [ ] PUR-05 [P4] Three-way match
- [ ] PUR-06 [P5] Purchase suggestions
- [ ] PUR-07 [P5] Supplier performance
- [ ] PUR-08 [P5] Purchasing notifications
- [x] PUR-09 [P0] Purchasing tests

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
- [ ] UI-PUR-01 [ADJUST] Supplier select required with validation → supports PUR-02
  - [ ] Target confirmed: erp-interface-design/src/components/erp/purchasing-view.tsx
  - [ ] Data source: purchasing API
  - [ ] States: loading,error
  - [ ] Permission gating: purchasing.create
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: supplier validation test

- [ ] UI-PUR-02 [NEW] PO approval banner and receive dialog with partial quantities → supports PUR-03
  - [ ] Target confirmed: erp-interface-design/src/components/erp/purchasing-view.tsx
  - [ ] Data source: purchasing API
  - [ ] States: loading,error
  - [ ] Permission gating: purchasing.approve
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: po receive test

- [ ] UI-PUR-03 [NEW] Bills tab with due dates and payables ageing → supports PUR-04
  - [ ] Target confirmed: erp-interface-design/src/components/erp/purchasing-view.tsx
  - [ ] Data source: purchasing API
  - [ ] States: empty,loading,error
  - [ ] Permission gating: purchasing.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: bills test

<!-- UI-CHECKLIST:END -->

### Notes and blockers

_none_

<!-- MODULE:PUR:END -->

## Deliveries (`DEL`)

<!-- MODULE:DEL:BEGIN -->

- **Status:** In progress
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** [`Optim/Optim_deliveries.md`](./Optim_deliveries.md)
- **Branch / commit range:** _set by the skill when work starts_

### General checklist (mirrors the plan)

- [x] DEL-00 Reconcile with source document and code
- [~] DEL-01 [P1] Interim patch: stop the false cash entries
- [x] DEL-02 [P0] Lock down `PATCH /deliveries/:id`
- [~] DEL-03 [P1] State guards and new statuses
- [~] DEL-04 [P1] Settlement on completion
- [ ] DEL-05 [P4] Cash with driver and remittance
- [ ] DEL-06 [P3] One transaction, no swallowed errors
- [x] DEL-07 [P1] Fix the payment-received notification
- [ ] DEL-08 [P4] Proof of delivery, driver assignment and view, zones and fees
- [ ] DEL-09 [P5] Optional prepayment policy
- [ ] DEL-10 [P5] Delivery analytics and notifications
- [ ] DEL-11 [P1] Delivery tests (audit list)

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
- [~] UI-DEL-01 [ADJUST] 'Complete delivery/collection' opens settlement dialog showing 'Collect UGX X', disables confirm until collected or reason given → supports DEL-04
  - [ ] Target confirmed: erp-interface-design/src/components/erp/deliveries-view.tsx
  - [ ] Data source: order payment summary / settlement fields
  - [ ] States: empty, loading, error, forbidden
  - [ ] Permission gating: deliveries.complete
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: balance updates on changes
  - [ ] Test: settlement dialog test

- [~] UI-DEL-02 [ADJUST] Delivery card shows balance due, payment method chips, cash-with-driver state → supports DEL-01
  - [ ] Target confirmed: erp-interface-design/src/components/erp/deliveries-panels.tsx
  - [ ] Data source: delivery/order payment fields
  - [ ] States: loading, error
  - [ ] Permission gating: deliveries.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: updates on status/payment changes
  - [ ] Test: card rendering test

- [~] UI-DEL-03 [NEW] Failure/cancel dialog with reason codes and reschedule option → supports DEL-03
  - [ ] Target confirmed: erp-interface-design/src/components/erp/dialogs.tsx
  - [ ] Data source: reason codes
  - [ ] States: loading, error
  - [ ] Permission gating: deliveries.update/cancel
  - [ ] Responsive/theme/accessibility: modal accessible
  - [ ] Live update: N/A
  - [ ] Test: dialog test

- [ ] UI-DEL-04 [NEW] Driver mobile view: my deliveries, big buttons, POD capture (photo/OTP) → supports DEL-08
  - [ ] Target confirmed: erp-interface-design/src/components/erp/deliveries-view.tsx
  - [ ] Data source: deliveries filtered by driver
  - [ ] States: empty, loading, error, forbidden
  - [ ] Permission gating: deliveries.view/complete
  - [ ] Responsive/theme/accessibility: large touch targets, mobile responsive
  - [ ] Live update: refresh on status change
  - [ ] Test: mobile view test

- [ ] UI-DEL-05 [NEW] Remittance confirmation list for Finance → supports DEL-05
  - [ ] Target confirmed: erp-interface-design/src/components/erp/finance-view.tsx
  - [ ] Data source: remittances API
  - [ ] States: empty, loading, error, forbidden
  - [ ] Permission gating: finance.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: updates on remittance changes
  - [ ] Test: remittance list test

- [~] UI-DEL-06 [ADJUST] Filters by new statuses, driver, zone, late → supports DEL-03
  - [ ] Target confirmed: erp-interface-design/src/components/erp/deliveries-filters.tsx
  - [ ] Data source: filter state
  - [ ] States: N/A
  - [ ] Permission gating: deliveries.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: filter test
<!-- UI-CHECKLIST:END -->

### Notes and blockers

- **2026-11-05 (code, parse-checked; restart+E2E pending):** Deliveries route create/dispatch/complete/cancel/fail/patch hardened with `store.persist(); await flush()` + `503` on DB unavailability; `complete` still performs complex cache/business mutations (payments/order updates) before flush. DB-native delivery/order settlement transaction remains open (DEL-06).

<!-- MODULE:DEL:END -->

## Finance (`FIN`)

<!-- MODULE:FIN:BEGIN -->

- **Status:** In progress
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** [`Optim/Optim_finance.md`](./Optim_finance.md)
- **Branch / commit range:** _set by the skill when work starts_

### General checklist (mirrors the plan)

- [x] FIN-00 Reconcile with source document and code
- [x] FIN-01 [P1] Append-only payments
- [x] FIN-02 [P1] Validation, idempotency, integer UGX
- [x] FIN-03 [P1] Fix period filtering in profit reports
- [x] FIN-04 [P1] Decide and implement accounting basis
- [ ] FIN-05 [P4] Ledger schema and chart of accounts
- [~] FIN-06 [P4] Event-to-journal posting and period close
- [~] FIN-07 [P4] Invoices, credit notes, refunds
- [~] FIN-08 [P4] Payment provider abstraction, reconciliation, cash-up
- [~] FIN-09 [P4] Job costing and margin per order
- [~] FIN-10 [P4] Payables, payroll and expense posting
- [~] FIN-11 [P5] Finance reports and export
- [x] FIN-12 [P1] Finance tests

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
- [~] UI-FIN-01 [ADJUST] Split into tabs: Overview, Invoices, Payments, Expenses, Reports → supports FIN-07
  - [ ] Target confirmed: erp-interface-design/src/components/erp/finance-view.tsx
  - [ ] Data source: finance API endpoints
  - [ ] States: empty, loading, error, forbidden
  - [ ] Permission gating: finance.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: refresh on data changes
  - [ ] Test: tab navigation test

- [ ] UI-FIN-02 [NEW] Receivables ageing card and 'Needs attention' list → supports FIN-11
  - [ ] Target confirmed: erp-interface-design/src/components/erp/finance-view.tsx
  - [ ] Data source: ageing report API
  - [ ] States: empty, loading, error
  - [ ] Permission gating: finance.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: refresh periodically
  - [ ] Test: ageing card test

- [~] UI-FIN-03 [NEW] Reversal/refund dialog with reason and approval status; payment rows show FAILED/REVERSED badges → supports FIN-01
  - [ ] Target confirmed: erp-interface-design/src/components/erp/dialogs.tsx
  - [ ] Data source: payments API
  - [ ] States: loading, error
  - [ ] Permission gating: finance.refund/approve
  - [ ] Responsive/theme/accessibility: modal accessible
  - [ ] Live update: refresh after action
  - [ ] Test: reversal dialog test

- [~] UI-FIN-04 [NEW] Approvals queue with acknowledge → supports FIN-07
  - [ ] Target confirmed: erp-interface-design/src/components/erp/finance-view.tsx
  - [ ] Data source: approvals API
  - [ ] States: empty, loading, error, forbidden
  - [ ] Permission gating: finance.approve
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: real-time updates
  - [ ] Test: approvals queue test

- [~] UI-FIN-05 [NEW] Cash-up screen and remittance confirmation → supports FIN-08
  - [ ] Target confirmed: erp-interface-design/src/components/erp/finance-view.tsx
  - [ ] Data source: cash-up/remittance APIs
  - [ ] States: empty, loading, error, forbidden
  - [ ] Permission gating: finance.manage
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: refresh on changes
  - [ ] Test: cash-up test

- [~] UI-FIN-06 [NEW] Period close control with lock indicator → supports FIN-06
  - [ ] Target confirmed: erp-interface-design/src/components/erp/finance-view.tsx
  - [ ] Data source: period close API
  - [ ] States: loading, error, forbidden
  - [ ] Permission gating: finance.close
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: status updates
  - [ ] Test: period close test

- [ ] UI-FIN-07 [ADJUST] Revenue/gross-profit cards use same period; show date basis → supports FIN-03
  - [ ] Target confirmed: erp-interface-design/src/components/erp/dashboard.tsx
  - [ ] Data source: reports API
  - [ ] States: loading, error
  - [ ] Permission gating: finance.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: refresh on period change
  - [ ] Test: dashboard cards test
<!-- UI-CHECKLIST:END -->

### Notes and blockers

_none_

<!-- MODULE:FIN:END -->

## Analytics (`ANA`)

<!-- MODULE:ANA:BEGIN -->

- **Status:** In progress
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** [`Optim/Optim_analytics.md`](./Optim_analytics.md)
- **Branch / commit range:** optim/ana-p0

### General checklist (mirrors the plan)

- [x] ANA-00 Reconcile with source document and code
- [x] ANA-01 [P0] Remove hardcoded fallbacks; add empty states
- [ ] ANA-02 [P5] Reporting views and daily snapshot
- [ ] ANA-03 [P5] Generic metrics endpoint
- [ ] ANA-04 [P5] Metric definitions page
- [ ] ANA-05 [P5] Operations KPIs
- [ ] ANA-06 [P5] Finance KPIs and margin
- [ ] ANA-07 [P5] Customer performance KPIs
- [ ] ANA-08 [P3] Permission split and role-scoped dashboards
- [ ] ANA-09 [P5] Dashboard redesign
- [ ] ANA-10 [P5] SLA policies and milestone checks
- [ ] ANA-11 [P5] Analytics tests

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
- [ ] UI-ANA-01 [ADJUST] KPI cards use consistent date basis and filters → supports ANA-01
  - [ ] Target confirmed: erp-interface-design/src/components/erp/analytics-view.tsx
  - [ ] Data source: analytics API
  - [ ] States: loading,error
  - [ ] Permission gating: analytics.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: kpi test

- [ ] UI-ANA-02 [NEW] Product mix and margin charts → supports ANA-03
  - [ ] Target confirmed: erp-interface-design/src/components/erp/analytics-view.tsx
  - [ ] Data source: analytics API
  - [ ] States: loading,error
  - [ ] Permission gating: analytics.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: charts test

<!-- UI-CHECKLIST:END -->

### Notes and blockers

_none_

<!-- MODULE:ANA:END -->

## Notifications & audit (`NOT`)

<!-- MODULE:NOT:BEGIN -->

- **Status:** In progress
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** [`Optim/Optim_notifications_audit.md`](./Optim_notifications_audit.md)
- **Branch / commit range:** optim/not-p0

### General checklist (mirrors the plan)

- [x] NOT-00 Reconcile with source document and code
- [x] NOT-01 [P0] Scope notifications by recipient (security leak)
- [ ] NOT-02 [P3] Use role routing by permission
- [ ] NOT-03 [P3] One notification per user per event; channels as delivery records
- [ ] NOT-04 [P3] Fill templates, use caller message, honour preferences, add recipients to payment alerts
- [ ] NOT-05 [P3] Audit becomes the event stream
- [ ] NOT-06 [P5] Rules engine and `notification_rules`
- [ ] NOT-07 [P5] Live delivery
- [ ] NOT-08 [P5] Comments, @mentions, assignment and handoff statuses
- [ ] NOT-09 [P5] Scheduled escalation jobs
- [ ] NOT-10 [P5] `NotificationChannel` interface
- [x] NOT-11 [P0] Notification tests
- [x] NOT-12 [P5] Reuse realtime channel for live-delivery updates — hotfix

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
- [ ] UI-NOT-01 [ADJUST] Notification bell with unread count and dropdown → supports NOT-01
  - [ ] Target confirmed: erp-interface-design/src/components/erp/workspace.tsx
  - [ ] Data source: notifications API
  - [ ] States: loading,error
  - [ ] Permission gating: notifications.view
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: updates in real-time
  - [ ] Test: bell test

- [ ] UI-NOT-02 [NEW] Notification preferences panel → supports NOT-04
  - [ ] Target confirmed: erp-interface-design/src/components/erp/settings-view.tsx
  - [ ] Data source: notifications API
  - [ ] States: loading,error
  - [ ] Permission gating: notifications.manage
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: preferences test

<!-- UI-CHECKLIST:END -->

### Notes and blockers

_none_

<!-- MODULE:NOT:END -->

## Customers, CRM & feedback (`CRM`)

<!-- MODULE:CRM:BEGIN -->

- **Status:** Not started
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** [`Optim/Optim_crm.md`](./Optim_crm.md)
- **Branch / commit range:** _set by the skill when work starts_

### General checklist (mirrors the plan)

- [ ] CRM-00 Reconcile with source document and code
- [ ] CRM-01 [P5] Reminder scheduler
- [ ] CRM-02 [P5] Occasion templates and one-click WhatsApp
- [ ] CRM-03 [P4] Consent and opt-out per channel
- [ ] CRM-04 [P5] Convert reminder to draft order
- [ ] CRM-05 [P5] Customer merge and duplicate detection
- [ ] CRM-06 [P5] Preferences and allergies surface automatically
- [ ] CRM-07 [P5] Tags, segments, single timeline, feedback linked to job and baker
- [ ] CRM-08 [P5] Reminder outcomes
- [ ] CRM-09 [P5] CRM notifications
- [ ] CRM-10 [P5] CRM tests

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
_Not generated yet. The skill creates it from `references/ui-features.md` and maps each item to a general step._
<!-- UI-CHECKLIST:END -->

### Notes and blockers

_none_

<!-- MODULE:CRM:END -->

## Catalogue & recipes (`CAT`)

<!-- MODULE:CAT:BEGIN -->

- **Status:** Not started
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** `Optim/Optim_catalogue_recipes.md` (**not yet created**; use the audit sections below as the source)
- **Branch / commit range:** _set by the skill when work starts_

### General checklist (mirrors the plan)

- [ ] CAT-00 Reconcile with source document and code
- [ ] CAT-01 [P4] Recipe CRUD, versions and approval endpoints
- [ ] CAT-02 [P4] Yield, batch size and cost roll-up
- [ ] CAT-03 [P4] Allergen flags derived from ingredients
- [ ] CAT-04 [P4] Size and flavour variants with own cost and price
- [ ] CAT-05 [P2] Shared server pricing function
- [ ] CAT-06 [P5] Price-change history and analytics
- [ ] CAT-07 [P4] Catalogue tests

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
_Not generated yet. The skill creates it from `references/ui-features.md` and maps each item to a general step._
<!-- UI-CHECKLIST:END -->

### Notes and blockers

_none_

<!-- MODULE:CAT:END -->

## Staff & payroll (`STF`)

<!-- MODULE:STF:BEGIN -->

- **Status:** Not started
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** [`Optim/Optim_staff_payroll.md`](./Optim_staff_payroll.md)
- **Branch / commit range:** _set by the skill when work starts_

### General checklist (mirrors the plan)

- [ ] STF-00 Reconcile with source document and code
- [ ] STF-01 [P3] Enforce maker-checker on payroll periods
- [ ] STF-02 [P4] Post payroll accruals and payments to finance
- [ ] STF-03 [P4] Tie hours to jobs
- [ ] STF-04 [P3] Restrict payslip and salary visibility
- [ ] STF-05 [P5] Payroll notifications
- [ ] STF-06 [P3] Staff tests

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
_Not generated yet. The skill creates it from `references/ui-features.md` and maps each item to a general step._
<!-- UI-CHECKLIST:END -->

### Notes and blockers

_none_

<!-- MODULE:STF:END -->

## Public website & web users (`WEB`)

<!-- MODULE:WEB:BEGIN -->

- **Status:** In progress
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** `Optim/Optim_website.md` (**not yet created**; use the audit sections below as the source)
- **Branch / commit range:** optim/web-p0

### General checklist (mirrors the plan)

- [x] WEB-00 Reconcile with source document and code
- [x] WEB-01 [P0] Harden public endpoints
- [x] WEB-02 [P1] Token storage and reset-credentials review
- [ ] WEB-03 [P5] One customer identity with optional login
- [ ] WEB-04 [P5] Order tracking page
- [ ] WEB-05 [P5] Reference-image upload
- [ ] WEB-06 [P5] Source tagging and SEO basics
- [ ] WEB-07 [P6] Remove duplicated `erp/` folder
- [x] WEB-08 [P0] Website tests

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
- [ ] UI-WEB-01 [ADJUST] Public catalogue and enquiry forms with validation → supports WEB-01
  - [ ] Target confirmed: sweet-moments-cakery-web/
  - [ ] Data source: public API
  - [ ] States: loading,error
  - [ ] Permission gating: public
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: public form test

<!-- UI-CHECKLIST:END -->

### Notes and blockers

_none_

<!-- MODULE:WEB:END -->

## Architecture & cross-cutting (`ARC`)

<!-- MODULE:ARC:BEGIN -->

- **Status:** In progress
- **Plan section:** [`Optim.md` §6](./Optim.md)  |  **Source:** [`Optim/Optim_architecture.md`](./Optim_architecture.md)
- **Branch / commit range:** optim/arc-server-tests

### General checklist (mirrors the plan)

- [x] ARC-00 Reconcile with source document and code
- [x] ARC-01 [P0] Server test harness first
- [ ] ARC-02 [P2] Zod validation and field whitelists
- [ ] ARC-03 [P3] Migration runner hygiene
- [ ] ARC-04 [P3] Transaction helper and repositories
- [ ] ARC-05 [P3] State-machine module
- [ ] ARC-06 [P3] `domain_events` table and `emit(tx, ...)` helper
- [ ] ARC-07 [P3] No silent failures: `needs_attention`
- [ ] ARC-08 [P4] Split `store.ts` and `business.service.ts` by module
- [ ] ARC-09 [P4] Structured logging, helmet, rate-limit wiring, env config
- [ ] ARC-10 [P6] Repo hygiene
- [x] ARC-11 [P2] Interim live updates (polling on focus/interval, pause hidden, no flicker) — hotfix
- [x] ARC-12 [P3] Realtime update channel (SSE/domain events, permission-scoped, reconnect, dedup, polling fallback) — hotfix

### UI Features Progress Table (Separate)

| Module | UI Done | UI Total | Status |
|---|---|---|---|
| Security & RBAC (SEC) | 3 | 5 | In progress |
| Web (WEB) | 0 | 1 | Not started |
| Architecture & cross-cutting (ARC) | 0 | 1 | Not started |
| Notifications & audit (NOT) | 0 | 2 | Not started |
| Finance (FIN) | 5 | 7 | In progress |
| Purchasing & payables (PUR) | 0 | 3 | Not started |
| Quotations & inquiries (QUO) | 0 | 4 | Not started |
| Inventory (INV) | 0 | 4 | Not started |
| Analytics (ANA) | 0 | 2 | Not started |
| Production (PROD) | 0 | 6 | Not started |
| Orders (ORD) | 0 | 6 | Not started |
| Customers, CRM & feedback (CRM) | 0 | 0 | Not started |
| Catalogue & recipes (CAT) | 0 | 0 | Not started |
| Staff & payroll (STF) | 0 | 0 | Not started |

## UI checklist (generated by the skill when the module starts)

<!-- UI-CHECKLIST:BEGIN -->
- [ ] UI-ARC-01 [NEW] Health/status indicators and error boundaries → supports ARC-01
  - [ ] Target confirmed: erp-interface-design/src/App.tsx
  - [ ] Data source: health API
  - [ ] States: error
  - [ ] Permission gating: admin
  - [ ] Responsive/theme/accessibility: follows design system
  - [ ] Live update: N/A
  - [ ] Test: health test

<!-- UI-CHECKLIST:END -->

### Notes and blockers

_none_

<!-- MODULE:ARC:END -->

