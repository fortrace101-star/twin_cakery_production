# UI features catalogue (per module)

Specific UI features and elements to build (**NEW**) or change (**ADJUST**), per module. The general plan in `Optim/Optim.md` says *what* changes in each layer; this file says *which screens and elements*.

How the skill uses this file:

1. Find the module section below.
2. Verify each target file in the code (paths marked `(locate in code)` or in parentheses were not confirmed; search for the component first).
3. Write the items into the module's `UI-CHECKLIST` block in `Optim/Optim_progress.md` using the format in `references/templates.md`, adding sub-tasks (states, permissions, responsive, a11y, tests) per item.
4. Add any further UI the skill decides is needed, appended here under **Added during implementation** with the date.

UI rules for every item: use the existing `DataTable`, `StatusBadge`, dialogs and shadcn/ui components; shared status-colour map; empty, loading and error states; confirm destructive actions; hide actions the user lacks permission for (server still enforces); large touch targets for Baker and Driver views; dark and light mode (`dark-mode-light-mode-guide.md`, `erp-design-system.md` in `erp-interface-design/`).

## SEC: Security & RBAC

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-SEC-01 | NEW | `erp-interface-design/src/components/erp/ (new roles-view.tsx)` | Role-permission matrix (roles as columns, `resource.action` rows, toggle with confirm + reason). | SEC-12 |
| UI-SEC-02 | NEW | `erp-interface-design/src/components/erp/ (new users panel)` | User list with role assignment, active session list, 'revoke all sessions'. | SEC-06 |
| UI-SEC-03 | ADJUST | `erp-interface-design/src/components/erp/sidebar.tsx, workspace.tsx` | Hide nav items and actions the user cannot perform via `usePermission()`. | SEC-12 |
| UI-SEC-04 | ADJUST | `erp-interface-design/src/pages/LoginPage.tsx` | Lockout/429 message with countdown; no role hints on failure. | SEC-03 |
| UI-SEC-05 | NEW | `erp-interface-design/src/components/erp/dialogs.tsx` | Reusable `ApprovalRequestDialog` and approvals inbox entry. | SEC-10 |

**Added during implementation:** _none yet_

## ORD: Orders

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-ORD-01 | ADJUST | `erp-interface-design/src/components/erp/workspace.tsx (order detail)` | Payment badge read-only and derived; remove editable total/payment/status controls. | ORD-01 |
| UI-ORD-02 | NEW | `erp-interface-design/src/components/erp/dialogs.tsx` | Reschedule dialog (new date, reason code, note) and Cancel dialog (reason, refund/forfeit preview). | ORD-05 |
| UI-ORD-03 | NEW | `erp-interface-design/src/components/erp/workspace.tsx` | Amendment dialog showing price delta and resulting balance. | ORD-06 |
| UI-ORD-04 | NEW | `erp-interface-design/src/components/erp/workspace.tsx` | Order timeline (milestones, who/when) and comments panel with @mentions. | ORD-08 |
| UI-ORD-05 | ADJUST | `erp-interface-design/src/components/erp/dialogs.tsx (new order)` | Price display is read-only preview from server; 'Override price' needs permission and reason. | ORD-02 |
| UI-ORD-06 | ADJUST | `erp-interface-design/src/components/erp/module-table.tsx` | Status badge from shared status-colour map; filters for source, assignee, date basis. | ORD-03 |

**Added during implementation:** _none yet_

## QUO: Quotations & inquiries

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-QUO-01 | ADJUST | `erp-interface-design/src/components/erp/ (quote editor)` | Edits actually persist; show saved/dirty state and last-saved-by. | QUO-01 |
| UI-QUO-02 | NEW | `erp-interface-design/src/components/erp/ (quote editor)` | Version tabs (v1, v2) with diff and 'revert to version'. | QUO-04 |
| UI-QUO-03 | NEW | `erp-interface-design/src/components/erp/ (quote list)` | Expiry chip, 'Convert to order' button, send dialog (WhatsApp/PDF). | QUO-05 |
| UI-QUO-04 | NEW | `erp-interface-design/src/components/erp/ (inquiries)` | Inquiry SLA badge (age since received) and unanswered filter. | QUO-07 |

**Added during implementation:** _none yet_

## PROD: Production

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-PROD-01 | ADJUST | `erp-interface-design/src/components/erp/production-view.tsx` | Job actions enabled only from valid states; clear disabled reasons. | PROD-01 |
| UI-PROD-02 | ADJUST | `erp-interface-design/src/components/erp/production-view.tsx (QC form)` | Real QC form: result, checklist, photo, rework reason; submit persists. | PROD-02 |
| UI-PROD-03 | NEW | `erp-interface-design/src/components/erp/production-view.tsx` | Week calendar with capacity bars, colour-coded status, drag-to-reschedule (uses ORD reschedule). | PROD-06 |
| UI-PROD-04 | NEW | `erp-interface-design/src/components/erp/production-view.tsx` | Printable daily production sheet (size, flavour, inscription, allergies, photos, delivery time); allergies/preferences also need CAT-03 and CRM-06. | PROD-06 |
| UI-PROD-05 | NEW | `erp-interface-design/src/components/erp/production-view.tsx` | Job detail: planned vs actual materials and cost, variance split. | PROD-04 |
| UI-PROD-06 | NEW | `erp-interface-design/src/components/erp/production-view.tsx` | Baker 'my queue' view with large touch targets (needs SEC-09 record-level scoping). | PROD-01 |

