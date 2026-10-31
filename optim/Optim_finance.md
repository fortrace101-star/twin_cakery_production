# Optim — Finance (payments, invoices, ledger, revenue recognition, costing, controls, reports)

**Owner of:** payments, refunds/reversals, invoices and credit notes, the simplified double-entry ledger, accounting periods, expenses, job-cost posting, reconciliation and cash-up, finance reports.
**Foundations used:** `Optim_architecture.md` (transactions, validation), `Optim_notifications_audit.md` (`emit()` — the ledger posts from events), `Optim_security_rbac.md`.
**Depends on / feeds:** `Optim_deliveries.md` (settlement on completion, cash held by driver), `Optim_orders.md` (derived payment status, invoice at confirm, cancel/refund), `Optim_production.md` (job cost), `Optim_inventory.md` and `Optim_purchasing.md` (inventory, payables), `Optim_staff_payroll.md` (payroll postings), `Optim_analytics.md` (reads the ledger), `Optim_crm.md` (payment behaviour).

> Evidence: `server/routes/payments.ts`, `server/routes/finance.ts`, `server/routes/expenses.ts` (route list only; bodies skimmed), `server/routes/analytics.ts` (dashboard), `server/services/business.service.ts` (`markOrderPaid`), `server/database/store.ts` (`createPayment`, `paymentsReceived`, `recomputePaymentStatus`), `erp-interface-design/src/components/erp/finance-view.tsx` (449 lines), `analytics-view.tsx`, migrations `006_finance_delivery.sql`, `017`, `020_production_fixed_costs`. The app was not run, and expense/payroll internals were only partly read (marked *unverified*).

---

# PART A — ASSESSMENT

## A1. What is good
`NUMERIC(14,2)` money columns; a payments table with `reference` and `received_by`; a recompute function for payment status; `finance.view_reports` as a separate permission; production cost, consumption, wastage and fixed-cost tables that can feed job costing; an audit row on payment creation.

## A2. Findings
| # | Finding | Evidence | Scenario |
|---|---|---|---|
| F1 | **Payments can be hard-deleted.** On a failed M-Pesa callback the route does `store.db.payments.splice(idx, 1)`. | `payments.ts` `/:id/callback` | A customer's STK push fails, the row vanishes, the audit trail has "payment:created" and nothing else; the evidence of the attempt is gone. |
| F2 | **No void, reversal or refund endpoint** exists (routes: list, create, callback, and a second create under `/finance/payments`). | `payments.ts`, `finance.ts` | A wrong UGX 85,000 cash entry stays in the numbers until someone edits the database. |
| F3 | **Revenue is recognised at order creation.** `/finance/reports` sums `subtotal + tax + deliveryCharge − discount` for orders whose `createdAt` is in the period (excluding CANCELLED); the dashboard sums `o.total`. | `finance.ts`, `analytics.ts` | A UGX 2M wedding cake ordered in March for delivery in June inflates March revenue and makes June look empty. |
| F4 | **Two different revenue formulas.** Reports: `subtotal+tax+delivery−discount`; dashboard: `total`. They differ whenever `total` was client-supplied (`Optim_orders.md` O3). | same | The finance page and the dashboard disagree for the same month. |
| F5 | **Period mismatch on the dashboard.** `grossProfit = monthlyRevenue − directCosts` where `directCosts` and `expensesTotal` are all-time sums. (`/finance/reports` does filter costs by period; the dashboard does not.) | `analytics.ts` dashboard | In month 8, gross profit shows a large negative number even though the month was profitable. |
| F6 | **No invoice entity.** The order total acts as the invoice; no number, issue date, due date, status, tax breakdown. | migrations | No document to send, no ageing by due date, no gap-free numbering for tax. |
| F7 | **No credit notes, allocation or supplier payables** (the last is in `Optim_purchasing.md`). | — | A customer pays once for two orders; the system can't split it. |
| F8 | **No idempotency.** `POST /payments` creates a row every call. | `payments.ts` | Double-click or retry on a slow network records two UGX 150,000 payments; order becomes OVERPAID. |
| F9 | **Weak validation.** Only `orderId` and `amount !== undefined` are checked, then `Number(amount)`. Zero, negative and over-balance amounts, non-finite values and unknown methods pass. | `payments.ts` | `-500000` creates a negative "payment" that acts as a hidden refund. |
| F10 | **`receivedBy` comes from the request body** (default `"admin"`). The audit row uses the same field. | `payments.ts` | A user can record a payment as received by someone else. |
| F11 | **M-Pesa callback is a session-authenticated stub.** `POST /payments/:id/callback` needs `payments.record` and trusts `resultCode` from the body; there is no provider signature check. MTN MoMo and Airtel Money, the main Ugandan rails, are not modelled. | `payments.ts`, `buildStkPushResponse` | Any user with `payments.record` can mark any pending payment successful. |
| F12 | **Floats for money.** Totals are summed as JS numbers with `Math.round(x*100)/100` in places; UGX has no minor unit. | `business.service.ts`, `analytics.ts` | Reports drift by cents; displayed totals can disagree with the DB by 1 UGX. |
| F13 | **Delivery completion books an assumed cash payment** for the full balance (`markOrderPaid`, wrapped in `try/catch` that hides failure). Full analysis and the settlement fix are in `Optim_deliveries.md`. | `business.service.ts:576-640` | Overstated `paymentsReceived`, understated receivables, no cash-up possible. |
| F14 | **Audit rows are thin** (action, actor, reason text). Expense edit/delete audit coverage was not verified. | `audit_logs` DDL | No old/new values. |
| F15 | **Expenses may be hard-deleted** (`DELETE /expenses/:id` guarded by `finance.record_expense`; internals *unverified*). Payroll payments are not seen flowing into expenses (*unverified*). | `expenses.ts:94`, `remuneration.ts` | Profit omits payroll or loses deleted expenses. |
| F16 | **No period close, no approvals** (refund, discount, void, manual adjustment) and no reconciliation or cash-up. | — | A past month's figures can change after the owner has reported them. |

