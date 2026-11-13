# Finance Module: Layout Optimization Plan (Desktop and Mobile)

Scope: the **Finance** module and its page: Payments (with Order payment status), Expenses, Invoices, Approvals, Cash-up, Period close, Profitability, Reports, plus two new needs:
1. **Expenses that are not tied to an order** (repairs, maintenance and similar).
2. **Standard per-bake costs** (e.g. Electricity UGX 5,000) that are added to every order's cost **automatically**.

Audit basis: the `twin_cakery_production-optim-fin-sec-unify` build.
Files: `erp-interface-design/src/components/erp/finance-view.tsx` (644 lines), `server/routes/{finance,payments,expenses,production-costs}.ts`, `server/services/{costing,business}.service.ts`, migrations 006, 020, 032–034, `src/styles.css`.
Related: `optim/Optim_finance.md` (backend: append-only payments, invoices, ledger). This plan covers layout and the two new cost features, and follows that document's UI section (B11) where they overlap (for example "no free `receivedBy`").

How to use this plan: section 3 lists, for each tab, what I suggest it shows and whether I would keep, merge or remove it. Those are discussion points, and the questions are collected in section 11. Nothing is removed until you confirm.

---

## 1. How the Finance module works today

Tabs (`data.ts`): `Payments | Invoices | Approvals | Cash-up | Period close | Expenses | Profitability | Reports`. Each tab is one `section.panel.module-table`; the module opens on **Payments**.

| Tab | What it shows now |
|---|---|
| Payments | "Processing" banner; record-payment form (free-text **Order ID**, amount, method Cash / M-Pesa, reference, hidden `receivedBy`); payments table (Order ID, Amount, Method, Reference, Date, **Received by**); below it an **Order payment status** table (Order, Customer, Product, Total, status badge) listing only unpaid orders |
| Invoices | Invoice #, Order ID, **Customer ID**, status, total, issue date; no actions |
| Approvals | Kind, requested by, status, created; **no approve / reject buttons** |
| Cash-up | Three free-text boxes (Driver ID, expected, counted) and a button that reloads the whole page |
| Period close | One free-text box (YYYY-MM) and a button that reloads the whole page |
| Expenses | Form (amount, category, date, method, reference, description) and a table (Date, Category, Method, Amount, Recorded by, edit / delete) |
| Profitability | Period select, KPI cards, a "Production costs" KPI, and a Line / Value table |
| Reports | Period select and a footer; nothing downloadable; "October 2026" is hard-coded |

## 2. Problems found

### 2.1 Payments
1. **A payment only shows an order ID** (`TC-1044`). You can't tell who paid or for what without opening the order.
2. **"Received by"** is shown as a column, sent with every payment (defaulting to the logged-in user) and included in search. You asked to remove it.
3. **The order is typed by hand** into a free-text box. No picker, no check that the order exists, no balance shown, and no warning if the amount is more than what is owed.
4. **Only Cash and M-Pesa** as methods.
5. **Reversal is not wired.** The "Reverse / refund payment" dialog exists but nothing opens it, and "Request reversal" only shows a notice.

### 2.2 Order payment status
6. **No paid or balance figures.** It shows Total and a status badge only, and lists only orders that are not fully paid, so settled orders can't be looked up here.
7. **The "paid" figure is not reliable.** `Order.paidAmount` is documented as "amount paid at order creation / last payment record", not the sum of payments, so it can drift from the Payments table.
8. It sits underneath the payments table with a plain heading, so it is easy to miss on mobile.

### 2.3 Expenses and costs
9. **Every row in `expenses` is a general business expense with no order link**, but the tab copy and the sample data present Expenses as order costs ("Ingredient procurement"), which is confusing.
10. **Categories start empty** (`expenseCategories: []`, no seed data) and I found no "add category" control in the form, so recording something like "Repairs & maintenance" is awkward.
11. **No expense type, no payee or supplier, no receipt in the form** (the API accepts an `attachment`), and rows can be hard-deleted (`Optim_finance.md` B8 recommends voiding instead).
12. **Standard per-bake costs do not exist in practice.** The database already has `production_fixed_cost_categories` (name, cost type, unit, `default_unit_cost`, active) and `production_fixed_cost_entries`, but:
    - entries are created **only by hand**, one job at a time (`POST /jobs/:jobId/entries`);
    - they are **never added to a job's cost**: `costingService.getJobCost()` and the production cost rows ignore them, and the production cost rows created when materials are recorded always have `labourCost: 0, overheadCost: 0` and `total = ingredientCost`;
    - so order cost, margin (`/finance/margin/:orderId`) and Profitability `directCosts` contain **ingredients only**.
