# Optim — Production (jobs, QC, planned vs actual consumption, costing, capacity)

**Owner of:** the production job lifecycle, QC records, rework and wastage posting, recipe explosion into planned consumption, job costing, labour hours, capacity.
**Foundations used:** `Optim_architecture.md` (transition table, transactions), `Optim_notifications_audit.md` (events/rules), `Optim_inventory.md` (reservations/batches), `Optim_finance.md` (cost posting), `Optim_catalogue_recipes.md` (recipe data).

> Evidence: `server/routes/production.ts`, `server/routes/production-costs.ts`, `server/services/business.service.ts` (`markProductionStarted`, `recordMaterialsUsed`, `recordConsumption`, `advanceOrderTo*`, `createProductionJob`), `server/database/store.ts` (`createQualityCheck`), `erp-interface-design/src/components/erp/production-view.tsx`, migrations `004`, `013`, `020_production_fixed_costs`. The app was not run.

---

# PART A — ASSESSMENT

| # | Finding | Evidence | Scenario |
|---|---|---|---|
| P1 | **QC results are never saved.** The route reads `result` from the body but does not pass it to `store.createQualityCheck`, whose `result` defaults to `"PASS"`. Every record is stored PASS. The UI sends `{ result: 'FAIL', reworkRequired: true }` (`production-view.tsx:432`), and the job transition uses `result`, but the stored check does not. | `production.ts` quality-check; `store.ts:770-789` | A cake fails QC (cracked layer). Quality history shows PASS, so rework-rate analytics read 0%. |
| P2 | **`POST /jobs/:id/start` and `/complete` set status with no check of the current status.** A guarded `markProductionStarted` exists but the route doesn't use it. | `production.ts` | A PENDING job is completed; a finished job is restarted; completing twice repeats side effects. |
| P3 | **`/complete` pushes the order to READY_FOR_DELIVERY before QC passes.** It sets the job to `READY_FOR_QUALITY`, then calls `advanceOrderToReadyForDelivery({ …job, status: "READY_FOR_DELIVERY" })`. | `production.ts` | The delivery team sees the order as ready and dispatches a cake that has not been checked. |
| P4 | **QC rework cost and wastage are accepted and stored on the check but not posted** to `production_costs` or finance. | `production.ts`, `createQualityCheck` | A UGX 80,000 rework disappears from job margin. |
| P5 | **Costing.** The live manual path `recordMaterialsUsed` correctly uses `item.cost`, but writes a **new `production_costs` row per call** with labour, packaging and overhead hard-coded to 0, so one job can have many "ACTUAL" rows that are summed. The older `recordConsumption` (unwired) uses the **order line selling price** as unit cost. | `business.service.ts:675-770` | Two material entries on one job produce two cost rows; margins reflect ingredients only. |
| P6 | **No recipe explosion.** `recipes`, `recipe_versions`, `recipe_items` exist (migration `002`) but there are no recipe endpoints and nothing computes planned ingredients for a job. `reserveStock` and `recordConsumption` treat **order item `productId` as an inventory item id.** | `business.service.ts:204-232`, `routes/catalogue.ts` | A cake product id is not a flour id, so reservations either fail ("Inventory item not found") or reserve the wrong thing. |
| P7 | **Jobs have no `started_at` / `completed_at`**; only steps do. | migration `004` | Cycle time analytics are unreliable. |
| P8 | **Wastage path** (`/jobs/:id/wastage`) calls `adjustInventory` with any `quantity` (no negative/over-stock check) and `isAdmin: true` notifications. | `production.ts` | A typo of 500 kg zeroes flour and nobody is told which role should hear it. |
| P9 | **Silent catches** around station writes and `advanceOrderTo*`; `GET /jobs` runs `reconcileProductionJobs` and `advanceOrderToReadyForDelivery` on every read, with writes during a GET. | `production.ts` top | Opening the board mutates data; failures are hidden. |
| P10 | **No labour hours per step/person, no capacity planning.** | `production_steps`, `staff_attendance` | Labour cost is always 0; overload is invisible until the day. |

---

# PART B — OPTIMIZATION, CORRECTION AND IMPROVEMENT

