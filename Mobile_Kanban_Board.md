# Mobile Sales → Orders Kanban Redesign Plan

Companion to `Mobile_Order_Cards.md` (Table view). This covers the **Kanban** layout, the second display on **Sales → Orders**.
Scope: mobile only (`max-width: 767.98px`). Desktop (7-column board) must stay unchanged.
Frontend root: `erp-interface-design/src/`

---

## 1. How it works today

Toggle: the **Table / Kanban** buttons in the "All orders" panel heading (`components/erp/workspace.tsx`, `salesLayout` state).

On mobile, Kanban becomes a **single-column, one-stage-at-a-time** view:

1. `StageTabs` (`components/erp/stage-tabs.tsx`) shows pill tabs, one per stage, each with a count. State is `kanbanStage`.
2. `.kanban-board` shows only the column marked `.is-active`. The column title (`.board-col-title`) is hidden on mobile because the tab replaces it.
3. Each order is an `.order-card` div, tapping it calls `setSelected(o)` and opens the order detail.
4. A `useEffect` auto-switches to the first stage that has orders if the active stage becomes empty.

Stages (`SALES_STAGES`): Pending confirmation, Confirmed, In production, Ready, Awaiting Collection, In Transit, Completed / Delivered.

Current card content: order ID (bold), customer (12px, muted), product (12px), amount (11px, muted). All inline-styled in `workspace.tsx`.

## 2. Problems found

1. **No search or filter in Kanban.** `table-controls` (search box and status select) only renders for the Table layout. On mobile there is no way to find an order in a long column.
2. **Cards carry too little information.** No payment status, delivery type, due date, product options or balance. Amount is the smallest, faintest text, even though it is the most useful number.
3. **Weak hierarchy.** ID is the boldest item, but staff recognise orders by customer and product. Customer, product and amount are 11–12px and similar in weight.
4. **Inline styles fight the stylesheet.** The card's `style={{...}}` props override CSS, so the card can't be restyled in one place.
5. **Tangled `.order-card` CSS.** `styles.css` (about lines 870–871 and 1056–1083) has repeated and conflicting rules, including selectors like `.order-card .order-card` and `.kanban-board .order-card .order-card` that match nothing in this markup. The same classes are shared with the Production station boards, so edits are risky without a clean-up.
6. **Stage tabs are cramped.** Long labels ("Completed / Delivered", "Pending confirmation") make the pill row scroll a lot, and nothing hints that it scrolls. The active tab is not scrolled into view when it changes automatically.
7. **Cancelled orders are invisible.** `SALES_STAGES` has no Cancelled stage, so cancelled orders never appear on the board (they only show in Table view with "All statuses").
8. **Empty state is bare.** Just a muted "No orders" line.
9. **Double padding.** The wrapper has inline `padding:16px` inside a panel that already has padding, and `.stage-tabs` uses `margin:0 -16px` to compensate, which is fragile.
10. **No quick actions.** Moving an order to the next stage requires opening it, so Kanban is read-only on a phone.
11. **Tint risk.** `order-row-tint` paints the whole card, and some tone variables don't match their names (e.g. `--teal-soft` is lime-green, `--orange-soft` is cyan), so card colours may not match the status.

## 3. Target design

### 3.1 Layout

```
 All orders (23)                [ Table | Kanban ]
 ┌───────────────────────────────────────────┐
 │ 🔍 Search orders, customers…        [Filter]│   ← sticky search row (new)
 └───────────────────────────────────────────┘
 ( Pending 4 )( Confirmed 6 )( In prod. 3 )( Ready 2 )→   ← stage chips, active one centred
 
 In production · 3 orders            UGX 1.2M     ← stage summary line (new)

 ┌─────────────────────────────────────────┐
 │▌ Aisha Birungi              UGX 450,000     │
 │▌ Chocolate cake · 2 kg          part paid    │
 │▌ Sat 14 Nov, 3:00 PM · Delivery             │
 │▌ #ORD-1042                    [Mark ready →]  │
 └─────────────────────────────────────────┘
```

### 3.2 Card anatomy (Kanban card is a compact version of the Table card)

| Row | Content | Style |
|---|---|---|
| 1 | Customer name (left), amount (right) | 15px / 600, amount tabular figures |
| 2 | Product + top option (size/flavour), payment chip (right) | 13px, payment chip small and tone-coloured |
| 3 | Due date and time, delivery type | 12px muted; overdue or today in `--red-ink` |
| 4 | `#order ID` (left), optional action button (right) | 11px muted; button 36–44px tall |

- 4px left accent bar in the stage tone. The card body stays `--card`, so contrast holds in dark mode.
- No status badge: the active stage tab already states it.
- Text wraps to a maximum of 2 lines, then ellipsis. Cards have a minimum height of `--tap` (44px).
- Pressed state on tap, `role="button"`, Enter/Space opens the order.
- Reuse the same `OrderMobileCard` component planned for the Table view (see `Mobile_Order_Cards.md`, Phase 2) with a `variant="kanban"` prop. One component and one set of styles keeps both displays consistent.

### 3.3 Stage tabs

