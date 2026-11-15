# Feature Spec: Editing Orders

**Project:** Twin Cakery ERP (`twin_cakery_production-main (7).zip`)
**Goal:** Let authorised staff change an existing order, from the price to the delivery location, due time, order details and more, safely and with a full record of what changed.

Findings in section 1 come from reading the code in the uploaded project. The rest is a proposed design. Nothing here has been built or run.

---

## 1. What exists today

### 1.1 Current editing is almost non-existent
- There is no "Edit order" screen. `OrderDialog` (in `dialogs.tsx`) only changes **status** and **records payments**.
- The only edit endpoint is `PATCH /api/orders/:id` (`server/routes/orders.ts`), used mainly for status changes and the follow-up stamp.
- It is guarded by the permission `deliveries.update`. There is no `orders.update` permission (only `orders.view`, `create`, `confirm`, `cancel`).

### 1.2 The PATCH endpoint accepts fields it silently ignores
The route allows these fields: `notes, deliveryType, deliveryLocation, deliveryDate, deliveryTime, dueDate, dueTime, eventType, reference, guest, items, source, fulfilmentType, followUpCompletedAt`.

But `store.updateOrder` (`server/database/store.ts`) only applies this list: `orderNumber, customerId, salespersonId, subtotal, discount, deliveryCharge, taxAmount, total, requiredBy, requiredAt, notes, status, paymentStatus, deliveryStatus, quotationId, inquiryId, createdBy, deliveredAt, followUpCompletedAt, station, deliveryLocation, locationNote`.

| Field the route accepts | Applied by the store? | Result |
|---|---|---|
| `notes`, `deliveryLocation` | Yes | Works |
| `dueDate`, `dueTime`, `deliveryDate`, `deliveryTime` | No (the model uses `requiredBy` / `requiredAt`) | Silently dropped |
| `items` | No (items are separate rows in `order_items`) | Silently dropped |
| `deliveryType`, `eventType`, `reference`, `guest`, `source`, `fulfilmentType` | No such fields on the model | Silently dropped |
| `locationNote` | Applied by the store, but not allowed by the route | Blocked |

So the API appears to support more editing than it does. The first job is to make it honest.

### 1.3 Money fields are locked on purpose
The route rejects `total`, `paymentStatus`, `customerId`, `paidAt` and `balanceDue` with a 400 (rule ORD-01). Subtotal, discount, delivery charge and tax are not editable through the route either. The order total is only calculated at creation (`POST /api/orders`):

```
subtotal = sum of item totals
total    = subtotal + deliveryCharge + taxAmount - discount
```

Unit prices are taken from the catalogue (`basePrice`) at creation, so a staff-entered price is ignored.

### 1.4 Other things an edit can affect
- **Confirming an order** runs side effects: invoice, inventory reservation, notifications, audit entry and a **production job** (`ProductionJob` copies `productId`, `quantity`, `variantOptions`, `requiredBy`, `requiredAt` from the order).
- **Payments** are separate records (`Payment`), so a price change can leave an order overpaid or underpaid.
- **Order snapshots and status history** are kept for the audit trail.
- The audit action list has no "order edited" action yet.

---

## 2. Scope

### In scope
- Edit order **details**: items (product, variant options, quantity), notes, event type, reference, guest count.
- Edit **pricing**: unit price per line, line discount, order discount, delivery charge, tax.
- Edit **schedule**: due / required date and time.
- Edit **delivery**: delivery type (delivery, pickup, collection), delivery location, landmark note.
- Edit **customer contact snapshot** on the order (name, phone) without changing the customer record.
- A **change history** showing who changed what, when, from what value to what value, and why.
- Permissions and status rules that decide who can edit what, and when.

### Out of scope (for now)
- Changing the customer an order belongs to (`customerId` stays locked; cancel and recreate instead).
- Editing recorded payments (a separate refund/adjustment feature).
- Bulk editing many orders at once.

---

## 3. Editing rules

### 3.1 What can be edited at each status

