# Production Module: Stations and Table Layout Optimization Plan (Desktop and Mobile)

Scope: the **Production** module tabs: **Schedule** (order station board), **Jobs** (job station board), and the **Production costs** table (the Quality control tab is removed, see section 3), plus the **rules for how a job and its order move between stations** (section 3).
Audit basis: the `twin_cakery_production-optim-fin-sec-unify` build.
Files: `src/components/erp/production-view.tsx`, `module-table.tsx`, `workspace.tsx`, `stage-tabs.tsx`, `src/styles.css`.
Companion plans: `Mobile_Kanban_Board.md` (shared `.order-card` CSS and card shell) and `Mobile_Order_Cards.md` (shared table card renderer).

---

## 1. How it works today

Production tabs today: `Schedule | Jobs | Quality control | Production costs` (`data.ts`). After this plan: `Schedule | Jobs | Production costs`.

| Tab | Component | What it is |
|---|---|---|
| Schedule | `ProductionView` → `BakeryStation` | 4 station columns of **orders**: Confirmed, Baking Station, Decorating Station, Ready |
| Jobs | `JobsView` → `JobsBoard` | 4 columns of **production jobs**: Queued, Baking, Decorating, Ready |
| Quality control | `ModuleTable` → `DataTable` | Table of jobs with QC-style statuses (**to be removed**) |
| Production costs | `ModuleTable` → `DataTable` | Same table with a cost column |

**Boards (desktop):** `.station-board` is a fixed 4-column grid. **Boards (mobile):** `StageTabs` plus one active column at a time.
Both boards refresh every 5 seconds and on live events; they show skeleton cards while loading.

**Schedule card** (`renderOrderCard`): order number, a status badge (blank for Confirmed), customer, notes ("—" if none). Display-only.
**Jobs card** (`renderJobCard`): job ID (built by replacing `TC-` with `TC-Job-`), badge, product, "Due: date". Click opens a dialog.
**Job dialog** (`max-w-2xl`): order/job, product, status, progress %, materials used, a materials entry form, and status action buttons (Start Production, Mark Production Complete, Pass / Fail Quality Check, Mark as Awaiting Pickup).
**Table:** columns Product / job · Due/Created · Stage/Progress · Status · open arrow, with search and a status filter.

## 2. Problems found

### 2.1 Cards
1. **Cards are styled with inline JavaScript**, not CSS. `orderCardStyle()` sets an 18% tone-tinted fill, a tone border, padding and radius, plus a hard-coded `#C2703A` for "Pick Up". It fights the shared `.order-card` CSS (which is also used by Kanban and has dead, nested `.order-card .order-card` rules), so the look can't be changed in one place and the two boards don't match the Sales cards.
2. **Schedule cards are nearly empty.** No product, no due date or time, no delivery vs pickup. Production staff need "what am I making and by when", and the card shows only order number, customer and a notes line.
3. **Customer line can show a raw ID.** `customerDisplay = uiMatch?.customer || order.customerId` falls back to the customer ID when the UI order isn't loaded. (Moot after this plan: the customer is removed from production cards.)
4. **Jobs cards lack context.** No progress, no urgency, no delivery or pickup; due date has no time; the displayed ID is a string hack (`TC-` → `TC-Job-`).
5. **No urgency signal.** Due today and overdue look the same as next week. Cards are not sorted by due date.
6. **Schedule cards are display-only**, and the "Start production from Confirmed" dialog (`confirmedDialogOrder`, `handleStartProductionFromConfirmed`) can never open because nothing calls `setConfirmedDialogOrder(order)`. Dead code.

### 2.2 Board layout
7. **Fixed 4 columns at all desktop widths.** `repeat(4, minmax(0, 1fr))`, no minimum width and no horizontal scroll, so tablet and narrow-laptop widths squeeze cards.
8. **Different names for the same stage.** Schedule: "Baking Station" / "Decorating Station". Jobs: "Baking" / "Decorating". The table says "Quality" and maps `READY_FOR_QUALITY` to "Decorating".
9. **No search, sort or filter** on either board.
10. **Mobile title duplicates the tab.** The mobile CSS hides `.board-col-title`, but a later rule `.board-col-title { display: block !important }` shows it again, so the active stage name appears under the tab that already says it.
11. **Mobile tabs are plain.** No short labels, no summary line (count of orders due today), and the "No orders" text has no jump to the next stage.
12. **Status logic is duplicated** in three places: `getStationForOrder` (Schedule), the Jobs column grouping, and the table's status mapping. They use different words and can disagree.

