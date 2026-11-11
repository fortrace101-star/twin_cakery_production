import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Check, Download, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { modules, money, isActiveOrder, tone, type Order } from "./data";
import { useWorkspace } from "./store";
import { useLiveRefresh } from "@/lib/live";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { DashboardView } from "./dashboard";
import { AnalyticsView } from "./analytics-view";
import { Administration, Catalogue, ModuleTable, OrderTable } from "./module-table";
import { BakeryStation, JobsView, ProductionView } from "./production-view";
import { Inventory } from "./inventory-view";
import { Purchasing } from "./purchasing-view";
import { WebAppManagement } from "./web-app";
import { FinanceView } from "./finance-view";
import { Staff } from "./staff-view";
import { OrderProposalsView } from "./OrderProposalsView";
import { NewOrderDialog, OrderDialog, SignInDialog } from "./dialogs";
import { IconButton } from "./ui";
import { StageTabs } from "./stage-tabs";
import { OrderMobileCard } from "./order-mobile-card";
import { useIsMobile } from "@/hooks/use-mobile"; import { Toaster } from "@/components/ui/toast";


const subtitles: Record<string,string> = { crm:'Every conversation, every customer, in one place.',sales:'Keep every order moving from inquiry to celebration.',catalogue:'Your creations, recipes, and configurable product options.',production:'A clear view of what’s baking and what’s coming next.',inventory:'Stay stocked, reduce waste, and keep production moving.',purchasing:'From purchase requirements to goods received.',delivery:'The final mile, made a little sweeter.',finance:'Payments, costs, and a healthy bottom line.',analytics:'A closer look at how your bakery is growing.',administration:'Your business, team, and workspace preferences.',staff:'Your team, their time, and payroll — handled with care.' };

const SALES_STAGES = ['Pending confirmation','Confirmed','In production','Ready','Awaiting Collection','In Transit','Completed / Delivered'];

