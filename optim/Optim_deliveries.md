# Optim_deliveries.md — Deliveries, Dispatch & Cash-on-Delivery Settlement

**Owns change set:** CS-02 (delivery settlement: "recording money requires someone to state what was actually collected").
**Touches:** Orders, Finance, Production, Notifications, Analytics, CRM, RBAC, Audit, Website, Architecture.
**Evidence base:** `server/routes/deliveries.ts`, `server/services/business.service.ts` (`markOrderPaid`, `archiveCompletedJob`, `requestCustomerFollowUp`), `server/database/store.ts` (`createDelivery`, `updateDelivery`, `createPayment`, `recomputePaymentStatus`), `server/migrations/006_finance_delivery.sql`, `007_delivery_actual_date.sql`, `erp-interface-design/src/components/erp/deliveries-view.tsx`, `lib/api.ts`, `src/test/markorder-paid.test.ts`.
**Not run:** read-only review. Snippets are illustrative; helper names that do not exist today are marked `// NEW`.

---

# PART A — ASSESSMENT

## What already works
- Separate routes exist for `dispatch`, `complete` and `cancel`, each behind its own permission (`deliveries.dispatch|complete|cancel`).
- Pickups are recognised: `/dispatch` rejects a pickup (409) because pickups never go "in transit".
- Completion writes an audit row and, on the order path, raises the CRM follow-up and archives the production job.
- The order's outstanding balance is derived on the server from the payment rows, not trusted from the client.
- Order status already has fulfilment states `AWAITING_COLLECTION` and `IN_TRANSIT`.

## Findings

### DEL-01 · Completing a delivery books the whole balance as "Cash" without anyone saying cash was collected — Critical
**Where:** `deliveries.ts` `POST /:id/complete` → `businessService.markOrderPaid()`.
**What the code does:**
1. Sets the delivery to `COMPLETED_DELIVERED` **before** any check of its current status.
2. If the order is not already `COMPLETED_DELIVERED`, sets it to that, then calls `markOrderPaid(order.id, session.userId)`.
3. `markOrderPaid` runs only when `paymentStatus` is `UNPAID` or `PARTIALLY_PAID`, computes `balance = order.total − Σ payments`, and creates a payment of **the entire balance** with `method: "Cash"`, `receivedBy: <whoever clicked>`, note "Balance settled on delivery (Cash on delivery)".
4. Recomputes `paymentStatus` (→ `PAID`), writes an audit row and, when `PAID`, sends a notification "paid in full on delivery (Cash …)".

**Why it is wrong:** the system **assumes** the money arrived and records the assumption as a fact.
**Scenarios:**
- *Paid by MoMo earlier, never logged.* Order total UGX 180,000; the customer sent 180,000 MoMo yesterday. Nobody keyed it in. The driver completes the delivery; the system books another 180,000 as Cash. When Finance later logs the real MoMo payment the order flips to `OVERPAID` and the ledger has 360,000 for a 180,000 order.
- *Customer pays 100,000 of 180,000 and promises the rest.* The system records 180,000 cash. Receivables are understated by 80,000 and nobody chases it.
- *Customer refuses the cake at the door.* Staff clicks Complete to close the card. 180,000 "cash" appears in `paymentsReceived` and `cashMovement` with no money in the till.
- *Fraud.* A driver who collected cash and kept it is indistinguishable from a driver who collected nothing. The audit trail names the person who clicked as the one who *received* the cash.

**Silent failure:** `markOrderPaid` is wrapped in `try { … } catch { /* delivered; payment reconciliation surfaces elsewhere */ }`. I found no "reconciliation surface" that picks up a failure.

### DEL-02 · The delivery screen does not use the dedicated routes at all — Critical (new finding)
**Where:** `deliveries-view.tsx`.
- `onMarkReady` → `updateDelivery(id, { status: "READY_FOR_DISPATCH" })` (PATCH)
- `onDispatch` → `updateDelivery(id, { status: "IN_TRANSIT" })` (PATCH)
- `onComplete` → `updateDelivery(id, { status: "COMPLETED_DELIVERED" })` (PATCH)
- `onCancel` → `cancelDelivery(id)` (the dedicated route — the only one used)
- `lib/api.ts` defines `completeDelivery()` (POST `/complete`) but **nothing in the UI imports it**.