---

# PART B — OPTIMIZATION, CORRECTION AND IMPROVEMENT

## B0. Decisions this document makes (change them if you disagree)
1. **Accounting basis: accrual, revenue recognised at delivery**; deposits and prepayments are a liability (Customer Deposits) until then. A cash-basis view is still shown (cash in/out).
2. **Currency: UGX, whole shillings.** Store as `NUMERIC(14,0)` for new money columns or keep `(14,2)` with a CHECK that the value is whole; round once at the boundary with a single `ugx()` helper.
3. **A simplified ledger fed by events**, not a full accounting package.
4. **Append-only**: no `UPDATE`/`DELETE` of payments, journal lines or invoices after issue. Corrections are new rows.

## B1. Payments table: append-only, typed, idempotent (F1, F2, F8, F9, F10, F11)

### B1.1 Migration
```sql
-- 032_payments_append_only.sql
ALTER TABLE payments
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'PAYMENT' CHECK (kind IN ('PAYMENT','REFUND','REVERSAL')),
  ADD COLUMN status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('PENDING','CONFIRMED','FAILED')),
  ADD COLUMN reverses_payment_id TEXT REFERENCES payments(id),
  ADD COLUMN reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN approved_by TEXT,
  ADD COLUMN idempotency_key TEXT,
  ADD COLUMN provider TEXT, ADD COLUMN provider_ref TEXT,
  ADD COLUMN delivery_id TEXT, ADD COLUMN collected_by TEXT,        -- Optim_deliveries.md settlement
  ADD COLUMN cash_handover_id TEXT,                                  -- links driver cash to a Finance confirmation
  ADD COLUMN invoice_id TEXT;                                        -- allocation target, see B3
CREATE UNIQUE INDEX uq_payments_idem ON payments (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX uq_payments_ref  ON payments (method, reference)
  WHERE reference <> '' AND status <> 'FAILED' AND kind = 'PAYMENT';
ALTER TABLE payments ADD CONSTRAINT payments_sign_chk CHECK (
  (kind = 'PAYMENT' AND amount > 0) OR (kind IN ('REFUND','REVERSAL') AND amount < 0));
ALTER TABLE payments ADD CONSTRAINT payments_whole_ugx CHECK (amount = round(amount)) NOT VALID;
ALTER TABLE payments ADD CONSTRAINT payments_method_chk CHECK (method IN
  ('Cash','MTN MoMo','Airtel Money','Bank Transfer','M-Pesa','Card','Other')) NOT VALID;

-- append-only
CREATE FUNCTION payments_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'payments is append-only'; END IF;
  IF TG_OP = 'UPDATE' AND (OLD.amount <> NEW.amount OR OLD.order_id <> NEW.order_id OR OLD.kind <> NEW.kind
       OR OLD.method <> NEW.method OR OLD.reference <> NEW.reference) THEN
    RAISE EXCEPTION 'payment financial fields are immutable'; END IF;   -- only status PENDING→CONFIRMED/FAILED, notes
  RETURN NEW;
END $$;
CREATE TRIGGER trg_payments_append_only BEFORE UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION payments_append_only();
```
Before validating: `SELECT count(*) FROM payments WHERE amount <> round(amount) OR amount <= 0;`. If rows exist, review them by hand (they are the existing mistakes) before `VALIDATE CONSTRAINT`. Existing `method` values (e.g. "Cash", "M-Pesa") must be checked with `SELECT DISTINCT method FROM payments` before adding the method CHECK. The existing M-Pesa rows already deleted by the old callback cannot be recovered.

