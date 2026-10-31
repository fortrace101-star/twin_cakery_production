# Optim — Inventory (reservations, adjustments, stock-take, batches/expiry, costing)

**Owner of:** stock movements, availability and reservations, adjustments and write-offs, stock-take, batch/expiry, weighted-average cost, unit conversion.
**Foundations used:** `Optim_architecture.md`, `Optim_notifications_audit.md`, `Optim_security_rbac.md`.
**Works with:** `Optim_production.md` (planned consumption), `Optim_purchasing.md` (goods receipt), `Optim_finance.md` (inventory valuation and COGS postings), `Optim_catalogue_recipes.md` (recipe items).

> Evidence: `server/routes/inventory.ts`, `server/database/store.ts` (`adjustInventory`), `server/services/business.service.ts` (`reserveStock`, `recordMaterialsUsed`), `server/services/stock-alerts.ts`, migration `005_inventory_purchasing.sql`, `010_inventory_cost.sql`. The app was not run.

---

# PART A — ASSESSMENT

| # | Finding | Evidence | Scenario |
|---|---|---|---|
| I1 | **`adjustInventory` accepts any quantity**, including negative results: it does `item.physicalStock = physicalStock + qty` with no floor, no required reason, no approval. `POST /inventory/adjustments` needs only `inventory.adjust` (Production holds it); the `user` field in the body can override the actor label. | `store.ts:909-939`, `inventory.ts:85-100` | A baker types −500 instead of −5 for butter; stock goes to −495 and nobody approves it. |
| I2 | **Reservation ignores other orders' reservations.** `reserveStock` checks `item.quantity > physicalStock` and sums only reservations for the **same order** (`r.orderId === job.orderId`). The route `POST /inventory/reservations` does it correctly (subtracts all reservations). | `business.service.ts:204-232` vs `inventory.ts:102-110` | Two orders each need 8 kg flour; stock is 10 kg. Both reserve successfully, so one fails mid-bake. |
| I3 | **Reserve uses the order item's `productId` as an inventory id.** | same | Cake product ids are not ingredient ids (see `Optim_production.md` P6). |
| I4 | **Reservation release is by splice in `recordMaterialsUsed`** and not tied to planned quantities; unused reservations are never released on cancel (cancel flow not seen to release them). | `business.service.ts:700-706`, `store.cancelOrder` (not verified) | Cancelled orders keep ingredients locked. |
| I5 | **Availability is computed in two ways** (inventory route subtracts reservations; `analytics.ts`/stock alerts use `physicalStock <= reorderLevel` without reservations). | `inventory.ts:53-66`, `analytics.ts`, `stock-alerts.ts` | Dashboard says "in stock", reservation says "none available". |
| I6 | **No batch, lot or expiry columns** in migrations 005/010. | DDL | Dairy and eggs cannot be used first-expiry-first-out; spoilage is invisible until the smell test. |
| I7 | **No stock-take workflow**, no reason codes beyond a free `type` string, no approval for large write-offs. | — | Monthly counts are done on paper and typed in as adjustments. |
| I8 | **Cost is last price.** Goods receipt sets `inv.cost = item.unitPrice` (overwrites). | `purchasing.ts` receive | A one-off expensive purchase makes every recipe cost jump. |
| I9 | **No unit conversion** (kg↔g, tray↔eggs); `unit` is free text. | DDL | Recipe in grams, stock in kg: quantities mismatch by 1000×. |
| I10 | **Stock alert callers pass `isAdmin: true`** (`publishLowStockAlert(…, { isAdmin: true })`). | `production.ts`, `inventory.ts` | Everyone gets every low-stock alert. |

---

# PART B — OPTIMIZATION, CORRECTION AND IMPROVEMENT

## B1. One availability definition and safe reservations (I2, I3, I4, I5)

### B1.1 SQL view used everywhere
```sql
-- 030_inventory_core.sql
CREATE VIEW v_inventory_availability AS
SELECT i.id AS item_id, i.name, i.unit, i.reorder_level,
       i.physical_stock,
       COALESCE(r.reserved,0) AS reserved,
       i.physical_stock - COALESCE(r.reserved,0) AS available
FROM inventory_items i
LEFT JOIN (SELECT item_id, SUM(quantity) reserved FROM stock_reservations GROUP BY item_id) r ON r.item_id = i.id;
```
`physical_stock` should become a **derived** value: `SUM(inventory_transactions.quantity)` per item (the DDL comment says "stock moves only via inventory_transactions"). Keep a cached column updated by trigger, or compute in the view, so the ledger is authoritative. Check migration `010` for the existing `physical_stock` column before choosing.