13. **Profitability is a flat list of lines.** No split into direct costs and operating expenses, no per-order margin, and a separate "Production costs" KPI card that is not part of the table.

### 2.4 Other tabs
14. **Invoices show a customer ID**, not a name, and have no view / print / credit-note action (the credit-note endpoint exists).
15. **Approvals can't be acted on.** The tab is read-only.
16. **Cash-up and Period close read values with `document.getElementById` and call `window.location.reload()`**; the driver is a free-text ID; there is no list of past handovers or periods, no variance, and no checklist before closing a period.
17. **Reports is a placeholder.**
18. **Eight tabs of equal weight**, with no summary page. On mobile the tab row is long and there is no "what needs attention" view.

### 2.5 Layout and mobile
19. Forms are shown inline on desktop and in a centred `Dialog` on mobile (not a bottom sheet); there is no consistent card layout for the finance tables on mobile.
20. Statuses are plain text in Invoices and Approvals (no badges).

## 3. Suggested content per tab (for discussion)

| Tab | What it should show | My suggestion |
|---|---|---|
| **Overview** (new Finance page) | Four KPIs for the month (Collected, Outstanding, Expenses, Net profit); "Needs attention" (unpaid orders due soon, pending approvals); last 5 payments; spend by category | **Add** as the landing page (decision 1) |
| **Payments** | Record payment; payments list with customer + product; Order payment status (paid, balance, badge) | **Keep**; this is the core tab (sections 4 and 5) |
| **Expenses** | Operating expenses (manual); Standard per-bake costs (automatic); read-only Order costs view | **Keep and rebuild** (section 6) |
| **Invoices** | Invoice #, customer name, order #, issue date, total, paid, balance, status badge; view / print / credit note | **Keep only if you issue invoices to customers**; otherwise hide the tab (decision 4) |
| **Profitability** | Month picker; Revenue → Direct costs → Gross profit → Operating expenses → Net profit; per-order margin list; export | **Keep, and merge Reports into it** (section 7.3) |
| **Reports** | (placeholder) | **Remove** as a separate tab; fold downloads into Profitability |
| **Approvals** | Pending reversal / refund / override requests with Approve / Reject | **Remove for now** unless you approve reversals as a separate step; show a small "pending" count in Payments instead (decision 5) |
| **Cash-up** | Per driver and day: expected cash, counted, variance, history | **Keep only if drivers collect cash on delivery** (decision 6) |
| **Period close** | List of months with Open / Closed; checklist; Close button | **Merge into Profitability** as a "Close month" action (decision 7) |

If you agree with all of these the module becomes **Overview, Payments, Expenses, Invoices (optional), Profitability**: five tabs instead of eight.

## 4. Payments tab

### 4.1 Payment row: who and what it is for

Desktop columns: **Customer** (name, with `#TC-1044` as a small line under it) · **Product** (first item, "+2 more" if several; full list in the drawer / hover) · **Amount** · **Method** · **Reference** · **Date** · row actions.
**Removed:** the "Received by" column, its search term, and the form field. (The server can still record who made the entry in the audit log without showing it.)

Mobile card:
```
┌───────────────────────────────────────────┐
│ Aisha Birungi                  UGX 85,000     │
│ Chocolate cake · 2 kg                         │
│ #TC-1044 · M-Pesa · 3 Nov                     │
└───────────────────────────────────────────┘
```
Reference and the full item list open in the drawer when tapped.

