# Optim_staff_payroll.md — Staff, Attendance, Salary & Payroll

**Module scope:** staff directory, attendance, salary profiles, payment periods, payroll lines, advances, payroll payments, payslips, and the Staff & Salary screen.
**Code read for this document:** `server/routes/staff.ts`, `server/routes/remuneration.ts`, `server/database/store.ts` (lines ~2000–2560), `server/migrations/017_staff_remuneration.sql`, `server/database/index.new.ts` (write-back), `erp-interface-design/src/components/erp/staff-view.tsx`.
**Not run:** the app was not executed. Every finding below comes from reading the code. Findings marked **[verify first]** should be reproduced before you spend time fixing them.

> **How this file fits with the others.** This is the unified document for the payroll module. Where a change touches another module (finance ledger, production costing, notifications, audit, RBAC, analytics), the change is written out here in full *as it applies to payroll*, and points to the owning document (`Optim_finance.md`, `Optim_production.md`, `Optim_notifications_audit.md`, `Optim_security_rbac.md`, `Optim_analytics.md`, `Optim_architecture.md`) for the shared building blocks (event spine, ledger tables, permission middleware). Migration numbers here use the **060–069** range as placeholders; renumber them to follow the migrations from the other Optim files.

---

## Contents

1. What is already good
2. **Part A — Assessment** (what is wrong or missing today, with scenarios)
3. **Part B — Optimization, correction and improvement** (each fix applied at every level)
4. New UI elements and adjustments to existing UI
5. Consolidated migrations
6. Tests, rollout order, unverified items

---

## 1. What is already good

- **Confidentiality is designed in.** Salary figures live behind `remuneration.*` permissions, `staff.view` shows identity only, and `PATCH /staff/:id` explicitly rejects salary fields (`staff.ts` lines 106–108). Audit rows deliberately omit figures (`remuneration.ts` lines 73–78).
- **A real workflow exists:** `OPEN → PROCESSING → APPROVED → PARTIALLY_PAID → PAID → CLOSED`, with a terminal `CLOSED` guard (`assertPeriodOpen`) and an additive adjustment path.
- **Advances keep the original amount immutable** (`recordAdvanceRepayment` appends to `repayment_log`, never edits `amount`) and reject over-repayment.
- **Payslips are frozen snapshots** and issuing is idempotent.
- **Separate permissions** for create, edit, process, approve, record payment, close and print.
- Money columns are `NUMERIC(14,2)`.

These are good bones. The gaps below are mostly *integration* gaps (payroll is an island) and *control* gaps (who may do what, and how mistakes are corrected).

---

# PART A — ASSESSMENT

Severity: **H** = money or confidentiality at risk, **M** = wrong/misleading results, **L** = polish.

## A1. Payroll never reaches Finance (H)

**Where:** `store.markPaymentPaid` (store.ts ~2362) updates the payroll item and the period rollup only. A search of `finance.ts`, `analytics.ts`, `expenses.ts` and the services finds no reference to remuneration.

**What happens:** Paying staff creates no expense, no cash/mobile-money outflow and no ledger entry. The finance report, profit figures and cash-up cannot see payroll.

**Scenario.** In March you pay UGX 4,200,000 in salaries from the till and mobile money. Finance shows March net profit of UGX 6,000,000 because payroll is invisible. The cash-up expects the cash that was actually paid out to staff, so the till is short by the salary amounts and nobody can explain why. At year end the accountant has to rebuild payroll from payslips.

## A2. Approval has no second person (H)

**Where:** `store.approvePeriod(periodId, actor)` stores `approvedBy` but never compares it to `createdBy`. `calculatePeriod(periodId, staffIds, _actor)` ignores the actor entirely, so nobody is recorded as having *calculated* the period.

**Scenario.** One user holds `remuneration.create`, `process`, `edit` and `approve`. They create a period, calculate it, inflate their own bonus with `PATCH /remuneration/items/:id`, approve it, and record the payment. Every step is permitted and nothing flags it. The audit trail names the same person at each step but nothing ever *blocks* it.

## A3. Advances and payroll deductions are two separate, unlinked numbers (H)

**Where:** `calculatePeriod` sets `advanceAmount: 0` (comment: "Advances are NEVER auto-deducted"). `recordAdvanceRepayment` (advance side) and `item.advanceAmount` (payslip side) are independent.

**Scenario.** Grace has an advance of UGX 300,000 (`OUTSTANDING`). In April the Admin types UGX 100,000 into her payroll line's `advanceAmount`, so her net pay is reduced and the payslip says "Advance: 100,000". The advance record still says outstanding 300,000, because nobody separately recorded a repayment. In May the Admin deducts again. After three months Grace has had UGX 300,000 deducted from pay and the advance still reads 300,000 outstanding. The reverse also happens: an Admin records a repayment on the advance screen but forgets to deduct it on the payslip, so Grace repaid cash *and* has the full net salary.

## A4. Payments are not checked against what is owed (H)

**Where:** `store.recordPayment` checks only that the period is approved and open. It does not check that the staff member has a line in the period, that the `itemId` belongs to that period and staff, or that the amount fits the line's outstanding balance. `markPaymentPaid` then adds the amount to `item.paidAmount` with no ceiling.

**Scenarios.**
- Net pay is UGX 800,000. A payment of UGX 8,000,000 (extra zero) is recorded and marked paid. `paidAmount` becomes 8,000,000, the item flips to `PAID`, and the period shows `paidAmount` far above `totalAmount`.
- A payment is recorded for a staff member who has **no line** in the period. `markPaymentPaid` finds no item (the fallback search returns nothing), marks the payment `PAID`, and credits nothing. Money went out and no rollup changed.
- Clicking "Record payment" twice creates two payments (no idempotency key).

## A5. Payments cannot be cancelled or reversed (H)

**Where:** The `payment_status` CHECK allows `CANCELLED` (migration 017), but no route sets it. `markPaymentPaid` is one-way. `markPaymentPaid` also discards the actor (`void actor`), so *who marked it paid* is not recorded.

**Scenario.** A payment of UGX 1,500,000 is recorded to the wrong person (or with a typo) and marked paid. There is no way to void it inside the app. The Admin edits the database or leaves a wrong record in the history. Because `remuneration_payments` has `ON DELETE CASCADE` from `staff`/`period`, the only "clean" fix a developer has is destructive.

## A6. The "sanctioned correction" dead-ends on closed periods (M)

