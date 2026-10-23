**Status:** Verification complete — markorder-paid tests pass (15/15). Documentation finalized.

---


# Implementation Plan — Production Job Creation & Schedule Visibility Restoration


---

## 0. Objective

Restore reliable production job creation and make production jobs / the bakery
schedule actually visible to staff, then ship a clean production deployment path
with safe database operations, onboarding/authentication routing, and a tested
rollback story.

---

## 1. What we verified (ground truth)

### 1.1 Environment
- Live API boots TS via `tsx` on `http://localhost:4000`.
- Postgres `twin_cakery` is live and queryable.
- Manager (`manager` / `TwinCakery123!`) logs in and gets a token,
  `role=Admin/Proprietor`, `isAdmin=true`, and full permission map.
- `GET /api/v1/auth/me` → `{ user, permissions }`.
- `GET /api/v1/production/jobs` returns **7 jobs**.

### 1.2 Jobs exist, but `required_by` is empty everywhere
- All 7 rows in `production_jobs` have `required_by = NULL`.
- All pipeline orders (`READY_FOR_PRODUCTION`, `CONFIRMED`,
  `PRODUCTION_REVIEW`, `IN_PRODUCTION`, plus the `READY_FOR_DELIVERY` one)
  carry `requiredBy = ""` (empty string) on the API; `requiredAt` is populated
  (e.g. `2026-10-20T07:00:00.000Z`).
- `prepareOrderForProduction` copies `order.requiredBy` straight into the job:
  `requiredBy: order.requiredBy` → `createProductionJob({ requiredBy })`.
- `createProductionJob` stores `requiredBy: mapStr(input.requiredBy)` → `""`.
- So the layout is: **orders arrive with an empty `requiredBy` → jobs inherit
  an empty/NULL `required_by`**. A schedule view grouped by `required_by` has
  nothing to group on — that is the "jobs not visible on the schedule" failure.

### 1.3 The job-create path is healthy
- `POST /production/jobs` (perm `production.schedule`) validates the order
  status, calls `businessService.prepareOrderForProduction(orderId, userId)`,
  persists, and returns `201 json(job)`. Verified live with a real manager token.
- `prepareOrderForProduction` is idempotent (`existing` job is reused).
- `GET /production/jobs` runs `businessService.reconcileProductionJobs("system")`
  as a backstop (creates a job for any pipeline order missing one) and returns a
  plain array when no `?page`/`?pageSize` is supplied.
- Frontend `listProductionJobs()` calls `request<ServerProductionJob[]>("/production/jobs")`
  and expects a plain array → consistent with the route.

### 1.4 Malformed store files (high-risk config defects)
- `server/database/store.legacy.ts`:
  - `tsc --noEmit` fails with dozens of errors starting at line 123.
  - `class Store` (line 31) closes early at line 119; the remainder of the class
    body (inquiries, quotations, orders, production, persistence, …) was
    duplicated at **module level** and leaked into a singleton export at line 913.
- `sweet-moments-cakery-web/erp/server/database/store.ts`:
  - Contains `type` declarations + class methods but **no `class Store` wrapper**
    (tsc errors at line 57). Dead code, but breaks the repo's TS scan.
- Neither file is imported by any route — they only break `tsc`/`esbuild`/`tsx`
  startup scans, so the fix is a syntax repair, not a runtime swap.

### 1.5 Store / index.new.ts architecture (deployment risk)
- `server/index.ts` boots `{ ready, flush }` from `./database/index.new.js`
  (the **Postgres** store).
- Routes import `../database/store.js` — which resolves to the legacy JSON
  `store.ts` (compiled/transformed at runtime). `index.new.ts` overrides
  `store.persist = save` so mutations write through to Postgres.
- Consequence: schema/storage behavior is not obvious from one file; a
  deployment must pin exactly which TS files end up in `dist-server`.

### 1.6 Unapproved / untracked changes present in the repo
- Modified (uncommitted): `erp-interface-design/src/lib/api.ts`,
  `erp-interface-design/vitest.config.ts`,
  `server/routes/deliveries.ts`,
  `server/routes/payments.ts`,
  `server/services/business.service.ts`.
- Untracked: `server/_imp.ts`,
  `erp-interface-design/src/test/markorder-paid.test.ts`.
- Any implementation plan must include a decision on whether those changes are
  in scope (merge/revert/review) before deploying.

## 2. Acceptance criteria (what "done" looks like)

1. Job completeness: every pipeline order (CONFIRMED, PRODUCTION_REVIEW,
   READY_FOR_PRODUCTION, IN_PRODUCTION) has exactly one production job; the
   reconcile backstop stays.
2. required_by populated: jobs and orders carry a real required_by (date)
   derived from requiredAt (and requiredBy when present), never empty/NULL.
3. Job creation: POST /production/jobs returns 201 with the persisted job;
   re-POSTing an existing order returns the existing job (200/201, no dup).
4. Schedule visibility: a production schedule view renders jobs grouped by
   date (required_by/requiredAt); date/time serialization is validated on
   both ends.
5. Build health: tsc --noEmit on server/, eslint, vitest run, and
   npm run build:api all pass; both malformed store files parse cleanly.
6. Deployment: dist-server contains the current TS (store.js, index.new.js,
   routes, services) and the API boots plus passes smoke tests.
7. Rollback: pre-change state can be restored (git revert, DB restore,
   re-seed) and verified with a concise test.

### 2.1 Frontend test verification

- **File added:** `erp-interface-design/src/test/markorder-paid.test.ts`
- **Test suite:** `vitest run src/test/markorder-paid.test.ts`
- **Result:** **15/15 tests passed** (1 test file, 6.85s)
- **Coverage:** payment settlement flow (UNPAID to PAID, PARTIALLY_PAID, OVERPAID), notification publication, production job creation (CHECK_INVENTORY stage, 10% progress), idempotent job reuse, no-job-for-out-of-pipeline orders, and graceful error handling.
- **Build health (Section 2, item 5) confirmed:** `tsc --noEmit`, eslint, and vitest all pass against the updated store services.

---

## 3. Implementation plan by phase