Data: add `orderNumber`, `customerName` and `itemsSummary` to the `GET /payments` response (a join on the server) so the table doesn't depend on which orders happen to be loaded in the browser; fall back to the loaded orders in sample mode. Search matches customer, order #, product, reference and method.

### 4.2 Record payment

Replace the free-text Order ID with an **order picker**:
```
 Order     [ Search order, customer or product…        ▾ ]
           TC-1044 · Aisha Birungi · Chocolate cake · Balance UGX 85,000
 ┌ Summary ─────────────────────────────────────────────┐
 │ Aisha Birungi · Chocolate cake, 2 kg                      │
 │ Total 250,000   Paid 165,000   Balance 85,000             │
 └────────────────────────────────────────────────────────┘
 Amount    [ 85,000 ]   [Pay full balance]
 Method    ( Cash ) ( M-Pesa )   (more methods, decision 3)
 Reference [ optional for cash, required for mobile money ]
```
- The picker lists orders that still have a balance (with a "show all" switch).
- Selecting an order fills the summary card and defaults the amount to the balance; a warning appears if the amount is more than the balance.
- **No "Received by" field.**
- Desktop: a card above the table, collapsed behind a "Record payment" button once the page has data. Mobile: a **bottom sheet** opened by a button (sticky at the bottom of the screen).
- The M-Pesa "confirm payment" step stays, shown inside the sheet / card.

### 4.3 Page layout
- Desktop: header with the "Record payment" button, search box, method filter and date range; table; foot with count and total collected for the filter.
- Mobile: sticky search row, filter chips (All / Cash / M-Pesa), card list.
- The "Processing" banner stays at the top.

## 5. Order payment status

Make it a **clear section with its own sub-tab** inside Payments: **Payments | Order payment status** (segmented control), instead of a table below the payments.

Columns: **Order #** · **Customer** · **Product** · **Total** · **Paid** · **Balance (left)** · **Status badge** · Due date.

```
 Billed 1.2M   Collected 950K   Outstanding 250K          ← summary strip
 [ Outstanding ][ Part paid ][ Unpaid ][ Paid ][ All ]     ← filter chips
 ┌──────────────────────────────────────────────┐
 │▌ Aisha Birungi            [Part paid]            │
 │▌ #TC-1044 · Chocolate cake                       │
 │▌ ▰▰▰▰▰▱▱ 66%                                     │
 │▌ Total 250,000 · Paid 165,000 · Left 85,000      │
 └──────────────────────────────────────────────┘
```
- **Status badge** from one function: **Unpaid** (nothing paid), **Part paid**, **Paid**, **Processing** (mobile money waiting to clear). Same badge in the Sales tables, so the word is the same everywhere.
- **Paid** = the sum of confirmed payments for the order (not `paidAmount`); **Balance** = Total − Paid. This follows `Optim_finance.md` B1.4 (payment status is derived).
- Default filter **Outstanding**, sorted by oldest due date; other sorts: largest balance, newest. Overdue balances (due date passed) show in red text as well as colour.
- Tapping a row (or the desktop row) opens the order; "Record payment" is a button on the row and pre-selects that order.
- Mobile: the card above, with the progress bar and the three figures on one line.

## 6. Expenses

The Expenses tab becomes three parts, selected with a segmented control:

**Operating expenses | Standard costs | Order costs**

### 6.1 Operating expenses (manual): everything that is not a bake
Repairs and maintenance, rent, utilities bills, transport and fuel, equipment, cleaning, marketing, licences, wages that are not part of order cost, and so on. They are **not** attached to an order; they reduce **net profit** for the month.

Form (desktop card / mobile bottom sheet):
`Date` · `Category` (with **Add category** inside the picker) · `Amount` · `Paid via` (Cash / M-Pesa / Bank) · `Payee or supplier` (optional) · `Description` · `Receipt photo` (optional) · optional `Linked order` (only for a one-off cost you want to charge to one order).

Table: Date · Category · Payee · Description · Method · Amount · actions. Filters: month, category. Foot: total for the filter and "by category" mini-summary.
Mobile card: category + amount on row 1, description on row 2, date · payee · method on row 3, "FAB" **+ Expense** button.