**Added during implementation:** _none yet_

## INV: Inventory

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-INV-01 | ADJUST | `erp-interface-design/src/components/erp/inventory-view.tsx` | Stock table shows on-hand / reserved / available separately. | INV-01 |
| UI-INV-02 | ADJUST | `erp-interface-design/src/components/erp/dialogs.tsx (adjust)` | Adjust dialog: reason code required, blocks negative result, approval hint for large write-offs. | INV-02 |
| UI-INV-03 | NEW | `erp-interface-design/src/components/erp/inventory-view.tsx` | Batch & expiry columns with near-expiry badge. | INV-03 |
| UI-INV-04 | NEW | `erp-interface-design/src/components/erp/inventory-view.tsx` | Stock-take screen (count sheet, variance, submit for approval). | INV-05 |

**Added during implementation:** _none yet_

## PUR: Purchasing & payables

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-PUR-01 | ADJUST | `erp-interface-design/src/components/erp/purchasing-view.tsx` | Supplier select required; show validation error instead of silent default. | PUR-02 |
| UI-PUR-02 | NEW | `erp-interface-design/src/components/erp/purchasing-view.tsx` | PO approval banner and receive dialog with partial quantities and discrepancy notes. | PUR-03 |
| UI-PUR-03 | NEW | `erp-interface-design/src/components/erp/purchasing-view.tsx` | Bills tab with due dates and payables ageing card. | PUR-04 |
| UI-PUR-04 | NEW | `erp-interface-design/src/components/erp/purchasing-view.tsx` | Supplier scorecard. | PUR-07 |

**Added during implementation:** _none yet_

## DEL: Deliveries

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-DEL-01 | ADJUST | `erp-interface-design/src/components/erp/deliveries-view.tsx` | 'Complete delivery/collection' opens a settlement dialog showing 'Collect UGX X' and disables confirm until collected or reason given. | DEL-04 |
| UI-DEL-02 | ADJUST | `erp-interface-design/src/components/erp/deliveries-panels.tsx` | Delivery card shows balance due, payment method chips, cash-with-driver state. | DEL-01 |
| UI-DEL-03 | NEW | `erp-interface-design/src/components/erp/dialogs.tsx` | Failure/cancel dialog with reason codes and reschedule option. | DEL-03 |
| UI-DEL-04 | NEW | `erp-interface-design/src/components/erp/deliveries-view.tsx` | Driver mobile view: my deliveries, big buttons, POD capture (photo/OTP). | DEL-08 |
| UI-DEL-05 | NEW | `erp-interface-design/src/components/erp/ (finance-view.tsx)` | Remittance confirmation list for Finance. | DEL-05 |
| UI-DEL-06 | ADJUST | `erp-interface-design/src/components/erp/deliveries-filters.tsx` | Filters by new statuses, driver, zone, late. | DEL-03 |

**Added during implementation:** _none yet_

## FIN: Finance

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-FIN-01 | ADJUST | `erp-interface-design/src/components/erp/finance-view.tsx` | Split into tabs: Overview, Invoices, Payments, Expenses, Reports. | FIN-07 |
| UI-FIN-02 | NEW | `erp-interface-design/src/components/erp/finance-view.tsx` | Receivables ageing card and 'Needs attention' list (overdue balances, unconfirmed mobile payments). | FIN-11 |
| UI-FIN-03 | NEW | `erp-interface-design/src/components/erp/dialogs.tsx` | Reversal/refund dialog with reason and approval status; payment rows show FAILED/REVERSED badges. | FIN-01 |
| UI-FIN-04 | NEW | `erp-interface-design/src/components/erp/finance-view.tsx` | Approvals queue (refunds, discounts, voids, manual journals) with acknowledge. | FIN-07 |
| UI-FIN-05 | NEW | `erp-interface-design/src/components/erp/finance-view.tsx` | Cash-up screen and remittance confirmation. | FIN-08 |
| UI-FIN-06 | NEW | `erp-interface-design/src/components/erp/finance-view.tsx` | Period close control with lock indicator. | FIN-06 |
| UI-FIN-07 | ADJUST | `erp-interface-design/src/components/erp/dashboard.tsx` | Revenue/gross-profit cards use the same period; show date basis. | FIN-03 |

**Added during implementation:** _none yet_