**Consequence (what actually happens in the app as shipped):**
- Clicking **Complete delivery** only flips the delivery row. The **order stays** `IN_TRANSIT` / `AWAITING_COLLECTION`; no payment is recorded; no CRM follow-up is raised; the production job is not archived; no audit row is written; no notification fires.
- Clicking **Dispatch** never sets `actual_dispatch_time`; Complete never sets `actual_delivery_date`. These are exactly the fields on-time-delivery and lead-time analytics need, so those metrics will be empty or wrong (ANA-05).
- The order is advanced separately via `onSetInTransit` → `PATCH /orders/:id {status:"IN_TRANSIT"}` (a route guarded by `orders.confirm`, ORD-02).
- So DEL-01 is a loaded gun that is **not pointed at you today** through the UI, but is one `completeDelivery()` import away, and is reachable by any API client with `deliveries.complete`. Fixing DEL-01 without fixing DEL-02 changes nothing visible; fixing DEL-02 without DEL-01 would switch the bad behaviour on. They must ship together.

### DEL-03 · `PATCH /deliveries/:id` is guarded by `deliveries.view` and writes any field — High
Anyone who can *see* deliveries (Sales has it) can set `status`, `actualDeliveryDate`, `deliveryFee`, `deliveryPerson`, `customerConfirmation`, `type`. No state check, no audit row, no `store.updateDelivery` (it assigns directly onto the cached object, then `store.persist()`).

### DEL-04 · `/complete` has no precondition and can be repeated — High
A `PENDING`, `FAILED` (cancelled) or already-completed delivery can be "completed" again. A second call rewrites `actualDeliveryDate` and writes another audit row. Payment is skipped when the order was already completed, so **which path ran first decides whether money was recorded** (`PATCH /orders/:id` to Completed records no payment; `/complete` does; PATCH delivery does nothing).

### DEL-05 · "Cancelled by us" and "failed attempt" are the same status — Medium
`/cancel` writes `FAILED`. A failure-rate KPI can't separate "customer wasn't home" from "we cancelled the order". There are no reason codes, no attempt counter, no reschedule.

### DEL-06 · No proof of delivery and no record of what was collected — High
`customerConfirmation` is a free-text field. There is no recipient name, photo, signature, OTP, geotag, or amount collected. Disputes ("I never received it") cannot be answered.

### DEL-07 · The driver is free text — Medium
`deliveries.delivery_person` is a string. There is no link to a user or staff record, so the driver cannot sign in to a driver view, workload can't be balanced, "deliveries per driver" can't be computed, and permissions cannot be scoped to "my deliveries".

### DEL-08 · Delivery fee is stored twice and delivery *cost* is not stored — Medium
`orders.delivery_charge` (what the customer pays) and `deliveries.delivery_fee` (undefined meaning) are never reconciled; the create form posts `deliveryFee: fFee ? Number(fFee) : null` while the column is `NOT NULL DEFAULT 0`. There is no field for what the delivery **cost you** (fuel, rider pay), so cost per delivery and zone profitability cannot be known.

### DEL-09 · Status vocabularies overlap without a state machine — Medium
`DeliveryStatus = PENDING | READY_FOR_DISPATCH | IN_TRANSIT | COMPLETED_DELIVERED | AWAITING_COLLECTION | PICKED_UP | FAILED` and `OrderStatus` also contains `IN_TRANSIT`, `AWAITING_COLLECTION`, `COMPLETED_DELIVERED`. `orders.delivery_status` is a third copy. Nothing guarantees they agree, and the dashboard's "active deliveries" (`status !== COMPLETED_DELIVERED && !== FAILED`) counts pickups still `PENDING` forever.