**Where:** `addAdjustmentItem` is allowed on a `CLOSED` period and recomputes the period totals. But `recordPayment` calls `assertPeriodOpen`, so an adjustment line on a closed period can **never be paid**. Also, recomputing totals changes `total_amount` on a closed period, so "closed" totals are not actually frozen.

**Scenario.** April is closed. In May you discover Peter was underpaid UGX 50,000. You add an adjustment line to April. It shows as owed, but the "Record payment" action is refused with "Period is CLOSED". April's `total_amount` has silently changed after close.

## A7. Salary profile history is overwritten (M)

**Where:** `upsertSalaryProfile` updates the single row in place. `effective_from` is stored but never used by `calculatePeriod`. Audit omits figures on purpose.

**Scenario.** Peter's salary rises from UGX 700,000 to 850,000 on 1 June. The Admin edits the profile on 25 May to "get ahead". The May calculation (re-run while still PROCESSING) uses 850,000. There is no record anywhere of the old figure except frozen payslips of earlier periods. If a dispute arises about what he was paid in January, the profile can't tell you.

## A8. Paid-leave and part-period staff are mishandled (M)

**Where:** `calculatePeriod` with no `staffIds` selects only `ACTIVE` and `PROBATION`. `ON_LEAVE` staff are silently skipped. There is no proration for a start or end date inside the period, and attendance is not read at all.

**Scenario.** Mary is on approved paid maternity leave (`ON_LEAVE`). Running "Calculate" for all staff produces lines for everyone except Mary. If the Admin does not notice, she is not paid. Conversely, a new hire who started on the 20th gets a full month's basic pay because nothing prorates.

## A9. Overlapping periods allow double payment (M)

**Where:** `createPeriod` validates date format and order only. Two periods covering the same dates can both contain Peter's line.

**Scenario.** A monthly period for October and a weekly period for 20–26 October are both calculated for the same staff. Peter is paid twice for the overlapping week.

## A10. Accountability fields can be spoofed (M)

**Where:** `staff.ts` line 76: `recordedBy: body.recordedBy ?? actor(req)`. The same pattern is used in `remuneration.ts` for periods (`createdBy`), payments (`recordedBy`) and advances (`recordedBy`), and in repayments. The client can send any `recordedBy`.

**Scenario.** A user records an attendance row, an advance or a payment with `"recordedBy": "<the Admin's user id>"`. The record permanently shows the Admin as the author.

## A11. Attendance is a flat log, unconnected to anything (M)

**Where:** `staff_attendance` stores a status and a single `hours` number (no validation: negative or 99 are accepted). It is not read by payroll, and no job costing uses it (no reference to attendance or staff in the production cost code).

**Scenario.** You have no way to see that Peter worked 14 hours of overtime on the wedding-cake week, no way to compute labour cost for a job, and the "labour cost per order" metric recommended for Analytics cannot be built. Missing attendance on a day goes unnoticed.

## A12. No self-service and no statutory structure (M)

- **Self-service:** payslips are readable only through `payslip.print` (an Admin permission by default). Staff cannot see their own payslip, and there is no "person concerned" access.
- **Deductions are one lump number** (`deductions`). Statutory items (for example NSSF in Uganda, and PAYE) cannot be itemised, reported or remitted. *Check current rates and rules with your accountant or the regulator; do not hard-code them.*

## A13. Database-level fragility (L)

- `payslips`, `remuneration_payments`, `remuneration_items` and `staff_advances` use `ON DELETE CASCADE` from `staff`/periods. Deleting a staff row at the database level erases salary history.
- `staff_number` has no `UNIQUE` constraint. `staff.user_id` has no uniqueness, so two staff rows can point to one user (a problem once payslip self-service exists).
- The write-back (`saveCache`) upserts every row of every mirrored table on each flush. A closed period is protected only by application code. Anyone with database access, or a code path that bypasses the store, can change a closed period.
- Rollups use JS `Math.round(x * 100) / 100`. UGX has no minor unit; store whole shillings or round per line.

## A14. UI observations (L/M)

From `staff-view.tsx`: tabs are `Team`, `Attendance`, `Salary periods`, `Advances`, `Payslips`. There is no period timeline (who calculated/approved/paid and when), no per-line variance, no "payment outstanding" call-out, no bulk payment, no reconciliation against actual cash/mobile-money, no attendance calendar, and no CSV export (individual payslips can be printed with the browser print dialog). The period detail shows action buttons based only on `can(...)` and status, not on "you created this so you cannot approve it".

---

# PART B — OPTIMIZATION, CORRECTION AND IMPROVEMENT

Each fix lists the change at every level. Layers: **DB → Server (store/service) → API → RBAC → Finance → Production → Notifications → Audit/Events → Analytics → UI.**

## B0. Shared prerequisites (defined in other Optim files)

- `domain_events` table and `emit(tx, event)` helper (`Optim_notifications_audit.md` / `Optim_architecture.md`).
- `withTransaction` already exists in `server/database/db.ts`; payroll write paths below use it directly with `pool` queries instead of the in-memory store, because the write-back model (full-table upsert) cannot give you an atomic "approve + post ledger + notify".
- Ledger tables `accounts`, `journal_entries`, `journal_lines` and a `postJournal(tx, …)` helper (`Optim_finance.md`).
- One `requirePermission(perm)` middleware (`Optim_security_rbac.md`). Snippets below use the existing local `required()` name to match the files you have today.

---

## B1. Post payroll to Finance (fixes A1)

**Principle.** Payroll is recognised when approved (an obligation) and paid when cash leaves (settles the obligation). Advances are an asset until recovered.

| Payroll event | Journal entry (debit / credit) |
|---|---|
| Period approved | Salaries & wages expense **/** Wages payable (net), plus statutory expense/payable lines if used |
| Payroll payment marked paid | Wages payable **/** Cash or Mobile Money (by method) |
| Advance given | Staff advances receivable **/** Cash or Mobile Money |
| Advance recovered through a payslip | Wages payable **/** Staff advances receivable |
| Payment voided | Reverse the original entry (new entry, never an edit) |

**DB (migration `060_payroll_finance_link.sql`)**

