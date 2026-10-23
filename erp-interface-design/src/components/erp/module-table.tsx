import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleAlert, ChefHat, Clock3, Eye, EyeOff, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { money, moduleRows, tone, type GridRow, type Order } from "./data";
import { ORDER_STAGE_PIPELINE, orderStageIndex } from "@/lib/theme-tokens";
import { StatusBadge as Status } from "../data-table/StatusBadge";
import { DataTable, type Column, type SortState } from "../data-table/DataTable";
import { useDensity } from "@/lib/density";
import { IconButton } from "./ui";
import cake from "@/assets/chocolate-cake.jpg";
import { CrmView } from "./crm-view";
import { useWorkspace } from "./store";
import {
  archiveProductApi, createProductApi, listCatalogueCategories, listCatalogueProducts, listCatalogueTypes, updateProductApi,
  type ServerCatalogueCategory, type ServerCatalogueProduct, type ServerCatalogueType,
  listProductionJobs, startProductionJob, completeProductionJob, recordQualityCheck, recordProductionWastage, getProductionCosts, getProductionConsumption,
  listInventoryItems, getInventoryLedger,
  listRbacUsers, listRbacRoles, listRbacPermissions, getRolePermissionKeys, grantRolePermission, revokeRolePermission,
  type ServerProductionJob, type ServerProductionCost, type ServerProductionConsumption, type ServerInventoryItem, type ServerInventoryTransaction,
  type ServerRbacUser, type ServerRole, type ServerPermission,
} from "@/lib/api";
export function orderRowTone(o: Order): string {
  return `order-row-tint tone-${tone(o.status)}`;
}

/**
 * Vertical progress rail on the left edge of every order row (order "card").
 * Graphical only — no stage words (the badge in the status column keeps the
 * word, erp_design.md C2): tick = stages already passed, filled dot = current
 * stage (tinted with that stage's hue, so it echoes the row tint), outline
 * ring = stages still ahead. Off-pipeline statuses (e.g. Cancelled) have no
 * progress position, so they render no rail.
 */
export function OrderProgressStepper({ status }: { status: string }) {
  const current = orderStageIndex(status);
  if (current < 0) return null;
  return (
    <ol
      className={`order-stepper tone-${tone(status)}`}
      aria-label={`Order progress: step ${current + 1} of ${ORDER_STAGE_PIPELINE.length}`}
    >
      {ORDER_STAGE_PIPELINE.map((stage, i) => (
        <li
          key={stage}
          className={i < current ? "step-done" : i === current ? "step-current" : "step-ahead"}
          aria-current={i === current ? "step" : undefined}
        >
          {i < current ? (
            <Check size={11} strokeWidth={3} aria-hidden="true" />
          ) : (
            <span className="step-node" aria-hidden="true" />
          )}
        </li>
      ))}
    </ol>
  );
}

