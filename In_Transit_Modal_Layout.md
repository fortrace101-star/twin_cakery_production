# In-Transit Modal: Layout Readjustment (Deliveries)

Goal: the modal fits on screen, and an In-Transit order can be marked complete in one clear tap.
Build checked: `twin_cakery_production-main__5_`
Files: `erp-interface-design/src/components/erp/dialogs.tsx` (`OrderDialog`), `src/styles.css` (`.order-detail-dialog` block, about lines 724–770).

> Assumption: I could not find a separate "In-Transit" modal in `deliveries-view.tsx` (its Dispatch tab uses row buttons, no modal). The modal an In-Transit order opens is `OrderDialog` (class `order-detail-dialog`), so this plan reshapes that one. If you meant a different modal, tell me and I'll adjust.

---

## 1. Why it does not fit and why completing is awkward

1. **Too much stacked content.** Header, product card with a 85×75 image, three status tiles, a "Recipe v1.2 · Price snapshot" line, a 7-chip stage strip, Previous / Next buttons, a read-only Payment status field, the balance note, and a payment recorder (shown whenever the order is not fully paid). Together this is taller than a phone screen and many laptop screens.
2. **The action buttons scroll away.** The dialog is capped at `min(88vh, 860px)` and the body scrolls (`.order-form-scroll`), but the buttons (`Record payment`, `Update status`) sit **inside** that scrolling form. The sticky-footer rule exists only for `.order-form-dialog` (New order), not `.order-detail-dialog`, so on a small screen the buttons are below the fold.
3. **Completing takes two steps.** You tap **Next: Completed / Delivered** (it only selects the target stage), then scroll down to **Update status**. Nothing is obviously "the complete button".
4. **Duplicated information.** Payment status appears twice (tile and read-only input); the order status appears in the tile, the stage strip and the buttons.
5. **No mobile layout.** No rule adjusts the dialog for narrow screens (`vh` also misbehaves with mobile browser bars).

## 2. New layout

Three fixed zones: **header, a compact body, and a sticky footer** that is always visible.

**Desktop (about 520px wide) and mobile (bottom sheet, full width):**
```
┌──────────────────────────────────────┐
│ Order #TC-1044                    ✕    │  header
│ Aisha Birungi · Delivery               │
│ 📍 Plot 12, Kira Rd          [Call]    │
├──────────────────────────────────────┤
│ [img] Chocolate cake · 2 kg            │  compact product row (48px image)
│       UGX 250,000 (165,000 paid)       │
│ [In Transit] [Part paid] [Delivery]    │  one line of status chips
│ ▰▰▰▰▰▰▱  Step 6 of 7 · In Transit      │  slim progress bar
│ ⚠ Balance due UGX 85,000               │  only when unpaid
│ ▸ Record payment                       │  collapsed by default
├──────────────────────────────────────┤
│ [ ← Back ]   [ ✓ Mark delivered ]      │  sticky footer
└──────────────────────────────────────┘
```

Changes:
- **Header:** order number, customer · channel, and the delivery location (with a Call button if a phone number exists). Close stays top right.
- **Product row:** 48px thumbnail, product and options on one line each, amount with the amount paid in brackets. Image shrinks from 85×75.
- **Status chips:** one row of three small chips (Order, Payment, Delivery) instead of three tiles.
- **Stage strip:** replace the 7 wrapping chips with a slim 7-segment progress bar and the text "Step 6 of 7 · In Transit". The full strip is only needed when changing stages freely.
- **Remove** the "Recipe v1.2 · Price snapshot retained" line and the read-only **Payment status** field (it repeats the chip).
- **Balance due** note stays, shown only when money is owed.
- **Record payment** becomes a collapsed section, one row when opened: Amount (default = balance), Method, Reference (non-cash), **Record** button.
- **Sticky footer** (outside the scrolling area, fixed to the bottom of the dialog):
  - **Primary: ✓ Mark delivered** for an In-Transit order (moves it to Completed / Delivered). For other stages the primary reads **Move to {next stage}**.
  - **Secondary: ← Back**, which moves the order back one stage (replaces the Previous button).
  - Full width on mobile, 44–48px tall, thumb-reachable.
- **One tap to complete.** The primary button changes the status directly; no separate Next + Update steps. The existing green-tick receipt with **Undo** appears afterwards, so no extra confirmation is needed.
- **Unpaid order:** if a balance remains, the button shows a short line above it: "UGX 85,000 still unpaid. Mark delivered anyway?" with the button reading **Mark delivered anyway** (decision 3).

## 3. Fit rules (CSS)

- Dialog: `max-height: min(92dvh, 640px)` on desktop; on mobile (`max-width: 767.98px`) a bottom sheet with `max-height: 92dvh`, rounded top corners, `padding-bottom: env(safe-area-inset-bottom)`. Use `dvh`, not `vh`.
- Layout: `display: flex; flex-direction: column`; header and footer `flex: none`; only the body between them scrolls (`min-height: 0; overflow-y: auto`) as a fallback on very short screens.
- Footer is **not** inside the scrolling form: move it out of `.order-form-scroll` (or make `.order-detail-dialog .dialog-actions` sticky like `.order-form-dialog` already is).
- Target height of the normal In-Transit view: about 520px on desktop, and header + body + footer within the viewport on a 360×640 phone without scrolling.
- Touch targets 44px; text 16px in inputs (avoids iOS zoom); `overflow-wrap: anywhere` on address and product text.

## 4. Implementation steps

1. `dialogs.tsx` (`OrderDialog`): restructure the JSX into header / body / footer; compact product row and status chips; progress bar; collapsed payment recorder; remove the Payment status input and recipe line; add the primary action (calls the same `updateOrder(current.id, nextStage)` path used by `update()`), and Back.
2. `styles.css`: new compact styles, sticky footer for `.order-detail-dialog`, mobile bottom sheet rules.
3. Keep the current logic: `updateOrder`, payment resolution (`resolvePayment`), the success receipt with Undo, and the error dialog; no server change.
4. Update tests: `order-stage-nav.test.tsx` looks for a button named "Previous: In Transit" and similar; adjust to the new Back / Mark delivered labels (or keep the same accessible names).

## 5. Checks before release

- Screens: 360×640, 390×844, 320×568, landscape 844×390, 1366×768 and a desktop at 125% and 150% zoom: footer visible without scrolling.
- Orders that are: In Transit and fully paid, In Transit with a balance, a long address, a long product name.
- Mark delivered → green receipt with Undo → the order moves to Completed / Delivered in Deliveries and Sales.
- Other stages (Confirmed, Ready, Awaiting Collection) show the correct "Move to …" primary and still work.
- Light and dark mode.

## 6. Decisions needed

1. **Is `OrderDialog` the modal you mean?** (see the assumption at the top)
2. **Button wording:** "Mark delivered" or "Mark complete"?
3. **Unpaid balance:** allow completing with a warning (proposed), or require the payment to be recorded first?
4. **Back button:** keep a Back (previous stage) action in the footer, or hide it for In-Transit orders to avoid accidental moves?
5. **Payment recorder:** collapsed by default (proposed), or expanded when a balance is owed?
