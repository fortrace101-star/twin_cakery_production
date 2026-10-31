# Optim — Analytics (operations, time tracking, finance KPIs, customer performance)

**Owner of:** the reporting layer: milestones and time metrics, SLA policies, fact/dimension views, the metrics endpoint, KPI definitions, role-scoped dashboards and exports.
**Foundations used:** `domain_events` and `emit()` (`Optim_notifications_audit.md`), the ledger (`Optim_finance.md`), `Optim_architecture.md`.
**Consumes data from every module:** orders, quotations, production, inventory, purchasing, deliveries, CRM, staff. Each module file lists the events and columns it contributes; this file defines how they become numbers.

> Evidence: `server/routes/analytics.ts` (`/dashboard`, `/sales`), `server/routes/finance.ts` (`/reports`), `erp-interface-design/src/components/erp/analytics-view.tsx` (128 lines), `dashboard.tsx`, `api.ts` (`getDashboardAnalytics`, `getSalesAnalytics`, `listFinanceReports`), migrations `003`–`013`. The app was not run.

---

# PART A — ASSESSMENT

## A1. What exists
`GET /analytics/dashboard` (orders today, in production, due today, pending inquiries/quotes, outstanding payments, low stock, today/monthly revenue, direct costs, gross profit, expenses, delivery status, 12-month revenue and expense trend, order status breakdown, production and inventory summaries) and `GET /analytics/sales` (funnel counts, conversion, AOV, repeat rate, "customer lifetime value", best products and categories). Both require `sales.analytics`.

## A2. Findings
| # | Finding | Evidence | Scenario |
|---|---|---|---|
| N1 | **Everything is computed in memory per request**: whole-array `filter`/`reduce` repeated dozens of times; `outstandingPayments` runs `payments.filter` inside an `orders` loop (O(orders × payments)). | `analytics.ts` | Fine at hundreds of orders; seconds at tens of thousands. |
| N2 | **Revenue by order creation date** (`createdAt`, status ≠ CANCELLED) in `monthlyRevenue`, `todayRevenue` and `revenueTrend`. | `analytics.ts` | A June delivery shows as March revenue (see `Optim_finance.md` F3). |
| N3 | **Period mismatch**: `grossProfit = monthlyRevenue − directCosts`, with `directCosts` and `expensesTotal` summed over all time. | `analytics.ts` | Gross profit looks wrong from month 2 onward. |
| N4 | **Expense trend buckets use `e.createdAt`**, not the expense `date`. | `analytics.ts` expensesTrend | A back-dated expense lands in the month it was typed, not incurred. |
| N5 | **Hardcoded fallbacks in the UI**: gross profit falls back to `182080` and the footnote to "64% gross margin" when the dashboard fails to load. | `analytics-view.tsx:54` | During an API error the page shows invented, plausible-looking numbers. |
| N6 | **Misleading definitions.** `conversionRate` = non-cancelled orders ÷ all inquiries (not quote→order, and orders may not come from inquiries). `customerLifetimeValue` = total revenue ÷ customer count (an average revenue per customer, not lifetime value, and includes customers who never ordered). `repeatCustomerRate` counts >1 order over all time, not within a window. | `/sales` | The numbers move when you import customers. |
| N7 | **No time-based KPIs.** Nothing computes lead time, queue time, cycle time, delivery punctuality, payment cycle, quote turnaround. Jobs have no start/finish stamps; orders lack `confirmed_at`/`paid_at`; promised vs revised dates aren't stored (`Optim_production.md` P7, `Optim_orders.md` O9, O11). | migrations | "How long does a wedding cake take from order to delivery?" has no answer. |
| N8 | **Placeholders returned as data**: `productionSummary.estimatedCost: 0`, `shortageItems: ""`, `purchaseRequirements: ""`; `recentFeedback` is five comments joined with `"; "`. | `analytics.ts` | The UI shows "UGX 0 estimated" for every job. |
| N9 | **Cost and margin visible to anyone with `sales.analytics`.** The same endpoint returns `directCosts`, `grossProfit`, `expenses`. | `analytics.ts` | Sales sees margins; Production/Baker can't see anything. |
| N10 | **No date-range filter, comparison, export, drill-through or metric definitions.** | `api.ts` signatures take no range | Users can't answer "how did October compare with September". |
| N11 | **Historical numbers move.** Everything reads live rows; editing an old order changes last month's report. | design | Figures reported to the owner can't be reproduced. |

---

# PART B — OPTIMIZATION, CORRECTION AND IMPROVEMENT

