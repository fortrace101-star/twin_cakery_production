# Production → Order / Job Card Drawer: Move Jobs to the Next Stage, on Desktop and Mobile

Scope: the **drawer that opens from a production card** (Production → Jobs, and Production → Schedule if you want it), where staff **record materials and move the job to its next stage**, on **desktop and mobile**.
Goal: one drawer, one clear "what stage is this in and what is the next step" area, one primary button for the next stage, and a materials form that fits a 360px phone.
Audit basis: the `twin_cakery_production-main` build (`erp-interface-design/`, `server/`).
Files: `src/components/erp/production-view.tsx` (`JobsBoard`, `BakeryStation`), `stage-tabs.tsx`, `src/components/ui/sheet.tsx`, `src/styles.css`, `src/lib/api.ts`, `server/services/business.service.ts`, `server/routes/production.ts`.
Companion plans: `Production_Layout_Optimization.md` (workflow rules, card, boards; section 4.4 there only sketches this drawer), `Production_Mobile_Cards.md` (card overflow), `CRM_Customer_History_Layout.md` (the detail-pane pattern this plan follows).

> Method note: everything below comes from reading the code, not from running the app on a phone or desktop. Section 2.1 flags one workflow bug that I traced through the server code; confirm it on a copy of the data before relying on it.

---

## 1. How the drawer works today

There is **no drawer**. A job card on the Jobs board opens a centred **modal** (`Dialog`, `DialogContent className="max-w-2xl"`) in `JobsBoard`:

- Header: job ID (the `TC-` → `TC-Job-` string hack) and `{job.id} · Jobs`.
- Summary list: Order/Job, Product, Status badge, Progress `N%`.
- "Materials/Ingredients/Consumables Used": a list of recorded items, then entry rows (item select + `w-24` quantity + notes in **one flex line**), `Add Row` and `Record Items Used` (both `size="sm"`).
- Action buttons in one `flex flex-wrap` row at the **bottom of the scrolling body**, all `size="sm"`, shown by job status:

| Job status | Button |
|---|---|
| `PENDING`, `SCHEDULED`, `READY_FOR_PRODUCTION` | Start Production |
| `IN_PRODUCTION` | Mark Production Complete |
| `DECORATING` | Set to Ready |
| `READY_FOR_DELIVERY`, `COMPLETED` | Mark as Awaiting Pickup |

On **Schedule**, order cards are display-only. The "Start production from Confirmed" dialog (`confirmedDialogOrder`) exists but nothing opens it.

Compare with the **Sales order dialog** (`dialogs.tsx`): it has a header, a scroll area, a **stage strip** (the pipeline with done / current / target steps), Previous / Next stage buttons and a **sticky** action row, and on mobile it goes full height (`.order-detail-dialog` at `max-width: 767.98px`). The production modal gets none of that, because it does not use the `order-detail-dialog` class.

## 2. Problems found

### 2.1 Workflow (affects what the drawer can show)

1. **"Mark Production Complete" may send the job to `DONE`, not `DECORATING`.** In `business.service.ts`, `completeProduction` moves a job to `DECORATING` only `if (job.stage === "DECORATE")`; otherwise it sets `DONE`. Starting a job sets `stage = "PRODUCE"`, and a search of the server code found **no place that sets `stage` to `DECORATE`**. So after baking, the job most likely becomes `DONE`. On the Jobs board `getColumnForJob` has no rule for `DONE`, so it falls through to the default and the job lands in **Queued**. "Set to Ready" is only offered for `DECORATING`, so it never appears. **Confirm on a copy of the data.** If true, the drawer's next-stage button cannot work until this is fixed (section 5.1).
2. **The Set to Ready route sets the order's station to `decorating`** (`store.updateOrder(order.id, { station: "decorating" })`) after the job is already Ready, then relies on `advanceOrderToReadyForDelivery` inside an empty `try/catch`. If that advance fails, the failure is silent and the order stays in Decorating while the job is Ready.
3. **Two boards, two rules** (`getStationForOrder` vs `getColumnForJob`) still disagree, as listed in `Production_Layout_Optimization.md` (item 26). The drawer would show one stage while the other board shows another.
4. **Leftovers from the old quality check:** `handleQualityPass`, `handleQualityFail` and the `recordQualityCheck` import are still in `JobsBoard` but nothing calls them. The server `recordQualityCheck` still exists.
5. **No backward or "undo" path.** Intended (nothing moves backwards), but a wrong tap on the primary button has no recovery, so the drawer needs a confirm step on irreversible moves (section 4.5).

