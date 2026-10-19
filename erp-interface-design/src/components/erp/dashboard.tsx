import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Boxes, ChartNoAxesCombined, ChefHat, MessageSquare, MoreHorizontal, PackageCheck, Receipt, Search, ShoppingBag, SlidersHorizontal, TrendingUp, Truck, Users, Wallet, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, orderBreakdown, donutGradient, breakdownLabel, breakdownSwatchClass, type Order } from "./data";
import { IconButton } from "./ui";
import { OrderTable } from "./module-table";
import { getDashboardAnalytics, type ServerDashboardAnalytics } from "@/lib/api";
export function Metric({label,value,trend,foot,icon:Icon,color,module}: {label:string;value:string;trend:string;foot:string;icon:LucideIcon;color:string;module:string}) {return <Link to={`/workspace/${module}`} className="metric"><div className="metric-top"><span>{label}</span><span className={`metric-icon metric-${color}`}><Icon size={17}/></span></div><strong className="metric-value">{value}</strong><div className="metric-foot"><span className={trend.includes('%')?'positive':'neutral-trend'}>{trend.includes('%')&&<ArrowUpRight size={12}/>} {trend}</span><small>{foot}</small></div></Link>}
export function RevenueChart({period,values,labels,expenseValues}: {period:string;values?:number[]|undefined;labels?:string[]|undefined;expenseValues?:number[]|undefined}) {
  // Live path: real 12-month revenue/expense buckets from
  // GET /analytics/dashboard. The demo arrays only render in the offline
  // preview (API unreachable / no sales.analytics permission).
  const live=Array.isArray(values)&&values.length>0;
  const demo=period==='This week'?[30,55,42,67,50,85,65]:[24,38,32,49,40,60,46,56,39,72,59,84,69,61,89,74,66,80,63,94,73,86,99,81,107,91,103,83];
  const rev=live?values!:demo;
  const exp=live?(expenseValues?.length?expenseValues:rev.map(()=>0)):rev.map(v=>Math.round(v*.42));
  const max=Math.max(...rev,...exp,1);
  const xLabels=live&&labels?.length?labels:(period==='This week'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['01 Oct','05 Oct','10 Oct','15 Oct','20 Oct','25 Oct','30 Oct']);
  const scale=(v:number)=>live?(v/max*100):(v/115*100);
  const yTicks=live?[max,Math.round(max*.75),Math.round(max*.5),Math.round(max*.25),0].map(v=>v>=1000?`${Math.round(v/1000)}k`:String(v)):['100k','75k','50k','25k','0'];
  return <div className="revenue-chart"><div className="chart-y">{yTicks.map((t,i)=><span key={i}>{t}</span>)}</div><div className="plot"><div className="chart-grid"><i/><i/><i/><i/><i/></div><div className="chart-bars">{rev.map((v,i)=><div className="bar-pair" key={i} title={`Revenue: ${money(live?v:v*1000)} · Expenses: ${money(live?(exp[i]??0):v*380)}`}><div className="revenue-bar" data-height={v} style={{height:`${scale(v)}%`}}/><div className="expense-bar" style={{height:`${scale(exp[i]??0)}%`}}/></div>)}</div><div className="chart-x">{xLabels.map(x=><span key={x}>{x}</span>)}</div></div></div>
}
export function ActivityFeed({audit=[]}: {audit?:string[]}) {
  // Live path: real audit-log lines from the workspace store; the demo feed
  // only renders while there is no audit history (offline preview).
  const feedItems = audit.length>0
    ? audit.slice(0,5).map((line)=>({icon:Search,color:'blue',title:'Audit trail',text:line,time:''}))
    : [{icon:ShoppingBag,color:'lime',title:'A new celebration is on the way',text:'Sarah’s chocolate cake order confirmed.',time:'12 min ago'},{icon:PackageCheck,color:'blue',title:'Ready for a sweet delivery',text:'Order #TC-1047 passed quality check.',time:'28 min ago'},{icon:Wallet,color:'violet',title:'Payment received',text:'UGX 2,400 from Grace Wanjiku.',time:'45 min ago'},{icon:MessageSquare,color:'peach',title:'A little customer love',text:'“The cake was absolutely amazing!”',time:'1 hour ago'}];
  return <div className="activity-list">{feedItems.map(({icon:Icon,...a},i)=><div className="activity-item" key={i}><span className={`activity-icon metric-${a.color}`}><Icon size={14}/></span><div><strong>{a.title}</strong><p>{a.text}</p>{a.time&&<small>{a.time}</small>}</div></div>)}</div>
}