### B1.2 Payment service (single entry point; the only code that writes `payments`)
```ts
// server/services/payments.service.ts
export interface RecordPayment {
  orderId: string; amount: number; method: PaymentMethod; reference?: string;
  idempotencyKey: string; deliveryId?: string; notes?: string; invoiceId?: string;
}
export async function recordPayment(input: RecordPayment, actor: Actor) {
  return withTransaction(async (tx) => {
    const order = (await tx.query(`SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [input.orderId])).rows[0];
    if (!order) throw new NotFoundError("Order not found");
    if (order.status === "CANCELLED") throw new ConflictError("Order is cancelled");
    assertWholeUgx(input.amount);
    if (input.amount <= 0) throw new ValidationError("Amount must be positive");
    if (input.method !== "Cash" && !input.reference) throw new ValidationError("Reference required for non-cash payments");

    const balance = await orderBalance(tx, order.id);                       // total − confirmed payments + refunds
    if (input.amount > balance && !input.isOverpaymentOk)
      throw new ConflictError(`Amount exceeds balance ${balance}. Record it as a deposit/overpayment explicitly.`);

    const existing = (await tx.query(`SELECT * FROM payments WHERE idempotency_key=$1`, [input.idempotencyKey])).rows[0];
    if (existing) return { payment: existing, replayed: true };             // safe retry

    const status = isMobileMoney(input.method) && !input.confirmedByProvider ? "PENDING" : "CONFIRMED";
    const pay = await paymentsRepo.insert(tx, { ...input, status, receivedBy: actor.userId });   // actor from session, never body
    if (status === "CONFIRMED") await ledger.postPayment(tx, pay);          // B3.4
    await orderPaymentStatus.refresh(tx, order.id);                         // B1.4: derived, written only here
    await emit(tx, { type: "payment.recorded", entity: "payment", entityId: pay.id, orderId: order.id,
                     customerId: order.customer_id, amount: pay.amount, actor,
                     data: { method: pay.method, reference: pay.reference, status, deliveryId: input.deliveryId } });
    return { payment: pay, replayed: false };
  });
}
```
Route:
```ts
router.post("/", requirePermission("payments.record"), validate(RecordPaymentSchema), async (req, res) => {
  const key = req.header("Idempotency-Key") ?? req.body.idempotencyKey;
  if (!key) return res.status(400).json({ error: "Idempotency-Key header required" });
  const r = await recordPayment({ ...req.body, idempotencyKey: key }, actor(req));
  res.status(r.replayed ? 200 : 201).json(r.payment);
});
```
The front end generates one UUID per dialog opening (`crypto.randomUUID()`), so a double-click or retry sends the same key. Remove the duplicate `POST /finance/payments` (`finance.ts`) or make it call the same service.

### B1.3 Reversals and refunds (F2)
```ts
// POST /payments/:id/reverse   permission payments.reverse; refunds: payments.refund (+ approval)
export async function reversePayment(paymentId: string, body: { reason: string; kind: "REVERSAL" | "REFUND" }, actor: Actor) {
  return withTransaction(async (tx) => {
    const p = await paymentsRepo.lock(tx, paymentId);
    if (p.kind !== "PAYMENT" || p.status !== "CONFIRMED") throw new ConflictError("Only confirmed payments can be reversed");
    if (await paymentsRepo.hasReversal(tx, p.id)) throw new ConflictError("Already reversed");
    if (!body.reason?.trim()) throw new ValidationError("Reason required");
    const needsApproval = body.kind === "REFUND" || Math.abs(p.amount) > await settings.number("reversal_approval_ugx", 100_000);
    if (needsApproval) return approvals.request(tx, "payment.reverse", { paymentId, ...body }, actor);   // 202; maker–checker
    const rev = await paymentsRepo.insert(tx, { orderId: p.order_id, kind: body.kind, amount: -p.amount, method: p.method,
        reference: `REV-${p.id}`, reversesPaymentId: p.id, reason: body.reason, status: "CONFIRMED", receivedBy: actor.userId });
    await ledger.postReversal(tx, p, rev);
    await orderPaymentStatus.refresh(tx, p.order_id);
    await emit(tx, { type: "payment.reversed", entity: "payment", entityId: rev.id, orderId: p.order_id, amount: rev.amount, actor, data: { reverses: p.id, reason: body.reason } });
    return rev;
  });
}
```
The approval step (`approvals` table shared with inventory write-offs) requires a **different** user holding `payments.approve_refund`; the notification rule sends it with `requires_ack` (`Optim_notifications_audit.md` §B2.2).

### B1.4 Payment status is derived (also fixes `Optim_orders.md` O12)
```sql
CREATE OR REPLACE FUNCTION order_payment_status(p_order TEXT) RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM payments WHERE order_id=p_order AND status='PENDING') THEN 'PROCESSING'
    WHEN paid <= 0 AND refunds < 0 THEN 'REFUNDED'
    WHEN paid <= 0 THEN 'UNPAID'
    WHEN paid <  total THEN 'PARTIALLY_PAID'
    WHEN paid =  total THEN 'PAID'
    ELSE 'OVERPAID' END
  FROM (SELECT o.total,
          COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=o.id AND status='CONFIRMED'),0) AS paid,
          COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=o.id AND status='CONFIRMED' AND kind='REFUND'),0) AS refunds
        FROM orders o WHERE o.id=p_order) x;
