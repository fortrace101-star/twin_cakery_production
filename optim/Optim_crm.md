# Optim_crm.md — Customers, Occasions, Reminders, Feedback & Interactions

**Module scope:** customers, addresses, interactions, inquiries (as they feed CRM), occasions/events, recurring reminders, post-delivery follow-up, feedback, and the Customers & CRM screens.
**Code read for this document:** `server/routes/customers.ts`, `customer-reminders.ts`, `feedback.ts`, `public.ts` (customer matching), `order-proposals.ts` (customer matching), `server/database/store.ts` (customers, events, reminders), `server/database/index.new.ts` (write-back), migrations `001_core.sql`, `008_order_history.sql`, `011_order_follow_up.sql`, and `erp-interface-design/src/components/erp/crm-view.tsx`, `crm-panels.tsx`, `dialogs.tsx` (new-order occasion fields).
**Not run:** the app was not executed. Everything below comes from reading the code. Findings tagged **[verify first]** should be reproduced before you invest in the fix.

> **How this file fits with the others.** Each fix here is written as a *unified* change: it lists what changes in CRM and in every other module the change touches (Orders, Production, Finance, Analytics, Notifications/Audit, RBAC, Website, Database). Shared building blocks — the event spine (`domain_events`), the permission middleware, the notification rules engine, the transaction/repository pattern — are defined in `Optim_notifications_audit.md`, `Optim_security_rbac.md` and `Optim_architecture.md`. Migration numbers here use the **070–079** range as placeholders; renumber to follow the other Optim files.

---

## Contents

1. What is already good
2. **Part A — Assessment** (what is wrong or missing, with scenarios)
3. **Part B — Optimization, correction and improvement** (each fix applied at every level)
4. UI: new elements and adjustments to existing screens
5. Consolidated migrations and backfills
6. Tests, rollout order, unverified items

---

## 1. What is already good

- **The human-in-the-loop rule is explicit and enforced.** A reminder only advances through `markReminderContacted`, which needs a staff member (`customer-reminders.ts` header comment). This is the right design for a bakery.
- **Occasions are a first-class concept.** `customer_events` (type, date, recurrence, order link) and `customer_event_reminders` (one live reminder per event) exist, with indexes.
- **Order history keeps immutable customer snapshots** (`order_customer_snapshots`), so a later customer edit doesn't rewrite old orders.
- **The new-order dialog already captures an occasion** (checkbox → type, date, frequency) and creates the event after the order saves.
- **Permissions separate viewing from acting** (`customers.view` vs `customers.interact`), and the customers list uses the shared pagination envelope.
- **Post-delivery follow-up** is tracked on the order (`follow_up_completed_at`, migration 011).

---

# PART A — ASSESSMENT

Severity: **H** = data loss or system-wide failure, **M** = wrong behaviour that costs money or trust, **L** = polish.

## A1. Contacting a reminder immediately creates a duplicate reminder for the same date (H) **[verify first]**

**Where:** `store.markReminderContacted` (store.ts ~1781) sets the reminder to `CONTACTED`, then calls `syncEventReminder(event)`. `syncEventReminder` deletes any non-contacted reminders for the event and then creates a new `PENDING` one for `nextOccurrence(event.eventDate, rule)`. That function returns the next *future* occurrence relative to **today**, not relative to the occurrence just handled.

**What happens.** Reminders are listed up to 30 days ahead, so staff normally contact the customer *before* the occasion. When they do, "next future occurrence" is still the **same upcoming date**, so a brand-new `PENDING` reminder for that same date is created immediately. One-off (`NONE`) events behave the same while their date is in the future. The "roll to next year" only happens if the reminder is marked contacted *after* the occasion date has passed.

**Scenario.** Amara's birthday is 10 Nov. Today is 31 Oct. Sales calls her and marks the reminder "Contacted — will order Monday". The reminder disappears for a moment, then a fresh "Birthday — 10 Nov" reminder appears in the due list again. Whoever opens the list next calls her again. Reminder-conversion numbers are also wrong (two reminders for one occasion).

## A2. Reminders have no lead time of their own (M)

**Where:** `syncEventReminder` sets `nextReminderAt` to 09:00 UTC **on the event day** (`atNineUtc(nextDate)`). The only lead time is the list window `days=30` passed to `dueReminders`, and the UI hard-codes the label "Lead time: 30 days" (`crm-view.tsx` ~451).

**Scenario.** A wedding needs 8–10 weeks of notice, a birthday 2 weeks, a corporate event 4 weeks. With one global 30-day window the wedding reminder appears too late and birthday reminders appear too early. 09:00 UTC is 12:00 noon in Kampala; there is no per-user time zone handling.

## A3. Recurrence handling is incomplete and drifts (M) **[verify first]**

- The new-order dialog offers **WEEKLY / MONTHLY / ANNUAL** with a default of **MONTHLY** (`dialogs.tsx` ~14, ~80). The server type is `"NONE" | "ANNUAL" | "MONTHLY" | "YEARLY"`, and `nextOccurrence` handles `MONTHLY` and treats everything else as yearly. So **WEEKLY silently becomes yearly**, and a birthday defaults to repeating monthly.
- `nextOccurrence` uses `setMonth`/`setFullYear` on the running date. Adding a month to 31 Jan gives 3 Mar, and the drift stays (the date keeps moving forward from the wrong day). A 29 Feb birthday becomes 1 Mar in non-leap years.
- The route does not validate `recurrenceRule` from the request body.

**Scenario.** A customer's 31 Jan "monthly cake" order is reminded on 3 Mar, 3 Apr, 3 May. A 29 Feb birthday is reminded on 1 Mar. A "weekly" order creates a yearly reminder and nobody is told.

## A4. Customer aggregates are never maintained and are editable (M)

**Where:** `totalOrders`, `totalSpend`, `firstOrderDate`, `lastOrderDate` are in the update whitelist (`store.updateCustomer`, line ~221), so anyone with `customers.edit` (Sales) can type any value. A search of the services and routes finds **nothing that updates them** when orders are created, paid or delivered.

**Scenario.** Every customer shows 0 orders and UGX 0 spend unless a person types numbers in. Any "top customers", lifetime value or "overdue to reorder" feature built on those columns is wrong. A salesperson can also inflate a customer's apparent value.

## A5. Feedback: edits are not saved, bad input can break all saves, authorship is spoofable (H) **[verify first]**

