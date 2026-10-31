---
plan: twin-cakery-erp-optimization
implemented_by_skill: optim
skill_path: ../skills/optim/SKILL.md
progress_doc: ./Optim_progress.md
audit_doc: ./Optimize.md
module_docs_pattern: ./Optim_<module>.md
generated: 2026-10-31
---

# Optim: Twin Cakery ERP Optimization Plan

> ## AGENT INSTRUCTION (read first)
> **This plan is implemented by the skill `optim`** (`../skills/optim/SKILL.md`).
> Do not implement anything from this file by hand. When a module is to be optimized or re-optimized, **load the `optim` skill** and give it the module ID (for example `FIN`).
> The skill reads, in this order: (1) the module's section in **this file**, (2) the module's source document `Optim/Optim_<module>.md` linked in that section, (3) the original assessment `Optim/Optimize.md` (line ranges are given in each section). It then builds one unified plan, writes any adjustments back into that module's **Plan adjustments** table below, and records progress in `Optim/Optim_progress.md`.

## 1. Folder layout

All of these live in one folder, `Optim/`, at the project root (next to `erp-interface-design/`, `server/`, `sweet-moments-cakery-web/`):

```text
<project root>/
├── Optim/
│   ├── Optim.md                        <- this plan (general, per-module implementation steps)
│   ├── Optim_progress.md               <- progress per module (percentages and checklists)
│   ├── Optimize.md                     <- original assessment / audit (source of findings)
│   └── Optim_<module>.md  x 13 existing, 2 still to create (see section 3)
├── skills/optim/                       <- the skill that executes this plan
│   ├── SKILL.md
│   ├── references/ (ui-features.md, codebase-map.md, templates.md)
│   └── scripts/progress.js             <- recomputes percentages in Optim_progress.md
├── erp-interface-design/  server/  sweet-moments-cakery-web/
```

## 2. Division of detail

| Where | What it holds |
|---|---|
| **This file, module sections** | General implementation: ordered steps across every layer (DB, API, services, events, RBAC, notifications, analytics, UI, tests), with a general checklist |
| **`Optim_<module>.md`** | The detailed assessment, scenarios and code snippets that each step was derived from |
| **`Optimize.md`** | The original audit with the evidence for each finding |
| **Skill `references/ui-features.md`** | Specific UI features and elements to build or adjust, per module; the skill turns them into a detailed UI checklist and maps each to a general step |
| **`Optim_progress.md`** | Which modules are done and how far, as percentages |

## 3. Provenance and known gaps (read before trusting a section)

- The module sections below were assembled from the audit (`Optimize.md`) and verified against the codebase zip (for example: `requireRole` really never checks the role, CORS is `*`, there are two `020_*` migrations, the analytics view really hardcodes `182080`). **The 13 `Optim_<module>.md` files were not available when this plan was written**, so their detail has not been merged in. The first step of every module (`<ID>-00`) is therefore a **reconcile step**: the skill reads the module document, and adds anything it contains that is missing here to the module's *Plan adjustments* table.
- `Optim_catalogue_recipes.md` and `Optim_website.md` do not exist yet. The `CAT` and `WEB` sections rely on the audit only, and the audit only skimmed those areas, so treat them as **unverified** until the skill has checked the code.
- The audit did not run the app. Each module's steps start with verifying that the finding is still true in the current code.

| Module | ID | Source document | Exists |
|---|---|---|---|
| Security & RBAC | `SEC` | [`Optim/Optim_security_rbac.md`](./Optim_security_rbac.md) | yes |
| Orders | `ORD` | [`Optim/Optim_orders.md`](./Optim_orders.md) | yes |
| Quotations & inquiries | `QUO` | [`Optim/Optim_quotations.md`](./Optim_quotations.md) | yes |
| Production | `PROD` | [`Optim/Optim_production.md`](./Optim_production.md) | yes |
| Inventory | `INV` | [`Optim/Optim_inventory.md`](./Optim_inventory.md) | yes |
| Purchasing & payables | `PUR` | [`Optim/Optim_purchasing.md`](./Optim_purchasing.md) | yes |
| Deliveries | `DEL` | [`Optim/Optim_deliveries.md`](./Optim_deliveries.md) | yes |
| Finance | `FIN` | [`Optim/Optim_finance.md`](./Optim_finance.md) | yes |
| Analytics | `ANA` | [`Optim/Optim_analytics.md`](./Optim_analytics.md) | yes |
| Notifications & audit | `NOT` | [`Optim/Optim_notifications_audit.md`](./Optim_notifications_audit.md) | yes |
| Customers, CRM & feedback | `CRM` | [`Optim/Optim_crm.md`](./Optim_crm.md) | yes |
| Catalogue & recipes | `CAT` | `Optim/Optim_catalogue_recipes.md` (**not yet created**; use the audit sections below as the source) | **no** |
| Staff & payroll | `STF` | [`Optim/Optim_staff_payroll.md`](./Optim_staff_payroll.md) | yes |
| Public website & web users | `WEB` | `Optim/Optim_website.md` (**not yet created**; use the audit sections below as the source) | **no** |
| Architecture & cross-cutting | `ARC` | [`Optim/Optim_architecture.md`](./Optim_architecture.md) | yes |

## 4. Execution order (phases)

Modules depend on each other, so the skill can run a whole module or only one phase of it (for example `FIN` phase `P1`). The recommended order follows the audit's *Suggested order* sections.

| Phase | Goal | Steps (module-step) |
|---|---|---|
| **P0** | Close exploitable gaps (auth, CORS, rate limits, unprotected routes, notification leak) | SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-13, ORD-01, PUR-01, PUR-09, DEL-02, ANA-01, NOT-01, NOT-11, WEB-01, WEB-08, ARC-01 |
| **P1** | Money correctness (stop false cash, append-only payments, idempotency, period filters, accounting basis) | SEC-06, DEL-01, DEL-03, DEL-04, DEL-07, DEL-11, FIN-01, FIN-02, FIN-03, FIN-04, FIN-12, WEB-02 |
| **P2** | Integrity bugs (QC storage, job guards, reservations, quotation PATCH, server pricing) | ORD-02, ORD-10, QUO-01, QUO-02, QUO-03, QUO-08, PROD-01, PROD-02, PROD-09, INV-01, INV-02, INV-08, PUR-02, CAT-05, ARC-02 |
| **P3** | Foundations (state machine, event spine, transactions, roles, approvals, notification routing) | SEC-07, SEC-08, SEC-09, SEC-10, SEC-11, SEC-12, ORD-03, ORD-04, ORD-07, PROD-03, DEL-06, ANA-08, NOT-02, NOT-03, NOT-04, NOT-05, STF-01, STF-04, STF-06, ARC-03, ARC-04, ARC-05, ARC-06, ARC-07 |
| **P4** | Domain build-out (ledger, invoices, recipes, costing, payables, batches, proof of delivery) | ORD-05, ORD-06, QUO-04, QUO-05, PROD-04, PROD-05, PROD-06, INV-03, INV-04, INV-05, PUR-03, PUR-04, PUR-05, DEL-05, DEL-08, FIN-05, FIN-06, FIN-07, FIN-08, FIN-09, FIN-10, CRM-03, CAT-01, CAT-02, CAT-03, CAT-04, CAT-07, STF-02, STF-03, ARC-08, ARC-09 |
| **P5** | Insight and engagement (analytics, reminder scheduler, rules engine, SLAs, live updates) | ORD-08, ORD-09, QUO-06, QUO-07, PROD-07, PROD-08, INV-06, INV-07, PUR-06, PUR-07, PUR-08, DEL-09, DEL-10, FIN-11, ANA-02, ANA-03, ANA-04, ANA-05, ANA-06, ANA-07, ANA-09, ANA-10, ANA-11, NOT-06, NOT-07, NOT-08, NOT-09, NOT-10, CRM-01, CRM-02, CRM-04, CRM-05, CRM-06, CRM-07, CRM-08, CRM-09, CRM-10, CAT-06, STF-05, WEB-03, WEB-04, WEB-05, WEB-06 |
| **P6** | Hygiene and polish (repo cleanup, duplicate code removal) | WEB-07, ARC-10 |

Rules the skill applies when a step spans modules:

