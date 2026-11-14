# Finance → Payments: Table Filters Layout Adjustment Plan (Desktop and Mobile)

Scope: the **filter bar above the Payments table** (search box + method select) and the strip of information around it (count, totals, active filters), on **desktop and mobile**. The **Order payment status** table below it shares the same search box, so it is covered where it matters.
Goal: filters that fit one row on desktop, collapse sensibly on a phone, show what is applied, and show the totals for what is on screen.
Audit basis: the `twin_cakery_production-main` build (`erp-interface-design/`).
Files: `src/components/erp/finance-view.tsx`, `src/styles.css`, `src/lib/api.ts`, `src/lib/density.ts` (existing hook).
Companion plans: `Finance_Layout_Optimization.md` (section 4.3 already calls for "search, method filter and date range" and mobile chips; this plan details that), `CRM_Customer_History_Layout.md` (list header, sort and filter chip pattern), `Production_Mobile_Cards.md`.

> Method note: read from the code only; I haven't viewed the screen on a device. Section 2 lists what to check in the browser.

---

## 1. How the filters work today

In `FinanceView`, tab **Payments**, from top to bottom:

1. "Processing" banner (if any orders are processing).
2. Record payment: on desktop an inline form (Order, Amount, Method, Reference) with a button; on mobile a single "Record payment" button that opens a dialog.
3. **Filter bar** (`div.table-controls`): one `search-box` (placeholder "Search payments, orders, references…") and one `filter-select` with a **Method** dropdown: All methods, Cash, M-Pesa, Card, Bank transfer, Cheque.
4. `DataTable` of payments (Order, Amount, Method, Reference, Date, Received by).
5. `table-foot`: "N payments" and "M recorded in total".
6. A plain "Order payment status" heading and a second table, filtered by the **same search text** but not by method.

Behaviour:
- Search text is one shared `search` state for Payments, Order payment status and Expenses (it is cleared by `setSearch("")` at line 265, apparently on tab change; confirm).
- Search matches `orderId`, `reference`, `method` and `receivedBy` only.
- Method filtering is exact match on `p.method`.
- Sorting is by the table header (`paySort`), separate from the filters.

CSS (`styles.css`): `.table-controls` is `display:flex; justify-content:space-between; padding:16px 24px`; `.search-box` is `max-width:320px`; `.filter-select select` is `max-width:120px`; fonts 11px. On mobile (`max-width: 767.98px`) both controls become `flex: 1 1 100%`, so they stack as **two full-width rows** (44px each).

## 2. Problems found

### 2.1 Desktop
1. **Only two filters.** No date range, no amount filter, no way to see "today", "this week" or "this month", which is what a cashier checks first.
2. **Method list does not match what staff can record.** The record form offers Cash and M-Pesa only, the filter lists five methods. Methods with no payments still appear.
3. **Search is too narrow.** It cannot find a customer or product (the payment row has neither yet), and it still searches `receivedBy`, which the Finance plan removes.
4. **Controls are pushed apart.** `justify-content: space-between` puts the search at the far left and the select at the far right with a wide gap; at 1280px+ it looks disconnected, at 768–1000px it can wrap unevenly.
5. **Filter bar sits below the record form and M-Pesa confirm block**, so on a short screen the table starts below the fold.
6. **No applied-filter feedback.** Nothing says a filter is active, and there is no "Clear" button. Someone can leave the method on "Cash" and wonder where the M-Pesa payments went.
7. **No totals for the filter.** The foot shows a count, but not the amount collected for what is on screen.
8. **Tiny type.** 11px text in the box and select is hard to read and hard to hit with a mouse.
9. **Search is not debounced and has no clear (×) button.**
10. **The select is a native dropdown**, so the list is not visible at a glance; for 5 methods a row of chips is quicker.