### 2.2 Layout and usability

6. **Desktop modal hides the board.** Staff cannot see the card move columns after pressing the button.
7. **Modal on a phone.** `max-w-2xl` with no mobile rules: not full height, close button at the top right, long form, actions at the very bottom of the scroll.
8. **Materials row does not fit.** Select, `w-24` quantity and notes sit in one line; on 360px the inputs are crushed. No labels, no unit shown, and the quantity placeholder is only "Qty".
9. **Primary action is small and buried.** `size="sm"` buttons, below the materials form, so on a phone the next-stage button is off screen until you scroll.
10. **No stage context.** The drawer shows a status badge and "N%" but not where the job sits in Queued → Baking → Decorating → Ready, nor what the next step will do to the order.
11. **Thin summary.** No due date and time, no delivery or pickup, no notes or special instructions, no quantity. Product text falls back through `variantOptions`, `productId` and `notes`, so it can show raw text.
12. **Job ID is built by string replacement** (`TC-` → `TC-Job-`) in three places.
13. **No busy or error feedback inside the drawer.** Failures go to `onNotice`, which may sit behind the overlay; buttons show no spinner.
14. **No guard against closing with unsaved material rows.**
15. **Schedule order cards cannot be opened at all**, so staff on the Schedule tab cannot see an order's full notes.
16. **Accessibility:** no labels on the material inputs, status shown by badge colour plus text only in places, no focus return to the card on close.

## 3. Decisions (proposed; please confirm)

| # | Question | Proposal |
|---|---|---|
| 1 | Desktop container | **Right-side drawer** (`Sheet side="right"`), 480px wide, board stays visible and dimmed |
| 2 | Mobile container | **Bottom sheet**, 92dvh, drag handle, sticky header and sticky footer (settled earlier in `Production_Layout_Optimization.md` decision 5) |
| 3 | Same content on both | **Yes.** Desktop and mobile show the same sections in the same order; only the container and spacing change |
| 4 | Primary action | **One** large button for the job's current stage (Start Production / Mark Production Complete / Set to Ready / Mark as Awaiting Pickup), in a sticky footer. No "Previous" button: nothing moves backwards |
| 5 | Confirm step | **Yes** for Mark Production Complete, Set to Ready and Mark as Awaiting Pickup: the button turns into "Confirm: move to Decorating" with a Cancel link; Start Production moves straight away |
| 6 | Materials | Collapsible section, **stacked rows** with labels; stays below the summary and above nothing that blocks the primary button |
| 7 | Schedule order cards | **Stay display-only** (earlier decision). Optional: a read-only version of the same drawer. See open points |
| 8 | Customer on the drawer | **Hidden**, as on the cards. Order number and product only |
| 9 | Stage names | **Queued, Baking, Decorating, Ready** (the same words as the board columns) |

## 4. Target design

### 4.1 One drawer, same sections on desktop and mobile

```
┌───────────────────────────────────────────────┐
│ TC-1042 · Job            [Decorating]       ✕ │  sticky header
├───────────────────────────────────────────────┤
│ Queued ─ Baking ─ ●Decorating ─ Ready          │  stage strip (4 steps)
│ Next: Set to Ready                             │  one line, plain words
├───────────────────────────────────────────────┤
│ Chocolate celebration cake                      │  product, 2-line clamp
│ 2 kg · Chocolate · Birthday                     │  options
│ ⏰ Today 3:00 PM  [Due soon]                    │  due date and time + text chip
│ 🚚 Delivery   ·   Order TC-1042                 │  delivery or pickup, order no.
│ “No nuts, write Happy Bday…”          [Show ▾]  │  notes: 3-line clamp, expand
│ Progress  ▰▰▰▰▰▰▰▱▱▱ 80%                         │
├───────────────────────────────────────────────┤
│ ▾ Materials used (3)                            │  collapsible
│   Flour × 2 kg · Eggs × 12 · Butter × 500 g     │
│   ▸ Record items used                           │
├───────────────────────────────────────────────┤
│ [        Set to Ready        ]                  │  sticky footer, 44px+
│ safe-area padding on phones                     │
└───────────────────────────────────────────────┘
```