### DEL-10 · Delivery events never notify anyone — Medium
Templates and routing exist for `DeliveryDue`, `DeliveryDispatched`, `DeliveryCompleted`, but `deliveries.ts` never imports the notification service. The only delivery-related alert is the (wrongly worded) payment notification from DEL-01 and the CRM follow-up banner.

### DEL-11 · No zones, slots or capacity — Low/Medium
Scheduled time is a timestamp plus a free-text `scheduled_time`. There are no delivery zones with fees, no slot capacity (how many drop-offs per hour per driver), no route order.

### DEL-12 · Everyone with `deliveries.view` sees all deliveries and addresses — Medium
A driver should see only theirs; a cashier should not see customer addresses. See SEC-17.

---

# PART B — OPTIMIZATION, CORRECTION & IMPROVEMENT

## B-01 · Principle: money is recorded only from an explicit statement

> Completing a delivery requires either `collected: { amount, method, reference }` **or** `noCollection: { reason }` (when a balance is due). The server computes the balance; the client never supplies it.

## B-02 · Delivery state machine (fixes DEL-04, DEL-05, DEL-09)

Keep your existing enum values and add four. One transition table in `server/services/delivery-states.ts` (and the shared state-machine module, ARC-04):

| From | To | Permission | Side effects |
|---|---|---|---|
| `PENDING` | `ASSIGNED` | `deliveries.assign` | driver set |
| `PENDING`/`ASSIGNED` | `READY_FOR_DISPATCH` | `deliveries.dispatch` | `ready_at` stamped |
| `READY_FOR_DISPATCH` | `IN_TRANSIT` | `deliveries.dispatch` | `actual_dispatch_time` stamped; order → `IN_TRANSIT` |
| `IN_TRANSIT` | `COMPLETED_DELIVERED` | `deliveries.complete` | settlement, proof, order closed |
| `IN_TRANSIT` | `FAILED_ATTEMPT` | `deliveries.complete` | attempt row, reason code, order back to `READY_FOR_DELIVERY` |
| `FAILED_ATTEMPT` | `RESCHEDULED` → `READY_FOR_DISPATCH` | `deliveries.assign` | new slot |
| any open | `CANCELLED` | `deliveries.cancel` | reason code, deposit rule (FIN) |
| pickup: `AWAITING_COLLECTION` | `PICKED_UP` | `deliveries.complete` | same settlement rules |

`FAILED` stays in the enum for old rows; a one-time migration maps old `FAILED` rows to `CANCELLED`.

**`PATCH /deliveries/:id` becomes details-only** (destination, slot, notes, fee, zone). It rejects `status`, `actualDispatchTime`, `actualDeliveryDate` with 422 "use the action endpoints", requires `deliveries.update` (not `deliveries.view`), whitelists fields with Zod, and writes an audit event with old/new values.

## B-03 · Database (fixes DEL-05–DEL-08) — `031_deliveries_settlement.sql`