| Status | Details / items | Price | Schedule | Delivery | Notes |
|---|---|---|---|---|---|
| INQUIRY, QUOTATION, AWAITING_CONFIRMATION | Yes | Yes | Yes | Yes | Yes |
| CONFIRMED, PRODUCTION_REVIEW, READY_FOR_PRODUCTION | Yes, with warning (production job and reservations must be updated) | Yes (needs reason) | Yes (production notified) | Yes | Yes |
| IN_PRODUCTION, QUALITY_CHECK, REWORK_REQUIRED | Quantity or product locked. Decorations and notes only, by manager approval | Yes (needs reason) | Yes (production notified) | Yes | Yes |
| READY_FOR_DELIVERY, AWAITING_COLLECTION, IN_TRANSIT | No | Admin only | Admin only | Yes (dispatch notified) | Yes |
| COMPLETED_DELIVERED, CANCELLED | No | No (use a refund or adjustment flow) | No | No | Notes only |

These rules are a starting point and should be confirmed with the bakery (see section 10).

### 3.2 Permissions
Add new permissions in `server/services/rbac.service.ts` rather than reusing `deliveries.update`:

| Permission | Allows |
|---|---|
| `orders.update` | Edit details, schedule, delivery and notes |
| `orders.update_price` | Change unit prices, discounts, delivery charge and tax |
| `orders.update_locked` | Edit orders in late statuses (Admin / Proprietor by default) |

Suggested role defaults: Admin / Proprietor gets all three. Sales Manager gets `orders.update` and `orders.update_price`. Production Manager gets `orders.update` on production-stage orders only. Customer Service Representative gets `orders.update` without price.

### 3.3 A reason is mandatory for sensitive changes
Require a short free-text **reason** when changing price, quantity, due date or delivery location on a confirmed order. It is stored in the change history.

---

## 4. Pricing and payments

1. **Server recalculates totals.** The client sends the new lines and charges; the server recomputes `subtotal` and `total` with the same formula as creation and never trusts a client-sent total.
2. **Price overrides are explicit.** Add an optional `unitPriceOverride` per line. Without `orders.update_price` the server keeps the catalogue price. With it, the override is stored and flagged on the line (`priceOverridden: true`).
3. **Payment status is recomputed, not edited.** After any price change, recompute paid vs total from `Payment` records and set `paymentStatus` (UNPAID / PARTIAL / PAID). The UI should show:
   - **Balance due increased:** "Customer now owes KES X more."
   - **Overpaid:** "Customer has overpaid by KES X. Record a refund or credit." (No automatic refund.)
4. **Warn before saving** when the new total is lower than what has already been paid.
5. The existing ORD-01 block on directly setting `total`, `paymentStatus`, `balanceDue` stays in place for the old PATCH route. Totals only change through the new edit endpoint.

---

## 5. Keeping the rest of the system in step

When an order is edited, these records may need to change. Do all of it in one server-side operation so a failure does not leave things half-updated.

| If this changes | Update this |
|---|---|
| Items (product, options, quantity) | `order_items` rows; the linked `ProductionJob`; inventory reservations (release old, reserve new); invoice lines |
| Due date / time | `orders.requiredBy` / `requiredAt`; `ProductionJob.requiredBy` / `requiredAt`; any delivery record's scheduled time |
| Delivery type or location | `orders.deliveryLocation` / `locationNote`; the delivery record, if one exists |
| Price, discount, charges | `orders` totals; invoice total; recomputed payment status |
| Notes | `orders.notes`; production job notes if relevant |

Notify the people affected, using the existing notification service:
- **Production Manager** when items, quantity or due time change on an order that has a production job.
- **Dispatch / delivery staff** when location or time changes on an order with a delivery.
- **Customer** (optional, behind a checkbox "Notify customer") for due time or delivery changes.

> Verify before building: how invoices and inventory reservations are stored and whether they can be amended or must be voided and reissued. I did not trace those functions in detail.

---

## 6. Data model changes

### 6.1 Fix the field mismatch (do this first)
Decide on one set of names and use them everywhere. Recommended: keep `requiredBy` (date) and `requiredAt` (time) on the model, and map the UI's "due date / due time" to them. Add the missing columns for fields the form already tries to send:

```
orders.event_type        text
orders.reference         text
orders.guest_count       integer
orders.delivery_type     text      -- HOME_DELIVERY | PICKUP | COLLECTION
orders.source            text
orders.contact_name      text      -- snapshot for this order
orders.contact_phone     text
orders.version           integer   -- optimistic locking, default 1
```

Add a migration (next number after the existing ones) and add the new fields to `store.updateOrder`'s allowed list and to the Postgres write-back.

### 6.2 Change history table