## B1. Job state machine, order follows job (P2, P3, P9)
```
PENDING → IN_PRODUCTION → READY_FOR_QUALITY → (QC PASS) READY_FOR_DELIVERY → ARCHIVED
                                ↘ (QC FAIL) REWORK_REQUIRED → IN_PRODUCTION (rework) → READY_FOR_QUALITY
```
Routes become thin calls (table in `Optim_architecture.md` §B1.1):
```ts
router.post("/jobs/:id/start",    requirePermission("production.start"),    (q,s)=> run(q,s,"start"));
router.post("/jobs/:id/complete", requirePermission("production.complete"), (q,s)=> run(q,s,"finish"));   // → READY_FOR_QUALITY only
const run = async (req, res, action) => res.json(await transition("job", req.params.id, action, actor(req)));
```
Effects per transition (same transaction):
```ts
start:  effects: ({tx,row}) => Promise.all([
          tx.query(`UPDATE production_jobs SET started_at = COALESCE(started_at, now()) WHERE id=$1`, [row.id]),
          transition("order", row.order_id, "startProduction", SYSTEM, {}, tx)]),
finish: effects: ({tx,row}) => tx.query(`UPDATE production_jobs SET finished_at = now() WHERE id=$1`, [row.id]),   // order NOT advanced
qcPass: effects: ({tx,row}) => transition("order", row.order_id, "markReady", SYSTEM, {}, tx),                   // only here
qcFail: effects: async ({tx,row,payload}) => { await postReworkCost(tx, row.id, payload); await tx.query(`UPDATE production_jobs SET rework_count = rework_count + 1 WHERE id=$1`, [row.id]); },
```
`GET /jobs` becomes read-only. Move `reconcileProductionJobs` to a scheduled "needs attention" check that writes an `attention_items` record (B7) instead of silently creating jobs.

## B2. Real QC records (P1, P4)
```sql
-- 029_production_lifecycle.sql
ALTER TABLE production_jobs
  ADD COLUMN started_at TIMESTAMPTZ, ADD COLUMN finished_at TIMESTAMPTZ, ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN rework_count INT NOT NULL DEFAULT 0, ADD COLUMN assigned_to TEXT,
  ADD COLUMN materials_short BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX uq_job_per_order ON production_jobs (order_id) WHERE status NOT IN ('ARCHIVED');
ALTER TABLE quality_checks
  ADD CONSTRAINT qc_result_chk CHECK (result IN ('PASS','FAIL')),
  ADD COLUMN checklist JSONB NOT NULL DEFAULT '[]', ADD COLUMN photo_url TEXT,
  ADD COLUMN rework_reason_code TEXT, ADD COLUMN baker_id TEXT;
-- backfill: existing rows are all 'PASS' because of the bug; mark them so reports can exclude them
ALTER TABLE quality_checks ADD COLUMN result_trusted BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE quality_checks SET result_trusted = FALSE WHERE created_at < now();   -- run once at deploy time; new rows default TRUE
-- started_at from step data where available
UPDATE production_jobs j SET started_at = s.m FROM (SELECT job_id, min(started_at) m FROM production_steps GROUP BY 1) s WHERE s.job_id=j.id;
UPDATE production_jobs j SET completed_at = o.delivered_at FROM orders o WHERE o.id=j.order_id AND o.delivered_at IS NOT NULL;
```
Route fix (the one-line root cause):
```ts
const check = store.createQualityCheck({
  jobId: job.id, result: result === "PASS" ? "PASS" : "FAIL",       // ← was missing
  checkedBy: session.userId, issues, notes, reworkRequired: result !== "PASS",
  reworkCost: reworkCost ?? 0, wastageCaused: wastageCaused ?? 0, checklist, photoUrl, reworkReasonCode });
```
Reject a missing/unknown `result` with 400 (schema `z.enum(["PASS","FAIL"])`). A FAIL requires `reworkReasonCode`.

### B2.1 Post rework and wastage to the job cost (P4)
```ts
async function postReworkCost(tx, jobId, p: { reworkCost: number; wastageCaused: number; reason: string }) {
  if (p.reworkCost > 0) await costsRepo.addLine(tx, jobId, { kind: "REWORK", amount: p.reworkCost, ref: "qc" });
  await emit(tx, { type: "job.rework_cost_posted", entity: "job", entityId: jobId, jobId, amount: p.reworkCost, data: p });
}
```