Sections, in order:
1. **Header** (sticky): job ID, status badge, close button. The close button lives **inside** the header row, not absolutely positioned, so it can never overlap other controls (the same problem noted for the CRM mobile sheet).
2. **Stage strip**: four steps, done steps ticked, current step highlighted, with the stage word in text (not colour alone). Reuse the Sales `order-stage-strip` styling.
3. **Next-step line**: "Next: Mark Production Complete. The order moves to Decorating at the same time." Text comes from the stage helper (section 5.2).
4. **Summary**: product, options, quantity, due date and time with a text chip (Overdue / Due today / Due soon), delivery or pickup, order number, notes (clamped, with Show more), progress bar with a label.
5. **Materials**: collapsed by default when the job is Queued or Ready, open when Baking (that is when staff record flour, eggs and so on). Recorded items as a list; the entry form below it.
6. **Footer** (sticky): the one primary button; a secondary "Close" on desktop only.

### 4.2 Desktop (≥ 768px)

- `Sheet side="right"`, `width: clamp(420px, 36vw, 520px)`, full height. The board stays visible on the left so the card can be seen moving to the next column after the action.
- Overlay is light (not 80% black) so the board is still readable; clicking the overlay closes the drawer.
- Header, stage strip and footer are sticky; the middle scrolls.
- Material rows use a **two-line grid** inside the drawer: item (full width), then quantity + unit + notes in one row. Labels above each field.
- Keyboard: `Esc` closes, focus moves to the primary button on open and returns to the card on close, `Enter` on the primary button runs the confirm step.
- At 768–1100px the drawer is 420px and covers part of the board; that is acceptable.

### 4.3 Mobile (≤ 767.98px)

- **Bottom sheet**, `max-height: 92dvh`, rounded top corners, drag handle, swipe down to close (the `vaul` `Drawer` component already exists in `src/components/ui/drawer.tsx`; `Sheet side="bottom"` is the alternative if swipe-to-close is not wanted).
- Sticky header with the close button at least 44×44px; sticky footer with the primary button full width, 48px high, `padding-bottom: calc(12px + env(safe-area-inset-bottom))`.
- Stage strip shows **short labels** and scrolls sideways at 320–340px; the current step is centred (same behaviour as `StageTabs`).
- Material rows **stack**: item select (full width) → quantity and notes side by side → remove row. Inputs `min-height: 44px`, font 16px so iOS does not zoom.
- `Add row` and `Record items used` are full-width buttons under the rows; `Record items used` is a secondary style so it is not confused with the stage button.
- Notes: 3 lines then Show more; the full text is always available here (allergy information must never be cut off).
- Large system text (130–200%): nothing has a fixed height; the middle area simply scrolls.

### 4.4 What changes on the board when the drawer is open

- The card that was tapped keeps a visible **selected** outline while its drawer is open.
- After the primary action succeeds, the drawer **stays open and updates in place** (new status, new stage strip, new next-step line and button), and the board behind it moves the card. If the new stage is Ready, the footer shows "Mark as Awaiting Pickup".
- On mobile, a short toast above the footer ("Moved to Decorating") replaces `onNotice`, and the board tab does **not** switch automatically; a "Go to Decorating" link is shown under the toast.

### 4.5 Confirm and error states

| State | Behaviour |
|---|---|
| Tap primary | Button turns into "Confirm: move to {next stage}" plus a text "Cancel" link; auto-reverts after 5 seconds |
| Working | Button shows a spinner and is disabled; the rest of the drawer is read-only |
| Success | Drawer updates in place (4.4) |
| Server refuses (409, wrong status) | Red message **inside the drawer** above the footer, "This job is no longer in Baking. Refreshing…", then the drawer reloads the job |
| Not connected | Primary button disabled with the reason in text ("Offline: reconnect to move this job") |
| No permission | Primary button hidden; text "You do not have permission to move jobs" |
| Unsaved material rows when closing | Ask "Discard material entries?" |

### 4.6 Schedule (order) variant, if you want it

Same drawer, **read-only**: no stage buttons and no materials form; shows the stage strip, summary and full notes, plus a "View job" link that opens the job drawer on the Jobs tab. This keeps the earlier decision that Schedule cards do not move anything, while letting staff read long notes. Leave it out if you want Schedule cards to remain completely non-interactive.

## 5. Data and logic

### 5.1 Fix first: the Baking → Decorating transition (bug 2.1.1)

