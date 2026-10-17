import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Building2, PackageCheck, Plus, Search, Trash2, Truck } from "lucide-react";
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
  acknowledgePurchaseRequirement, createPurchaseOrder, listGoodsReceipts, listInventoryItems, listPurchaseOrders, listPurchaseRequirements, listSuppliers, receivePurchaseOrder,
  type ServerGoodsReceipt, type ServerInventoryItem, type ServerPurchaseOrder, type ServerPurchaseRequirement, type ServerSupplier,
} from "@/lib/api";

/* ── Purchasing (live; E3) ──────────────────────────────────────────────── */
// Four tabs per the module config:
//   Purchase orders — GET /purchasing/orders; Receive goods restocks inventory
//     (PURCHASE_RECEIPT ledger entries + supplier price history, RBAC-guarded).
//   Suppliers — GET /purchasing/suppliers.
//   Requirements — GET /purchasing; acknowledge + "Raise PO" prefilled dialog
//     (shortage → requirement → PO loop from Inventory alerts).
//   Goods received — GET /purchasing/receipts.

function poStatusLabel(s: string): string {
  const map: Record<string, string> = {
    DRAFT: "Draft", SENT: "Sent", ACCEPTED: "Accepted",
    PARTIALLY_RECEIVED: "Partially received", COMPLETED: "Received", CANCELLED: "Cancelled",
  };
  return map[s] ?? s;
}

function reqStatusLabel(s: string): string {
  const map: Record<string, string> = {
    OPEN: "Open", ACKNOWLEDGED: "Acknowledged", ORDERED: "Ordered", RECEIVED: "Received", RESOLVED: "Resolved",
  };
  return map[s] ?? s;
}

type PoLine = { productId: string; quantity: string; unit: string; unitPrice: string };
type PoForm = { supplierId: string; expectedDate: string; notes: string; lines: PoLine[]; requirementId?: string };

function CreatePoDialog(props: {
  form: PoForm; setForm: (f: PoForm) => void; suppliers: ServerSupplier[]; items: ServerInventoryItem[];
  itemName: (id: string) => string; busy: boolean; submit: () => void; onClose: () => void;
}) {
  const { form, setForm, suppliers, items, itemName, busy, submit, onClose } = props;
  const setLine = (idx: number, patch: Partial<PoLine>) => {
    const lines = form.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    setForm({ ...form, lines });
  };
  return <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
    <DialogContent className="order-detail-dialog">
      <DialogTitle>{form.requirementId ? "Raise purchase order" : "New purchase order"}</DialogTitle>
      <DialogDescription>
        {form.requirementId ? `Prefilled from requirement ${form.requirementId} — it will be acknowledged on creation.` : "Goods receipt restocks inventory and records supplier price history."}
      </DialogDescription>
      <div className="erp-form">
        <div className="form-row"><Label htmlFor="po-supplier">Supplier</Label>
          <select id="po-supplier" className="input" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}>
            <option value="">Select supplier…</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.businessName}</option>)}
          </select>
        </div>
        <div className="form-row"><Label htmlFor="po-expected">Expected date</Label><Input id="po-expected" type="date" value={form.expectedDate} onChange={e => setForm({ ...form, expectedDate: e.target.value })}/></div>
        <h3 className="text-sm font-semibold">Lines</h3>
        {form.lines.map((l, idx) => <div key={idx} className="form-row" style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <select aria-label={`Item ${idx + 1}`} className="input" style={{flex:2,minWidth:160}} value={l.productId} onChange={e => {
            const it = items.find(i => i.id === e.target.value);
            setLine(idx, { productId: e.target.value, unit: it?.unit ?? l.unit });
          }}>
            <option value="">Select item…</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
          <Input aria-label={`Quantity ${idx + 1}`} type="number" min="0" placeholder="Qty" style={{flex:1,minWidth:80}} value={l.quantity} onChange={e => setLine(idx, { quantity: e.target.value })}/>
          <Input aria-label={`Unit price ${idx + 1}`} type="number" min="0" placeholder={`Price / ${l.unit}`} style={{flex:1,minWidth:100}} value={l.unitPrice} onChange={e => setLine(idx, { unitPrice: e.target.value })}/>
          <Button variant="ghost" size="icon" aria-label={`Remove line ${idx + 1}`} disabled={form.lines.length === 1} onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })}><Trash2/></Button>
        </div>)}
        <Button variant="outline" size="sm" onClick={() => setForm({ ...form, lines: [...form.lines, { productId: "", quantity: "", unit: "unit", unitPrice: "" }] })}><Plus/> Add line</Button>
        <div className="form-row"><Label htmlFor="po-notes">Notes</Label><Input id="po-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional"/></div>
        <p className="cell-sub">Total: {money(form.lines.reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0), 0))}{form.lines.some(l => !Number(l.unitPrice)) ? " (lines without a price count as 0)" : ""}</p>
      </div>
      <div className="dialog-actions">
        <Button disabled={busy || !form.supplierId} onClick={submit}>Create purchase order</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

