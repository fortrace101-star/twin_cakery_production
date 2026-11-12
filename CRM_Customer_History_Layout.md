# CRM → Customers: One Entry per Customer, with Orders and Occasions Under It

Scope: the **CRM → Customers** list and the detail section that shows a customer's **orders** and **occasions** (plus feedback), on **desktop and mobile**.
Goal: every customer appears **once**, identified by **phone number**. A new order, occasion or feedback is added **under** that customer, never as a new row.
Audit basis: the `twin_cakery_production-optim-fin-sec-unify` build.
Files: `src/components/erp/data.ts`, `module-table.tsx`, `crm-view.tsx`, `crm-panels.tsx`, `src/lib/api.ts`, `src/styles.css`, `server/routes/customers.ts`.

---

## 1. Why customers repeat today (root cause)

The contact list is built from **orders**, not customers:

- `ModuleTable` (`module-table.tsx`) calls `moduleRows('crm', tab, orders)`.
- In `data.ts`, the `crm` branch is `orders.map((o, i) => ({ id: 'CUS-00' + (i+1), name: o.customer, detail: o.channel + ' · ' + (i+1) + ' orders', value: money(o.amount), status: 'Active' ... }))`.

So there is **one row per order**:
- A customer with 3 orders appears 3 times.
- The `CUS-00n` ID is the row index, not a customer ID.
- "N orders" shows the row number, not the real count.
- The amount is that single order's amount, not the customer's total.
- The Feedback tab has the same problem, plus hard-coded sample feedback text.
- The detail pane then looks the customer up **by name** (`findCustomerByName`), so duplicate rows all open the same customer, and two customers with the same name would collide.

**The database also allows duplicates.** In `001_core.sql` the `customers` table has `phone TEXT NOT NULL DEFAULT ''` with no unique constraint (only a name index), and `POST /customers` does not check for an existing phone. So the same person can exist as several customer records. Each order also stores a frozen contact snapshot (`008_order_history.sql`: `snapshot_name`, `snapshot_phone`).

The `Order` type used by the UI has no phone field at all, which is why the list cannot merge on phone today.

## 2. Other problems in the orders / occasions section

1. **Almost no CSS for the detail pane.** 40+ `crm-*` classes (header, KPI strip, tabs, sections, cards, panel head) have no rule in `styles.css`.
2. **"Last order" is wrong.** `useCustomerContext` sorts orders ascending by `requiredAt` and takes `[0]`, which is the **oldest** order, and it uses the due date, not the placed date.
3. **Numbers repeated** in the header strip and again in Overview "Summary".
4. **Order history rows are thin** and the open arrow does nothing.
5. **Occasions tab is a global list by month / week**; inside a customer, occasions are on a separate tab from orders.
6. **Possible hook-order bug.** In `CrmView`, `if (tab === "Occasions") return <OccasionsView/>` runs before `useLiveRefresh(...)`.
7. **Dead controls:** Edit, Add customer, Add occasion and header Print do nothing; "Customer type: External" is hard-coded.
8. **Mobile sheet:** the hand-placed close button can overlap the header actions.
9. **Legacy duplicate panels** in `crm-panels.tsx` (`CustomerE1Panels`, `OrderHistoryPanel`, `OccasionsPanel`, `FeedbackPanel`, `RemindersPanel`) show the same data in an older layout.

## 3. Decisions (settled)

| # | Question | Decision |
|---|---|---|
| 1 | Walk-in / anonymous orders | **Merge** into one entry ("Walk-in customers") |
| 2 | How to match the same customer | **Phone number** (not name). Display name = the name on the customer's **first order** |
| 3 | Default list sort | **Most recent order**, plus a sort control (see 4.2) |
| 4 | Occasions tab default | **By date** |
| 5 | Order row fields | Keep what it shows now; adjust later |
| 6 | Click an order | **Opens the Sales order detail** |
| 7 | Buttons | **Edit: yes. Add occasion: yes (kept). Add customer: no** (customers are created by placing an order, not in CRM) |
| 8 | Phone format | Numbers are entered locally as **07XXXXXXXX** (Uganda). Matching accepts other formats but the app shows and stores the local format |
| 9 | Sort options | Confirmed as listed in 4.2 |
| 10 | Edit scope | Confirmed: display name, phone, email, address(es), preferred contact method, notes, status |
| 11 | Server-side dedupe | **Do now**, alongside the UI merge (Phase 1 and Phase 5 run together) |

## 4. Target design

### 4.1 One entry per customer (same data on desktop and mobile)

```
┌───────────────────────────────────────────┐
│ (AB)  Aisha Birungi            [Active]       │
│       CUS-0042 · 0772 123 456                 │
│       5 orders · UGX 1.2M · Last order 3 Nov  │
│       🎂 Birthday in 12 d    ● UGX 85,000 due │  (chips only when relevant)
└───────────────────────────────────────────┘
```