### 2.3 Job dialog (mobile)
13. **Desktop modal on a phone.** The dialog is `max-w-2xl` and scrolls on a small screen with the action buttons at the bottom of a long form.
14. **Materials row doesn't fit.** Each row is one flex line: item select + a `w-24` quantity input + notes input. On 360px it overflows or crushes the inputs. No labels.
15. **Small action buttons** (`size="sm"`), hard to hit; progress shown as bare "N%".

### 2.4 Production table (Quality control and Production costs)
16. **Generic columns.** QC and Costs use the same columns as Jobs. QC shows no result, inspector or rework note; Costs shows no breakdown.
17. **Costs tab shows a placeholder.** The cost value is `order.amount × 0.35`, a flat 35% estimate, while `getProductionCosts` already exists in the API. It is not labelled as an estimate.
18. **Status badge tones** are set only for Baking and Queued; every other status uses the default tone.
19. **Mobile table cards** rely on the generic `DataTable` card (title / date / value / badge) with no production-specific content.

### 2.5 Dead or stray code
20. `ProductionSchedule` in `module-table.tsx` (a time-grid with a hard-coded "Wednesday, 7 October 2026" and fixed "8 jobs scheduled") and its `.schedule-*` CSS: no mount found.
21. Confirmed-order dialog (item 6).
22. `.bak` files committed (`workspace.tsx.bak`, `purchasing-view.tsx.bak`).
23. `ProductionView` and `JobsView` only render their board when an `onSelect` prop is passed, even though `BakeryStation` doesn't use it (the board renders nothing if the prop is missing).

### 2.6 Workflow problems (how jobs and orders move between stations)
Read from `server/dist/routes/production.js` (find the matching source file in the repo) and the two boards:

24. **Completing a baking job also tries to make the order Ready.** `POST /jobs/:id/complete` sets the job to `READY_FOR_QUALITY` and the order's station to `decorating`, but then calls `businessService.advanceOrderToReadyForDelivery(...)` inside an empty `try/catch`. That advance is before any quality check, which contradicts the rule that an order is Ready only after its job is Ready. It may be failing silently or advancing the order early; it must be verified and removed.
25. **The quality-check endpoint has no state guard.** `POST /jobs/:id/quality-check` never checks that the job is waiting for QC. A `PASS` sets the job to `READY_FOR_DELIVERY` and advances the order, even if the job is still baking. (Replaced by the guarded "Set to Ready" action in section 3.)
26. **The two boards disagree.** The Jobs board moves a job to Ready whenever its order is Ready, even if the job is still in a decorating or quality status. The Schedule board checks the job's decorating or quality status first. The same job and order can sit in different columns on the two boards.
27. **The failed-check path is inconsistent.** A failed check sets the job to `PENDING` (Queued column) and adds the text `REWORK_REQUIRED` to the notes, while the order's station is set back to `baking`, so the job and order land in different columns. (This path goes away with the quality check.)
28. **The Decorating column mixes three job states** (`READY_FOR_QUALITY`, `QUALITY_CHECK`, `REWORK_REQUIRED`), and the name `READY_FOR_QUALITY` doesn't describe decorating. (After section 3 the column holds one state.)

## 3. Workflow rules (job and order movement)

The quality check (pass / fail) is **removed**. The only step between Decorating and Ready is a single **Set to Ready** action. There is no fail path and nothing moves backwards.

```
Queued ──start──▶ Baking ──"Mark Production Complete"──▶ Decorating ──"Set to Ready"──▶ Ready
```

| Event | Job | Order |
|---|---|---|
| Start production | Queued → **Baking** | Confirmed → **Baking** |
| Baking job marked complete | Baking → **Decorating** | Moves to the **Decorating** station at the same moment |
| **Set to Ready** | Decorating → **Ready** | Moves to **Ready** only now, as a result of the job becoming Ready |
| Mark as Awaiting Pickup | Allowed only from Ready | Ready → Awaiting Collection |

Rules:
1. **A job moves from Baking to Decorating only when baking is marked complete**, and the order's station changes to Decorating in the same action.
2. **An order moves to Ready only when its job has moved to Ready.** The order never gets to Ready first or on its own.
3. **A job moves to Ready only through "Set to Ready"**, and that action is available only while the job is in Decorating. Completing baking alone never makes a job Ready.
4. **A job and its order are always in the same station on both boards** (Schedule and Jobs). The board column comes from one shared function that reads the **job status first** and the order status second.

