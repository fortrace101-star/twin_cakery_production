# Optim — Purchasing (suppliers, purchase orders, goods receipt, bills and payables)

**Owner of:** supplier master, POs, approvals, partial goods receipt, supplier bills/payables and 3-way match, purchase suggestions.
**Foundations used:** `Optim_architecture.md`, `Optim_notifications_audit.md`, `Optim_security_rbac.md`.
**Works with:** `Optim_inventory.md` (receipt → batches/avg cost), `Optim_finance.md` (payables, journal postings, payments out), `Optim_analytics.md`.

> Evidence: `server/routes/purchasing.ts` (all routes), `server/database/store.ts` (`createPurchaseOrder`, `receivePurchaseOrder`, `createSupplier`), `erp-interface-design/src/components/erp/purchasing-view.tsx`, migration `005`. The app was not run.

---

# PART A — ASSESSMENT

| # | Finding | Evidence | Scenario |
|---|---|---|---|
| U1 | **`POST /purchasing/suppliers` has no auth.** The handler is `router.post("/suppliers", (req,res)=>…)` with no `required(...)`. `server/index.ts` imports `requireAuth` but only mounts `attachAuth` (which attaches a session when a token is present and never rejects), and `routes/api.ts` mounts `/purchasing` with no auth middleware, so nothing in front of this route blocks an anonymous caller. | `purchasing.ts:121` | Anyone who can reach the API can create suppliers with no login (and the error path returns `e.message` to the caller). |
| U2 | **`POST /purchasing/orders` checks permission and ignores the result.** It calls `rbacService.requirePermission(...).catch(() => {})` (not awaited, rejection swallowed), wraps `requireAuth` in an empty `catch`, then always `next()`. | `purchasing.ts:184-189` | A user with no purchasing rights creates a PO. |
| U3 | **Wrong supplier is silently assigned.** If `supplierId` is missing or unknown, the code uses the first active supplier, or the first supplier of any kind, or creates a "Default Supplier" with `-` contact fields. | `purchasing.ts:192-205` | A PO for flour goes to the fabric-box supplier because the dropdown was left blank. |
| U4 | **Receive is all-or-nothing.** `receivePurchaseOrder` receives every line at the ordered quantity; `additionalItems` are accepted without a PO line, price check or discrepancy note. | `purchasing.ts:230-285` | 18 of 20 trays arrive; the system books 20. |
| U5 | **Cost overwrite.** On receipt `inv.cost = item.unitPrice` (last price wins; no weighted average, no price-variance flag). | same | A 40% price jump silently reprices all future jobs. |
| U6 | **No payables.** Goods received does not create a liability, a supplier bill or a due date; nothing records paying a supplier. | — | Cash flow and profit reports omit supplier debt; a supplier chases an unpaid invoice nobody knew about. |
| U7 | **No approval threshold** on POs; `purchasing.approve` exists but guards only `/:id/acknowledge` (requirement acknowledgement). | `purchasing.ts:161` | A UGX 5M PO is raised by one person alone. |
| U8 | **Notification uses `isAdmin: true`.** | `purchasing.ts` receive | Goods-received alerts go to everyone. |
| U9 | **Requirements are manual.** `purchase_requirements` exist but are not generated from reservations or reorder levels. | DDL | Shortages are noticed at confirm time. |
| U10 | **`PATCH /suppliers/:id` and `DELETE` share `purchasing.create`.** | `purchasing.ts:76,109` | Creating and deleting share one permission. |

---

# PART B — OPTIMIZATION, CORRECTION AND IMPROVEMENT

## B1. Close the holes (U1, U2, U3, U10)
```ts
router.use(requireAuth);                                                // deny by default (Optim_security_rbac.md)
router.post("/suppliers", requirePermission("purchasing.manage_suppliers"), validate(SupplierSchema), createSupplier);
router.post("/orders",    requirePermission("purchasing.create"), validate(PoSchema), async (req, res) => {
  const supplier = await suppliersRepo.requireActive(req.body.supplierId);   // throws 422 if missing/inactive — no fallback
  …
});
router.delete("/suppliers/:id", requirePermission("purchasing.manage_suppliers"), …);   // soft delete = active:false
```
Delete the "Default Supplier" fallback and the first-supplier fallback entirely. Supplier create returns generic errors; log details server-side. Duplicate detection by normalised name + phone returns 409 with the existing supplier.