- Confirm on a copy of the data: start a job, press Mark Production Complete, read the job status. If it is `DONE`, change `completeProduction` so a completed baking job always becomes `DECORATING` (stage `DECORATE`, progress 80), and set the order's station to `decorating` in the same save. Remove the `else DONE` branch for cake jobs, or restrict it to a clearly named job type if one exists.
- One-off data fix for jobs already left in `DONE` with an order still in production: review the list first, then move them to `DECORATING`.
- Make `/jobs/:id/ready` set the order to **Ready** (not `decorating`) and surface a failure from `advanceOrderToReadyForDelivery` instead of swallowing it.
- Add tests: start → complete gives `DECORATING` and order station Decorating; Set to Ready gives job Ready and order Ready; Set to Ready on a Baking job returns 409.

### 5.2 Shared stage helper (`src/lib/production-stage.ts`)

Already proposed in `Production_Layout_Optimization.md` 4.6. The drawer adds three exports:
- `jobStage(job)` returns `queued | baking | decorating | ready`.
- `nextAction(job)` returns `{ label, nextStage, orderEffect, endpoint }` or `null`. Example: for Baking, `{ label: "Mark Production Complete", nextStage: "Decorating", orderEffect: "The order moves to Decorating too" }`.
- `stageSteps(job)` returns the four steps with done / current flags for the stage strip.

The footer button, the next-step line and the stage strip all read from these, so the words cannot disagree with the board.

### 5.3 Component split

- `ProductionDrawer` (new, `production-drawer.tsx`): container choice (`Sheet right` vs bottom sheet), header, strip, footer. Props: `job`, `order`, `onClose`, `onAction`.
- `JobSummary`, `StageStrip`, `MaterialsSection` (new, small, in the same file or a sibling): the three middle blocks.
- `JobsBoard` keeps the data and handlers (`handleStartJob`, `handleCompleteJob`, `handleSetToReady`, `handleMarkAwaitingPickup`, `handleRecordMaterials`) unchanged and passes them in. **No handler, permission check or endpoint changes** from the layout work.
- Use `useIsMobile()` (already in the file) only to pick the container; the content is shared.

### 5.4 Fields

Existing job fields cover most of it: `variantOptions`, `quantity`, `requiredBy` / `requiredAt`, `progress`, `notes`, `status`, `stage`. Check what the board's order lookup returns for **delivery vs pickup** and the order's notes; add them to the response only if missing. Show time as well as date (`requiredAt`).

## 6. Implementation phases

### Phase 0: Workflow fix (server, do first)
Section 5.1. Verify on a copy of the data, then fix `completeProduction`, the `/ready` order update, and the stuck jobs. Without this the drawer's next-stage button is wrong for baked jobs.

### Phase 1: CSS and shared helper
- `production-stage.ts` (section 5.2) and tests.
- A `/* production drawer */` block in `styles.css`, scoped under `.prod-drawer` (the `.configuration-list` and `.dialog-actions` rules are shared with other modules, so do not edit those).
- Sticky header and footer, 44px targets, safe-area padding, dark mode.

### Phase 2: Drawer shell (desktop and mobile)
`ProductionDrawer` with `Sheet right` on desktop and bottom sheet on mobile; header with built-in close; stage strip; replace the `Dialog` in `JobsBoard`; keep selected-card outline.

### Phase 3: Summary and next-step footer
Summary block with due chip, delivery or pickup, notes clamp; next-step line; sticky primary button with confirm step, busy, error and offline states (4.5); in-place update after success (4.4).

### Phase 4: Materials section
Collapsible section; stacked labelled rows; unit shown; discard prompt; list of recorded items.

### Phase 5: Schedule read-only variant (only if wanted)
Section 4.6.

### Phase 6: Clean-up
Delete `handleQualityPass`, `handleQualityFail`, the `recordQualityCheck` import, the unused `confirmedDialogOrder` dialog and handler (unless Phase 5 replaces it), the `TC-Job-` string hack (use one `jobDisplayId()` helper), and the `onSelect`-gated rendering.

