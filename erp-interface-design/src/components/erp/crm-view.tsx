import { useEffect, useMemo, useState } from "react";
import { useLiveRefresh } from "@/lib/live";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CalendarDays, Search, Printer, Mail, Phone, Plus, ArrowUpRight, Edit, Clock3, CalendarPlus, Trash2, Check, Loader2 } from "lucide-react";
import { StatusBadge as Status } from "@/components/data-table/StatusBadge";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { useDensity } from "@/lib/density";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildCustomerRows, formatOccasionDate, formatPhoneDisplay, groupOccasions, initialOccasions, money, type CustomerRow, type Occasion, type OccasionPeriod, type Order } from "./data";
import { createCustomerEvent, deleteCustomerEvent, listCustomerEvents, listCustomerFeedback, listCustomerOrders, listCustomers, orderStatusLabel, printCustomerOrders, type ServerCustomer, type ServerCustomerEvent, type ServerCustomerFeedback, type ServerCustomerOrder } from "@/lib/api";
import { useAsync, Empty, StarRating, feedbackTypeLabel } from "./crm-panels";

type SortKey = "recent" | "name_asc" | "name_desc" | "spent" | "orders" | "balance" | "first";
type DetailTab = "Overview" | "Orders" | "Occasions" | "Feedback";

function sortRows(rows: CustomerRow[], sort: SortKey): CustomerRow[] {
  const r = rows.slice();
  const byDate = (v?: string) => (v ? Date.parse(v) || 0 : 0);
  if (sort === "recent") r.sort((a,b)=> byDate(b.lastOrderAt)-byDate(a.lastOrderAt) || a.name.localeCompare(b.name));
  else if (sort === "name_asc") r.sort((a,b)=> a.name.localeCompare(b.name));
  else if (sort === "name_desc") r.sort((a,b)=> b.name.localeCompare(a.name));
  else if (sort === "spent") r.sort((a,b)=> b.totalSpend-a.totalSpend || a.name.localeCompare(b.name));
  else if (sort === "orders") r.sort((a,b)=> b.orderCount-a.orderCount || a.name.localeCompare(b.name));
  else if (sort === "balance") r.sort((a,b)=> b.balanceDue-a.balanceDue || a.name.localeCompare(b.name));
  else if (sort === "first") r.sort((a,b)=> byDate(a.firstOrderAt)-byDate(b.firstOrderAt) || a.name.localeCompare(b.name));
  // Walk-in customers are pinned at the end of the list.
  r.sort((a,b)=> Number(!!a.isWalkIn) - Number(!!b.isWalkIn));
  return r;
}

function initials(name: string) { return name.split(" ").map(s=>s[0]).join("").slice(0,2).toUpperCase() || "C"; }

function useCustomerLive(row: CustomerRow | null, connected: boolean) {
  const ids = row?.customerIds?.length ? row.customerIds : (row && !row.isWalkIn && row.id && row.id !== row.phone ? [row.id] : []);
  const key = ids.join(",");
  const { data: orders } = useAsync<ServerCustomerOrder[]>(async () => {
    if (!connected || ids.length===0) return [];
    const lists = await Promise.all(ids.map(id=>listCustomerOrders(id).catch(()=>[] as ServerCustomerOrder[])));
    return lists.flat();
  }, [key, connected]);
  const { data: events, reload: reloadEvents } = useAsync<ServerCustomerEvent[]>(async () => {
    if (!connected || ids.length===0) return [];
    const lists = await Promise.all(ids.map(id=>listCustomerEvents(id).catch(()=>[] as ServerCustomerEvent[])));
    return lists.flat();
  }, [key, connected]);
  const { data: feedback } = useAsync<ServerCustomerFeedback[]>(async () => {
    if (!connected || ids.length===0) return [];
    const lists = await Promise.all(ids.map(id=>listCustomerFeedback(id).catch(()=>[] as ServerCustomerFeedback[])));
    return lists.flat();
  }, [key, connected]);
  const { data: customers } = useAsync<ServerCustomer[]>(async () => connected ? listCustomers().catch(()=>[]) : [], [connected]);
  const primary = customers?.find(c=>ids.includes(c.id)) || null;
  return { orders: orders ?? [], events: events ?? [], feedback: feedback ?? [], primary, reloadEvents, ids };
}