```sql
-- Twin Cakery ERP — 031 delivery lifecycle, proof, settlement, cash handover
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS driver_user_id        TEXT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS zone_id               TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancel_reason_code    TEXT,
  ADD COLUMN IF NOT EXISTS cancel_note           TEXT,
  ADD COLUMN IF NOT EXISTS delivery_cost         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (delivery_cost >= 0),  -- what it cost us
  ADD COLUMN IF NOT EXISTS recipient_name        TEXT,
  ADD COLUMN IF NOT EXISTS proof_photo_url       TEXT,
  ADD COLUMN IF NOT EXISTS proof_otp_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivered_lat         NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS delivered_lng         NUMERIC(9,6);
-- delivery_fee stays and becomes "fee charged to the customer for this delivery" (mirrors orders.delivery_charge).
ALTER TABLE deliveries ALTER COLUMN delivery_fee SET DEFAULT 0;
UPDATE deliveries SET delivery_fee = 0 WHERE delivery_fee IS NULL;
UPDATE deliveries SET status = 'CANCELLED' WHERE status = 'FAILED';
ALTER TABLE deliveries ADD CONSTRAINT chk_delivery_status CHECK (status IN
  ('PENDING','ASSIGNED','READY_FOR_DISPATCH','IN_TRANSIT','COMPLETED_DELIVERED','FAILED_ATTEMPT','RESCHEDULED',
   'AWAITING_COLLECTION','PICKED_UP','CANCELLED'));
ALTER TABLE deliveries ADD CONSTRAINT chk_delivered_has_time CHECK
  (status NOT IN ('COMPLETED_DELIVERED','PICKED_UP') OR actual_delivery_date IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_status ON deliveries(driver_user_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_sched ON deliveries(scheduled_date, status);

CREATE TABLE IF NOT EXISTS delivery_attempts (
  id            TEXT PRIMARY KEY,
  delivery_id   TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  attempt_no    INTEGER NOT NULL,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  driver_user_id TEXT REFERENCES users(id),
  outcome       TEXT NOT NULL CHECK (outcome IN ('DELIVERED','FAILED')),
  reason_code   TEXT,            -- NOT_HOME | WRONG_ADDRESS | UNREACHABLE | REFUSED | PAYMENT_ISSUE | WEATHER | VEHICLE | OTHER
  note          TEXT,
  UNIQUE (delivery_id, attempt_no)
);

CREATE TABLE IF NOT EXISTS delivery_zones (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
  fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  est_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (est_cost >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- One settlement per completed delivery: the statement of what was actually collected.
CREATE TABLE IF NOT EXISTS delivery_settlements (
  id                 TEXT PRIMARY KEY,
  delivery_id        TEXT NOT NULL UNIQUE REFERENCES deliveries(id) ON DELETE RESTRICT,   -- UNIQUE = at most one settlement => no double payment
  order_id           TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  balance_due        NUMERIC(14,2) NOT NULL CHECK (balance_due >= 0),     -- server-computed at completion
  collected_amount   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (collected_amount >= 0),
  method             TEXT CHECK (method IN ('CASH','MTN_MOMO','AIRTEL_MONEY','BANK_TRANSFER','CARD')),
  reference          TEXT,
  no_collection_reason TEXT,
  payment_id         TEXT REFERENCES payments(id) ON DELETE RESTRICT,
  collected_by       TEXT NOT NULL REFERENCES users(id),
  settled_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_settlement_shape CHECK (
    (collected_amount > 0 AND method IS NOT NULL AND no_collection_reason IS NULL AND payment_id IS NOT NULL)
    OR (collected_amount = 0 AND no_collection_reason IS NOT NULL AND payment_id IS NULL)
    OR (balance_due = 0 AND collected_amount = 0)
  ),
  CONSTRAINT chk_ref_for_digital CHECK (method IS NULL OR method = 'CASH' OR coalesce(reference,'') <> '')
);

-- Cash the driver is holding until Finance confirms the handover.
CREATE TABLE IF NOT EXISTS cash_handovers (
  id              TEXT PRIMARY KEY,
  driver_user_id  TEXT NOT NULL REFERENCES users(id),
  business_date   DATE NOT NULL,
  expected_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  counted_amount  NUMERIC(14,2),
  status          TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','SUBMITTED','CONFIRMED','SHORT','OVER')),
  submitted_at    TIMESTAMPTZ,
  confirmed_by    TEXT REFERENCES users(id),
  confirmed_at    TIMESTAMPTZ,
  note            TEXT,
  UNIQUE (driver_user_id, business_date),
  CONSTRAINT chk_confirmer_not_driver CHECK (confirmed_by IS NULL OR confirmed_by <> driver_user_id)
);
CREATE TABLE IF NOT EXISTS cash_handover_items (
  handover_id TEXT NOT NULL REFERENCES cash_handovers(id) ON DELETE CASCADE,
  settlement_id TEXT NOT NULL UNIQUE REFERENCES delivery_settlements(id),
  amount NUMERIC(14,2) NOT NULL,
  PRIMARY KEY (handover_id, settlement_id)
);
```
The settlement and handover tables are written by direct SQL inside one `withTransaction` (not added to `MIRRORS`). See ARC-02.

## B-04 · The handler (fixes DEL-01, DEL-04, DEL-06, DEL-10)

