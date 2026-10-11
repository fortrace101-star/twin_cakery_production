import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChartNoAxesCombined, Check, Download, Plus, Search, SlidersHorizontal, TrendingUp, Users, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { modules, money, isActiveOrder, type Order } from "./data";
import { useWorkspace } from "./store";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { DashboardView, Metric, RevenueChart } from "./dashboard";
import { Administration, Catalogue, ModuleTable, OrderTable, ProductionSchedule } from "./module-table";
import { WebAppManagement } from "./web-app";
import { NewOrderDialog, OrderDialog, SignInDialog } from "./dialogs";
import { IconButton } from "./ui";

const subtitles: Record<string,string> = { crm:'Every conversation, every customer, in one place.',sales:'Keep every order moving from inquiry to celebration.',catalogue:'Your creations, recipes, and configurable product options.',production:'A clear view of what’s baking and what’s coming next.',inventory:'Stay stocked, reduce waste, and keep production moving.',purchasing:'From purchase requirements to goods received.',delivery:'The final mile, made a little sweeter.',finance:'Payments, costs, and a healthy bottom line.',analytics:'A closer look at how your bakery is growing.',administration:'Your business, team, and workspace preferences.' };

export function Workspace({module='dashboard'}: {module?:string}) {
 const { orders, audit, connected, user, authError, signIn, signOut }=useWorkspace();
 const [collapsed,setCollapsed]=useState(false);
 const [search,setSearch]=useState('');
 const [tab,setTab]=useState('');
 const [newOrder,setNewOrder]=useState(false);
 const [loginOpen,setLoginOpen]=useState(false);
 const [selected,setSelected]=useState<Order|null>(null);
 const [notification,setNotification]=useState(false);
 const [help,setHelp]=useState(false);
 const [period,setPeriod]=useState('This month');
 const [statusFilter,setStatusFilter]=useState('All statuses');
 const [notice,setNotice]=useState('');
 const [theme,setTheme]=useState<'light'|'dark'|null>(null);
 useEffect(()=>{const saved=localStorage.getItem('tc-theme');const prefers=window.matchMedia('(prefers-color-scheme: dark)').matches;setTheme(saved==='dark'||saved==='light'?saved:prefers?'dark':'light');},[]);
 useEffect(()=>{if(!theme)return;document.documentElement.classList.toggle('dark',theme==='dark');localStorage.setItem('tc-theme',theme);},[theme]);
 const config=modules.find(m=>m.id===module);
 const activeTab=tab || config?.tabs[0] || '';
 const showOrders=module==='dashboard' || (module==='sales' && activeTab==='Orders');
 // The active-order surfaces (dashboard "Recent orders" + Sales "Orders" tab +
// CSV export) default to *active* orders only: completed/cancelled orders drop
// out of the working list but remain available for history/analytics. Selecting
// a specific status in the filter (including "Completed") still shows exactly that.
const filtered=orders.filter(o=>`${o.id} ${o.customer} ${o.product}`.toLowerCase().includes(search.toLowerCase()) && (statusFilter==='All statuses' ? isActiveOrder(o) : o.status===statusFilter));
 function exportData(){const csv=['Order,Customer,Product,Amount,Order status,Payment status,Delivery status',...filtered.map(o=>[o.id,o.customer,o.product,o.amount,o.status,o.payment,o.delivery].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='twin-cakery-orders.csv';a.click();URL.revokeObjectURL(a.href);setNotice('Order export downloaded');}
 return <div className={`workspace ${collapsed?'sidebar-collapsed':''}`}>
  <Sidebar module={module} setTab={setTab} setSearch={setSearch} setStatusFilter={setStatusFilter} setHelp={setHelp}/>
  <div className="main-shell">
   <Topbar collapsed={collapsed} setCollapsed={setCollapsed} module={module} config={config} search={search} setSearch={setSearch} connected={connected} user={user} setLoginOpen={setLoginOpen} signOut={signOut} notification={notification} setNotification={setNotification} setNotice={setNotice} theme={theme} setTheme={setTheme}/>
   <main className="content">
    <div className="page-heading"><div><div className="eyebrow">{module==='dashboard'?'YOUR BAKERY AT A GLANCE':'TWIN CAKERY BAKERY'}</div><h1>{module==='dashboard'?'Good morning, Alex':config?.label}<span className="heading-dot">.</span></h1><p>{module==='dashboard'?'Here’s what’s happening at Twin Cakery Bakery today.':subtitles[module]}</p></div><div className="heading-actions"><Button variant="outline" onClick={exportData}><Download/>Export</Button><Button onClick={()=>setNewOrder(true)}><Plus/>New order</Button></div></div>
    {module==='dashboard'?<>
     <DashboardView period={period} setPeriod={setPeriod} orders={orders} filtered={filtered} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onSelect={setSelected} onHelp={()=>setHelp(true)}/>
    </>:<>
     <div className="module-tabs">{config?.tabs.map(t=><Button key={t} variant="ghost" className={activeTab===t?'active':''} onClick={()=>{setTab(t);setSearch('')}}>{t}</Button>)}</div>
     {showOrders?<section className="panel module-table"><div className="panel-heading"><h2>All orders <span className="inline-count">{filtered.length}</span></h2><span className="text-muted-foreground text-xs">Order, payment & delivery tracked separately</span></div><div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label="Search orders" placeholder="Search orders, customers..." value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="filter-select"><SlidersHorizontal size={14}/><select aria-label="Filter orders by status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{['All statuses','Pending confirmation','Confirmed','In production','Ready','Completed'].map(s=><option key={s}>{s}</option>)}</select></label></div><OrderTable orders={filtered} onSelect={setSelected}/><div className="table-foot"><span>{filtered.length} orders</span><span>October 2026</span></div></section>:module==='webapp'?<WebAppManagement tab={activeTab} onNotice={setNotice}/>:module==='catalogue'?<Catalogue tab={activeTab} search={search} setSearch={setSearch}/>:module==='analytics'||(module==='sales'&&activeTab==='Sales analytics')?<div className="analytics-view"><div className="metrics-grid"><Metric label="Conversion rate" value="68.4%" trend="8.2%" foot="vs. last month" icon={TrendingUp} color="lime" module="sales"/><Metric label="Repeat customers" value="42%" trend="6.8%" foot="vs. last month" icon={Users} color="blue" module="crm"/><Metric label="Average order value" value={money(2294)} trend="5.2%" foot="vs. last month" icon={Wallet} color="peach" module="finance"/><Metric label="Gross profit" value={money(182080)} trend="14.1%" foot="64% gross margin" icon={ChartNoAxesCombined} color="violet" module="finance"/></div><section className="panel"><div className="panel-heading"><h2>{activeTab}</h2><span>October 2026</span></div><RevenueChart period="This month"/></section></div>:module==='administration'?<Administration tab={activeTab} audit={audit} onNotice={setNotice}/>:module==='production'&&activeTab==='Schedule'?<ProductionSchedule orders={orders} onSelect={setSelected}/>:<ModuleTable module={module} tab={activeTab} orders={orders} search={search} setSearch={setSearch} onSelect={setSelected} onNotice={setNotice} connected={connected}/>}</>}
    <footer className="page-footer"><span>© 2026 Twin Cakery Bakery</span><span>Made with care. Managed with clarity.<span className="presence-dot"/></span></footer>
   </main>
  </div>
  <NewOrderDialog open={newOrder} onOpenChange={setNewOrder} onCreated={o=>{setSelected(o);setNotice(`${o.id} created successfully`)}}/>
  <OrderDialog order={selected} onClose={()=>setSelected(null)} onNotice={setNotice}/>
  <SignInDialog open={loginOpen} onOpenChange={setLoginOpen}/>
  <Dialog open={help} onOpenChange={setHelp}><DialogContent><DialogTitle>Twin Cakery Bakery</DialogTitle><DialogDescription>{connected?'Live workspace · connected to your ERP':'Interface preview · October 2026'}</DialogDescription><p className="text-sm text-muted-foreground">{connected?'You are connected to the live Twin Cakery ERP. Orders, status changes, and the audit log are saved to your database.':'Sign in to connect to the live ERP. Until then this workspace shows bundled sample records; new orders and status changes are available for this session only.'}</p><div className="space-y-3">{audit.slice(0,4).map((a,i)=><p className="audit-entry" key={i}><Check size={15}/>{a}</p>)}</div></DialogContent></Dialog>
  {notice&&<div className="toast" role="status"><Check size={16}/>{notice}<IconButton icon={X} label="Dismiss message" onClick={()=>setNotice('')}/></div>}
 </div>;
}