### 2.2 Mobile
11. **Two stacked full-width rows** (search, then select) take about 100px before the first payment card. With the Record payment button above them, the list starts low.
12. **Not sticky.** Scrolling down the card list hides the search; you scroll back up to change a filter.
13. **Native select on a phone** is fine for accuracy but slow for the one filter used most (method).
14. **No date filter and no totals**, same as desktop.
15. **Order payment status below uses the same search box but it is far away**; the person types in the top box and sees changes 20 cards lower, with no hint.

### 2.3 Shared
16. **Shared `search` state** across three tabs: typing "TC-1044" in Payments and switching tabs may keep or clear it depending on line 265; this is not visible to the user either way.
17. **Filters are not remembered** when the tab is reopened or the page refreshed (5-second live refresh keeps state, a reload does not).
18. **Accessibility:** the select and search have `aria-label`s, but there is no live region announcing "N payments"; focus styles depend on the global input rule.

## 3. Decisions (proposed; please confirm)

| # | Question | Proposal |
|---|---|---|
| 1 | Filters offered | **Search, Method, Date range** (Today / This week / This month / Custom), plus a **Clear** button. Amount filter and status filter are not added now |
| 2 | Method control | **Chips** (All, Cash, M-Pesa, and "More ▾" for Card, Bank transfer, Cheque) on desktop; **horizontal scroll chips** on mobile |
| 3 | Method list | Show **only methods that exist in the data** plus Cash and M-Pesa; the rest under "More" |
| 4 | Default date range | **This month** (not All time), with an "All time" option |
| 5 | Mobile placement | **Sticky** compact row: search + a **Filters** button with a count badge; chips on a second line that scrolls sideways |
| 6 | Totals | Foot and summary strip show **Count · Total collected** for the current filters |
| 7 | Search fields | Order #, reference, method, **customer and product** (once the data join from the Finance plan lands); **not** `receivedBy` |
| 8 | Search state | **Separate per tab** (Payments, Order payment status, Expenses each keep their own) |
| 9 | Remember filters | Per device, in `sessionStorage`-style memory for the session only; reset on logout |
| 10 | Record payment button | Moves into the filter header (right end on desktop, sticky footer button on mobile) |

## 4. Target design

### 4.1 Desktop (≥ 768px)

Two rows inside one `.pay-filters` panel header, left-aligned, one row at ≥ 1100px.

```
 Payments                                         [ + Record payment ]
 ┌──────────────────────────────────────────────────────────────────┐
 │ 🔍 Search customer, order, reference…   [×]   📅 This month ▾    │
 │ ( All ) ( Cash ) ( M-Pesa ) ( More ▾ )               Clear all   │
 └──────────────────────────────────────────────────────────────────┘
 Showing 24 payments · UGX 3,420,000 collected          Sort: Date ▾
 ─ table ───────────────────────────────────────────────────────────
```

- Row 1: search (flex: 1, min 240px, max 420px) + date range select. Row 2: method chips on the left, "Clear all" (text button, only when something is changed) on the right. At ≥ 1100px both rows can merge into one line.
- **Summary line** directly above the table: "Showing N payments · UGX X collected", updated live; `aria-live="polite"`.
- Controls 36px high, font 13px; chips 32px high with a visible selected state (filled) and text, not colour alone.
- Active filters beyond the defaults show as removable chips under the row ("Cash ×", "1 Nov – 13 Nov ×").
- Sticky: the filter panel sticks under the page header inside the scrolling panel (`position: sticky; top: 0`), so the table header and filters stay visible together.
- The Record payment form (inline) moves **below** the filters into a collapsed card opened by the header button (this follows the Finance plan 4.2), so the table starts higher.
- The foot keeps "N payments" and the total, and "M recorded in total" is dropped when no filter is active.

### 4.2 Mobile (≤ 767.98px)

```
 ┌────────────────────────────────────┐
 │ 🔍 Search payments…       [ ⚙ 2 ] │  sticky row, 44px
 │ ( All )( Cash )( M-Pesa )( Card )→ │  scrolling chips, 36px
 │ 24 payments · UGX 3.42M            │  summary line
 ├────────────────────────────────────┤
 │ payment card                        │
 │ payment card                        │
 └────────────────────────────────────┘
               [ + Record payment ]      sticky bottom button
```