$$;
```
`orderPaymentStatus.refresh` runs `UPDATE orders SET payment_status = order_payment_status(id), paid_at = CASE … END`. Take care: `REFUNDED` should reflect a full refund; confirm that your existing UI labels (`paymentStatusLabel` in `api.ts:261`) cover the same six values.

### B1.5 Mobile money provider abstraction (F11)
```ts
export interface PaymentProvider {
  name: "MTN_MOMO" | "AIRTEL_MONEY";
  requestToPay(req: { amount: number; msisdn: string; reference: string; callbackUrl: string }): Promise<{ providerRef: string }>;
  verifyWebhook(headers: Record<string,string>, rawBody: Buffer): { valid: boolean; providerRef: string; status: "SUCCESS" | "FAILED"; amount: number };
}
```
- Webhook route `POST /payments/webhooks/:provider` is **unauthenticated by session but authenticated by signature** (HMAC or the provider's scheme); it must use the raw body for verification. On success it sets the pending payment `CONFIRMED` (a status change on the same row, allowed by the trigger) and posts the ledger entry; on failure it sets `FAILED` — the row stays.
- Keep the current stub behind `PAYMENT_PROVIDER=stub` for development, but remove `payments.record` as the way to simulate a callback in production.
- Rename `M-Pesa` to the real provider labels in the UI; the check constraint above lists them.

## B2. Delivery completion posts what was collected (F13)
The design is in `Optim_deliveries.md`. The finance side of it:
1. `recordPayment({ deliveryId, collectedBy, method, reference, amount, idempotencyKey })` is called **inside the delivery-completion transaction** (the same `withTransaction`).
2. Cash collected by a driver is posted to **Cash with driver** (account 1015), not Cash on hand; a Finance user confirms the handover (`POST /finance/cash-handovers` with the payment ids, counted amount, permission `finance.confirm_handover`), which posts Dr Cash on hand / Cr Cash with driver and records any shortage/excess as `cash.mismatch` (a `delivery.cash_mismatch` event; rule in `Optim_notifications_audit.md`).
3. `markOrderPaid` is deleted. Its `try/catch` goes with it.
4. The finance page's receivables list and the cash-up screen (B7) read `deliveries` with `status='DELIVERED'` and `payment_status <> 'PAID'` so partial/no collection is visible immediately.

## B3. Invoices, credit notes and the simplified ledger (F3, F4, F6, F7)

### B3.1 Migration
```sql
-- 033_ledger_invoices.sql
CREATE TABLE accounts (
  code TEXT PRIMARY KEY, name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ASSET','LIABILITY','EQUITY','REVENUE','COGS','EXPENSE')),
  active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO accounts (code,name,type) VALUES
 ('1010','Cash on hand','ASSET'), ('1015','Cash with drivers','ASSET'), ('1020','Mobile money','ASSET'), ('1030','Bank','ASSET'),
 ('1100','Accounts receivable','ASSET'), ('1200','Inventory','ASSET'),
 ('2010','Customer deposits','LIABILITY'), ('2100','Accounts payable','LIABILITY'),
 ('2110','Goods received not invoiced','LIABILITY'), ('2200','VAT payable','LIABILITY'), ('2300','Wages payable','LIABILITY'),
 ('3000','Owner equity','EQUITY'),
 ('4000','Sales revenue','REVENUE'), ('4100','Delivery income','REVENUE'), ('4900','Forfeited deposits','REVENUE'),
 ('5000','COGS ingredients','COGS'), ('5010','COGS packaging','COGS'), ('5020','COGS labour','COGS'), ('5030','COGS overhead','COGS'),
 ('5100','Wastage expense','EXPENSE'), ('5110','Inventory shrinkage','EXPENSE'), ('6000','Operating expenses','EXPENSE'),
 ('6100','Payroll expense','EXPENSE'), ('6900','Cash over/short','EXPENSE');

CREATE TABLE accounting_periods (
  period TEXT PRIMARY KEY,                       -- '2026-10'
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  closed_by TEXT, closed_at TIMESTAMPTZ
);
CREATE TABLE journal_entries (
  id BIGSERIAL PRIMARY KEY, entry_date DATE NOT NULL, period TEXT NOT NULL REFERENCES accounting_periods(period),
  source_event_id BIGINT REFERENCES domain_events(id), source_type TEXT NOT NULL, source_id TEXT NOT NULL,
  memo TEXT NOT NULL DEFAULT '', reverses_entry_id BIGINT REFERENCES journal_entries(id),
  created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), backfilled BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (source_type, source_id, memo)           -- idempotent posting
);
CREATE TABLE journal_lines (
  id BIGSERIAL PRIMARY KEY, entry_id BIGINT NOT NULL REFERENCES journal_entries(id),
  account_code TEXT NOT NULL REFERENCES accounts(code),
  debit NUMERIC(14,0) NOT NULL DEFAULT 0 CHECK (debit >= 0), credit NUMERIC(14,0) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  order_id TEXT, customer_id TEXT, job_id TEXT, supplier_id TEXT,
  CHECK ((debit = 0) <> (credit = 0))
);
CREATE INDEX ON journal_lines (account_code, entry_id); CREATE INDEX ON journal_lines (order_id);