## B3. Recipe explosion → planned consumption → planned-vs-actual (P6)
```sql
CREATE TABLE job_planned_consumption (
  id BIGSERIAL PRIMARY KEY, job_id TEXT NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
  planned_qty NUMERIC(14,3) NOT NULL, unit TEXT NOT NULL,
  planned_unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0,       -- snapshot of avg cost at planning time
  recipe_version_id TEXT, UNIQUE (job_id, inventory_item_id)
);
```
```ts
// at job creation (an effect of order.confirm, inside the same transaction)
export async function explodeRecipe(tx: TxClient, jobId: string) {
  const job = await jobsRepo.get(tx, jobId);
  for (const line of job.orderItems) {
    const rv = await recipesRepo.activeVersion(tx, line.productId, line.recipeVersion);    // Optim_catalogue_recipes.md
    if (!rv) { await attention.raise(tx, "RECIPE_MISSING", { jobId, productId: line.productId }); continue; }
    for (const it of rv.items) {
      const scale = (line.quantity * sizeFactor(line.variantOptions)) / rv.yieldQty;
      await planned.upsertAdd(tx, jobId, it.inventoryItemId, it.qty * scale, it.unit, await inventoryRepo.avgCost(tx, it.inventoryItemId));
    }
  }
}
```
- Reservations (`Optim_inventory.md` §B1) are created from **planned consumption**, not from order item product ids.
- On completion the job screen shows **planned vs actual** per ingredient with variance; `recordMaterialsUsed` pre-fills from the plan, and posts ONE cost record per job (UPSERT on `(job_id, status='ACTUAL')`) with ingredient, packaging, labour, overhead columns filled (B4).
- Variance split (price, usage, yield) is computed by `Optim_finance.md` §B5.

## B4. Costing fixed (P5)
- Use **inventory weighted-average cost** (`inventory_items.avg_cost`, `Optim_inventory.md` §B3) as the unit cost, never selling price. Delete or rewrite the unwired `recordConsumption` so nobody wires it by mistake.
- One cost row per job and status:
```sql
CREATE UNIQUE INDEX uq_job_cost_status ON production_costs (job_id, status);
```
```ts
await tx.query(`INSERT INTO production_costs (id, job_id, ingredient_cost, packaging_cost, labour_cost, overhead_cost, total, status)
  VALUES ($1,$2,$3,$4,$5,$6,$3+$4+$5+$6,'ACTUAL')
  ON CONFLICT (job_id, status) DO UPDATE SET
    ingredient_cost = production_costs.ingredient_cost + EXCLUDED.ingredient_cost,
    packaging_cost  = production_costs.packaging_cost  + EXCLUDED.packaging_cost,
    labour_cost     = EXCLUDED.labour_cost, overhead_cost = EXCLUDED.overhead_cost,
    total = production_costs.ingredient_cost + EXCLUDED.ingredient_cost + production_costs.packaging_cost + EXCLUDED.packaging_cost + EXCLUDED.labour_cost + EXCLUDED.overhead_cost,
    updated_at = now()`, [...]);
```
- **Labour:** new `job_labour` table (`job_id, step_id, staff_id, minutes, hourly_rate`), recorded from the step timer (B6) and valued from `salary_profiles` (`Optim_staff_payroll.md`). **Overhead:** allocate from `production_fixed_cost_entries` per job by a stated rule (per cake-unit or per labour minute).
- Existing multi-row data: collapse with a one-off script (`INSERT … SELECT job_id, sum(…) … GROUP BY job_id` into a temp table, delete originals, reinsert) after backing up.

## B5. Wastage and consumption guards (P8)
`adjustInventory` is owned by `Optim_inventory.md` §B2 (reason codes, no negative stock, approval for large write-offs). The wastage route passes a reason code from a fixed list and the job id; it no longer passes `isAdmin: true` — the event `inventory.wastage_recorded` goes through the rules engine.

