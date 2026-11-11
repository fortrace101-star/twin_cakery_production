# Mobile Sales → Orders Card Redesign Plan

Scope: the order cards shown on **Sales → Orders** on mobile (`max-width: 767.98px`), in both Table and Kanban views.
Frontend root: `erp-interface-design/src/`

---

## 1. What's there today

On mobile, **Sales → Orders** has two views. Both look rough.

**Table view becomes a card list.** `OrderTable` (`components/erp/module-table.tsx`) passes columns to `DataTable` (`components/data-table/DataTable.tsx`). On phones `DataTable` renders `<ul class="dt-cards">`:

| Piece | Source |
|---|---|
| Title | "Order / customer" cell (avatar + name + `#id`) |
| Meta (max 2) | Product, Due date |
| Badges (max 2) | Order status, Payment |
| Side | Amount + chevron |
| Drawer | Delivery status (other fields repeated) |

**Kanban view** (`salesKanban` in `components/erp/workspace.tsx`) renders `.order-card` divs with inline styles: ID, customer, product, amount, all in 11–12px muted text.

## 2. Root causes

1. **The table-view cards are unstyled.** `styles.css` defines only `.dt-cards` (a list reset). Missing: `.dt-card`, `.dt-card-main`, `.dt-card-body`, `.dt-card-title`, `.dt-card-meta`, `.dt-card-badges`, `.dt-card-side`, `.dt-card-value`, `.dt-drawer*`, `.dt-sort`. The card is browser-default inline flow with no spacing, and the tint class from `rowClassName` has nothing to paint. This is almost certainly the main cause.
2. **Desktop cell styles leak into cards.** Cells carry table CSS (`.customer-cell strong` 12px, `.cell-sub` 11px, `white-space: nowrap` from `.orders-table`), which doesn't suit a ~360px card. The paid amount under the price shifts the right column.
3. **Weak hierarchy.** Customer, product, date, amount and two badges have similar weight. Nothing signals urgency (due date, balance owed).
4. **Kanban cards use inline styles.** They ignore the `.order-card` rules (which target `.order-card .order-card` and nested selectors, so they only half-apply) and show no status, payment or due date.
5. **Touch ergonomics.** The row is a `role="button"` with no minimum height or pressed state, and the chevron takes space but adds little.

## 3. Target card layout (table view)

```
┌─────────────────────────────────────────┐
│ (AB) Aisha Birungi            UGX 450,000   │  row 1: avatar + customer | amount
│      #ORD-1042            (200,000 paid)    │         ID small, paid-so-far under amount
│ ─────────────────────────────────────── │
│ Chocolate cake · 2 kg                       │  row 2: product + top 2 options
│ Sat 14 Nov · 3:00 PM          Delivery      │  row 3: due date | delivery type
│ [● In production] [● Part paid]             │  row 4: status badges
│ ▰▰▰▱▱                                       │  row 5: mini progress strip
└─────────────────────────────────────────┘
```

- **Left accent bar** (4px) in the status tone, replacing the desktop vertical progress stepper (hidden on mobile today).
- **Mini progress strip**: thin 5-segment bar using the existing `orderStageIndex` and tone, giving the stepper's information horizontally.
- **Due-date emphasis**: overdue or due today shown in `--red-ink` or bold; balance due can get the same treatment.
- **Tint**: card body stays `--card`; the tint colours only the accent bar and badges, so text contrast holds in dark mode.

## 4. Implementation phases

### Phase 1: Add the missing styles (quick win, CSS only)
File: `src/styles.css`, inside the existing mobile `@media`.
- `.dt-cards`: `display:grid; gap:10px; padding:12px 16px`.
- `.dt-card`: `border:1px solid var(--border); border-radius:12px; background:var(--card); overflow:hidden; border-left:4px solid <status tone solid>`.
- `.dt-card-main`: grid, `min-height:var(--tap)`, `padding:12px 14px`, `:active` pressed state, `-webkit-tap-highlight-color: transparent`.
- Re-enable wrapping in cards: `.dt-card .customer-cell strong, .dt-card .product-name { white-space: normal }`.
- Type scale: title 15px/600, meta 13px, sub-text 12px, badges 12px.
- Style `.dt-sort` (full width, 44px tall, 16px font to avoid iOS zoom) and `.dt-drawer-*` (label/value rows, sticky footer).

Result: a legible card with no logic change. Also benefits every other module using `DataTable`.

### Phase 2: Order-specific card renderer
- Add optional `renderMobileCard?: (row, helpers) => ReactNode` to `DataTable`. When provided it replaces the generic title/meta/badge assembly and keeps the tap-to-drawer behaviour. Other modules are untouched.
- New file `components/erp/order-mobile-card.tsx` with `OrderMobileCard` using the layout above.
- `OrderTable` passes it only when `!compact`.
- Reuse `Status`, `money`, `orderStageIndex`, `ORDER_STAGE_PIPELINE`, `tone`.
- Add `OrderProgressBar` (horizontal version of `OrderProgressStepper`); off-pipeline statuses (e.g. Cancelled) get no bar and a grey accent.
- Add a due-date helper: Today / Tomorrow / Overdue flag.