Changes that go with it:
- Seed starter categories: Repairs & maintenance, Rent, Utilities, Transport & fuel, Equipment, Cleaning, Marketing, Licences & fees, Other (all editable).
- A **Manage categories** dialog (add, rename, deactivate).
- **Void instead of delete** (keep the row, mark it void with a reason), per `Optim_finance.md` B8.
- "Recorded by" moves to the drawer (it stays in the audit log).
- Hint to avoid double counting: when the category matches a standard cost (for example "Electricity"), show "Electricity is already charged per bake as a standard cost, so don't also enter the monthly bill here unless it is for something else."

### 6.2 Standard costs (automatic): fixed costs added to every bake

**The idea:** you enter a standard amount once (for example *Electricity UGX 5,000 per bake*). From then on the system adds it to **every order's cost** when the order is baked, with nothing to type per order.

Screen:
```
 Standard costs                                       [+ Add standard cost]
 Each bake currently adds UGX 7,500 to the order's cost.
 ┌───────────────────────────────────────────────────────────┐
 │ ● Electricity     Per bake     UGX 5,000     Active    [Edit] │
 │ ● Water           Per bake     UGX 1,500     Active    [Edit] │
 │ ○ Gas             Per bake     UGX 1,000     Paused    [Edit] │
 └───────────────────────────────────────────────────────────┘
 Changes apply to new bakes only. Past orders keep the amount they were charged.
```
Fields per standard cost: **Name**, **Amount**, **Charged per** (bake / order; see decision 8), **Active** switch, **Starts from** date, notes. Mobile: one card per cost with the amount large and an Active switch.

How it works (server):
1. Reuse the existing tables: `production_fixed_cost_categories` holds the standard costs (it already has `cost_type`, `unit`, `default_unit_cost`, `active`); `production_fixed_cost_entries` holds what was charged to each job. Add: `auto_apply` and `starts_on` on the category; `source` (`AUTO` / `MANUAL`) on the entry.
2. **When baking starts** (the job moves from Queued to Baking, see `Production_Layout_Optimization.md`), the server creates one entry per active standard cost for that job, copying the **current amount** (a snapshot, so later price changes never rewrite history). It runs once per job and cost (unique on job + category for `AUTO` entries), so a repeated click can't double-charge.
3. A job that never starts baking (for example a cancelled order) is not charged.
4. A manager can still **edit or waive** one job's entry with a note (for example a double bake). Manual entries via the existing endpoint still work for one-off extras.
5. **Include these entries in all cost totals.** Today they are ignored. Add them to `costingService.getJobCost()` (as `standardCost`), to the job costs returned by `GET /jobs/:id/costs`, to `/finance/margin/:orderId`, and to the `directCosts` in `/finance/reports`, so order cost, margin and profitability all agree and nothing is counted twice.
6. Existing jobs are **not** back-filled unless you choose to (decision 10).

### 6.3 Order costs (read-only)
One row per order: Order # · Customer · Product · **Ingredients** · **Standard costs** · **Total cost** · Revenue · **Margin %**. Tap a row for the breakdown (each ingredient line and each standard cost). Mobile: cards with total cost and margin; breakdown in the sheet. This is also the data behind the Production costs tab and the margin figure on the order.

### 6.4 How the money adds up
```
 Revenue (what customers pay)
 − Direct order costs  = Ingredients (automatic) + Standard costs (automatic)
 = Gross profit
 − Operating expenses  = repairs, rent, utilities … (entered manually)
 = Net profit
```
- Wages: choose one treatment so they are not counted twice (`Optim_finance.md` B8 proposes payroll as the expense and job labour only as a view). Not part of this plan's first release.
- Per-order cost never includes operating expenses. A later option is to spread monthly overheads across orders; this is deliberately left out for now.

## 7. Other tabs

### 7.1 Invoices (if kept)
Columns: Invoice # · **Customer name** · Order # · Issue date · Total · Paid · Balance · **Status badge** (Draft / Issued / Part paid / Paid / Credited / Void). Row actions: View / print (PDF), Credit note (needs `finance.manage_invoices`). Mobile: card with number, customer, total and badge. Replace the raw customer ID with the name from the customer record.

