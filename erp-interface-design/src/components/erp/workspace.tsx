import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Download, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { modules, money, isActiveOrder, tone, type Order } from "./data";
import { useWorkspace } from "./store";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { DashboardView } from "./dashboard";
import { AnalyticsView } from "./analytics-view";
import { Administration, Catalogue, ModuleTable, OrderTable, ProductionSchedule } from "./module-table";
import { BakeryStation, JobsView, ProductionView } from "./production-view";
import { Inventory } from "./inventory-view";
import { Purchasing } from "./purchasing-view";
import { WebAppManagement } from "./web-app";
import { FinanceView } from "./finance-view";
import { Staff } from "./staff-view";
import { OrderProposalsView } from "./OrderProposalsView";
import { NewOrderDialog, OrderDialog, SignInDialog } from "./dialogs";
import { IconButton } from "./ui";

const subtitles: Record<string,string> = { crm:'Every conversation, every customer, in one place.',sales:'Keep every order moving from inquiry to celebration.',catalogue:'Your creations, recipes, and configurable product options.',production:'A clear view of what’s baking and what’s coming next.',inventory:'Stay stocked, reduce waste, and keep production moving.',purchasing:'From purchase requirements to goods received.',delivery:'The final mile, made a little sweeter.',finance:'Payments, costs, and a healthy bottom line.',analytics:'A closer look at how your bakery is growing.',administration:'Your business, team, and workspace preferences.',staff:'Your team, their time, and payroll — handled with care.' };