1. **The owning module implements the whole change**, including the parts that land in other modules (the step's *Touches* list). Those parts appear as **inbound touchpoints** in the affected module's section and count toward the **owner's** progress.
2. Before running a module, the skill checks its **Depends on** list in `Optim_progress.md`. If a dependency has unfinished P0-P2 steps, the skill warns and asks whether to continue.
3. A step is only ticked when its tests pass and the change exists at every layer it names.

## 5. Conventions every module follows

- **Migrations:** forward-only, next free number (after `021`; two `020_*` files already exist and must not be renamed; see `ARC-03`), never edit an applied migration, backfills are idempotent, take a backup outside the repo first.
- **Money:** UGX in integers (or round at each step); finance tables are append-only; corrections are reversing rows.
- **Time:** store UTC, compute day boundaries in `Africa/Kampala`.
- **Permissions:** `resource.action` keys, enforced on the server with the shared `requirePermission`, deny by default; UI hiding is convenience only.
- **Every state change** goes through the state machine and emits a `domain_events` row in the same transaction.
- **No silent failures:** no empty `catch {}` on business steps.

---

# Module plans

## 6.1 Security & RBAC (`SEC`)

| | |
|---|---|
| **Source document** | [`Optim/Optim_security_rbac.md`](./Optim_security_rbac.md) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *Fix first: security and RBAC* (lines 131-147); *3. RBAC (standard model)* (lines 53-77); *Most serious findings #2, #3, #8* (lines 479-491); *Auth bullets under Public website* (lines 605-612) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `SEC` |
| **Severity** | Critical |
| **Depends on** | none |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `SEC` |

**Summary.** Permission checks are partly fake (`requireRole` passes any session; purchasing routes swallow the check), sessions are guessable in-memory tokens, CORS is `*`, a dev password fallback exists, and only three coarse roles exist.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/middleware/auth.ts (requireRole never checks role, line ~26)`
- `server/middleware/rateLimit.ts`
- `server/services/auth.service.ts`
- `server/services/rbac.service.ts`
- `server/routes/auth.ts`
- `server/routes/rbac.ts`
- `server/routes/api.ts`
- `server/index.ts (CORS wildcard, lines ~35-38)`
- `server/migrations/014_role_permissions.sql, 015_missing_route_permissions.sql, 018_activation_codes.sql, 019_inventory_adjust_to_role_admin.sql`
- `erp-interface-design/src/test/nav-permissions.test.ts`
- `erp-interface-design/src/lib/api.ts`

### Step-by-step implementation and general checklist

- [ ] **SEC-00** [P0] Reconcile: read `Optim/Optim_security_rbac.md`, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **SEC-01** [P0] **One shared `requirePermission(perm)` middleware, deny by default.** Move the copy-pasted `required()` helper into `middleware/auth.ts`; add `router.use(requireAuth)` per router; make `requireRole` actually compare roles (or delete it). _Touches: ARC_
- [ ] **SEC-02** [P0] **Close unprotected and fake-protected routes.** `POST /purchasing/suppliers` (no auth), `POST /purchasing/orders` (`.catch(() => {})` then `next()`), `PATCH /deliveries/:id` (only `deliveries.view`). Replace with `requirePermission`. _Touches: PUR, DEL_
- [ ] **SEC-03** [P0] **Rate limiting on login, register, reset-credentials and public forms.** Apply existing `rateLimit` middleware (today only on `/claim-admin`) with per-IP and per-account limits; return 429 with Retry-After; log breaches. _Touches: WEB, NOT_
- [ ] **SEC-04** [P0] **Remove dev password fallback and lock down registration.** Delete `TwinCakery123!` / `placeholder` acceptance in `auth.service.ts`; `auth.ts` must ignore `role` / `isAdmin` from the request body; admin creation only via valid activation code; confirm `/reset-credentials` needs proof of ownership. _Touches: WEB_
- [ ] **SEC-05** [P0] **CORS allowlist, helmet, env-based config.** Replace `Access-Control-Allow-Origin: *` with an allowlist (ERP + website origins from env); add `helmet`; document required env vars in `.env.example`; rotate secrets if `.env` was ever committed. _Touches: ARC, WEB_
- [ ] **SEC-06** [P1] **Real sessions: random hashed tokens in a `sessions` table.** Migration `sessions(id, user_id, token_hash, created_at, expires_at, revoked_at, ip, user_agent)`; `crypto.randomBytes(32)`; hash at rest; logout and revoke-all; use `JWT_SECRET` or remove it; frontend and website stop reading tokens from `localStorage` where feasible (httpOnly cookie). _Touches: WEB, ARC_
- [ ] **SEC-07** [P3] **Split and rename permissions to match actions.** Migration + seed + `role_permissions` backfill: `deliveries.update`, `quotations.send` (separate from `quotations.accept`), `analytics.operations|finance|customers|staff`, `finance.view_reports`, `payments.refund`, `payments.confirm_remittance`, `expenses.approve`, `orders.override_price`, `inventory.approve_writeoff`. Old keys kept as aliases for one release. _Touches: ANA, QUO, DEL, FIN, ORD, INV_
- [ ] **SEC-08** [P3] **New roles: Finance/Accountant, Baker/Decorator, Delivery/Driver.** Seed roles and permission sets; fix `ROLES_FOR_EVENT` role-name mismatches via permission-based routing; hide cost/margin from Production, Sales, Baker, Driver. _Touches: NOT, FIN, ANA, PROD, DEL_
- [ ] **SEC-09** [P3] **Record-level scoping.** Sales sees own orders/customers; Baker sees assigned jobs only; Driver sees own deliveries and the customer address only. Implement as query filters in repositories, not UI hiding. _Touches: ORD, PROD, DEL, CRM_
- [ ] **SEC-10** [P3] **Approval (maker-checker) framework.** Migration `approvals(id, kind, subject_type, subject_id, requested_by, approver_id, status, reason, threshold_value, decided_at)`; rule that requester != approver; used by refunds, discounts over threshold, voids, manual journals, PO over limit, large write-offs, payroll approval. _Touches: FIN, INV, PUR, STF, NOT_
- [ ] **SEC-11** [P3] **Audit security events and permission changes.** Emit events for logins (success/fail), role and permission changes, session revocation, activation-code use; show in audit viewer; alert Admin on repeated failures. _Touches: NOT, ARC_
- [ ] **SEC-12** [P3] **Permission-aware UI and role management screen.** `usePermission()` hook gating buttons/columns/tabs; role-permission matrix page; keep `nav-permissions.test.ts` in sync; server remains the real gate.
- [ ] **SEC-13** [P0] **Server permission-matrix tests.** Test every route against every role (deny by default), including 401/403 shapes and the closed routes from step 2. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| ORD-01 | `ORD` | Whitelist PATCH fields; make `paymentStatus` derived only | P0 |
| QUO-03 | `QUO` | Server-priced lines and separate `quotations.send` | P2 |
| INV-02 | `INV` | Validate adjustments | P2 |
| INV-05 | `INV` | Stock-take flow | P4 |
| PUR-01 | `PUR` | Verify purchasing auth closed | P0 |
| PUR-03 | `PUR` | PO approval thresholds and partial receipts | P4 |
| DEL-02 | `DEL` | Lock down `PATCH /deliveries/:id` | P0 |
| DEL-05 | `DEL` | Cash with driver and remittance | P4 |
| DEL-08 | `DEL` | Proof of delivery, driver assignment and view, zones and fees | P4 |
| FIN-01 | `FIN` | Append-only payments | P1 |
| FIN-06 | `FIN` | Event-to-journal posting and period close | P4 |
| FIN-07 | `FIN` | Invoices, credit notes, refunds | P4 |
| ANA-08 | `ANA` | Permission split and role-scoped dashboards | P3 |
| NOT-01 | `NOT` | Scope notifications by recipient (security leak) | P0 |
| NOT-02 | `NOT` | Use role routing by permission | P3 |
| NOT-06 | `NOT` | Rules engine and `notification_rules` | P5 |
| CAT-01 | `CAT` | Recipe CRUD, versions and approval endpoints | P4 |
| STF-01 | `STF` | Enforce maker-checker on payroll periods | P3 |
| STF-04 | `STF` | Restrict payslip and salary visibility | P3 |
| WEB-01 | `WEB` | Harden public endpoints | P0 |
| WEB-02 | `WEB` | Token storage and reset-credentials review | P1 |
| ARC-01 | `ARC` | Server test harness first | P0 |
| ARC-02 | `ARC` | Zod validation and field whitelists | P2 |
| ARC-09 | `ARC` | Structured logging, helmet, rate-limit wiring, env config | P4 |

### Verification (tests the skill must add or run)

- Matrix: each route x each role returns 401/403/200 as designed.
- Login/register/reset limited after N attempts.
- Register ignores `role`/`isAdmin` in body.
- Maker cannot approve own request.

### UI scope

General: 5 UI items are catalogued for this module in the skill (`references/ui-features.md` → `SEC`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.2 Orders (`ORD`)

| | |
|---|---|
| **Source document** | [`Optim/Optim_orders.md`](./Optim_orders.md) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *Orders* (lines 492-512); *Most serious findings #2, #5* (lines 479-491) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `ORD` |
| **Severity** | Critical |
| **Depends on** | `SEC`, `ARC` |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `ORD` |

**Summary.** Anyone with `orders.confirm` can PATCH `total`, `paymentStatus`, `status`, `customerId`; prices come from the client; no state machine; `confirmOrder` failures are swallowed; dual `status`/`station` state.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/routes/orders.ts (PATCH, POST, /repeat)`
- `server/services/business.service.ts (confirmOrder, markOrderPaid ~576)`
- `server/database/store.ts, types.ts`
- `server/migrations/003_sales.sql, 008_order_history.sql, 011_order_follow_up.sql, 021_order_delivery_location.sql`
- `erp-interface-design/src/components/erp/workspace.tsx, dialogs.tsx, module-table.tsx`

### Step-by-step implementation and general checklist

- [ ] **ORD-00** [P0] Reconcile: read `Optim/Optim_orders.md`, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **ORD-01** [P0] **Whitelist PATCH fields; make `paymentStatus` derived only.** Reject `total`, `paymentStatus`, `status`, `customerId` on the generic PATCH; payment status recomputed from payments by one function. _Touches: FIN, SEC_
- [ ] **ORD-02** [P2] **Server-side pricing on POST and `/repeat`.** Recalculate price, subtotal, total from catalogue; manual override needs `orders.override_price`, a reason, and an event. _Touches: CAT, QUO, NOT_
- [ ] **ORD-03** [P3] **Replace generic status PATCH with action endpoints.** `/confirm`, `/cancel`, `/reschedule`, `/edit-details` routed through the state machine; `confirmOrder` errors propagate (no fall-through to plain update that skips job creation and reservations). _Touches: ARC, PROD, INV_
- [ ] **ORD-04** [P3] **Timestamps and numbering migration.** Add `confirmed_at`, `paid_at`, `original_required_at`, `date_change_reason`; gap-free order number sequence table; backfill `confirmed_at` from `order_status_history`/`audit_logs` where possible (verify coverage first). _Touches: ANA, ARC_
- [ ] **ORD-05** [P4] **Reschedule with reason code.** Reason codes (customer moved / we were late / capacity); emit `order.date_changed`; notify Production and Delivery. _Touches: NOT, PROD, DEL, ANA_
- [ ] **ORD-06** [P4] **Order amendments (change requests).** Table `order_amendments(order_id, requested_by, change_json, price_delta, status, approved_by)`; price impact flows to invoice/balance; Production and Sales notified. _Touches: FIN, PROD, NOT_
- [ ] **ORD-07** [P3] **Remove silent catches and dead status/station sync.** Replace `try{}catch{}` on job creation, archiving, advancement with transaction or `needs_attention` record; delete dead sync block and the `station: "decorating" as any` cast by fixing the type. _Touches: ARC, PROD_
- [ ] **ORD-08** [P5] **Comments, assignee and handoff status on orders.** Order comment thread with @mentions, 'assign to', statuses such as 'Needs info from sales' / 'Design approved'. _Touches: NOT_
- [ ] **ORD-09** [P5] **Order analytics feeds.** Volume by status and source, amendment rate, cancellation rate and reasons, lead time vs promise via milestones/events. _Touches: ANA_
- [ ] **ORD-10** [P2] **Order tests.** PATCH field whitelist, transition table, server pricing, override permission, gap-free numbering under concurrency. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| SEC-07 | `SEC` | Split and rename permissions to match actions | P3 |
| SEC-09 | `SEC` | Record-level scoping | P3 |
| QUO-05 | `QUO` | One-click convert-to-order | P4 |
| PROD-01 | `PROD` | Job state machine with guards on start/complete | P2 |
| PROD-02 | `PROD` | Persist real QC results and stop the QC bypass | P2 |
| PROD-06 | `PROD` | Capacity planning | P4 |
| INV-01 | `INV` | Single availability function; atomic reservation | P2 |
| DEL-01 | `DEL` | Interim patch: stop the false cash entries | P1 |
| DEL-04 | `DEL` | Settlement on completion | P1 |
| DEL-06 | `DEL` | One transaction, no swallowed errors | P3 |
| DEL-08 | `DEL` | Proof of delivery, driver assignment and view, zones and fees | P4 |
| DEL-09 | `DEL` | Optional prepayment policy | P5 |
| FIN-04 | `FIN` | Decide and implement accounting basis | P1 |
| FIN-07 | `FIN` | Invoices, credit notes, refunds | P4 |
| NOT-08 | `NOT` | Comments, @mentions, assignment and handoff statuses | P5 |
| CRM-04 | `CRM` | Convert reminder to draft order | P5 |
| CRM-05 | `CRM` | Customer merge and duplicate detection | P5 |
| CRM-06 | `CRM` | Preferences and allergies surface automatically | P5 |
| CRM-07 | `CRM` | Tags, segments, single timeline, feedback linked to job and baker | P5 |
| CAT-04 | `CAT` | Size and flavour variants with own cost and price | P4 |
| CAT-05 | `CAT` | Shared server pricing function | P2 |
| WEB-04 | `WEB` | Order tracking page | P5 |
| WEB-05 | `WEB` | Reference-image upload | P5 |
| ARC-04 | `ARC` | Transaction helper and repositories | P3 |
| ARC-05 | `ARC` | State-machine module | P3 |
| ARC-07 | `ARC` | No silent failures: `needs_attention` | P3 |
| ARC-08 | `ARC` | Split `store.ts` and `business.service.ts` by module | P4 |

### Verification (tests the skill must add or run)

- Cannot PATCH total/paymentStatus.
- confirm creates job + reservations atomically or fails.
- Concurrent creates never duplicate order numbers.

### UI scope

General: 6 UI items are catalogued for this module in the skill (`references/ui-features.md` → `ORD`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.3 Quotations & inquiries (`QUO`)

| | |
|---|---|
| **Source document** | [`Optim/Optim_quotations.md`](./Optim_quotations.md) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *Quotations and inquiries* (lines 513-521); *Most serious findings #6* (lines 479-491) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `QUO` |
| **Severity** | High |
| **Depends on** | `SEC`, `CAT`, `ORD` |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `QUO` |

**Summary.** `PATCH /quotations/:id` never saves; `createdBy` is the first admin; totals come from the client; sending and accepting share `quotations.accept`.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/routes/quotations.ts (PATCH builds merged copy and discards it)`
- `server/routes/inquiries.ts (only skimmed in audit)`
- `server/migrations/003_sales.sql`
- `erp-interface-design/src/components/erp/ (quotations UI inside workspace.tsx / module-table.tsx; confirm in code)`

### Step-by-step implementation and general checklist

- [ ] **QUO-00** [P0] Reconcile: read `Optim/Optim_quotations.md`, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **QUO-01** [P2] **Fix PATCH no-op; whitelist fields.** Persist the merged copy; allow edits only in DRAFT/SENT-as-new-version states. _Touches: ARC_
- [ ] **QUO-02** [P2] **Attribute quotes to the session user.** `createdBy = session.userId`; backfill note for historical rows. _Touches: ANA_
- [ ] **QUO-03** [P2] **Server-priced lines and separate `quotations.send`.** Use the catalogue pricing function; split send vs accept permission (SEC step 7). _Touches: CAT, SEC_
- [ ] **QUO-04** [P4] **Versions and expiry.** `quote_versions` (v1, v2...), `expires_at`; scheduler expires quotes and chases. _Touches: NOT, ARC_
- [ ] **QUO-05** [P4] **One-click convert-to-order.** Copies lines and prices through ORD server pricing; idempotent; sets `quote.converted_order_id`; emits events. _Touches: ORD, ANA_
- [ ] **QUO-06** [P5] **PDF and WhatsApp-ready quote.** Printable PDF template and `wa.me` prefilled text; records `quote_sent` interaction. _Touches: CRM_
- [ ] **QUO-07** [P5] **Funnel events and notifications.** Events `inquiry_received`, `quote_sent`, `quote_accepted`; rules: unanswered inquiry 1h/4h, expiring in 2 days, accepted not converted. _Touches: NOT, ANA_
- [ ] **QUO-08** [P2] **Quotation tests.** PATCH persists; send vs accept permissions; convert is idempotent; expiry job. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| SEC-07 | `SEC` | Split and rename permissions to match actions | P3 |
| ORD-02 | `ORD` | Server-side pricing on POST and `/repeat` | P2 |
| ANA-07 | `ANA` | Customer performance KPIs | P5 |
| CAT-03 | `CAT` | Allergen flags derived from ingredients | P4 |
| CAT-04 | `CAT` | Size and flavour variants with own cost and price | P4 |
| CAT-05 | `CAT` | Shared server pricing function | P2 |
| ARC-05 | `ARC` | State-machine module | P3 |

### Verification (tests the skill must add or run)

- Editing a quote persists.
- Sender without accept cannot accept.
- Double convert creates one order.

### UI scope

General: 4 UI items are catalogued for this module in the skill (`references/ui-features.md` → `QUO`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.4 Production (`PROD`)

| | |
|---|---|
| **Source document** | [`Optim/Optim_production.md`](./Optim_production.md) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *Production* (lines 522-544); *Most serious findings #4* (lines 479-491); *Job costing (Finance in depth)* (lines 347-389) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `PROD` |
| **Severity** | Critical |
| **Depends on** | `SEC`, `ARC`, `CAT`, `INV` |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `PROD` |

**Summary.** QC results are never saved (always PASS); `/start` and `/complete` skip status checks; `/complete` moves the order to ready before QC; costing uses selling price as unit cost with labour and packaging hard-coded to 0; no job-level timestamps.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/routes/production.ts (/jobs/:id/start, /complete)`
- `server/routes/production-costs.ts`
- `server/database/store.ts (createQualityCheck ~770, recordConsumption)`
- `server/services/business.service.ts (markProductionStarted)`
- `server/migrations/004_production.sql, 013_production_consumption.sql, 020_production_fixed_costs.sql`
- `erp-interface-design/src/components/erp/production-view.tsx`
- `erp-interface-design/src/test/production-materials.test.tsx`

### Step-by-step implementation and general checklist

- [ ] **PROD-00** [P0] Reconcile: read `Optim/Optim_production.md`, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **PROD-01** [P2] **Job state machine with guards on start/complete.** `PENDING -> IN_PRODUCTION -> READY_FOR_QC -> PASSED|REWORK -> READY_FOR_DELIVERY`; routes use `markProductionStarted`; 409 on illegal moves; the order follows the job, never the reverse. _Touches: ARC, ORD_
- [ ] **PROD-02** [P2] **Persist real QC results and stop the QC bypass.** Fix `createQualityCheck` (stores PASS always); save result, checklist, photo, rework reason code; `/complete` cannot set order ready until QC PASSED. _Touches: ORD, NOT_
- [ ] **PROD-03** [P3] **Job timestamps and QC/consumption schema.** Migration: `production_jobs.started_at/completed_at`, QC columns, `rework_reason_codes`, `planned_consumption`; backfill from step timestamps. _Touches: ANA, ARC_
- [ ] **PROD-04** [P4] **Recipe explosion into planned consumption.** On job creation: recipe x quantity -> planned lines; reserve against them; on completion compute usage and yield variance. _Touches: CAT, INV, FIN_
- [ ] **PROD-05** [P4] **Fix job costing.** `recordConsumption` uses inventory unit cost (not selling price); one cost row per job per category; packaging and labour no longer 0; labour hours per step per person; post rework cost and wastage to job costs and finance. _Touches: FIN, INV, STF_
- [ ] **PROD-06** [P4] **Capacity planning.** `capacity_settings` per day (hours or cake-units); warn when a new order date overloads it. _Touches: ORD, ANA_
- [ ] **PROD-07** [P5] **Production notifications and SLA hooks.** Job not started 24h before required date; step overdue vs standard; QC failed; cost variance over threshold. _Touches: NOT, ANA_
- [ ] **PROD-08** [P5] **Production analytics feeds.** Cycle time per step/product, rework rate and reasons, wastage cost, planned-vs-actual, jobs per baker (Admin only), on-time start. _Touches: ANA_
- [ ] **PROD-09** [P2] **Production tests.** Illegal transitions 409; QC fail blocks ready; costing uses unit cost; planned vs actual variance. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| SEC-08 | `SEC` | New roles: Finance/Accountant, Baker/Decorator, Delivery/Driver | P3 |
| SEC-09 | `SEC` | Record-level scoping | P3 |
| ORD-03 | `ORD` | Replace generic status PATCH with action endpoints | P3 |
| ORD-05 | `ORD` | Reschedule with reason code | P4 |
| ORD-06 | `ORD` | Order amendments (change requests) | P4 |
| ORD-07 | `ORD` | Remove silent catches and dead status/station sync | P3 |
| INV-01 | `INV` | Single availability function; atomic reservation | P2 |
| INV-04 | `INV` | Weighted-average cost on goods receipt; FEFO consumption | P4 |
| DEL-06 | `DEL` | One transaction, no swallowed errors | P3 |
| FIN-06 | `FIN` | Event-to-journal posting and period close | P4 |
| FIN-09 | `FIN` | Job costing and margin per order | P4 |
| ANA-05 | `ANA` | Operations KPIs | P5 |
| NOT-08 | `NOT` | Comments, @mentions, assignment and handoff statuses | P5 |
| NOT-09 | `NOT` | Scheduled escalation jobs | P5 |
| CRM-06 | `CRM` | Preferences and allergies surface automatically | P5 |
| CRM-07 | `CRM` | Tags, segments, single timeline, feedback linked to job and baker | P5 |
| CAT-03 | `CAT` | Allergen flags derived from ingredients | P4 |
| STF-03 | `STF` | Tie hours to jobs | P4 |
| WEB-05 | `WEB` | Reference-image upload | P5 |
| ARC-05 | `ARC` | State-machine module | P3 |
| ARC-07 | `ARC` | No silent failures: `needs_attention` | P3 |

### Verification (tests the skill must add or run)

- Complete a pending job -> 409.
- QC FAIL stored as FAIL and blocks ready.
- Consumption cost = inventory unit cost x qty.

### UI scope

General: 6 UI items are catalogued for this module in the skill (`references/ui-features.md` → `PROD`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.5 Inventory (`INV`)

| | |
|---|---|
| **Source document** | [`Optim/Optim_inventory.md`](./Optim_inventory.md) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *Inventory* (lines 545-553); *Most serious findings #7* (lines 479-491) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `INV` |
| **Severity** | High |
| **Depends on** | `SEC`, `ARC` |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `INV` |

**Summary.** `adjustInventory` accepts negatives and has no reason or approval; `reserveStock` ignores other orders' reservations (double-allocation); no batch/expiry; availability computed two ways.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/routes/inventory.ts`
- `server/services/business.service.ts (reserveStock, adjustInventory)`
- `server/services/stock-alerts.ts`
- `server/migrations/005_inventory_purchasing.sql, 010_inventory_cost.sql, 019_inventory_adjust_to_role_admin.sql`
- `erp-interface-design/src/components/erp/inventory-view.tsx`

### Step-by-step implementation and general checklist

- [ ] **INV-00** [P0] Reconcile: read `Optim/Optim_inventory.md`, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **INV-01** [P2] **Single availability function; atomic reservation.** `available = on_hand - all active reservations`; `reserveStock` uses it inside a transaction; fixes double promise of the same flour. _Touches: ORD, PROD, ARC_
- [ ] **INV-02** [P2] **Validate adjustments.** Reject results below zero; mandatory reason code; large write-offs need approval (`inventory.approve_writeoff`); reconcile with migration 019 (adjust moved to Admin). _Touches: SEC, NOT, FIN_
- [ ] **INV-03** [P4] **Batches, expiry, units, reason codes migration.** `inventory_batches(expiry_date, lot)`, `unit_conversions`, `adjustment_reasons`, `stock_counts`, weighted-average cost columns. _Touches: ARC_
- [ ] **INV-04** [P4] **Weighted-average cost on goods receipt; FEFO consumption.** Receipt updates average cost; consumption picks earliest expiry first. _Touches: PUR, PROD, FIN_
- [ ] **INV-05** [P4] **Stock-take flow.** Count vs system, variance posted with approval, journal entry for shrinkage. _Touches: FIN, SEC_
- [ ] **INV-06** [P5] **Inventory alerts and reorder suggestions.** Expiring within 3 days, negative attempt, variance above threshold, reorder point; calculated suggestions from upcoming orders. _Touches: NOT, PUR_
- [ ] **INV-07** [P5] **Inventory analytics feeds.** Valuation, days on hand, turnover, shrinkage, near-expiry value, price trend. _Touches: ANA_
- [ ] **INV-08** [P2] **Inventory tests.** Reservation across orders; negative blocked; FEFO; weighted-average maths. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| SEC-07 | `SEC` | Split and rename permissions to match actions | P3 |
| SEC-10 | `SEC` | Approval (maker-checker) framework | P3 |
| ORD-03 | `ORD` | Replace generic status PATCH with action endpoints | P3 |
| PROD-04 | `PROD` | Recipe explosion into planned consumption | P4 |
| PROD-05 | `PROD` | Fix job costing | P4 |
| PUR-03 | `PUR` | PO approval thresholds and partial receipts | P4 |
| PUR-04 | `PUR` | Supplier bills, bill payments, payables | P4 |
| PUR-06 | `PUR` | Purchase suggestions | P5 |
| FIN-06 | `FIN` | Event-to-journal posting and period close | P4 |
| ANA-05 | `ANA` | Operations KPIs | P5 |
| NOT-09 | `NOT` | Scheduled escalation jobs | P5 |
| CAT-02 | `CAT` | Yield, batch size and cost roll-up | P4 |
| ARC-08 | `ARC` | Split `store.ts` and `business.service.ts` by module | P4 |

### Verification (tests the skill must add or run)

- Two orders cannot reserve the same stock.
- Adjustment below zero rejected.
- FEFO picks earliest expiry.

### UI scope

General: 4 UI items are catalogued for this module in the skill (`references/ui-features.md` → `INV`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.6 Purchasing & payables (`PUR`)

| | |
|---|---|
| **Source document** | [`Optim/Optim_purchasing.md`](./Optim_purchasing.md) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *Purchasing* (lines 554-562); *Supplier bills (Finance basics)* (lines 148-167) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `PUR` |
| **Severity** | High |
| **Depends on** | `SEC`, `INV`, `FIN` |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `PUR` |

**Summary.** Supplier creation is unauthenticated, PO permission check is ignored, an invalid supplier silently becomes the first active supplier (or a 'Default Supplier'), and there are no supplier bills or payables.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/routes/purchasing.ts`
- `server/database/store.ts (PO creation, supplier fallback)`
- `server/migrations/005_inventory_purchasing.sql`
- `erp-interface-design/src/components/erp/purchasing-view.tsx`

### Step-by-step implementation and general checklist

- [ ] **PUR-00** [P0] Reconcile: read `Optim/Optim_purchasing.md`, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **PUR-01** [P0] **Verify purchasing auth closed.** Confirm SEC step 2 closed both routes; add regression tests. _Touches: SEC_
- [ ] **PUR-02** [P2] **Stop silent supplier fallback.** Missing/invalid supplier -> 422; remove 'Default Supplier' auto-creation.
- [ ] **PUR-03** [P4] **PO approval thresholds and partial receipts.** Uses approvals framework; discrepancy notes on goods receipt. _Touches: SEC, INV, NOT_
- [ ] **PUR-04** [P4] **Supplier bills, bill payments, payables.** Migration `supplier_bills`, `bill_payments`; goods received posts Dr Inventory / Cr Accounts Payable. _Touches: FIN, INV_
- [ ] **PUR-05** [P4] **Three-way match.** PO <-> goods receipt <-> bill with tolerance and mismatch flag. _Touches: FIN, NOT_
- [ ] **PUR-06** [P5] **Purchase suggestions.** Generated from reservations and reorder levels. _Touches: INV_
- [ ] **PUR-07** [P5] **Supplier performance.** Lead time vs promised, OTIF, price variance (PO vs last price). _Touches: ANA_
- [ ] **PUR-08** [P5] **Purchasing notifications.** PO awaiting approval, PO overdue, bill due in 3 days, price increase over 10%. _Touches: NOT_
- [ ] **PUR-09** [P0] **Purchasing tests.** Unauthenticated create rejected; invalid supplier 422; three-way match. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| SEC-02 | `SEC` | Close unprotected and fake-protected routes | P0 |
| SEC-10 | `SEC` | Approval (maker-checker) framework | P3 |
| INV-04 | `INV` | Weighted-average cost on goods receipt; FEFO consumption | P4 |
| INV-06 | `INV` | Inventory alerts and reorder suggestions | P5 |
| FIN-10 | `FIN` | Payables, payroll and expense posting | P4 |
| ARC-05 | `ARC` | State-machine module | P3 |

### Verification (tests the skill must add or run)

- No-auth POST -> 401.
- Bad supplier id -> 422.
- Bill amount mismatch flagged.

### UI scope

General: 4 UI items are catalogued for this module in the skill (`references/ui-features.md` → `PUR`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.7 Deliveries (`DEL`)

| | |
|---|---|
| **Source document** | [`Optim/Optim_deliveries.md`](./Optim_deliveries.md) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *Deliveries* (lines 563-572); *Elaboration on Finding 1 (complete-delivery auto-cash)* (lines 636-738); *Most serious findings #1, #3* (lines 479-491) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `DEL` |
| **Severity** | Critical |
| **Depends on** | `SEC`, `FIN`, `ARC` |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `DEL` |

**Summary.** Completing a delivery auto-creates a Cash payment for the whole unpaid balance (finding #1); `PATCH /deliveries/:id` needs only `deliveries.view`; `/complete` has no precondition; cancel is stored as FAILED; no proof of delivery or cash tracking.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/routes/deliveries.ts (/complete lines ~74-110; markOrderPaid call ~90)`
- `server/services/business.service.ts (markOrderPaid ~576)`
- `server/database/store.ts`
- `server/migrations/006_finance_delivery.sql, 007_delivery_actual_date.sql`
- `erp-interface-design/src/components/erp/deliveries-view.tsx, deliveries-panels.tsx, deliveries-filters.tsx, dialogs.tsx`
- `erp-interface-design/deliveries.md, delivery-progress.md`
- `erp-interface-design/src/test/markorder-paid.test.ts`

### Step-by-step implementation and general checklist

- [ ] **DEL-00** [P0] Reconcile: read `Optim/Optim_deliveries.md`, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **DEL-01** [P1] **Interim patch: stop the false cash entries.** Remove the `markOrderPaid` call from `/complete`; show balance due on the delivery card with a 'Record payment' button using the existing payments endpoint (about 20 minutes). _Touches: FIN, ORD, NOT_
- [ ] **DEL-02** [P0] **Lock down `PATCH /deliveries/:id`.** Require `deliveries.update`; whitelist fields; status changes only via action endpoints. _Touches: SEC_
- [ ] **DEL-03** [P1] **State guards and new statuses.** `SCHEDULED -> ASSIGNED -> DISPATCHED -> DELIVERED | FAILED_ATTEMPT -> RESCHEDULED | CANCELLED`; complete only from IN_TRANSIT (delivery) or AWAITING_COLLECTION (pickup) else 409; separate cancelled from failed with reason codes; map legacy `FAILED`. _Touches: ARC, ANA_
- [ ] **DEL-04** [P1] **Settlement on completion.** Body requires `collected{amount,method,reference}` or `noCollection{reason}`; API returns `balanceDue`; 422 if neither; partial -> order stays `PARTIALLY_PAID` and Finance is alerted; over-collection flagged for review; real method (Cash, MTN MoMo, Airtel Money, bank) with reference required for non-cash. _Touches: FIN, ORD, NOT_
- [ ] **DEL-05** [P4] **Cash with driver and remittance.** `delivery_collections` table; money sits as 'cash with driver' until Finance confirms handover (`payments.confirm_remittance`); daily cash-up compares. _Touches: FIN, NOT, SEC_
- [ ] **DEL-06** [P3] **One transaction, no swallowed errors.** Complete delivery + payment + order status + job archive + follow-up atomically; on failure roll back or create `needs_attention` item. _Touches: ARC, ORD, PROD, CRM_
- [ ] **DEL-07** [P1] **Fix the payment-received notification.** Send to holders of `payments.view`/`finance.view` (no `isAdmin:true`); real method and amount; alert when collected differs from expected. _Touches: NOT_
- [ ] **DEL-08** [P4] **Proof of delivery, driver assignment and view, zones and fees.** Recipient name, photo, signature or one-time code; re-attempt tracking; driver view; delivery zones; decide whether `order.deliveryCharge` or `delivery.deliveryFee` is authoritative. _Touches: ORD, FIN, SEC_
- [ ] **DEL-09** [P5] **Optional prepayment policy.** Setting: custom and wedding cakes require full payment before dispatch; COD only for small standard orders or approved customers. _Touches: FIN, ORD_
- [ ] **DEL-10** [P5] **Delivery analytics and notifications.** On-time %, lateness, failed-attempt rate/reasons, cost per delivery, per driver, zone profitability; alerts: due in 2h not dispatched, late vs slot, failed attempt, cash not remitted. _Touches: ANA, NOT_
- [ ] **DEL-11** [P1] **Delivery tests (audit list).** Complete from pending/failed/completed -> 409; full collection -> one payment with stated method; partial -> PARTIALLY_PAID + alert; no collection no reason -> 422; payment failure rolls back; two simultaneous completes -> one payment. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| SEC-02 | `SEC` | Close unprotected and fake-protected routes | P0 |
| SEC-07 | `SEC` | Split and rename permissions to match actions | P3 |
| SEC-08 | `SEC` | New roles: Finance/Accountant, Baker/Decorator, Delivery/Driver | P3 |
| SEC-09 | `SEC` | Record-level scoping | P3 |
| ORD-05 | `ORD` | Reschedule with reason code | P4 |
| FIN-01 | `FIN` | Append-only payments | P1 |
| FIN-04 | `FIN` | Decide and implement accounting basis | P1 |
| FIN-08 | `FIN` | Payment provider abstraction, reconciliation, cash-up | P4 |
| ANA-05 | `ANA` | Operations KPIs | P5 |
| NOT-04 | `NOT` | Fill templates, use caller message, honour preferences, add recipients to payment alerts | P3 |
| NOT-09 | `NOT` | Scheduled escalation jobs | P5 |
| WEB-04 | `WEB` | Order tracking page | P5 |
| ARC-04 | `ARC` | Transaction helper and repositories | P3 |
| ARC-05 | `ARC` | State-machine module | P3 |
| ARC-07 | `ARC` | No silent failures: `needs_attention` | P3 |

### Verification (tests the skill must add or run)

- The six audit tests (see step 11).
- markorder-paid.test.ts updated for the new settlement flow.

### UI scope

General: 6 UI items are catalogued for this module in the skill (`references/ui-features.md` → `DEL`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.8 Finance (`FIN`)

| | |
|---|---|
| **Source document** | [`Optim/Optim_finance.md`](./Optim_finance.md) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *1. Finance module (standard guidance)* (lines 5-34); *Finance module (code review)* (lines 148-167); *3. Finance in depth* (lines 347-389); *Finding 1 fix (reversals, remittance)* (lines 684-738) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `FIN` |
| **Severity** | Critical |
| **Depends on** | `SEC`, `ARC`, `DEL` |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `FIN` |

**Summary.** Payments are hard-deletable and double-recordable; revenue is counted at order creation; profit mixes all-time costs with monthly revenue; no invoices, credit notes, ledger, periods or payables; money maths in JS floats; M-Pesa simulator only.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/routes/finance.ts, payments.ts, expenses.ts, remuneration.ts`
- `server/services/business.service.ts`
- `server/database/store.ts (M-Pesa failure path splices the payment row)`
- `server/migrations/006_finance_delivery.sql, 017_staff_remuneration.sql, 020_production_fixed_costs.sql`
- `erp-interface-design/src/components/erp/finance-view.tsx`
- `erp-interface-design/src/test/markorder-paid.test.ts`

### Step-by-step implementation and general checklist

- [ ] **FIN-00** [P0] Reconcile: read `Optim/Optim_finance.md`, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **FIN-01** [P1] **Append-only payments.** M-Pesa failure path marks `FAILED` instead of splicing; reversals are new negative rows linked to the original with reason and approval; DB trigger/privilege blocks UPDATE/DELETE on payments. _Touches: DEL, NOT, SEC_
- [ ] **FIN-02** [P1] **Validation, idempotency, integer UGX.** `Idempotency-Key` header or unique `reference`; reject zero/negative; overpayment only if flagged; round at each step or store integer UGX. _Touches: ARC_
- [ ] **FIN-03** [P1] **Fix period filtering in profit reports.** `grossProfit` uses revenue, `directCosts` and `expensesTotal` for the same period; add period parameters to dashboard queries. _Touches: ANA_
- [ ] **FIN-04** [P1] **Decide and implement accounting basis.** Accrual: revenue at delivery; deposits held as Customer Deposits liability; record the decision as a setting plus a doc. _Touches: ORD, DEL, ANA_
- [ ] **FIN-05** [P4] **Ledger schema and chart of accounts.** Migration: `accounts`, `journal_entries`, `journal_lines` (immutable), `invoices`, `invoice_lines`, `credit_notes`, `payment_allocations`, `accounting_periods`, `budgets`; seed accounts (Cash, Mobile Money, AR, Inventory, COGS, Sales Revenue, Customer Deposits, Expenses, AP). _Touches: ARC_
- [ ] **FIN-06** [P4] **Event-to-journal posting and period close.** Subscriber posts balanced entries per the event table (deposit, delivered, balance, goods received, consumption, wastage, refund, expense); month close locks periods; manual journals need maker-checker. _Touches: ARC, NOT, SEC, INV, PROD_
- [ ] **FIN-07** [P4] **Invoices, credit notes, refunds.** Sequential gap-free invoice numbers, issue/due dates, statuses; refunds and discounts above threshold via approvals (`payments.refund`); VAT fields if registered (check current URA rules). _Touches: ORD, SEC, NOT_
- [ ] **FIN-08** [P4] **Payment provider abstraction, reconciliation, cash-up.** `PaymentProvider` interface (MTN MoMo, Airtel Money, simulator); verify webhook signatures; match provider statement references; daily cash-up expected vs counted. _Touches: DEL, NOT_
- [ ] **FIN-09** [P4] **Job costing and margin per order.** Planned (recipe) vs actual (consumption, labour, fixed costs); price/usage/yield variance; margin computed at delivery with threshold alert. _Touches: PROD, CAT, STF, NOT, ANA_
- [ ] **FIN-10** [P4] **Payables, payroll and expense posting.** Supplier bills/AP (with PUR), payroll accrual and payment (with STF), expense approval (`expenses.approve`), audit old/new JSON on expense edits and deletes. _Touches: PUR, STF, NOT_
- [ ] **FIN-11** [P5] **Finance reports and export.** P&L (vs previous and same month last year), cash flow, receivables and payables ageing (current, 1-7, 8-30, 30+), deposits held, margin by product/size/occasion/channel, expenses vs budget, supplier spend; CSV/PDF with period applied. _Touches: ANA_
- [ ] **FIN-12** [P1] **Finance tests.** Ledger balances, deposit and refund flows, idempotent payment, period lock, reversal linkage. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| SEC-07 | `SEC` | Split and rename permissions to match actions | P3 |
| SEC-08 | `SEC` | New roles: Finance/Accountant, Baker/Decorator, Delivery/Driver | P3 |
| SEC-10 | `SEC` | Approval (maker-checker) framework | P3 |
| ORD-01 | `ORD` | Whitelist PATCH fields; make `paymentStatus` derived only | P0 |
| ORD-06 | `ORD` | Order amendments (change requests) | P4 |
| PROD-04 | `PROD` | Recipe explosion into planned consumption | P4 |
| PROD-05 | `PROD` | Fix job costing | P4 |
| INV-02 | `INV` | Validate adjustments | P2 |
| INV-04 | `INV` | Weighted-average cost on goods receipt; FEFO consumption | P4 |
| INV-05 | `INV` | Stock-take flow | P4 |
| PUR-04 | `PUR` | Supplier bills, bill payments, payables | P4 |
| PUR-05 | `PUR` | Three-way match | P4 |
| DEL-01 | `DEL` | Interim patch: stop the false cash entries | P1 |
| DEL-04 | `DEL` | Settlement on completion | P1 |
| DEL-05 | `DEL` | Cash with driver and remittance | P4 |
| DEL-08 | `DEL` | Proof of delivery, driver assignment and view, zones and fees | P4 |
| DEL-09 | `DEL` | Optional prepayment policy | P5 |
| ANA-06 | `ANA` | Finance KPIs and margin | P5 |
| NOT-02 | `NOT` | Use role routing by permission | P3 |
| NOT-04 | `NOT` | Fill templates, use caller message, honour preferences, add recipients to payment alerts | P3 |
| NOT-05 | `NOT` | Audit becomes the event stream | P3 |
| NOT-09 | `NOT` | Scheduled escalation jobs | P5 |
| CAT-02 | `CAT` | Yield, batch size and cost roll-up | P4 |
| STF-02 | `STF` | Post payroll accruals and payments to finance | P4 |
| STF-03 | `STF` | Tie hours to jobs | P4 |
| ARC-04 | `ARC` | Transaction helper and repositories | P3 |
| ARC-06 | `ARC` | `domain_events` table and `emit(tx, ...)` helper | P3 |
| ARC-07 | `ARC` | No silent failures: `needs_attention` | P3 |
| ARC-08 | `ARC` | Split `store.ts` and `business.service.ts` by module | P4 |

### Verification (tests the skill must add or run)

- Debits equal credits for every posting.
- Duplicate payment key records once.
- Closed period rejects postings.
- Reversal links to original.

### UI scope

General: 7 UI items are catalogued for this module in the skill (`references/ui-features.md` → `FIN`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.9 Analytics (`ANA`)

| | |
|---|---|
| **Source document** | [`Optim/Optim_analytics.md`](./Optim_analytics.md) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *2. Analytics module (standard guidance)* (lines 35-52); *Analytics module (code review)* (lines 168-183); *4. Analytics in depth* (lines 390-426); *2. Time tracking* (lines 305-346) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `ANA` |
| **Severity** | High |
| **Depends on** | `ARC`, `NOT`, `FIN`, `ORD`, `PROD`, `DEL` |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `ANA` |

**Summary.** Everything is computed in memory per request; frontend shows invented fallback numbers; no date ranges or comparisons; cost and margin visible to roles that should not see them.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/routes/analytics.ts`
- `erp-interface-design/src/components/erp/analytics-view.tsx (hardcoded fallback 182080 and '64% gross margin', line ~54)`
- `erp-interface-design/src/components/erp/dashboard.tsx`
- `server/database/store.ts (aggregates computed in memory)`

### Step-by-step implementation and general checklist

- [ ] **ANA-00** [P0] Reconcile: read `Optim/Optim_analytics.md`, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **ANA-01** [P0] **Remove hardcoded fallbacks; add empty states.** Delete `182080` and `64% gross margin` fallbacks; consistent empty/loading/error states.
- [ ] **ANA-02** [P5] **Reporting views and daily snapshot.** SQL views `fact_orders/milestones/payments/jobs/deliveries/expenses`, `dim_date/customer/product`; nightly `daily_metrics`; `order_milestones` view from `domain_events`; use `Africa/Kampala` day boundaries. _Touches: ARC, NOT_
- [ ] **ANA-03** [P5] **Generic metrics endpoint.** `GET /analytics/metrics?metric=&from=&to=&grain=&compare=prev|yoy&groupBy=&dateBasis=order|delivery|payment`; SQL aggregation (`GROUP BY date_trunc`). _Touches: ARC_
- [ ] **ANA-04** [P5] **Metric definitions page.** Written definition per metric; date basis explained.
- [ ] **ANA-05** [P5] **Operations KPIs.** On-time %, p50/p90 lateness, lead/cycle time, capacity utilisation, QC fail/rework, wastage, stock days on hand, delivery cost per order. _Touches: PROD, DEL, INV_
- [ ] **ANA-06** [P5] **Finance KPIs and margin.** Revenue, gross/net margin, AOV, deposit-collection rate, DSO, overdue receivables, cash runway, expense ratio, labour cost per order; margin per order and product. _Touches: FIN_
- [ ] **ANA-07** [P5] **Customer performance KPIs.** Repeat rate, CLV (margin-based), RFM, expected re-order interval, occasion rebooking, reminder conversion, funnel, payment behaviour, satisfaction, source performance, concentration. _Touches: CRM, QUO_
- [ ] **ANA-08** [P3] **Permission split and role-scoped dashboards.** `analytics.operations|finance|customers|staff`; Bakers see own queue and cycle time; Sales sees funnel without margins; staff comparisons Admin-only. _Touches: SEC_
- [ ] **ANA-09** [P5] **Dashboard redesign.** 6-8 KPI cards, trend chart, action list; every card clicks through to the filtered list; date range, compare-to-previous, CSV and PDF export.
- [ ] **ANA-10** [P5] **SLA policies and milestone checks.** Table `sla_policies`; scheduler checks open orders and raises warn/breach events. _Touches: NOT, ARC_
- [ ] **ANA-11** [P5] **Analytics tests.** Metric correctness on seeded fixtures; role scoping hides margin. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| SEC-07 | `SEC` | Split and rename permissions to match actions | P3 |
| SEC-08 | `SEC` | New roles: Finance/Accountant, Baker/Decorator, Delivery/Driver | P3 |
| ORD-04 | `ORD` | Timestamps and numbering migration | P3 |
| ORD-05 | `ORD` | Reschedule with reason code | P4 |
| ORD-09 | `ORD` | Order analytics feeds | P5 |
| QUO-02 | `QUO` | Attribute quotes to the session user | P2 |
| QUO-05 | `QUO` | One-click convert-to-order | P4 |
| QUO-07 | `QUO` | Funnel events and notifications | P5 |
| PROD-03 | `PROD` | Job timestamps and QC/consumption schema | P3 |
| PROD-06 | `PROD` | Capacity planning | P4 |
| PROD-07 | `PROD` | Production notifications and SLA hooks | P5 |
| PROD-08 | `PROD` | Production analytics feeds | P5 |
| INV-07 | `INV` | Inventory analytics feeds | P5 |
| PUR-07 | `PUR` | Supplier performance | P5 |
| DEL-03 | `DEL` | State guards and new statuses | P1 |
| DEL-10 | `DEL` | Delivery analytics and notifications | P5 |
| FIN-03 | `FIN` | Fix period filtering in profit reports | P1 |
| FIN-04 | `FIN` | Decide and implement accounting basis | P1 |
| FIN-09 | `FIN` | Job costing and margin per order | P4 |
| FIN-11 | `FIN` | Finance reports and export | P5 |
| NOT-09 | `NOT` | Scheduled escalation jobs | P5 |
| CRM-07 | `CRM` | Tags, segments, single timeline, feedback linked to job and baker | P5 |
| CRM-08 | `CRM` | Reminder outcomes | P5 |
| CAT-06 | `CAT` | Price-change history and analytics | P5 |
| WEB-06 | `WEB` | Source tagging and SEO basics | P5 |
| ARC-06 | `ARC` | `domain_events` table and `emit(tx, ...)` helper | P3 |

### Verification (tests the skill must add or run)

- Snapshot values unchanged after record edit.
- Baker role receives no margin fields.

### UI scope

General: 5 UI items are catalogued for this module in the skill (`references/ui-features.md` → `ANA`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.10 Notifications & audit (`NOT`)

| | |
|---|---|
| **Source document** | [`Optim/Optim_notifications_audit.md`](./Optim_notifications_audit.md) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *Notifications: what exists / what's broken* (lines 229-267); *1. The event spine* (lines 276-304); *5. Notification rules driven by events* (lines 427-472); *Audit log detail (Finance #9)* (lines 148-167) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `NOT` |
| **Severity** | Critical |
| **Depends on** | `SEC`, `ARC` |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `NOT` |

**Summary.** Everyone sees everyone's notifications (store ignores userId); role routing is bypassed by `isAdmin:true`; role names do not match seeded roles; external channels never send; 4 rows per event inflate the unread badge; templates unfilled; preferences ignored; no live updates; no cross-role messaging.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/services/notification.service.ts (publishEvent, notifyUser, ROLES_FOR_EVENT)`
- `server/routes/notifications.ts`
- `server/database/store.ts (getUserNotifications ignores userId; createNotification)`
- `server/services/business.service.ts (isAdmin:true calls at lines ~92 and ~324)`
- `erp-interface-design/src/components/erp/topbar.tsx`
- `server/migrations (audit_logs, notifications; locate exact files)`

### Step-by-step implementation and general checklist

- [ ] **NOT-00** [P0] Reconcile: read `Optim/Optim_notifications_audit.md`, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **NOT-01** [P0] **Scope notifications by recipient (security leak).** `getUserNotifications(userId)` returns only rows with a recipient row for that user; route uses it. _Touches: SEC_
- [ ] **NOT-02** [P3] **Use role routing by permission.** Call `publishEvent` without the admin shortcut; resolve recipients by permission (e.g. `payments.view`); create the Finance role. _Touches: SEC, FIN_
- [ ] **NOT-03** [P3] **One notification per user per event; channels as delivery records.** Fix inflated unread badge; real in-app channel; external rows only when a provider is configured and preference allows.
- [ ] **NOT-04** [P3] **Fill templates, use caller message, honour preferences, add recipients to payment alerts.** Interpolate `{{orderNumber}}` etc.; call `getPreferencesForEvent`; payment routes create recipient rows. _Touches: FIN, DEL_
- [ ] **NOT-05** [P3] **Audit becomes the event stream.** Using ARC's `domain_events`: `audit_logs` becomes a view, append-only (revoke UPDATE/DELETE), old/new JSON, IP, correlation id; cover expense edits/deletes. _Touches: ARC, FIN_
- [ ] **NOT-06** [P5] **Rules engine and `notification_rules`.** Permission-based recipients; dedupe window, quiet hours, daily digest for low severity, acknowledgement and escalation; audit `notification.created/delivered/read/acknowledged/failed`; starter rule set from the audit table. _Touches: ARC, SEC_
- [ ] **NOT-07** [P5] **Live delivery.** `/notifications/stream` (SSE) or 30-second polling first; bell updates without reload.
- [ ] **NOT-08** [P5] **Comments, @mentions, assignment and handoff statuses.** Order and job threads; mention notifies the person; 'assign to'; statuses like 'Needs info from sales'. _Touches: ORD, PROD_
- [ ] **NOT-09** [P5] **Scheduled escalation jobs.** Overdue invoices (1, 7, 14 days), required date within 48h with no job, delivery 30+ min late, stock below reorder. _Touches: FIN, PROD, DEL, INV, ANA_
- [ ] **NOT-10** [P5] **`NotificationChannel` interface.** Start with one-click `wa.me` links; swap providers later. _Touches: CRM_
- [ ] **NOT-11** [P0] **Notification tests.** Recipient scoping, unread count, template fill, preference respect, dedupe. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| SEC-03 | `SEC` | Rate limiting on login, register, reset-credentials and public forms | P0 |
| SEC-08 | `SEC` | New roles: Finance/Accountant, Baker/Decorator, Delivery/Driver | P3 |
| SEC-10 | `SEC` | Approval (maker-checker) framework | P3 |
| SEC-11 | `SEC` | Audit security events and permission changes | P3 |
| ORD-02 | `ORD` | Server-side pricing on POST and `/repeat` | P2 |
| ORD-05 | `ORD` | Reschedule with reason code | P4 |
| ORD-06 | `ORD` | Order amendments (change requests) | P4 |
| ORD-08 | `ORD` | Comments, assignee and handoff status on orders | P5 |
| QUO-04 | `QUO` | Versions and expiry | P4 |
| QUO-07 | `QUO` | Funnel events and notifications | P5 |
| PROD-02 | `PROD` | Persist real QC results and stop the QC bypass | P2 |
| PROD-07 | `PROD` | Production notifications and SLA hooks | P5 |
| INV-02 | `INV` | Validate adjustments | P2 |
| INV-06 | `INV` | Inventory alerts and reorder suggestions | P5 |
| PUR-03 | `PUR` | PO approval thresholds and partial receipts | P4 |
| PUR-05 | `PUR` | Three-way match | P4 |
| PUR-08 | `PUR` | Purchasing notifications | P5 |
| DEL-01 | `DEL` | Interim patch: stop the false cash entries | P1 |
| DEL-04 | `DEL` | Settlement on completion | P1 |
| DEL-05 | `DEL` | Cash with driver and remittance | P4 |
| DEL-07 | `DEL` | Fix the payment-received notification | P1 |
| DEL-10 | `DEL` | Delivery analytics and notifications | P5 |
| FIN-01 | `FIN` | Append-only payments | P1 |
| FIN-06 | `FIN` | Event-to-journal posting and period close | P4 |
| FIN-07 | `FIN` | Invoices, credit notes, refunds | P4 |
| FIN-08 | `FIN` | Payment provider abstraction, reconciliation, cash-up | P4 |
| FIN-09 | `FIN` | Job costing and margin per order | P4 |
| FIN-10 | `FIN` | Payables, payroll and expense posting | P4 |
| ANA-02 | `ANA` | Reporting views and daily snapshot | P5 |
| ANA-10 | `ANA` | SLA policies and milestone checks | P5 |
| CRM-01 | `CRM` | Reminder scheduler | P5 |
| CRM-02 | `CRM` | Occasion templates and one-click WhatsApp | P5 |
| CRM-03 | `CRM` | Consent and opt-out per channel | P4 |
| CRM-09 | `CRM` | CRM notifications | P5 |
| STF-05 | `STF` | Payroll notifications | P5 |
| ARC-06 | `ARC` | `domain_events` table and `emit(tx, ...)` helper | P3 |

### Verification (tests the skill must add or run)

- User A cannot read user B's notifications.
- One event -> one unread per user.
- Template variables resolved.

### UI scope

General: 5 UI items are catalogued for this module in the skill (`references/ui-features.md` → `NOT`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.11 Customers, CRM & feedback (`CRM`)

| | |
|---|---|
| **Source document** | [`Optim/Optim_crm.md`](./Optim_crm.md) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *4. CRM and customer reminders* (lines 78-90); *CRM and reminders (code review)* (lines 184-193); *Customers, CRM and feedback* (lines 573-586) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `CRM` |
| **Severity** | Medium |
| **Depends on** | `SEC`, `NOT`, `ORD` |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `CRM` |

**Summary.** Strong concept (events, recurring reminders, snapshots) but nothing sends or schedules a reminder; no templates, consent, merge, tags, or single customer timeline.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/routes/customers.ts, customer-reminders.ts, feedback.ts, inquiries.ts`
- `server/migrations/011_order_follow_up.sql`
- `erp-interface-design/src/components/erp/crm-view.tsx, crm-panels.tsx`
- `docs/twin-cakery-customer-crm-ui-ux-guide.md`
- `erp-interface-design/crm.md`
- `erp-interface-design/src/test/occasions.test.ts`

### Step-by-step implementation and general checklist

- [ ] **CRM-00** [P0] Reconcile: read `Optim/Optim_crm.md`, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **CRM-01** [P5] **Reminder scheduler.** node-cron or DB-backed queue creates a daily 'reminders due' notification and escalates; human stays in the loop. _Touches: NOT, ARC_
- [ ] **CRM-02** [P5] **Occasion templates and one-click WhatsApp.** Templates per occasion with placeholders; `wa.me/<number>?text=` prefilled; logs an interaction. _Touches: NOT_
- [ ] **CRM-03** [P4] **Consent and opt-out per channel.** Migration columns/table; enforced when sending or suggesting a send; opt-out line in templates. _Touches: NOT, WEB_
- [ ] **CRM-04** [P5] **Convert reminder to draft order.** Copies last year's cake/lines as a draft order via ORD server pricing. _Touches: ORD, CAT_
- [ ] **CRM-05** [P5] **Customer merge and duplicate detection.** Match on phone/email across all creation paths (not just public inquiry); merge tool keeps history; single identity with optional website login. _Touches: WEB, ORD_
- [ ] **CRM-06** [P5] **Preferences and allergies surface automatically.** Appear on new orders and production sheets. _Touches: ORD, PROD_
- [ ] **CRM-07** [P5] **Tags, segments, single timeline, feedback linked to job and baker.** Timeline across inquiries, quotes, orders, payments, feedback, interactions, photos. _Touches: ORD, PROD, ANA_
- [ ] **CRM-08** [P5] **Reminder outcomes.** Status contacted/rebooked/lost and conversion reporting. _Touches: ANA_
- [ ] **CRM-09** [P5] **CRM notifications.** Complaint logged -> Admin; follow-up pending after 48h; reminder due this week; VIP order placed. _Touches: NOT_
- [ ] **CRM-10** [P5] **CRM tests.** Duplicate detection, consent blocks send, convert copies lines. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| SEC-09 | `SEC` | Record-level scoping | P3 |
| QUO-06 | `QUO` | PDF and WhatsApp-ready quote | P5 |
| DEL-06 | `DEL` | One transaction, no swallowed errors | P3 |
| ANA-07 | `ANA` | Customer performance KPIs | P5 |
| NOT-10 | `NOT` | `NotificationChannel` interface | P5 |
| WEB-01 | `WEB` | Harden public endpoints | P0 |
| WEB-03 | `WEB` | One customer identity with optional login | P5 |
| ARC-08 | `ARC` | Split `store.ts` and `business.service.ts` by module | P4 |

### Verification (tests the skill must add or run)

- Opted-out customer never gets a send link.
- Merge preserves orders and events.

### UI scope

General: 4 UI items are catalogued for this module in the skill (`references/ui-features.md` → `CRM`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.12 Catalogue & recipes (`CAT`)

| | |
|---|---|
| **Source document** | `Optim/Optim_catalogue_recipes.md` (**not yet created**; use the audit sections below as the source) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *Catalogue and recipes* (lines 587-593); *Recipe and job costing (standard guidance)* (lines 5-34) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `CAT` |
| **Severity** | High |
| **Depends on** | `SEC`, `ARC` |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `CAT` |

**Summary.** Recipe tables exist but the audit found no management endpoints; recipe costing is the missing link between catalogue, inventory and finance. The audit only skimmed catalogue internals: verify first.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/routes/catalogue.ts`
- `server/migrations/002_catalogue.sql (recipes, recipe_versions, recipe_items tables)`
- `erp-interface-design/src/components/erp/ (catalogue/recipes UI; locate in code)`
- `sweet-moments-cakery-web/src/lib/catalogue-api.ts`

### Step-by-step implementation and general checklist

- [ ] **CAT-00** [P0] Reconcile: read the audit sections only, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **CAT-01** [P4] **Recipe CRUD, versions and approval endpoints.** Verify none exist; add `recipes` routes with versions and an approve step. _Touches: SEC_
- [ ] **CAT-02** [P4] **Yield, batch size and cost roll-up.** Live recipe cost vs selling price with margin warnings. _Touches: FIN, INV_
- [ ] **CAT-03** [P4] **Allergen flags derived from ingredients.** Surface on website, quotes, production sheets. _Touches: WEB, PROD, QUO_
- [ ] **CAT-04** [P4] **Size and flavour variants with own cost and price.** Variant tables; server pricing uses variant. _Touches: ORD, QUO_
- [ ] **CAT-05** [P2] **Shared server pricing function.** One `priceOrderLines()` used by ORD, QUO and public proposals. _Touches: ORD, QUO, WEB_
- [ ] **CAT-06** [P5] **Price-change history and analytics.** History table; margin by product/variant, popularity. _Touches: ANA_
- [ ] **CAT-07** [P4] **Catalogue tests.** Roll-up maths, hidden/archived products not orderable, variant pricing. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| ORD-02 | `ORD` | Server-side pricing on POST and `/repeat` | P2 |
| QUO-03 | `QUO` | Server-priced lines and separate `quotations.send` | P2 |
| PROD-04 | `PROD` | Recipe explosion into planned consumption | P4 |
| FIN-09 | `FIN` | Job costing and margin per order | P4 |
| CRM-04 | `CRM` | Convert reminder to draft order | P5 |

### Verification (tests the skill must add or run)

- Recipe cost = sum(item qty x unit cost) / yield.
- Archived product not orderable.

### UI scope

General: 3 UI items are catalogued for this module in the skill (`references/ui-features.md` → `CAT`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.13 Staff & payroll (`STF`)

| | |
|---|---|
| **Source document** | [`Optim/Optim_staff_payroll.md`](./Optim_staff_payroll.md) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *Staff and payroll* (lines 594-604) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `STF` |
| **Severity** | Medium |
| **Depends on** | `SEC`, `FIN` |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `STF` |

**Summary.** Good structure, but creator may also approve a period, payroll does not reach expenses/ledger, attendance is not tied to production time, salary data visibility is unclear.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/routes/staff.ts, remuneration.ts`
- `server/migrations/017_staff_remuneration.sql`
- `erp-interface-design/src/components/erp/staff-view.tsx`

### Step-by-step implementation and general checklist

- [ ] **STF-00** [P0] Reconcile: read `Optim/Optim_staff_payroll.md`, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **STF-01** [P3] **Enforce maker-checker on payroll periods.** Creator/calculator cannot approve; server check plus DB constraint. _Touches: SEC_
- [ ] **STF-02** [P4] **Post payroll accruals and payments to finance.** Journal entries / expenses so cash flow and profit include payroll. _Touches: FIN_
- [ ] **STF-03** [P4] **Tie hours to jobs.** Attendance and per-step hours feed true labour cost per job. _Touches: PROD, FIN_
- [ ] **STF-04** [P3] **Restrict payslip and salary visibility.** Admin and the person concerned only. _Touches: SEC_
- [ ] **STF-05** [P5] **Payroll notifications.** Period close due, advance repayment overdue, attendance not recorded by 10am. _Touches: NOT_
- [ ] **STF-06** [P3] **Staff tests.** Self-approval blocked; payslip scoping. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| SEC-10 | `SEC` | Approval (maker-checker) framework | P3 |
| PROD-05 | `PROD` | Fix job costing | P4 |
| FIN-09 | `FIN` | Job costing and margin per order | P4 |
| FIN-10 | `FIN` | Payables, payroll and expense posting | P4 |

### Verification (tests the skill must add or run)

- Creator cannot approve own period.
- Staff A cannot read staff B payslip.

### UI scope

General: 3 UI items are catalogued for this module in the skill (`references/ui-features.md` → `STF`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.14 Public website & web users (`WEB`)

| | |
|---|---|
| **Source document** | `Optim/Optim_website.md` (**not yet created**; use the audit sections below as the source) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *Public website, content and web users* (lines 605-612); *6. Architecture and the website* (lines 103-110); *Architecture #8* (lines 194-204) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `WEB` |
| **Severity** | High |
| **Depends on** | `SEC`, `CRM`, `CAT` |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `WEB` |

**Summary.** Unauthenticated `/public/inquiries` and `/public/order-proposals` have no rate limit or bot protection and each inquiry can create a customer; tokens are in `localStorage`; web users and customers can be two identities. The audit only skimmed the website pages.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/routes/public.ts, order-proposals.ts, inquiries.ts, content.ts`
- `sweet-moments-cakery-web/src (pages, lib/catalogue-api.ts, hooks)`
- `sweet-moments-cakery-web/erp/ (duplicates server files)`
- `sweet-moments-cakery-web/supabase`

### Step-by-step implementation and general checklist

- [ ] **WEB-00** [P0] Reconcile: read the audit sections only, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **WEB-01** [P0] **Harden public endpoints.** Per-IP rate limit, honeypot or CAPTCHA, strict Zod validation, review queue; no CRM customer record until reviewed. _Touches: SEC, CRM, ARC_
- [ ] **WEB-02** [P1] **Token storage and reset-credentials review.** Move tokens off `localStorage` (httpOnly cookie) in both apps; verify `/reset-credentials` requires verification. _Touches: SEC_
- [ ] **WEB-03** [P5] **One customer identity with optional login.** Link web users to customers; migration to merge duplicates. _Touches: CRM_
- [ ] **WEB-04** [P5] **Order tracking page.** Public status and ETA by order number plus phone; rate limited; no sensitive data. _Touches: ORD, DEL_
- [ ] **WEB-05** [P5] **Reference-image upload.** File storage with size/type limits and scanning of content type; attach to proposal. _Touches: ORD, PROD_
- [ ] **WEB-06** [P5] **Source tagging and SEO basics.** Source tag on every inquiry (feeds source performance); meta and sitemap. _Touches: ANA_
- [ ] **WEB-07** [P6] **Remove duplicated `erp/` folder.** Delete after confirming nothing imports it. _Touches: ARC_
- [ ] **WEB-08** [P0] **Website tests.** Spam rejected, validation, hidden products not orderable. _Touches: ARC_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| SEC-03 | `SEC` | Rate limiting on login, register, reset-credentials and public forms | P0 |
| SEC-04 | `SEC` | Remove dev password fallback and lock down registration | P0 |
| SEC-05 | `SEC` | CORS allowlist, helmet, env-based config | P0 |
| SEC-06 | `SEC` | Real sessions: random hashed tokens in a `sessions` table | P1 |
| CRM-03 | `CRM` | Consent and opt-out per channel | P4 |
| CRM-05 | `CRM` | Customer merge and duplicate detection | P5 |
| CAT-03 | `CAT` | Allergen flags derived from ingredients | P4 |
| CAT-05 | `CAT` | Shared server pricing function | P2 |
| ARC-10 | `ARC` | Repo hygiene | P6 |

### Verification (tests the skill must add or run)

- Honeypot-filled post rejected.
- Rate limit returns 429.
- Tracking requires matching phone.

### UI scope

General: 3 UI items are catalogued for this module in the skill (`references/ui-features.md` → `WEB`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

## 6.15 Architecture & cross-cutting (`ARC`)

| | |
|---|---|
| **Source document** | [`Optim/Optim_architecture.md`](./Optim_architecture.md) |
| **Original assessment** | [`Optim/Optimize.md`](./Optimize.md): *Architecture* (lines 194-204); *Cross-cutting fixes* (lines 613-635); *1. The event spine* (lines 276-304); *6. Architecture and the website* (lines 103-110) |
| **Progress** | [`Optim_progress.md`](./Optim_progress.md) → section `ARC` |
| **Severity** | Critical |
| **Depends on** | none |
| **Implemented by** | skill `optim` (`../skills/optim/SKILL.md`), UI items from `references/ui-features.md` → `ARC` |

**Summary.** In-memory store with write-back is the biggest structural risk; no state-machine module; silent catches; no server tests; migration runner has tracking (`_migrations`) but no checksums and a duplicate `020_` prefix; repo contains logs, 15 database backups, `erp.db`, and duplicate/dead code.

**Code anchors** (paths relative to the project root; verify before editing):

- `server/database/store.ts (~94 KB), store.legacy.ts, index.ts vs index.new.ts`
- `server/services/business.service.ts (~40 KB)`
- `server/database/db.ts, migrate.ts`
- `server/migrations (two files numbered 020_)`
- `server/index.ts`
- `.gitignore, backups/, server/erp.db, server/tmp-check.js, dist-server/, *.err/*.log, temp*.txt, *.bak`
- `sweet-moments-cakery-web/erp/`

### Step-by-step implementation and general checklist

- [ ] **ARC-00** [P0] Reconcile: read `Optim/Optim_architecture.md`, check each finding against the current code, add missing items to *Plan adjustments* _(skill does this first)_
- [ ] **ARC-01** [P0] **Server test harness first.** vitest (or node:test) on the server: transition tables, permissions, payments, reservations; CI on every push. _Touches: SEC_
- [ ] **ARC-02** [P2] **Zod validation and field whitelists.** Validate every request body; stop spreading `req.body` into updates. _Touches: SEC_
- [ ] **ARC-03** [P3] **Migration runner hygiene.** A `_migrations` table already exists (`server/database/migrate.ts`: sorted by file name, one transaction per file), so do **not** add another. Add checksum verification so applied files cannot be edited silently, handle the two `020_*` files (already applied: do not rename; document the order and prevent further duplicates with a lint check), new migrations start at 022, forward-only with a rollback note per file.
- [ ] **ARC-04** [P3] **Transaction helper and repositories.** `withTransaction(fn)`; repositories over Postgres for payments and orders first, then module by module; retire write-back middleware progressively. _Touches: FIN, ORD, DEL_
- [ ] **ARC-05** [P3] **State-machine module.** One module for orders, jobs, deliveries, quotes, POs: allowed transitions, required permission, required side effects, event emitted. _Touches: ORD, PROD, DEL, QUO, PUR_
- [ ] **ARC-06** [P3] **`domain_events` table and `emit(tx, ...)` helper.** Migration from the audit (append-only, indexes on `(order_id, occurred_at)` and `(event_type, occurred_at)`); emitted in the same transaction as the change. _Touches: NOT, ANA, FIN_
- [ ] **ARC-07** [P3] **No silent failures: `needs_attention`.** Table and staff-visible queue replacing swallowed `catch {}`. _Touches: ORD, DEL, PROD, FIN_
- [ ] **ARC-08** [P4] **Split `store.ts` and `business.service.ts` by module.** orders, finance, crm, inventory, production... so finance does not depend on everything. _Touches: FIN, ORD, CRM, INV_
- [ ] **ARC-09** [P4] **Structured logging, helmet, rate-limit wiring, env config.** Pino-style logger, request ids and correlation ids. _Touches: SEC_
- [ ] **ARC-10** [P6] **Repo hygiene.** `.gitignore` for logs, backups, `erp.db`, `tmp-check.js`, `dist-server/`, `*.bak`, `temp*.txt`; remove tracked copies; purge history if backups hold customer data (ask the owner first); `server/database/index.new.ts` is the live module (imported by `store.ts`, `server/index.ts`, `routes/auth.ts`) and `server/database/index.ts` and `store.legacy.ts` appear unreferenced: confirm with grep, then remove; remove `sweet-moments-cakery-web/erp/`. _Touches: WEB_

### Inbound touchpoints (owned by other modules, implemented there)

| Step | Owner | What the owner changes in this module's area | Phase |
|---|---|---|---|
| SEC-01 | `SEC` | One shared `requirePermission(perm)` middleware, deny by default | P0 |
| SEC-05 | `SEC` | CORS allowlist, helmet, env-based config | P0 |
| SEC-06 | `SEC` | Real sessions: random hashed tokens in a `sessions` table | P1 |
| SEC-11 | `SEC` | Audit security events and permission changes | P3 |
| SEC-13 | `SEC` | Server permission-matrix tests | P0 |
| ORD-03 | `ORD` | Replace generic status PATCH with action endpoints | P3 |
| ORD-04 | `ORD` | Timestamps and numbering migration | P3 |
| ORD-07 | `ORD` | Remove silent catches and dead status/station sync | P3 |
| ORD-10 | `ORD` | Order tests | P2 |
| QUO-01 | `QUO` | Fix PATCH no-op; whitelist fields | P2 |
| QUO-04 | `QUO` | Versions and expiry | P4 |
| QUO-08 | `QUO` | Quotation tests | P2 |
| PROD-01 | `PROD` | Job state machine with guards on start/complete | P2 |
| PROD-03 | `PROD` | Job timestamps and QC/consumption schema | P3 |
| PROD-09 | `PROD` | Production tests | P2 |
| INV-01 | `INV` | Single availability function; atomic reservation | P2 |
| INV-03 | `INV` | Batches, expiry, units, reason codes migration | P4 |
| INV-08 | `INV` | Inventory tests | P2 |
| PUR-09 | `PUR` | Purchasing tests | P0 |
| DEL-03 | `DEL` | State guards and new statuses | P1 |
| DEL-06 | `DEL` | One transaction, no swallowed errors | P3 |
| DEL-11 | `DEL` | Delivery tests (audit list) | P1 |
| FIN-02 | `FIN` | Validation, idempotency, integer UGX | P1 |
| FIN-05 | `FIN` | Ledger schema and chart of accounts | P4 |
| FIN-06 | `FIN` | Event-to-journal posting and period close | P4 |
| FIN-12 | `FIN` | Finance tests | P1 |
| ANA-02 | `ANA` | Reporting views and daily snapshot | P5 |
| ANA-03 | `ANA` | Generic metrics endpoint | P5 |
| ANA-10 | `ANA` | SLA policies and milestone checks | P5 |
| ANA-11 | `ANA` | Analytics tests | P5 |
| NOT-05 | `NOT` | Audit becomes the event stream | P3 |
| NOT-06 | `NOT` | Rules engine and `notification_rules` | P5 |
| NOT-11 | `NOT` | Notification tests | P0 |
| CRM-01 | `CRM` | Reminder scheduler | P5 |
| CRM-10 | `CRM` | CRM tests | P5 |
| CAT-07 | `CAT` | Catalogue tests | P4 |
| STF-06 | `STF` | Staff tests | P3 |
| WEB-01 | `WEB` | Harden public endpoints | P0 |
| WEB-07 | `WEB` | Remove duplicated `erp/` folder | P6 |
| WEB-08 | `WEB` | Website tests | P0 |

### Verification (tests the skill must add or run)

- Transition table coverage.
- Transaction rolls back all steps on failure.
- Events written in same transaction.

### UI scope

General: 3 UI items are catalogued for this module in the skill (`references/ui-features.md` → `ARC`). The skill expands them into a detailed UI checklist inside `Optim_progress.md`, each mapped to the step above that it supports.

### Plan adjustments (maintained by the skill)

| Date | Step | Change | Reason / evidence |
|---|---|---|---|
| | | _none yet_ | |

---

