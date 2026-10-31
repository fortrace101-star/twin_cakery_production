# Optim — Quotations and Inquiries

**Owner of:** quotation edit/send/accept/convert, quote versions and expiry, the inquiry → quote → order funnel.
**Foundations used:** `Optim_architecture.md` (transition table, validation), `Optim_orders.md` §B1 (`priceLines()`), `Optim_notifications_audit.md` (events/rules), `Optim_security_rbac.md`.

> Evidence: `server/routes/quotations.ts`, `server/routes/inquiries.ts` (only skimmed), `server/database/store.ts` (`createQuotation`, `sendQuotation`, `acceptQuotation`), migration `003_sales.sql`. The app was not run. Inquiry internals beyond the route list were not reviewed in depth and are marked *unverified* where relevant.

---

# PART A — ASSESSMENT

| # | Finding | Evidence | Scenario |
|---|---|---|---|
| Q1 | **`PATCH /quotations/:id` never saves.** It builds `const updated = { ...quotation, ...patch, updatedAt }`, calls `store.persist()` and returns `updated`; it never calls an update function, so the stored object is unchanged. | `quotations.ts` PATCH | A salesperson changes the price of a wedding cake quote from 1.2M to 1.0M. The screen shows the new number (it is echoed back), a reload shows the old one, and the customer is sent the old figure. |
| Q2 | **`createdBy` is the first admin user** (`store.users().find(u => u.isAdmin)`), not the author. | `quotations.ts` POST | Conversion and win-rate by salesperson are impossible; every quote belongs to the owner. |
| Q3 | **Totals come from the client** (`total`, `taxAmount`, `unitTotal`, item prices). | POST | Same pricing risk as orders (`Optim_orders.md` O3). |
| Q4 | **`POST /:id/send` requires `quotations.accept`.** Send and accept share one permission. | `quotations.ts` | A salesperson who can send quotes can also mark them accepted on the customer's behalf. |
| Q5 | **No state guards.** `sendQuotation` and `acceptQuotation` set the status from any status. | `store.ts:453-473` | An EXPIRED or already CONVERTED quote can be "accepted" again. |
| Q6 | **No versions, no expiry handling, no convert-to-order that copies lines.** `validityExpiry` is stored but nothing reads it. | — | A quote from last month is accepted at last month's prices. |
| Q7 | **Conversion metric is misleading.** `conversionRate = won orders / all inquiries` (`analytics.ts /sales`), not quotes→orders. | `analytics.ts` | Rate looks low or high depending on how many inquiries become direct orders. |
| Q8 | **Inquiry spam path** — `POST /public/inquiries` creates a customer per unmatched submission (see `Optim_website.md`). | `public.ts:100-137` | Bots fill the customer table. |

---

# PART B — OPTIMIZATION, CORRECTION AND IMPROVEMENT

## B1. Fix the save bug and own the lifecycle (Q1, Q2, Q4, Q5)

### B1.1 Store function and route
```ts
// store.ts
updateQuotation(id: string, patch: Patch): Quotation | undefined {
  const q = this.db.quotations.find((x) => x.id === id);
  if (!q) return undefined;
  const allowed: (keyof Quotation)[] = ["notes", "validityExpiry", "salespersonId"];   // lines are re-priced separately
  for (const k of allowed) if (patch[k] !== undefined) (q as any)[k] = patch[k];
  q.updatedAt = new Date().toISOString();
  this.db.persist();
  return q;
}
```
```ts
router.patch("/:id", requirePermission("quotations.edit"), validate(EditQuote), async (req, res) => {
  const q = await quotesService.edit(req.params.id, req.body, actor(req));   // creates a NEW VERSION when status != DRAFT
  res.json(q);
});
```
`createdBy` becomes `session.userId`. Remove the first-admin lookup.

### B1.2 Transition table entries (registered in `Optim_architecture.md` §B1)
```ts
quotation: {
  send:    { from: ["DRAFT", "NEGOTIATION"], to: "SENT",     permission: "quotations.send",    event: "quotation.sent",
             guard: ({ row }) => { if (!row.items?.length) throw new ConflictError("Quote has no lines"); } },
  accept:  { from: ["SENT"],                 to: "ACCEPTED", permission: "quotations.accept",  event: "quotation.accepted",
             guard: ({ row }) => { if (row.validity_expiry && new Date(row.validity_expiry) < new Date()) throw new ConflictError("Quote expired"); } },
  expire:  { from: ["SENT", "NEGOTIATION"],  to: "EXPIRED",  permission: "system",             event: "quotation.expired" },
  convert: { from: ["ACCEPTED"],             to: "CONVERTED",permission: "quotations.convert", event: "quotation.converted",
             effects: async ({ tx, row, actor }) => { await ordersService.createFromQuote(tx, row, actor); } },
  reject:  { from: ["SENT", "NEGOTIATION"],  to: "REJECTED", permission: "quotations.edit",    event: "quotation.rejected" },
}
```
Verify the real status list in `types.ts` (the code uses DRAFT, SENT, NEGOTIATION, ACCEPTED, CONVERTED; EXPIRED/REJECTED are proposed).