```sql
-- Link payroll rows to the ledger and the expense list
ALTER TABLE remuneration_periods  ADD COLUMN IF NOT EXISTS journal_entry_id TEXT;
ALTER TABLE remuneration_payments ADD COLUMN IF NOT EXISTS journal_entry_id TEXT;
ALTER TABLE remuneration_payments ADD COLUMN IF NOT EXISTS expense_id TEXT;
ALTER TABLE staff_advances        ADD COLUMN IF NOT EXISTS journal_entry_id TEXT;

-- Chart-of-accounts rows (ids are examples; align with Optim_finance.md)
INSERT INTO accounts (id, code, name, type) VALUES
  ('acc-wages-exp',  '6100', 'Salaries & wages',        'EXPENSE'),
  ('acc-wages-pay',  '2300', 'Wages payable',           'LIABILITY'),
  ('acc-staff-adv',  '1400', 'Staff advances receivable','ASSET')
ON CONFLICT (id) DO NOTHING;
```

**Server (new `server/services/payroll.service.ts`)**

```ts
import { withTransaction } from "../database/db.js";
import { postJournal } from "./ledger.service.js";      // from Optim_finance.md
import { emit } from "./events.service.js";             // from Optim_notifications_audit.md

export async function approvePeriod(periodId: string, approverId: string) {
  return withTransaction(async (tx) => {
    const { rows: [p] } = await tx.query(
      `SELECT * FROM remuneration_periods WHERE id=$1 FOR UPDATE`, [periodId]);
    if (!p) throw new NotFoundError("Period not found");
    if (p.status === "CLOSED") throw new ConflictError("Period is closed");
    if (p.approved_at) throw new ConflictError("Already approved");

    // Maker-checker (B2)
    await assertDifferentPerson(tx, p, approverId);

    const { rows: [t] } = await tx.query(
      `SELECT COALESCE(SUM(net_amount),0) AS net, COUNT(*) AS lines
         FROM remuneration_items WHERE period_id=$1`, [periodId]);
    if (Number(t.lines) === 0) throw new ValidationError("Calculate before approving");

    await tx.query(
      `UPDATE remuneration_items SET status='APPROVED', updated_at=now()
        WHERE period_id=$1 AND status='PENDING'`, [periodId]);
    await tx.query(
      `UPDATE remuneration_periods
          SET status='APPROVED', approved_by=$2, approved_at=now(), updated_at=now()
        WHERE id=$1`, [periodId, approverId]);

    const je = await postJournal(tx, {
      date: p.end_date, memo: `Payroll approved · ${p.label}`,
      source: { type: "remuneration_period", id: periodId },
      lines: [
        { account: "acc-wages-exp", debit: Number(t.net) },
        { account: "acc-wages-pay", credit: Number(t.net) },
      ],
    });
    await tx.query(`UPDATE remuneration_periods SET journal_entry_id=$2 WHERE id=$1`, [periodId, je.id]);

    await emit(tx, { type: "payroll.period_approved", entityType: "remuneration_period",
      entityId: periodId, actorId: approverId, amount: Number(t.net),
      data: { label: p.label, lines: Number(t.lines) } });   // NO per-person figures in event data
    return { id: periodId, status: "APPROVED" };
  });
}
```

**Server — marking a payment paid (also creates the expense row so the Expenses list and cash-up see it):**

```ts
export async function markPaymentPaid(paymentId: string, userId: string) {
  return withTransaction(async (tx) => {
    const { rows: [pay] } = await tx.query(
      `SELECT * FROM remuneration_payments WHERE id=$1 FOR UPDATE`, [paymentId]);
    if (!pay) throw new NotFoundError("Payment not found");
    if (pay.payment_status === "PAID") return pay;                      // idempotent
    if (pay.payment_status !== "RECORDED") throw new ConflictError(`Cannot pay from ${pay.payment_status}`);

    const { rows: [item] } = await tx.query(
      `SELECT * FROM remuneration_items WHERE id=$1 FOR UPDATE`, [pay.item_id]);
    if (!item) throw new ConflictError("Payment has no payroll line");
    const outstanding = Number(item.net_amount) - Number(item.paid_amount);
    if (Number(pay.amount) > outstanding)                                // ceiling (B3)
      throw new ValidationError(`Exceeds amount still owed (${outstanding})`);

    await tx.query(
      `UPDATE remuneration_payments
          SET payment_status='PAID', paid_by=$2, paid_at=now(), updated_at=now() WHERE id=$1`,
      [paymentId, userId]);
    await tx.query(
      `UPDATE remuneration_items
          SET paid_amount = paid_amount + $2,
              status = CASE WHEN paid_amount + $2 >= net_amount THEN 'PAID' ELSE 'PARTIALLY_PAID' END,
              updated_at = now()
        WHERE id=$1`, [item.id, pay.amount]);

    const cashAccount = pay.method === "MOBILE_MONEY" ? "acc-mobile-money"
                      : pay.method === "BANK_TRANSFER" ? "acc-bank" : "acc-cash";
    const je = await postJournal(tx, {
      date: pay.payment_date, memo: `Payroll payment · ${pay.reference || pay.id}`,
      source: { type: "remuneration_payment", id: paymentId },
      lines: [{ account: "acc-wages-pay", debit: Number(pay.amount) },
              { account: cashAccount,     credit: Number(pay.amount) }],
    });

    // Mirror into the existing Expenses list so current reports include it.
    const { rows: [exp] } = await tx.query(
      `INSERT INTO expenses (id, category_id, amount, date, payment_method, reference, description, recorded_by)
       VALUES ($1,'expcat-payroll',$2,$3,$4,$5,$6,$7) RETURNING id`,
      [`exp-pr-${paymentId}`, pay.amount, pay.payment_date, pay.method, pay.reference,
       `Payroll · ${pay.period_id}`, userId]);                          // description has no names/figures per person beyond the amount
    await tx.query(`UPDATE remuneration_payments SET journal_entry_id=$2, expense_id=$3 WHERE id=$1`,
      [paymentId, je.id, exp.id]);

    await emit(tx, { type: "payroll.payment_paid", entityType: "remuneration_payment",
      entityId: paymentId, actorId: userId, amount: Number(pay.amount),
      data: { method: pay.method, periodId: pay.period_id } });
    return { id: paymentId, status: "PAID" };
  });
}
```

> Make sure the `expcat-payroll` row exists in your expense categories (add it in the migration). Confirm the real column names of `expenses` in `001_core.sql`/`006_finance_delivery.sql` before running; the snippet follows the `Expense` type in `types.ts` (`categoryId, amount, date, paymentMethod, reference, description, recordedBy`).

