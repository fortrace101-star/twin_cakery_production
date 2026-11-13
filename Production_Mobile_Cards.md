# Production Stations: Mobile Order and Job Cards Plan

Scope: the **order cards** (Production → Schedule) and **job cards** (Production → Jobs) on mobile (`max-width: 767.98px`). Problem reported: text overflows the card frames. You asked for layout options, including changing from horizontal to vertical.
Audit basis: the `twin_cakery_production-optim-fin-sec-unify` build.
Files: `src/components/erp/production-view.tsx` (`renderOrderCard`, `renderJobCard`, `orderCardStyle`), `stage-tabs.tsx`, `src/styles.css`.
Related: `Production_Layout_Optimization.md` (desktop and mobile card content, workflow, job sheet). This plan is the mobile-display fix and layout choice; its Phase 1 can ship before the bigger plan.

> Method note: I traced the cause by reading the code and CSS order, not by running the app on a phone. Section 2.1 includes a 2-minute check in the browser to confirm it.

---

## 1. How the cards look today

Order card (Schedule) and job card (Jobs) are `div.order-card` elements styled **inline** by `orderCardStyle()` (status-tinted fill, tone border, 12px padding). Inside:
- Row 1: a flex row with the ID in bold and a status badge (`.status` has `white-space: nowrap`).
- Order card: customer line (12px), notes line (12px, `order.notes || "—"`).
- Job card: product line (12px; falls back through `variantOptions`, `productId`, `notes`), "Due: date" (11px).

Mobile uses `StageTabs` to show one station at a time.

## 2. Why text overflows

### 2.1 Main cause: the desktop board grid is switched back on for phones
`styles.css` lines about 1158–1162 are a block commented "production kanban boards revert to the desktop multi-column rails on PCs":

```css
.kanban-board { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 14px; }
.station-board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.kanban-board > [data-stage], .station-board > [data-stage] { display: block; width: 100%; min-width: 0; }
.board-col-title { display: block !important; }
```

This block is **not inside a media query** and comes **after** the mobile block that sets `.station-board { display: block }` and hides every column except the active one. Same selectors, later in the file, so it wins. On a phone that means:
- all four station columns are visible side by side in a 4-column grid, so each card is only about 60–75px wide, and text spills out of its frame;
- the stage tabs still show, but they no longer hide anything;
- the Sales Kanban is affected in the same way (7 columns).

**Check it:** open the Production → Schedule tab at 390px width in browser devtools, inspect `.station-board`, and look at the computed `display` and `grid-template-columns`. If it says `grid` and four columns, this is the cause.

### 2.2 Secondary causes (these show once the width is restored)
1. **No wrapping guards on the card text.** No `overflow-wrap`, no `min-width: 0` on the header row, no `overflow: hidden` on the card. A long word, a long job ID or long notes can still spill out.
2. **The header row can't shrink.** ID and badge sit in one flex row with `white-space: nowrap` on the badge and no wrapping, so a long ID plus "Decorating" can exceed a narrow card.
3. **Notes are shown in full.** Long notes (cake message, allergies, instructions) make very tall cards.
4. **Product text for jobs can be a long raw string.** It falls back through `variantOptions`, `productId` and `notes`, which can be an options string or free text.
5. **The dead rules.** The appended CSS tries to fix nowrap and wrapping with selectors like `.order-card .order-card strong` and `.order-card .order-card div`; there is no nested `.order-card`, so these never apply. The mobile accent-bar rules only target `.kanban-board`, not `.station-board`.
6. **Inline styles beat the stylesheet**, so card padding, border and fill can't be adjusted from CSS.
7. **Wasted width:** the board wrapper has inline `padding: 16px` inside a panel that already has padding, taking roughly 32px from a 360px screen.
8. **Large text settings** (Android or iOS font size at 130–200%) are likely to overflow even after the fix unless the card is built to wrap.

## 3. Layout options (horizontal → vertical and others)

