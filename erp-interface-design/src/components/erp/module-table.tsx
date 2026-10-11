import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleAlert, ChefHat, Clock3, MoreHorizontal, Plus, Search, SlidersHorizontal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { money, moduleRows, type GridRow, type Order } from "./data";
import { StatusBadge as Status } from "../data-table/StatusBadge";
import { DataTable, type Column, type SortState } from "../data-table/DataTable";
import { useDensity } from "@/lib/density";
import { IconButton } from "./ui";
import cake from "@/assets/chocolate-cake.jpg";
import { CrmView } from "./crm-view";
export function OrderTable({orders,onSelect,compact=false}: {orders:Order[];onSelect:(o:Order)=>void;compact?:boolean}) {

  const [sort,setSort]=useState<SortState>(null);
  const { density } = useDensity();

  const sorted = !sort ? orders : [...orders].sort((a,b)=>{

    const d = a.amount-b.amount;

    return sort.dir==='asc' ? d : -d;

  });

  const columns: Column<Order>[] = [

    { header:'Order / customer', cell:(o,i)=><div className="customer-cell"><span className={`customer-avatar avatar-${i%4}`}>{o.initials}</span><div><strong>{o.customer}</strong><small>#{o.id}</small></div></div> },

    { header:'Product', cell:(o)=><><strong className="product-name">{o.product}</strong><small className="cell-sub">{o.options.split(' · ').slice(0,2).join(' · ')}</small></> },

  ];

  if(!compact) columns.push({ header:'Due date', cell:(o)=><><strong className="product-name">{o.date}</strong><small className="cell-sub">{o.time}</small></> });

  columns.push({ header:'Amount', align:'right', sortKey:'amount', cell:(o)=><span className="amount-cell">{money(o.amount)}</span> });

  columns.push({ header:'Order status', cell:(o)=><Status value={o.status}/> });

  if(!compact){ columns.push({ header:'Payment', cell:(o)=><Status value={o.payment}/> }); columns.push({ header:'Delivery', cell:(o)=><Status value={o.delivery}/> }); }

  columns.push({ header:'', cell:(o)=><Button variant="ghost" size="icon" title={`Open order ${o.id}`} aria-label={`Open order ${o.id}`} onClick={e=>{e.stopPropagation();onSelect(o)}}><MoreHorizontal/></Button> });

  return <DataTable columns={columns} rows={sorted} rowKey={(o)=>o.id} sort={sort} onSortChange={setSort} onRowActivate={onSelect} stickyHeader density={density} empty={<div className="empty-state"><Search/><h3>No orders found</h3><p>Try a different customer, product, or status.</p></div>}/>;

}

export function ProductionSchedule({orders,onSelect}: {orders:Order[];onSelect:(o:Order)=>void}) {const [day,setDay]=useState(7);return <section className="panel schedule"><div className="panel-heading"><div><h2>Production schedule</h2><p>Wednesday, {day} October 2026</p></div><div className="flex items-center gap-2"><IconButton icon={ChevronLeft} label="Previous day" onClick={()=>setDay(Math.max(1,day-1))}/><Button variant="outline" onClick={()=>setDay(7)}>Today</Button><IconButton icon={ChevronRight} label="Next day" onClick={()=>setDay(Math.min(31,day+1))}/></div></div><div className="schedule-summary"><span><ChefHat size={16}/>8 jobs scheduled</span><span><Clock3 size={16}/>3 due today</span><span><CircleAlert size={16}/>1 stock shortage</span></div><div className="schedule-grid"><div className="schedule-times"><span>STATION</span>{['08:00','09:00','10:00','11:00','12:00','13:00','14:00'].map(t=><span key={t}>{t}</span>)}</div>{['Baking station','Decorating station','Quality & packing'].map((station,i)=><div className="station" key={station}><h3>{station}</h3>{orders.slice(i,i+3).map((o,j)=><Button variant="ghost" className={`schedule-job job-${(i+j)%3}`} key={o.id} onClick={()=>onSelect(o)}><span>#{o.id} · {o.time}</span><strong>{o.product}</strong><small>{o.customer}</small><Status value={i===2?'Pending':o.status}/></Button>)}</div>)}</div></section>}


export function Catalogue({tab,search,setSearch}: {tab:string;search:string;setSearch:(s:string)=>void}) {const [product,setProduct]=useState<string|null>(null);const products=[['Chocolate celebration cake','Celebration cakes',4500],['Red velvet cake','Signature cakes',3800],['Vanilla cupcakes','Cupcakes',2400],['Wedding cake','Wedding cakes',18000],['Carrot cake','Signature cakes',3200],['Chocolate cupcakes','Cupcakes',1800]] as const;return <><div className="catalogue-toolbar"><label className="search-box"><Search size={16}/><input aria-label="Search catalogue" value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${tab.toLowerCase()}...`}/></label><span>{products.length} {tab.toLowerCase()}</span></div><div className="product-grid">{products.filter(p=>p[0].toLowerCase().includes(search.toLowerCase())).map(([name,category,price],i)=><div className="product-card" key={name}><div className={`product-image product-image-${i%3}`}><img src={cake} alt="Sample chocolate cake product photography" width={1024} height={768} loading="lazy"/><span className="product-tag">{tab==='Products'?'Active':category}</span></div><div className="product-info"><small>{category} · SKU-00{i+1}</small><h3>{tab==='Categories'?category:tab==='Variants / options'?['Size: 1 kg / 2 kg','Flavour: Red velvet','Quantity: 12 / 24'][i%3]:name}</h3><div><strong>{money(price)}</strong><Button variant="ghost" size="icon" aria-label={`View ${name}`} onClick={()=>setProduct(name)}><ArrowUpRight/></Button></div></div></div>)}</div><Dialog open={Boolean(product)} onOpenChange={v=>{if(!v)setProduct(null)}}><DialogContent><DialogTitle>{product}</DialogTitle><DialogDescription>Product configuration</DialogDescription><div className="configuration-list"><p><span>Catalogue visibility</span><Status value="Active"/></p><p><span>Production enabled</span><Check size={16}/></p><p><span>Recipe version</span><strong>v1.2</strong></p><p><span>Available sizes</span><strong>1 kg · 1.5 kg · 2 kg</strong></p><p><span>Occasions</span><strong>Birthday · Anniversary</strong></p></div></DialogContent></Dialog></>}


export function ModuleTable({module,tab,orders,search,setSearch,onSelect,onNotice,connected}: {module:string;tab:string;orders:Order[];search:string;setSearch:(s:string)=>void;onSelect:(o:Order)=>void;onNotice:(s:string)=>void;connected:boolean}) {
  // Allowed exception (erp-design-system.md §5): CRM renders contact list + conversation,
  // not a table. Data still comes from the same moduleRows() source.
  const contacts=moduleRows('crm',tab,orders).filter(c=>`${c.id} ${c.name} ${c.detail}`.toLowerCase().includes(search.toLowerCase()));
  const [filter,setFilter] = useState('All records');

  const [record,setRecord] = useState<GridRow|null>(null);
  const { density } = useDensity();

  const rows = moduleRows(module,tab,orders).filter(r=>`${r.id} ${r.name} ${r.detail}`.toLowerCase().includes(search.toLowerCase())&&(filter==='All records'||r.status===filter));

  const labels:Record<string,string[]> = {crm:['Customer / reference','Last activity','Total spend'],inventory:['Ingredient / SKU','Reorder level','On hand'],purchasing:['Supplier / reference','Expected date','Total amount'],production:['Product / job','Due time','Stage'],delivery:['Customer / order','Due time','Destination'],finance:['Customer / reference','Date','Amount'],sales:['Customer / quote','Due date','Total amount']};

  const headings = labels[module]||['Record','Date','Value'];

  const columns: Column<GridRow>[] = [

    { header: headings[0] ?? 'Record', cell: (r)=><><strong className="product-name">{r.name}</strong><small className="cell-sub">{r.id} · {r.detail}</small></> },

    { header: headings[1] ?? 'Date', cell: (r)=>r.secondary },

    { header: headings[2] ?? 'Value', align: 'right', cell: (r)=><span className="amount-cell">{r.value}</span> },

    { header: 'Status', cell: (r)=><Status value={r.status}/> },

    { header: '', cell: (r)=><Button variant="ghost" size="icon" aria-label={`View ${r.id}`} onClick={e=>{e.stopPropagation();setRecord(r)}}><ArrowUpRight/></Button> },

  ];

  if(module==='crm') return <CrmView tab={tab} contacts={contacts} search={search} setSearch={setSearch} connected={connected}/>;

  return <section className="panel module-table"><div className="panel-heading"><div><h2>{tab}</h2><p>{module==='inventory'?'Stock quantities reflect opening, purchases, adjustments, usage and wastage.':`${rows.length} ${tab.toLowerCase()} in your workspace`}</p></div><Button variant="outline" onClick={()=>onNotice('Sample workspace — live records are not connected')}><Plus/>{module==='purchasing'?'Create purchase order':module==='inventory'?'Record adjustment':'Add record'}</Button></div><div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label={`Search ${tab}`} value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${tab.toLowerCase()}...`}/></label><label className="filter-select"><SlidersHorizontal size={14}/><select aria-label="Filter records" value={filter} onChange={e=>setFilter(e.target.value)}><option>All records</option>{Array.from(new Set(moduleRows(module,tab,orders).map(r=>r.status))).map(s=><option key={s}>{s}</option>)}</select></label></div><DataTable columns={columns} rows={rows} rowKey={(r)=>r.id} onRowActivate={(r)=>setRecord(r)} stickyHeader density={density} empty={<div className="empty-state"><Search/><h3>No matching records</h3><p>Try a different search or filter.</p></div>}/><div className="table-foot"><span>{rows.length} records</span><span>October 2026</span></div><Dialog open={Boolean(record)} onOpenChange={v=>{if(!v)setRecord(null)}}><DialogContent><DialogTitle>{record?.name}</DialogTitle><DialogDescription>{record?.id} · {tab}</DialogDescription><div className="configuration-list"><p><span>Details</span><strong>{record?.detail}</strong></p><p><span>{headings[1]}</span><strong>{record?.secondary}</strong></p><p><span>{headings[2]}</span><strong>{record?.value}</strong></p>{record&&<p><span>Status</span><Status value={record.status}/></p>}</div>{module==='inventory'&&<><h3 className="text-sm font-semibold">Stock ledger</h3><div className="configuration-list"><p><span>Opening stock</span><strong>20 kg</strong></p><p><span>Purchase receipt</span><strong>+10 kg</strong></p><p><span>Production consumption</span><strong>−21 kg</strong></p><p><span>Recorded wastage</span><strong>−1 kg</strong></p></div><p className="text-xs text-muted-foreground">Illustrative transaction breakdown for all-purpose flour.</p></>}{module==='sales'&&<Button onClick={()=>{const o=orders.find(o=>o.customer===record?.name);if(o){setRecord(null);onSelect(o)}}}>Open related order<ArrowRight/></Button>}</DialogContent></Dialog></section>
}

export function Administration({tab,audit,onNotice}: {tab:string;audit:string[];onNotice:(s:string)=>void}){const [name,setName]=useState('Twin Cakery Bakery');const [slogan,setSlogan]=useState('Taste the Cakes');return <section className="panel settings-panel"><div className="panel-heading"><h2>{tab}</h2></div>{tab==='Business settings'?<form className="erp-form settings-form" onSubmit={e=>{e.preventDefault();onNotice('Settings updated for this preview session')}}><label>Business name<input value={name} onChange={e=>setName(e.target.value)} required maxLength={100}/></label><label>Slogan<input value={slogan} onChange={e=>setSlogan(e.target.value)} maxLength={150}/></label><div className="form-row"><label>Currency<select><option>UGX — Ugandan shilling</option><option>USD — US dollar</option><option>TZS — Tanzanian shilling</option></select></label><label>Timezone<select><option>Africa/Kampala (UTC+3)</option><option>UTC</option></select></label></div><Button type="submit"><Check/>Save changes</Button></form>:tab==='Audit log'?<div className="audit-list">{audit.map((a,i)=><p className="audit-entry" key={i}><Check size={16}/><span>{a}<small>07 Oct 2026 · Preview session</small></span></p>)}</div>:<div className="role-table">{(tab==='Users'?['Alex Morgan · Proprietor','Susan Wanjiru · Production','Daniel Otieno · Sales','Emily Njeri · CSR']:tab==='Roles'?['Admin / Proprietor','Production Manager','Sales Manager','Customer Service Representative']:['orders.view','orders.create','orders.confirm','production.manage','inventory.adjust','finance.view']).map((r,i)=><div key={r}><span className="customer-avatar avatar-0"><Users size={17}/></span><strong>{r}</strong><Status value="Active"/><span className="text-xs text-muted-foreground">{i===0?'All permissions':'Assigned permissions'}</span></div>)}</div>}</section>}