**RBAC.** Expense rows created from payroll should be **hidden from roles without `remuneration.view`** in the Expenses list (filter by `category_id <> 'expcat-payroll'`), otherwise Finance viewers learn total payroll. Show payroll as one monthly total to anyone with `finance.view_reports`, and the person-level detail only to `remuneration.view`.

**Analytics.** Add `fact_payroll` (period, staff_id nullable for restricted roles, net, paid, method). Feeds *payroll as % of revenue*, *labour cost per order*, and the Profit & Loss "Salaries & wages" line (`Optim_analytics.md`).

**Notifications.** `payroll.period_approved` → holders of `remuneration.process` (to prepare payments); `payroll.payment_paid` → the **staff member only** (see B8), never broadcast with amounts.

**Audit.** The same two events above; the table is the audit trail. Keep figures out of `data` (matches the existing privacy intent).

**UI.** Period detail shows "Posted to ledger ✓ (JE-0042)" and a link to the journal entry for users with `finance.view_reports`.

**Scenario after the fix.** Approve March: Finance's P&L immediately shows UGX 4.2M "Salaries & wages" and the same amount in "Wages payable". Marking each payment paid reduces payable and cash. The till cash-up now expects the salary outflow. Net profit is honest.

---

## B2. Maker–checker on approval (fixes A2)

**DB (migration `061_payroll_controls.sql`)**

```sql
ALTER TABLE remuneration_periods ADD COLUMN IF NOT EXISTS calculated_by TEXT;
ALTER TABLE remuneration_periods ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ;
ALTER TABLE remuneration_items   ADD COLUMN IF NOT EXISTS last_edited_by TEXT;

-- configurable policy (single-row settings table; see Optim_security_rbac.md for the settings pattern)
CREATE TABLE IF NOT EXISTS approval_policies (
  key TEXT PRIMARY KEY,              -- 'payroll.approve'
  require_different_person BOOLEAN NOT NULL DEFAULT TRUE,
  owner_override BOOLEAN NOT NULL DEFAULT TRUE,   -- single-owner businesses
  threshold_amount NUMERIC(14,2) NOT NULL DEFAULT 0
);
INSERT INTO approval_policies (key) VALUES ('payroll.approve') ON CONFLICT DO NOTHING;
```

**Server**

```ts
async function assertDifferentPerson(tx, period, approverId: string) {
  const { rows: [pol] } = await tx.query(`SELECT * FROM approval_policies WHERE key='payroll.approve'`);
  if (!pol?.require_different_person) return;
  const involved = [period.created_by, period.calculated_by].filter(Boolean);
  const { rows: edited } = await tx.query(
    `SELECT DISTINCT last_edited_by FROM remuneration_items WHERE period_id=$1 AND last_edited_by IS NOT NULL`,
    [period.id]);
  involved.push(...edited.map((r) => r.last_edited_by));
  if (involved.includes(approverId)) {
    // A genuine single-owner business can allow an explicit, logged override.
    if (!pol.owner_override || !(await hasPermission(approverId, "remuneration.override_maker_checker")))
      throw new ForbiddenError("A different person must approve this period");
    await emit(tx, { type: "payroll.maker_checker_override", entityType: "remuneration_period",
      entityId: period.id, actorId: approverId, data: { reason: "owner override" } });
  }
}
```

Also record the actor in `calculatePeriod` (currently `_actor` is ignored) and in item edits (`last_edited_by`).

**RBAC.** New permission `remuneration.override_maker_checker` (granted to the Owner only). Seed it in a migration next to the existing `remuneration.*` keys. The role matrix: **Payroll Preparer** (`create`, `process`, `edit`), **Payroll Approver** (`approve`, `view_reports`), **Owner** (everything, including override).

**Notifications.** On `calculate` completion → notify holders of `remuneration.approve` ("March payroll ready for approval"). Override use → Owner/Admin, severity high.

**UI.** In period detail, disable "Approve" with a tooltip "You prepared this period — a different person must approve" when the rule applies; show "Prepared by / Approved by" with times in the header.

**Scenario after the fix.** The preparer cannot approve their own run. If the business has one owner, the owner can approve only with the override permission, and every override raises a high-severity notification and an event row.

---

## B3. Validate and bound payments (fixes A4)

**DB**

```sql
ALTER TABLE remuneration_payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_rempay_idem
  ON remuneration_payments(period_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE remuneration_payments ALTER COLUMN item_id SET NOT NULL;   -- after backfill, see §5
ALTER TABLE remuneration_payments ADD CONSTRAINT chk_rempay_amount CHECK (amount > 0);
```

**API** — `POST /remuneration/periods/:id/payments` takes `itemId` (required) and an `Idempotency-Key` header:

```ts
router.post("/periods/:id/payments", required("remuneration.record_payment"), async (req, res) => {
  const b = req.body ?? {};
  const key = String(req.header("Idempotency-Key") ?? "") || null;
  const pay = await recordPayment({
    periodId: String(req.params.id),
    itemId: String(b.itemId ?? ""),
    amount: Number(b.amount),
    method: String(b.method ?? "CASH"),
    reference: String(b.reference ?? ""),
    notes: String(b.notes ?? ""),
    recordedBy: actor(req),                 // NEVER from body (fixes A10)
    idempotencyKey: key,
  });
  res.status(201).json(pay);
});

// service
export async function recordPayment(i: RecordPaymentInput) {
  if (!Number.isFinite(i.amount) || i.amount <= 0) throw new ValidationError("amount must be positive");
  if (["MOBILE_MONEY", "BANK_TRANSFER"].includes(i.method) && !i.reference.trim())
    throw new ValidationError("A reference is required for mobile money and bank transfers");
  return withTransaction(async (tx) => {
    const { rows: [item] } = await tx.query(
      `SELECT i.*, p.status AS pstatus, p.approved_at
         FROM remuneration_items i JOIN remuneration_periods p ON p.id=i.period_id
        WHERE i.id=$1 AND i.period_id=$2 FOR UPDATE OF i`, [i.itemId, i.periodId]);
    if (!item) throw new ValidationError("That line does not belong to this period");
    if (!item.approved_at) throw new ConflictError("Approve the period first");
    if (item.pstatus === "CLOSED") throw new ConflictError("Period closed — use carry-forward (B5)");
    const { rows: [rec] } = await tx.query(
      `SELECT COALESCE(SUM(amount),0) AS recorded FROM remuneration_payments
        WHERE item_id=$1 AND payment_status IN ('RECORDED','PAID')`, [i.itemId]);
    const owed = Number(item.net_amount) - Number(rec.recorded);
    if (i.amount > owed) throw new ValidationError(`Amount exceeds what is still owed (${owed})`);
    // insert (unique index handles duplicate Idempotency-Key → return the original)
    …
  });
}
```