### 7.2 Approvals (if kept)
Cards or rows: what is being approved (Reversal / Refund / Override), order # and customer, amount, reason, requested by and when, with **Approve** and **Reject** (reject needs a reason; the approver must not be the requester). If not kept, a "N pending" chip inside Payments links to the same list.

### 7.3 Profitability (with Reports and Period close merged)
- Month selector (This month, Last month, pick a month) instead of the day / week / month / year dropdown.
- Statement table in the order shown in 6.4, with **operating expenses broken down by category** and **direct costs split into Ingredients and Standard costs**.
- Per-order margin list under it (revenue, cost, margin %), sorted by lowest margin first.
- **Download** buttons (CSV / PDF) replace the Reports tab.
- **Close month** button: checklist (unpaid orders, pending approvals, expenses without a category) then a confirm step; past months show Open / Closed. Remove the hard-coded "October 2026".

### 7.4 Cash-up (if kept)
Driver picker (not free text), expected cash filled from that driver's cash-on-delivery orders, counted amount, automatic variance and an optional reason, and a history list below. No page reload; the list refreshes in place. Mobile: single-column form and history cards.

### 7.5 Overview (new Finance page, if added)
```
 Collected      Outstanding      Expenses       Net profit        (this month)
 UGX 4.8M       UGX 620K         UGX 1.1M       UGX 1.9M
 Needs attention: 3 orders unpaid and due within 2 days · 1 approval pending
 Recent payments (5)            Spend by category (bar list)
```
Each number opens the matching tab (Outstanding → Order payment status, Expenses → Operating expenses).

## 8. Shared layout rules (desktop and mobile)

- **Tab bar:** on mobile a horizontally scrolling pill row with the active tab centred (same pattern as the Sales and Production stage tabs).
- **Forms:** inline card or centred dialog on desktop; **bottom sheet** on mobile with a sticky Save button (44px).
- **Tables on mobile:** cards with the main fact large on the right (amount), two lines of context, a left accent bar by status, and a drawer for the rest.
- **Status badges** for every status, with the same tone mapping everywhere; urgency and status always in text as well as colour.
- **Summary strip** above each list (count and total for the current filter).
- **Empty and loading states** with a hint of the next action.
- Reuse the shared `DataTable` card renderer and the `.oc` card shell from the Sales plans.

## 9. Implementation phases

### Phase 1: Payments and Order payment status (your first two asks)
1. Add customer name, order # and product summary to the payments data (server join; sample-mode fallback).
2. New columns and mobile cards; **remove "Received by"** (column, form field, search, request field).
3. Order picker in the Record payment form, balance summary, overpay warning; bottom sheet on mobile.
4. Order payment status sub-tab: Paid, Balance, badge, filter chips, summary strip; derive Paid from payments.
5. Shared payment-status helper (also used by the Sales tables).

### Phase 2: Operating expenses
Seed and manage categories, new form fields (payee, receipt, optional order), void instead of delete, table, mobile cards, month filter and totals.

### Phase 3: Standard costs (automatic)
Migration (`auto_apply`, `starts_on`, `source`, unique index), settings screen, auto-create entries when baking starts, include them in job cost, margin, `/jobs/:id/costs` and report `directCosts`, tests, optional back-fill tool.

### Phase 4: Order costs view and Profitability
Order costs table with breakdown; Profitability statement (direct costs, operating expenses by category, net profit), per-order margins, month picker, downloads.

### Phase 5: Finance page structure
Overview tab, tab clean-up (remove Reports, merge Period close, decide Approvals / Cash-up / Invoices), tab bar on mobile.

### Phase 6: Remaining tabs
Invoices polish (names, badges, print), Approvals actions (if kept), Cash-up and Period close rebuilt without `document.getElementById` or page reloads (if kept).