**Where:** `feedback.ts`.
- `PATCH /feedback/:id` builds `updated = { ...target, ...patch }` and responds with it, but **never writes it back to the store**; `store.persist()` has nothing new to save. Marking follow-up complete or adding a resolution does not stick, and the patch could also overwrite `id` or `customerId` in the response.
- `POST /feedback` defaults `customerId` to `""`, but `customer_feedback.customer_id` is `NOT NULL REFERENCES customers(id)`. The write-back (`saveCache`) upserts **all** rows in one transaction, so an invalid row in the cache can make **every later flush fail** ("Failed to persist changes") until the process restarts.
- `recordedBy` comes from the request body (default `"admin"`).
- `rating` is not range-checked; `feedback.resolve` exists as a permission but the route uses `feedback.update`.

**Scenario.** Staff open a completed order, record feedback without choosing a customer (or the UI sends an empty id). The cache now holds a feedback row with `customer_id = ''`. The next save of anything (an order, a payment) rolls back, and the user sees an error on unrelated screens. Separately, a manager marks a complaint as "resolved" and sees it succeed, but on refresh it is unresolved.

## A6. Customer addresses are not persisted (M) **[verify first]**

**Where:** The cache loads `customer_addresses` at boot (`index.new.ts` ~366), but there is no mirror entry that writes them back (the write-back list contains no `customer_addresses`, and the generic writer skips nested keys such as `addresses`). `POST /customers` accepts `addresses`.

**Scenario.** Staff save a delivery address on a customer. It displays fine until the server restarts; then it is gone, and the next order has no address to prefill.

## A7. Duplicate customers are easy to create (M)

- Matching exists only in the public paths, and it is an **exact string match** on trimmed phone or lowercase email (`public.ts` `matchCustomer`; same logic in `order-proposals.ts`). "0700 935 916", "+256700935916" and "0700935916" are three different customers.
- `POST /customers` (staff) performs **no duplicate check at all**.
- Because matching trusts a phone number typed by a stranger, a public form submitted with someone else's phone links the new inquiry/proposal to **that customer's record**.

**Scenario.** The same repeat customer exists three times with split order history, so "repeat rate" and reminders are wrong. Someone submitting a website form with a VIP's phone number attaches their notes to the VIP's record.

## A8. No consent, preferences, tags or segments (M)

The `customers` table has `notes` and `source` only. There are no marketing-consent flags per channel, no opt-out, no allergy or dietary fields, no favourite flavours/designs, no tags (VIP, wedding, corporate), and no merge function. The audit's CRM goals (consent, preference notes on new orders and production sheets, segments) cannot be met on this schema.

**Scenario.** A customer with a nut allergy orders again. The allergy lives only in last year's free-text notes; it isn't shown on the new order or the production sheet. A customer who asked not to be messaged still gets reminder calls because nothing records the request.

## A9. Reminders are a list, not a workflow (M)

- Outcomes are **free text** (`outcome`, `followUpNotes`); there are no controlled outcomes (Rebooked, Declined, No answer, Call back later), so conversion cannot be measured.
- No link from a reminder to the order that resulted. No "snooze", no assignment, no message template, no one-click WhatsApp link.
- `deleteCustomerEvent` removes **all** reminders for the event, including `CONTACTED` history. `ON DELETE CASCADE` in migration 008 does the same at the database. Deleting an occasion destroys the evidence of what happened.
- Reminders are not surfaced by any scheduled job; they appear only when someone opens the CRM screen or dashboard.

**Scenario.** After a year of reminders you cannot answer "Did the reminders earn money?" because there are no outcome codes and no order link, and some of the history has been deleted along with edited occasions.

## A10. Source and channel values are inconsistent (L)

The sources used in code include `"Website"`, `"In-house"`, `"WEBSITE"` (inquiries), `"ORDER_FORM"`, `"WALK_IN"`. Free text means analytics by source splits one channel into several buckets.

## A11. UI defects in the occasions panel (M) **[verify first]**

From `crm-view.tsx` `CustomerOccasions` (~402–470):
- The **"Add" button has an empty handler** (`onClick={() => {}}`), so you cannot add an occasion from the customer's Occasions tab. (Occasions can still be created from the new-order dialog.)
- The card shows "**Next reminder:** {the event's original date}", not the real next occurrence.
- Reminder cards display status and outcome but **no actions** (no Contacted, Dismiss, Snooze, Convert).
- A React hook (`useAsync`) is called **after** early `return` statements for `!connected` and `!customer`, so the hook order changes between renders. React warns about this and can throw when the connection or customer state changes.
- "Lead time: 30 days" is hard-coded text.

## A12. Occasion creation can fail silently (L)

In the new-order dialog the occasion call is wrapped in `try { … } catch { /* occasion is advisory */ }`. If it fails, the order saves, no reminder exists, and the user is not told.

---

# PART B — OPTIMIZATION, CORRECTION AND IMPROVEMENT

Layers listed per fix: **DB → Server → API → RBAC → Orders → Production → Finance → Notifications/Audit → Analytics → Website → UI.**

## B0. Shared prerequisites (defined in other Optim files)

- `domain_events` + `emit(tx, …)` (`Optim_notifications_audit.md`).
- Notification rules engine and the `notification_rules` table (`Optim_notifications_audit.md`).
- Direct-SQL repositories with `withTransaction` (`server/database/db.ts` already exports it) for CRM tables; the in-memory store with full-table write-back is the cause of A5/A6 (`Optim_architecture.md`). CRM tables are a good early move because they are moderate-traffic and have clear boundaries.
- Request validation with Zod (already a dependency in the frontend) on every body.

---

## B1. Rebuild reminder scheduling (fixes A1, A2, A3)

**Model change.** Separate the *occurrence* from the *reminder*. One occasion produces one reminder per occurrence date, with its own lead time. Handling an occurrence never regenerates the same one; the next occurrence is created only when the current one is *completed or dismissed* **and** a new occurrence exists after it.

**DB (migration `070_reminder_model.sql`)**