- **Sticky** search row (search + Filters button) below the topbar, `top: var(--topbar-h)`, with the chip row scrolling away or staying (decision: chips stay, summary line scrolls).
- The **Filters** button opens a **bottom sheet** (same sheet pattern as the production drawer plan): Date range (radio list: Today, This week, This month, Custom with two date inputs), Method (chip list), then "Clear" and a full-width "Show N payments" button. The badge on the button shows how many filters differ from the default.
- Chips scroll horizontally with an edge fade (reuse `StageTabs` styling); active chip is centred.
- Inputs 44px high, font 16px so iOS does not zoom.
- "Record payment" becomes a **sticky bottom** button (safe-area padding) so it never pushes the list down.
- Summary line uses the short money format (`UGX 3.42M`) at ≤ 360px.
- Order payment status (sub-tab) gets its **own** search row in the same position, with chips All / Unpaid / Part paid (Finance plan section 5).

### 4.3 Empty and edge states
- No results: "No payments match these filters" with a **Clear filters** button (not "Record a payment against an order", which is the no-data message).
- No payments at all: current empty state.
- Very long search text: the input scrolls, the clear (×) stays visible.
- Custom date range with end before start: inline message and the Apply button disabled.
- Loading: skeleton rows; the filter panel is already usable.

### 4.4 Visual details
- One shared class set, `.filter-bar`, `.filter-chip`, `.filter-chip--active`, `.filter-summary`, reused later by Expenses and Order payment status; scoped under `.finance-view` because `.table-controls`, `.search-box` and `.filter-select` are shared with Sales, Inventory and others.
- Colours come from existing variables (`--card`, `--border`, `--primary`); selected chip uses text + fill, with a 3:1 contrast check in dark mode.

## 5. Data and logic

1. **Date filter**: filter on `payment.date` if present, else `createdAt`. Ranges are computed in local time (Africa/Kampala); "This week" starts Monday. Custom range is inclusive.
2. **Method list**: `methods = unique(payments.map(p => p.method))`, ordered Cash, M-Pesa, then the rest; the "More" menu holds methods beyond the first two.
3. **Totals**: `sum(filteredPayments.amount)`, computed from the same array used by the table so the two can never disagree. Reversed or refunded payments, once wired, are shown with a minus and counted in the total (check with the Finance plan).
4. **Search**: lowercase "contains" over order #, reference, method, and (when available) customer name and product summary. Remove `receivedBy`. Debounce 200ms.
5. **State**: a small `usePaymentFilters()` hook returning `{ search, method, range, from, to, setX, clear, activeCount }`, local to the Payments tab; Order payment status and Expenses get their own instance.
6. **Persist** the hook state in memory for the session (module-level store or `sessionStorage`); fall back silently if storage is unavailable.
7. **Server (optional, later)**: if the payments list grows large, add `from`, `to`, `method`, `q` query parameters to `GET /payments` and return a `total` for the filter; the UI works client-side until then.
8. **Live refresh**: the 5-second refresh keeps filters and focus; the summary updates, the row the user is looking at does not jump.

## 6. Implementation phases

### Phase 1: Layout and CSS (no new logic)
1. Replace the `.table-controls` block in the Payments tab with `.filter-bar` (search + method chips + a placeholder date control), left-aligned, with the correct widths and 36px / 44px heights.
2. Add the summary line above the table; keep the foot.
3. Remove the 11px font override for this tab; use 13px (16px inputs on mobile).
4. Move the Record payment button into the header (desktop) and a sticky bottom button (mobile).

### Phase 2: Date range, chips, clear, active filters
`usePaymentFilters`, date presets and custom range, method chips with "More", Clear all, removable active-filter chips, empty-after-filter state, totals.

### Phase 3: Mobile Filters sheet
Sticky search row with a Filters button and badge; bottom sheet with Date and Method; scrolling chips; apply and clear.