## B2. Server-priced lines and versions (Q3, Q6)
```sql
-- 028_quotation_versions.sql
ALTER TABLE quotations
  ADD COLUMN version INT NOT NULL DEFAULT 1,
  ADD COLUMN parent_quotation_id TEXT REFERENCES quotations(id),
  ADD COLUMN sent_at TIMESTAMPTZ, ADD COLUMN responded_at TIMESTAMPTZ,
  ADD COLUMN lost_reason TEXT, ADD COLUMN source TEXT,
  ADD COLUMN discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN converted_order_id TEXT REFERENCES orders(id);
CREATE UNIQUE INDEX uq_quote_version ON quotations (COALESCE(parent_quotation_id, id), version);
CREATE INDEX ON quotations (status, validity_expiry);
-- backfill sent_at from existing submitted_at
UPDATE quotations SET sent_at = submitted_at WHERE sent_at IS NULL AND submitted_at IS NOT NULL;
```
Editing a SENT quote creates v2 (copy, re-priced with `priceLines()`), marks v1 `SUPERSEDED`. The UI shows the chain ("v1 → v2") and what changed.

## B3. Convert to order (copies lines and prices, one click)
```ts
async createFromQuote(tx, q, actor) {
  const lines = priceLines(q.items, { canOverride: true, override: lockedPrices(q) });   // quoted price honoured until expiry
  const { subtotal, total } = orderTotals(lines, q.deliveryCharge ?? 0, q.taxAmount ?? 0, q.discount ?? 0);
  const o = await ordersRepo.insert(tx, { customerId: q.customerId, quotationId: q.id, items: lines, subtotal, total,
      status: "AWAITING_CONFIRMATION", paymentStatus: "UNPAID", createdBy: actor.userId,
      orderNumber: await nextOrderNumber(tx), inquiryId: q.inquiryId ?? null });
  await tx.query(`UPDATE quotations SET converted_order_id=$2 WHERE id=$1`, [q.id, o.id]);
  await emit(tx, { type: "order.created", entity: "order", entityId: o.id, orderId: o.id, data: { fromQuote: q.id } });
}
```
Quoted prices are honoured (via `lockedPrices`) because the customer accepted them, with `price_source='QUOTE'`; add `'QUOTE'` to the check constraint from `Optim_orders.md` §B3.

## B4. Expiry and chasing (Q6)
Scheduler (same worker as `Optim_notifications_audit.md` §B2.5):
- Every hour: SENT quotes with `validity_expiry < now()` → `transition("quotation", id, "expire")`.
- Rules: quote expires within 2 days → salesperson (`quotations.create`); accepted but not converted for 24 h → Sales; new inquiry unanswered after 1 h (escalate Admin at 4 h); quote sent with no response after 3 days → "chase" task.

## B5. Permissions
```sql
INSERT INTO permissions (id, key) VALUES
 ('perm-quotations-send','quotations.send'),
 ('perm-quotations-convert','quotations.convert')
ON CONFLICT (key) DO NOTHING;
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-' || replace(r.id,'role-','') || '-' || p.id, r.id, p.id
FROM permissions p JOIN roles r ON r.id IN ('role-admin','role-sales')
WHERE p.key IN ('quotations.send','quotations.convert')
ON CONFLICT (role_id, permission_id) DO NOTHING;
-- quotations.accept stays with its current holders (014 grants it to Sales)
```
`quotations.accept` is now only for recording the customer's acceptance, which an Admin or Sales lead does after the customer confirms.

## B6. Cross-module impact
| Module | Change |
|---|---|
| Orders | `createFromQuote`, shared `priceLines`, `order.created` carries `fromQuote` |
| Finance | Accepted-quote value feeds the pipeline report; no ledger posting until the order is confirmed |
| CRM | Quote events appear on the customer timeline; lost reasons feed segment notes (`Optim_crm.md`) |
| Analytics | Funnel inquiry → quote → order, quote response time, win rate by source/product/salesperson, average discount (`Optim_analytics.md`) |
| Notifications | New rules in B4 |
| RBAC | `quotations.send`, `quotations.convert` (B5) |
| Website | `source` tag on inquiries carried into quotes (`Optim_website.md`) |
| Database | `028_quotation_versions.sql` |

## B7. UI
| Element | Change |
|---|---|
| Quotation editor | Read-only server-calculated totals; line picker from catalogue; "Save" now persists; version chip (v2) |
| Quotation drawer | Action bar: Send, Mark accepted, Convert to order, Create revision, Mark lost (reason) |
| **New** Quote document | Print/PDF and a "Copy for WhatsApp" text block (lines, total, validity); logged as a customer interaction |
| Quotation list | Columns: version, expiry (red when within 2 days), age since sent; filters: expiring, awaiting response |
| Inquiry list (*unverified internals*) | Add "Source" and "First response time" columns; "Create quote" button copying the inquiry's details |

## B8. Tests
- PATCH changes persist after reload.
- `send` needs `quotations.send`; `accept` on EXPIRED → 409.
- Editing a SENT quote creates v2 and supersedes v1.
- Convert copies lines and prices, links `converted_order_id`, and cannot run twice.
- Expiry job moves only past-due SENT quotes.