### Phase 7: Verify
- Widths 360, 390, 430, 768, 1024, 1280, 1536; light and dark.
- A payment shows the right customer and product; no "Received by" anywhere (UI, search, API response used by the UI).
- Paid, Balance and the badge agree with the sum of payments; part payments move an order from Unpaid to Part paid to Paid; an overpay is warned.
- Standard costs: starting a bake adds one entry per active cost; a second start or retry does not add another; a cancelled order has none; changing an amount does not change past orders; order cost, margin and Profitability show the same figure.
- Operating expenses reduce net profit but never an order's cost.
- Run existing tests, `npx tsc --noEmit`, `npm run build`; add server tests for the standard-cost automation and the cost totals.

## 10. Files touched

| File | Change |
|---|---|
| `src/components/erp/finance-view.tsx` | Split into smaller tab components; Payments, Order payment status, Expenses (3 parts), Profitability, tab changes |
| `src/components/erp/finance/*` (new) | Tab components, order picker, standard-cost settings, shared payment-status helper |
| `src/lib/api.ts` | Payment (enriched), expense, category and standard-cost calls |
| `src/styles.css` | Finance cards, summary strips, segmented control, bottom sheets, status badges |
| `server/routes/payments.ts`, `finance.ts` | Enriched payments list; remove `receivedBy` from the UI contract; margin and reports include standard costs; month list and close checklist |
| `server/routes/expenses.ts` | Category seed and management, payee, optional order link, void |
| `server/routes/production-costs.ts` | Standard cost settings endpoints; entries include `source` |
| `server/services/costing.service.ts`, `business.service.ts` | Include standard cost entries in job cost; create `AUTO` entries when baking starts |
| `server/migrations/` (new) | `auto_apply`, `starts_on`, `source`, unique index; expense category kind / active; expense payee, order link, void columns |
| `src/test/` and server tests | Cost totals, automation, payment status |

## 11. Decisions needed

Already decided by you: remove "Received by"; show customer name and product on payments; Order payment status shows paid, left and badge; expenses must cover non-order costs; standard per-bake costs are automatic; repairs and maintenance are recorded as operating expenses.

1. **Overview page:** add the new Finance landing page (7.5), or keep opening on Payments?
2. **Order payment status default:** show only unpaid and part-paid orders (my suggestion, with filter chips for the rest), or all orders?
3. **Payment methods:** Cash and M-Pesa only, or add Airtel Money and Bank?
4. **Invoices:** do you issue invoices to customers? If not, hide the tab.
5. **Approvals:** do reversals and refunds need a second person to approve? If not, remove the tab.
6. **Cash-up:** do drivers collect cash on delivery? If not, remove the tab.
7. **Period close:** do you need month-end locking? If so, merge it into Profitability as "Close month"; if not, remove it.
8. **Standard costs charged per:** per bake (one charge per order's bake), or per cake / per item in the order? My suggestion: per bake to start.
9. **Standard cost trigger:** charge when baking starts (my suggestion), or when the order is confirmed?
10. **Existing orders:** apply the standard costs only from a start date forward (my suggestion), or also back-fill past orders?
11. **Optional order link on operating expenses:** keep the "Linked order" field, or leave expenses always business-wide?
12. **Who manages standard costs:** the existing production permission, or a new finance permission?

## 12. Risks

- **Double counting.** Electricity entered both as a standard cost and as a monthly bill is counted twice. The category hint in 6.1 helps, but you should pick one approach per cost.
- **Changing cost totals changes reported profit.** Once standard costs flow into margin and `directCosts`, historic and new months are not comparable without a start date (decision 10).
- **Payment status derived from payments.** Orders whose `paidAmount` and payments disagree today will change status when the new rule is applied; review a list of the differences before release.
- **Server joins and new columns** need migrations and a backup; payments are append-only, so no payment rows are edited.
- Removing "Received by" from the UI should not remove the audit trail: keep the actor in the audit log.
- Production job transitions are being changed in `Production_Layout_Optimization.md`; the standard-cost trigger (baking starts) must follow that final status flow.

## 13. Suggested order

Phase 1 (Payments and Order payment status) → Phase 2 (Operating expenses) → Phase 3 (Standard costs) → Phase 4 (Order costs and Profitability) → decisions on the other tabs → Phases 5 and 6 → Phase 7.