-- balanced, immutable, period-locked
CREATE FUNCTION journal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d NUMERIC; c NUMERIC; st TEXT;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN RAISE EXCEPTION 'journal is immutable; post a reversing entry'; END IF;
  SELECT status INTO st FROM accounting_periods WHERE period = NEW.period;
  IF st = 'CLOSED' THEN RAISE EXCEPTION 'period % is closed', NEW.period; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_je_guard BEFORE INSERT OR UPDATE OR DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION journal_guard();
CREATE TRIGGER trg_jl_guard BEFORE UPDATE OR DELETE ON journal_lines FOR EACH ROW EXECUTE FUNCTION journal_guard();
-- balance check is enforced in the service (and a deferred constraint trigger on COMMIT is recommended):
-- SELECT entry_id FROM journal_lines GROUP BY 1 HAVING sum(debit) <> sum(credit);   -- must return 0 rows

CREATE TABLE invoices (
  id TEXT PRIMARY KEY, invoice_no TEXT UNIQUE, order_id TEXT NOT NULL REFERENCES orders(id),
  customer_id TEXT NOT NULL REFERENCES customers(id), status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ISSUED','PART_PAID','PAID','VOID')),
  issue_date DATE, due_date DATE, currency TEXT NOT NULL DEFAULT 'UGX',
  subtotal NUMERIC(14,0) NOT NULL DEFAULT 0, tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0, tax_amount NUMERIC(14,0) NOT NULL DEFAULT 0,
  delivery_charge NUMERIC(14,0) NOT NULL DEFAULT 0, discount NUMERIC(14,0) NOT NULL DEFAULT 0, total NUMERIC(14,0) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE invoice_lines (id BIGSERIAL PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL, quantity NUMERIC(14,3) NOT NULL, unit_price NUMERIC(14,0) NOT NULL, total NUMERIC(14,0) NOT NULL);
CREATE TABLE credit_notes (id TEXT PRIMARY KEY, credit_no TEXT UNIQUE, invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount NUMERIC(14,0) NOT NULL CHECK (amount > 0), reason TEXT NOT NULL, approved_by TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE payment_allocations (id BIGSERIAL PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES payments(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id), amount NUMERIC(14,0) NOT NULL);
CREATE TABLE document_counters (kind TEXT, year INT, last_no INT NOT NULL DEFAULT 0, PRIMARY KEY (kind, year));
```

### B3.2 Gap-free invoice numbers
```ts
export async function nextDocNo(tx: TxClient, kind: "INV" | "CN") {
  const y = new Date().getFullYear();
  const { rows: [r] } = await tx.query(
    `INSERT INTO document_counters (kind, year, last_no) VALUES ($1,$2,1)
     ON CONFLICT (kind, year) DO UPDATE SET last_no = document_counters.last_no + 1 RETURNING last_no`, [kind, y]);
  return `${kind}-${y}-${String(r.last_no).padStart(5, "0")}`;       // assigned at ISSUE time, inside the issuing transaction
}
```
Numbers are assigned only when an invoice is ISSUED (drafts have none), and `VOID` invoices keep their number, so there are no gaps. If you are VAT-registered, `tax_rate`/`tax_amount` populate and URA requirements apply; confirm them with your accountant. This document does not assume VAT registration.

### B3.3 When invoices are created (unified with orders)
- **`order.confirm` effect** (`Optim_orders.md` §B2): `ensureInvoice(tx, orderId)` creates an ISSUED invoice from the priced order lines, due date from policy (deposit due on confirm, balance due at delivery or per customer terms).
- **Amendment applied:** a credit note (negative delta) or a supplementary invoice line (positive delta).
- **Cancel:** invoice → VOID if no payment; else credit note + refund/forfeit decision.

### B3.4 Event → journal posting rules (the ledger consumes events)
| Event | Debit | Credit |
|---|---|---|
| `payment.recorded` (CONFIRMED, before delivery) | Cash / Mobile money / Bank (or **Cash with drivers** when `delivery_id` and method Cash) | Customer deposits |
| `payment.recorded` (after delivery, against receivable) | Cash / Mobile money / Bank | Accounts receivable |
| `order.delivered` | Customer deposits (applied) + Accounts receivable (balance) | Sales revenue (+ Delivery income, + VAT payable) |
| `cash.handover_confirmed` | Cash on hand | Cash with drivers |
| `cash.mismatch` | Cash over/short (short) or Cash with drivers (over) | Cash with drivers (short) or Cash over/short (over) |
| `payment.reversed` / refund | Customer deposits or Sales revenue (credit-note) | Cash / Mobile money |
| `order.cancelled` with forfeit | Customer deposits | Forfeited deposits (revenue) |
| `goods.received` | Inventory | Goods received not invoiced |
| `bill.recorded` | Goods received not invoiced (+ price variance to Inventory) | Accounts payable |
| `bill.paid` | Accounts payable | Cash / Mobile money / Bank |
| `job.materials_consumed` | COGS ingredients | Inventory (at avg cost) |
| `job.packaging_consumed` / `job.labour_posted` / `job.overhead_allocated` | COGS packaging / labour / overhead | Inventory / Wages payable / Overhead clearing |
| `inventory.written_off` (wastage, spoilage) | Wastage expense | Inventory |
| `stocktake.approved` | Inventory shrinkage | Inventory |
| `expense.recorded` | Operating expenses (by category) | Cash / Accounts payable |
| `payroll.paid` | Payroll expense (accrued: Wages payable) | Cash / Mobile money |

```ts
// server/services/ledger.service.ts
export async function post(tx: TxClient, e: { eventId: number; date: string; type: string; id: string; memo: string; lines: Line[] }) {
  const d = sum(e.lines, "debit"), c = sum(e.lines, "credit");
  if (d !== c) throw new Error(`Unbalanced journal ${e.type}:${e.id} (${d} ≠ ${c})`);
  const period = e.date.slice(0, 7);
  await tx.query(`INSERT INTO accounting_periods (period) VALUES ($1) ON CONFLICT DO NOTHING`, [period]);
  const { rows: [je] } = await tx.query(
    `INSERT INTO journal_entries (entry_date, period, source_event_id, source_type, source_id, memo)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (source_type, source_id, memo) DO NOTHING RETURNING id`,
    [e.date, period, e.eventId, e.type, e.id, e.memo]);
  if (!je) return;                                           // already posted: idempotent replay
  for (const l of e.lines)
    await tx.query(`INSERT INTO journal_lines (entry_id, account_code, debit, credit, order_id, customer_id, job_id, supplier_id)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [je.id, l.account, l.debit ?? 0, l.credit ?? 0, l.orderId, l.customerId, l.jobId, l.supplierId]);
}
```
Run posting **synchronously inside the originating transaction** for money events (payment, delivery, handover), so there is never a payment without a journal entry. Slower consumers (analytics snapshots, notifications) run from the event worker.

### B3.5 Revenue at delivery (F3, F4)
`order.delivered` is emitted by the delivery completion transition (`Optim_deliveries.md`). The handler posts the revenue entry above using the **invoice** lines (server-computed), not the client total. For orders delivered before the migration, run the backfill (B9).

### B3.6 Period close
`POST /finance/periods/:period/close` (`finance.close_period`): refuses while there are unposted events for the period, unbalanced entries, un-reconciled mobile-money payments, or open stock-takes; sets `status='CLOSED'`, emits `period.closed`. The `journal_guard` trigger blocks new entries into a closed period; corrections go into the **current open period** as reversing/adjusting entries referencing the original (`reverses_entry_id`). Reopening needs `finance.reopen_period` and an audit event with a reason.

## B4. Reports that agree with each other (F3, F4, F5)
Replace the in-memory loop in `/finance/reports` and the dashboard finance numbers with SQL over the ledger:
```sql
-- Profit & loss for a period (accrual)
SELECT a.type, a.code, a.name,
       SUM(l.credit - l.debit) FILTER (WHERE a.type='REVENUE') AS revenue,
       SUM(l.debit - l.credit) FILTER (WHERE a.type IN ('COGS','EXPENSE')) AS cost
FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id JOIN accounts a ON a.code=l.account_code
WHERE e.entry_date >= $1 AND e.entry_date < $2
GROUP BY a.type, a.code, a.name ORDER BY a.code;
```
```ts
router.get("/reports/pnl", requirePermission("finance.view_reports"), async (req, res) => {
  const { from, to, compare } = parseRange(req.query);          // Africa/Kampala day boundaries; compare = prev | yoy
  res.json({ range: { from, to }, current: await pnl(from, to), comparison: compare ? await pnl(...shift(from, to, compare)) : null,
             basis: "accrual", definitions: METRIC_DEFINITIONS.pnl });
});
```
Other report endpoints (all take `from`, `to`, `compare`, `format=json|csv`): `/reports/cashflow` (payments + bill payments + expenses by date), `/reports/receivables-ageing` (buckets 0–7, 8–30, 30+ from invoice due date), `/reports/payables-ageing`, `/reports/deposits-held` (balance of 2010), `/reports/margin` (by product, size, occasion, channel, from job costs), `/reports/expenses-vs-budget`, `/reports/supplier-spend`. Each returns its **definition string** so the UI shows what the number means. **Date basis selector** (`basis=order|delivery|payment`) applies to revenue-style reports as defined in `Optim_analytics.md` §B1.

The old `/finance/reports?period=` keeps working for the current UI by delegating to `pnl()` with the period converted to a range (so the two screens cannot disagree). Weeks are calendar weeks in `Africa/Kampala` rather than a rolling 7 days.

## B5. Job costing and variance (production → finance)
- **Planned cost** is computed at quote/confirm from the recipe explosion (`job_planned_consumption` × avg cost, `Optim_production.md` §B3), stored as a `production_costs` row with `status='PLANNED'`.
- **Actual cost** accrues on consumption (ingredients at avg/batch cost), packaging, labour (`job_labour`), overhead allocation (from `production_fixed_cost_entries`), rework cost (QC) and wastage.
- **Variance** per job: price variance = Σ (actual unit cost − planned unit cost) × actual qty; usage variance = Σ (actual qty − planned qty) × planned unit cost; yield/waste = recorded wastage cost.
- **Margin per order** = invoice net revenue − actual cost, computed when the job reaches READY_FOR_DELIVERY (provisional) and finalised at delivery. A `margin.below_threshold` event fires under the `min_margin_pct` setting (Admin only; margin data is hidden from roles without `finance.view_margins`).

## B6. Controls and approvals (F16)
| Control | Mechanism |
|---|---|
| Maker–checker | `approvals(kind, payload, requested_by, decided_by, status)`; the decider must differ from the requester; kinds: `payment.reverse`, `refund`, `discount.over_limit`, `invoice.void`, `journal.manual`, `bill.pay.large`, `expense.large` |
| Thresholds | `settings` rows: `reversal_approval_ugx`, `refund_always_approval`, `discount_approval_pct`, `expense_approval_ugx` |
| Immutable history | Triggers in B1.1 and B3.1 |
| Manual journals | `POST /finance/journals` (`finance.post_manual`) requires approval and a memo; excluded from "system" reports unless included |
| Period lock | B3.6 |
| Audit | Every action emits an event with `{old,new,reason,ip}` (`Optim_notifications_audit.md`) |

## B7. Cash-up and reconciliation (new features)
```sql
CREATE TABLE cash_handovers (id TEXT PRIMARY KEY, driver_id TEXT NOT NULL, expected NUMERIC(14,0) NOT NULL, counted NUMERIC(14,0) NOT NULL,
  confirmed_by TEXT NOT NULL, confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(), note TEXT);
CREATE TABLE provider_statement_lines (id BIGSERIAL PRIMARY KEY, provider TEXT NOT NULL, provider_ref TEXT NOT NULL,
  amount NUMERIC(14,0) NOT NULL, occurred_at TIMESTAMPTZ NOT NULL, payment_id TEXT REFERENCES payments(id), match_status TEXT NOT NULL DEFAULT 'UNMATCHED',
  UNIQUE (provider, provider_ref));
```
- **Daily cash-up**: expected cash (confirmed cash payments that day − handed-over) vs counted; variance posts to *Cash over/short* with approval above a limit.
- **Mobile-money reconciliation**: upload the provider statement CSV, match by reference and amount; unmatched on either side raises `reconciliation.mismatch` to Finance (escalate Admin).

## B8. Expenses and payroll into the ledger (F15, *partly unverified*)
- Expenses: soft-void instead of delete (`voided_at`, `void_reason`, `voided_by`); edits create a new row version or write old/new to the event; `expense.recorded` posts to the ledger; categories map to accounts (`expense_categories.account_code`). Add attachment requirement above `expense_approval_ugx` and an approval step.
- Payroll (`Optim_staff_payroll.md`): `payroll.approved` accrues Dr Payroll expense / Cr Wages payable; `payroll.paid` clears it. Avoid double counting labour: labour costed to jobs (COGS labour) and payroll expense must not both hit P&L. Choose one: either payroll is the expense and job labour is an **allocation view**, or labour is COGS and the payroll expense excludes direct production staff. The simplest consistent choice for a bakery of your size is **payroll posts to Payroll expense; job labour cost is a management-accounting allocation that does not post**, which this document adopts.

## B9. Backfill and cutover
Run in this order, on a copy first, with the app stopped:
1. Back up (`pg_dump`). 2. Apply `032` (validate constraints after checking counts). 3. Apply `033`. 4. Backfill:
```sql
-- opening journal for historical activity, marked backfilled, in periods that are then closed
INSERT INTO accounting_periods (period) SELECT DISTINCT to_char(date,'YYYY-MM') FROM payments ON CONFLICT DO NOTHING;
-- payments: Dr cash/mobile money, Cr customer deposits   (one entry per payment; map method → account)
-- delivered orders (orders.delivered_at IS NOT NULL OR status='COMPLETED_DELIVERED'): Dr deposits + AR, Cr sales revenue
-- inventory opening: Dr Inventory, Cr Owner equity at current avg cost
```
Write these as a TypeScript script (`scripts/backfill-ledger.ts`) that calls `ledger.post()` per row so the balance check applies, and prints entries that cannot be mapped. Orders delivered by the **old auto-cash bug** carry a payment that may never have been collected; list them (`SELECT … FROM payments WHERE notes LIKE 'Balance settled on delivery%'`) for the owner to review before closing any period.
5. Close historical periods only after the owner signs off the totals.

## B10. Permissions
New: `payments.reverse`, `payments.refund`, `payments.approve_refund`, `finance.confirm_handover`, `finance.close_period`, `finance.reopen_period`, `finance.post_manual`, `finance.view_margins`, `finance.manage_invoices`, `finance.reconcile`, `finance.approve_payment` (shared with purchasing). Existing keys kept: `payments.view`, `payments.record`, `finance.view`, `finance.record_expense`, `finance.view_reports`. **Finance/Accountant role** (new, see `Optim_security_rbac.md`): everything finance except `finance.reopen_period` and recipe editing. Sales: `payments.view` (status only), `payments.record` for deposits, no margins. Drivers: `deliveries.complete` records collection only through the settlement endpoint. Also move `finance.view_reports` / margin data out of `sales.analytics` (see `Optim_analytics.md` §B6).

## B11. UI changes
| Element | Existing → change |
|---|---|
| Finance page (`finance-view.tsx`, 449 lines) | Split into tabs: **Overview**, **Invoices**, **Payments**, **Expenses**, **Bills (payables)**, **Cash-up**, **Reports**. Overview: receivables ageing card, deposits held, cash with drivers, "Needs attention" list (overdue invoices, pending mobile-money, handover mismatches, approvals waiting) |
| Record payment dialog | Method select (Cash, MTN MoMo, Airtel Money, Bank), reference required for non-cash, shows balance due and warns above balance, idempotency key generated per open, no free `receivedBy` |
| Payments table | Status chip (PENDING/CONFIRMED/FAILED), kind (Payment/Refund/Reversal), "Reverse" action (reason; approval status), CSV export, link to order/delivery/driver |
| **New** Invoice view/print | Invoice with number, dates, lines, tax, balance; PDF/print CSS; "Copy for WhatsApp" text; credit note action |
| **New** Approvals inbox | Pending approvals with requester, amount, reason; Approve/Reject (different user) |
| **New** Cash-up screen | Per driver and per day: expected vs counted, confirm handover, variance reason |
| **New** Reconciliation screen | Provider CSV upload, matched/unmatched lists |
| **New** Period close wizard | Checklist (unposted events, mismatches, approvals), Close button, closed-period banner on reports |
| Reports | Date-range picker with comparison toggle (previous period / same period last year) and **date basis** selector; each chart shows a "?" popover with the metric definition; CSV/PDF export with the range applied |
| Hardcoded fallbacks in `analytics-view.tsx:54` (`182080`, "64% gross margin") | Remove; show empty state when `dash` is null |

## B12. Unified impact matrix
| Change | Orders | Deliveries | Production | Inventory | Purchasing | Notifications | Analytics | RBAC | DB |
|---|---|---|---|---|---|---|---|---|---|
| Append-only payments + idempotency | status derived | settlement uses service | — | — | — | `payment.*` rules | days-to-pay | `payments.reverse/refund` | 032 |
| Revenue at delivery | `order.delivered` event | emits it | — | — | — | — | revenue basis selector | — | 033 |
| Invoices | created at confirm; amendments → credit notes | print on delivery note | — | — | — | overdue 1/7/14 d | DSO, ageing | `finance.manage_invoices` | 033 |
| Cash with driver | — | handover | — | — | — | cash not remitted | cash-up KPIs | `finance.confirm_handover` | 033 |
| Job costing | margin per order | delivery cost | planned/actual | avg cost | — | margin alert | margin by product | `finance.view_margins` | 029/033 |
| Payables | — | — | — | receipt → GRNI | bills/payments | bill due | payables ageing | `purchasing.pay_bill` | 031 |
| Period close | locks edits | — | — | stock-take open check | — | close due | frozen snapshots | `finance.close_period` | 033 |

## B13. Tests
- Same `Idempotency-Key` twice → one payment, second returns 200.
- Amount ≤ 0, over balance (no overpay flag), non-whole UGX, missing reference for MoMo → 400/409.
- Reverse creates a negative row linked to the original; cannot reverse twice; order status recomputes.
- `UPDATE`/`DELETE` on payments or journal tables fails.
- Every posted entry balances; replaying the same event posts nothing new.
- Posting into a closed period fails; the correction goes to the open period.
- Revenue for an order created in March and delivered in June appears in June.
- Provider webhook with a bad signature → 401 and no status change.
- Partial collection on delivery leaves the order PARTIALLY_PAID and the receivable visible (with `Optim_deliveries.md` tests).