export function DashboardView({period,setPeriod,orders,filtered,search,setSearch,statusFilter,setStatusFilter,onSelect,onHelp,audit=[]}: {period:string;setPeriod:(v:string)=>void;orders:Order[];filtered:Order[];search:string;setSearch:(v:string)=>void;statusFilter:string;setStatusFilter:(v:string)=>void;onSelect:(o:Order)=>void;onHelp:()=>void;audit?:string[];}) {
  const breakdown = orderBreakdown(orders);
  // Live analytics (E4/E5): KPI figures + 12-month trend come from
  // GET /analytics/dashboard; null (offline / no sales.analytics) keeps the
  // bundled preview figures. Period revenue/orders derive from the live store.
  const [dash, setDash] = useState<ServerDashboardAnalytics | null>(null);
  useEffect(() => { let alive = true; void getDashboardAnalytics().then((d) => { if (alive) setDash(d); }); return () => { alive = false; }; }, []);
  const todayISO = new Date().toISOString().slice(0, 10);
  const weekStartISO = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const inPeriod = (o: Order) => period === 'Today' ? o.date === todayISO : period === 'This week' ? o.date >= weekStartISO : o.date.slice(0, 7) === todayISO.slice(0, 7);
  const periodOrders = orders.filter(inPeriod);
  const periodRevenue = periodOrders.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + o.amount, 0);
  const trend = dash?.revenueTrend ?? [];
  const monthDelta = (() => {
    if (period !== 'This month' || trend.length < 2) return '';
    const last = trend[trend.length - 1] ?? 0;
    const prev = trend[trend.length - 2] ?? 0;
    return prev > 0 ? `${(((last - prev) / prev) * 100).toFixed(1)}%` : '';
  })();
  return (
    <>
     <div className="overview-label"><h2>Business overview <span className="live-label"><span/> Live overview</span></h2><select aria-label="Overview period" value={period} onChange={e=>setPeriod(e.target.value)}><option>This month</option><option>This week</option><option>Today</option></select></div>
     <div className="metrics-grid"><Metric label="Total revenue" value={money(periodRevenue)} trend={monthDelta} foot={period==='Today'?'taken today':period==='This week'?'last 7 days':'this month · live ledger'} icon={Wallet} color="lime" module="finance"/><Metric label="Total orders" value={String(periodOrders.length)} trend="" foot={period==='Today'?'placed today':period==='This week'?'in the last 7 days':'this month'} icon={ShoppingBag} color="blue" module="sales"/><Metric label="In production" value={String(dash?.metrics.ordersInProduction ?? orders.filter(o=>o.status==='In production').length).padStart(2,'0')} trend={dash?`${dash.metrics.ordersDueToday} due today`:'across the board'} foot={dash?.metrics.deliveryStatus ?? 'live from production'} icon={ChefHat} color="peach" module="production"/><Metric label="Outstanding payments" value={money(dash?.metrics.outstandingPayments ?? 0)} trend="" foot={dash?`${dash.metrics.pendingQuotations} quotations · ${dash.metrics.pendingInquiries} inquiries pending`:'from the order ledger'} icon={Receipt} color="violet" module="finance"/></div>
     <div className="charts-grid"><section className="panel production-panel"><div className="panel-heading"><div><h2>Order breakdown</h2><p>Every order, one step closer</p></div><Button variant="ghost" size="icon" asChild title="View production"><Link to="/workspace/production"><ArrowUpRight/></Link></Button></div><div className="donut-area"><div className="donut" style={{background:donutGradient(breakdown)}}><div><strong>{breakdown.total}</strong><span>Total orders</span></div></div><span className="donut-caption">{breakdown.total>0?'Every order, one step closer.':'No orders right now.'}</span></div><div className="donut-legend">{breakdown.segments.map(s=><div key={s.status}><span><i className={`legend-${breakdownSwatchClass(s.status)}`}/>{breakdownLabel(s.status)}</span><strong>{String(s.count).padStart(2,'0')}</strong>{s.outstandingAmount>0&&<span className="outstanding-badge">{money(s.outstandingAmount)}</span>}</div>)}</div></section><section className="panel revenue-panel"><div className="panel-heading"><div><h2>Revenue overview</h2><p>Your bakery’s performance over time</p></div><div className="segmented"><Button variant="ghost" className={period==='This week'?'selected':''} onClick={()=>setPeriod('This week')}>Week</Button><Button variant="ghost" className={period==='This month'?'selected':''} onClick={()=>setPeriod('This month')}>Month</Button></div></div><div className="chart-legend"><span><i className="legend-revenue"/>Revenue</span><span><i className="legend-expenses"/>Expenses</span>{monthDelta?<strong>{monthDelta} <TrendingUp size={13}/></strong>:null}</div><RevenueChart period={period} values={dash?.revenueTrend} labels={dash?.trendLabels} expenseValues={dash?.expensesTrend}/></section></div>
     <div className="operations-grid"><section className="panel orders-panel"><div className="panel-heading"><div className="title-with-count"><h2>Recent orders</h2><span>{filtered.length}</span></div><Button variant="link" asChild><Link to="/workspace/sales">View all orders<ArrowUpRight/></Link></Button></div><div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label="Search orders" placeholder="Search orders, customers..." value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="filter-select"><SlidersHorizontal size={14}/><select aria-label="Filter orders by status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{['All statuses','Pending confirmation','Confirmed','In production','Ready','Awaiting Collection','In Transit','Completed / Delivered','Cancelled'].map(s=><option key={s}>{s}</option>)}</select></label></div><OrderTable orders={filtered.slice(0,4)} onSelect={onSelect} compact/><div className="table-foot"><span>Showing {Math.min(filtered.length,4)} of {filtered.length} orders</span><span className="foot-note"><span/> All orders are up to date</span></div></section><section className="panel activity-panel"><div className="panel-heading"><h2>Activity feed</h2><IconButton icon={MoreHorizontal} label="View activity log" onClick={()=>onHelp()}/></div><ActivityFeed audit={audit}/><Button variant="link" asChild className="activity-link"><Link to="/workspace/administration">View activity log<ArrowRight/></Link></Button></section></div>
     <div className="bottom-grid"><section className="stock-alert"><span className="alert-icon"><Boxes size={20}/></span><div>{dash?(dash.metrics.lowStockItems>0?<><strong>{dash.metrics.lowStockItems} ingredient{dash.metrics.lowStockItems===1?'':'s'} below minimum</strong><p>Review stock before the next batch.</p></>:<><strong>Stock levels are healthy</strong><p>All ingredients are above their reorder level.</p></>):<><strong>A little restock goes a long way</strong><p>3 ingredients are below their minimum stock level.</p></>}</div><Button variant="outline" asChild><Link to="/workspace/inventory">Review stock<ArrowUpRight/></Link></Button></section><div className="daily-deliveries"><span className="delivery-icon"><Truck size={20}/></span><div>{dash?<><strong>{dash.metrics.ordersDueToday} order{dash.metrics.ordersDueToday===1?'':'s'} due today</strong><p>{dash.metrics.deliveryStatus}</p></>:<><strong>6 deliveries today</strong><p>4 ready for dispatch</p></>}</div><Button variant="ghost" size="icon" asChild title="View deliveries"><Link to="/workspace/delivery"><ArrowUpRight/></Link></Button></div></div>
    </>
  );
}
