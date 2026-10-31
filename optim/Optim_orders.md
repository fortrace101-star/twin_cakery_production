# Optim — Orders (pricing, lifecycle, amendments, reschedules, numbering)

**Owner of:** order creation/edit/confirm/cancel, server-side pricing (shared with quotations), derived payment status, order amendments and reschedules.
**Foundations used:** `transition()` and `validate()` (`Optim_architecture.md`), `emit()` and notification rules (`Optim_notifications_audit.md`), `requirePermission` (`Optim_security_rbac.md`).
**Touches:** Finance, Production, Deliveries, Inventory, CRM, Analytics, Notifications, Database, Front end (each has its own section in every recommendation).

> Evidence: `server/routes/orders.ts` (PATCH, POST, `/confirm`, `/cancel`, `/repeat`), `server/routes/order-proposals.ts`, `server/services/business.service.ts` (`confirmOrder`, `prepareOrderForProduction`, `markOrderPaid`), `server/database/store.ts` (`createOrder`, `updateOrder`, `recomputePaymentStatus`), migrations `003`, `008`, `011`, `021`. The app was not run.

---

# PART A — ASSESSMENT

## A1. What is good
Status history (`order_status_history`), immutable customer snapshots (`order_customer_snapshots`), a repeat-order endpoint, a confirm flow that creates the production job, and a public path that prices from the catalogue on the server.

## A2. Findings
| # | Finding | Evidence | Realistic scenario |
|---|---|---|---|
| O1 | **`PATCH /orders/:id` spreads `req.body` into `store.updateOrder`** and only needs `orders.confirm`. `total`, `paymentStatus`, `status`, `customerId`, `createdBy` are all writable. Production Managers hold `orders.confirm`. | `orders.ts` line `store.updateOrder(id, { ...patch, … })` | A production manager sets `paymentStatus: "PAID"` on TC-481234 so the cake can be dispatched; no payment row exists, finance reports now disagree with the order list. |
| O2 | **No state machine.** Any `status` accepted from any status. | `orders.ts` PATCH | An `AWAITING_CONFIRMATION` order is set to `COMPLETED_DELIVERED`: CRM follow-up fires, job archive attempted, no payment, no job. |
| O3 | **Prices and totals come from the client** on staff-created orders and on `/repeat` (`body.total`, `body.subtotal`, per-item `unitPrice`). The public proposal path correctly prices server-side. | `orders.ts` POST and `/repeat` | A 3-tier wedding cake is entered at UGX 150,000 instead of 1,500,000 (typo or tampering). Nothing flags it; margin reports are wrong. |
| O4 | **`confirmOrder` failures are swallowed.** Both `PATCH {status:"CONFIRMED"}` and `POST /:id/confirm` catch any error and fall back to a bare status update. | `orders.ts` | Stock is short, `confirmOrder` throws, the order still becomes CONFIRMED with no job, no reservation. The Jobs board self-heals later via `reconcileProductionJobs`, hiding the cause. |
| O5 | **Dual state** `status` + `station`; dead `statusMap` block; `station: "decorating"` written with `as any`. | `orders.ts`, `production.ts` | The two fields disagree after a QC fail; the UI shows "Baking" while the list shows "Ready". |
| O6 | **Many `try { … } catch {}`** around job creation, archiving, advancement. | `orders.ts`, `production.ts` | Job creation fails silently; nobody is told. |
| O7 | **Order numbers are `TC-` + the last 6 digits of `Date.now()`** (also in `/repeat` and `order-proposals.ts`). `store.createOrder` passes them through `uniqueOrderNumber`, which appends a variant when a number is taken, so collisions don't crash. The numbers are still not sequential or gap-free, and the suffix repeats every 1,000 seconds. | `orders.ts`, `order-proposals.ts`, `store.ts:103-106,511` | Two orders created 1,000 s apart get the same base number and one silently becomes `TC-123456-<variant>`; staff quoting a number over the phone can't tell which order is meant. |
| O8 | **`createdBy` accepted from the body** on POST. | `orders.ts` POST | Attribution can be forged. |
| O9 | **Reschedules are not recorded.** `requiredAt/requiredBy` are overwritten; no `original_required_at`, no reason. | migration `003`/`011` | "Customer moved the date" and "we were late" are indistinguishable in analytics. |
| O10 | **No amendment flow.** Changing flavour/size/date after confirmation overwrites items with no price impact record. | — | A customer upgrades from 1kg to 2kg by phone; price, reservation and job quantity are edited by hand or not at all. |
| O11 | **No `confirmed_at` / `paid_at`** columns; milestones cannot be computed reliably. | migration `003` DDL | "Deposit-to-confirmation time" cannot be measured. |
| O12 | **`paymentStatus` is writable** and also computed by `recomputePaymentStatus`. | POST body, PATCH | Two sources of truth. |
| O13 | **Order-level delivery fee vs delivery-level fee.** `orders.delivery_charge` and `deliveries.delivery_fee` both exist. | migrations `003`, `006` | They diverge when a delivery fee is edited on the delivery card (see `Optim_deliveries.md`). |