function ProfileHeader({ row, primary, onPrint }: { row: CustomerRow; primary: ServerCustomer | null; onPrint: ()=>void }) {
  const phone = primary?.phone ? formatPhoneDisplay(primary.phone) : row.phoneDisplay;
  const email = primary?.email || "";
  return (
    <div className="crm-detail-head">
      <div className="crm-profile-main">
        <span className="customer-avatar avatar-0 crm-profile-avatar">{initials(row.name)}</span>
        <div className="crm-profile-info">
          <h3>{row.name}</h3>
          <p className="text-muted-foreground text-sm">{row.id}{phone ? ` · ${phone}` : ""}{email ? ` · ${email}` : ""}</p>
        </div>
      </div>
      <div className="crm-profile-actions">
        <Status value={row.status} />
        {!row.isWalkIn && <Button variant="outline" size="sm" disabled title="Edit customer (coming soon)"><Edit size={14} /> Edit</Button>}
        <Button variant="ghost" size="icon" onClick={onPrint} title="Print"><Printer size={16} /></Button>
      </div>
    </div>
  );
}

function KpiStrip({ row }: { row: CustomerRow }) {
  return (
    <div className="crm-kpi-strip">
      <div className="crm-kpi"><span>{row.orderCount}</span><small>orders</small></div>
      <div className="crm-kpi"><span>{money(row.totalSpend)}</span><small>spent</small></div>
      <div className="crm-kpi"><span>{row.orderCount ? money(Math.round(row.totalSpend / row.orderCount)) : "—"}</span><small>avg order</small></div>
      <div className="crm-kpi"><span>{row.lastOrderAt || "—"}</span><small>last order</small></div>
    </div>
  );
}

function OrdersTab({ row, liveOrders, connected, onOpenOrder }: { row: CustomerRow; liveOrders: ServerCustomerOrder[]; connected: boolean; onOpenOrder: (id: string)=>void }) {
  const { density } = useDensity();
  const local = row.orders.slice().sort((a,b)=> (b.date||"").localeCompare(a.date||"") || b.id.localeCompare(a.id));
  type R = { id: string; label: string; date: string; amount: number; status: string };
  const rows: R[] = connected && liveOrders.length>0
    ? liveOrders.slice().sort((a,b)=> String(b.requiredAt||b.date||"").localeCompare(String(a.requiredAt||a.date||""))).map(o=>({ id: o.orderNumber || o.id, label: o.orderNumber || o.id, date: String(o.requiredAt||o.date||"").slice(0,10), amount: o.total, status: orderStatusLabel(o.status) }))
    : local.map(o=>({ id: o.id, label: o.id, date: o.date, amount: o.amount, status: o.status }));
  const cols: Column<R>[] = [
    { header: "Order", mobile:"title", cell: r=> <strong className="product-name">{r.label}</strong> },
    { header: "Date", mobile:"meta", cell: r=> <small className="text-muted-foreground">{r.date||"—"}</small> },
    { header: "Amount", align:"right", mobile:"value", cell: r=> <span className="amount-cell">{money(r.amount)}</span> },
    { header: "Status", mobile:"badge", cell: r=> <Status value={r.status}/> },
    { header:"", mobile:"hide", cell: r=> <Button variant="ghost" size="icon" title="Open in Sales" onClick={(e)=>{e.stopPropagation(); onOpenOrder(r.id);}}><ArrowUpRight size={14}/></Button> },
  ];
  if(rows.length===0) return <Empty icon={<Clock3/>} title="No orders yet" body="This customer hasn't placed any orders yet." />;
  return <div className="crm-orders"><DataTable columns={cols} rows={rows} rowKey={r=>r.id} stickyHeader density={density} onRowActivate={(r)=>onOpenOrder(r.id)} mobileTitle={r=>r.label} mobileSubtitle={r=>r.date} openLabel="Open in Sales" empty={<Empty icon={<Clock3/>} title="No orders yet" body="No orders."/>} /><div className="table-foot"><span>{rows.length} orders</span><span>{money(rows.reduce((s,r)=>s+r.amount,0))} total</span></div></div>;
}