```
order_revisions
  id              uuid / text PK
  order_id        FK -> orders
  version         integer          -- order version after this change
  changed_by      FK -> users
  changed_at      timestamptz
  reason          text
  changes         jsonb            -- [{ field, label, from, to }]
  total_before    numeric
  total_after     numeric
```

- Add the audit action `order:edited` to `AuditAction` in `types.ts` and write one audit entry per edit.
- Also save an **order snapshot** (the store already has `buildOrderSnapshot`) so the exact order before and after can be reproduced.

---

## 7. API design

### 7.1 New endpoint

```
PUT /api/orders/:id/edit
Permission: orders.update (plus orders.update_price / orders.update_locked as required)
```

Request:

```json
{
  "expectedVersion": 3,
  "reason": "Customer asked for a bigger cake and a later pickup",
  "changes": {
    "items": [
      { "id": "existing-line-id", "productId": "P-12", "variantOptions": "2 kg, Chocolate", "quantity": 1, "unitPriceOverride": 4800, "discount": 0 }
    ],
    "discount": 200,
    "deliveryCharge": 500,
    "taxAmount": 0,
    "requiredBy": "2026-11-20",
    "requiredAt": "15:30",
    "deliveryType": "HOME_DELIVERY",
    "deliveryLocation": "Ntinda, Kampala",
    "locationNote": "Blue gate, next to the pharmacy",
    "eventType": "Birthday",
    "reference": "Happy Birthday Amina",
    "guestCount": 40,
    "notes": "Nut-free",
    "contactName": "Amina K",
    "contactPhone": "0772000101"
  },
  "notifyCustomer": false
}
```

Behaviour:
1. Load the order. Return **404** if missing.
2. Return **409** if `expectedVersion` does not match the current `version` (someone else edited it).
3. Check status rules (section 3.1) and permissions. Return **403** or **409** with a clear message.
4. Validate every field (section 8). Return **400** listing all problems.
5. Apply the changes, recalculate totals, recompute payment status.
6. Update dependent records (section 5) in one transaction.
7. Insert the `order_revisions` row, audit entry and snapshot; increase `version`.
8. Send notifications.
9. Return **200** with the updated order, the list of changes made, and any warnings (for example "customer has overpaid").

### 7.2 Supporting endpoints
- `GET /api/orders/:id/revisions`: change history for the order.
- `POST /api/orders/:id/edit/preview`: same body as the edit; returns the recalculated totals, balance and warnings **without saving**. The UI uses this for the live summary.

### 7.3 Clean up the old PATCH route
Reduce `PATCH /api/orders/:id` to what it really does (status and follow-up stamp) and make it **reject unknown fields with a 400** instead of ignoring them. This removes the silent-drop problem described in 1.2.

---

## 8. Validation

- Quantity: whole number, 1 or more (decimals only for items sold by weight, using the existing `unit` field).
- Prices, discounts, charges, tax: 0 or more; a line discount cannot exceed the line total; total cannot go below 0.
- Due date and time: valid, not in the past (allow past only with `orders.update_locked` and a reason); warn if closer than the product's minimum lead time.
- Delivery type `HOME_DELIVERY` requires a delivery location. `PICKUP` / `COLLECTION` clears it.
- Phone: reuse the existing `phoneSchema` from the frontend and mirror it on the server.
- At least one item must remain.
- Text lengths: notes, reference and location capped (for example 1000 / 200 / 300 characters).

---

## 9. User interface

### 9.1 Entry points
- An **Edit order** button on the order drawer (`OrderDialog`) and in the orders table row menu. Hidden or disabled with a tooltip when the status or permission forbids it.
- The Customers & CRM order history can open the same dialog.

### 9.2 Edit order dialog
Reuse the layout of `NewOrderDialog` so staff see a familiar form. Sections:

1. **Items:** list of lines with product, options, quantity, unit price, line discount and line total. Add and remove lines.
2. **Pricing:** order discount, delivery charge, tax, then a live summary (subtotal, total, paid so far, balance due).
3. **Schedule:** due date and time.
4. **Delivery:** type, location, landmark note.
5. **Event details:** event type, reference, guest count, notes.
6. **Contact on this order:** name and phone.
7. **Reason for change** (required when section 3.3 applies) and a **Notify customer** checkbox.

### 9.3 Behaviour
- Show a **"Changes" summary** before saving: each changed field with old value and new value, and the effect on the total.
- Show **warnings** inline: production already started, customer overpaid, due date very soon.
- Fields that are locked at this status are shown read-only with a short explanation.
- On a **409 conflict**, show "This order was changed by someone else", reload it, and let the user reapply.
- After saving, refresh the order in the store (`refresh()` in `store.tsx`) and show a success notice.