---

# PART B — OPTIMIZATION, CORRECTION AND IMPROVEMENT

## B1. Server-side pricing (fixes O3, O8, O12)

### B1.1 Pricing service (shared by orders, quotations, repeat, proposals)
```ts
// server/services/pricing.service.ts
export interface LineInput { productId: string; variantOptions?: string; quantity: number; discount?: number; }
export interface PricedLine extends LineInput { unitPrice: number; total: number; recipeVersion: string; priceSource: "CATALOGUE" | "OVERRIDE"; }

export function priceLines(lines: LineInput[], opts: { override?: Record<string, number>; canOverride: boolean }): PricedLine[] {
  return lines.map((l) => {
    const p = store.db.catalogue?.products.find((x) => x.id === l.productId);
    if (!p || p.archived || !p.active) throw new ValidationError(`Product not orderable: ${l.productId}`);
    if (!(l.quantity > 0)) throw new ValidationError("Quantity must be positive");
    const override = opts.override?.[l.productId];
    if (override !== undefined && !opts.canOverride) throw new ForbiddenError("Price override needs orders.override_price");
    const unitPrice = Math.round(override ?? (p.basePrice + variantSurcharge(p, l.variantOptions)));  // UGX: whole shillings
    const gross = unitPrice * l.quantity;
    const discount = Math.min(Math.round(l.discount ?? 0), gross);
    return { ...l, unitPrice, total: gross - discount, recipeVersion: currentRecipeVersion(p.id),
             priceSource: override !== undefined ? "OVERRIDE" : "CATALOGUE" };
  });
}
export const orderTotals = (lines: PricedLine[], deliveryCharge: number, taxAmount: number, discount: number) => {
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  return { subtotal, total: subtotal + deliveryCharge + taxAmount - discount };
};
```
`variantSurcharge` should read from `option_values` (migration `002`). Confirm the existing option price field before coding; the audit did not inspect the catalogue internals.

### B1.2 Routes use whitelisted schemas
```ts
const CreateOrder = z.object({
  customerId: z.string().min(1),
  items: z.array(z.object({ productId: z.string(), variantOptions: z.string().optional(),
                            quantity: z.number().positive(), discount: z.number().min(0).optional() })).min(1),
  deliveryCharge: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  requiredAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).default(""),
  deliveryLocation: z.string().default(""), locationNote: z.string().default(""),
  priceOverrides: z.record(z.number().min(0)).optional(),
}).strict();                                          // status, paymentStatus, total, createdBy are rejected

router.post("/", requirePermission("orders.create"), validate(CreateOrder), async (req, res) => {
  const s = session(req);
  const can = await rbac.has(s.userId, "orders.override_price");
  const lines = priceLines(req.body.items, { override: req.body.priceOverrides, canOverride: can });
  const { subtotal, total } = orderTotals(lines, req.body.deliveryCharge, 0, req.body.discount);
  // discounts above threshold need orders.approve_discount (see B6)
  const order = await withTransaction(async (tx) => {
    const o = await ordersRepo.insert(tx, { ...req.body, items: lines, subtotal, total,
      status: "AWAITING_CONFIRMATION", paymentStatus: "UNPAID", createdBy: s.userId,
      orderNumber: await nextOrderNumber(tx) });
    await emit(tx, { type: "order.created", entity: "order", entityId: o.id, orderId: o.id, customerId: o.customerId,
                     amount: total, actor: { userId: s.userId, ip: req.ip }, data: { overrides: Object.keys(req.body.priceOverrides ?? {}) } });
    return o;
  });
  res.status(201).json(order);
});
```
`/repeat` copies the original lines but re-prices them from today's catalogue (the UI shows "price changed since original: +UGX X" so staff can accept or use the original price with `orders.override_price`).