### Phase 7: Verify
- Widths 320, 360, 390, 430, 768, 1024, 1280, 1536; sidebar open and collapsed; light and dark; system text 100%, 130%, 200%.
- Walk one job through the whole flow in the drawer: Queued → Baking → Decorating → Ready → Awaiting Pickup. At each step the drawer, the Jobs board and the Schedule board show the same stage, and the order is never Ready before the job.
- Long product name (80+ characters), a 60-character word with no spaces, notes of 300+ characters, no notes, overdue / today / later due times, "Pick Up" state, 0 and 20+ recorded materials, 5 material rows.
- 5-second live refresh and server events while the drawer is open: the drawer keeps focus, scroll position and unsaved material rows.
- Another user moves the same job while the drawer is open: the drawer updates and shows the 409 message if you press a stale button.
- Offline and no-permission states.
- Keyboard: `Esc`, focus in and out, `Enter` on confirm; screen reader reads stage and next step; urgency shown as text, not colour only.
- Overflow check in the console with the drawer open (nothing should be returned):
  ```js
  [...document.querySelectorAll('.prod-drawer, .prod-drawer *')]
    .filter(e => e.scrollWidth > e.clientWidth + 1)
    .map(e => e.className || e.tagName)
  ```
- Run `production-materials.test.tsx` and the other existing tests, `npx tsc --noEmit` and `npm run build`; the Sales order dialog and Kanban look unchanged.

## 7. Files touched

| File | Change |
|---|---|
| `server/services/business.service.ts` | `completeProduction` always moves a baked job to `DECORATING` and the order to the Decorating station; remove the `DONE` branch for cake jobs |
| `server/routes/production.ts` | `/jobs/:id/ready` moves the order to Ready and does not swallow failures; stop using the quality-check route |
| Migration or script | One-off fix for jobs stuck in `DONE` (review list first) |
| `src/lib/production-stage.ts` (new) | `jobStage`, `nextAction`, `stageSteps`, labels and tones |
| `src/components/erp/production-drawer.tsx` (new) | Drawer shell, stage strip, summary, materials, footer |
| `src/components/erp/production-view.tsx` | Replace the job `Dialog`; pass handlers in; selected-card state; remove dead quality and confirmed-order code |
| `src/styles.css` | `.prod-drawer` block (desktop width, mobile bottom sheet, sticky header and footer, stage strip, stacked rows) |
| `src/components/ui/sheet.tsx` / `drawer.tsx` | No change expected; used as they are |
| `src/test/` and server tests | Stage helper, transition and drawer tests |

## 8. Risks

- **Bug 2.1.1 is unconfirmed.** I traced it by reading the code. If jobs are actually reaching `DECORATING` through another path I could not find (a database trigger, a seed script, a different route), Phase 0 shrinks to the `/ready` fix.
- **Data fix on real jobs.** Moving jobs stuck in `DONE` changes real statuses; back up and review the list first, as with the CRM merge.
- **Handlers and permissions must not change.** The drawer is layout only; `production.start`, `production.complete`, `production.set_ready` and the order update permission stay as they are.
- **A confirm step adds a tap** for busy bakers. If it feels slow, drop it for Start Production and Mark Production Complete and keep it only for Set to Ready and Awaiting Pickup.
- **Drawer covers the board** on narrow desktop widths (768–1100px). The selected card may sit behind it; scroll the board so the selected column stays visible, or accept it.
- **Shared CSS.** Keep new rules under `.prod-drawer`; `.configuration-list`, `.dialog-actions` and `.order-detail-dialog` are used by Sales and other modules.
- Do not touch the Sales order dialog, the Kanban work, or the topbar and sidebar mobile work.

## 9. Open points

1. **Should Schedule order cards open the read-only drawer** (4.6), or stay fully non-interactive?
2. **Confirm step:** on all moves, or only Set to Ready and Awaiting Pickup?
3. **Mobile container:** bottom sheet with swipe-down (`vaul` Drawer) or a plain bottom `Sheet` with a close button?
4. **Materials default:** open during Baking only, or always open?
5. **Allergy flag:** do you want notes containing words such as "allergy" or "nuts" shown in a highlighted block instead of clamped text?
6. **Bug 2.1.1:** please confirm what status a job has right after "Mark Production Complete" on your live data.

## 10. Suggested order

1. **Phase 0** (confirm and fix the Baking → Decorating transition, `/ready` order update; test on a copy).
2. Phase 1 (helper and CSS) → Phase 2 (drawer shell) → Phase 3 (summary and footer) → Phase 4 (materials) → Phase 6 (clean-up) → Phase 7 (verify).
3. Phase 5 (Schedule read-only drawer) only if you answer yes to open point 1.