## B6. Labour time and capacity (P10) — new features
```sql
CREATE TABLE capacity_days (day DATE PRIMARY KEY, capacity_units NUMERIC(8,2) NOT NULL, note TEXT);
ALTER TABLE products ADD COLUMN effort_units NUMERIC(6,2) NOT NULL DEFAULT 1;   -- "cake-units" per item
```
- At order confirm and reschedule, sum `effort_units × quantity` for the target day; if > capacity, return a **warning** (`capacityWarning: { day, booked, capacity }`) that the UI shows; confirming past capacity needs `production.override_capacity`.
- Step timers: `POST /production/jobs/:id/steps/:stepId/start|stop` (permission `production.record_time`), writes `job_labour` and `production_steps.started_at/completed_at`.

## B7. "Needs attention" records instead of swallowed errors
```sql
CREATE TABLE attention_items (
  id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}', raised_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ, resolved_by TEXT
);
```
Used for missing recipe, short stock at confirm, job created without items, etc. A dashboard card and a list page expose them (see UI).

## B8. Permissions
New: `production.override_capacity`, `production.record_time`, `production.view_costs` (separates cost/margin visibility from `production.view`). Baker/Decorator role: `production.view` limited to jobs where `assigned_to = me` (record-level rule enforced in the query, see `Optim_security_rbac.md`), plus `production.start`, `production.complete`, `production.record_consumption`, `production.record_wastage`, `production.record_time`; **no** `production.view_costs`. Only Production Manager/Admin hold `production.quality_check` (maker–checker: the baker who finished the job should not pass its QC; the guard compares `checked_by` to `job.assigned_to`).

## B9. UI changes
| Element | Existing → change |
|---|---|
| Job board (`production-view.tsx`) | Columns per state; cards show assignee, due date, capacity colour, "materials short" chip, rework count; read-only on load (no writes) |
| Job drawer | Tabs: Overview, **Materials (planned vs actual)**, Steps and time, QC, Costs, Discussion. Costs tab hidden without `production.view_costs` |
| QC dialog (replaces the two buttons at `production-view.tsx:571`) | Checklist (shape, taste, decoration, packaging, allergens), photo upload, result, rework reason code (required on FAIL), rework cost and wastage fields |
| New: Planned vs actual panel | Table: ingredient, planned, actual, variance, cost variance; red above threshold |
| New: Capacity strip | Week calendar with booked units vs capacity; drag-to-reschedule opens the reschedule dialog (`Optim_orders.md` §B7) |
| New: Printable daily production sheet | Cake size, flavour, inscription, allergies (from CRM, `Optim_crm.md`), reference photo, delivery time; print CSS in `production-view.tsx` |
| New: Needs attention card on dashboard | From `attention_items` |

## B10. Unified impact matrix
| Change | Orders | Inventory | Finance | Notifications | Analytics | RBAC | DB |
|---|---|---|---|---|---|---|---|
| QC result stored | order goes ready only on pass | wastage booked on fail | rework cost on job | `job.qc_failed` → Production + Admin | QC fail/rework rate | `production.quality_check` | 029 |
| Order follows job | `markReady` effect | — | invoice may be issued at ready (policy) | `job.finished` | cycle time | system transitions | 029 |
| Recipe explosion | `materials_short` flag | reservations from plan | planned cost at quote | shortage alerts | planned vs actual | `production.view_costs` | `job_planned_consumption` |
| Labour/overhead | — | — | labour/overhead in COGS | — | labour cost per order | `production.record_time` | `job_labour` |
| Capacity | confirm/reschedule warning | — | — | overload alert | capacity utilisation | `production.override_capacity` | `capacity_days` |

## B11. Tests
- QC FAIL stores `result='FAIL'`, increments `rework_count`, posts rework cost, order stays IN_PRODUCTION.
- `complete` on PENDING → 409; QC PASS on IN_PRODUCTION → 409.
- Order does not become READY_FOR_DELIVERY until QC passes.
- Two `recordMaterialsUsed` calls leave exactly one ACTUAL cost row with summed ingredient cost.
- Baker cannot see `/jobs/:id/costs` (403) or other bakers' jobs (404).
- Recipe missing → job created, `attention_items` row raised, no exception swallowed.