```sql
-- Per-occasion-type defaults and per-event override
CREATE TABLE IF NOT EXISTS occasion_types (
  code TEXT PRIMARY KEY,                       -- 'BIRTHDAY','WEDDING','ANNIVERSARY','GRADUATION','CORPORATE'
  label TEXT NOT NULL,
  default_lead_days INTEGER NOT NULL DEFAULT 21,
  default_recurrence TEXT NOT NULL DEFAULT 'ANNUAL'
    CHECK (default_recurrence IN ('NONE','WEEKLY','MONTHLY','ANNUAL')),
  active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO occasion_types (code,label,default_lead_days,default_recurrence) VALUES
  ('BIRTHDAY','Birthday',21,'ANNUAL'),
  ('ANNIVERSARY','Anniversary',28,'ANNUAL'),
  ('WEDDING','Wedding',70,'NONE'),
  ('GRADUATION','Graduation',28,'ANNUAL'),
  ('CORPORATE','Corporate event',35,'ANNUAL'),
  ('OTHER','Other',21,'NONE')
ON CONFLICT DO NOTHING;

ALTER TABLE customer_events ADD COLUMN IF NOT EXISTS occasion_code TEXT REFERENCES occasion_types(code);
ALTER TABLE customer_events ADD COLUMN IF NOT EXISTS lead_days INTEGER;            -- NULL = use the type default
ALTER TABLE customer_events ADD COLUMN IF NOT EXISTS recipient_name TEXT NOT NULL DEFAULT '';  -- "Mum", "Amara"
ALTER TABLE customer_events DROP CONSTRAINT IF EXISTS chk_event_recurrence;
ALTER TABLE customer_events ADD CONSTRAINT chk_event_recurrence
  CHECK (recurrence_rule IN ('NONE','WEEKLY','MONTHLY','ANNUAL','YEARLY'));  -- YEARLY kept as a legacy alias

-- Reminder is per occurrence, with controlled outcomes and order link
ALTER TABLE customer_event_reminders ADD COLUMN IF NOT EXISTS remind_from DATE;      -- date - lead_days
ALTER TABLE customer_event_reminders ADD COLUMN IF NOT EXISTS snoozed_until DATE;
ALTER TABLE customer_event_reminders ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE customer_event_reminders ADD COLUMN IF NOT EXISTS outcome_code TEXT
  CHECK (outcome_code IN ('REBOOKED','DECLINED','NO_ANSWER','CALL_BACK','NOT_INTERESTED','OPTED_OUT'));
ALTER TABLE customer_event_reminders ADD COLUMN IF NOT EXISTS resulting_order_id TEXT REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE customer_event_reminders ADD COLUMN IF NOT EXISTS channel TEXT;          -- WHATSAPP / PHONE / SMS / EMAIL
ALTER TABLE customer_event_reminders ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

-- One reminder per event per occurrence date. This is what prevents the A1 duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS ux_reminder_event_date
  ON customer_event_reminders(event_id, reminder_for_date);

-- History must survive deleting/editing an occasion: stop cascading.
ALTER TABLE customer_event_reminders DROP CONSTRAINT IF EXISTS customer_event_reminders_event_id_fkey;
ALTER TABLE customer_event_reminders ADD CONSTRAINT customer_event_reminders_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES customer_events(id) ON DELETE RESTRICT;
-- Events are archived (status='ARCHIVED'), never deleted.
```

**Server (`server/services/reminders.service.ts`)**

```ts
import { addMonths, addYears, addWeeks, formatISO, isAfter, parseISO } from "date-fns";

/** Next occurrence strictly AFTER `after`, month-end safe. Pure function → unit-testable. */
export function nextOccurrenceAfter(eventDate: string, rule: string, after: string): string | null {
  if (rule === "NONE") return isAfter(parseISO(eventDate), parseISO(after)) ? eventDate : null;
  const base = parseISO(eventDate);
  const step = (n: number) =>
    rule === "WEEKLY"  ? addWeeks(base, n)
  : rule === "MONTHLY" ? addMonths(base, n)       // date-fns clamps: 31 Jan + 1 mo = 28/29 Feb
  :                      addYears(base, n);       // 29 Feb + 1 yr = 28 Feb
  for (let n = 0; n < 5000; n++) {                // step from the ORIGINAL date: no drift
    const d = step(n);
    if (isAfter(d, parseISO(after))) return formatISO(d, { representation: "date" });
  }
  return null;
}

export async function scheduleNextReminder(tx: TxClient, eventId: string, afterDate: string) {
  const { rows: [e] } = await tx.query(
    `SELECT e.*, COALESCE(e.lead_days, t.default_lead_days, 21) AS lead
       FROM customer_events e LEFT JOIN occasion_types t ON t.code = e.occasion_code
      WHERE e.id=$1 AND e.status='ACTIVE' FOR UPDATE OF e`, [eventId]);
  if (!e) return;
  const next = nextOccurrenceAfter(e.event_date, e.recurrence_rule, afterDate);
  if (!next) return;
  await tx.query(
    `INSERT INTO customer_event_reminders
       (id, event_id, customer_id, order_id, event_type, reminder_for_date, remind_from,
        next_reminder_at, status)
     VALUES ($1,$2,$3,$4,$5,$6::date,($6::date - $7::int),
             (($6::date - $7::int)::timestamp AT TIME ZONE 'Africa/Kampala') + interval '9 hours','PENDING')
     ON CONFLICT (event_id, reminder_for_date) DO NOTHING`,
    [makeId("crem"), e.id, e.customer_id, e.order_id, e.event_type, next, e.lead]);
}
```