## B2. PO lifecycle and approval (U7)
Statuses: `DRAFT → PENDING_APPROVAL → APPROVED → SENT → PARTIALLY_RECEIVED → RECEIVED → CLOSED | CANCELLED`. Registered in the transition table (`Optim_architecture.md` §B1):
```ts
purchase_order: {
  submit:  { from:["DRAFT"], to:"PENDING_APPROVAL", permission:"purchasing.create", event:"po.submitted",
             guard: ({row}) => { if (Number(row.total) <= PO_AUTO_APPROVE) throw new SkipTo("APPROVED"); } },
  approve: { from:["PENDING_APPROVAL"], to:"APPROVED", permission:"purchasing.approve_po", event:"po.approved",
             guard: ({row,actor}) => { if (row.created_by === actor.userId) throw new ConflictError("Creator cannot approve own PO"); } },
  send:    { from:["APPROVED"], to:"SENT", permission:"purchasing.create", event:"po.sent" },
  cancel:  { from:["DRAFT","PENDING_APPROVAL","APPROVED","SENT"], to:"CANCELLED", permission:"purchasing.approve_po", event:"po.cancelled" },
}
```
`PO_AUTO_APPROVE` comes from `settings` (e.g. UGX 500,000).

## B3. Partial receipts, 3-way match and payables (U4, U5, U6)

### B3.1 Migration
```sql
-- 031_purchasing_payables.sql
ALTER TABLE purchase_orders ADD COLUMN created_by TEXT, ADD COLUMN approved_by TEXT, ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'UGX';
ALTER TABLE goods_receipt_items
  ADD COLUMN po_item_id TEXT REFERENCES purchase_order_items(id),
  ADD COLUMN qty_rejected NUMERIC(14,3) NOT NULL DEFAULT 0, ADD COLUMN discrepancy_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN batch_no TEXT, ADD COLUMN expires_on DATE;
CREATE TABLE supplier_bills (
  id TEXT PRIMARY KEY, supplier_id TEXT NOT NULL REFERENCES suppliers(id), bill_no TEXT NOT NULL,
  purchase_order_id TEXT REFERENCES purchase_orders(id), goods_receipt_id TEXT REFERENCES goods_receipts(id),
  bill_date DATE NOT NULL, due_date DATE NOT NULL, total NUMERIC(14,2) NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'OPEN',          -- OPEN|PART_PAID|PAID|DISPUTED|VOID
  match_status TEXT NOT NULL DEFAULT 'UNMATCHED', -- UNMATCHED|MATCHED|VARIANCE
  created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (supplier_id, bill_no)
);
CREATE TABLE bill_payments (
  id TEXT PRIMARY KEY, bill_id TEXT NOT NULL REFERENCES supplier_bills(id), amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL, reference TEXT NOT NULL DEFAULT '', paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_by TEXT NOT NULL, approved_by TEXT, idempotency_key TEXT UNIQUE
);
ALTER TABLE suppliers ADD COLUMN payment_terms_days INT NOT NULL DEFAULT 0, ADD COLUMN lead_time_days INT;
-- backfill: parse existing text payment_terms like "Net 30" where possible, otherwise leave 0
UPDATE suppliers SET payment_terms_days = NULLIF(regexp_replace(payment_terms,'\D','','g'),'')::int
 WHERE payment_terms ~ '\d';
```

### B3.2 Receive endpoint (replaces the all-or-nothing receive)
```ts
router.post("/orders/:id/receipts", requirePermission("purchasing.receive"), validate(ReceiptSchema), async (req, res) => {
  const r = await withTransaction(async (tx) => {
    const po = await posRepo.lockForReceipt(tx, req.params.id);              // status in APPROVED/SENT/PARTIALLY_RECEIVED
    const lines = req.body.lines;                                           // [{ poItemId, qtyReceived, qtyRejected, unitPrice, batchNo, expiresOn, note }]
    for (const l of lines) {
      const item = po.items.find((i) => i.id === l.poItemId) ?? raise(422, "Line not on this PO");
      if (l.qtyReceived + item.received_quantity > item.quantity * (1 + TOLERANCE)) throw new ConflictError("Over-receipt beyond tolerance");
      const priceVar = (l.unitPrice - item.unit_price) / item.unit_price;
      await inventory.receive(tx, { itemId: item.product_id, qty: l.qtyReceived, unitPrice: l.unitPrice,
                                    batchNo: l.batchNo, expiresOn: l.expiresOn, ref: po.po_number });     // Optim_inventory.md §B3
      if (Math.abs(priceVar) > 0.10) await emit(tx, { type: "supplier.price_variance", entity: "purchase_order", entityId: po.id, data: { item: item.product_id, priceVar } });
    }
    const receipt = await receiptsRepo.insert(tx, po.id, lines, req.session.userId);
    await posRepo.recomputeStatus(tx, po.id);                                // PARTIALLY_RECEIVED or RECEIVED
    await financeRepo.accrueGoodsReceived(tx, receipt.id);                   // Dr Inventory / Cr GRNI (accrued payables), Optim_finance.md §B3.4
    await emit(tx, { type: "goods.received", entity: "purchase_order", entityId: po.id, amount: receipt.total, actor: actor(req) });
    return receipt;
  });
  res.status(201).json(r);
});
```
The old `POST /orders/:id/receive` stays as a deprecated alias that receives all remaining quantities through the same code path (so existing UI keeps working during the transition).