```ts
// server/routes/deliveries.ts
import { z } from "zod";                       // NEW dependency on the server (already used by the frontend)
import { requirePermission as required, actorOf } from "../middleware/auth.js";
import { events } from "../services/events.service.js";           // NEW (NOT-01)
import { paymentsService } from "../services/payments.service.js"; // NEW (FIN-02)

const CompleteBody = z.object({
  proof: z.object({
    recipientName: z.string().trim().min(2),
    otp: z.string().regex(/^\d{4,6}$/).optional(),
    photoUrl: z.string().url().optional(),
    lat: z.number().optional(), lng: z.number().optional(),
  }),
  collected: z.object({
    amount: z.number().int().positive(),                       // UGX has no minor unit
    method: z.enum(["CASH", "MTN_MOMO", "AIRTEL_MONEY", "BANK_TRANSFER", "CARD"]),
    reference: z.string().trim().optional(),
  }).optional(),
  noCollection: z.object({ reason: z.string().trim().min(5) }).optional(),
}).refine((b) => !(b.collected && b.noCollection), "Send collected OR noCollection, not both");

router.post("/:id/complete", required("deliveries.complete"), async (req, res) => {
  const body = CompleteBody.parse(req.body);
  const actor = actorOf(req);
  const idemKey = req.header("Idempotency-Key") ?? null;

  const result = await store.transaction(async (tx) => {             // NEW (ARC-03): all-or-nothing
    const delivery = tx.findDelivery(String(req.params.id));
    if (!delivery) throw new NotFoundError("Delivery not found");
    const allowed = delivery.type.includes("PICKUP") ? ["AWAITING_COLLECTION"] : ["IN_TRANSIT"];
    if (!allowed.includes(delivery.status))
      throw new ConflictError(`Cannot complete a delivery that is ${delivery.status}`);       // 409 — fixes DEL-04
    if (driverScoped(req) && delivery.driverUserId !== actor) throw new ForbiddenError("Not your delivery");

    const order = tx.findOrder(delivery.orderId)!;
    const balanceDue = paymentsService.balanceDue(tx, order.id);   // total − Σ(non-failed payments − reversals); server-side only
    if (balanceDue > 0 && !body.collected && !body.noCollection)
      throw new ValidationError("Record what was collected, or why nothing was", { balanceDue }); // 422
    if (body.collected && ["MTN_MOMO","AIRTEL_MONEY","BANK_TRANSFER","CARD"].includes(body.collected.method) && !body.collected.reference)
      throw new ValidationError("A reference is required for non-cash payments");

    let paymentId: string | null = null;
    if (body.collected && balanceDue > 0) {
      const status = body.collected.method === "CASH" ? "HELD_BY_DRIVER" : "PENDING_CONFIRMATION";
      const p = paymentsService.record(tx, {
        orderId: order.id, amount: body.collected.amount, method: body.collected.method,
        reference: body.collected.reference ?? "", receivedBy: actor, deliveryId: delivery.id,
        status, idempotencyKey: idemKey ?? `settle:${delivery.id}`,        // a retry returns the same payment
      });
      paymentId = p.id;
    }
    tx.insertSettlement({ deliveryId: delivery.id, orderId: order.id, balanceDue,
      collectedAmount: body.collected?.amount ?? 0, method: body.collected?.method ?? null,
      reference: body.collected?.reference ?? null, noCollectionReason: body.noCollection?.reason ?? null,
      paymentId, collectedBy: actor });                                    // UNIQUE(delivery_id) rejects a second completion

    const now = new Date().toISOString();
    tx.updateDelivery(delivery.id, { status: delivery.type.includes("PICKUP") ? "PICKED_UP" : "COMPLETED_DELIVERED",
      actualDeliveryDate: now, recipientName: body.proof.recipientName, proofPhotoUrl: body.proof.photoUrl ?? null,
      proofOtpVerified: !!body.proof.otp, deliveredLat: body.proof.lat ?? null, deliveredLng: body.proof.lng ?? null });
    tx.insertAttempt({ deliveryId: delivery.id, outcome: "DELIVERED", driverUserId: actor });

    // order follows the delivery, never the reverse (ORD-04)
    orderStates.apply(tx, order.id, "COMPLETED_DELIVERED", actor, "Delivery completed");
    paymentsService.recompute(tx, order.id);                              // → PAID | PARTIALLY_PAID | OVERPAID
    jobs.archiveFor(tx, order.id, actor);                                  // production job archived (PRD)
    events.emit(tx, { type: "delivery.completed", entityType: "delivery", entityId: delivery.id,
      orderId: order.id, actorId: actor, amount: body.collected?.amount ?? 0,
      data: { balanceDue, collected: body.collected ?? null, noCollection: body.noCollection ?? null, proof: { name: body.proof.recipientName } } });
    return { delivery: tx.findDelivery(delivery.id), order: tx.findOrder(order.id), balanceDue };
  });
  res.json(result);
});
```
**Rules baked into the handler**
- Balance due is computed by the server from payments, never from the body.
- Partial collection: delivery completes, order becomes `PARTIALLY_PAID`, stays on the receivables list, and the event `delivery.partial_collection` triggers a Finance alert (NOT rule).
- Over-collection: `collected.amount > balanceDue` is accepted only with `noCollection`-style note and raises `payment.overpaid_review`; the order is `OVERPAID`, never silently accepted.
- Zero collection with a balance requires a reason (e.g. "Customer refused", "Customer will pay Friday") and puts the order into the **follow-up** queue (CRM) and receivables.
- Double-click / retry: the `UNIQUE(delivery_id)` on `delivery_settlements` plus `Idempotency-Key` guarantee exactly one payment; the second call returns `409` (or the same payload for the same key).
- Concurrency: `SELECT … FOR UPDATE` on the delivery row when using SQL; with the in-memory store, the `store.transaction` helper serialises requests (ARC-03).
- No `try { … } catch {}`: if the payment cannot be saved, the whole transaction rolls back and the API returns 5xx. If a *side effect* that is genuinely optional fails (e.g. WhatsApp message), it is recorded as a **needs-attention item**, not swallowed (NOT-05).