### 9.4 History tab
Add a **History** tab to the order drawer listing each revision: who, when, reason, and each field's old to new value. Include status changes so there is one timeline.

### 9.5 Frontend wiring
- Add `editOrderApi`, `previewOrderEditApi` and `listOrderRevisionsApi` to `src/lib/api.ts`.
- Add an `editOrder` action to `store.tsx` that calls the API and then reloads the order.
- Add the `Order` UI fields that are missing from `data.ts` (`eventType`, `reference`, `guestCount`, `deliveryType`, `version`, and so on) and map them in the server-order to UI-order function.

### 9.6 Exact placement of each UI element

All paths are under `erp-interface-design/src/components/erp/`. Line positions are approximate and refer to the uploaded project.

#### A. The order drawer (`OrderDialog` in `dialogs.tsx`), the main home of editing

This is the dialog that opens when a user clicks an order anywhere in the app. Today it contains, top to bottom: header (order number, customer, delivery location), product summary, status chips, progress bar, balance-due note, "Record payment" panel, and a footer with Back / Next-stage buttons.

```
+--------------------------------------------------------------+
| Order #TC-1048                         [ Edit order ] [ X ]  |  <- (1) Edit button, header right
| Sarah Mwangi · WhatsApp                                      |
| (pin) Ntinda, Kampala   Blue gate     [Call]                 |
+--------------------------------------------------------------+
| [Details] [History]                                          |  <- (2) New tab strip
+--------------------------------------------------------------+
| (Details tab = today's body)                                 |
|   Chocolate celebration cake  2 kg · Chocolate               |
|   KES 4,500 (1,500 paid)                                     |
|   [Order: In production] [Payment: Partial] [Delivery: ...]  |
|   ======== progress bar ========                             |
|   (!) Balance due KES 3,000                                  |
|   > Record payment                                           |
|                                                              |
| (History tab) timeline of revisions + status changes   <- (3)|
+--------------------------------------------------------------+
| [< Back: Confirmed]              [ Next stage >]             |  <- unchanged footer
+--------------------------------------------------------------+
```

| # | Element | Exact location | Notes |
|---|---|---|---|
| 1 | **Edit order** button (pencil icon, `Pencil` from `lucide-react`, already imported in `module-table.tsx`) | In the dialog header row, to the right of `<DialogTitle>Order #{current.id}</DialogTitle>` (around line 50 of `dialogs.tsx`), left of the close button | Hidden if the user has no `orders.update`. Disabled with a tooltip ("Completed orders can't be edited") when the status forbids it. |
| 2 | **Details / History** tab strip | Directly under the header block and above `<div className="order-detail-body">` | Reuse the same tab styling as `.crm-tabs` / `.module-tabs`. Default tab is Details, so existing behaviour is unchanged. |
| 3 | **History tab** content | Replaces `order-detail-body` when History is selected | Timeline of revisions and status changes (section 9.4). Loaded on first open from `GET /orders/:id/revisions`. |
| 4 | **Edited badge** ("Edited 2x") | Inside `.order-status-chips`, after the Delivery chip | Only shown when the order has at least one revision. Click opens the History tab. |
| 5 | **Quick-edit pencils** (optional, phase 2) | Next to the delivery location in the header (`.dialog-head-loc`) and next to the product/amount block in `.order-detail-product` | Each opens the full Edit dialog scrolled to that section. |
| 6 | **Locked-field notice** | Under the status chips, same style as the existing `.form-note balance-due` line | One line, e.g. "Production has started, so items are locked." |

The footer buttons (Back / Next stage) stay exactly where they are. Edit is deliberately not placed in the footer so it can't be pressed by mistake while moving an order through stages.

#### B. The Edit Order dialog (new component `EditOrderDialog` in `dialogs.tsx`)

- **File:** add `EditOrderDialog` next to `NewOrderDialog` (starts around line 29) and reuse its form pieces (customer phone handling, `orderSchema`, time formatting).
- **How it opens:** a second dialog on top of the order drawer, driven by an `editing` state inside `OrderDialog`. On mobile it opens as a full-screen sheet (same pattern as the existing mobile drawer).
- **Layout, top to bottom:**