All options keep the decisions already made: Schedule cards display-only, no customer on the card, soonest due first, short stage names, product / due date and time / notes / delivery-or-pickup as the content.

### Option A: Vertical stacked card (recommended default)
One full-width card per order. Everything stacks top to bottom, product first because that is what the baker needs to know.
```
┌────────────────────────────────┐
│▌ Chocolate celebration cake      │  product: 15px / 600, 2-line clamp
│▌ 2 kg · Chocolate · Birthday     │  options: 12px muted, up to 2 lines
│▌ ⏰ Today 3:00 PM        [Soon]  │  due date and time
│▌ 🚚 Delivery                     │  delivery or pickup
│▌ “No nuts, write Happy Bday…” ▾  │  notes: 2-line clamp, tap to expand
│▌ #TC-1048             [Pick Up]  │  footer: small ID, special badge
└────────────────────────────────┘
```
Job card is the same with a progress bar instead of notes:
```
│▌ Chocolate celebration cake      │
│▌ 2 kg · Chocolate                │
│▌ ▰▰▰▱▱ 60%                       │
│▌ ⏰ Today 3:00 PM · Delivery     │
│▌ TC-Job-1048                     │
```
- Nothing sits side by side except the ID / badge footer, so nothing can run out of the frame.
- Left accent bar by station colour (replaces the tinted fill).

### Option B: Compact two-line row (dense list)
For stations with many orders; shows less so you can scan more.
```
│▌ Chocolate cake · 2 kg                 3:00 PM │
│▌ #TC-1048 · Delivery · “No nuts…”              │
```
Best as a **Comfortable / Compact** switch on the board (Option A or B), remembered per device.

### Option C: Expandable cards
Collapsed: product, due time, badge. Tap to expand: options, notes, delivery, ID. Keeps the list short, but needs a tap to see notes, and Schedule cards are meant to be display-only. Not recommended as the default.

### Option D: Swipe between stations
Each station is a full-width page; swipe left and right to move between Confirmed, Baking, Decorating and Ready, with the tabs staying in sync. It keeps the "columns" idea on a phone. Costs: nested scrolling and more work to keep tabs and swipe in step. Optional extra on top of A.

### Option E: Group by time slot inside each station
Small sticky headings: **Overdue · Today morning · Today afternoon · Tomorrow · Later**, with the vertical cards under them. Helps plan the day. Works with A or B.

### Recommendation
**A (vertical stacked card) + stage tabs**, with **B as a Compact switch** and **E grouping** inside Baking and Decorating. D is optional later.

## 4. Overflow-proof card rules (apply to every option)

- Card: `min-width: 0; overflow: hidden; box-sizing: border-box;` all text `overflow-wrap: anywhere;`.
- Header / footer rows: `display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px;` so the ID shrinks with an ellipsis and the badge keeps its size; at 340px and under the badge drops to its own line.
- Product: 2-line clamp (`-webkit-line-clamp: 2`); options: 2-line clamp; notes: 2-line clamp, with expand.
- Long values (IDs, notes) use `overflow-wrap: anywhere` so a word with no spaces still breaks.
- Fonts in `rem` with a 12px minimum; card heights are not fixed, so larger system text grows the card instead of cutting it.
- Normalise the job's product label in one helper (`jobProductLabel(job)`): product name first, options on a second line; never the raw `notes` or `productId` unless nothing else exists.
- Remove the inline `padding: 16px` board wrapper on mobile (use a 12px CSS class).
- No inline styles on the cards; use classes (`.pc`, `.pc--confirmed|baking|decorating|ready|queued`, `.pc--compact`) so a single stylesheet controls the look.

## 5. Implementation phases