### B1.2 Reservation inside a transaction with row locks
```ts
export async function reserveForJob(tx: TxClient, jobId: string) {
  const plan = (await tx.query(`SELECT * FROM job_planned_consumption WHERE job_id=$1`, [jobId])).rows;
  const short: Array<{ itemId: string; need: number; available: number }> = [];
  for (const p of plan.sort((a, b) => a.inventory_item_id.localeCompare(b.inventory_item_id))) {   // stable order avoids deadlocks
    await tx.query(`SELECT 1 FROM inventory_items WHERE id=$1 FOR UPDATE`, [p.inventory_item_id]);
    const { rows: [a] } = await tx.query(`SELECT available FROM v_inventory_availability WHERE item_id=$1`, [p.inventory_item_id]);
    if (Number(a.available) < Number(p.planned_qty)) { short.push({ itemId: p.inventory_item_id, need: p.planned_qty, available: a.available }); continue; }
    await tx.query(`INSERT INTO stock_reservations (id,item_id,quantity,unit,order_id,reference,job_id)
                    VALUES ($1,$2,$3,$4,$5,$6,$7)`, [makeId("res"), p.inventory_item_id, p.planned_qty, p.unit, orderId, `job ${jobId}`, jobId]);
  }
  if (short.length) throw new ShortageError(short);       // ConflictError subclass; confirm may catch it when allowShortage=true
}
```
`stock_reservations` gains `job_id` and a `released_at`/`release_reason` instead of deleting rows:
```sql
ALTER TABLE stock_reservations ADD COLUMN job_id TEXT, ADD COLUMN released_at TIMESTAMPTZ, ADD COLUMN release_reason TEXT;
-- views and route sums must add: WHERE released_at IS NULL
```
Release rules: on consumption recorded (release the consumed portion), on order cancel (release all), on job archive (release leftovers with reason `UNUSED`).

## B2. Safe adjustments with reason codes and approval (I1, I7, I10)
```sql
ALTER TABLE inventory_transactions
  ADD COLUMN reason_code TEXT CHECK (reason_code IN
    ('RECEIPT','CONSUMPTION','WASTAGE','SPOILAGE','THEFT','COUNT_CORRECTION','TRANSFER','OPENING')),
  ADD COLUMN approved_by TEXT, ADD COLUMN batch_id TEXT, ADD COLUMN job_id TEXT;
ALTER TABLE inventory_items ADD CONSTRAINT stock_nonneg CHECK (physical_stock >= 0) NOT VALID;
```
```ts
export async function adjust(tx: TxClient, a: Adjustment, actor: Actor) {
  if (!a.reasonCode) throw new ValidationError("reasonCode required");
  const item = (await tx.query(`SELECT * FROM inventory_items WHERE id=$1 FOR UPDATE`, [a.itemId])).rows[0];
  if (!item) throw new NotFoundError("Inventory item not found");
  const after = Number(item.physical_stock) + a.quantity;
  if (after < 0) throw new ConflictError(`Would take ${item.name} below zero (${item.physical_stock} on hand)`);
  const value = Math.abs(a.quantity) * Number(item.avg_cost);
  const limit = await settings.number("writeoff_approval_ugx", 50_000);
  if (a.quantity < 0 && value > limit && !a.approvedBy)
    throw new ApprovalRequired("inventory.approve_writeoff", { value, limit });
  // actor comes from the session; the request body can no longer set `user`
  await ledger.insert(tx, { ...a, user: actor.userId });
  await emit(tx, { type: a.quantity < 0 ? "inventory.written_off" : "inventory.adjusted", entity: "inventory_item",
                   entityId: a.itemId, amount: value, actor, data: { reason: a.reasonCode, qty: a.quantity, after } });
  if (after <= Number(item.reorder_level)) await emit(tx, { type: "inventory.below_reorder", entity: "inventory_item", entityId: a.itemId, data: { after } });
}
```
`ApprovalRequired` returns **202** with an `approvalId`; an approver with `inventory.approve_writeoff` completes it (a table `approvals` shared with finance: `kind, entity, payload, requested_by, decided_by, decided_at, status`). The existing `publishLowStockAlert(…, isAdmin:true)` calls are deleted; the rules engine handles `inventory.below_reorder`.

## B3. Weighted-average cost, batches and expiry (I6, I8)
```sql
ALTER TABLE inventory_items
  ADD COLUMN avg_cost NUMERIC(14,4) NOT NULL DEFAULT 0, ADD COLUMN shelf_life_days INT, ADD COLUMN track_batches BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE inventory_batches (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES inventory_items(id), batch_no TEXT,
  received_at DATE NOT NULL DEFAULT CURRENT_DATE, expires_on DATE,
  qty_received NUMERIC(14,3) NOT NULL, qty_remaining NUMERIC(14,3) NOT NULL CHECK (qty_remaining >= 0),
  unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0, goods_receipt_item_id TEXT
);
CREATE INDEX ON inventory_batches (item_id, expires_on) WHERE qty_remaining > 0;
-- backfill: one opening batch per item with current stock and cost, no expiry
INSERT INTO inventory_batches (id,item_id,batch_no,qty_received,qty_remaining,unit_cost)
SELECT 'bt-open-'||id, id, 'OPENING', physical_stock, physical_stock, COALESCE(cost,0) FROM inventory_items WHERE physical_stock > 0;
UPDATE inventory_items SET avg_cost = COALESCE(cost,0);
```
**Receipt** (called by purchasing, `Optim_purchasing.md` §B3):
```ts
// new_avg = (on_hand*avg + qty*price) / (on_hand + qty)
await tx.query(`UPDATE inventory_items SET avg_cost = CASE WHEN physical_stock + $2 = 0 THEN $3
  ELSE (physical_stock*avg_cost + $2*$3)/(physical_stock+$2) END WHERE id=$1`, [itemId, qty, unitPrice]);
```
**Consumption** picks batches **FEFO** (earliest `expires_on`, nulls last) and records `batch_id` on each ledger row; cost = batch `unit_cost` (or `avg_cost` for untracked items). Items with `track_batches=false` skip batch logic.