### B1.3 Unified impact
| Module | Change | How |
|---|---|---|
| Quotations | Same `priceLines()` for quote lines and convert-to-order | `Optim_quotations.md` §B1 |
| Finance | `invoices` are generated from the priced lines at confirmation; override events show in the audit | `Optim_finance.md` §B3 |
| Analytics | `priceSource='OVERRIDE'` rate, average discount, price-change history | `Optim_analytics.md` |
| RBAC | New permissions `orders.override_price`, `orders.approve_discount` | B6 migration |
| Catalogue | `variantSurcharge` and recipe version lookup read catalogue; price edits are audited | `Optim_catalogue_recipes.md` |
| Website | `order-proposals` calls the same service, so website and ERP prices cannot drift | `Optim_website.md` |
| Database | `order_items.price_source`, `orders.discount_approved_by` | B6 |
| UI | Order form: unit price becomes read-only text with an "Override" toggle (visible only with permission); every override needs a reason | B7 |

## B2. Replace the generic PATCH with explicit actions (fixes O1, O2, O4, O5, O6, O12)
| Action | Route | Permission | Allowed from | Effects (same transaction) |
|---|---|---|---|---|
| Edit details | `PATCH /orders/:id/details` | `orders.edit` | AWAITING_CONFIRMATION, CONFIRMED (before production starts) | whitelist `notes, deliveryLocation, locationNote, salespersonId`; emits `order.edited` with old/new |
| Confirm | `POST /orders/:id/confirm` | `orders.confirm` | AWAITING_CONFIRMATION | `confirmOrder`: create job, reserve stock, set `confirmed_at`; **errors propagate (409/422), no fallback** |
| Reschedule | `POST /orders/:id/reschedule` | `orders.reschedule` | before IN_PRODUCTION; after that needs `orders.override` | stores `original_required_at` once, requires reason code, emits `order.date_changed`, notifies Production and Delivery |
| Amend | `POST /orders/:id/amendments` | `orders.amend` | CONFIRMED..IN_PRODUCTION | creates amendment (B4) |
| Cancel | `POST /orders/:id/cancel` | `orders.cancel` | AWAITING_CONFIRMATION, CONFIRMED, READY_FOR_PRODUCTION | reason code required; releases reservations; cancels job; triggers refund/forfeit decision in Finance |
| Complete | not an order action | — | set only by the delivery completion transition (`Optim_deliveries.md`) | |

Remove `PATCH /orders/:id` for status/payment fields entirely. Keep `PATCH /orders/:id` (if the UI still needs it) as an alias to `/details`.
```ts
router.post("/:id/confirm", requirePermission("orders.confirm"), async (req, res) => {
  const o = await transition("order", req.params.id, "confirm", actor(req));   // job + reservation are effects
  res.json(o);                                                                // 409/422 surface to the UI
});
```
Effects registered for `order.confirm` in the transition table:
```ts
effects: async ({ tx, row, actor }) => {
  await tx.query(`UPDATE orders SET confirmed_at = now() WHERE id=$1`, [row.id]);
  const job = await productionRepo.createForOrder(tx, row.id);          // idempotent via UNIQUE(order_id) WHERE status<>'ARCHIVED'
  await inventoryRepo.reserveForJob(tx, job.id);                        // fails (ConflictError) when stock is short → whole confirm rolls back
  await financeRepo.ensureInvoice(tx, row.id);                          // Optim_finance.md §B3
}
```
**Short-stock policy.** Rolling back the confirm is strict. Offer a second path: `POST /orders/:id/confirm { allowShortage: true }` (permission `orders.confirm_with_shortage`) that confirms, flags the job `MATERIALS_SHORT`, and auto-creates a purchase requirement (`Optim_purchasing.md`). The UI shows the shortage list in the confirm dialog and lets the user choose.