## B1. Architecture: events → milestones → facts → metrics

### B1.1 Milestones (derived, one source of truth for "when did it happen")
```sql
-- 034_analytics_views.sql
CREATE VIEW order_milestones AS
SELECT order_id, milestone, MIN(occurred_at) AS occurred_at, (ARRAY_AGG(actor_id ORDER BY occurred_at))[1] AS actor_id
FROM (
  SELECT order_id, occurred_at, actor_id,
    CASE event_type
      WHEN 'inquiry.received'       THEN 'inquiry_received'
      WHEN 'quotation.sent'         THEN 'quote_sent'
      WHEN 'quotation.accepted'     THEN 'quote_accepted'
      WHEN 'order.created'          THEN 'order_created'
      WHEN 'order.confirmed'        THEN 'confirmed'
      WHEN 'job.created'            THEN 'job_created'
      WHEN 'job.started'            THEN 'production_started'
      WHEN 'job.finished'           THEN 'baking_done'
      WHEN 'job.qc_passed'          THEN 'qc_passed'
      WHEN 'order.ready'            THEN 'ready'
      WHEN 'delivery.dispatched'    THEN 'dispatched'
      WHEN 'delivery.completed'     THEN 'delivered'
      WHEN 'payment.fully_paid'     THEN 'balance_paid'
      WHEN 'feedback.recorded'      THEN 'feedback_received'
      WHEN 'crm.follow_up_done'     THEN 'follow_up_done'
    END AS milestone
  FROM domain_events WHERE order_id IS NOT NULL
) x WHERE milestone IS NOT NULL GROUP BY order_id, milestone;
```
Also derive `deposit_paid` (first CONFIRMED payment), `materials_reserved` (`stock.reserved`), `decorating_done` (step events). **Backfill** from the `audit_logs` rows copied into `domain_events` (`Optim_notifications_audit.md` §B1.1) and from table timestamps: `orders.delivered_at`, `deliveries.actual_dispatch_time`, `deliveries.actual_delivery_date`, `production_steps.started_at/completed_at`, `quality_checks.checked_at`, `payments.created_at`. The audit did not verify that every status path wrote an audit row, so run the coverage check first:
```sql
SELECT status, count(*) FROM orders o WHERE NOT EXISTS
  (SELECT 1 FROM domain_events e WHERE e.order_id=o.id AND e.to_status=o.status) GROUP BY 1;
```
Any non-zero row means history is missing for that status; those orders get milestones from table timestamps only and are flagged `approximate`.

### B1.2 Time metrics (p50 / p90, not only averages)
```sql
CREATE VIEW fact_order_timing AS
SELECT o.id AS order_id, o.customer_id, o.created_at,
  EXTRACT(EPOCH FROM (m_conf.occurred_at - m_order.occurred_at))/60 AS order_to_confirm_min,
  EXTRACT(EPOCH FROM (m_start.occurred_at - m_conf.occurred_at))/60 AS queue_min,
  EXTRACT(EPOCH FROM (m_qc.occurred_at   - m_start.occurred_at))/60 AS cycle_min,
  EXTRACT(EPOCH FROM (m_disp.occurred_at - m_ready.occurred_at))/60 AS dispatch_delay_min,
  EXTRACT(EPOCH FROM (m_deliv.occurred_at - m_conf.occurred_at))/60 AS lead_min,
  EXTRACT(EPOCH FROM (m_deliv.occurred_at - o.original_required_at))/60 AS lateness_vs_promise_min,
  EXTRACT(EPOCH FROM (m_paid.occurred_at - m_deliv.occurred_at))/86400 AS days_to_pay_after_delivery
FROM orders o
LEFT JOIN order_milestones m_order USING (order_id) …;   -- one LEFT JOIN per milestone, filtered by milestone name
```
(Write the joins as `LEFT JOIN order_milestones m_conf ON m_conf.order_id=o.id AND m_conf.milestone='confirmed'` etc.) Percentiles:
```sql
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY cycle_min) AS p50, percentile_cont(0.9) WITHIN GROUP (ORDER BY cycle_min) AS p90
FROM fact_order_timing WHERE created_at >= $1 AND created_at < $2;
```
| Metric | Definition | Needs from other modules |
|---|---|---|
| Quote turnaround | `inquiry_received → quote_sent` | inquiry event (`Optim_quotations.md`) |
| Quote-to-order | `quote_sent → quote_accepted` | quote events |
| Order lead time | `confirmed → delivered` | order, delivery events |
| Queue time | `confirmed → production_started` | `job.started` (`Optim_production.md`) |
| Production cycle | `production_started → qc_passed`, per product and size | job events, QC stored correctly (`Optim_production.md` P1) |
| Step durations | per `production_steps` vs standard minutes | step timers (`Optim_production.md` §B6) |
| Rework time | `qc_failed → qc_passed` | QC records |
| Dispatch delay | `ready → dispatched` | delivery events (`Optim_deliveries.md`) |
| Delivery punctuality | delivered − promised slot | `original_required_at`, slot fields |
| Payment cycle | invoice issued → fully paid; deposit → balance | invoices (`Optim_finance.md` §B3) |
| Follow-up lag | `delivered → follow_up_done` | CRM (`Optim_crm.md`) |
Use `Africa/Kampala` for day boundaries (`AT TIME ZONE 'Africa/Kampala'`) and store everything in UTC.