### Phase 1: Hotfix (CSS only, ship first)
1. Wrap the "revert to desktop rails" block (about lines 1158–1162) in `@media (min-width: 768px) { … }`, and drop the `!important` on `.board-col-title` (desktop already shows the title by default).
2. Add the guards from section 4 to `.station-board .order-card` (`min-width: 0; overflow: hidden; overflow-wrap: anywhere`), and let the header row wrap.
3. Replace the inline wrapper padding with a mobile class.
4. Check the Sales Kanban at the same time (same block).

Expected result: one station at a time again, full-width cards, no spill.

### Phase 2: Vertical card (Option A)
New `ProductionCard` (shared with the plan in `Production_Layout_Optimization.md` section 4.1) with the stacked layout, accent bar, due chip, notes clamp, job progress bar. Replace `renderOrderCard` / `renderJobCard` markup and delete `orderCardStyle()` and the hard-coded `#C2703A`.

### Phase 3: Comfortable / Compact and time grouping
Density switch (A or B) saved per device; optional time-slot headings (E) inside each station, with soonest due first.

### Phase 4: Optional
Swipe between stations (D); expand-in-place for long Schedule notes.

### Phase 5: Verify
- Devices and widths: 320, 360, 390, 430, landscape; Android and iOS.
- System font size at 100%, 130% and 200%.
- Test data: product name of 80+ characters; a word of 60 characters with no spaces; notes of 300+ characters; emoji; very long job ID; "Pick Up" state; overdue and today due times; empty notes.
- Overflow check in the browser console (run on each station tab); it should return nothing:
  ```js
  [...document.querySelectorAll('.order-card, .order-card *')]
    .filter(e => e.scrollWidth > e.clientWidth + 1)
    .map(e => e.className || e.tagName)
  ```
- Only one station column is visible at a time on phones; desktop (≥768px) still shows four columns.
- Sales Kanban (same CSS block) behaves: one stage at a time on phones, seven columns on desktop.
- Live refresh (5-second poll) keeps the active tab and scroll position.
- Run existing tests, `npx tsc --noEmit`, `npm run build`.

## 6. Files touched

| File | Change |
|---|---|
| `src/styles.css` | Wrap the board "revert" block in a min-width media query; card guards; later `.pc` card styles; remove dead nested `.order-card .order-card` rules |
| `src/components/erp/production-view.tsx` | New card markup, remove inline styles, `jobProductLabel()`, density switch, time grouping |
| `src/components/erp/production-card.tsx` (new) | Shared vertical card (also used by the bigger Production plan) |
| `src/components/erp/stage-tabs.tsx` | No change expected |

## 7. Decisions needed

1. **Layout:** go with Option A (vertical stacked cards), or pick another from section 3?
2. **Compact switch:** add the Comfortable / Compact switch (Option B)?
3. **Field order on the card:** product first, then due time, delivery or pickup, notes, with the ID small at the bottom. (This replaces the "ID first" order in `Production_Layout_Optimization.md` 4.1 for mobile. Should desktop use the same order, so both match?)
4. **Notes:** show 2 lines with tap to expand (the card stays display-only otherwise), or always show the full note?
5. **Time grouping (Option E)** inside Baking and Decorating: yes or no?
6. **Swipe between stations (Option D):** yes, later, or no?

## 8. Risks

- Wrapping the "revert" block in a media query changes the Sales Kanban and Production boards on phones at the same time; check both before release.
- The block may have been added to fix a desktop problem (its comment says desktop rails); confirm desktop still shows four columns and seven columns after the change, including at 768–1100px (which the bigger plan handles with a scrolling rail).
- Showing only the first lines of notes could hide an allergy note; keep the expand control obvious (or always show notes marked as allergy) and show the full text in the job sheet.
- Don't touch the topbar and sidebar mobile work recorded in `Mobile_progress.md`.

## 9. Suggested order

Phase 1 (hotfix) → Phase 2 (vertical card) → Phase 3 (density and grouping) → Phase 5 (verify) → Phase 4 if wanted. Phase 2 can be merged with Phase 2 of `Production_Layout_Optimization.md`.