### Other action endpoints
```ts
router.post("/:id/assign",   required("deliveries.assign"),   … body {driverUserId, zoneId?})   // PENDING→ASSIGNED
router.post("/:id/ready",    required("deliveries.dispatch"), …)                                // →READY_FOR_DISPATCH (order must be READY_FOR_DELIVERY)
router.post("/:id/dispatch", required("deliveries.dispatch"), …)                                // requires driver; stamps actual_dispatch_time; order→IN_TRANSIT
router.post("/:id/fail",     required("deliveries.complete"), … body {reasonCode, note, rescheduleAt?})  // attempt row; order→READY_FOR_DELIVERY
router.post("/:id/cancel",   required("deliveries.cancel"),   … body {reasonCode, note})        // CANCELLED, not FAILED
router.get ("/mine",         required("deliveries.view_assigned"), …)                           // driver's own list
router.post("/handovers/:driverId/submit",  required("deliveries.collect_payment"), … body {countedAmount})
router.post("/handovers/:id/confirm",       required("deliveries.confirm_remittance"), … body {countedAmount})  // confirmer ≠ driver
```
Each stamps its timestamp server-side (`now()`), validates the transition against the table in B-02, calls `events.emit` in the same transaction, and uses `actorOf(req)`.

## B-05 · Remittance (cash with driver) closes the loop

1. A cash settlement creates the payment with status `HELD_BY_DRIVER`; it counts as "cash with driver" (an asset account, FIN-08) not "cash in till".
2. At end of day the driver submits the cash count (`/handovers/:driverId/submit`); the expected amount is `Σ HELD_BY_DRIVER payments` for the day.
3. Finance confirms (`/handovers/:id/confirm`) with the counted amount. Equal → payments become `CONFIRMED`, ledger moves *Cash with driver → Cash*. Different → status `SHORT`/`OVER`, variance posted to a *Cash over/short* account, `reconciliation.mismatch` event and an approval request if above threshold (SEC B-06).
4. Mobile money collected by a driver is `PENDING_CONFIRMATION` until Finance matches the provider reference against the statement (FIN-10).

