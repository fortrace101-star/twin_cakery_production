import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Boxes, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "./data";
import { StatusBadge as Status } from "../data-table/StatusBadge";
import { DataTable, type Column } from "../data-table/DataTable";
import { useDensity } from "@/lib/density";
import { useWorkspace } from "./store";
import {
  adjustInventory, createInventoryItem, createPurchaseRequirement, getInventoryLedger, listInventoryAlerts, listInventoryItems, listPurchaseOrders, receivePurchaseOrder,
  type ServerInventoryAlert, type ServerInventoryItem, type ServerInventoryTransaction, type ServerPurchaseOrder,
} from "@/lib/api";

/* ── Inventory (live; E3) ──────────────────────────────────────────────── */
// Stock table fed by GET /inventory (availableStock = physical − reserved).
// Row activation opens the ledger dialog filtered client-side by itemId
// (the /inventory/ledger endpoint has no itemId filter). Includes a manual
// stock adjustment form (POST /inventory/adjustments, RBAC-guarded).

function txLabel(t: ServerInventoryTransaction): string {
  const map: Record<string, string> = {
    ADJUSTMENT_IN: "Adjustment in", ADJUSTMENT_OUT: "Adjustment out", WASTAGE: "Wastage",
    PRODUCTION_CONSUMPTION: "Production use", PURCHASE_RECEIPT: "Purchase receipt", RESERVATION: "Reservation",
  };
  return map[t.type] ?? t.type;
}

function stockStatus(item: ServerInventoryItem): string {
  const avail = item.availableStock ?? item.physicalStock;
  if (avail <= 0) return "Out of stock";
  if (avail <= item.reorderLevel) return "Low stock";
  return "In stock";
}
function LedgerDialog(props: {
  item: ServerInventoryItem; ledger: ServerInventoryTransaction[]; onClose: () => void;
  adjusting: ServerInventoryItem | null; setAdjusting: (i: ServerInventoryItem | null) => void;
  form: { quantity: string; type: string; notes: string }; setForm: (f: { quantity: string; type: string; notes: string }) => void;
  submitAdjustment: () => void; busy: boolean;
}) {
  const { item, ledger, onClose, adjusting, setAdjusting, form, setForm, submitAdjustment, busy } = props;
  const rows = ledger.filter(t => t.itemId === item.id);
  return <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
    <DialogContent className="order-detail-dialog">
      <DialogTitle>{item.name}</DialogTitle>
      <DialogDescription>{item.sku} · ledger ({rows.length} entries)</DialogDescription>
      <div className="configuration-list">
        <p><span>On hand</span><strong>{item.physicalStock} {item.unit}</strong></p>
        <p><span>Available</span><strong>{item.availableStock ?? item.physicalStock} {item.unit}</strong></p>
        <p><span>Reorder level</span><strong>{item.reorderLevel}</strong></p>
        <p><span>Status</span><Status value={stockStatus(item)} /></p>
      </div>
      <h3 className="text-sm font-semibold">Transactions</h3>
      {rows.length === 0 ? <p className="cell-sub">No transactions recorded yet.</p> :
        <div className="configuration-list">{rows.map(t => <p key={t.id}><span>{txLabel(t)} · {new Date(t.createdAt).toLocaleDateString()}</span><strong>{t.quantity > 0 ? "+" : ""}{t.quantity} {t.unit}</strong></p>)}</div>}
      <div className="dialog-actions">
        <Button variant="outline" onClick={() => setAdjusting(adjusting ? null : item)}>Adjust stock</Button>
      </div>
      {adjusting && <div className="erp-form">
        <h3 className="text-sm font-semibold">Stock adjustment — {adjusting.name}</h3>
        <div className="form-row"><Label htmlFor="adj-qty">Quantity (+ in / − out)</Label><Input id="adj-qty" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
        <div className="form-row"><Label htmlFor="adj-type">Type</Label>
          <select id="adj-type" className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="ADJUSTMENT_IN">Adjustment in</option>
            <option value="ADJUSTMENT_OUT">Adjustment out</option>
          </select>
        </div>
        <div className="form-row"><Label htmlFor="adj-notes">Notes</Label><Input id="adj-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Stock count correction" /></div>
        <div className="dialog-actions">
          <Button disabled={busy || !form.quantity} onClick={submitAdjustment}>Submit</Button>
          <Button variant="ghost" onClick={() => setAdjusting(null)}>Cancel</Button>
        </div>
      </div>}
    </DialogContent>
  </Dialog>;
}