What has to change:
- **Server:**
  - Remove the early `advanceOrderToReadyForDelivery` call from `/jobs/:id/complete`.
  - Replace `POST /jobs/:id/quality-check` with `POST /jobs/:id/ready` ("Set to Ready"): allowed only when the job is Decorating (409 otherwise, like the other transitions); sets the job to `READY_FOR_DELIVERY` (progress 100) and moves the order to Ready with the existing `advanceOrderToReadyForDelivery`; writes an audit-log entry.
  - Remove the fail / rework branch (the job reset to `PENDING`, the `REWORK_REQUIRED` note and the order sent back to Baking), and stop creating quality-check records. Keep old quality-check records readable.
  - Give the Decorating stage its own job status (proposed `DECORATING`, replacing `READY_FOR_QUALITY` / `QUALITY_CHECK` / `REWORK_REQUIRED`), with a one-off update of existing jobs in those states. Check the order status steps in the business service allow this flow.
  - Save the job and order changes together so they cannot end up in different stations.
- **UI:** use the shared stage helper (4.6 below) for both boards; remove the Jobs board's "order is Ready, so the job is Ready" override; the Decorating column holds one state, with no chips.
- **Buttons in the job sheet:** "Mark Production Complete" only while Baking; **"Set to Ready"** only while Decorating; "Mark as Awaiting Pickup" only when Ready. No Pass / Fail buttons.
- **Quality control tab:** remove it from the Production tabs (and its table rows).
- **Tests:** complete → job Decorating, order station Decorating, order **not** Ready; Set to Ready → job Ready and order Ready; Set to Ready on a Baking job → rejected; both boards place the same job and order in the same column in every state.

## 4. Target design

### 4.1 One production card, two variants
A shared card with the same shell as the Sales / Kanban card (`.oc`: card background, 1px border, radius 10px, **4px left accent bar in the station tone**, no full-card tint). Content order is the same everywhere; stage is shown by the column or tab, so the card shows a badge only for special states (e.g. "Pick Up").

| Row | Schedule card (`variant="order"`) | Jobs card (`variant="job"`) |
|---|---|---|
| 1 | Order # + due chip (time; red if overdue, amber if today) | Job ID + due chip |
| 2 | **Product** (+ size / quantity / options if available), 14px / 600, max 2 lines | Same |
| 3 | Notes / special instructions (2-line clamp, "No notes" muted) | Progress bar with % (3px bar) |
| 4 | **Delivery or pickup** + due date and time | Order # · delivery or pickup + due date and time |

The customer name is **not** shown on production cards.

Rules:
- Schedule cards stay **display-only** (no tap action).
- Same fields on desktop and mobile; **density only changes spacing and font size** (desktop compact, mobile comfortable, 44px minimum tap area).
- Sort every column by due date and time, **soonest first**; overdue and due-today cards also get a coloured due chip, not colour alone.
- "Pick Up" uses the same accent bar in a warm tone (a CSS variable, not a hard-coded hex).
- Replace the inline `orderCardStyle()` with classes (`.oc`, `.oc--confirmed|baking|decorating|ready|queued`, `.oc--compact`).