- Shorter labels on mobile, e.g. Pending, Confirmed, In production, Ready, Collect, In transit, Done (full label in `aria-label`).
- Auto-scroll the active tab into view (`scrollIntoView({inline:'center'})`) on change.
- Edge fade on the right to hint at horizontal scroll.
- Zero-count stages dimmed but still tappable.
- Optional: swipe left/right on the card list to move between stages.

### 3.4 Search and filter

- Show the same search box in Kanban on mobile. Filter the cards by ID, customer and product.
- While searching, show a "matches in other stages" hint, since the board only shows one stage at a time. Option: tabs show the match count per stage.
- The status select isn't needed in Kanban, because the stage tabs are the filter.

### 3.5 Stage summary line

Under the tabs: stage name, order count, and total value of that stage. This replaces the hidden `.board-col-title` and gives a quick read of workload.

### 3.6 Empty and edge states

- Empty stage: centred icon and "No orders in {stage}", with a button jumping to the next stage that has orders.
- Optional **Cancelled** chip at the end of the tabs (hidden by default if you want the board to stay a live-pipeline view; decision needed, see section 6).

### 3.7 Quick action (optional, Phase 4)

A single "Next stage" button on each card (e.g. "Mark ready →"), using the existing order status update function. It needs a confirm or undo toast, a permission check, and a guard so Completed / Delivered can't be set by accident. Only add this if the existing status-update path is safe to call from the card; otherwise keep cards read-only and open the order on tap.

## 4. Implementation phases

### Phase 1: Clean the CSS and remove inline styles (no visual redesign yet)
- In `workspace.tsx`, move the inline styles on the card into classes and drop the `padding:'16px'` inline style on `.kanban-wrap`.
- In `styles.css`, consolidate all `.order-card` mobile rules into one block, scoped as `.kanban-board .order-card` and `.station-board .order-card` where they differ.
- Delete the dead `.order-card .order-card` selectors only after confirming nothing renders nested cards (search for other `order-card` usage in `production`, `jobs`, `station` views first).
- Add a safe `.kanban-wrap` mobile padding (12–16px) and fix the `.stage-tabs` negative-margin pairing.
- Check: Production boards and station boards look identical before and after.

### Phase 2: New card
- Build or extend `OrderMobileCard` with `variant="kanban"` (rows in section 3.2).
- Add the due-date helper (Today / Tomorrow / Overdue) shared with the Table card.
- Replace the card markup in `salesKanban`.
- Stage-tone accent bar via a `--accent` variable set from `tone(o.status)`; stop using `order-row-tint` on the whole card.

### Phase 3: Stage tabs, search and summary
- Mobile short labels, scroll-into-view, edge fade.
- Render the search box above the tabs in Kanban on mobile only (reuse `search` state and `matchesSearch`).
- Stage summary line (count and total).
- Better empty state with a jump-to-next-stage action.

### Phase 4: Optional extras
- Quick "next stage" action on cards.
- Swipe between stages.
- Cancelled chip (after decision in section 6).
- Pull-to-refresh or a refresh button if orders come from the live API (`lib/live.ts`).

### Phase 5: Verify
- Widths 360, 390, 430px; light and dark mode; very long customer or product names; 0, 1 and 50+ orders in a stage.
- Switching Table ↔ Kanban keeps search text and, where possible, the selected stage.
- Opening an order from a card and returning keeps the stage and scroll position.
- Desktop (≥768px) 7-column board identical to now.
- Production and station boards unchanged.
- Run `order-stage-nav.test.tsx`, `active-orders.test.ts`, then `npx tsc --noEmit` and `npm run build`.
- Accessibility: tabs keep `role="tablist"` / `aria-selected`, 44px tap targets, status and urgency not conveyed by colour alone.

## 5. Files touched

| File | Change |
|---|---|
| `src/components/erp/workspace.tsx` | `salesKanban` markup, mobile search row, stage summary, remove inline styles |
| `src/components/erp/stage-tabs.tsx` | Short labels, scroll-into-view, dimmed empty stages |
| `src/components/erp/order-mobile-card.tsx` (new, shared with Table plan) | `variant="kanban"` |
| `src/styles.css` | Consolidated `.order-card` / `.kanban-board` mobile rules, `.stage-tabs` fade, summary and empty-state styles |

## 6. Decisions needed

1. **Cancelled orders on the board?** Today they are hidden from Kanban. Add a Cancelled chip, or keep the board as a live pipeline only?
2. **Quick "next stage" action on cards?** Convenient, but changes Kanban from read-only to editable on mobile.
3. **Short stage labels:** confirm the wording in section 3.3.

## 7. Risks

- `.order-card` and `.kanban-board` / `.station-board` are shared with Production, so test those after any CSS change.
- The messy, repeated CSS means removing rules can change the look somewhere unexpected; clean in small steps and compare screenshots.
- Check accent colours against the real status-to-tone mapping, because some tone variable names don't match their colours.
- Don't touch the topbar and sidebar mobile work recorded in `Mobile_progress.md`.

## 8. Suggested order

Do the Table plan's Phase 1 first (it adds the shared card styles), then Phase 1 here, then the shared `OrderMobileCard` (Table Phase 2 and Kanban Phase 2 together), then Kanban Phase 3.