Changes at other levels:
- **UI:** the "Record payment" dialog pre-fills the line's outstanding amount, shows "Still owed", disables the button while submitting, and generates an idempotency key per dialog open.
- **Finance:** nothing posts until `mark-paid` (B1), so a mistaken *recorded* payment can be cancelled (B4) without ledger noise.
- **Notifications:** none for record; `payment_paid` per B1.
- **Analytics:** payments-recorded-but-not-paid ageing (for the "needs attention" list).

**Scenario after the fix.** The UGX 8,000,000 typo returns "Amount exceeds what is still owed (800,000)". A double-click returns the original payment instead of creating a second.

---

## B4. Void/reverse payments, record who paid (fixes A5)

**DB (migration `062_payroll_reversals.sql`)**

```sql
ALTER TABLE remuneration_payments ADD COLUMN IF NOT EXISTS paid_by TEXT;
ALTER TABLE remuneration_payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE remuneration_payments ADD COLUMN IF NOT EXISTS voided_by TEXT;
ALTER TABLE remuneration_payments ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE remuneration_payments ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE remuneration_payments ADD COLUMN IF NOT EXISTS reverses_payment_id TEXT REFERENCES remuneration_payments(id);
-- Allow REVERSED as a status
ALTER TABLE remuneration_payments DROP CONSTRAINT IF EXISTS remuneration_payments_payment_status_check;
ALTER TABLE remuneration_payments ADD CONSTRAINT remuneration_payments_payment_status_check
  CHECK (payment_status IN ('RECORDED','PENDING','PAID','CANCELLED','REVERSED'));
```

**API / rules**
- `POST /remuneration/payments/:id/cancel` — only from `RECORDED`; sets `CANCELLED`, requires `reason`; no ledger effect.
- `POST /remuneration/payments/:id/reverse` — only from `PAID`; **creates a new negative payment row** linked by `reverses_payment_id`, marks the original `REVERSED`, restores `item.paid_amount`, posts the reversing journal entry, and requires a second person if above a threshold (`approval_policies`). New permission `remuneration.void_payment`.

```ts
export async function reversePayment(id: string, userId: string, reason: string) {
  if (!reason.trim()) throw new ValidationError("A reason is required");
  return withTransaction(async (tx) => {
    const { rows: [orig] } = await tx.query(`SELECT * FROM remuneration_payments WHERE id=$1 FOR UPDATE`, [id]);
    if (!orig || orig.payment_status !== "PAID") throw new ConflictError("Only paid payments can be reversed");
    const revId = makeId("rpay");
    await tx.query(
      `INSERT INTO remuneration_payments
        (id, period_id, staff_id, item_id, amount, payment_date, method, reference,
         payment_status, notes, recorded_by, reverses_payment_id, paid_by, paid_at)
       VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,$6,$7,'PAID',$8,$9,$10,$9,now())`,
      [revId, orig.period_id, orig.staff_id, orig.item_id, -Number(orig.amount),
       orig.method, orig.reference, `Reversal: ${reason}`, userId, id]);
    await tx.query(`UPDATE remuneration_payments
        SET payment_status='REVERSED', voided_by=$2, voided_at=now(), void_reason=$3 WHERE id=$1`,
        [id, userId, reason]);
    await tx.query(`UPDATE remuneration_items
        SET paid_amount = paid_amount - $2, status='PARTIALLY_PAID', updated_at=now() WHERE id=$1`,
        [orig.item_id, orig.amount]);
    await reverseJournal(tx, orig.journal_entry_id, `Reversal of payroll payment ${id}`);  // Optim_finance.md
    await emit(tx, { type: "payroll.payment_reversed", entityType: "remuneration_payment",
      entityId: id, actorId: userId, amount: Number(orig.amount), data: { reason } });
  });
}
```

- **Finance:** expense row created in B1 is reversed with a matching negative entry (never deleted).
- **Notifications:** `payroll.payment_reversed` → Owner/Admin (severity high, `requires_ack`).
- **UI:** payment rows get a "⋯" menu: *Cancel* (RECORDED) or *Reverse…* (PAID), both opening a reason dialog. Reversed rows stay visible with a strike-through and a link to the reversal.

---

## B5. Corrections on closed periods: carry-forward (fixes A6)

**Rule.** A `CLOSED` period's rows and totals never change. A correction becomes an **adjustment line in the next open period** (or a one-off "supplementary" period), linked to the original.

**DB (migration `063_payroll_carry_forward.sql`)**

```sql
ALTER TABLE remuneration_items ADD COLUMN IF NOT EXISTS adjusts_period_id TEXT REFERENCES remuneration_periods(id);
ALTER TABLE remuneration_items ADD COLUMN IF NOT EXISTS adjusts_item_id   TEXT REFERENCES remuneration_items(id);

-- Freeze closed periods at the database level (defence in depth)
CREATE OR REPLACE FUNCTION trg_block_closed_period() RETURNS trigger AS $$
BEGIN
  IF (SELECT status FROM remuneration_periods WHERE id = COALESCE(NEW.period_id, OLD.period_id)) = 'CLOSED' THEN
    RAISE EXCEPTION 'Period is CLOSED; record a carry-forward adjustment in an open period';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS items_block_closed ON remuneration_items;
CREATE TRIGGER items_block_closed BEFORE INSERT OR UPDATE OR DELETE ON remuneration_items
  FOR EACH ROW EXECUTE FUNCTION trg_block_closed_period();
```

> The write-back (`saveCache`) upserts every row each flush, including closed periods' rows. With this trigger an upsert that *changes nothing* is still an UPDATE and will raise. Move remuneration to direct repository writes (as in B1–B4) before enabling the trigger, or add `WHERE row IS DISTINCT FROM` logic. See `Optim_architecture.md` on removing the in-memory store module by module; payroll is a good early candidate because it is low-traffic.

**API.** `POST /remuneration/periods/:id/adjustments` on a `CLOSED` period now returns `409` with `{ nextPeriodId }`; the new endpoint `POST /remuneration/adjustments/carry-forward { fromPeriodId, staffId, amount, reason, intoPeriodId }` adds a line to an open period with `adjusts_period_id` set.
**Finance:** the correction posts as part of the *next* period's approval; no edit to the closed period's journal entry.
**UI:** on a closed period, the "Add adjustment" button becomes "Carry forward a correction…", with a period picker defaulting to the next open period.