### B1.3 SLA policies and the checker
```sql
CREATE TABLE sla_policies (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, start_milestone TEXT NOT NULL, end_milestone TEXT NOT NULL,
  target_minutes INT NOT NULL, warn_at_pct INT NOT NULL DEFAULT 80, applies_to JSONB NOT NULL DEFAULT '{}', active BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE sla_breaches (order_id TEXT, policy_id TEXT, state TEXT NOT NULL, detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, policy_id, state));          -- state: WARN | BREACH; the key makes the checker idempotent
INSERT INTO sla_policies (id,name,start_milestone,end_milestone,target_minutes,applies_to) VALUES
 ('sla-quote','Quote within 1 hour','inquiry_received','quote_sent',60,'{}'),
 ('sla-start','Start production 24h before due','confirmed','production_started',0,'{"relative_to":"required_at","minutes_before":1440}'),
 ('sla-dispatch','Dispatch within 30 min of ready','ready','dispatched',30,'{}');
```
A worker (every 5 min, same scheduler as `Optim_notifications_audit.md` §B2.5) selects open orders whose start milestone exists and end milestone does not, compares elapsed to target, inserts into `sla_breaches` (WARN at `warn_at_pct`, BREACH at 100%) and emits `sla.warn` / `sla.breach`; the rules table routes them (Production, Delivery, Customer Service, escalate Admin).

### B1.4 Facts, dimensions, snapshots
Views (`fact_orders`, `fact_payments`, `fact_jobs`, `fact_deliveries`, `fact_expenses`, `fact_milestones`) with `dim_date` (generate_series, with `is_holiday` and `season` columns), `dim_customer`, `dim_product`. Start as plain views; make heavy ones materialized and refresh nightly:
```sql
CREATE MATERIALIZED VIEW mv_monthly_pnl AS …;      -- from the ledger
CREATE UNIQUE INDEX ON mv_monthly_pnl (period);
-- refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_pnl;   (node-cron 02:00 Africa/Kampala)
CREATE TABLE daily_metrics (day DATE, metric TEXT, dims JSONB NOT NULL DEFAULT '{}', value NUMERIC(18,4), PRIMARY KEY (day, metric, dims));
```
`daily_metrics` is written by a nightly job for each day and **closed periods are never recomputed**, so reported history does not change when someone edits an old record (N11). Reports for closed periods read the snapshot or the immutable ledger; the current period reads live.

### B1.5 One metrics endpoint with a metric registry
```ts
// server/analytics/registry.ts
export interface MetricDef { key: string; label: string; unit: "UGX" | "%" | "count" | "minutes" | "days";
  definition: string; permission: string; dateBasis: ("order" | "delivery" | "payment")[]; groupBy: string[];
  query: (p: { from: Date; to: Date; basis: string; groupBy?: string; filters: any }) => Promise<Series>; }
export const REGISTRY: Record<string, MetricDef> = {
  revenue:        { key: "revenue", unit: "UGX", permission: "analytics.finance", dateBasis: ["delivery","order","payment"], … },
  lead_time_p90:  { key: "lead_time_p90", unit: "minutes", permission: "analytics.operations", … },
  on_time_rate:   { … permission: "analytics.operations" }, repeat_rate: { … permission: "analytics.customers" }, …
};
// GET /analytics/metrics?metric=revenue&from=2026-10-01&to=2026-10-31&grain=day|week|month&compare=prev|yoy&groupBy=product&basis=delivery
router.get("/metrics", requireAuth, async (req, res) => {
  const def = REGISTRY[String(req.query.metric)]; if (!def) return res.status(404).json({ error: "Unknown metric" });
  await rbac.requirePermission(userId(req), def.permission);            // per-metric permission
  const q = parseMetricQuery(req.query);                                // validated, Africa/Kampala boundaries
  const [current, comparison] = await Promise.all([def.query(q), q.compare ? def.query(shift(q)) : null]);
  res.json({ metric: def.key, label: def.label, unit: def.unit, definition: def.definition, basis: q.basis, current, comparison,
             generatedAt: new Date().toISOString(), format: undefined });
});
```
`?format=csv` streams the series with the range and basis in the file name. Compare-to-previous-period and same-period-last-year are computed server-side so every chart supports them. The metric `definition` string is shown in the UI ("Revenue (delivery basis): invoice net revenue recognised when the delivery completed").