export function Workspace({module='dashboard'}: {module?:string}) {
 const { orders, audit, connected, user, signOut, completeFollowUp, permissions, refresh }=useWorkspace();
 const isMobile = useIsMobile();
 useLiveRefresh(refresh);
 const { pathname } = useLocation();
 const [navOpen,setNavOpen]=useState(false);
 const [collapsed,setCollapsed]=useState(false);
 const [search,setSearch]=useState('');
 const [tab,setTab]=useState('');
 const [newOrder,setNewOrder]=useState(false);
 const [loginOpen,setLoginOpen]=useState(false);
 const [selected,setSelected]=useState<Order|null>(null);
 const [notification,setNotification]=useState(false);
 const [help,setHelp]=useState(false);
 const [period,setPeriod]=useState('Today');
 const [statusFilter,setStatusFilter]=useState('All statuses');
 const [notice,setNotice]=useState('');
 useEffect(()=>{ if(!notice) return; const t=setTimeout(()=>setNotice(''), 3500); return ()=>clearTimeout(t); },[notice]);
 const [theme,setTheme]=useState<'light'|'dark'>(() => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
 const [salesLayout, setSalesLayout] = useState<'table'|'kanban'>('table');
 const [kanbanStage, setKanbanStage] = useState<string>(SALES_STAGES[0] ?? 'Pending confirmation');
 useEffect(() => { document.documentElement.classList.toggle('dark',theme==='dark'); },[theme]);

 useEffect(()=>{ setNavOpen(false); }, [pathname]);
 const config=modules.find(m=>m.id===module);
 const activeTab=tab || config?.tabs[0] || '';
 useEffect(() => {
   if (!isMobile) return;
   document.querySelector('.module-tabs .active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
 }, [activeTab, isMobile]);
 const showHistory=(module==='sales'||module==='analytics') && activeTab==='Order history';
 const showOrders=module==='dashboard' || (module==='sales' && activeTab==='Orders') || showHistory;
 const salesOrdersTab=module==='sales' && activeTab==='Orders';
 const matchesSearch=(o:Order)=>`${o.id} ${o.customer} ${o.product}`.toLowerCase().includes(search.toLowerCase());
 const filtered=orders.filter(o=>matchesSearch(o) && (statusFilter==='All statuses' ? (salesOrdersTab || isActiveOrder(o)) : o.status===statusFilter));
 const historyFiltered=orders.filter(o=>matchesSearch(o) && !isActiveOrder(o) && (statusFilter==='All statuses' || o.status===statusFilter));
 const visibleOrders=showHistory?historyFiltered:filtered;
 const followUps=orders.filter(o=>o.status==='Completed / Delivered'&&!o.followUpCompletedAt);
 const statusOptions=showHistory?['All statuses','Completed / Delivered','Cancelled']:['All statuses','Pending confirmation','Confirmed','In production','Ready','Awaiting Collection','In Transit','Completed / Delivered','Cancelled'];
 function exportData(){const csv=['Order,Customer,Product,Amount,Order status,Payment status,Delivery status',...visibleOrders.map(o=>[o.id,o.customer,o.product,o.amount,o.status,o.payment,o.delivery].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='twin-cakery-orders.csv';a.click();URL.revokeObjectURL(a.href);setNotice('Order export downloaded');}

 const sidebarProps = { module, setTab, setSearch, setStatusFilter, setHelp, user, connected, signOut, setLoginOpen, activeOrders: orders.filter(isActiveOrder).length, followUps: followUps.length, permissions, orders, theme, setTheme };

 useEffect(() => {
   if (!isMobile) return;
   const first = SALES_STAGES.find((s) => visibleOrders.some((o) => o.status === s)) ?? SALES_STAGES[0] ?? 'Pending confirmation';
   if (!visibleOrders.some((o) => o.status === kanbanStage)) setKanbanStage(first);
 }, [isMobile, visibleOrders, kanbanStage]);

 const kanbanShort: Record<string,string> = { 'Pending confirmation':'Pending', 'Confirmed':'Confirmed', 'In production':'In production', 'Ready':'Ready', 'Awaiting Collection':'Collect', 'In Transit':'In transit', 'Completed / Delivered':'Done' };
 const salesKanban = (() => {
   const activeList = visibleOrders.filter(o=>o.status===kanbanStage);
   const stageTotal = activeList.reduce((sum,o)=>sum+(o.amount||0),0);
   const nextWithOrders = SALES_STAGES.find(st=>st!==kanbanStage && visibleOrders.some(o=>o.status===st));
   const otherMatches = isMobile && search.trim() ? visibleOrders.filter(o=>o.status!==kanbanStage).length : 0;
   const otherStageWithMatch = otherMatches ? SALES_STAGES.find(st=>st!==kanbanStage && visibleOrders.some(o=>o.status===st)) : undefined;
   return (
   <div className="kanban-wrap">
     {isMobile && <div className="table-controls kanban-mobile-search"><label className="search-box"><Search size={16}/><input aria-label="Search orders" placeholder="Search orders, customers..." value={search} onChange={e=>setSearch(e.target.value)}/></label></div>}
     {isMobile && <StageTabs stages={SALES_STAGES.map(s => ({ id: s, label: s, shortLabel: kanbanShort[s] || s, count: visibleOrders.filter(o=>o.status===s).length }))} active={kanbanStage} onChange={setKanbanStage} />}
     {isMobile && <div className="kanban-stage-summary"><span><strong>{kanbanShort[kanbanStage]||kanbanStage}</strong> · {activeList.length} {activeList.length===1?'order':'orders'}</span><strong>{money(stageTotal)}</strong></div>}
     {isMobile && otherMatches > 0 && <div className="kanban-other-matches"><span>{otherMatches} {otherMatches===1?'match':'matches'} in other stages</span>{otherStageWithMatch && <button type="button" className="kanban-jump-link" onClick={()=>setKanbanStage(otherStageWithMatch)}>View {kanbanShort[otherStageWithMatch]||otherStageWithMatch}</button>}</div>}
     <div className="kanban-board">
       {SALES_STAGES.map(status=>{const list=visibleOrders.filter(o=>o.status===status);return <div key={status} data-stage={status} className={(!isMobile || kanbanStage===status)?'is-active':''}>
         <h3 className="board-col-title">{status} <span className="inline-count">{list.length}</span></h3>
         {list.length===0 && <div className="board-empty-state"><p>{search.trim() ? `No matches in ${status}` : `No orders in ${status}`}</p>{isMobile && nextWithOrders && <Button variant="outline" size="sm" onClick={()=>setKanbanStage(nextWithOrders)}>Go to {kanbanShort[nextWithOrders]||nextWithOrders}</Button>}</div>}
         {list.map((o,i)=><div key={o.id} className={`order-card order-row-tint tone-${tone(o.status)}`} role="button" tabIndex={0} onClick={() => setSelected(o)} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(o);}}}>
           <OrderMobileCard order={o} index={i} showStatusBadge={false} />
         </div>)}
       </div>;})}
     </div>
   </div>
 ); })();

 return <div className={`workspace ${collapsed?'sidebar-collapsed':''}`}>
  {isMobile ? (
    <Sheet open={navOpen} onOpenChange={setNavOpen}>
      <SheetContent side='left' className='p-0 max-md:w-[min(86vw,320px)] max-md:[&>button]:h-11 max-md:[&>button]:w-11 max-md:[&>button]:grid max-md:[&>button]:place-items-center' data-nav-drawer>
        <SheetTitle className='sr-only'>Main navigation</SheetTitle>
        <Sidebar {...sidebarProps} variant='drawer' onNavigate={() => setNavOpen(false)} />
      </SheetContent>
    </Sheet>
  ) : (
    <Sidebar {...sidebarProps} />
  )}
  <div className="main-shell">
   <Topbar collapsed={collapsed} setCollapsed={setCollapsed} module={module} config={config} search={search} setSearch={setSearch} connected={connected} user={user} setLoginOpen={setLoginOpen} notification={notification} setNotification={setNotification} setNotice={setNotice} theme={theme} setTheme={setTheme} followUps={followUps} onMenu={() => setNavOpen(true)} menuOpen={navOpen} isMobile={isMobile}/>
   <main className="content">
    <div className="page-heading"><div><div className="eyebrow">{module==='dashboard'?'YOUR BAKERY AT A GLANCE':'TWIN CAKERY BAKERY'}</div><h1>{module==='dashboard'?(()=>{const h=new Date().getHours();const g=h<12?'Good morning':h<18?'Good afternoon':'Good evening';return `${g}, ${user?.displayName || user?.username || 'Alex'}`;})():config?.label}<span className="heading-dot">.</span></h1><p>{module==='dashboard'?'Here’s what’s happening at Twin Cakery Bakery today.':subtitles[module]}</p></div><div className="heading-actions"><Button variant="outline" onClick={exportData}><Download/>Export</Button>{module !== 'inventory' && <Button onClick={()=>setNewOrder(true)}><Plus/>New order</Button>}</div></div>
    {module==='dashboard'?<>
     <DashboardView period={period} setPeriod={setPeriod} orders={orders} filtered={filtered} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onSelect={setSelected} onHelp={()=>setHelp(true)} audit={audit}/>
    </>:<>
     <div className="module-tabs">{config?.tabs.map(t=><Button key={t} variant="ghost" className={activeTab===t?'active':''} onClick={()=>{setTab(t);setSearch('');setStatusFilter('All statuses')}}>{t}</Button>)}</div>
     {showOrders && module==='sales' && activeTab==='Orders' ? <section className="panel module-table"><div className="panel-heading"><div><h2>All orders <span className="inline-count">{visibleOrders.length}</span></h2><span className="text-muted-foreground text-xs">Order, payment & delivery tracked separately</span></div><div className={`flex items-center gap-2 ${isMobile ? 'seg-fill w-full' : ''}`}><Button variant={salesLayout==='table'?'default':'outline'} size="sm" onClick={()=>setSalesLayout('table')}>Table</Button><Button variant={salesLayout==='kanban'?'default':'outline'} size="sm" onClick={()=>setSalesLayout('kanban')}>Kanban</Button></div></div>{salesLayout==='table'?<><div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label="Search orders" placeholder="Search orders, customers..." value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="filter-select"><SlidersHorizontal size={14}/><select aria-label="Filter orders by status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{statusOptions.map(s=><option key={s}>{s}</option>)}</select></label></div><OrderTable orders={visibleOrders} onSelect={setSelected}/><div className="table-foot"><span>{visibleOrders.length} orders</span><span>{new Date().toLocaleString("en", { month: "long", year: "numeric" })}</span></div></>:salesKanban}</section>:showOrders?<section className="panel module-table"><div className="panel-heading"><h2>{showHistory?'Order history':'All orders'} <span className="inline-count">{visibleOrders.length}</span></h2><span className="text-muted-foreground text-xs">{showHistory?'Completed & cancelled orders, kept for history & analytics':'Order, payment & delivery tracked separately'}</span></div><div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label="Search orders" placeholder="Search orders, customers..." value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="filter-select"><SlidersHorizontal size={14}/><select aria-label="Filter orders by status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{statusOptions.map(s=><option key={s}>{s}</option>)}</select></label></div><OrderTable orders={visibleOrders} onSelect={setSelected}/><div className="table-foot"><span>{visibleOrders.length} orders</span><span>{new Date().toLocaleString("en", { month: "long", year: "numeric" })}</span></div></section>:module==='sales'&&activeTab==='Order proposals'?<OrderProposalsView onNotice={setNotice}/>:module==='webapp'?<WebAppManagement tab={activeTab} onNotice={setNotice} onSignIn={()=>setLoginOpen(true)}/>:module==='catalogue'?<Catalogue tab={activeTab} search={search} setSearch={setSearch} onNotice={setNotice} onSignIn={()=>setLoginOpen(true)}/>:module==='analytics'||(module==='sales'&&activeTab==='Sales analytics')?<AnalyticsView tab={activeTab} orders={orders}/>:module==='administration'?<Administration tab={activeTab} audit={audit} onNotice={setNotice} connected={connected}/>:module==='production'&&activeTab==='Schedule'?<ProductionView onSelect={setSelected}/>:module==='production'&&activeTab==='Jobs'?<JobsView onSelect={setSelected}/>:module==='production'&&activeTab==='Quality control'?<ModuleTable module={module} tab={activeTab} orders={orders} search={search} setSearch={setSearch} onSelect={setSelected} onNotice={setNotice} connected={connected} followUps={followUps} onCompleteFollowUp={completeFollowUp}/>:module==='production'&&activeTab==='Production costs'?<ModuleTable module={module} tab={activeTab} orders={orders} search={search} setSearch={setSearch} onSelect={setSelected} onNotice={setNotice} connected={connected} followUps={followUps} onCompleteFollowUp={completeFollowUp}/>:module==='production'?<ProductionView onSelect={setSelected}/>:module==='inventory'?<Inventory tab={activeTab} search={search} setSearch={setSearch} onNotice={setNotice} onSignIn={()=>setLoginOpen(true)}/>:module==='purchasing'?<Purchasing tab={activeTab} search={search} setSearch={setSearch} onNotice={setNotice} onSignIn={()=>setLoginOpen(true)}/>:module==='finance'?<FinanceView tab={activeTab} onNotice={setNotice}/>:module==='staff'?<Staff tab={activeTab} search={search} setSearch={setSearch} onNotice={setNotice} onSignIn={()=>setLoginOpen(true)}/>:<ModuleTable module={module} tab={activeTab} orders={orders} search={search} setSearch={setSearch} onSelect={setSelected} onNotice={setNotice} connected={connected} followUps={followUps} onCompleteFollowUp={completeFollowUp}/>}</>}
    <footer className="page-footer"><span>© 2026 Twin Cakery Bakery</span><span>Made with care. Managed with clarity.<span className="presence-dot"/></span></footer>
   </main>
  </div>
  <NewOrderDialog open={newOrder} onOpenChange={setNewOrder} onCreated={o=>{setSelected(o);setNotice(`${o.id} created successfully`)}}/>
  <OrderDialog order={selected} onClose={()=>setSelected(null)} onNotice={setNotice}/>
  <SignInDialog open={loginOpen} onOpenChange={setLoginOpen}/>
  <Dialog open={help} onOpenChange={setHelp}><DialogContent><DialogTitle>Twin Cakery Bakery</DialogTitle><DialogDescription>{connected?'Live workspace · connected to your ERP':'Interface preview · live ERP'}</DialogDescription><p className="text-sm text-muted-foreground">{connected?'You are connected to the live Twin Cakery ERP. Orders, status changes, and the audit log are saved to your database.':'Sign in to connect to the live ERP. Until then the workspace stays empty; new orders and status changes require a signed-in session.'}</p><div className="space-y-3">{audit.slice(0,4).map((a,i)=><p className="audit-entry" key={i}><Check size={15}/>{a}</p>)}</div></DialogContent></Dialog>
  {notice&&<div className="toast" role="status"><Check size={16}/>{notice}<IconButton icon={X} label="Dismiss message" onClick={()=>setNotice('')}/></div>}
  <Toaster/>
 </div>;
}