### Phase 4: Search quality
Remove `receivedBy`; add customer and product once the payments join exists; debounce; clear (×); separate search state per tab.

### Phase 5: Order payment status and Expenses
Give each its own filter bar using the same classes (chips All / Unpaid / Part paid for Order payment status; category chips for Expenses).

### Phase 6: Verify
- Widths 320, 360, 390, 430, 768, 1024, 1280, 1536; sidebar open and collapsed; light and dark; system text 100%, 130%, 200%.
- 0, 1, 24 and 500+ payments; methods with no payments; a payment dated today, yesterday, last month; custom range crossing a month end.
- The totals line equals the sum of the rows shown, and changes when each filter changes.
- Clear all returns to the default (This month, All methods, empty search); the badge count is right.
- Switch tabs and come back: each tab keeps its own filters; a hard reload resets them.
- Live refresh while a filter is active keeps the filter, focus and scroll position.
- The mobile filter row stays sticky under the topbar and does not overlap the sheet or the topbar; the sticky Record payment button does not hide the last card.
- Keyboard: Tab order is search → date → chips → Clear; Enter selects a chip; Esc closes the sheet and returns focus to the Filters button.
- Overflow check (should return nothing):
  ```js
  [...document.querySelectorAll('.finance-view .filter-bar, .finance-view .filter-bar *')]
    .filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible')
    .map(e => e.className || e.tagName)
  ```
- Run existing tests, `npx tsc --noEmit`, `npm run build`; confirm Sales, Inventory and Deliveries filter bars look unchanged.

## 7. Files touched

| File | Change |
|---|---|
| `src/components/erp/finance-view.tsx` | New filter bar, summary line, Filters sheet, `usePaymentFilters`, separate search per tab, remove `receivedBy` from search |
| `src/components/erp/finance/payment-filters.tsx` (new, optional) | The bar, chips and sheet as a small component, reusable for Expenses |
| `src/styles.css` | `.finance-view .filter-bar`, chips, summary line, sticky behaviour, mobile sheet; no changes to the shared `.table-controls`, `.search-box`, `.filter-select` rules |
| `src/lib/api.ts` | None now; optional `from/to/method/q` parameters later |
| `src/test/` | Tests for the date presets, method list, totals and Clear |

## 8. Risks

- **Shared CSS.** `.table-controls`, `.search-box` and `.filter-select` are used across modules; new rules must stay under `.finance-view` / `.filter-bar`.
- **Default date range = This month** will hide older payments that staff used to see. Make the active "This month" chip obvious, keep "All time" one tap away, and mention it in the summary line ("This month").
- **Client-side filtering** is fine at today's volumes; at several thousand payments the server parameters (5.7) become necessary.
- **Totals and reversals:** how reversed or refunded payments are stored is not final (Finance plan 2.1 item 5); confirm before showing a "collected" total that could be wrong.
- **Customer and product search** depends on the payments data join from the Finance plan; until it ships, search stays order #, reference and method, and the placeholder text must match.
- **Sticky areas on mobile** (topbar, filter row, bottom Record payment button) can crowd small screens; check at 320px and in landscape.
- Do not touch the topbar and sidebar mobile work, the Sales order cards, or the production drawer work.

## 9. Open points

1. **Default date range**: This month, or All time?
2. **Method chips vs dropdown on desktop**: chips with "More ▾" as proposed, or keep one dropdown?
3. **Any other filters you want** (amount range, received by, payment status, reversed only)?
4. **Search**: should the Order payment status table keep its own search, or share the Payments one?
5. **Totals**: show "collected" only, or also count of orders paid?
6. **Record payment button**: header on desktop and sticky bottom on mobile, or keep the inline form?

## 10. Suggested order

Phase 1 (layout and CSS) → Phase 2 (date range, chips, totals) → Phase 3 (mobile sheet) → Phase 4 (search) → Phase 5 (other tabs) → Phase 6 (verify). Phase 4's customer and product search ships together with Phase 1 of `Finance_Layout_Optimization.md` (the payments data join).