`paymentStatus` becomes derived: remove it from every request schema, and compute it in SQL (`Optim_finance.md` §B2.4) so the column is only written by the payment repository.

## B3. Order numbering (fixes O7)
```sql
-- 026_orders_lifecycle.sql
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001;
ALTER TABLE orders
  ADD COLUMN confirmed_at TIMESTAMPTZ,
  ADD COLUMN paid_at TIMESTAMPTZ,
  ADD COLUMN original_required_at TIMESTAMPTZ,
  ADD COLUMN assigned_to TEXT,                      -- also added by Optim_notifications_audit.md; keep one
  ADD COLUMN cancel_reason_code TEXT, ADD COLUMN cancel_reason TEXT,
  ADD COLUMN discount_approved_by TEXT;
ALTER TABLE order_items ADD COLUMN price_source TEXT NOT NULL DEFAULT 'CATALOGUE'
  CHECK (price_source IN ('CATALOGUE','OVERRIDE'));
-- backfill what can be known
UPDATE orders o SET confirmed_at = h.at FROM (
  SELECT order_id, min(created_at) at FROM order_status_history WHERE to_status='CONFIRMED' GROUP BY 1) h WHERE h.order_id=o.id;
UPDATE orders SET original_required_at = required_at WHERE original_required_at IS NULL;
UPDATE orders o SET paid_at = p.at FROM (
  SELECT order_id, max(created_at) at FROM payments GROUP BY 1) p WHERE p.order_id=o.id AND o.payment_status='PAID';
```
(Check the actual column names of `order_status_history`; the DDL was not re-read for this file.)
```ts
export const nextOrderNumber = async (tx: TxClient) =>
  `TC-${new Date().getFullYear()}-${String((await tx.query("SELECT nextval('order_number_seq') n")).rows[0].n).padStart(5, "0")}`;
```
Sequences can leave gaps on rollback. That is acceptable for order numbers. **Invoice numbers must be gap-free** and use a separate counter table (`Optim_finance.md` §B3.3). Replace every `TC-${Date.now()…}` call (`orders.ts` ×2, `order-proposals.ts`).

## B4. Amendments with price impact (new feature)
```sql
CREATE TABLE order_amendments (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
  requested_by TEXT NOT NULL, requested_via TEXT NOT NULL DEFAULT 'STAFF',   -- STAFF|CUSTOMER_CALL|WHATSAPP
  change_type TEXT NOT NULL,        -- ITEMS|DATE|FLAVOUR|SIZE|DELIVERY|OTHER
  before JSONB NOT NULL, after JSONB NOT NULL,
  price_delta NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PROPOSED',   -- PROPOSED|APPROVED|REJECTED|APPLIED
  approved_by TEXT, applied_at TIMESTAMPTZ, reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
Flow: staff proposes → server computes `price_delta` with `priceLines()` → approval (`orders.approve_amendment`, a different person when delta > threshold) → on APPLY one transaction does:
- **Orders:** update items/total; re-run `order.recalculate`.
- **Finance:** adjust the open invoice (credit note or supplementary line), recompute balance and `paymentStatus` (`PARTIALLY_PAID` if the new total exceeds payments).
- **Production:** update `production_jobs.quantity`, planned consumption (`Optim_production.md` §B3) and reservations (`Optim_inventory.md` §B1); if the job is already IN_PRODUCTION, mark it `AMENDED` and notify the baker.
- **Deliveries:** update `required_at` / fee if changed.
- **Notifications:** `order.amended` → Production and Sales; `order.date_changed` → Production and Delivery.
- **Analytics:** amendment rate, average price delta.
- **UI:** "Amendments" tab on the order drawer (list + "Request change" dialog showing a before/after diff and the price delta).

## B5. Cancellation (completes O2)
Cancel requires `reasonCode` (`CUSTOMER_REQUEST | UNPAID_DEPOSIT | STOCK | DUPLICATE | OTHER`). In one transaction: order → CANCELLED, job → cancelled, reservations released, delivery cancelled (reason `CANCELLED_BY_US`, see `Optim_deliveries.md`), and Finance decides: refund deposit, forfeit deposit (revenue), or leave as customer credit. The dialog shows the deposit held and the three choices; forfeiting needs `payments.approve_refund`. Emits `order.cancelled` with `data.depositDisposition`.

## B6. Permissions and discounts
```sql
-- 027_orders_permissions.sql  (pattern copied from migrations/012: stable ids, ON CONFLICT no-ops)
INSERT INTO permissions (id, key) VALUES
 ('perm-orders-edit','orders.edit'),
 ('perm-orders-reschedule','orders.reschedule'),
 ('perm-orders-amend','orders.amend'),
 ('perm-orders-approve-amendment','orders.approve_amendment'),
 ('perm-orders-override-price','orders.override_price'),
 ('perm-orders-approve-discount','orders.approve_discount'),
 ('perm-orders-confirm-with-shortage','orders.confirm_with_shortage')