## B2. KPI catalogue (what to build, with owners)

### B2.1 Operations (`analytics.operations`)
On-time delivery %, average and p90 lateness, failed/rescheduled deliveries (needs the reason codes from `Optim_deliveries.md`); lead and cycle time distributions per product/size; capacity utilisation = booked cake-units ÷ capacity (`capacity_days`, `Optim_production.md` §B6); QC fail and rework rate and reasons; wastage % and cost by ingredient; stock days on hand, stock-outs, supplier lead-time reliability (`Optim_inventory.md`, `Optim_purchasing.md`); delivery cost per order.
```sql
-- on-time delivery %
SELECT 100.0 * count(*) FILTER (WHERE d.actual_delivery_at <= o.original_required_at + interval '15 minutes') / NULLIF(count(*),0)
FROM deliveries d JOIN orders o ON o.id=d.order_id
WHERE d.status='DELIVERED' AND d.actual_delivery_at >= $1 AND d.actual_delivery_at < $2;
```
(Column names follow the existing `actual_delivery_date` field and the new timestamps in `Optim_deliveries.md`; confirm names there.)

### B2.2 Finance (`analytics.finance`)
Revenue, gross margin %, net margin, average order value, deposit-collection rate (orders with deposit ÷ confirmed), **days to collect (DSO)** = receivables ÷ revenue × days, overdue receivables, cash runway, expense ratio, labour cost per order, margin per order and per product/size/occasion/channel (ledger + job costs), price/usage/yield variance (`Optim_finance.md` §B5). All finance metrics read the ledger so they match the finance reports exactly.

### B2.3 Customers (`analytics.customers`)
| Metric | Correct definition (replaces N6) |
|---|---|
| Repeat rate | customers with ≥2 delivered orders in the trailing 12 months ÷ customers with ≥1 in that window |
| Customer lifetime value | cumulative **margin** (not revenue) per customer, by cohort |
| RFM segments | recency, frequency, monetary quintile scores |
| Expected re-order interval | mean gap between a customer's delivered orders; flag "overdue" when exceeded (feeds CRM, `Optim_crm.md`) |
| Occasion rebooking rate | recurring `customer_events` that were followed by an order within ±14 days ÷ events due |
| Reminder conversion | reminders contacted → orders created, by occasion and template (`customer_event_reminders.outcome`) |
| Funnel | inquiry → quote → order → paid → delivered → reviewed with drop-off per stage |
| Payment behaviour | average days to pay, late-payment count |
| Satisfaction | feedback score, complaint rate, time to resolve |
| Source performance | website, WhatsApp, referral, Instagram: volume and margin (needs `source` on inquiry/quote/order, `Optim_website.md`) |
| Concentration | share of revenue from the top 10 customers |

### B2.4 Staff (`analytics.staff`, Admin only)
Jobs per baker, rework rate per baker, on-time start rate, labour minutes per product. Not shared with Sales or the bakers themselves beyond their own queue.

### B2.5 Sales
Quote response time, win rate by source/product/salesperson, average discount, cancellation rate by reason, amendment rate (`Optim_quotations.md`, `Optim_orders.md`).

## B3. Fixing the existing endpoints (N1–N5, N8, N9)
1. `GET /analytics/dashboard` keeps its response shape for the current UI but is rebuilt from SQL/ledger: `monthlyRevenue` = delivery-basis revenue for the current month; `directCosts` and `expenses` for the **same** range; `outstandingPayments` from the receivables view (`SELECT SUM(balance) FROM v_receivables`); `expensesTrend` bucketed by `expenses.date`.
2. Placeholder fields (`estimatedCost`, `shortageItems`, `purchaseRequirements`) are filled from `job_planned_consumption`, `v_inventory_availability` and `purchase_requirements`, or **removed** from the payload if not ready (never `0`/`""`).
3. Split by permission: `GET /analytics/dashboard` returns only the sections the caller may see; finance fields are omitted without `analytics.finance`. This replaces the single `sales.analytics` gate.
4. `GET /analytics/sales` redefines `conversionRate` (quote→order and inquiry→order as two fields), `repeatCustomerRate` (trailing 12 months) and renames `customerLifetimeValue` to `revenuePerCustomer` until real LTV (margin-based) exists.
5. Frontend: delete the `182080` and "64% gross margin" fallbacks in `analytics-view.tsx` and render `<EmptyState>` when `dash` is null or the request failed, with a retry button.