function OccasionsTab({ row, events, reload, connected, ids }: { row: CustomerRow; events: ServerCustomerEvent[]; reload: ()=>void; connected: boolean; ids: string[] }) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const primaryId = ids[0];
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(!primaryId || !connected) return;
    const form = new FormData(e.currentTarget);
    const eventType = String(form.get("eventType")||"").trim();
    if(!eventType) return;
    setBusy(true);
    void createCustomerEvent(primaryId, { eventType, eventDate: String(form.get("eventDate")||"") || new Date().toISOString().slice(0,10), recurrenceRule: String(form.get("recurrenceRule")||"NONE"), notes: String(form.get("notes")||"") }).then(()=>{ setBusy(false); setAdding(false); reload(); });
  };
  const remove = (id: string) => { if(!primaryId) return; void deleteCustomerEvent(primaryId, id).then(()=>reload()); };
  return (
    <div className="crm-occasions">
      <div className="crm-panel-head"><h3>Occasions <span className="inline-count">{events.length}</span></h3>{connected && !row.isWalkIn && primaryId && !adding && <Button variant="outline" size="sm" onClick={()=>setAdding(true)}><Plus size={14}/> Add occasion</Button>}</div>
      {adding && <form className="erp-form crm-event-form" onSubmit={submit}><label>Occasion<input name="eventType" placeholder="e.g. Birthday, Anniversary" required maxLength={80}/></label><div className="form-row"><label>Date<input name="eventDate" type="date"/></label><label>Repeats<select name="recurrenceRule" defaultValue="NONE"><option value="NONE">Does not repeat</option><option value="ANNUAL">Annual</option><option value="MONTHLY">Monthly</option><option value="WEEKLY">Weekly</option></select></label></div><label>Notes<input name="notes" maxLength={250} placeholder="Optional"/></label><div className="flex gap-2"><Button type="submit" disabled={busy}>{busy?<Loader2 className="animate-spin" size={14}/>:<Check size={14}/>} Save</Button><Button type="button" variant="ghost" onClick={()=>setAdding(false)}>Cancel</Button></div></form>}
      {events.length===0 && !adding ? <Empty icon={<CalendarPlus/>} title="No occasions yet" body={connected && !row.isWalkIn ? "Add a birthday or anniversary to schedule reminders." : "No occasions recorded."}/> : (
        <ul className="configuration-list crm-event-list">{events.map(ev=> <li key={ev.id}><div><strong>{ev.eventType}</strong><small className="cell-sub">{ev.eventDate? String(ev.eventDate).slice(0,10):"—"}{ev.recurrenceRule && ev.recurrenceRule!=="NONE" ? ` · repeats ${String(ev.recurrenceRule).toLowerCase()}`:""}</small></div>{ev.notes && <small className="text-muted-foreground">{ev.notes}</small>}{connected && primaryId && <Button variant="ghost" size="icon" title="Delete" onClick={()=>remove(ev.id)}><Trash2 size={14}/></Button>}</li>)}</ul>
      )}
      <p className="crm-note text-muted-foreground text-xs">Reminders are scheduled automatically — the system never contacts the customer for you.</p>
    </div>
  );
}

function FeedbackTab({ feedback }: { feedback: ServerCustomerFeedback[] }) {
  if(feedback.length===0) return <Empty icon={<Clock3/>} title="No feedback yet" body="Feedback recorded for this customer's orders will appear here."/>;
  return <ul className="configuration-list crm-feedback-list">{feedback.map(f=> <li key={f.id} className="crm-feedback-card"><div className="crm-feedback-header"><StarRating rating={f.rating} readonly /><small className="text-muted-foreground">{feedbackTypeLabel(f.type)}</small><small className="text-muted-foreground">{new Date(f.createdAt).toLocaleDateString()}</small></div>{f.comment && <p className="crm-feedback-comment">{f.comment}</p>}{f.resolution && <p className="crm-feedback-resolution"><small className="text-muted-foreground">Resolution:</small> {f.resolution}</p>}</li>)}</ul>;
}

