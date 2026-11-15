# CRM Follow-up Section: Restored

**Status:** Not run or type-checked. Please test before deploying.

## Why it disappeared

- The CRM screen still received the list of orders awaiting follow-up, and the sidebar badge and bell notification still counted them, but no screen used that list.
- The CRM tabs were only **Customers**, **Occasions** and **Feedback**.
- The Feedback tab shows the same customer list as Customers, so there was nowhere to register a follow-up.

## What changed

### 1. New "Follow-ups" tab in Customers & CRM
Files: `data.ts`, `crm-view.tsx`

- **Pending view:** lists every Completed / Delivered order that has not been followed up. For each one you enter:
  - star rating
  - feedback type (general, compliment, complaint, product, delivery, service)
  - what the customer said
  - action taken / resolution (optional)
  - a "needs another follow-up later" checkbox
- **Register follow-up** saves the feedback, which then appears on the customer's Feedback tab. It also marks the follow-up as done, which clears the sidebar badge and the bell notification.
- **Done view:** lists follow-ups already completed, with a link back to the order.

### 2. The "follow-up done" mark now saves
File: `server/routes/orders.ts`

The server ignored `followUpCompletedAt`, so the mark only lasted until a refresh. That is why the notification kept coming back. It is now accepted and saved.

### 3. Feedback saving fixed
File: `server/routes/feedback.ts`

- The customer is taken from the order, so feedback can no longer be saved with an empty customer. That bug could make every later save fail with "Failed to persist changes".
- The rating must be between 1 and 5.
- The record stores the signed-in user instead of "admin".
- Editing feedback (`PATCH`) previously did not save. It now saves, and `id`, `customerId` and `orderId` cannot be changed.

## How to apply

1. Copy these four files over the same paths in your project:
   - `server/routes/orders.ts`
   - `server/routes/feedback.ts`
   - `erp-interface-design/src/components/erp/data.ts`
   - `erp-interface-design/src/components/erp/crm-view.tsx`
2. Rebuild the frontend and restart the server.
3. Test: complete an order, open **Customers & CRM > Follow-ups**, register a follow-up, refresh, and confirm the badge and notification stay cleared.

## Notes

- No CSS was added for the new cards. They reuse existing styles and may need spacing tweaks.
- Other CRM issues I noticed but did not change, from `optim/Optim_crm.md`:
  - Occasion reminders can be duplicated after contact.
  - The "Add" button on a customer's Occasions tab does nothing.
  - Customer addresses may not survive a server restart.
