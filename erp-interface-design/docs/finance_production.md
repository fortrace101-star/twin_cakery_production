# Finance & Production Integration Plan

## Overview
This document outlines the full implementation plan for integrating Finance and Analytics modules into the existing Production workflow within the Twin Cakery ERP system. The goal is to ensure both modules properly track production and finance data, with Finance accessible via the sidebar navigation and Production costs flowing into Finance profitability calculations.

## Current Status

### Finance Module
- **Defined in data.ts** (line 10): { id: 'finance', label: 'Finance', icon: 'Wallet', group: 'BUSINESS', tabs: ['Payments', 'Expenses', 'Profitability', 'Reports'] }
- **Permission**: inance: 'finance.view' (data.ts line 30)
- **Component**: inance-view.tsx — fully implemented with 4 tabs:
  - Payments — record payments (Cash/M-Pesa), view payment history
  - Expenses — record expenses by category, track direct costs
  - Profitability — KPI grid showing revenue, costs, profit per period
  - Reports — financial reports/statements for selected period
- **Backend API**: Full CRUD operations (listPayments, recordPayment, listExpenses, createExpense, updateExpense, deleteExpense, listFinanceReports)
- **Workspace Navigation**: ⚠️ **MISSING** — not wired into workspace.tsx module rendering

### Analytics Module
- **Defined in data.ts** (line 11): { id: 'analytics', label: 'Analytics', icon: 'ChartNoAxesCombined', group: 'BUSINESS', tabs: ['Overview', 'Order history', 'Sales trends', 'Customers', 'Product performance'] }
- **Permission**: nalytics: 'sales.analytics' (data.ts line 31)
- **Component**: nalytics-view.tsx — fully implemented with 5+ tabs:
  - Overview / Sales analytics — Conversion rate, repeat customers, AOV, gross profit, commercial funnel
  - Sales trends — Revenue summary, monthly revenue, direct costs, operating expenses, gross profit, outstanding balance, order status breakdown
  - Customers — Customer value, repeat-customer rate, average lifetime value, average order value, lost/closed inquiries
  - Product performance — Best products by line revenue, best categories by revenue
- **Backend API**: getDashboardAnalytics(), getSalesAnalytics()
- **Workspace Navigation**: ✅ **PRESENT** — renders as standalone module + sales ▸ Sales analytics tab

### Production Module
- **Component**: production-view.tsx — fully implemented with job board, status pipeline (PLAN→SHORTAGE→PURCHASE→PRODUCE→QUALITY→DONE)
- **Backend**: MemoryStore with persist() calls, econcileProductionJobs() backfill
- **Workspace Navigation**: ✅ **PRESENT** — renders ProductionView, ProductionSchedule, BakeryStation

## Gap Analysis

| **Connection** | **Finance** | **Analytics** | **Production** |
|----------------|-------------|---------------|----------------|
### Phase 1: Finance Module Wiring ⭐ *Priority 1*
**File**: `src/components/erp/workspace.tsx`
- **Task**: Add finance module to the module rendering ternary chain
- **Current**: Ends with `:module==='inventory'?`
- **Target**: Add `:module==='finance'?<FinanceView/>:` before inventory
- **Effort**: 15 minutes
- **Dependency**: None

### Phase 2: Production ↔ Finance Integration ⭐ *Priority 2*
**Files**: `finance-view.tsx`, `production-view.tsx`, backend API
- **Task 2.1**: Aggregate production job costs into finance profitability KPIs
  - Fetch `GET /production/jobs` costs when dashboard data loads
  - Calculate `grossProfit = dash.metrics.grossProfit - productionCosts`
  - Display "Production costs" sub-KPI in Profitability tab
- **Effort**: 2-3 hours
- **Dependency**: Phase 1 (finance module must be accessible first)

- **Task 2.2**: Link job completion to finance recording
  - When production job reaches DONE status, show CTA: "Record revenue & mark order paid"
  - Pre-fill order ID and calculate revenue based on order amount
  - Option to mark order as "paid" or "partially paid"
  - Auto-update finance view upon completion
- **Effort**: 2-3 hours
- **Dependency**: Phase 2.1 (cost aggregation must work first)

### Phase 3: Analytics Enhancement ✅ *Already Complete*
**File**: `src/components/erp/analytics-view.tsx`
- **Current state**: All tabs (Overview, Sales trends, Customers, Product performance) working
- **Minor enhancements** (optional):
  - Add production job count to Overview metrics
  - Show outstanding production orders in Order status breakdown
  - Add production-to-revenue conversion metric
- **Effort**: 30 minutes
- **Dependency**: None

### Phase 4: Testing & QA
- Verify finance module appears in sidebar and is clickable
- Test all 4 finance tabs render correctly
- Permission filtering: `finance.view` gates access correctly
- Verify analytics module continues working (no regressions)
- Test cross-module data flow (orders → finance → analytics)
- **Effort**: 2-3 hours
- **Dependency**: All previous phases

### Phase 5: Documentation 📖
**File**: `docs/finance_production.md` (this document)
- Update ERP design documentation with finance/production integration sections
- Add user guide sections:
  - "How to record payments and track cash flow"
  - "How production costs flow into profitability calculations"
  - "How to read the analytics dashboard"
- **Effort**: 1-2 hours
- **Dependency**: Phase 4 completion

## Success Criteria ✅

- [ ] Finance module appears in sidebar navigation and is clickable
- [ ] All 4 finance tabs (Payments, Expenses, Profitability, Reports) render correctly
- [ ] Permission filtering works (`finance.view` permission gates access)
- [ ] Analytics module continues working (no regressions)
- [ ] Production job completion can trigger finance cost recording
- [ ] Analytics dashboard shows cross-domain metrics (revenue, costs, profit, conversion)
- [ ] Production costs are aggregated into finance profitability KPIs
| Module defined | ✅ | ✅ | ✅ |
| Component implemented | ✅ | ✅ | ✅ |
| API/backend | ✅ | ✅ | ✅ |
| Workspace navigation | ⚠️ **Missing** | ✅ | ✅ |
| Permission filtering | ✅ (visibleModules) | ✅ (sales.analytics) | ✅ (production.view) |
| Production→Finance cost flow | ⚠️ **Not aggregated** | ✅ (cross-module insights) | ✅ (job status tracking) |