export function Purchasing({ tab, search, setSearch, onNotice, onSignIn }: { tab: string; search: string; setSearch: (s: string) => void; onNotice: (s: string) => void; onSignIn: () => void }) {
  const { connected } = useWorkspace();
  const { density } = useDensity();
  const [orders, setOrders] = useState<ServerPurchaseOrder[]>([]);
  const [requirements, setRequirements] = useState<ServerPurchaseRequirement[]>([]);
  const [suppliers, setSuppliers] = useState<ServerSupplier[]>([]);
  const [receipts, setReceipts] = useState<ServerGoodsReceipt[]>([]);
  const [invItems, setInvItems] = useState<ServerInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<ServerPurchaseOrder | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<ServerGoodsReceipt | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PoForm>({ supplierId: "", expectedDate: "", notes: "", lines: [{ productId: "", quantity: "", unit: "unit", unitPrice: "" }] });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [o, r, s, g, inv] = await Promise.all([
      listPurchaseOrders(), listPurchaseRequirements(), listSuppliers(), listGoodsReceipts(), listInventoryItems(),
    ]);
    setOrders(o); setRequirements(r); setSuppliers(s); setReceipts(g); setInvItems(inv);
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const itemName = useCallback((id: string) => invItems.find(i => i.id === id || i.sku === id)?.name ?? id, [invItems]);
  const supplierName = useCallback((id: string) => suppliers.find(s => s.id === id)?.businessName ?? id, [suppliers]);

  const q = search.toLowerCase();
  const filtered = useMemo(() => orders.filter(p => `${p.id} ${p.poNumber} ${supplierName(p.supplierId)} ${poStatusLabel(p.status)}`.toLowerCase().includes(q)), [orders, q, supplierName]);
  const filteredReqs = useMemo(() => requirements.filter(r => `${r.id} ${r.productIds} ${r.reason} ${reqStatusLabel(r.status)}`.toLowerCase().includes(q)), [requirements, q]);
  const filteredSuppliers = useMemo(() => suppliers.filter(s => `${s.businessName} ${s.contactPerson} ${s.phone} ${s.email} ${s.productsSupplied}`.toLowerCase().includes(q)), [suppliers, q]);
  const filteredReceipts = useMemo(() => receipts.filter(g => `${g.id} ${g.purchaseOrderId} ${poStatusLabel(g.status)}`.toLowerCase().includes(q)), [receipts, q]);

  async function receive(po: ServerPurchaseOrder) {
    if (!connected) { onSignIn(); return; }
    setBusy(true);
    const r = await receivePurchaseOrder(po.id);
    setBusy(false);
    if (!r) { onNotice("Receive failed — check your permissions"); return; }
    onNotice(`${po.poNumber} received — inventory restocked`);
    setDetail(null);
    await refresh();
  }

  async function acknowledgeReq(r: ServerPurchaseRequirement) {
    if (!connected) { onSignIn(); return; }
    setBusy(true);
    const updated = await acknowledgePurchaseRequirement(r.id);
    setBusy(false);
    if (!updated) { onNotice("Acknowledge failed — check your permissions"); return; }
    onNotice("Requirement acknowledged");
    await refresh();
  }

  function openCreate(prefill?: { productId: string; quantity: number; unit: string; requirementId: string }) {
    if (!connected) { onSignIn(); return; }
    const next: PoForm = {
      supplierId: suppliers.find(s => s.active)?.id ?? suppliers[0]?.id ?? "",
      expectedDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      notes: prefill ? "Raised from purchase requirement" : "",
      lines: [prefill
        ? { productId: prefill.productId, quantity: String(prefill.quantity), unit: prefill.unit, unitPrice: "" }
        : { productId: invItems[0]?.id ?? "", quantity: "", unit: invItems[0]?.unit ?? "unit", unitPrice: "" }],
    };
    if (prefill) next.requirementId = prefill.requirementId;
    setForm(next);
    setCreating(true);
  }

  async function submitPo() {
    if (!connected) { onSignIn(); return; }
    if (!form.supplierId) { onNotice("Select a supplier"); return; }
    const items = form.lines
      .filter(l => l.productId && Number(l.quantity) > 0)
      .map(l => ({ productId: l.productId, quantity: Number(l.quantity), unit: l.unit, unitPrice: Number(l.unitPrice) || 0 }));
    if (items.length === 0) { onNotice("Add at least one line with a quantity"); return; }
    setBusy(true);
    const po = await createPurchaseOrder({ supplierId: form.supplierId, expectedDate: form.expectedDate, notes: form.notes, items });
    if (po && form.requirementId) await acknowledgePurchaseRequirement(form.requirementId);
    setBusy(false);
    if (!po) { onNotice("Could not create the purchase order — check your permissions"); return; }
    onNotice(`${po.poNumber} created${form.requirementId ? " · requirement acknowledged" : ""}`);
    setCreating(false);
    await refresh();
  }

  if (!connected && orders.length === 0 && !loading) {
    return <section className="panel module-table"><div className="panel-heading"><div><h2>{tab}</h2><p>Purchase orders</p></div></div><div className="empty-state"><Truck size={28}/><h3>Sign in to view purchasing</h3><p>Purchase orders and goods receipt read live from the ERP.</p><Button variant="outline" onClick={onSignIn}>Sign in</Button></div></section>;
  }

  if (tab === "Suppliers") {
    return <section className="panel module-table">
      <div className="panel-heading"><div><h2>{tab}</h2><p>{loading ? "Loading suppliers…" : `${filteredSuppliers.length} suppliers`}</p></div></div>
      <div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label="Search suppliers" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers, contacts…"/></label></div>
      <DataTable
        columns={[
          { header: "Supplier", cell: (s) => <><strong className="product-name">{s.businessName}</strong><small className="cell-sub">{s.address || s.id}</small></> },
          { header: "Contact", cell: (s) => <>{s.contactPerson || "—"}<small className="cell-sub">{[s.phone, s.email].filter(Boolean).join(" · ")}</small></> },
          { header: "Supplies", cell: (s) => s.productsSupplied || "—" },
          { header: "Terms", cell: (s) => s.paymentTerms || "—" },
          { header: "Status", cell: (s) => <Status value={s.active ? "Active" : "Inactive"}/> },
        ] as Column<ServerSupplier>[]}
        rows={filteredSuppliers} rowKey={(s) => s.id} stickyHeader density={density}
        empty={<div className="empty-state"><Building2/><h3>No suppliers found</h3><p>Suppliers are configured by the administrator.</p></div>}
      />
      <div className="table-foot"><span>{filteredSuppliers.length} suppliers</span><span>{suppliers.filter(s => s.active).length} active</span></div>
    </section>;
  }

  if (tab === "Requirements") {
    return <section className="panel module-table">
      <div className="panel-heading"><div><h2>{tab}</h2><p>{loading ? "Loading requirements…" : `${filteredReqs.length} purchase ${filteredReqs.length === 1 ? "requirement" : "requirements"}`}</p></div>
        <Button variant="outline" onClick={() => openCreate()}><Plus/> New purchase order</Button>
      </div>
      <div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label="Search requirements" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requirements, items…"/></label></div>
      <DataTable
        columns={[
          { header: "Item(s)", cell: (r) => <><strong className="product-name">{r.productIds.split(",").map(id => itemName(id.trim())).join(", ")}</strong><small className="cell-sub">{r.id} · requested by {r.requestedBy}</small></> },
          { header: "Quantity", align: "right", cell: (r) => <span className="amount-cell">{r.quantity} {r.unit}</span> },
          { header: "Reason", cell: (r) => r.reason || "—" },
          { header: "Urgency", cell: (r) => <Status value={r.urgency.charAt(0) + r.urgency.slice(1).toLowerCase()}/> },
          { header: "Status", cell: (r) => <Status value={reqStatusLabel(r.status)}/> },
          { header: "", cell: (r) => <div style={{ display: "flex", gap: 4 }}>
            {r.status === "OPEN" && <Button variant="outline" size="sm" disabled={busy} onClick={e => { e.stopPropagation(); void acknowledgeReq(r); }}>Acknowledge</Button>}
            {(r.status === "OPEN" || r.status === "ACKNOWLEDGED") && <Button variant="ghost" size="sm" disabled={busy || invItems.length === 0} onClick={e => {
              e.stopPropagation();
              const id = r.productIds.split(",")[0]?.trim() ?? "";
              const it = invItems.find(i => i.id === id);
              openCreate({ productId: id, quantity: r.quantity, unit: r.unit || it?.unit || "unit", requirementId: r.id });
            }}>Raise PO</Button>}
          </div> },
        ] as Column<ServerPurchaseRequirement>[]}
        rows={filteredReqs} rowKey={(r) => r.id} stickyHeader density={density}
        empty={<div className="empty-state"><Truck/><h3>No purchase requirements</h3><p>Raise one from an Inventory → Alerts shortfall.</p></div>}
      />
      <div className="table-foot"><span>{filteredReqs.length} requirements</span><span>{requirements.filter(r => r.status === "OPEN").length} open</span></div>
      {creating && <CreatePoDialog form={form} setForm={setForm} suppliers={suppliers} items={invItems} itemName={itemName} busy={busy} submit={() => void submitPo()} onClose={() => setCreating(false)}/>}
    </section>;
  }

  if (tab === "Goods received") {
    return <section className="panel module-table">
      <div className="panel-heading"><div><h2>{tab}</h2><p>{loading ? "Loading receipts…" : `${filteredReceipts.length} goods ${filteredReceipts.length === 1 ? "receipt" : "receipts"}`}</p></div></div>
      <div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label="Search goods receipts" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search receipts, POs…"/></label></div>
      <DataTable
        columns={[
          { header: "Receipt", cell: (g) => <><strong className="product-name">{orders.find(o => o.id === g.purchaseOrderId)?.poNumber ?? g.purchaseOrderId}</strong><small className="cell-sub">{g.id}</small></> },
          { header: "Date", cell: (g) => new Date(g.date).toLocaleDateString() },
          { header: "Received by", cell: (g) => g.receivedBy || "—" },
          { header: "Lines", align: "right", cell: (g) => <span className="amount-cell">{g.items?.length ?? 0}</span> },
          { header: "Total", align: "right", cell: (g) => <span className="amount-cell">{money(g.total)}</span> },
          { header: "Status", cell: (g) => <Status value={poStatusLabel(g.status)}/> },
          { header: "", cell: (g) => <Button variant="ghost" size="icon" aria-label={`Open receipt ${g.id}`} onClick={e => { e.stopPropagation(); setReceiptDetail(g); }}><ArrowUpRight/></Button> },
        ] as Column<ServerGoodsReceipt>[]}
        rows={filteredReceipts} rowKey={(g) => g.id} onRowActivate={(g) => setReceiptDetail(g)} stickyHeader density={density}
        empty={<div className="empty-state"><PackageCheck/><h3>No goods received yet</h3><p>Receipts are created when a purchase order is received.</p></div>}
      />
      <div className="table-foot"><span>{filteredReceipts.length} receipts</span><span>{receipts.reduce((s, g) => s + (g.items?.length ?? 0), 0)} lines received</span></div>
      {receiptDetail && <Dialog open onOpenChange={v => { if (!v) setReceiptDetail(null); }}>
        <DialogContent className="order-detail-dialog">
          <DialogTitle>{orders.find(o => o.id === receiptDetail.purchaseOrderId)?.poNumber ?? receiptDetail.purchaseOrderId}</DialogTitle>
          <DialogDescription>Goods receipt {receiptDetail.id} · {new Date(receiptDetail.date).toLocaleDateString()} · supplier price history updated</DialogDescription>
          <div className="configuration-list">
            {(receiptDetail.items ?? []).length === 0 ? <p className="cell-sub">No lines recorded.</p> : (receiptDetail.items ?? []).map(i => <p key={i.id}><span>Line {i.poItemId} · {i.quantity} {i.unit}</span><strong>{money(i.unitCost * i.quantity)} · {money(i.unitCost)}/{i.unit}</strong></p>)}
            <p><span>Total</span><strong>{money(receiptDetail.total)}</strong></p>
          </div>
          <div className="dialog-actions"><Button variant="ghost" onClick={() => setReceiptDetail(null)}>Close</Button></div>
        </DialogContent>
      </Dialog>}
    </section>;
  }

  // Default tab — Purchase orders
  return <section className="panel module-table">
    <div className="panel-heading"><div><h2>{tab}</h2><p>{loading ? "Loading purchase orders…" : `${filtered.length} purchase ${filtered.length === 1 ? "order" : "orders"}`}</p></div>
      <Button variant="outline" onClick={() => openCreate()}><Plus/> New purchase order</Button>
    </div>
    <div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label="Search purchase orders" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PO numbers, suppliers…"/></label></div>
    <DataTable
      columns={[
        { header: "PO / supplier", cell: (p) => <><strong className="product-name">{p.poNumber}</strong><small className="cell-sub">{supplierName(p.supplierId)}</small></> },
        { header: "Expected", cell: (p) => new Date(p.expectedDate).toLocaleDateString() },
        { header: "Lines", align: "right", cell: (p) => <span className="amount-cell">{p.items.length}</span> },
        { header: "Received", align: "right", cell: (p) => <span className="amount-cell">{p.items.filter(i => i.receivedQuantity >= i.quantity).length}/{p.items.length}</span> },
        { header: "Total", align: "right", cell: (p) => <span className="amount-cell">{money(p.total)}</span> },
        { header: "Status", cell: (p) => <Status value={poStatusLabel(p.status)}/> },
        { header: "", cell: (p) => <Button variant="ghost" size="icon" aria-label={`Open ${p.poNumber}`} onClick={e => { e.stopPropagation(); setDetail(p); }}><ArrowUpRight/></Button> },
      ] as Column<ServerPurchaseOrder>[]}
      rows={filtered} rowKey={(p) => p.id} onRowActivate={(p) => setDetail(p)} stickyHeader density={density}
      empty={<div className="empty-state"><Search/><h3>No purchase orders found</h3><p>Purchase orders appear once suppliers are engaged.</p></div>}
    />
    <div className="table-foot"><span>{filtered.length} orders</span><span>{orders.filter(p => p.status === "COMPLETED").length} received</span></div>
    {detail && <Dialog open onOpenChange={v => { if (!v) setDetail(null); }}>
      <DialogContent className="order-detail-dialog">
        <DialogTitle>{detail.poNumber}</DialogTitle>
        <DialogDescription>{supplierName(detail.supplierId)} · expected {new Date(detail.expectedDate).toLocaleDateString()}</DialogDescription>
        <div className="configuration-list">
          {detail.items.map(i => <p key={i.id}><span>{itemName(i.productId)} · {i.quantity} {i.unit}</span><strong>{money(i.total)}{i.receivedQuantity ? ` · ${i.receivedQuantity} received` : ""}</strong></p>)}
          <p><span>Total</span><strong>{money(detail.total)}</strong></p>
          <p><span>Status</span><Status value={poStatusLabel(detail.status)}/></p>
        </div>
        {detail.status !== "COMPLETED" && detail.status !== "CANCELLED" && <div className="dialog-actions">
          <Button disabled={busy} onClick={() => void receive(detail)}>Receive goods</Button>
          <Button variant="ghost" onClick={() => setDetail(null)}>Close</Button>
        </div>}
      </DialogContent>
    </Dialog>}
    {creating && <CreatePoDialog form={form} setForm={setForm} suppliers={suppliers} items={invItems} itemName={itemName} busy={busy} submit={() => void submitPo()} onClose={() => setCreating(false)}/>}
  </section>;
}