## B4. Stock-take workflow (I7) — new feature
```sql
CREATE TABLE stock_takes (id TEXT PRIMARY KEY, started_by TEXT, started_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'OPEN', closed_by TEXT, closed_at TIMESTAMPTZ);   -- OPEN|SUBMITTED|APPROVED
CREATE TABLE stock_take_lines (take_id TEXT REFERENCES stock_takes(id), item_id TEXT, system_qty NUMERIC(14,3),
  counted_qty NUMERIC(14,3), variance NUMERIC(14,3) GENERATED ALWAYS AS (counted_qty - system_qty) STORED,
  reason_code TEXT, PRIMARY KEY (take_id, item_id));
```
Flow: start (snapshot `system_qty`) → count (mobile-friendly) → submit → approver (`inventory.approve_stocktake`, not the person who counted) approves → variances are posted as `COUNT_CORRECTION` ledger rows in one transaction, and **Finance** posts the shrinkage (`Optim_finance.md` §B3.4 journal: Dr Inventory shrinkage expense / Cr Inventory).

## B5. Units (I9)
`inventory_units(unit, base_unit, factor)` (g→kg 0.001, tray→egg 30). Recipes store the unit and quantity; conversion happens in `explodeRecipe` (`Optim_production.md` §B3) and a CHECK ensures each item's `unit` exists in the table. Reject unknown units on item creation.

## B6. Permissions
New: `inventory.approve_writeoff`, `inventory.approve_stocktake`, `inventory.count` (blind count entry for bakers), `inventory.view_costs` (avg cost, valuation). Production keeps `inventory.view` and `inventory.reserve` but **loses unrestricted `inventory.adjust`**: bakers get `inventory.record_wastage` (reason codes WASTAGE/SPOILAGE, capped by the write-off limit). The existing migration `019_inventory_adjust_to_role_admin.sql` suggests this was already moving; verify the current grants with `SELECT … FROM role_permissions` before applying.

## B7. Cross-module impact
| Module | Change |
|---|---|
| Production | Reservations from planned consumption; consumption pulls FEFO batches; rework wastage reason codes |
| Purchasing | Receipt creates batches and updates average cost; reorder suggestions from reservations vs availability |
| Finance | Inventory valuation (`Σ qty × avg_cost`), COGS on consumption, shrinkage/wastage postings, stock-take variance journal |
| Orders | Cancel releases reservations; confirm shows shortages |
| Notifications | `inventory.below_reorder`, `inventory.expiring` (within 3 days), `inventory.negative_attempt`, `stocktake.variance_high`, `writeoff.approval_needed` |
| Analytics | Stock valuation, days on hand, turnover, shrinkage by item, near-expiry value, price trend |
| RBAC | B6 |
| DB | `030_inventory_core.sql` (+ batches, take tables) |

## B8. UI
| Element | Existing → change |
|---|---|
| Inventory list (`inventory-view.tsx`) | Columns: on hand, reserved, **available**, avg cost (if permitted), nearest expiry; status from the shared view; filters: low, expiring, negative-attempt |
| Adjust dialog | Reason code required, shows value of write-off and "needs approval" when above limit; no free-text actor |
| Item drawer | Tabs: Ledger, Batches (qty, expiry), Reservations (by order/job, with release), Price history (from `supplier_price_history`) |
| **New** Stock-take page | Count sheet by location/category, blind count option, variance review, approve |
| **New** Expiry board | Batches expiring in 3/7/14 days with a "use first" hint and write-off button |
| Dashboard low-stock card | Uses `v_inventory_availability`, links to the filtered list |

## B9. Tests
- Two orders competing for 10 kg flour (8 + 8): second reservation shows a shortage; exactly one reservation row exists.
- Adjustment to negative → 409; large write-off → 202 until approved.
- Receipt updates avg cost correctly (10 @ 100 then 10 @ 200 → 150).
- FEFO consumes the earliest-expiring batch first.
- Cancel releases reservations (`released_at` set, availability restored).
- Stock-take approval posts `COUNT_CORRECTION` rows and the finance journal.