function OverviewTab({ row, primary, liveOrders, events, feedback, onSwitch }: { row: CustomerRow; primary: ServerCustomer | null; liveOrders: ServerCustomerOrder[]; events: ServerCustomerEvent[]; feedback: ServerCustomerFeedback[]; onSwitch: (t: DetailTab)=>void }) {
  const recent = (liveOrders.length? liveOrders.slice().sort((a,b)=> String(b.requiredAt||"").localeCompare(String(a.requiredAt||""))) : row.orders.slice().sort((a,b)=> (b.date||"").localeCompare(a.date||""))).slice(0,5);
  return (
    <div className="crm-overview">
      <div className="crm-section"><h4 className="crm-section-title">Contact</h4><div className="crm-contact-grid"><div className="crm-contact-item"><Phone size={14}/> <span>{primary?.phone? formatPhoneDisplay(primary.phone) : row.phoneDisplay || "—"}</span></div><div className="crm-contact-item"><Mail size={14}/> <span>{primary?.email || "—"}</span></div></div></div>
      {recent.length>0 && <div className="crm-section"><div className="crm-panel-head"><h4 className="crm-section-title">Recent orders</h4><button type="button" className="link-btn" onClick={()=>onSwitch("Orders")}>View all</button></div><ul className="crm-activity-list">{recent.map((o:any)=> <li key={o.id}><strong>{o.orderNumber||o.id}</strong><small className="text-muted-foreground">{String(o.requiredAt||o.date||"").slice(0,10)||"—"}</small><span>{money(o.total ?? o.amount ?? 0)}</span></li>)}</ul></div>}
      {events.length>0 && <div className="crm-section"><div className="crm-panel-head"><h4 className="crm-section-title">Occasions</h4><button type="button" className="link-btn" onClick={()=>onSwitch("Occasions")}>View all</button></div><ul className="crm-activity-list">{events.slice(0,3).map(ev=> <li key={ev.id}><strong>{ev.eventType}</strong><small className="text-muted-foreground">{String(ev.eventDate||"").slice(0,10)||"—"}</small></li>)}</ul></div>}
      {feedback.length>0 && <div className="crm-section"><div className="crm-panel-head"><h4 className="crm-section-title">Latest feedback</h4><button type="button" className="link-btn" onClick={()=>onSwitch("Feedback")}>View all</button></div><ul className="crm-activity-list">{feedback.slice(0,2).map(f=> <li key={f.id}><strong>{feedbackTypeLabel(f.type)}</strong><small className="text-muted-foreground">{f.comment || "—"}</small></li>)}</ul></div>}
    </div>
  );
}

function CustomerDetail({ row, connected, onOpenOrder }: { row: CustomerRow; connected: boolean; onOpenOrder: (id:string)=>void }) {
  const [detailTab, setDetailTab] = useState<DetailTab>("Overview");
  useEffect(()=>{ setDetailTab("Overview"); }, [row.id]);
  const live = useCustomerLive(row, connected);
  const onPrint = () => {
    const id = live.ids[0];
    if(!id) return;
    void printCustomerOrders(id).then(p=>{ if(!p) return; const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([p.orders.map(o=>`${o.orderNumber} · ${String(o.date).slice(0,10)} · ${o.status} · ${money(o.total)}`).join("\n")],{type:"text/plain"})); a.download=`${row.name.replace(/\s+/g,"-").toLowerCase()}-orders.txt`; a.click(); URL.revokeObjectURL(a.href); });
  };
  return (
    <div className="crm-detail-inner">
      <div className="crm-profile-header sticky"><ProfileHeader row={row} primary={live.primary} onPrint={onPrint} /><KpiStrip row={row} /></div>
      <div className="crm-tabs" role="tablist">{(["Overview","Orders","Occasions","Feedback"] as DetailTab[]).map(t=> <button key={t} role="tab" aria-selected={detailTab===t} className={detailTab===t?"selected":""} onClick={()=>setDetailTab(t)}>{t}{t==="Orders"?` (${row.orderCount})`:t==="Occasions"?` (${live.events.length})`:t==="Feedback"?` (${live.feedback.length})`:""}</button>)}</div>
      <div className="crm-tab-content" role="tabpanel">
        {detailTab==="Overview" && <OverviewTab row={row} primary={live.primary} liveOrders={live.orders} events={live.events} feedback={live.feedback} onSwitch={setDetailTab} />}
        {detailTab==="Orders" && <OrdersTab row={row} liveOrders={live.orders} connected={connected} onOpenOrder={onOpenOrder} />}
        {detailTab==="Occasions" && <OccasionsTab row={row} events={live.events} reload={live.reloadEvents} connected={connected} ids={live.ids} />}
        {detailTab==="Feedback" && <FeedbackTab feedback={live.feedback} />}
      </div>
    </div>
  );
}