export function OrderTable({orders,onSelect,compact=false}: {orders:Order[];onSelect:(o:Order)=>void;compact?:boolean}) {

  const [sort,setSort]=useState<SortState>(null);
  const { density } = useDensity();

  const sorted = !sort ? orders : [...orders].sort((a,b)=>{

    const d = a.amount-b.amount;

    return sort.dir==='asc' ? d : -d;

  });

  const columns: Column<Order>[] = [

    { header:'Progress', width:'28px', cell:(o)=><OrderProgressStepper status={o.status}/> },

    { header:'Order / customer', cell:(o,i)=><div className="customer-cell"><span className={`customer-avatar avatar-${i%4}`}>{o.initials}</span><div><strong>{o.customer}</strong><small>#{o.id}</small></div></div> },

    { header:'Product', cell:(o)=><><strong className="product-name">{o.product}</strong><small className="cell-sub">{o.options.split(' · ').slice(0,2).join(' · ')}</small></> },

  ];

  if(!compact) columns.push({ header:'Due date', cell:(o)=><><strong className="product-name">{o.date}</strong><small className="cell-sub">{o.time}</small></> });

  // Orders with any payment show the amount collected so far under the total.
  columns.push({ header:'Amount', align:'right', sortKey:'amount', cell:(o)=><span className="amount-cell">{money(o.amount)}{(o.paidAmount??0)>0&&<small className="paid-bracket" title="Amount paid so far">({money(o.paidAmount??0)} paid)</small>}</span> });

  columns.push({ header:'Order status', cell:(o)=><Status value={o.status}/> });

  if(!compact){ columns.push({ header:'Payment', cell:(o)=><Status value={o.payment}/> }); columns.push({ header:'Delivery', cell:(o)=><Status value={o.delivery}/> }); }

  columns.push({ header:'', cell:(o)=><Button variant="ghost" size="icon" title={`Open order ${o.id}`} aria-label={`Open order ${o.id}`} onClick={e=>{e.stopPropagation();onSelect(o)}}><MoreHorizontal/></Button> });

  return <DataTable columns={columns} rows={sorted} rowKey={(o)=>o.id} rowClassName={(o)=>orderRowTone(o)} sort={sort} onSortChange={setSort} onRowActivate={onSelect} stickyHeader density={density} empty={<div className="empty-state"><Search/><h3>No orders found</h3><p>Try a different customer, product, or status.</p></div>}/>;

}

export function ProductionSchedule({orders,onSelect}: {orders:Order[];onSelect:(o:Order)=>void}) {const [day,setDay]=useState(7);return <section className="panel schedule"><div className="panel-heading"><div><h2>Production schedule</h2><p>Wednesday, {day} October 2026</p></div><div className="flex items-center gap-2"><IconButton icon={ChevronLeft} label="Previous day" onClick={()=>setDay(Math.max(1,day-1))}/><Button variant="outline" onClick={()=>setDay(7)}>Today</Button><IconButton icon={ChevronRight} label="Next day" onClick={()=>setDay(Math.min(31,day+1))}/></div></div><div className="schedule-summary"><span><ChefHat size={16}/>8 jobs scheduled</span><span><Clock3 size={16}/>3 due today</span><span><CircleAlert size={16}/>1 stock shortage</span></div><div className="schedule-grid"><div className="schedule-times"><span>STATION</span>{['08:00','09:00','10:00','11:00','12:00','13:00','14:00'].map(t=><span key={t}>{t}</span>)}</div>{['Baking station','Decorating station','Quality & packing'].map((station,i)=><div className="station" key={station}><h3>{station}</h3>{orders.slice(i,i+3).map((o,j)=><Button variant="ghost" className={`schedule-job job-${(i+j)%3}`} key={o.id} onClick={()=>onSelect(o)}><span>#{o.id} · {o.time}</span><strong>{o.product}</strong><small>{o.customer}</small><Status value={i===2?'Pending':o.status}/></Button>)}</div>)}</div></section>}


/* ── Product catalogue (live; feeds the website's "Our Cakes" page) ────────── */
// Reads/writes the RBAC-guarded /catalogue routes. Anything created or made
// visible here shows up in GET /api/v1/public/catalogue, which the public
// website renders on its next sync (see sweet-moments-cakery catalogue-api.ts).

function productStatusLabel(p: ServerCatalogueProduct): string {
  if (p.archived) return "Archived";
  if (!p.active) return "Inactive";
  return p.catalogueVisible ? "Active" : "Hidden";
}

export function Catalogue({tab,search,setSearch,onNotice,onSignIn}: {tab:string;search:string;setSearch:(s:string)=>void;onNotice:(s:string)=>void;onSignIn:()=>void}) {
  const { connected } = useWorkspace();
  const [products,setProducts]=useState<ServerCatalogueProduct[]>([]);
  const [categories,setCategories]=useState<ServerCatalogueCategory[]>([]);
  const [types,setTypes]=useState<ServerCatalogueType[]>([]);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState<ServerCatalogueProduct|null>(null);
  const [creating,setCreating]=useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [p,c,t] = await Promise.all([listCatalogueProducts(),listCatalogueCategories(),listCatalogueTypes()]);
    setProducts(p); setCategories(c); setTypes(t);
    setLoading(false);
  },[]);
  useEffect(() => { void refresh(); }, [refresh]);

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Uncategorised";
  const q = search.toLowerCase();
  const filtered = products.filter((p) => `${p.name} ${p.sku} ${catName(p.categoryId)}`.toLowerCase().includes(q));

  async function toggleVisibility(p: ServerCatalogueProduct) {
    const next = !p.catalogueVisible;
    const updated = await updateProductApi(p.id, { catalogueVisible: next });
    if (updated) {
      onNotice(`“${p.name}” ${next ? "now shows on the website" : "hidden from the website"}`);
      void refresh();
    } else onNotice("Could not update visibility — check your connection");
  }
  async function archive(p: ServerCatalogueProduct) {
    const updated = await archiveProductApi(p.id);
    if (updated) { onNotice(`“${p.name}” archived — removed from the website`); void refresh(); }
    else onNotice("Could not archive the product");
  }

  return (<>
    <div className="catalogue-toolbar">
      <label className="search-box"><Search size={16}/><input aria-label="Search catalogue" value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${tab.toLowerCase()}...`}/></label>
      <span>{loading ? "Loading…" : tab === "Products" ? <><span className="inline-count">{filtered.length}</span> products</> : tab === "Categories" ? <><span className="inline-count">{categories.length}</span> categories</> : tab === "Product types" ? <><span className="inline-count">{types.length}</span> product types</> : "0 variants"}</span>
      {tab === "Products" && <Button size="sm" onClick={() => (connected ? setCreating(true) : onSignIn())} title={connected ? "Add a product to the website" : "Sign in to add products"}><Plus size={14}/> New product</Button>}
    </div>
    {!connected && <p className="text-muted-foreground text-xs webapp-note">Sign in to manage the live catalogue — products here appear on the website’s “Our Cakes” page.</p>}
    {tab === "Products" && (loading ? <p className="text-muted-foreground text-xs">Loading catalogue…</p> : filtered.length === 0 ? (
      <div className="empty-state"><Search/><h3>No products found</h3><p>{connected ? "Add your first product to publish it on the website." : "Sign in to see and manage products."}</p></div>
    ) : (
      <div className="product-grid">{filtered.map((p,i) => (
        <div className="product-card" key={p.id}>
          <div className={`product-image product-image-${i%3}`}>
            <img src={p.image && /^https?:\/\//i.test(p.image) ? p.image : cake} alt={p.name} width={1024} height={768} loading="lazy"/>
            <span className="product-tag">{productStatusLabel(p)}</span>
          </div>
          <div className="product-info">
            <small>{catName(p.categoryId)} · {p.sku}</small>
            <h3>{p.name}</h3>
            <div>
              <strong>{money(p.basePrice)}</strong>
              <span className="webapp-item-actions">
                <Button variant="ghost" size="icon" title="Edit product" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}><Pencil size={15}/></Button>
                <Button variant="ghost" size="icon" title={p.catalogueVisible ? "Hide from website" : "Show on website"} aria-label={p.catalogueVisible ? `Hide ${p.name} from website` : `Show ${p.name} on website`} onClick={() => void toggleVisibility(p)}>{p.catalogueVisible ? <EyeOff size={15}/> : <Eye size={15}/>}</Button>
                {!p.archived && <Button variant="ghost" size="icon" title="Archive product" aria-label={`Archive ${p.name}`} onClick={() => void archive(p)}><Trash2 size={15}/></Button>}
              </span>
            </div>
          </div>
        </div>
      ))}</div>
    ))}
    {tab === "Categories" && (loading ? <p className="text-muted-foreground text-xs">Loading categories…</p> : (
      <div className="webapp-list">{categories.map((c) => (
        <div className="webapp-item" key={c.id}>
          <div className="webapp-item-main">
            <strong>{c.name}</strong>
            <small>{c.code} · {products.filter((p) => p.categoryId === c.id).length} products</small>
          </div>
          <Status value={c.active && c.catalogueVisible ? "Active" : "Hidden"}/>
        </div>
      ))}</div>
    ))}
    {tab === "Product types" && (loading ? <p className="text-muted-foreground text-xs">Loading product types…</p> : (
      <div className="webapp-list">{types.map((t) => (
        <div className="webapp-item" key={t.id}>
          <div className="webapp-item-main">
            <strong>{t.name}</strong>
            <small>{catName(t.categoryId)} · {t.code}</small>
          </div>
          <Status value={t.active && t.catalogueVisible ? "Active" : "Hidden"}/>
        </div>
      ))}</div>
    ))}
    {tab === "Variants" && <div className="empty-state"><Check/><h3>Options &amp; variants</h3><p>Sizes, flavours and quantities are configured per product. Full variant management ships with the next catalogue release.</p></div>}
    <ProductDialog
      open={creating || editing !== null}
      product={editing}
      categories={categories}
      onOpenChange={(v) => { if (!v) { setCreating(false); setEditing(null); } }}
      onSaved={(msg) => { onNotice(msg); void refresh(); }}
    />
  </>);
}

export function ProductDialog({
  open, onOpenChange, product, categories, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: ServerCatalogueProduct | null;
  categories: ServerCatalogueCategory[];
  onSaved: (message: string) => void;
}) {
  const isEdit = product !== null;
  const [sku,setSku] = useState("");
  const [name,setName] = useState("");
  const [categoryId,setCategoryId] = useState("");
  const [price,setPrice] = useState("");
  const [description,setDescription] = useState("");
  const [image,setImage] = useState("");
  const [visible,setVisible] = useState(true);
  const [production,setProduction] = useState(true);
  const [busy,setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSku(product?.sku ?? "");
    setName(product?.name ?? "");
    setCategoryId(product?.categoryId ?? categories[0]?.id ?? "");
    setPrice(product ? String(product.basePrice) : "");
    setDescription(product?.description ?? "");
    setImage(product?.image ?? "");
    setVisible(product ? product.catalogueVisible : true);
    setProduction(product ? product.productionEnabled : true);
  }, [open, product, categories]);

  const parsedPrice = Number(price);
  const valid = name.trim() !== "" && categoryId !== "" && Number.isFinite(parsedPrice) && parsedPrice >= 0 && (isEdit || sku.trim() !== "");

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    if (isEdit) {
      const updated = await updateProductApi(product.id, {
        name: name.trim(), categoryId, description: description.trim(),
        basePrice: parsedPrice, image: image.trim(), catalogueVisible: visible, productionEnabled: production,
      });
      setBusy(false);
      if (updated) { onSaved(`“${updated.name}” updated — the website shows this on its next sync`); onOpenChange(false); }
      else onSaved("Could not save the product");
    } else {
      const created = await createProductApi({
        sku: sku.trim(), categoryId, name: name.trim(), description: description.trim(),
        basePrice: parsedPrice, image: image.trim(), catalogueVisible: visible, productionEnabled: production,
      });
      setBusy(false);
      if (created) { onSaved(`“${created.name}” created — it appears on the website once it finishes syncing`); onOpenChange(false); }
      else onSaved("Could not create the product (is the SKU already in use?)");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{isEdit ? `Edit ${product.name}` : "New product"}</DialogTitle>
        <DialogDescription>{isEdit ? "Update this product; the website reflects changes on its next sync." : "Create a product here; it appears on the website’s “Our Cakes” page once visible."}</DialogDescription>
        <div className="form-grid">
          <div className="form-field">
            <Label htmlFor="pc-sku">SKU</Label>
            <Input id="pc-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="TC-CB-007" disabled={isEdit}/>
          </div>
          <div className="form-field">
            <Label htmlFor="pc-cat">Category</Label>
            <select id="pc-cat" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-field span-2">
            <Label htmlFor="pc-name">Name</Label>
            <Input id="pc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Red velvet cake"/>
          </div>
          <div className="form-field">
            <Label htmlFor="pc-price">Price (UGX)</Label>
            <Input id="pc-price" type="number" min={0} step={100} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="4500"/>
          </div>
          <div className="form-field">
            <Label htmlFor="pc-image">Image URL</Label>
            <Input id="pc-image" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://… (optional)"/>
          </div>
          <div className="form-field span-2">
            <Label htmlFor="pc-desc">Description</Label>
            <Textarea id="pc-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shown on the website under the cake"/>
          </div>
          <label className="form-check span-2">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)}/>
            Show on the website’s “Our Cakes” page
          </label>
          <label className="form-check span-2">
            <input type="checkbox" checked={production} onChange={(e) => setProduction(e.target.checked)}/>
            Production enabled
          </label>
        </div>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !valid}>{isEdit ? "Save changes" : "Create product"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}



export function ModuleTable({module,tab,orders,search,setSearch,onSelect,onNotice,connected,followUps,onCompleteFollowUp}: {module:string;tab:string;orders:Order[];search:string;setSearch:(s:string)=>void;onSelect:(o:Order)=>void;onNotice:(s:string)=>void;connected:boolean;followUps?:{id:string;customer:string}[];onCompleteFollowUp?:((id:string)=>void)}) {
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

  if(module==='crm') return <CrmView tab={tab} contacts={contacts} search={search} setSearch={setSearch} connected={connected} followUps={followUps} onCompleteFollowUp={onCompleteFollowUp}/>;

  return <section className="panel module-table"><div className="panel-heading"><div><h2>{tab}</h2><p>{module==='inventory'?'Stock quantities reflect opening, purchases, adjustments, usage and wastage.':`${rows.length} ${tab.toLowerCase()} in your workspace`}</p></div><Button variant="outline" onClick={()=>onNotice('Sample workspace — live records are not connected')}><Plus/>{module==='purchasing'?'Create purchase order':module==='inventory'?'Record adjustment':'Add record'}</Button></div><div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label={`Search ${tab}`} value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${tab.toLowerCase()}...`}/></label><label className="filter-select"><SlidersHorizontal size={14}/><select aria-label="Filter records" value={filter} onChange={e=>setFilter(e.target.value)}><option>All records</option>{Array.from(new Set(moduleRows(module,tab,orders).map(r=>r.status))).map(s=><option key={s}>{s}</option>)}</select></label></div><DataTable columns={columns} rows={rows} rowKey={(r)=>r.id} rowClassName={(r)=>`order-row-tint tone-${tone(r.status)}`} onRowActivate={(r)=>setRecord(r)} stickyHeader density={density} empty={<div className="empty-state"><Search/><h3>No matching records</h3><p>Try a different search or filter.</p></div>}/><div className="table-foot"><span>{rows.length} records</span><span>October 2026</span></div><Dialog open={Boolean(record)} onOpenChange={v=>{if(!v)setRecord(null)}}><DialogContent><DialogTitle>{record?.name}</DialogTitle><DialogDescription>{record?.id} · {tab}</DialogDescription><div className="configuration-list"><p><span>Details</span><strong>{record?.detail}</strong></p><p><span>{headings[1]}</span><strong>{record?.secondary}</strong></p><p><span>{headings[2]}</span><strong>{record?.value}</strong></p>{record&&<p><span>Status</span><Status value={record.status}/></p>}</div>{module==='inventory'&&<><h3 className="text-sm font-semibold">Stock ledger</h3><div className="configuration-list"><p><span>Opening stock</span><strong>20 kg</strong></p><p><span>Purchase receipt</span><strong>+10 kg</strong></p><p><span>Production consumption</span><strong>−21 kg</strong></p><p><span>Recorded wastage</span><strong>−1 kg</strong></p></div><p className="text-xs text-muted-foreground">Illustrative transaction breakdown for all-purpose flour.</p></>}{module==='sales'&&<Button onClick={()=>{const o=orders.find(o=>o.customer===record?.name);if(o){setRecord(null);onSelect(o)}}}>Open related order<ArrowRight/></Button>}</DialogContent></Dialog></section>
}

export function Administration({tab,audit,onNotice,connected=false}: {tab:string;audit:string[];onNotice:(s:string)=>void;connected?:boolean}){
  const [name,setName]=useState('Twin Cakery Bakery');
  const [slogan,setSlogan]=useState('Taste the secret');
  // E5: live RBAC administration — Users / Roles / Permissions read the real
  // tables through /rbac/* (roles.manage / users.manage) instead of the old
  // hard-coded sample rows.
  const [users,setUsers]=useState<ServerRbacUser[]>([]);
  const [roles,setRoles]=useState<ServerRole[]>([]);
  const [perms,setPerms]=useState<ServerPermission[]>([]);
  const [selRole,setSelRole]=useState<string|null>(null);
  const [granted,setGranted]=useState<string[]>([]);
  useEffect(()=>{
    let alive=true;
    void (async()=>{
      if(tab==='Users'){ setUsers(await listRbacUsers()); }
      else if(tab==='Roles'||tab==='Permissions'){ const [r,p]=await Promise.all([listRbacRoles(),listRbacPermissions()]); if(!alive)return; setRoles(r); setPerms(p); }
    })();
    return ()=>{alive=false;};
  },[tab]);
  useEffect(()=>{
    if(!selRole){ setGranted([]); return; }
    let alive=true;
    void (async()=>{ const keys=await getRolePermissionKeys(selRole); if(alive) setGranted(keys); })();
    return ()=>{alive=false;};
  },[selRole]);
  const role=roles.find(r=>r.id===selRole)??null;
  const toggle=async(key:string,permId:string)=>{
    if(!selRole) return;
    const has=granted.includes(key);
    setGranted(prev=>has?prev.filter(k=>k!==key):[...prev,key]);
    const ok=has?await revokeRolePermission(selRole,permId):await grantRolePermission(selRole,permId);
    if(!ok){ setGranted(prev=>has?[...prev,key]:prev.filter(k=>k!==key)); onNotice('Permission change failed — check your permissions'); return; }
    onNotice(has?`${key} revoked${role?` from ${role.name}`:''}`:`${key} granted${role?` to ${role.name}`:''}`);
  };
  const permGroups=perms.reduce<Record<string,ServerPermission[]>>((acc,p)=>{const k=p.key.split('.')[0]||'other';(acc[k]=acc[k]||[]).push(p);return acc;},{});
  const empty=(what:string,perm:string)=><p className="cell-sub">No {what} to display — this view requires the {perm} permission.</p>;
  return <section className="panel settings-panel"><div className="panel-heading"><h2>{tab}</h2></div>
  {tab==='Business settings'?<form className="erp-form settings-form" onSubmit={e=>{e.preventDefault();onNotice(connected?'Settings saved':'Settings updated for this preview session')}}><label>Business name<input value={name} onChange={e=>setName(e.target.value)} required maxLength={100}/></label><label>Slogan<input value={slogan} onChange={e=>setSlogan(e.target.value)} maxLength={150}/></label><div className="form-row"><label>Currency<select><option>UGX — Ugandan shilling</option><option>USD — US dollar</option><option>TZS — Tanzanian shilling</option></select></label><label>Timezone<select><option>Africa/Kampala (UTC+3)</option><option>UTC</option></select></label></div><Button type="submit"><Check/>Save changes</Button></form>
  :tab==='Audit log'?<div className="audit-list">{audit.map((a,i)=><p className="audit-entry" key={i}><Check size={16}/><span>{a}<small>{connected?'Saved to the audit log':'Preview session'}</small></span></p>)}</div>
  :tab==='Users'?(users.length===0?empty('users','users.manage'):<div className="role-table">{users.map(u=><div key={u.id}><span className="customer-avatar avatar-0"><Users size={17}/></span><strong>{u.displayName||u.username}</strong><Status value={u.status||'Active'}/><span className="text-xs text-muted-foreground">{u.username} · {u.email} · {u.role}</span></div>)}</div>)
  :tab==='Roles'?(roles.length===0?empty('roles','roles.manage'):<div className="role-table">{roles.map(r=><div key={r.id} className={`role-row${selRole===r.id?' selected':''}`}><span className="customer-avatar avatar-0"><Users size={17}/></span><strong>{r.name}</strong><Status value={r.active?'Active':'Inactive'}/><span className="text-xs text-muted-foreground">{r.label}<Button variant="link" onClick={()=>{setSelRole(r.id);onNotice(`${r.name} selected — open the Permissions tab to edit its grants`);}}>{selRole===r.id?'Selected':'Manage permissions'}</Button></span></div>)}</div>)
  :(perms.length===0?empty('permissions','roles.manage'):!role?<p className="cell-sub">Select a role on the Roles tab to grant or revoke its permissions.</p>:<div><p className="cell-sub">Editing permissions for <strong>{role.name}</strong> — click a chip to toggle it.</p><div className="perm-groups">{Object.entries(permGroups).map(([g,list])=><div className="perm-group" key={g}><h4>{g}</h4><div className="perm-chips">{list.map(p=><button key={p.id} type="button" className={`perm-chip${granted.includes(p.key)?' granted':''}`} aria-pressed={granted.includes(p.key)} onClick={()=>{void toggle(p.key,p.id);}}>{p.key}</button>)}</div></div>)}</div></div>)}
  </section>;
}