### B3.3 Bills and payment
- `POST /purchasing/bills` (`purchasing.record_bill`) creates a bill from a PO/receipt; the server computes match: bill total vs Σ(received × PO price). Within tolerance → `MATCHED`; else `VARIANCE` and a `bill.variance` event to Finance.
- `POST /purchasing/bills/:id/payments` (`purchasing.pay_bill`, idempotency key, over-payment rejected). Amounts over a threshold require a second approver (`finance.approve_payment`). Posting: Dr Accounts Payable / Cr Cash or Mobile Money (`Optim_finance.md` §B3.4).
- Payables ageing: current, 1–7, 8–30, 30+ days overdue from `due_date`.

## B4. Purchase suggestions (U9) — new feature
A nightly (and on-demand) query:
```sql
SELECT a.item_id, a.name, a.reorder_level, a.available,
       GREATEST(a.reorder_level - a.available, 0) + COALESCE(f.upcoming_planned,0) AS suggested_qty
FROM v_inventory_availability a
LEFT JOIN (SELECT p.inventory_item_id item_id, SUM(p.planned_qty) upcoming_planned
           FROM job_planned_consumption p JOIN production_jobs j ON j.id=p.job_id
           WHERE j.status IN ('PENDING','READY_FOR_PRODUCTION') GROUP BY 1) f ON f.item_id = a.item_id
WHERE a.available < a.reorder_level + COALESCE(f.upcoming_planned,0);
```
The UI lists suggestions grouped by preferred supplier (`inventory_items.supplier_id`) with a "Create PO" button that pre-fills lines and latest price.

## B5. Supplier performance (analytics inputs)
Record on each receipt: promised date (`expected_date`), actual date, qty ordered vs received, price vs PO. `Optim_analytics.md` computes on-time-in-full %, lead-time reliability, price variance, spend by supplier/category.

## B6. Permissions
New: `purchasing.manage_suppliers`, `purchasing.approve_po`, `purchasing.record_bill`, `purchasing.pay_bill`, `finance.approve_payment`. `purchasing.approve` (existing) keeps the requirement-acknowledge action. Default grants: Admin everything; Production Manager `purchasing.view/create/receive`; Finance `record_bill/pay_bill` (the maker); the Owner/Admin holds `approve_po` and `approve_payment` above thresholds.

## B7. Cross-module impact
| Module | Change |
|---|---|
| Inventory | Receipt creates batches/avg cost; suggestions read availability |
| Finance | GRNI accrual, supplier bills, payables ageing, payments out, supplier spend reports |
| Notifications | PO awaiting approval (Admin), PO overdue for delivery (Production), bill due in 3 days (Finance), price increase > 10% (Finance + Production) |
| Analytics | spend, price variance, lead time, OTIF, payables ageing |
| RBAC | B6 |
| Front end | B8 |
| Database | `031_purchasing_payables.sql` |

## B8. UI
| Element | Existing → change |
|---|---|
| Supplier form | Add payment terms (days), lead time, active toggle (no hard delete); duplicate warning |
| PO form | Supplier required (no default); approval banner when above threshold; line prices default from last price with variance chip |
| PO drawer | Timeline (submitted, approved, sent, receipts); **Receive** dialog per line: received, rejected, batch, expiry, price, note; shows over-receipt warnings |
| **New** Bills tab | Bills list, match status chip, pay dialog, payables ageing card |
| **New** Suggestions panel | From B4 |
| Receipt history | Existing "receipts" list gains discrepancy notes |

## B9. Tests
- Unauthenticated/unauthorised `POST /suppliers` and `/orders` → 401/403.
- Missing/unknown supplier → 422 (no default supplier created).
- Partial receive leaves PO PARTIALLY_RECEIVED; second receive completes it; over-receipt beyond tolerance → 409.
- Average cost updates correctly across two receipts.
- Bill with total ≠ receipt value → `VARIANCE` and an event.
- Payment idempotency: same key twice → one row.