### 4.2 Desktop board
```
 Production · Schedule        🔍 Search orders…     Sort: Due soonest
 ┌ ● Confirmed 3 ┐ ┌ ● Baking 4 ┐ ┌ ● Decorating 2 ┐ ┌ ● Ready 5 ┐
 │ card           │ │ card        │ │ card            │ │ card       │
 │ card           │ │ card        │ │                  │ │ card       │
```
- Scrollable rail: `grid-auto-flow: column; grid-auto-columns: minmax(var(--board-col-min, 240px), 1fr); overflow-x: auto;` (same variable idea as the Kanban plan).
- Sticky column header: tone dot, **one shared stage name**, count pill, and (Jobs) "N due today".
- Each column scrolls vertically inside a `max-height` so the header stays visible.
- Search box above the board (order #, product, notes) and a sort control (Due soonest default, Order #, Product).
- Unified stage names (decision 4).

### 4.3 Mobile board
```
 [ Confirmed 3 ][ Baking 4 ][ Decorating 2 ][ Ready 5 ]   ← StageTabs (scroll, active centred)
 Baking · 4 orders · 1 due today
 ┌─────────────────────────────┐
 │▌ TC-1042          Today 3:00 PM  │
 │▌ Chocolate cake · 2 kg           │
 │▌ “No nuts”                       │
 │▌ Delivery · Sat 14 Nov, 3:00 PM  │
 └─────────────────────────────┘
```
- Reuse `StageTabs` (short labels, scroll-into-view, edge fade, dimmed empty stages) as built for Sales.
- Remove the duplicate column title (fix the `!important` override).
- Summary line under the tabs: stage, count, due today.
- Search box above the tabs; "N matches in other stages" hint like the Sales board.
- Empty state: "No orders in {stage}" with a "Go to {stage}" button.

### 4.4 Job detail
- **Desktop:** keep a dialog, but clean it into two columns: left summary (order/job, product, customer, due, status, progress bar), right materials (used list and entry form); action buttons in a footer.
- **Mobile:** a full-height **bottom sheet** instead of the modal:
  - Sticky header: job ID, status badge, close.
  - Summary card with a labelled progress bar.
  - "Materials used" list.
  - "Record items used": each row stacks as **item select (full width)**, then **quantity and notes side by side**, with labels; "Add row" below.
  - Sticky footer with the primary action as a full-width 44px button (Start Production / Mark Production Complete / **Set to Ready** / Mark as Awaiting Pickup); only the action for the job's current stage is shown.
- Keep the existing handlers and permissions; this is layout only.

### 4.5 Production table (Production costs)
The Quality control tab is removed, so this is the only production table.

**Desktop columns:** Job / product · Order · Due · **Materials cost · Fixed / other · Total** · Status.

**Mobile:** card per job using the shared table card renderer from `Mobile_Order_Cards.md` (`renderMobileCard`):
- Product + job ID, total cost large on the right, a small breakdown line, due, order #.
- Left accent bar by status; the filter becomes horizontally scrollable status chips.

**Data:** replace the flat `amount × 0.35` with **real production costs** from `getProductionCosts` (`GET /jobs/:id/costs`, plus the fixed-costs data from migration 020). Check which fields `ServerProductionCost` returns and use them for the Materials / Fixed / Total columns. Give every status a badge tone through one shared mapping.

### 4.6 Shared status helper
One module (e.g. `lib/production-stage.ts`) exporting `orderStation(order, job)`, `jobStage(job)`, `stageLabel(stage)`, `stageTone(stage)`. Schedule, Jobs and the costs table all use it so the stage word is the same everywhere.

## 5. Implementation phases

### Phase 0: Workflow rules (server and helper), do first
Apply section 3: remove the early order-Ready advance on baking complete, replace the quality check with the guarded Set to Ready action, remove the rework path, make job and order move together, shared stage helper used by both boards. Add the tests listed in section 3. This changes data behaviour, so test on a copy of the data first.

### Phase 1: CSS and inline-style clean-up (no redesign yet)
1. Move the inline card styles in `production-view.tsx` into classes; delete `orderCardStyle()` and the hard-coded `#C2703A`.
2. Consolidate the `.order-card` / `.station-board` CSS with the Kanban plan's Phase 1 (same shared rules; do both together).
3. Fix `.board-col-title { display: block !important }` so mobile no longer repeats the tab name.
4. Remove the dead nested `.order-card .order-card` rules after confirming they match nothing.

### Phase 2: Shared status helper and card
Create the stage helper (4.6) and the production card (4.1) with both variants; wire into `BakeryStation` and `JobsBoard`. Add due chip and sorting. Check which fields (size, quantity, delivery / pickup, options) already exist on `ServerOrder` or the job; add them to the API response only if missing.

### Phase 3: Board layout
Desktop scroll rail and sticky headers; search and sort; unified stage names. Mobile: `StageTabs` with short labels, summary line, search, empty state with jump.

### Phase 4: Job detail
Desktop two-column dialog; mobile bottom sheet with stacked materials rows and a sticky action footer.

### Phase 5: Production table
Costs columns, mobile cards, status chips, real cost data, status tones from the helper; remove the Quality control tab.

### Phase 6: Dead-code clean-up
Remove the confirmed-order dialog and its handler (Schedule cards stay display-only), the unused `ProductionSchedule` time grid and its CSS, the `.bak` files, and the `onSelect`-gated rendering.

### Phase 7: Verify
- Widths 360, 390, 430, 768, 1024, 1280, 1536; sidebar open and collapsed; light and dark.
- Columns with 0, 1 and 50+ cards; long product names and notes; overdue, today and future due dates; "Pick Up" state.
- Live refresh (5-second poll and SSE) keeps scroll position, the active tab and an open job sheet.
- Skeleton and empty states look right.
- Walk one order through the whole flow on both boards: Confirmed → Baking → Decorating → Set to Ready → Awaiting Pickup; the job and order are in the same column at every step and the order is never Ready before the job.
- Run `production-materials.test.tsx`, the other existing tests, `npx tsc --noEmit` and `npm run build`; add tests for the stage helper.
- Confirm the Sales Kanban still looks right after the shared CSS changes.
- Accessibility: tab roles, focus order in the sheet, 44px targets, urgency and status shown in text as well as colour.

## 6. Files touched

| File | Change |
|---|---|
| `src/components/erp/production-view.tsx` | Production card, board layout, search / sort, job sheet, remove dead code |
| `src/components/erp/production-card.tsx` (new) | Shared card for order and job variants |
| `src/lib/production-stage.ts` (new) | Shared stage / status / tone helper |
| Server production routes (compiled `dist/routes/production.js`; find the source file) | Remove early order-Ready advance, replace quality check with guarded Set to Ready, `DECORATING` status, job + order saved together |
| Server business service (`advanceOrderToReadyForDelivery`, `advanceOrderToInProduction`) | Confirm legal order status steps for the new flow |
| `src/components/erp/module-table.tsx` | Production table columns, mobile cards, costs data, remove `ProductionSchedule` |
| `src/components/erp/workspace.tsx` | Remove `onSelect` gating if no longer needed; `.bak` removal |
| `src/components/erp/stage-tabs.tsx` | Reuse as is (short labels already supported) |
| `src/styles.css` | `.oc` card variants, board rail, sticky headers, job sheet, table cards; remove dead rules and the `!important` override |
| `src/test/` and server tests | Stage helper tests; workflow transition tests; update production tests |

## 7. Decisions (settled)

| # | Question | Decision |
|---|---|---|
| 1 | Schedule cards | **Display-only** (no tap action) |
| 2 | Card fields | **Product, due date and time, notes, delivery / pickup.** **No customer** on production cards |
| 3 | Default sort | **Soonest due first** |
| 4 | Stage names | **Confirmed, Baking, Decorating, Ready** (and Queued on Jobs); drop "Station" from titles |
| 5 | Job detail on mobile | **Bottom sheet** |
| 6 | Costs tab | **Real production costs** (no estimate) |
| 7 | Desktop minimum column width | **240px** via `--board-col-min`, adjust after seeing it on screen |
| 8 | Workflow | Baking complete → job **and** order move to **Decorating**; order → **Ready only after the job is Ready**; job → **Ready only through "Set to Ready"** (section 3) |
| 9 | Quality check | **Removed.** Replaced by a single "Set to Ready" action; no fail or rework path |

## Still to confirm

- **Quality control tab:** I assumed it is removed along with the quality check. Is that right, or do you want to keep a read-only list of old quality checks?
- **Job status name:** proposed `DECORATING` for the Decorating stage (instead of `READY_FOR_QUALITY`), with existing jobs updated once. OK?
- **Permission:** "Set to Ready" can reuse the existing `production.quality_check` permission (no role changes) or get a new `production.set_ready`. Which do you prefer?

## 8. Risks

- `.order-card`, `.station-board` and `.board-col-title` are shared with the Sales Kanban; change them together and check both.
- Cards currently use a status-tinted fill that staff may be used to; the accent bar is a visible change. Review on a real screen before rolling out.
- Job actions (start, complete, set to ready, awaiting pickup) change order and job status; keep every handler and permission check unchanged, and test them after the sheet layout change.
- The workflow change (section 3) alters real job and order statuses on the server. Run it against a copy of the data, check any order already stuck in an in-between state (e.g. Ready while its job is still in Decorating), and keep the audit-log entries for every transition.
- Stage mapping differs between today's Schedule, Jobs and table logic; unifying it can move a card to a different column. Compare before and after on real data.
- Don't touch the topbar and sidebar mobile work recorded in `Mobile_progress.md`.

## 9. Suggested order

Phase 0 (workflow rules and stage helper) → Phase 1 (together with Kanban Phase 1) → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7.