```
+--------------------------------------------------------------+
| Edit order #TC-1048                                    [ X ] |
+--------------------------------------------------------------+
| ITEMS                                                        |
|  Product        Options        Qty   Unit price   Line total |
|  Choc. cake     2 kg Choc.      1     4,500         4,500    |
|  [+ Add item]                                  (trash per row)|
+--------------------------------------------------------------+
| PRICING                                                      |
|  Order discount [ 0 ]  Delivery charge [ 500 ]  Tax [ 0 ]    |
+--------------------------------------------------------------+
| SCHEDULE            | DELIVERY                               |
|  Date [ 2026-11-20 ]|  Type  (o) Delivery ( ) Pickup         |
|  Time [ 15:30 ]     |  Location [ Ntinda, Kampala ]          |
|                     |  Landmark [ Blue gate ... ]            |
+--------------------------------------------------------------+
| EVENT & NOTES                                                |
|  Event type [ Birthday ]  Guests [ 40 ]  Reference [ ... ]   |
|  Notes [ ......................................... ]         |
+--------------------------------------------------------------+
| CONTACT ON THIS ORDER   Name [ ... ]   Phone [ ... ]         |
+--------------------------------------------------------------+
| Reason for change [ ............................. ] (required)|
| [ ] Notify customer                                          |
+--------------------------------------------------------------+
| SUMMARY (sticky)  Subtotal 4,500 · Total 5,000               |
|  Paid 1,500 · Balance due 3,500        (!) warnings          |
|  Changes: Time 10:00 -> 15:30, Delivery charge 0 -> 500      |
|                          [ Cancel ]  [ Save changes ]        |
+--------------------------------------------------------------+
```

| Element | Placement detail |
|---|---|
| Item rows | A table inside the first section. On phone screens each row becomes a stacked card. |
| Price fields | Unit price is read-only unless the user has `orders.update_price`; the field then shows a small lock icon. |
| Reason box | Sits just above the footer; marked required only when section 3.3 applies. |
| Summary and change list | A **sticky** panel at the bottom of the dialog body so the user always sees the new total and balance while scrolling. It is fed by the preview endpoint. |
| Save / Cancel | Dialog footer, right-aligned, using the existing `Button` component. Save is disabled until something has changed and the reason (if required) is filled in. |
| Warnings | Shown in the summary panel, using the same icon and style as `.form-note balance-due` (`CircleAlert`). |

#### C. Orders table, sales module (`module-table.tsx`, "Orders" tab)

- **Row action column (around line 110):** today the last column is a `MoreHorizontal` button that opens the order. Turn it into a small **dropdown menu** with: *Open order*, *Edit order*, *Record payment*. Keep the existing `stopPropagation` so row clicks still work.
- Edit order is disabled (greyed, with a tooltip) when permissions or status don't allow it.

#### D. Sales kanban board (`workspace.tsx`, order cards around line 99)

- Do **not** add a button to the small cards (they are already cramped). Clicking a card opens the order drawer, where Edit lives.
- Add a tiny **pencil dot** on the card corner only when the order was edited, so staff can spot changed orders at a glance.

#### E. Mobile order sheet (`module-table.tsx`, around lines 115 to 150)

The mobile row sheet currently ends with a button row: next-stage button (or *Open order*) and *Record Payment*. Add an **Edit order** button as the third button in this row, or as a text link under *Open order*, using the same `style={{ flex: 1 }}` pattern. It opens the same `EditOrderDialog` in full-screen mode.

#### F. Customers & CRM (`crm-view.tsx`)

- Customer detail, **Orders** tab (the `OrdersTab` component, around line 165): each order row already has an *Open order* action through `onOpenOrder`. Edit is reached from the drawer that opens, so no extra button is needed here.
- The **Recent orders** list in the Overview tab behaves the same way.

#### G. Other modules that show orders

| Module (file) | Placement |
|---|---|
| Deliveries (`deliveries-view.tsx`) | Add a small *Edit delivery details* link in the delivery detail panel that opens `EditOrderDialog` scrolled to the Delivery section, restricted to those fields for users who only have delivery rights. |
| Production (`production-view.tsx`) | Show an **"Order changed"** badge on a job card when its order has a revision newer than the job's last update, with a link to the History tab. Editing itself is not offered here. |
| Dashboard (`dashboard.tsx`) | No new controls. Dashboard order rows already open the order drawer. |

#### H. Notifications bell (`topbar.tsx`)