function OccasionsView({ connected }: { connected: boolean }) {
  const [period, setPeriod] = useState<OccasionPeriod>("Month");
  const [rangeFrom, setRangeFrom] = useState("2026-10-10");
  const [rangeTo, setRangeTo] = useState("2026-11-30");
  const [live, setLive] = useState<Occasion[] | null>(null);
  useEffect(() => {
    let stale = false;
    if (!connected) { setLive(null); return; }
    void (async () => {
      try {
        const customers = await listCustomers();
        const perCustomer = await Promise.all(customers.map((c) => listCustomerEvents(c.id)));
        if (stale) return;
        const flat: Occasion[] = [];
        customers.forEach((c, i) => { for (const ev of perCustomer[i] ?? []) { if (!ev.eventDate) continue; flat.push({ id: `${c.id}:${ev.id}`, customer: c.name, type: ev.eventType, date: String(ev.eventDate).slice(0,10), recurrence: ev.recurrenceRule ?? "NONE" }); } });
        setLive(flat);
      } catch { if (!stale) setLive([]); }
    })();
    return () => { stale = true; };
  }, [connected]);
  const occasions = connected && live ? live : initialOccasions;
  const groups = groupOccasions(occasions, period, period === "Custom" ? { from: rangeFrom, to: rangeTo } : undefined);
  return (
    <section className="panel crm-view occasions-panel">
      <div className="panel-heading"><div><h2>Occasions</h2><p>{occasions.length} occasions · {connected && live===null ? "loading…" : `grouped by ${period==="Custom"?"date range":period.toLowerCase()}`}</p></div></div>
      <div className="occasions-toolbar"><div className="segmented" role="group" aria-label="Group occasions by">{(["Month","Week","Custom"] as const).map(p=> <button key={p} type="button" aria-pressed={period===p} className={period===p?"selected":""} onClick={()=>setPeriod(p)}>{p}</button>)}</div>{period==="Custom" && <span className="date-range"><CalendarDays size={14}/><label>From<input type="date" value={rangeFrom} onChange={e=>setRangeFrom(e.target.value)}/></label><label>To<input type="date" value={rangeTo} onChange={e=>setRangeTo(e.target.value)}/></label></span>}</div>
      {groups.length===0 ? <div className="empty-state"><CalendarDays/><h3>No occasions in this period</h3><p>Switch the grouping or widen the date range.</p></div> : groups.map(g=> <div key={g.key} className="occasions-group"><h3>{g.label} <span className="inline-count">{g.items.length}</span></h3><ul className="configuration-list crm-event-list">{g.items.map(o=> <li key={o.id}><div><strong>{o.customer}</strong><small className="cell-sub">{o.type}{o.recurrence && o.recurrence!=="NONE" ? ` · repeats ${o.recurrence.toLowerCase()}` : ""}</small></div><small className="text-muted-foreground text-xs">{formatOccasionDate(o.date)}</small></li>)}</ul></div>)}
      <p className="crm-note text-muted-foreground text-xs">Reminders are scheduled automatically — the system never contacts the customer for you.</p>
    </section>
  );
}

