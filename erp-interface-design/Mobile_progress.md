# Twin Cakery ERP — Mobile Responsiveness Progress

> Tracking document for the mobile responsiveness work on the Twin Cakery / Cakery CRM ERP frontend (`erp-interface-design/`).

## Guiding rules
- Mobile breakpoint: `max-width: 767.98px`. Nothing below this changes desktop/tablet behavior (≥768px).
- State/decisions are tracked here; implementation details live in the affected source files.

---

## Phase & current status

### Implemented
- **F0.1** `index.html`: `viewport-fit=cover` added.
- **F0.2** `src/hooks/use-mobile.tsx`: `useMediaQuery` + `useIsMobile` based on `max-width: 767.98px`, synchronous via `useSyncExternalStore`.
- **F0.3 / F0.4 / F0.4b** `src/styles.css`:
  - Removed the 68px fixed phone rail from `@media(max-width:700px)` and cleaned up 7px text.
  - Added desktop-safe base classes for `.kanban-board`, `.station-board`, `.board-col-title`, `.order-card`.
  - Appended a mobile layer on top: shell, 16px inputs / 44px tap targets, tabs, toasts, dialogs, drawer nav, stage tabs, DataTable card/drawer CSS, KPI, CRM, web app, catalogue quick wins.
- **F0.5** Shell:
  - `workspace.tsx`: mobile nav `Sheet` (closes on pathname change and `onNavigate`, scrolls active tab into view), sales kanban mobile `StageTabs`/classes.
  - `sidebar.tsx`: `variant='drawer'`, `onNavigate`, drawer theme/nav close.
  - `topbar.tsx`: hamburger menu, collapsible search, hides theme/sign-in on phones.
- **F0.6** `src/components/ui/dialog.tsx`: full-screen on phones, 44px/safe-area close button, sticky footer actions, `DialogTitle pr-10`.
- **F0.7** `src/components/data-table/DataTable.tsx`: mobile card list + vaul detail drawer when `mobileCols > 2 && useIsMobile()`, `MobileRole` API with fallback roles, sort select, `tapAction`/drawer flow, footer/empty preserved, desktop table unchanged.
- **F0.8** `src/components/erp/stage-tabs.tsx`: stage chip tabs.

### Auth pages (5.0)
- `LoginPage.tsx`, `SignUpPage.tsx`, `ClaimAdminPage.tsx` responsive: `min-h-dvh`, `p-5 sm:p-8`, 16px inputs / 44px targets, `grid-cols-1 sm:grid-cols-2`, `role="alert"` on error/notice helpers.

### Views — mobile cards / drawer (DataTable) and board skeletons
- **Production / Jobs**: `production-view.tsx` skeleton-loading bug fixed earlier; now also uses mobile stage tabs and stage board layouts.
- **Sales & orders (5.2)**: `OrderTable`/`ModuleTable` mobile roles + drawer/details; sales kanban converted to `StageTabs`/classes on mobile; table/kanban toggle responsive; `OrderProposalsView` converted from raw table to `DataTable` with mobile roles; order dialogs inherit F0.6.
- **CRM (5.3)**: CRM grid stacks on mobile in CSS; order-history and feedback `DataTable`s have mobile roles/props. Full drawer-first master/detail refactor (R3) still pending.
- **Inventory (5.5)**: alerts/items `DataTable`s have explicit mobile roles (title/value/badge/meta/drawer/hide), `mobileTitle/subtitle/openLabel` (“Open ledger”), row activation opens ledger.
- **Purchasing (5.6)**: suppliers, requirements, goods received, purchase-orders `DataTable`s have explicit mobile roles/props. Line-item row class refactor (R6) and some inline form/mobile tweaks still pending.
- **Production (5.7)**: generic `ModuleTable` / `OrderTable` mobile roles/props in `module-table.tsx`.
- **Staff & payroll (5.8)**: team directory, attendance, salary periods, advances, payslips `DataTable`s have explicit mobile roles/props; inline/dialog CRUD forms still need D10/mobile polish.
- **Finance (5.9)**:
  - All six finance `DataTable`s (payments, order payment status, expenses, profitability lines, invoices, approvals) have mobile roles/props.
  - **D10 (partial)**: Payments and Expenses use desktop inline forms when on desktop/tablet, but trigger mobile form dialogs on phones (`useIsMobile` + `Dialog`) while preserving existing state/handlers.
- **Reports / analytics / web app**: catalogued top-level + foundation CSS; explicit mobile roles for any remaining tables still pending.

---

## Implemented in latest pass
- Converted `OrderProposalsView` from raw table to `DataTable` with mobile roles.
- Added explicit mobile roles/props to Inventory (alerts, items), Purchasing (suppliers, requirements, goods received, POs), Finance (payments, order payment status, expenses, profitability, invoices, approvals), Staff (directory, attendance, periods, advances, payslips), and CRM (order history, feedback) `DataTable`s.
- Finance D10 (partial): Payments and Expenses use mobile-triggered form dialogs while preserving desktop inline layout.

## Implemented (cumulative)
- Phase 0 foundation (viewport, sync mobile hook, CSS mobile layer, shell drawer nav, full-screen dialogs, DataTable cards + drawer, stage tabs).
- Auth pages (5.0) responsive.
- Production Schedule/Jobs skeleton-loading bug fixed earlier; now also mobile stage tabs.
- Sales Orders kanban mobile stage tabs + `OrderTable`/`ModuleTable` mobile roles.
- `Mobile_progress.md` created.

## Remaining (follow the plan)
- Catalogue / Web App / Analytics: add explicit mobile roles to any remaining `DataTable`s/raw tables (Catalogue in `module-table.tsx`, `web-app.tsx` has custom UI — verify), and confirm any analytics views.
- Complete D10: Staff inline CRUD forms and any remaining Finance dialogs on phones.
- CRM drawer-first master/detail refactor (5.3 / R3).
- Purchasing line-item row class refactor (5.6 / R6).
- Chart tap readout (M13), dialog grid / ERP-form audits across remaining views.
- QA: 320–767 widths, no sideways scroll, 16px inputs/no iOS zoom, 44px targets, full-screen modals, drawer→modal stacking (R1), real devices, vitest/axe/Lighthouse.

## Risks / notes
- **R1** Modal-over-drawer: on phones, the DataTable closes its drawer then activates the row once the animation completes, before opening any dialog, so stacked modals don’t fight the sheet.
- **R2** Mobile CSS lives in the appended mobile layer (last in `styles.css`), so it overrides base styles only on phones.
- **R3** CRM master/details are currently a CSS grid that stacks on phones; the intended “list first, detail drawer/secondary” pagination is not yet wired.
- **D10** inline CRUD forms become phone modals; desktop layout is preserved unchanged.
- **Auth/CORS**: browser behavior related to CORS claim-admin and Vite dev-server origin relay still needs user action (Vite restart + stale token clear if needed). A 401 on `GET /api/v1/auth/me` without a valid token is expected.