**Scenario after the fix.** Peter's UGX 50,000 underpayment is added to May as "Correction for April", paid with May's run, and April's totals and journal entry remain exactly as closed.

---

## B6. Salary profile history (fixes A7)

**DB (migration `064_salary_history.sql`)**

```sql
CREATE TABLE IF NOT EXISTS salary_profile_history (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  basic_salary NUMERIC(14,2) NOT NULL,
  allowance_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  deduction_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_frequency TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,                         -- NULL = current
  changed_by TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  EXCLUDE USING gist (staff_id WITH =, daterange(effective_from, effective_to, '[)') WITH &&)
);
-- needs: CREATE EXTENSION IF NOT EXISTS btree_gist;
-- Backfill: one row per existing salary_profiles row using COALESCE(effective_from, created_at::date)
```

**Server.** `PUT /remuneration/profiles/:staffId` no longer overwrites: it closes the current history row (`effective_to = new.effective_from`) and inserts a new one. `calculatePeriod` picks the history row whose range covers the period (and prorates if the change falls inside the period).
**Audit.** `payroll.salary_changed` event with `{ staffId, changedBy, effectiveFrom }` and **no figures**; the figures live only in the history table (readable with `remuneration.view`).
**UI.** The salary-profile panel in the Team tab shows a small history list ("From 1 Jun 2026: …") and requires an **effective-from date and reason** to save.

---

## B7. Correct calculation rules (fixes A8, A9, A12-deductions)

**Selection.** Include `ACTIVE`, `PROBATION` and `ON_LEAVE` by default; add per-staff `pays_during_leave` (default true) so unpaid leave can be excluded. Show a pre-calculation checklist listing every staff member and why they are included/excluded.

**Proration.** `workingFactor = daysEmployedInPeriod / daysInPeriod` using `start_date` and a new `end_date` (set when archived). Basic and fixed allowances are multiplied by the factor.

**Overlap guard.**

```sql
ALTER TABLE remuneration_periods
  ADD CONSTRAINT ex_rem_period_overlap
  EXCLUDE USING gist (period_type WITH =, daterange(start_date, end_date, '[]') WITH &&)
  WHERE (status <> 'CLOSED');   -- or enforce in service per staff, see below
```

A per-staff overlap check is more precise (a weekly casual period and a monthly salaried period may legitimately overlap for different people):

```ts
// in calculatePeriod, per staffId
const { rows: [clash] } = await tx.query(
  `SELECT p.id, p.label FROM remuneration_items i
     JOIN remuneration_periods p ON p.id = i.period_id
    WHERE i.staff_id=$1 AND p.id<>$2
      AND daterange(p.start_date, p.end_date,'[]') && daterange($3::date, $4::date,'[]')`,
  [staffId, period.id, period.start_date, period.end_date]);
if (clash) warnings.push({ staffId, message: `Already paid in "${clash.label}"` }); // block unless override
```

**Itemised deductions (new tables).**

```sql
CREATE TABLE IF NOT EXISTS deduction_rules (
  id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL,         -- 'NSSF_EMP', 'PAYE', 'LOAN'
  name TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('PERCENT','FIXED','BANDED')),
  rate NUMERIC(7,4), fixed_amount NUMERIC(14,2), bands JSONB,
  employer_share_rate NUMERIC(7,4), applies_to TEXT NOT NULL DEFAULT 'ALL',
  active BOOLEAN NOT NULL DEFAULT TRUE, effective_from DATE NOT NULL, effective_to DATE
);
CREATE TABLE IF NOT EXISTS remuneration_item_lines (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES remuneration_items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('EARNING','DEDUCTION','EMPLOYER_COST','ADVANCE_RECOVERY')),
  code TEXT NOT NULL, label TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL
);
```

Keep `remuneration_items.deductions` as the sum of `DEDUCTION` lines for backward compatibility. Rates come from rows you maintain (verified with your accountant), never from code. Finance posts each statutory line to its own payable account so remittances can be tracked.

---

## B8. Link advances to payroll deductions (fixes A3)

**Rule.** Recovery happens in **one place**: when a payslip line of kind `ADVANCE_RECOVERY` is approved, the advance is credited in the same transaction. The advance screen's manual "Record repayment" remains for cash repayments outside payroll.

**DB (migration `065_advance_recovery.sql`)**

```sql
ALTER TABLE staff_advances ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(14,2);   -- suggested per period
ALTER TABLE staff_advances ADD COLUMN IF NOT EXISTS due_from DATE;
CREATE TABLE IF NOT EXISTS advance_repayments (
  id TEXT PRIMARY KEY,
  advance_id TEXT NOT NULL REFERENCES staff_advances(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL CHECK (source IN ('PAYROLL','CASH','MOBILE_MONEY','BANK')),
  item_id TEXT REFERENCES remuneration_items(id),        -- set when source = PAYROLL
  repaid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT NOT NULL DEFAULT '', recorded_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (advance_id, item_id)                            -- one payroll recovery per line
);
-- Backfill: explode existing repayment_log JSON into advance_repayments, then keep repayment_log as a read-only legacy column.
```

**Calculation.** `calculatePeriod` *proposes* an `ADVANCE_RECOVERY` line equal to `LEAST(installment_amount, outstanding)` for each staff member with an outstanding advance; the preparer can reduce or remove it (with a reason), and the payslip shows it. The recovery is applied to the advance **at approval**, inside the same transaction as B1's journal entry (Dr Wages payable / Cr Staff advances receivable).

**Guard.** Total recovery per line cannot exceed `net before recovery` unless an explicit override; recovery cannot exceed the advance's outstanding balance.

**Notifications.** `advance_overdue` (outstanding past `due_from` with no recovery in the last N periods) → Owner/Admin.
**Analytics.** *Outstanding advances* and *recovery rate* in the payroll dashboard and as an asset line on the balance sheet.
**UI.** Advances tab gets a repayment-source column and a "Recovered via payslip" badge; the payroll line editor shows "Advance recovery (proposed)" with the advance's remaining balance.

**Scenario after the fix.** Grace's UGX 300,000 advance with a 100,000 installment: April's payslip proposes a 100,000 recovery. On approval the advance becomes 200,000 outstanding automatically. The two numbers can no longer drift.