## ANA: Analytics

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-ANA-01 | ADJUST | `erp-interface-design/src/components/erp/analytics-view.tsx` | Remove invented numbers; empty states; date-range and compare controls on every chart. | ANA-01 |
| UI-ANA-02 | NEW | `erp-interface-design/src/components/erp/analytics-view.tsx` | Date-basis selector (order / delivery / payment). | ANA-03 |
| UI-ANA-03 | NEW | `erp-interface-design/src/components/erp/analytics-view.tsx` | Tabs by audience: Operations, Finance, Customers, Staff (permission-gated). | ANA-08 |
| UI-ANA-04 | ADJUST | `erp-interface-design/src/components/erp/dashboard.tsx` | 6-8 KPI cards, trend chart, needs-attention list; click-through. | ANA-09 |
| UI-ANA-05 | NEW | `erp-interface-design/src/components/erp/analytics-view.tsx` | Export CSV/PDF with applied filters; metric definitions drawer. | ANA-04 |

**Added during implementation:** _none yet_

## NOT: Notifications & audit

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-NOT-01 | ADJUST | `erp-interface-design/src/components/erp/topbar.tsx` | Bell: correct unread count, live updates, severity styling, acknowledge button. | NOT-07 |
| UI-NOT-02 | NEW | `erp-interface-design/src/components/erp/ (notification centre page)` | Full list with filters, mark all read, why-was-this-sent (event link). | NOT-06 |
| UI-NOT-03 | NEW | `erp-interface-design/src/components/erp/ (settings)` | Per-user channel preferences and quiet hours. | NOT-04 |
| UI-NOT-04 | NEW | `erp-interface-design/src/components/erp/ (audit viewer)` | Audit log viewer with filters and old/new diff. | NOT-05 |
| UI-NOT-05 | NEW | `erp-interface-design/src/components/erp/workspace.tsx` | Comments panel with @mention autocomplete. | NOT-08 |

**Added during implementation:** _none yet_

## CRM: Customers, CRM & feedback

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-CRM-01 | NEW | `erp-interface-design/src/components/erp/crm-view.tsx` | Customer timeline tab. | CRM-07 |
| UI-CRM-02 | NEW | `erp-interface-design/src/components/erp/crm-panels.tsx` | Reminder card: template preview, 'Send via WhatsApp', outcome buttons, 'Convert to order'. | CRM-02 |
| UI-CRM-03 | NEW | `erp-interface-design/src/components/erp/crm-view.tsx` | Consent toggles per channel; tags and segment filters. | CRM-03 |
| UI-CRM-04 | NEW | `erp-interface-design/src/components/erp/crm-view.tsx` | Duplicate-detected banner and merge dialog. | CRM-05 |

**Added during implementation:** _none yet_

## CAT: Catalogue & recipes

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-CAT-01 | NEW | `erp-interface-design/src/components/erp/ (recipe editor)` | Recipe editor with ingredient rows, yield, version history and approve action. | CAT-01 |
| UI-CAT-02 | NEW | `erp-interface-design/src/components/erp/ (catalogue)` | Cost vs price margin chip with warning below threshold. | CAT-02 |
| UI-CAT-03 | NEW | `erp-interface-design/src/components/erp/ (catalogue)` | Variant editor (size/flavour) with cost and price. | CAT-04 |

**Added during implementation:** _none yet_

## STF: Staff & payroll

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-STF-01 | ADJUST | `erp-interface-design/src/components/erp/staff-view.tsx` | Approve button disabled for the creator with explanation. | STF-01 |
| UI-STF-02 | NEW | `erp-interface-design/src/components/erp/staff-view.tsx` | Payroll posting status column (posted to finance). | STF-02 |
| UI-STF-03 | ADJUST | `erp-interface-design/src/components/erp/staff-view.tsx` | Payslip visible only to Admin and owner. | STF-04 |

**Added during implementation:** _none yet_

## WEB: Public website & web users

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-WEB-01 | NEW | `sweet-moments-cakery-web/src/pages (new track-order.tsx)` | Order tracking page. | WEB-04 |
| UI-WEB-02 | ADJUST | `sweet-moments-cakery-web/src/pages/contact.tsx` | Honeypot/CAPTCHA, inline validation, success state, source tag. | WEB-01 |
| UI-WEB-03 | NEW | `erp-interface-design/src/components/erp/OrderProposalsView.tsx` | Review queue for proposals/inquiries with accept/reject/mark spam. | WEB-01 |

**Added during implementation:** _none yet_

## ARC: Architecture & cross-cutting

| ID | Kind | Target | Element / behaviour | Supports step |
|---|---|---|---|---|
| UI-ARC-01 | NEW | `erp-interface-design/src/components/erp/ (needs-attention page)` | 'Needs attention' queue for failed side effects with retry/resolve. | ARC-07 |
| UI-ARC-02 | ADJUST | `erp-interface-design/src/components/erp/ui.tsx` | Single shared status-colour map used by orders, payments, deliveries, jobs. | ARC-05 |
| UI-ARC-03 | NEW | `erp-interface-design/src/components/erp/ui.tsx` | Standard empty/loading/error state components. | ARC-07 |

**Added during implementation:** _none yet_

