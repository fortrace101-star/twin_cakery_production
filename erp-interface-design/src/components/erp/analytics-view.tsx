import { useEffect, useState } from "react";
import { ChartNoAxesCombined, TrendingUp, Users, Wallet } from "lucide-react";
import { money, type Order } from "./data";
import { Metric, RevenueChart } from "./dashboard";
import { getDashboardAnalytics, getSalesAnalytics, type ServerDashboardAnalytics, type ServerSalesAnalytics } from "@/lib/api";

/**
 * E5 — Analytics module (and Sales ▸ Sales analytics): every figure comes
 * from GET /analytics/dashboard + GET /analytics/sales (spec §26: analytics
 * "static → DB queries"). Falls back to the bundled preview figures only when
 * the API is unreachable or the signed-in role lacks sales.analytics.
 * The Order history tab never reaches this component — the workspace renders
 * the shared history table for it first.
 */
export function AnalyticsView({ tab, orders = [] }: { tab: string; orders?: Order[] }) {
  const [dash, setDash] = useState<ServerDashboardAnalytics | null>(null);
  const [sales, setSales] = useState<ServerSalesAnalytics | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [d, s] = await Promise.all([getDashboardAnalytics(), getSalesAnalytics()]);
      if (!alive) return;
      setDash(d);
      setSales(s);
    })();
    return () => { alive = false; };
  }, []);

  const live = dash !== null || sales !== null;
  const breakdown = dash?.orderStatusBreakdown ?? {};
  const funnel: Array<[string, string]> = [
    ["Inquiries", String(sales?.inquiries ?? dash?.metrics.pendingInquiries ?? "—")],
    ["Quotations sent", String(sales?.quotations ?? dash?.metrics.pendingQuotations ?? "—")],
    ["Accepted quotations", String(sales?.acceptedQuotations ?? "—")],
    ["Confirmed (won) orders", String(sales?.confirmedOrders ?? orders.length)],
    ["Conversion rate", sales ? `${sales.conversionRate}%` : "—"],
  ];
  const heading = (title: string, note: string) => (
    <div className="panel-heading"><h2>{title}</h2><span>{note}</span></div>
  );
  const trendPanel = (
    <section className="panel">
      {heading("Revenue trend", live ? "12 months · live order & expense ledgers" : "demo figures · sign in for live data")}
      <RevenueChart period="This month" values={dash?.revenueTrend} labels={dash?.trendLabels} expenseValues={dash?.expensesTrend}/>
    </section>
  );

  return (
    <div className="analytics-view">
      <div className="metrics-grid">
        <Metric label="Conversion rate" value={sales ? `${sales.conversionRate}%` : "68.4%"} trend={sales ? `${sales.confirmedOrders} won` : "8.2%"} foot={sales ? `from ${sales.inquiries} inquiries` : "vs. last month"} icon={TrendingUp} color="lime" module="sales"/>
        <Metric label="Repeat customers" value={sales ? `${sales.repeatCustomerRate}%` : "42%"} trend={sales ? `${sales.totalCustomers} total` : "6.8%"} foot={sales ? "ordered more than once" : "vs. last month"} icon={Users} color="blue" module="crm"/>
        <Metric label="Average order value" value={money(sales ? sales.averageOrderValue : 2294)} trend={sales ? `${sales.confirmedOrders} orders` : "5.2%"} foot={sales ? "across the won ledger" : "vs. last month"} icon={Wallet} color="peach" module="finance"/>
        <Metric label="Gross profit" value={money(dash ? dash.metrics.grossProfit : 182080)} trend="" foot={dash ? `on ${money(dash.metrics.monthlyRevenue)} monthly revenue` : "64% gross margin"} icon={ChartNoAxesCombined} color="violet" module="finance"/>
      </div>

      {(tab === "Overview" || tab === "Sales analytics") && (
        <>
          {trendPanel}
          <section className="panel">
            {heading("Commercial funnel", "inquiry → quotation → order")}
            <div className="configuration-list">
              {funnel.map(([k, v]) => <p key={k}><span>{k}</span><strong>{v}</strong></p>)}
            </div>
          </section>
        </>
      )}

      {tab === "Sales trends" && (
        <>
          {trendPanel}
          <section className="panel">
            {heading("Trend summary", "ledger totals")}
            <div className="configuration-list">
              <p><span>Revenue (won orders)</span><strong>{money(sales ? sales.revenue : 0)}</strong></p>
              <p><span>Monthly revenue</span><strong>{money(dash ? dash.metrics.monthlyRevenue : 0)}</strong></p>
              <p><span>Direct costs</span><strong>{money(dash ? dash.metrics.directCosts : 0)}</strong></p>
              <p><span>Operating expenses</span><strong>{money(dash ? dash.metrics.expenses : 0)}</strong></p>
              <p><span>Gross profit</span><strong>{money(dash ? dash.metrics.grossProfit : 0)}</strong></p>
              <p><span>Outstanding balance</span><strong>{money(dash ? dash.metrics.outstandingPayments : 0)}</strong></p>
            </div>
          </section>
          <section className="panel">
            {heading("Order status breakdown", "all orders on the ledger")}
            <div className="configuration-list">
              {Object.keys(breakdown).length === 0
                ? <p><span>No orders yet</span><strong>—</strong></p>
                : Object.entries(breakdown).map(([status, count]) => <p key={status}><span>{status}</span><strong>{count}</strong></p>)}
            </div>
          </section>
        </>
      )}

      {tab === "Customers" && (
        <section className="panel">
          {heading("Customer value", "repeat behaviour · lifetime value")}
          <div className="configuration-list">
            <p><span>Total customers</span><strong>{sales?.totalCustomers ?? orders.length}</strong></p>
            <p><span>Repeat-customer rate</span><strong>{sales ? `${sales.repeatCustomerRate}%` : "—"}</strong></p>
            <p><span>Average lifetime value</span><strong>{money(sales ? sales.customerLifetimeValue : 0)}</strong></p>
            <p><span>Average order value</span><strong>{money(sales ? sales.averageOrderValue : 0)}</strong></p>
            <p><span>Lost / closed inquiries</span><strong>{sales?.lostInquiries ?? 0}</strong></p>
          </div>
        </section>
      )}

      {tab === "Product performance" && (
        <>
          <section className="panel">
            {heading("Best products", "by line revenue")}
            {sales && sales.bestProducts.length > 0 ? (
              <div className="configuration-list">{sales.bestProducts.map((p) => <p key={p.productId}><span>{p.name} · {p.orders} order{p.orders === 1 ? "" : "s"}</span><strong>{money(p.revenue)}</strong></p>)}</div>
            ) : (
              <p className="cell-sub">No product revenue recorded yet.</p>
            )}
          </section>
          <section className="panel">
            {heading("Best categories", "by revenue")}
            {sales && sales.bestCategories.length > 0 ? (
              <div className="configuration-list">{sales.bestCategories.map((c) => <p key={c.name}><span>{c.name}</span><strong>{money(c.revenue)}</strong></p>)}</div>
            ) : (
              <p className="cell-sub">No category revenue recorded yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}