### Phase 3: Kanban cards
- In `workspace.tsx`, replace the inline-styled `.order-card` contents with the same `OrderMobileCard` (without the status badge, since the stage tabs already show it).
- Remove inline styles and the stacked `.order-card .order-card` CSS rules; consolidate into one `.order-card` block.
- Re-check Production kanban and station boards, which share these classes.

### Phase 4: Drawer and polish
- Drawer: group fields as Customer / Order / Payment / Delivery, full-width "Open order" button, show balance due.
- Sticky search/filter row on scroll; optionally horizontally scrollable status chips instead of the select.
- Optional: skeleton/empty state and a count line ("12 orders").

### Phase 5: Verify
- Widths: 360, 390, 430px; light and dark mode; long names/products (wrap or clamp to 2 lines).
- Tests: `order-stage-nav.test.tsx`, `active-orders.test.ts`, `markorder-paid.test.ts`, then `npx tsc --noEmit` and `npm run build`.
- Confirm desktop (≥768px) renders identically.
- Accessibility: keep `role="button"` and Enter/Space handling, 44px minimum tap target, status conveyed by text, not colour alone.

## 5. Files touched

| File | Change |
|---|---|
| `src/styles.css` | New card, drawer and sort styles; consolidate `.order-card` rules |
| `components/data-table/DataTable.tsx` | Optional `renderMobileCard` prop |
| `components/erp/module-table.tsx` | `OrderTable` passes the renderer |
| `components/erp/order-mobile-card.tsx` (new) | Card and progress bar |
| `components/erp/workspace.tsx` | Kanban card markup |

## 6. Order of work and risks

Do Phase 1 first and review on a phone, since it may fix most of the problem. Then Phases 2–3.

- **Shared CSS risk**: `.order-card` is shared with Production boards; test those after Phase 3.
- **Tint contrast**: some tone variables don't match their names (`--teal-soft` is lime-green, `--orange-soft` is cyan), so check accent colours against the real status mapping in `theme-tokens`.
- **Don't touch** the topbar/sidebar work recorded in `Mobile_progress.md`.


## 7. Implementation status and adjustments (Sales & Orders)

The table-view redesign has been implemented for **Sales → Orders** and extended to desktop for non-compact order lists:

- **Shared card renderer:** `components/erp/order-mobile-card.tsx` exports `formatDueDate`, `OrderProgressBar`, and `OrderMobileCard` (avatar/initials, amount + paid-so-far/balance emphasis, product/options, due date with urgency, delivery/payment/status badges, 7-segment stage progress). Sales kanban uses `OrderMobileCard` with `showStatusBadge={false}`.
- **DataTable / OrderTable:** `DataTable` supports `cardMode: 'auto' | 'table' | 'cards'` and optional `renderMobileCard` / `renderDrawerAction`. `OrderTable` (non-compact, used on Sales & Orders lists/history) renders **card view on all screen sizes** with `cardMode="cards"`, the order mobile card, and drawer actions; compact uses (e.g. dashboard recent orders) keep the auto/table behavior.
- **Desktop Due date:** the desktop Due date column uses `formatDueDate` (same label/urgency formatting as mobile) with the delivery type as the subline.
- **Mobile drawer next-stage action (Sales & Orders, non-compact):** the drawer shows a next-stage button derived from `ORDER_STAGE_PIPELINE` via `updateOrder`, closes the drawer on success, and falls back to "Open order" at the final stage. Labels: `Confirmed`→"Confirm", `In production`→"Start Production", `Completed / Delivered`→"Complete", otherwise "Move to <next stage>". The button uses the next stage's accent color with white text, except `Awaiting Collection` which uses black text. While in-flight the button is disabled and shows "Processing...".
- **Record Payment (drawer):** when the order is not `Paid`, a "Record Payment" button appears to the left of the next-stage button (equal size). `Partially paid`/`Partial` uses orange background (`--orange-solid`) with black text; unpaid/not-paid uses red background (`--red-solid`) with white text. It closes the drawer and opens `RecordPaymentDialog` (status, outstanding balance, amount/method/reference) using `updateOrder`, matching the desktop order-form payment recording flow.
- **Record Payment outstanding balance styling:** `.payment-record-dialog .form-note.balance-due` uses the same red balance styling as the desktop order dialog (`--red-soft` / `--red-ink`).
- **Payment / Delivery badges (Sales & Orders):** Payment and Delivery badges use the `sales-action-status` styling (theme-aligned/centered presentation) as applied on the Sales & Orders table/cards.
- **Styles:** core `.dt-cards`/`.dt-card`/`.dt-sort`/`.dt-drawer*`, order-mobile-card (`.omc-*`), and progress-bar styles are available globally so card rendering works on desktop; kanban-specific mobile card chrome remains mobile-scoped to preserve the desktop kanban board.

**Not rebuilt/committed:** frontend and server changes are uncommitted; `server/dist/routes/production.js` was not rebuilt for the separate production-route change.