## B-06 · Interim patch (do this first — about an hour, not twenty minutes)
1. In `POST /:id/complete`, **delete** the `businessService.markOrderPaid(...)` call. Add the precondition check (409 unless `IN_TRANSIT` / `AWAITING_COLLECTION`).
2. In `deliveries-view.tsx` point **Dispatch** and **Complete** at the dedicated routes (`dispatchDelivery`, `completeDelivery`) so timestamps, order sync and the follow-up actually run; show the balance due on the card and a "Record payment" button wired to `POST /payments`.
3. Restrict `PATCH /deliveries/:id` to `deliveries.update` and strip `status`/times from it.
4. Rewrite `src/test/markorder-paid.test.ts`: it currently asserts that completing creates a Cash payment; invert it (see tests below).
This stops false cash entries immediately; the full settlement flow follows.

## B-07 · Ripple — everything CS-02 touches

| Module | What changes | How |
|---|---|---|
| **Orders** | Order is closed by the delivery transaction, not by PATCH; new `IN_TRANSIT → READY_FOR_DELIVERY` (failed attempt) transition; `paymentStatus` derived only; `delivered_at` stamped | ORD-04 state machine; `orders.delivered_at` exists (003) but is never set today |
| **Finance** | New payment states (`HELD_BY_DRIVER`, `PENDING_CONFIRMATION`, `CONFIRMED`, `FAILED`, `REVERSED`), `payments.delivery_id`, receivables stay correct on partial/zero collection, "cash with driver" balance, remittance confirmation screen, delivery cost posted as expense/COGS | FIN-02, FIN-05, FIN-08, FIN-10 |
| **Production** | Job archived only when the order is delivered **and** settled-or-flagged; archive moved into the same transaction | PRD-08 |
| **Notifications** | Events `delivery.assigned/dispatched/late/completed/failed`, `delivery.partial_collection`, `cash.not_remitted`; payment alert goes to holders of `payments.view`, with the real method and amount, and a different template when collected ≠ expected | NOT-04 rules |
| **Analytics** | On-time %, lateness p50/p90, failed-attempt reasons, delivery cost per order, deliveries per driver, zone profitability, cash held by drivers, remittance delay; days-to-pay for COD stops being 0 | ANA-05, ANA-06 |
| **CRM** | Follow-up task created when `noCollection` or `FAILED_ATTEMPT`; feedback link sent after delivery; "customer didn't pay" flag on the customer timeline | CRM-04 |
| **RBAC** | New keys: `deliveries.assign`, `deliveries.update`, `deliveries.collect_payment`, `deliveries.confirm_remittance`, `deliveries.view_assigned`; `payments.record` stays with Sales/Finance — drivers record collection **only** through this endpoint, within `approval.thresholds` | SEC B-06 |
| **Audit / events** | `delivery.*` events with old/new status; settlement shape stored in `data` | NOT-01 |
| **Website** | Order-tracking page shows status/ETA/driver first name; OTP SMS to customer at dispatch | WEB-05 |
| **Architecture** | `store.transaction`, state-machine module, direct-SQL tables outside the mirror | ARC-02/03/04 |

---

# PART C — NEW FUNCTIONALITY & UI