---

## B9. Stop accountability spoofing (fixes A10)

Delete `recordedBy`, `createdBy` and `staffMember` from every request-body path; derive from the session only.

```ts
// staff.ts attendance — before
res.status(201).json(store.recordAttendance({ ...body, recordedBy: body.recordedBy ?? actor(req) }));
// after
res.status(201).json(store.recordAttendance({ ...pick(body, ["staffId","date","status","hours","notes"]), recordedBy: actor(req) }));
```

Same change in `remuneration.ts` (periods, payments, advances, repayments). Add a request-schema (Zod) per route as described in `Optim_architecture.md`.

---

## B10. Attendance → payroll → job costing (fixes A11)

**DB (migration `066_time_entries.sql`)**

```sql
ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS clock_in  TIMESTAMPTZ;
ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS clock_out TIMESTAMPTZ;
ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE staff_attendance ADD CONSTRAINT chk_att_hours CHECK (hours >= 0 AND hours <= 24);
CREATE UNIQUE INDEX IF NOT EXISTS ux_att_staff_date ON staff_attendance(staff_id, date);

CREATE TABLE IF NOT EXISTS job_time_entries (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,                 -- production_jobs.id
  step_id TEXT,                         -- production_steps.id (optional)
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  work_date DATE NOT NULL,
  hours NUMERIC(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  hourly_rate NUMERIC(14,2) NOT NULL,   -- frozen at entry time from salary history
  cost NUMERIC(14,2) GENERATED ALWAYS AS (hours * hourly_rate) STORED,
  recorded_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_jte_job ON job_time_entries(job_id);
```

> The unique index follows the existing store comment about avoiding surprise unique violations in the write-back. That concern disappears when payroll writes go direct to SQL (B1). Do the repository move first, then add the unique index.

**Production** (`Optim_production.md`): the production-job costing function replaces the hard-coded `labourCost: 0` with `SUM(job_time_entries.cost)` for the job. `hourly_rate` = `basic_salary / standard_hours_in_period` from the salary history; *never exposed* to roles without `remuneration.view` (they see hours, not rates; the rate is applied server-side).
**Finance:** labour is split into direct (jobs) and indirect (the rest of payroll). The Profitability tab shows margin per job net of labour.
**Analytics:** labour cost per order, hours per cake size, overtime trend, attendance rate, jobs per baker.
**Notifications:** "Attendance not recorded by 10:00" → `staff.attendance` holders; "Overtime above X hours this week" → Production Manager.
**UI:** a mobile-friendly **clock in/out** card (PWA exists already) and a **Log time** control inside the production job dialog.

---

## B11. Staff self-service payslips (fixes A12-self-service)

**DB:** `CREATE UNIQUE INDEX ux_staff_user ON staff(user_id) WHERE user_id IS NOT NULL;` plus `ALTER TABLE staff ADD CONSTRAINT uq_staff_number UNIQUE (staff_number);`
**RBAC:** new permission `payslip.view_own` (no admin rights): the endpoint ignores any `staffId` in the request and resolves it from the session.

```ts
router.get("/me/payslips", required("payslip.view_own"), async (req, res) => {
  const me = await staffForUser(actor(req));              // staff.user_id = session.userId
  if (!me) return res.json([]);
  const { rows } = await query(
    `SELECT id, period_label, net_amount, issued_at FROM payslips
      WHERE staff_id=$1 AND issued_at IS NOT NULL ORDER BY issued_at DESC`, [me.id]);
  res.json(rows);
});
```

**Staff-link guard.** `PATCH /staff/:id` that sets `userId` must (a) verify the user exists, (b) not be linked to another staff row, (c) log `staff.user_linked`.
**Notifications:** "Your April payslip is ready" → the staff member only.
**UI:** a "My pay" page appears in the nav only when the user has `payslip.view_own`; it shows payslips and (if enabled) advance balance.

---

## B12. Database hardening (fixes A13)

```sql
-- Preserve history: no cascading deletes of pay records
ALTER TABLE payslips               DROP CONSTRAINT IF EXISTS payslips_staff_id_fkey,
  ADD CONSTRAINT payslips_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT;
ALTER TABLE remuneration_payments  DROP CONSTRAINT IF EXISTS remuneration_payments_staff_id_fkey,
  ADD CONSTRAINT remuneration_payments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT;
ALTER TABLE remuneration_items     DROP CONSTRAINT IF EXISTS remuneration_items_staff_id_fkey,
  ADD CONSTRAINT remuneration_items_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT;
ALTER TABLE staff_advances         DROP CONSTRAINT IF EXISTS staff_advances_staff_id_fkey,
  ADD CONSTRAINT staff_advances_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT;

-- Whole-shilling money (UGX): optional, only if you decide to stop using decimals
-- ALTER TABLE remuneration_items ALTER COLUMN net_amount TYPE BIGINT USING ROUND(net_amount);
```

Check that your PostgreSQL constraint names match the defaults above before running (`\d remuneration_items` in psql); defaults are `<table>_<column>_fkey`.

Also in the app: remove the `void actor` calls, return the acting user from every mutator, and write the actor to the row (`paid_by`, `closed_by`).

---

# 4. UI — new elements and adjustments

## 4.1 New UI elements (functionality that does not exist yet)

| Element | Where | Purpose / behaviour |
|---|---|---|
| **Payroll run stepper** | Salary periods → period detail | Visual steps *Create → Calculate → Review → Approve → Pay → Close* with who/when under each step and the current step highlighted; disabled steps explain why ("You prepared this run"). |
| **Pre-calculation checklist** | "Calculate" dialog | Lists every staff member with include/exclude reason (on leave, no profile, already paid in overlapping period) and lets the preparer override with a note. |
| **Line variance column** | Period items table | Shows change vs previous period (↑/↓ and %) and flags lines that moved more than a threshold. |
| **Payment reconciliation panel** | Period detail → Payments | Expected vs recorded vs paid per person; unpaid lines in an "Outstanding" strip; "Pay all outstanding" bulk action producing one payment row per line (with preview). |
| **Cancel / Reverse payment dialog** | Payments table "⋯" menu | Reason required; reversal needs a second person above threshold. |
| **Carry-forward dialog** | Closed period | Replaces "Add adjustment". |
| **Salary history drawer** | Team → staff → salary profile | Timeline of changes with effective-from dates and reasons (visible with `remuneration.view`). |
| **Advance schedule** | Advances tab | Installment amount, due-from date, and a mini progress bar (repaid / total). |
| **Clock in/out card** | New "Today" panel in Attendance + mobile view | Large tap targets; shows hours so far. |
| **Attendance calendar** | Attendance tab | Month grid colour-coded by status; click a day to edit; missing days highlighted. |
| **My pay page** | Nav item for staff with `payslip.view_own` | Own payslips, printable. |
| **Payroll dashboard cards** | Salary periods header | Due / paid / pending, advances outstanding, next payment date, "approval needed" count, "payments recorded but not paid". |
| **Export** | All tables | CSV of the period summary (for `remuneration.view_reports`). |