**Completing a reminder** (replaces `markReminderContacted`'s call to `syncEventReminder`):

```ts
export async function completeReminder(id: string, userId: string, input: CompleteInput) {
  return withTransaction(async (tx) => {
    const { rows: [r] } = await tx.query(`SELECT * FROM customer_event_reminders WHERE id=$1 FOR UPDATE`, [id]);
    if (!r) throw new NotFoundError("Reminder not found");
    if (r.status === "CONTACTED") return r;                       // idempotent
    await tx.query(
      `UPDATE customer_event_reminders
          SET status='CONTACTED', contacted_by=$2, last_contacted_at=now(),
              outcome_code=$3, outcome=$4, follow_up_notes=$5, channel=$6,
              attempts = attempts + 1, updated_at=now()
        WHERE id=$1`,
      [id, userId, input.outcomeCode, input.outcome ?? "", input.followUpNotes ?? "", input.channel ?? null]);
    // Next occurrence is computed AFTER the one just handled — this is the fix for A1.
    await scheduleNextReminder(tx, r.event_id, r.reminder_for_date);
    if (input.outcomeCode === "OPTED_OUT") await recordConsent(tx, r.customer_id, "ALL", false, userId);
    await emit(tx, { type: "crm.reminder_completed", entityType: "customer_event_reminder",
      entityId: id, actorId: userId, customerId: r.customer_id, data: { outcome: input.outcomeCode } });
    return { id, status: "CONTACTED" };
  });
}
```

**API.**

| Endpoint | Change |
|---|---|
| `GET /customer-reminders?from=&to=&status=&assignedTo=` | Due = `remind_from <= today` and not snoozed/contacted; `days` kept for the legacy caller. |
| `PATCH /customer-reminders/:id/contacted` | Body validated (`outcomeCode` required). Uses `completeReminder`. |
| `PATCH /customer-reminders/:id/snooze` | `{ until }`. |
| `PATCH /customer-reminders/:id/assign` | `{ userId }`. |
| `POST /customer-reminders/:id/convert` | Creates a **draft order** (B4) and sets `resulting_order_id`. |
| `POST /customers/:id/events` | Validate `recurrenceRule ∈ {NONE,WEEKLY,MONTHLY,ANNUAL}`; accept `occasionCode`, `leadDays`, `recipientName`. |
| `DELETE /customers/:id/events/:eventId` | **Removed**; replaced by `PATCH … { status: "ARCHIVED" }`, which cancels only the *pending* reminder. |

**RBAC.** Keep `customers.view` / `customers.interact`. Add `customers.reminders_assign` (Sales Manager/Admin) and `customers.reminders_settings` (edit occasion types and lead times).

**Notifications (rules, `Optim_notifications_audit.md`).**
- `crm.reminder_due` — a scheduled job runs daily at 08:00 Kampala time and creates **one digest notification per assignee**: "5 customer reminders are due this week" with a link to the filtered list. It never contacts customers.
- Reminder due within 3 days and still `PENDING` → escalate to the Sales Manager.
- `crm.reminder_completed` with `OPTED_OUT` → Admin (so consent changes are visible).

**Analytics (`Optim_analytics.md`).** `fact_reminders` (occurrence date, lead days, outcome code, channel, attempts, order id). Metrics: reminders due/handled on time, *conversion rate* (`REBOOKED` / contacted), revenue from reminder-sourced orders, by occasion type and by message template.

**Orders.** `orders.customer_event_id` (B4) so an order records which occasion it came from, and the reminder's `resulting_order_id` links back.

**Audit.** `crm.reminder_completed`, `crm.reminder_snoozed`, `crm.event_archived`.

**UI.** See §4 (reminder inbox, outcome dialog, snooze, convert).

**Scenario after the fix.** Amara's birthday is 10 Nov with a 21-day lead. Her reminder surfaces on 20 Oct. Sales calls on 31 Oct, selects *Rebooked*, and the reminder closes; the *next* reminder is created for 10 Nov **next year** and no duplicate appears. A 31 Jan monthly order is reminded on 28 Feb, then 31 Mar (no drift). A 29 Feb birthday is reminded on 28 Feb in common years.

---

## B2. Make customer aggregates derived, not editable (fixes A4)

**DB (migration `071_customer_metrics.sql`)** — compute from facts; keep the columns for compatibility but stop trusting them:

```sql
CREATE OR REPLACE VIEW v_customer_metrics AS
SELECT c.id AS customer_id,
       COUNT(o.id) FILTER (WHERE o.status NOT IN ('CANCELLED','INQUIRY'))                  AS total_orders,
       COALESCE(SUM(o.total) FILTER (WHERE o.status = 'COMPLETED_DELIVERED'), 0)          AS delivered_value,
       COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'COMPLETED'), 0)                   AS paid_value,
       MIN(o.created_at) FILTER (WHERE o.status NOT IN ('CANCELLED','INQUIRY'))           AS first_order_at,
       MAX(o.created_at) FILTER (WHERE o.status NOT IN ('CANCELLED','INQUIRY'))           AS last_order_at
  FROM customers c
  LEFT JOIN orders o   ON o.customer_id = c.id
  LEFT JOIN payments p ON p.order_id = o.id
 GROUP BY c.id;
```

> Confirm the exact order-status and payment-status spellings in `types.ts` and `006_finance_delivery.sql` before using this view; the values above follow the statuses mentioned in the audit.

**Server.** Remove `totalOrders`, `totalSpend`, `firstOrderDate`, `lastOrderDate`, `feedbackSummary` from `updateCustomer`'s whitelist. `GET /customers` and `GET /customers/:id` join `v_customer_metrics`. If the list gets slow, convert the view to a materialized view refreshed by the order/payment events, or maintain a `customer_stats` row inside the same transaction that changes the order (`Optim_architecture.md`).
**Finance:** `paid_value` ties customers to real payments (A1/A2 in `Optim_finance.md` fix what counts as paid), so lifetime value is margin-based when `Optim_production.md` job costing is in place (`ltv = Σ margin`).
**Analytics:** repeat rate, LTV, RFM, "overdue to reorder" read from the same view.
**RBAC:** spend/LTV visible only with `customers.view_value` (new; Sales Manager, Finance, Admin); other roles see counts.
**UI:** the customer header shows *Orders / Total spend / Last order / Average gap* and no longer offers editing for them.

---

## B3. Fix feedback (fixes A5)

**API rewrite (`feedback.ts`):**

```ts
const FeedbackBody = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1).optional(),           // derived from the order when omitted
  rating: z.number().int().min(1).max(5),
  type: z.enum(["GENERAL","COMPLAINT","COMPLIMENT","SUGGESTION"]).default("GENERAL"),
  comment: z.string().max(2000).default(""),
  followUpRequired: z.boolean().default(false),
  productIds: z.array(z.string()).default([]),
  jobId: z.string().optional(),                       // link to production job (B6 of Optim_production.md)
});

router.post("/", required("feedback.create"), (req, res) => {
  const b = FeedbackBody.parse(req.body);
  const order = store.findOrder(b.orderId);
  if (!order) throw new ValidationError("Unknown order");
  const customerId = order.customerId;                // never trust the body
  const record = store.createCustomerFeedback({
    ...b, customerId, productIds: b.productIds.join(","), recordedBy: actor(req),
  });
  res.status(201).json(record);
});

router.patch("/:id", required("feedback.update"), (req, res) => {
  const patch = FeedbackPatch.parse(req.body);        // only: comment, resolution, followUpRequired, followUpCompleted
  const updated = store.updateCustomerFeedback(String(req.params.id), patch, actor(req)); // NEW store method that mutates the cached row
  if (!updated) throw new NotFoundError("Feedback not found");
  res.json(updated);
});

router.post("/:id/resolve", required("feedback.resolve"), (req, res) => { /* sets resolution, resolved_by, resolved_at */ });
```

**DB (migration `072_feedback_integrity.sql`)**

```sql
ALTER TABLE customer_feedback ADD CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE customer_feedback ADD COLUMN IF NOT EXISTS job_id TEXT;
ALTER TABLE customer_feedback ADD COLUMN IF NOT EXISTS baker_staff_id TEXT;
ALTER TABLE customer_feedback ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE customer_feedback ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE customer_feedback ADD COLUMN IF NOT EXISTS resolution_minutes INTEGER;
-- Repair rows that would break the FK, then enforce
DELETE FROM customer_feedback WHERE customer_id = '';          -- inspect first: SELECT * … WHERE customer_id = '';
-- (FK already exists from 001_core.sql)
```

**Server hygiene.** Add a guard in the write-back layer (`Optim_architecture.md`): validate FK-sensitive records *before* pushing to the cache, so one bad row can never poison later flushes. Until then, the Zod schema above is the guard.
**Production / Quality:** feedback linked to `job_id` and `baker_staff_id` feeds quality metrics (complaint rate per baker/product).
**Notifications:** `COMPLAINT` with `rating <= 2` → Admin and Production Manager immediately (severity high); unresolved after 48 h → escalate; resolved → creator.
**Analytics:** satisfaction by product, complaint rate, time to resolve.
**Audit:** `feedback.created`, `feedback.resolved` events.
**UI:** feedback form defaults the customer from the order, shows a star control (1–5), and the complaint list has a **Resolve** action with a required resolution text.

**Scenario after the fix.** Recording feedback without a customer works because the customer comes from the order; the cache can never hold an orphan row. A manager resolves a complaint and the resolution is still there tomorrow.

---

## B4. Persist addresses; one customer, one place for contact data (fixes A6, A7)

**Server.** Add `customer_addresses` to the write-back mirror list **or** (preferred) read/write addresses through a small repository with direct SQL:

```ts
export const addressRepo = {
  list: (customerId: string) =>
    query(`SELECT * FROM customer_addresses WHERE customer_id=$1 ORDER BY is_default DESC, created_at`, [customerId]),
  upsert: (a: Address) => withTransaction(async (tx) => {
    if (a.isDefault)
      await tx.query(`UPDATE customer_addresses SET is_default=FALSE WHERE customer_id=$1`, [a.customerId]);
    return tx.query(
      `INSERT INTO customer_addresses (id,customer_id,label,line1,line2,city,county,postal_code,country,is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET label=$3,line1=$4,line2=$5,city=$6,county=$7,postal_code=$8,
                                      country=$9,is_default=$10,updated_at=now()`,
      [a.id, a.customerId, a.label, a.line1, a.line2, a.city, a.county, a.postalCode, a.country, a.isDefault]);
  }),
};
```

Endpoints `GET/POST/PATCH/DELETE /customers/:id/addresses` (permission `customers.edit`). Delivery orders pre-fill from the default address; Deliveries (`Optim_deliveries.md`) reads the same table.

**Normalised contact keys (migration `073_customer_identity.sql`)**

```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_norm TEXT;
UPDATE customers SET email_norm = lower(btrim(email)) WHERE email <> '';
-- Backfill phone_e164 with an application script (see below), because the rules live in code.
CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_phone ON customers(phone_e164) WHERE phone_e164 IS NOT NULL AND status <> 'Merged';
CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_email ON customers(email_norm) WHERE email_norm IS NOT NULL AND status <> 'Merged';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS merged_into TEXT REFERENCES customers(id);
```

> Before creating the unique indexes, run a duplicate report (`SELECT phone_e164, count(*) … HAVING count(*) > 1`) and merge duplicates first, otherwise the index creation will fail.

```ts
// server/utils/phone.ts — Uganda-first normaliser (extend for other countries)
export function toE164(raw: string, defaultCountry = "256"): string | null {
  const d = raw.replace(/[^\d+]/g, "");
  if (!d) return null;
  if (d.startsWith("+")) return d;
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (d.startsWith("0")) return "+" + defaultCountry + d.slice(1);
  if (d.startsWith(defaultCountry)) return "+" + d;
  return "+" + defaultCountry + d;
}
```

**Server.** One function `findOrCreateCustomer({name, phone, email, source})` used by *every* creation path (staff POST, public inquiry, order proposal confirm, new-order dialog). It normalises, looks up by `phone_e164` then `email_norm`, and returns `{ customer, matched: boolean, conflictFields }`.
**Merge.** `POST /customers/:id/merge { intoId }` (permission `customers.merge`, Admin/Sales Manager): in one transaction, repoint `orders`, `order_customer_snapshots` (kept as they are), `customer_events`, `customer_event_reminders`, `customer_interactions`, `inquiries`, `customer_feedback`, `order_proposals`, `website_users.customer_id`; set `merged_into` and `status='Merged'`; write a `crm.customer_merged` event with the moved row counts.
**Duplicate hint on create.** `POST /customers` returns `409 { matches: [...] }` unless `?confirmDistinct=true`.
**Public safety (see `Optim_website.md`).** The public path **does not attach to an existing record automatically**: it creates the inquiry with `match_candidate_id`, and a staff member confirms the link.
**Notifications:** `crm.duplicate_suspected` (digest) → Sales Manager.
**Analytics:** repeat rate and LTV become trustworthy once identities are unique.
**UI:** a **Possible duplicates** banner on the customer detail with a *Merge…* dialog (side-by-side fields, choose survivor); the create-customer dialog shows live matches as the phone is typed.

---

## B5. Consent, preferences, tags and segments (fixes A8)

**DB (migration `074_consent_preferences.sql`)**

```sql
CREATE TABLE IF NOT EXISTS customer_consents (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('WHATSAPP','SMS','EMAIL','PHONE','ALL')),
  purpose TEXT NOT NULL DEFAULT 'MARKETING' CHECK (purpose IN ('MARKETING','REMINDERS','SERVICE')),
  granted BOOLEAN NOT NULL,
  source TEXT NOT NULL,                 -- 'WEBSITE_FORM','IN_PERSON','WHATSAPP_REPLY','STAFF'
  evidence TEXT NOT NULL DEFAULT '',    -- e.g. form version, message id
  recorded_by TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Append-only: the latest row per (customer, channel, purpose) is the current state
CREATE INDEX IF NOT EXISTS ix_consent_lookup ON customer_consents(customer_id, channel, purpose, recorded_at DESC);

CREATE TABLE IF NOT EXISTS customer_preferences (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  allergies TEXT[] NOT NULL DEFAULT '{}',          -- 'nuts','eggs','gluten','dairy','other:…'
  dietary TEXT[] NOT NULL DEFAULT '{}',            -- 'vegetarian','halal','eggless'
  favourite_flavours TEXT[] NOT NULL DEFAULT '{}',
  design_notes TEXT NOT NULL DEFAULT '',
  delivery_notes TEXT NOT NULL DEFAULT '',
  updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_tags (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tag TEXT NOT NULL, added_by TEXT NOT NULL, added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, tag)
);
```

**Server.**
- `hasConsent(customerId, channel, purpose)` reads the latest consent row; reminders and any future outbound template **check it**, and the UI disables the *Send WhatsApp* button with a reason when consent is absent.
- Preferences are loaded into the **new-order form** (a coloured allergy banner), copied to the order (`orders.allergy_notes`, `orders.dietary_notes` — migration below) and printed on the **production sheet** (`Optim_production.md`) and delivery slip.
- Tags: manual (VIP, Wedding, Corporate) plus computed segments (below).

**Orders (migration `074b`).**

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS allergy_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dietary_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_event_id TEXT REFERENCES customer_events(id);
```

**Computed segments** (a nightly job, results stored so the UI is fast):

```sql
CREATE TABLE IF NOT EXISTS customer_segments (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  rfm_recency INT, rfm_frequency INT, rfm_monetary INT,
  segment TEXT,                    -- 'CHAMPION','LOYAL','AT_RISK','NEW','LAPSED'
  expected_gap_days INT, next_expected_order DATE, computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RBAC.** `customers.view_preferences` (all customer-facing roles including Production, so bakers see allergies), `customers.edit_consent` (Sales, Admin), `customers.view_value` (B2).
**Production / Deliveries:** allergy banner on the production sheet and the driver view.
**Notifications:** an order created for a customer with allergies → Production (info) with the allergy text; consent withdrawn → Admin.
**Audit:** consent changes are append-only rows plus `crm.consent_changed` events.
**Analytics:** share of customers with consent per channel; segment sizes; at-risk revenue.
**Website:** the enquiry/order forms get a consent checkbox that writes a consent row (`Optim_website.md`).
**UI:** Customer detail gets **Preferences** and **Consent** cards (see §4).

---

## B6. Reminder-to-order conversion (fixes A9)

**API:** `POST /customer-reminders/:id/convert`

```ts
router.post("/:id/convert", required("orders.create"), async (req, res) => {
  const draft = await withTransaction(async (tx) => {
    const r = await getReminderForUpdate(tx, String(req.params.id));
    const lastOrder = r.order_id ? await loadOrderWithItems(tx, r.order_id) : null;
    // Copy last year's cake as a DRAFT (status 'INQUIRY'); prices are re-read from the live catalogue, not copied.
    const items = lastOrder ? await repriceFromCatalogue(tx, lastOrder.items) : [];
    const order = await createDraftOrder(tx, {
      customerId: r.customer_id, customerEventId: r.event_id,
      requiredBy: r.reminder_for_date, items,
      notes: `Rebook from ${r.event_type} reminder`, createdBy: actor(req),
    });
    await tx.query(`UPDATE customer_event_reminders SET resulting_order_id=$2, outcome_code='REBOOKED',
                    status='CONTACTED', contacted_by=$3, last_contacted_at=now() WHERE id=$1`,
                   [r.id, order.id, actor(req)]);
    await scheduleNextReminder(tx, r.event_id, r.reminder_for_date);
    return order;
  });
  res.status(201).json(draft);
});
```

**Orders:** the new draft appears in the normal confirm → produce → deliver pipeline; price comes from the server (`Optim_orders.md`), so old prices are never reused blindly. Preferences from B5 pre-fill allergy and dietary notes.
**Finance:** nothing posts for a draft; the first invoice/deposit appears when the order is confirmed (`Optim_finance.md`).
**Analytics:** revenue from reminder-sourced orders (`customer_event_id`), by occasion type; time from reminder to order.
**UI:** the reminder card gets **Convert to order**, which opens the order dialog pre-filled and editable.

---

## B7. Message templates and one-click WhatsApp (keeps the human in the loop)

**DB (migration `075_message_templates.sql`)**

```sql
CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL,           -- 'BIRTHDAY_REBOOK','WEDDING_CHECKIN'
  occasion_code TEXT REFERENCES occasion_types(code),
  channel TEXT NOT NULL CHECK (channel IN ('WHATSAPP','SMS','EMAIL')),
  language TEXT NOT NULL DEFAULT 'en',
  body TEXT NOT NULL,                                       -- "Hi {{firstName}}, last year we made {{recipient}}'s {{occasion}} cake…"
  active BOOLEAN NOT NULL DEFAULT TRUE, updated_by TEXT, updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS outbound_messages (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id),
  reminder_id TEXT REFERENCES customer_event_reminders(id),
  template_id TEXT REFERENCES message_templates(id),
  channel TEXT NOT NULL, rendered_body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PREPARED','OPENED','SENT_MANUALLY','FAILED')),
  prepared_by TEXT NOT NULL, prepared_at TIMESTAMPTZ DEFAULT now()
);
```

**Server.** `GET /customer-reminders/:id/message?templateId=` renders the template (escape values; fall back to blank for missing variables, never print `{{…}}`) and returns `{ text, waLink }` where `waLink = https://wa.me/<digits of phone_e164>?text=<encodeURIComponent(text)>`. The call **requires consent** for the channel, writes an `outbound_messages` row with `status='PREPARED'`, and the UI marks it `OPENED` when the link is clicked. A real provider (WhatsApp Business API, SMS gateway) can be slotted in later behind a `NotificationChannel` interface (`Optim_notifications_audit.md`) without changing the screens.
**RBAC:** `customers.send_message` (Sales, Admin).
**Audit/Analytics:** `crm.message_prepared`; templates tracked in reminder conversion (which wording rebooks best).
**UI:** reminder card gets **Message** (template picker, preview, Copy / Open WhatsApp).

---

## B8. Customer timeline and interactions

**Server.** `GET /customers/:id/timeline?types=&from=&to=&cursor=` returns a merged, time-ordered list from one SQL `UNION ALL` over: inquiries, quotations, orders (+ status changes), payments, deliveries, feedback, interactions, reminders and messages. Each item: `{ at, type, title, summary, entity: { type, id }, actor }`. No new tables are needed; with `domain_events` in place (B0) the timeline becomes a simple query over events filtered by `customer_id`.

```sql
SELECT occurred_at AS at, event_type AS type, entity_type, entity_id, actor_id, data
  FROM domain_events
 WHERE customer_id = $1
   AND event_type = ANY($2)
 ORDER BY occurred_at DESC
 LIMIT 50 OFFSET $3;
```

**Interactions.** Add `outcome_code`, `next_follow_up_at`, and `assigned_to` to `customer_interactions` so follow-ups can be scheduled rather than relying on `follow_up_required` alone:

```sql
ALTER TABLE customer_interactions ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;
ALTER TABLE customer_interactions ADD COLUMN IF NOT EXISTS assigned_to TEXT;
```

**Notifications:** follow-up due today → assignee (digest); post-delivery follow-up pending > 48 h → Sales Manager.
**RBAC:** timeline items from Finance (payments) are shown only with `payments.view`; Production items only with `production.view`.
**UI:** see §4 (timeline tab).

---

## B9. Segments, VIP rules and risk

Nightly job `computeCustomerSegments()`:

```ts
// Pseudocode — reads v_customer_metrics (B2), writes customer_segments (B5)
const gap = avgGapDays(orderDates);                         // median is more robust
const overdueBy = daysSince(lastOrder) - gap;
segment =
  orders >= 5 && daysSince(lastOrder) <= 90                 ? "CHAMPION" :
  orders >= 2 && daysSince(lastOrder) <= 180                ? "LOYAL"    :
  orders >= 2 && overdueBy > gap * 0.5                      ? "AT_RISK"  :
  orders === 1 && daysSince(lastOrder) <= 60                ? "NEW"      : "LAPSED";
```

Thresholds live in a settings row so the owner can tune them.
**Notifications:** VIP/Champion places an order → Admin (info); an *AT_RISK* customer with a high value → weekly digest to Sales.
**Analytics:** segment sizes, revenue share by segment, concentration of the top 10 customers, expected re-order interval, "overdue to reorder" list.
**UI:** segment chips in the customers table and a "Needs attention" list on the CRM dashboard.

---

## B10. Normalise sources and channels (fixes A10)

```sql
CREATE TABLE IF NOT EXISTS lead_sources (code TEXT PRIMARY KEY, label TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO lead_sources VALUES
  ('WEBSITE','Website',TRUE),('WHATSAPP','WhatsApp',TRUE),('INSTAGRAM','Instagram',TRUE),
  ('REFERRAL','Referral',TRUE),('WALK_IN','Walk-in',TRUE),('PHONE','Phone call',TRUE),('REPEAT','Repeat customer',TRUE)
ON CONFLICT DO NOTHING;
-- Backfill with a mapping: 'Website'|'WEBSITE'|'ORDER_FORM' -> WEBSITE, 'In-house' -> WALK_IN, others -> review list
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source_code TEXT REFERENCES lead_sources(code);
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS source_code TEXT REFERENCES lead_sources(code);
```

Server validates `source` against the table; the UI uses a dropdown. Analytics groups by `source_code`.

---

## B11. Fix the occasions UI defects (fixes A11, A12)

See §4.2. In code terms:

```tsx
// crm-view.tsx — move hooks above every early return
function CustomerOccasions({ name, connected }: Props) {
  const ctx = useCustomerContext(name, connected);
  const customerId = ctx.customer?.id;
  const { data: reminders } = useAsync<ServerEventReminder[]>(
    () => connected && customerId ? listEventReminders({ customerId }) : Promise.resolve([]),
    [customerId, connected],
  );                                                     // hook runs on every render, in the same order
  if (!connected) return <p className="crm-note">Sign in to view occasions and reminders.</p>;
  if (!ctx.customer) return <p className="crm-note">No customer record found.</p>;
  …
}
```

Also: replace the empty `onClick={() => {}}` with `setAddOpen(true)` opening a shared `OccasionDialog` (the same one used in the new-order dialog); show a visible error toast when occasion creation fails after an order saved (A12), with a **Retry** link; compute "Next reminder" from the reminder row (`remind_from`, `reminder_for_date`), not the event's original date; show the lead time per event ("Reminds 21 days before").

---

# 4. UI — new elements and adjustments

## 4.1 New UI elements

| Element | Where | Behaviour |
|---|---|---|
| **Reminder inbox** | CRM → new tab "Reminders" (before Occasions) | Tabs: *Due now · This week · Snoozed · Done*. Columns: customer, occasion + recipient, occasion date, "Remind from", assignee, last contact. Filters by assignee and occasion type; saved views. |
| **Reminder actions** | Each reminder row/card | **Message** (template + WhatsApp link), **Call** (`tel:` link), **Log outcome** (dialog with outcome codes), **Snooze** (date picker), **Assign**, **Convert to order**. |
| **Outcome dialog** | Reminder → Log outcome | Outcome code (required), channel, notes, optional "next follow-up". Selecting *Opted out* also records consent withdrawal. |
| **Occasion dialog** (shared) | Customer → Occasions → Add; also new-order dialog | Occasion type (from `occasion_types`), recipient name, date, repeat (None/Weekly/Monthly/Annual; defaults from the type), lead days override. |
| **Customer timeline tab** | Customer detail | Single scrolling timeline with filter chips (Orders, Payments, Messages, Feedback, Calls, Reminders). Each entry deep-links to its record. |
| **Preferences & allergies card** | Customer Overview | Chips for allergies and dietary needs (red for allergies), favourite flavours, design/delivery notes. Appears as a banner in the new-order dialog. |
| **Consent card** | Customer Overview | Per-channel toggles with "who/when/how" and an append-only history link. |
| **Tags & segment chips** | Customers table + header | VIP, Wedding, Corporate, plus computed segment. Bulk tag action. |
| **Duplicate banner + Merge dialog** | Customer detail / create dialog | Shows probable duplicates; side-by-side field picker; summary of what will move. |
| **Customer metrics strip** | Customer header | Orders, spend, last order, average gap, next expected order (read-only, derived). |
| **Template manager** | Settings → CRM | CRUD for message templates, with variable chips and a live preview. |
| **CRM dashboard** | CRM → Overview | Cards: reminders due (7/30 days), conversion rate, at-risk customers, complaints open, follow-ups due; each card links to the filtered list. |
| **Feedback resolve dialog** | Feedback list | Requires resolution text; shows time-to-resolve. |

## 4.2 Adjustments to existing UI

| Existing element (file) | Change |
|---|---|
| Occasions tab **Add** button (`crm-view.tsx` ~427) | Wire to the shared Occasion dialog (currently an empty handler). |
| "Next reminder:" label (~441) | Show the real next occurrence and remind-from date. |
| "Lead time: 30 days" text (~451) | Show the actual per-event lead time. |
| `useAsync` call after early returns (~410) | Move above the returns (B11). |
| Reminder cards (`crm-view.tsx`, `crm-panels.tsx` `RemindersPanel`) | Add the actions listed above; show outcome code chips instead of raw text. |
| New-order dialog occasion block (`dialogs.tsx` ~79–80) | Default recurrence by occasion type (Birthday → Annual, Wedding → None), remove the WEEKLY option unless the server supports it, add recipient name, surface errors from event creation with a retry. |
| Customers table | Add segment and tag chips, a consent icon, and sorting by last order/spend using the derived metrics. |
| Customer create dialog | Live duplicate check by normalised phone/email; source dropdown from `lead_sources`. |
| Feedback panel (`FeedbackPanelForm`) | Customer from order, star control 1–5 (already exists), job/baker selector, resolve action. |
| Customer header | Metrics become read-only and derived; remove any edit affordance for totals. |
| Print (`CustomerProfileHeader` print) | Include allergies and preferences on the printed profile. |

---

# 5. Consolidated migrations and backfills

| # | File | Contents |
|---|---|---|
| 070 | `070_reminder_model.sql` | Occasion types, lead days, recipient, controlled outcomes, `ux_reminder_event_date`, no cascade (B1) |
| 071 | `071_customer_metrics.sql` | `v_customer_metrics` (B2) |
| 072 | `072_feedback_integrity.sql` | Rating check, job/baker links, resolve fields (B3) |
| 073 | `073_customer_identity.sql` | `phone_e164`, `email_norm`, merge fields, partial unique indexes (B4) — **after duplicate clean-up** |
| 074 | `074_consent_preferences.sql` | Consents, preferences, tags, segments, order allergy/dietary/event link (B5) |
| 075 | `075_message_templates.sql` | Templates and outbound messages (B7) |
| 076 | `076_interactions_followup.sql` | Interaction follow-up columns (B8) |
| 077 | `077_lead_sources.sql` | `lead_sources` and source codes (B10) |
| 078 | `078_crm_rbac.sql` | Permissions (below) |

**New permission keys (078).**

```sql
INSERT INTO permissions (id, key) VALUES
  ('perm-cus-merge','customers.merge'),
  ('perm-cus-value','customers.view_value'),
  ('perm-cus-prefs','customers.view_preferences'),
  ('perm-cus-consent','customers.edit_consent'),
  ('perm-cus-send','customers.send_message'),
  ('perm-cus-rem-assign','customers.reminders_assign'),
  ('perm-cus-rem-settings','customers.reminders_settings')
ON CONFLICT (key) DO NOTHING;
-- Suggested grants: Sales → send_message, edit_consent, view_preferences; Sales Manager/Admin → all;
-- Production → view_preferences (allergies on production sheets); Finance → view_value.
```

**Backfills (run once, inside a transaction, then verify counts).**
1. **Reminders:** for every `customer_events` row with `status='ACTIVE'`, delete stale `PENDING` reminders and run `scheduleNextReminder` once. Remove *duplicate* `PENDING` reminders first (keep the earliest per `(event_id, reminder_for_date)`) so the unique index can be created: `DELETE FROM customer_event_reminders a USING customer_event_reminders b WHERE a.event_id=b.event_id AND a.reminder_for_date=b.reminder_for_date AND a.id > b.id AND a.status='PENDING';`
2. **Existing WEEKLY events** (if any were created): they were treated as yearly; list them (`WHERE recurrence_rule NOT IN ('NONE','ANNUAL','YEARLY','MONTHLY')`) and let staff confirm the intended recurrence.
3. **Feedback with empty customer:** inspect, derive the customer from `order_id`, then constrain.
4. **Phone/email normalisation:** run `toE164` over all customers, produce a duplicate report, merge (B4), then create the unique indexes.
5. **Customer totals:** recompute from the view; log how many differ from the stored values (this tells you how wrong the manual numbers were).
6. **Addresses:** nothing to recover from the database for addresses that were only ever in memory; check `customer_addresses` row counts versus customers you expect to have addresses.

---

# 6. Tests, rollout and unverified items

## Tests to write first

1. `nextOccurrenceAfter`: 31 Jan monthly → 28/29 Feb → 31 Mar; 29 Feb annual; `NONE` in the past returns null; weekly; never returns a date ≤ `after`.
2. `completeReminder` on a future occurrence creates **exactly one** next reminder (the following year) and not a duplicate for the same date; calling it twice is idempotent.
3. The unique index rejects a second reminder for the same `(event_id, reminder_for_date)`.
4. Deleting an occasion is not possible; archiving cancels only the pending reminder and keeps history.
5. `PATCH /feedback/:id` persists across a simulated restart; `POST /feedback` with no customer derives it from the order; an unknown order is a 4xx.
6. A poisoned row cannot reach the cache (FK-sensitive validation) and a normal save still succeeds afterwards.
7. Phone normalisation: `0700935916`, `+256700935916`, `256 700 935 916` all match one customer; the public path creates a *candidate link*, not an automatic match.
8. Merge moves all child rows and leaves the merged customer unreachable from lists.
9. Consent: `convert`/`message` endpoints refuse when consent is absent; `OPTED_OUT` writes a consent row.
10. `customers.edit` cannot write `totalSpend`; the list returns derived values.

## Suggested order of work

1. **B3** (feedback no-op + FK poison) and **B1** (duplicate reminders): these are bugs, do them first.
2. **B2** (derived metrics) and **B11** (UI defects).
3. **B4** (addresses, identity, merge).
4. **B5** (consent, preferences), then **B7** (templates + WhatsApp link) and **B6** (convert to order).
5. **B8–B10** (timeline, segments, sources).

## Unverified / needs your confirmation

- I could not run the app, so A1, A3, A5 and A6 are **read from code** and should be reproduced (a short script against the store, or one manual pass in the UI) before fixing.
- Exact order and payment status spellings used in `v_customer_metrics` should be checked against `types.ts` and `006_finance_delivery.sql`.
- I did not read the Inquiries screen or `inquiries.ts` in depth; inquiry-to-customer linking and the inquiry pipeline are covered at a high level only.
- `date-fns` is used in the snippets for month-end-safe date maths; add it if it isn't already a server dependency.
- WhatsApp Business API / SMS provider details, costs and opt-in rules depend on your provider and local regulation; the design keeps the human-sent `wa.me` link as the default until you choose one.