## B4. Permissions (N9)
```sql
INSERT INTO permissions (id, key) VALUES
 ('perm-analytics-operations','analytics.operations'), ('perm-analytics-finance','analytics.finance'),
 ('perm-analytics-customers','analytics.customers'),   ('perm-analytics-staff','analytics.staff'),
 ('perm-analytics-export','analytics.export')
ON CONFLICT (key) DO NOTHING;
-- keep sales.analytics as an alias for analytics.customers + sales funnel during transition, then retire it
```
| Role | Operations | Finance | Customers/Sales | Staff |
|---|---|---|---|---|
| Admin | ✔ | ✔ | ✔ | ✔ |
| Finance/Accountant | ✔ (read) | ✔ | ✔ (read) | ✖ |
| Production Manager | ✔ | ✖ (no margins) | ✖ | ✖ |
| Baker/Decorator | own queue and cycle times only | ✖ | ✖ | ✖ |
| Sales | funnel only | ✖ (payment status only) | ✔ | ✖ |
Role-specific grants are done in `Optim_security_rbac.md`'s role migration.

## B5. Notifications driven by analytics
SLA warn/breach (B1.3), margin below threshold (Admin), receivables crossing 7/14 days (Finance), capacity day over 100% (Production + Admin), reminder conversion dropping below target (weekly digest to the CRM owner), daily digest of low-severity items. Rules live in `notification_rules` (`Optim_notifications_audit.md`).

## B6. UI changes
| Element | Existing → change |
|---|---|
| Analytics page (`analytics-view.tsx`) | Role-aware tabs: **Overview, Operations, Finance, Customers, Staff**; each hides without its permission. Global filter bar: date range, grain, compare (prev / last year), date basis (order / delivery / payment), channel |
| KPI cards (`dashboard.tsx`, `analytics-view.tsx`) | 6–8 cards, each with delta vs the comparison period, a "?" definition popover, and a click-through to the filtered list behind it (e.g. "Overdue receivables" → Payments/Invoices filtered) |
| Trend charts | Revenue vs expenses vs gross margin on the same range; lead-time p50/p90 band; on-time % line with target |
| **New** Needs-attention list | Overdue payments, orders due in 48 h with no job started, SLA breaches, low stock, pending approvals (reads `attention_items` + rules) |
| **New** Time-tracking panel | Per-order timeline (milestones with durations and SLA colour) in the order drawer; funnel and distribution charts on Operations |
| **New** Metrics definitions page | Lists every metric with definition, basis, permission, last refresh |
| Export | CSV (and PDF) buttons on every chart/table, applying the active filters; gated by `analytics.export` |
| Empty/error states | Never invented numbers; loading skeletons while queries run |

## B7. Unified impact matrix
| Change | Needs from | Back end | DB | RBAC | UI |
|---|---|---|---|---|---|
| Delivery-basis revenue | `order.delivered` event, ledger | metrics registry | 033, 034 | `analytics.finance` | basis selector |
| Time metrics | job/order/delivery timestamps and events | views + worker | 023, 026, 029, 034 | `analytics.operations` | timeline, distributions |
| SLA | events, rules | checker | 034 `sla_*` | `analytics.operations` | breach badges |
| Customer metrics | CRM events/outcomes, source tags | views | CRM and website migrations | `analytics.customers` | segments, funnel |
| Snapshots | closed periods | nightly job | `daily_metrics` | — | "as reported" indicator |

## B8. Tests
- Revenue for an order created in March, delivered in June appears in June with `basis=delivery` and in March with `basis=order`.
- Dashboard gross profit uses the same range for revenue, costs and expenses.
- `/analytics/metrics` returns 403 without the metric's permission and a definition string for every metric.
- p50/p90 correct on a fixed fixture; Kampala midnight boundary assigned to the right day.
- Editing a closed-period order does not change the stored snapshot.
- API failure → UI shows empty state, never `182080`.
- Finance metric totals equal `/finance/reports/pnl` for the same range.