## 4.2 Adjustments to existing UI

| Existing element (file) | Change |
|---|---|
| Period **Approve** button (`staff-view.tsx` ~581) | Disable with tooltip when the maker-checker rule applies; show "Prepared by / Approved by". |
| **Record payment** dialog | Require line selection; prefill the outstanding amount; show "Still owed"; add idempotency key; disable on submit; require reference for non-cash. |
| **Mark paid** action | Confirmation showing method/reference/amount; after success show "Posted to ledger". |
| **Add adjustment** (closed period) | Change to **Carry forward**. |
| Team tab → **Save salary profile** (~251) | Add *effective from* and *reason* fields; save creates a history entry. |
| **Advances** tab (`AdvancesTab`) | Add source column, installment, due date, "Recovered via payslip" badge; hide the manual repayment button for amounts already recovered through payroll. |
| **Attendance** dialog | Validate hours 0–24; add clock-in/out fields; prevent future dates. |
| **Payslips** tab | Add per-line breakdown (earnings, itemised deductions, advance recovery) and a "Paid / balance" strip; show "Issued by/at". |
| Lock panels | Keep the lock panel for users without `remuneration.view`, but remove salary-related hints from the Team tab for them. |

---

# 5. Consolidated migrations (apply in this order)

| # | File | Contents |
|---|---|---|
| 060 | `060_payroll_finance_link.sql` | Journal/expense links, payroll accounts, `expcat-payroll` category (B1) |
| 061 | `061_payroll_controls.sql` | `calculated_by`, `last_edited_by`, `approval_policies` (B2) |
| 062 | `062_payroll_reversals.sql` | Paid/void fields, `REVERSED` status, reversal link (B4) |
| 063 | `063_payroll_carry_forward.sql` | `adjusts_*` columns, closed-period trigger (B5) — **enable the trigger last, after the repository move** |
| 064 | `064_salary_history.sql` | `salary_profile_history` + backfill (B6) |
| 065 | `065_advance_recovery.sql` | `advance_repayments`, installment fields + backfill from `repayment_log` (B8) |
| 066 | `066_time_entries.sql` | Attendance columns, `job_time_entries` (B10) |
| 067 | `067_payroll_rules.sql` | `deduction_rules`, `remuneration_item_lines`, `end_date` on staff (B7) |
| 068 | `068_payroll_rbac.sql` | New permissions (below), role grants |
| 069 | `069_payroll_constraints.sql` | `RESTRICT` FKs, unique `staff_number`/`user_id`, payment constraints (B3, B11, B12) |

**New permission keys (migration 068).**

```sql
INSERT INTO permissions (id, key) VALUES
  ('perm-rem-void',       'remuneration.void_payment'),
  ('perm-rem-override',   'remuneration.override_maker_checker'),
  ('perm-rem-carry',      'remuneration.carry_forward'),
  ('perm-rem-rules',      'remuneration.manage_rules'),
  ('perm-payslip-own',    'payslip.view_own'),
  ('perm-time-log',       'staff.log_time')
ON CONFLICT (key) DO NOTHING;
-- Grants: Owner/Admin all of the above; 'payslip.view_own' and 'staff.log_time' to every staff-linked role.
```

**Backfills to run once (in a transaction, then verify counts).**
1. Existing `remuneration_payments` with a NULL `item_id`: set it from the period + staff line where exactly one exists; list the rest for manual review *before* adding `NOT NULL`.
2. `salary_profiles` → `salary_profile_history` (one open row each).
3. `staff_advances.repayment_log` JSON → `advance_repayments` rows (`source='CASH'` unless a method says otherwise).
4. Historic `PAID` payments with no journal entry: create catch-up entries dated at their `payment_date` **only for open accounting periods**; document closed ones as opening balances (`Optim_finance.md`).

---

# 6. Tests, rollout and unverified items

## Tests to write first (server, e.g. Vitest + a test Postgres)

1. Creator cannot approve their own period; override permission allows it and emits an event.
2. Payment above outstanding is rejected; payment for a staff member with no line is rejected; duplicate `Idempotency-Key` returns the first payment.
3. `mark-paid` posts a balanced journal entry (sum debits = sum credits) and an expense row; reversing it restores `paid_amount` and posts the opposite entry.
4. A `CLOSED` period rejects item changes (including direct SQL when the trigger is on); carry-forward lands in the next open period.
5. `ON_LEAVE` staff with `pays_during_leave` appear in calculation; mid-period starters are prorated.
6. Overlapping-period calculation warns/blocks per staff.
7. Advance recovery on approval reduces the advance exactly once (re-approving is blocked).
8. `/me/payslips` returns only the caller's payslips even when a `staffId` is supplied.
9. `recordedBy` supplied in a body is ignored.

## Suggested order of work

1. **A10** (stop spoofing) and **B3** (payment validation): small, safe, immediate.
2. **B4** (cancel/reverse) and **B2** (maker–checker).
3. Move payroll writes to repository/SQL with `withTransaction`; then **B1** (finance link).
4. **B8** (advances), **B5** (carry-forward + trigger), **B6** (salary history).
5. **B7** (calculation rules), **B10** (time → job costing), **B11** (self-service).
6. UI items from §4 alongside each step.

## Unverified / needs your confirmation

- Exact `expenses` and expense-category column names and whether an expense-category table exists; the snippets follow the `Expense` TypeScript type.
- Whether `accounts`, `journal_entries` and `postJournal` are the names used in `Optim_finance.md` — rename to match.
- I did not review the Settings/Users screens or how the Team tab handles users without `staff.manage`.
- Statutory rates and rules (NSSF, PAYE, withholding) must come from your accountant or the regulator; none are asserted here.
- The write-back behaviour (upsert of all mirrored rows each flush) is read from `index.new.ts`; I did not measure its cost or run a concurrent test.