export function Inventory({ tab, search, setSearch, onNotice, onSignIn }: { tab: string; search: string; setSearch: (s: string) => void; onNotice: (s: string) => void; onSignIn: () => void }) {
  const { connected } = useWorkspace();
  const { density } = useDensity();
  const [items, setItems] = useState<ServerInventoryItem[]>([]);
  const [ledger, setLedger] = useState<ServerInventoryTransaction[]>([]);
  const [alerts, setAlerts] = useState<ServerInventoryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ledgerFor, setLedgerFor] = useState<ServerInventoryItem | null>(null);
  const [adjusting, setAdjusting] = useState<ServerInventoryItem | null>(null);
  const [form, setForm] = useState({ quantity: "", type: "ADJUSTMENT_IN", notes: "" });
  const [creatingItem, setCreatingItem] = useState(false);
  const [itemForm, setItemForm] = useState({ name: "", sku: "", category: "", unit: "unit", physicalStock: "", reorderLevel: "", cost: "" });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [inv, txs, alertRows] = await Promise.all([listInventoryItems(), getInventoryLedger(), listInventoryAlerts()]);
    setItems(inv); setLedger(txs); setAlerts(alertRows); setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const q = search.toLowerCase();
  const filtered = items.filter(i => `${i.name} ${i.sku} ${i.category}`.toLowerCase().includes(q));
  const lowStockCount = useMemo(() => items.filter(i => stockStatus(i) !== "In stock").length, [items]);
  const isAlerts = tab === "Alerts";
  const filteredAlerts = useMemo(() => {
    const q = search.toLowerCase();
    return alerts.filter(a => `${a.name} ${a.sku} ${a.category}`.toLowerCase().includes(q));
  }, [alerts, search]);

  async function submitAdjustment() {
    if (!adjusting) return;
    if (!connected) { onSignIn(); return; }
    const qty = Number(form.quantity);
    if (!qty) { onNotice("Enter a non-zero quantity"); return; }
    // Server applies the raw signed quantity — outflow types must be negative.
    const signedQty = form.type === "ADJUSTMENT_OUT" ? -Math.abs(qty) : Math.abs(qty);
    setBusy(true);
    const tx = await adjustInventory({
      itemId: adjusting.id, quantity: signedQty, unit: adjusting.unit, type: form.type,
      reference: "Manual adjustment", notes: form.notes,
    });
    setBusy(false);
    if (!tx) { onNotice("Adjustment failed — check your permissions"); return; }
    onNotice(`Stock adjusted: ${signedQty > 0 ? "+" : ""}${signedQty} ${adjusting.unit}`);
    setAdjusting(null); setForm({ quantity: "", type: "ADJUSTMENT_IN", notes: "" });
    await refresh();
  }

  async function submitNewItem() {
    if (!connected) { onSignIn(); return; }
    if (!itemForm.name.trim()) { onNotice("Item name is required"); return; }
    setBusy(true);
    const created = await createInventoryItem({
      name: itemForm.name.trim(),
      sku: itemForm.sku.trim() || itemForm.name.trim().toLowerCase().replace(/\s+/g, "-"),
      category: itemForm.category.trim() || "General",
      unit: itemForm.unit || "unit",
      physicalStock: Number(itemForm.physicalStock) || 0,
      reorderLevel: Number(itemForm.reorderLevel) || 0,
      cost: Number(itemForm.cost) || 0,
    });
    setBusy(false);
    if (!created) { onNotice("Could not create item — check your permissions"); return; }
    onNotice(`${created.name} created`);
    setCreatingItem(false);
    setItemForm({ name: "", sku: "", category: "", unit: "unit", physicalStock: "", reorderLevel: "", cost: "" });
    await refresh();
  }

  async function raiseRequirement(a: ServerInventoryAlert) {
    if (!connected) { onSignIn(); return; }
    setBusy(true);
    const req = await createPurchaseRequirement({
      productIds: [a.id],
      quantity: a.shortfall > 0 ? a.shortfall : a.reorderLevel,
      unit: a.unit,
      reason: `Reorder alert · ${a.name} (${a.status.toLowerCase()})`,
      urgency: a.status === "Out of stock" ? "URGENT" : "HIGH",
    });
    setBusy(false);
    if (!req) { onNotice("Could not raise requirement — check your permissions"); return; }
    onNotice(`Purchase requirement raised for ${a.name} — see Purchasing → Requirements`);
  }

  if (!connected && items.length === 0 && !loading) {
    return <section className="panel module-table"><div className="panel-heading"><div><h2>{tab}</h2><p>Live inventory</p></div></div><div className="empty-state"><Boxes size={28}/><h3>Sign in to view inventory</h3><p>Stock levels and the ledger read live from the ERP.</p><Button variant="outline" onClick={onSignIn}>Sign in</Button></div></section>;
  }

  return <section className="panel module-table">
    <div className="panel-heading"><div><h2>{tab}</h2><p>{loading?'Loading stock…':isAlerts?`${alerts.length} items at or below reorder level`: `${filtered.length} ingredients · ${lowStockCount} need attention`}</p></div>
      <div style={{display:"flex",gap:8}}>
        <Button variant="outline" onClick={()=>{ if(!connected){onSignIn();return;} setCreatingItem(true); }}>New item</Button>
        <Button variant="outline" onClick={()=>{ if(!connected){onSignIn();return;} const first=items[0]??null; setLedgerFor(first); setAdjusting(first); }}>Adjust stock</Button>
      </div>
    </div>
    <div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label={isAlerts?'Search stock alerts':'Search ingredients'} value={search} onChange={e=>setSearch(e.target.value)} placeholder={isAlerts?'Search alerts, SKU…':'Search ingredients, SKU…'}/></label></div>
    {isAlerts ? <>
    <DataTable
      columns={[
        { header:'Ingredient', cell:(a)=><><strong className="product-name">{a.name}</strong><small className="cell-sub">{a.sku} · {a.category}</small></> },
        { header:'On hand', align:'right', cell:(a)=><span className="amount-cell">{a.physicalStock} {a.unit}</span> },
        { header:'Available', align:'right', cell:(a)=><span className="amount-cell">{a.availableStock} {a.unit}</span> },
        { header:'Reorder level', align:'right', cell:(a)=><span className="amount-cell">{a.reorderLevel}</span> },
        { header:'Shortfall', align:'right', cell:(a)=><span className="amount-cell">{a.shortfall} {a.unit}</span> },
        { header:'Status', cell:(a)=><Status value={a.status}/> },
        { header:'', cell:(a)=><Button variant="outline" size="sm" disabled={busy} onClick={e=>{e.stopPropagation();void raiseRequirement(a)}}>Raise requirement</Button> },
        { header:'', cell:(a)=><Button variant="ghost" size="icon" aria-label={`Ledger for ${a.name}`} onClick={e=>{e.stopPropagation();setLedgerFor(a)}}><ArrowUpRight/></Button> },
      ] as Column<ServerInventoryAlert>[]}
      rows={filteredAlerts} rowKey={(a)=>a.id} onRowActivate={(a)=>setLedgerFor(a)} stickyHeader density={density}
      empty={<div className="empty-state"><Check/><h3>All stock levels healthy</h3><p>No ingredient is at or below its reorder level.</p></div>}
    />
    <div className="table-foot"><span>{filteredAlerts.length} alerts</span><Link to="/workspace/purchasing">Raise a purchase order in Purchasing →</Link></div>
    </> : <>
    <DataTable
      columns={[
        { header:'Ingredient', cell:(i)=><><strong className="product-name">{i.name}</strong><small className="cell-sub">{i.sku} · {i.category}</small></> },
        { header:'On hand', align:'right', cell:(i)=><span className="amount-cell">{i.physicalStock} {i.unit}</span> },
        { header:'Available', align:'right', cell:(i)=><span className="amount-cell">{i.availableStock ?? i.physicalStock} {i.unit}</span> },
        { header:'Reorder level', align:'right', cell:(i)=><span className="amount-cell">{i.reorderLevel}</span> },
        { header:'Unit cost', align:'right', cell:(i)=><span className="amount-cell">{money(i.cost)}</span> },
        { header:'Status', cell:(i)=><Status value={stockStatus(i)}/> },
        { header:'', cell:(i)=><Button variant="ghost" size="icon" aria-label={`Ledger for ${i.name}`} onClick={e=>{e.stopPropagation();setLedgerFor(i)}}><ArrowUpRight/></Button> },
      ] as Column<ServerInventoryItem>[]}
      rows={filtered} rowKey={(i)=>i.id} onRowActivate={(i)=>setLedgerFor(i)} stickyHeader density={density}
      empty={<div className="empty-state"><Search/><h3>No ingredients found</h3><p>Inventory appears once ingredients are configured.</p></div>}
    />
    <div className="table-foot"><span>{filtered.length} ingredients</span><span>{ledger.length} ledger entries</span></div>
    </>}
    {creatingItem&&<Dialog open onOpenChange={v=>{if(!v)setCreatingItem(false);}}><DialogContent className="order-detail-dialog"><DialogTitle>New item</DialogTitle><DialogDescription>Register a new inventory item and its opening stock.</DialogDescription><div className="erp-form">
      <div className="form-row"><Label>Name</Label><Input value={itemForm.name} onChange={e=>setItemForm({...itemForm,name:e.target.value})}/></div>
      <div className="form-row"><Label>SKU</Label><Input value={itemForm.sku} onChange={e=>setItemForm({...itemForm,sku:e.target.value})}/></div>
      <div className="form-row"><Label>Category</Label><Input value={itemForm.category} onChange={e=>setItemForm({...itemForm,category:e.target.value})}/></div>
      <div className="form-row"><Label>Unit</Label><Input value={itemForm.unit} onChange={e=>setItemForm({...itemForm,unit:e.target.value})}/></div>
      <div className="form-row"><Label>Opening stock</Label><Input type="number" value={itemForm.physicalStock} onChange={e=>setItemForm({...itemForm,physicalStock:e.target.value})}/></div>
      <div className="form-row"><Label>Reorder level</Label><Input type="number" value={itemForm.reorderLevel} onChange={e=>setItemForm({...itemForm,reorderLevel:e.target.value})}/></div>
      <div className="form-row"><Label>Unit cost</Label><Input type="number" value={itemForm.cost} onChange={e=>setItemForm({...itemForm,cost:e.target.value})}/></div>
    </div><div className="dialog-actions"><Button disabled={busy||!itemForm.name} onClick={()=>void submitNewItem()}>Create item</Button><Button variant="ghost" onClick={()=>setCreatingItem(false)}>Cancel</Button></div></DialogContent></Dialog>}
    {ledgerFor&&<LedgerDialog item={ledgerFor} ledger={ledger} onClose={()=>{setLedgerFor(null);setAdjusting(null);}} adjusting={adjusting} setAdjusting={setAdjusting} form={form} setForm={setForm} submitAdjustment={()=>void submitAdjustment()} busy={busy}/>}
  </section>;
}