export function CrmView({ tab, orders, search, setSearch, connected, onOpenOrder }: { tab: string; orders: Order[]; search: string; setSearch: (s: string)=>void; connected: boolean; onOpenOrder: (orderId: string)=>void; followUps?: {id:string;customer:string}[]; onCompleteFollowUp?: (id:string)=>void }) {
  const isMobile = useIsMobile();
  const [sort, setSort] = useState<SortKey>("recent");
  const [activeId, setActiveId] = useState<string|null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  useLiveRefresh(() => {});

  const rows = useMemo(()=> {
    const base = buildCustomerRows(orders);
    const q = search.trim().toLowerCase();
    const filtered = q ? base.filter(r => `${r.name} ${r.id} ${r.phone} ${r.phoneDisplay}`.toLowerCase().includes(q)) : base;
    return sortRows(filtered, sort);
  }, [orders, search, sort]);

  useEffect(()=>{ if(!isMobile) setMobileDetailOpen(false); }, [isMobile]);
  if (tab === "Occasions") return <OccasionsView connected={connected} />;

  const active = isMobile ? (rows.find(r=>r.id===activeId) ?? null) : (rows.find(r=>r.id===activeId) ?? rows[0] ?? null);
  const select = (id: string, openMobile=false) => { setActiveId(id); setMobileDetailOpen(openMobile && isMobile); };
  const closeMobile = () => { setMobileDetailOpen(false); setActiveId(null); };

  const list = (
    <ul className="crm-list">{rows.map(r=> {
      const sub = [r.phoneDisplay, `${r.orderCount} order${r.orderCount!==1?"s":""}`, money(r.totalSpend)].filter(Boolean).join(" · ");
      const sub2 = r.balanceDue>0 ? `${money(r.balanceDue)} due` : null;
      return <li key={r.id}><button type="button" className={active?.id===r.id?"selected":""} aria-current={active?.id===r.id?"true":undefined} onClick={()=>select(r.id,true)}><span className="customer-avatar avatar-0">{initials(r.name)}</span><span className="crm-contact-meta"><strong>{r.name}</strong><small>{sub}</small>{sub2 && <small className="text-muted-foreground">{sub2}</small>}</span><Status value={r.status}/></button></li>;
    })}</ul>
  );

  return (
    <section className="panel crm-view">
      <div className="panel-heading"><div><h2>{tab}</h2><p>{rows.length} customer{rows.length!==1?"s":""}</p></div></div>
      <div className="table-controls crm-list-controls">
        <label className="search-box"><Search size={16}/><input aria-label={`Search ${tab}`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customers by name, ID or phone…"/></label>
        <label className="crm-sort">Sort
          <select value={sort} onChange={e=>setSort(e.target.value as SortKey)} aria-label="Sort customers">
            <option value="recent">Most recent order</option>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="spent">Total spent</option>
            <option value="orders">Most orders</option>
            <option value="balance">Balance due</option>
            <option value="first">Customer since</option>
          </select>
        </label>
      </div>
      {rows.length===0 ? <div className="empty-state"><Search/><h3>No customers found</h3><p>Try a different search.</p></div> : (
        <div className="crm-body">
          {list}
          {!isMobile && active && <div className="crm-detail"><CustomerDetail row={active} connected={connected} onOpenOrder={onOpenOrder} /></div>}
        </div>
      )}
      {isMobile && active && (
        <Sheet open={mobileDetailOpen} onOpenChange={v=>{ if(!v) closeMobile(); }}>
          <SheetContent side="right" className="w-[min(100vw,720px)] max-w-none overflow-y-auto p-4 sm:max-w-lg crm-sheet">
            <SheetTitle className="sr-only">{active.name}</SheetTitle>
            <CustomerDetail row={active} connected={connected} onOpenOrder={onOpenOrder} />
          </SheetContent>
        </Sheet>
      )}
    </section>
  );
}