When someone else edits an order you are involved with (production manager for an order with a job, dispatch for an order with a delivery), add an item in the bell list, in the same style as the follow-up notifications: "Order TC-1048 was changed: due time moved to 15:30". Clicking it opens the order drawer on the **History** tab.

#### I. Where the new code lives

| What | File |
|---|---|
| `EditOrderDialog`, Details / History tabs, Edit button, Edited badge | `dialogs.tsx` (inside or beside `OrderDialog`) |
| Row dropdown menu and mobile sheet button | `module-table.tsx` |
| Edited dot on kanban cards | `workspace.tsx` |
| Order-changed badge on job cards | `production-view.tsx` |
| Delivery edit link | `deliveries-view.tsx` |
| Bell notification item | `topbar.tsx` |
| New API helpers (`editOrderApi`, `previewOrderEditApi`, `listOrderRevisionsApi`) | `src/lib/api.ts` |
| `editOrder` action and extra `Order` fields | `store.tsx`, `data.ts` |
| Styles for the dialog, timeline and summary panel | the existing stylesheet that holds `.order-detail-dialog` (search for that class) |

The `OrderDialog` file is large and mixes several concerns, so put `EditOrderDialog` and the History timeline in their own files (for example `edit-order-dialog.tsx` and `order-history.tsx`) and import them into `dialogs.tsx`. That keeps the diff small and makes the new code easy to test.

---

## 10. Open questions for the bakery

1. Which fields should be locked once production starts? (The table in 3.1 is a guess.)
2. Who may change prices, and should a price change on a confirmed order need a second person's approval?
3. When the customer has already paid and the price drops, what is the policy: refund, credit on the next order, or keep as tip?
4. Should the customer always be notified of due-time or location changes, or only when staff tick the box?
5. Should price edits be allowed to differ from the catalogue price at all, or only through a discount?
6. Do edits to a completed order ever need to be allowed (for example fixing a typo in the notes)? The spec allows notes only.

---

## 11. Implementation plan

**Phase 1: Foundation (backend)**
1. Migration: new order columns, `version`, and `order_revisions`.
2. Add the fields to `store.updateOrder` and the Postgres write-back.
3. Add `orders.update`, `orders.update_price`, `orders.update_locked` permissions and role defaults.
4. Add the `order:edited` audit action.

**Phase 2: Edit endpoint**
5. Implement `PUT /orders/:id/edit` with validation, status rules, recalculation and version check.
6. Implement the preview and revisions endpoints.
7. Update dependent records: production job, inventory reservations, invoice, delivery record.
8. Notifications.
9. Make the old PATCH route reject unknown fields.

**Phase 3: Frontend**
10. API helpers, store action and the missing `Order` fields.
11. Edit order dialog, change summary and warnings.
12. History tab and the Edit button with permission and status checks.

**Phase 4: Hardening**
13. Tests (below), then a pass on mobile layout.

---

## 12. Test checklist

**Server**
- Edit each field type and confirm it is saved and survives a server restart.
- Total is recalculated correctly after changes to items, discount, delivery charge and tax; a client-sent total is ignored.
- Payment status recomputes (unpaid, partial, paid, overpaid warning).
- Status rules: edits blocked or allowed as per section 3.1.
- Permission checks: no `orders.update_price` means price fields are rejected.
- Version conflict returns 409 and changes nothing.
- A failure halfway (for example the production job update) leaves the order unchanged.
- Production job, reservations, invoice and delivery record match the edited order.
- A revision row and audit entry are written with the correct before and after values.
- Old PATCH route rejects unknown fields.

**Frontend**
- Edit button visible only to permitted users and valid statuses.
- Live summary matches the server's preview.
- Locked fields are read-only with an explanation.
- Reason is required where specified.
- Conflict message and reload work.
- History tab shows the new revision immediately after saving.
- Works on a phone-sized screen.

---

## 13. Risks and notes

- **Production and stock:** changing items after confirmation is the riskiest part. Releasing and re-reserving inventory must be exact, or stock counts drift.
- **Money:** never let the client set totals. All calculation stays on the server.
- **Concurrency:** two staff editing the same order is likely at busy times, so the version check is required, not optional.
- **Data already in the system:** existing orders have no `version` or revisions, so default them to version 1 and start the history from the first edit.
- **Silent drops:** until the PATCH cleanup in 7.3 is done, any developer can send fields that do nothing. Fix that early so it does not cause confusion during this build.