| UI element | Purpose | Details |
|---|---|---|
| **Driver app (PWA, mobile-first)** | Everything a driver does in one place | "My deliveries today" cards sorted by slot; address with *Open in Maps* (`https://maps.google.com/?q=<address>`) and *Call*/*WhatsApp*; big buttons **Start**, **Arrived**, **Delivered**, **Couldn't deliver**; works offline for the day's list (service worker already exists in `public/sw.js`); uses `GET /deliveries/mine` |
| **Settlement sheet** | The heart of CS-02 | Opens on **Delivered**. Shows "**Collect UGX 85,000**" (from `balanceDue`), method chips (Cash / MTN MoMo / Airtel Money / Bank), amount input prefilled but editable, reference field (required for non-cash), "Customer didn't pay" → reason picker. **Confirm** is disabled until valid. Prepaid orders show "Nothing to collect ✓" |
| **Proof of delivery** | Dispute evidence | Recipient name (required), optional camera photo (upload with size/type limit), optional OTP the customer reads out |
| **Dispatcher board** (Deliveries → Dispatch) | Plan the day | Lanes per driver, unassigned column, drag a card to assign, late badge (30 min past slot), capacity warning per driver per hour |
| **Failed attempt dialog** | Clean reasons | Reason code, note, optional reschedule slot |
| **Cash-up** (Finance → Cash-up) | Close the cash loop | Per driver per day: expected vs counted, variance badge, Confirm (confirmer ≠ driver), history |
| **Delivery zones** (Settings) | Fee + cost | Zone name, fee charged, estimated cost; picking a zone prefills fee on the order and delivery |
| **Order timeline** (order modal) | Transparency | Ready → Assigned → Dispatched → Attempt 1 failed (Not home) → Attempt 2 delivered; with times and actors |
| **Delivery analytics tab** | KPIs from Part B-07 | Date-range filter, driver/zone filters, CSV export |

# PART D — ADJUSTMENTS TO EXISTING UI & FEATURES

- `deliveries-view.tsx`
  - `onMarkReady`, `onDispatch`, `onComplete` → call `markDeliveryReady`, `dispatchDelivery`, `completeDelivery(id, body)`; remove the three `updateDelivery({status})` calls.
  - Replace `window.confirm("Cancel this delivery?")` with the shared `AlertDialog` plus a reason picker.
  - `deliveryPerson` text input → select of users with the driver role (`GET /rbac/users?role=Delivery`).
  - "Complete delivery"/"Complete collection" buttons open the settlement sheet; they are hidden unless `can("deliveries.complete")`.
  - Show `Balance due` and payment status badge on every card; use the shared status colours (ARC/UI consistency).
  - Add columns: Driver, Zone, Attempts, Collected, Cash held.
- `lib/api.ts`: add `markDeliveryReady`, `dispatchDelivery`, `failDelivery`, `assignDelivery`, `submitHandover`, `confirmHandover`; change `completeDelivery(id, body)` signature; add the `Idempotency-Key` header generator for retries.
- `createDelivery` form: fee defaults from the order's `deliveryCharge`/zone; `null` fee bug removed (send `0`).
- Dashboard "Deliveries" tile: count by state with the corrected state machine; pickups excluded from "active deliveries".

---

# PART E — MIGRATIONS, ROLLOUT, TESTS

**Migration:** `031_deliveries_settlement.sql` (above). Depends on `024_payments_hardening.sql` (payments `status`, `delivery_id`) and `022b` (new permission keys). Backfill: set `delivered_at` on orders that are `COMPLETED_DELIVERED`; infer driver user from `delivery_person` where a unique user name match exists, else leave null.

**Rollout order:** (1) interim patch B-06; (2) migration 024/031; (3) handler + API functions; (4) driver app and settlement sheet; (5) cash-up and handovers; (6) analytics and notification rules.

**Tests to add first** (server; extend the vitest setup that already imports `@server/…`)
- `complete` on `PENDING`, `CANCELLED` or already-completed delivery → 409.
- Balance due > 0 and body empty → 422 with `balanceDue`.
- Full collection → exactly one payment with the stated method; `paymentStatus` = `PAID`.
- Partial collection → `PARTIALLY_PAID`, receivable remains, Finance alert emitted.
- `noCollection` without a reason → 422; with reason → delivery completes, order stays unpaid, follow-up raised.
- MoMo without reference → 422.
- Payment write fails → delivery **not** completed (rollback), no audit row.
- Two simultaneous completes → one payment, one 409.
- Driver cannot complete another driver's delivery.
- `PATCH` with `status` → 422; with only `deliveries.view` → 403.
- Rewrite `markorder-paid.test.ts`: assert `markOrderPaid` is no longer called by `/complete`, and that the legacy helper (kept only for admin back-office correction) requires an explicit method and amount.