- One row per customer. Fields: avatar, display name (first order's name), real customer ID, phone, order count, total spend, last order date, next-occasion chip, balance-due chip, status.
- Header shows "N customers".
- Search matches name (display name and any name used on their orders), ID, phone and email.
- Desktop: left list (220–320px) with its own scroll. Mobile: full-width rows, 44px minimum height, open the detail sheet.
- The **Walk-in customers** entry is pinned in the list, labelled clearly, and shows the combined orders of all orders with no phone number. It has no Edit button and no occasions.

### 4.2 Sort control (list header)

Default: **Most recent order**. Options:

| Option | Sorts by |
|---|---|
| Most recent order | Latest order date, newest first (default) |
| Name A–Z / Z–A | Display name |
| Total spent | Highest first |
| Most orders | Order count, highest first |
| Balance due | Largest outstanding balance first |
| Next occasion | Soonest upcoming occasion first |
| Customer since | Date of first order, oldest first |

Desktop: a compact select above the list. Mobile: a sort button that opens a bottom sheet (or a native select). The chosen sort is kept while the tab is open. Optional quick filter chips under the search box: With balance due, Occasion soon, Active only.

### 4.3 Customer detail: everything under the one entry

```
 (AB) Aisha Birungi  [Active]                 [Edit] [⎙]
 CUS-0042 · 0772 123 456 · aisha@…
 ─ 5 orders │ UGX 1.2M spent │ Avg UGX 240K │ Last order 3 Nov ─
 Overview | Orders (5) | Occasions (2) | Feedback (3)
```

- KPI strip appears **once** (remove Summary from Overview).
- **Orders tab:** all of this customer's orders (from every merged record), newest first, in the fields it shows now. Clicking a row (or the arrow) opens the Sales order. Status filter chips and a totals foot.
- **Occasions tab:** this customer's occasions and upcoming reminders as cards (date block, type, repeat rule, notes, next reminder), with a working **Add occasion** button (the `POST /customers/:id/events` endpoint already exists) and edit / delete on each card.
- **Overview:** contact card, next occasion, last 5 orders, latest feedback, each with "View all".
- **Edit button:** opens an edit form (section 5, Phase 4).
- Mobile: same tabs, sticky under a proper sheet header (title, close, "⋯" menu for Edit / Print); orders and occasions render as cards using the Sales order card language (left accent bar by status, 44px tap targets).

### 4.4 Occasions tab (global view)
Opens **By date** (as now: Month / Week / Custom). Each row links to its customer. Optional later: a By customer toggle.

## 5. Data and logic

### 5.1 Phone normalisation (key for matching)
Staff enter numbers locally as `07XXXXXXXX`, so **that is the canonical format**. One shared helper, `normalizePhone(raw)`:
1. Strip spaces, dashes, brackets and dots.
2. Convert every variant to the local 10-digit form `07XXXXXXXX`:
   - `0772123456`, `0772 123-456` → `0772123456` (already local)
   - `+256772123456`, `256772123456`, `00256772123456` → `0772123456`
   - `772123456` (9 digits, leading 0 missing) → `0772123456`
3. The **match key** is the normalised number. The value staff typed is kept as entered and shown as `0772 123 456` (display grouping only); the app never forces the `+256` form on staff.
4. Empty phone → the **Walk-in** group.
5. Numbers that don't fit the pattern (under 9 digits, landlines, foreign numbers) are **not** merged with anything; they stay with their own customer record, so a typo never lumps strangers together. Foreign numbers match only on an exact digit match.
6. Country code is one constant (`+256`) in case it ever changes. (Uganda's code is +256.)

### 5.2 `buildCustomerRows(orders, serverCustomers)` (replaces the crm branch of `moduleRows`)
1. Add `customerPhone` (and `customerId`) to the UI `Order` type, filled by the server-order mapper in `lib/api.ts` from the customer record (or the order's contact snapshot), and given sample values in `data.ts` so sample mode can merge too.
2. Group by `normalizePhone(phone)`. Each group holds every `customerId` that shares that number.
3. Per group compute: `orderCount`, `totalSpend`, `lastOrderAt` (latest **placed** date), `firstOrderAt`, `balanceDue`, `openOrders`, `nextOccasion`, `customerIds[]`.
4. **Display name** = name on the group's **first (earliest) order**. If staff edit the name in Edit, the edited name overrides it.
5. **Stable ID** = the oldest customer record's real ID (not the row index). Keep the other IDs in `customerIds`.
6. Detail components take the group (all `customerIds`), load orders / events / feedback for each ID and combine them, instead of calling `findCustomerByName`.
7. Fix `lastOrder`: sort **descending** by placed date.
8. Feedback tab uses the same customers with average rating and count (no per-order sample text).

### 5.3 Server side (do now, alongside the UI merge; the UI merge alone only hides the duplicates)
- On order creation and `POST /customers`: look up an existing customer by normalised phone (`07XXXXXXXX`) and reuse it instead of creating a new record.
- Normalise on write too: store the local `07XXXXXXXX` form so the database and the UI agree.
- One-off migration to merge existing duplicate records: keep the oldest, reassign `orders`, `customer_events`, feedback and reminders to it, and keep each order's frozen snapshot unchanged (rule 27).
- Add `phone_normalized` on `customers` with an index. Make it unique (for non-empty valid numbers) only **after** the one-off merge has run.
- Optional endpoint (e.g. `GET /customers/grouped`) returning the merged entries with aggregates, so the browser doesn't fetch orders for every customer.
- Check where orders currently create customer records (store / order-creation code, public order proposals) before changing this.

### 5.4 Edit customer (form)
Fields: display name, phone, email, address(es), preferred contact method, notes, status. Uses the existing `PATCH /customers/:id` (needs `customers.edit`). Changing the phone changes how the customer matches, so show a short warning and re-run the merge. Order snapshots are never rewritten.

## 6. Implementation phases

### Phase 1: Data (removes the repetition)
`normalizePhone`, `Order.customerPhone` / `customerId`, `buildCustomerRows`, wire into `ModuleTable`, switch the detail components to customer IDs, fix `lastOrder`. Unit tests: same phone on 3 orders → 1 row with the right count and total; phone format variants merge; same name with different phones stays separate; no phone → Walk-in; short invalid number not merged; display name is the first order's; last order is the newest.

### Phase 2: Missing CSS for the whole CRM pane
One `/* CRM detail */` block in `styles.css`: list row, header, KPI strip, tabs, sections, cards, panel head, notes. Sticky header and tabs; pane `max-height` with internal scroll; mobile padding and 44px targets; dark mode.

### Phase 3: List and header
New row layout (4.1), sort control (4.2), "N customers", single KPI strip, remove the duplicate Summary and duplicate status badge, remove the Add customer button (keep Add occasion), new mobile sheet header.

### Phase 4: Orders, Occasions and Edit
Orders tab (clickable rows open the Sales order, filter chips, totals foot); Occasions cards with working Add occasion; Overview two-column with "View all"; working Edit form (5.4). Check what `ServerCustomerOrder` returns and add placed date or other fields only if missing.

### Phase 5: Server-side dedupe (runs together with Phase 1)
Find-or-create by normalised phone, normalise-on-write, `phone_normalized` column, one-off duplicate merge (backup first), optional grouped endpoint (5.3). Ship it with Phase 1 so new orders stop creating duplicates while the UI starts grouping existing ones.

### Phase 6: Global Occasions view and clean-up
Move `useLiveRefresh` above the early return; customer link on each occasion row; delete unused legacy panels in `crm-panels.tsx` and their CSS (after confirming nothing renders them).

### Phase 7: Verify
- Widths 360, 390, 430, 768, 1024, 1280, 1536; light and dark; customers with 0, 1 and 100+ orders; long names and notes; sample mode and connected mode.
- A customer who orders again with a different name spelling or phone format still lands under the same entry.
- Opening and closing the mobile sheet keeps the list scroll position.
- Print output unchanged.
- Run existing tests, `npx tsc --noEmit`, `npm run build`.
- Accessibility: tab roles, focus order in the sheet, status by text and not colour alone.

## 7. Files touched

| File | Change |
|---|---|
| `src/components/erp/data.ts` | `normalizePhone`, `buildCustomerRows`, `Order` type gets phone / customer ID, sample data phones |
| `src/lib/api.ts` | Fill phone / customer ID in the server-order mapper |
| `src/components/erp/module-table.tsx` | Use the aggregator; pass customer IDs |
| `src/components/erp/crm-view.tsx` | List row, sort control, header, KPI strip, tabs, Orders / Occasions / Overview, Edit form, hook order, sheet header |
| `src/components/erp/crm-panels.tsx` | Remove legacy duplicate panels |
| `src/styles.css` | CRM block; remove unused `.crm-thread` / `.crm-msg` rules |
| `server/routes/customers.ts`, order creation, migration | Find-or-create by phone, merge script, optional grouped endpoint (Phase 5) |
| `src/test/` | New tests for phone normalisation and grouping |

## 8. Risks

- **Shared phone numbers.** Family members or a business using one number will merge into one entry. That is the chosen rule; it is why the name on each order is kept and shown in the order row.
- **Display IDs change** (row-index `CUS-001` → real customer IDs). Check anything that stored or linked the old IDs (e.g. `followUps`, tests).
- **Merging records on the server is not easily reversible**; back up and run on a copy first. Because the server work now ships with Phase 1, this is the riskiest step: do it in a staging copy and review the list of merged groups before applying.
- Phone matching assumes local Ugandan numbers (`07…`); foreign numbers only match on an exact digit match.
- Placed date and order fields depend on what the customer-orders API returns.
- Scope new CSS under `.crm-view` / `.crm-detail`, because `.configuration-list` and `.table-foot` are shared with other modules.
- Don't touch the Sales order card or Kanban work, or the topbar and sidebar mobile work.

## 9. Open points

None blocking. Items to revisit later: the exact order-row fields (you will adjust these), and any occasions-by-customer toggle on the global Occasions view.

## 10. Suggested order

1. **Phase 1 + Phase 5 together:** UI grouping by phone and server-side find-or-create / one-off merge (staging copy first).
2. Phase 2 (CSS) → Phase 3 (list and header) → Phase 4 (orders, occasions, Edit) → Phase 6 → Phase 7.