ON CONFLICT (key) DO NOTHING;

-- role ids from seeds/seed.ts: role-admin, role-production, role-sales
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-' || replace(r.id,'role-','') || '-' || p.id, r.id, p.id
FROM permissions p JOIN roles r ON
     (r.id = 'role-admin')
  OR (r.id = 'role-sales' AND p.key IN ('orders.edit','orders.reschedule','orders.amend'))
WHERE p.key IN ('orders.edit','orders.reschedule','orders.amend','orders.approve_amendment',
                'orders.override_price','orders.approve_discount','orders.confirm_with_shortage')
ON CONFLICT (role_id, permission_id) DO NOTHING;
```
The SQL above gives Admin everything and Sales Manager only `orders.edit/reschedule/amend`; override, discount approval and amendment approval stay Admin-only at first. **remove `orders.confirm` handling of money fields from Production** — it no longer exists on any route they can reach. The `settings` table below does not exist yet: add `settings(key TEXT PRIMARY KEY, value JSONB)` in the same migration. The discount threshold lives in a `settings` row (`discount_approval_pct`, default 10).

## B7. UI changes
| Element | Existing → change |
|---|---|
| Order create/edit form (`module-table.tsx` / order dialogs in `dialogs.tsx`) | Unit price and totals become server-computed read-only values refreshed via `POST /orders/price-preview`; "Override price" toggle gated by permission with mandatory reason; discount over threshold shows "Needs approval" |
| Order drawer | Replace free status dropdown with the shared `<ActionBar>` (Confirm / Reschedule / Amend / Cancel) |
| New: Reschedule dialog | New date, reason code (`CUSTOMER_REQUEST`, `CAPACITY`, `INGREDIENT`, `OTHER`), shows original date and capacity warning for the new day |
| New: Amendments tab | list + diff + approve/reject |
| New: Cancel dialog | reason, deposit disposition, impact summary (job, reservations, delivery) |
| Order list | Add columns: confirmed, balance, lead-time-vs-promise; saved filters (status, due this week, unpaid); CSV export |
| Confirm dialog | Shows shortage list and the "Confirm with shortage" choice |
| Status badges | One shared colour map in `ui.tsx` used by orders, payments, deliveries |

## B8. Notifications and analytics owned by this module
Events emitted: `order.created`, `order.edited`, `order.confirmed`, `order.date_changed`, `order.amended`, `order.cancelled`. Rules: confirmed → Production (`production.view`); date changed → Production + Delivery; amendment → Production + Sales; unconfirmed order with no deposit after 24 h → Sales + Finance (escalate Admin at 48 h). Metrics: order volume by status and source, cancellation rate by reason, amendment rate, lead time (confirmed → delivered), lead time vs promise (`delivered_at - original_required_at`), override rate. All defined in `Optim_analytics.md`.

## B9. Tests
- PATCH with `total`/`paymentStatus`/`status` → 400 (strict schema).
- Staff without `orders.override_price` sending an override → 403.
- Confirm with short stock → 409, order stays AWAITING_CONFIRMATION, no job, no reservation.
- Two parallel confirms create one job.
- Order numbers are unique and increasing under 20 parallel creates.
- Reschedule keeps the first `original_required_at` across two reschedules.
- Cancel releases reservations and cancels the job.