export function Workspace({module='dashboard'}: {module?:string}) {
 const { orders, audit, connected, user, authError, signIn, signOut, completeFollowUp, permissions }=useWorkspace();
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
 const [theme,setTheme]=useState<'light'|'dark'>(() => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
 const [salesLayout, setSalesLayout] = useState<'table'|'kanban'>('table');
 useEffect(()=>{document.documentElement.classList.toggle('dark',theme==='dark');},[theme]);
const config=modules.find(m=>m.id===module);
 const activeTab=tab || config?.tabs[0] || '';
 const showHistory=(module==='sales'||module==='analytics') && activeTab==='Order history';
 const showOrders=module==='dashboard' || (module==='sales' && activeTab==='Orders') || showHistory;
 // The active-order surfaces (dashboard "Recent orders" + Sales "Orders" tab +
// CSV export) default to *active* orders only: completed/cancelled orders drop
// out of the working list but remain available for history/analytics. Selecting
// a specific status in the filter (including "Completed / Delivered") still shows exactly that.
 const matchesSearch=(o:Order)=>`${o.id} ${o.customer} ${o.product}`.toLowerCase().includes(search.toLowerCase());
 const filtered=orders.filter(o=>matchesSearch(o) && (statusFilter==='All statuses' ? isActiveOrder(o) : o.status===statusFilter));
 // Sales > "Order history": terminal orders only (Completed / Delivered + Cancelled) — the
 // dedicated home for history/analytics; shared search + status filter still apply.
 const historyFiltered=orders.filter(o=>matchesSearch(o) && !isActiveOrder(o) && (statusFilter==='All statuses' || o.status===statusFilter));
 // Rows on screen right now (history vs working list): drives the table, its
 // counts and the CSV export so they can never disagree.
 const visibleOrders=showHistory?historyFiltered:filtered;
 // Completed orders whose post-delivery follow-up has NOT been documented yet —
 // drives the Customers & CRM sidebar badge and the bell's follow-up notices.
 const followUps=orders.filter(o=>o.status==='Completed / Delivered'&&!o.followUpCompletedAt);
 const statusOptions=showHistory?['All statuses','Completed / Delivered','Cancelled']:['All statuses','Pending confirmation','Confirmed','In production','Ready','Awaiting Collection','In Transit','Completed / Delivered','Cancelled'];
 function exportData(){const csv=['Order,Customer,Product,Amount,Order status,Payment status,Delivery status',...visibleOrders.map(o=>[o.id,o.customer,o.product,o.amount,o.status,o.payment,o.delivery].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='twin-cakery-orders.csv';a.click();URL.revokeObjectURL(a.href);setNotice('Order export downloaded');}
 return <div className={`workspace ${collapsed?'sidebar-collapsed':''}`}>
  <Sidebar module={module} setTab={setTab} setSearch={setSearch} setStatusFilter={setStatusFilter} setHelp={setHelp} user={user} connected={connected} signOut={signOut} setLoginOpen={setLoginOpen} activeOrders={orders.filter(isActiveOrder).length} followUps={followUps.length} permissions={permissions}/>
  <div className="main-shell">
   <Topbar collapsed={collapsed} setCollapsed={setCollapsed} module={module} config={config} search={search} setSearch={setSearch} connected={connected} user={user} setLoginOpen={setLoginOpen} notification={notification} setNotification={setNotification} setNotice={setNotice} theme={theme} setTheme={setTheme} followUps={followUps}/>
   <main className="content">
    <div className="page-heading"><div><div className="eyebrow">{module==='dashboard'?'YOUR BAKERY AT A GLANCE':'TWIN CAKERY BAKERY'}</div><h1>{module==='dashboard'?`Good morning, ${user?.displayName || user?.username || 'Alex'}`:config?.label}<span className="heading-dot">.</span></h1><p>{module==='dashboard'?'Here’s what’s happening at Twin Cakery Bakery today.':subtitles[module]}</p></div><div className="heading-actions"><Button variant="outline" onClick={exportData}><Download/>Export</Button>{module !== 'inventory' && <Button onClick={()=>setNewOrder(true)}><Plus/>New order</Button>}</div></div>
    {module==='dashboard'?<>
     <DashboardView period={period} setPeriod={setPeriod} orders={orders} filtered={filtered} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onSelect={setSelected} onHelp={()=>setHelp(true)} audit={audit}/>
    </>:<>
     <div className="module-tabs">{config?.tabs.map(t=><Button key={t} variant="ghost" className={activeTab===t?'active':''} onClick={()=>{setTab(t);setSearch('');setStatusFilter('All statuses')}}>{t}</Button>)}</div>
     {showOrders && module==='sales' && activeTab==='Orders' ? <section className="panel module-table"><div className="panel-heading"><div><h2>All orders <span className="inline-count">{visibleOrders.length}</span></h2><span className="text-muted-foreground text-xs">Order, payment & delivery tracked separately</span></div><div className="flex items-center gap-2"><Button variant={salesLayout==='table'?'default':'outline'} size="sm" onClick={()=>setSalesLayout('table')}>Table</Button><Button variant={salesLayout==='kanban'?'default':'outline'} size="sm" onClick={()=>setSalesLayout('kanban')}>Kanban</Button></div></div>{salesLayout==='table'?<><div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label="Search orders" placeholder="Search orders, customers..." value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="filter-select"><SlidersHorizontal size={14}/><select aria-label="Filter orders by status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{statusOptions.map(s=><option key={s}>{s}</option>)}</select></label></div><OrderTable orders={visibleOrders} onSelect={setSelected}/><div className="table-foot"><span>{visibleOrders.length} orders</span><span>{new Date().toLocaleString("en", { month: "long", year: "numeric" })}</span></div></>:<div style={{padding:'16px'}}><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'16px'}}>{['Pending confirmation','Confirmed','In production','Ready','Awaiting Collection','In Transit','Completed / Delivered'].map(status=>{const list=visibleOrders.filter(o=>o.status===status);return <div key={status}><h3 style={{marginBottom:'12px',fontSize:'13px',fontWeight:600}}>{status} <span className="inline-count">{list.length}</span></h3>{list.map(o=><div key={o.id} className={`order-card order-row-tint tone-${tone(o.status)}`} style={{border:'1px solid var(--border)',padding:'12px',marginBottom:'8px',borderRadius:'8px',cursor:'pointer'}} onClick={()=>onSelect(o)}><div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}><strong>{o.id}</strong></div><div style={{fontSize:'12px',color:'var(--muted-foreground)',marginBottom:'4px'}}>{o.customer}</div><div style={{fontSize:'12px'}}>{o.product}</div><div style={{fontSize:'11px',color:'var(--muted-foreground)',marginTop:'4px'}}>{money(o.amount)}</div></div>)}</div>;})}</div></div>}</section>:showOrders?<section className="panel module-table"><div className="panel-heading"><h2>{showHistory?'Order history':'All orders'} <span className="inline-count">{visibleOrders.length}</span></h2><span className="text-muted-foreground text-xs">{showHistory?'Completed & cancelled orders, kept for history & analytics':'Order, payment & delivery tracked separately'}</span></div><div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label="Search orders" placeholder="Search orders, customers..." value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="filter-select"><SlidersHorizontal size={14}/><select aria-label="Filter orders by status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{statusOptions.map(s=><option key={s}>{s}</option>)}</select></label></div><OrderTable orders={visibleOrders} onSelect={setSelected}/><div className="table-foot"><span>{visibleOrders.length} orders</span><span>{new Date().toLocaleString("en", { month: "long", year: "numeric" })}</span></div></section>:module==='sales'&&activeTab==='Order proposals'?<OrderProposalsView onNotice={setNotice}/>:module==='webapp'?<WebAppManagement tab={activeTab} onNotice={setNotice} onSignIn={()=>setLoginOpen(true)}/>:module==='catalogue'?<Catalogue tab={activeTab} search={search} setSearch={setSearch} onNotice={setNotice} onSignIn={()=>setLoginOpen(true)}/>:module==='analytics'||(module==='sales'&&activeTab==='Sales analytics')?<AnalyticsView tab={activeTab} orders={orders}/>:module==='administration'?<Administration tab={activeTab} audit={audit} onNotice={setNotice} connected={connected}/>:module==='production'&&activeTab==='Schedule'?<ProductionView onSelect={setSelected}/>:module==='production'&&activeTab==='Jobs'?<JobsView onSelect={setSelected}/>:module==='production'&&activeTab==='Quality control'?<ModuleTable module={module} tab={activeTab} orders={orders} search={search} setSearch={setSearch} onSelect={setSelected} onNotice={setNotice} connected={connected} followUps={followUps} onCompleteFollowUp={completeFollowUp}/>:module==='production'&&activeTab==='Production costs'?<ModuleTable module={module} tab={activeTab} orders={orders} search={search} setSearch={setSearch} onSelect={setSelected} onNotice={setNotice} connected={connected} followUps={followUps} onCompleteFollowUp={completeFollowUp}/>:module==='production'?<ProductionView onSelect={setSelected}/>:module==='production'&&activeTab==='Bakery'?<BakeryStation onSelect={setSelected}/>:module==='inventory'?<Inventory tab={activeTab} search={search} setSearch={setSearch} onNotice={setNotice} onSignIn={()=>setLoginOpen(true)}/>:module==='purchasing'?<Purchasing tab={activeTab} search={search} setSearch={setSearch} onNotice={setNotice} onSignIn={()=>setLoginOpen(true)}/>:module==='finance'?<FinanceView tab={activeTab} onNotice={setNotice}/>:module==='staff'?<Staff tab={activeTab} search={search} setSearch={setSearch} onNotice={setNotice} onSignIn={()=>setLoginOpen(true)}/>:<ModuleTable module={module} tab={activeTab} orders={orders} search={search} setSearch={setSearch} onSelect={setSelected} onNotice={setNotice} connected={connected} followUps={followUps} onCompleteFollowUp={completeFollowUp}/>}</>}
    <footer className="page-footer"><span>© 2026 Twin Cakery Bakery</span><span>Made with care. Managed with clarity.<span className="presence-dot"/></span></footer>
   </main>
  </div>
  <NewOrderDialog open={newOrder} onOpenChange={setNewOrder} onCreated={o=>{setSelected(o);setNotice(`${o.id} created successfully`)}}/>
  <OrderDialog order={selected} onClose={()=>setSelected(null)} onNotice={setNotice}/>
  <SignInDialog open={loginOpen} onOpenChange={setLoginOpen}/>
  <Dialog open={help} onOpenChange={setHelp}><DialogContent><DialogTitle>Twin Cakery Bakery</DialogTitle><DialogDescription>{connected?'Live workspace · connected to your ERP':'Interface preview · live ERP'}</DialogDescription><p className="text-sm text-muted-foreground">{connected?'You are connected to the live Twin Cakery ERP. Orders, status changes, and the audit log are saved to your database.':'Sign in to connect to the live ERP. Until then the workspace stays empty; new orders and status changes require a signed-in session.'}</p><div className="space-y-3">{audit.slice(0,4).map((a,i)=><p className="audit-entry" key={i}><Check size={15}/>{a}</p>)}</div></DialogContent></Dialog>
  {notice&&<div className="toast" role="status"><Check size={16}/>{notice}<IconButton icon={X} label="Dismiss message" onClick={()=>setNotice('')}/></div>}
 </div>;
}
