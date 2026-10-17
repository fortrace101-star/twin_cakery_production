import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "./store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "../data-table/StatusBadge";
import { money } from "./data";
import { listDeliveries, createDelivery, updateDelivery, cancelDelivery, deliveryStatusLabel } from "@/lib/api";
import type { ServerDelivery } from "@/lib/api";

/**
 * Fulfilment branching: pickup/collection orders never go In Transit — they
 * move PENDING → READY_FOR_DISPATCH → COMPLETED_DELIVERED (the order-side
 * equivalent is Awaiting Collection → Completed / Delivered). Home deliveries
 * pass through In Transit (Awaiting Collection → In Transit → Completed /
 * Delivered).
 */
function isCollection(d: ServerDelivery): boolean {
  const t = String(d.type || "").toUpperCase();
  return t.includes("PICKUP") || t.includes("COLLECTION");
}

export function DeliveriesView({ onNotice }: { onNotice: (s: string) => void }) {
  const { orders } = useWorkspace();
  const [tab, setTab] = useState("Upcoming");
  const [deliveries, setDeliveries] = useState<ServerDelivery[]>([]);

  const counts = {
    Upcoming: deliveries.filter((d) => d.status === "PENDING" || d.status === "READY_FOR_DISPATCH").length,
    Dispatch: deliveries.filter((d) => d.status === "IN_TRANSIT").length,
    Completed: deliveries.filter((d) => d.status === "COMPLETED_DELIVERED").length,
  };

  const [fOrderId, setFOrderId] = useState("");
  const [fType, setFType] = useState("HOME_DELIVERY");
  const [fDestination, setFDestination] = useState("");
  const [fScheduled, setFScheduled] = useState("");
  const [fPerson, setFPerson] = useState("");
  const [fFee, setFFee] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fId, setFId] = useState("");
  const [editing, setEditing] = useState<ServerDelivery | null>(null);
  const [saving, setSaving] = useState(false);

  const refreshDeliveries = useCallback(async () => {
    const list = await listDeliveries();
    setDeliveries(list);
  }, []);

  useEffect(() => { void refreshDeliveries(); }, [refreshDeliveries]);

  function resetForm() {
    setFId("");
    setEditing(null);
    setFOrderId("");
    setFDestination("");
    setFNotes("");
    setFPerson("");
    setFFee("");
    setFScheduled("");
    setFType("HOME_DELIVERY");
  }

  async function onCreate() {
    if (!fOrderId) return onNotice("Pick an order");
    setSaving(true);
    const res = await createDelivery({
      orderId: fOrderId,
      type: fType,
      destination: fDestination,
      scheduledAt: fScheduled || null,
      deliveryPerson: fPerson || null,
      ...(fFee ? { deliveryFee: Number(fFee) } : {}),
      status: "PENDING",
      ...(fNotes ? { notes: fNotes } : {}),
    });
    setSaving(false);
    if (!res) return onNotice("Could not create the delivery");
    setDeliveries((p) => [res, ...p]);
    resetForm();
    onNotice("Delivery created");
    void refreshDeliveries();
  }

  function openEdit(d: ServerDelivery) {
    setFId(d.id);
    setEditing(d);
    setFOrderId(d.orderId);
    setFType(d.type || "HOME_DELIVERY");
    setFDestination(d.destination);
    setFScheduled(d.scheduledAt || "");
    setFPerson(d.deliveryPerson || "");
    setFFee(d.deliveryFee ? String(d.deliveryFee) : "");
    setFNotes(d.notes || "");
  }

  async function onSave() {
    if (!fOrderId || !fDestination) return onNotice("Pick an order and a destination");
    setSaving(true);
    const payload: Record<string, unknown> = {
      orderId: fOrderId,
      destination: fDestination,
      scheduledAt: fScheduled || null,
      deliveryPerson: fPerson || null,
      deliveryFee: fFee ? Number(fFee) : null,
      notes: fNotes || null,
    };
    if (fType) payload["type"] = fType;
    if (editing) {
      const res = await updateDelivery(fId, payload);
      if (!res) return onNotice("Could not update the delivery");
      setDeliveries((p) => p.map((x) => (x.id === fId ? res : x)));
      onNotice("Delivery updated");
    } else {
      const res = await createDelivery(payload as never);
      if (!res) return onNotice("Could not create the delivery");
      setDeliveries((p) => [res, ...p]);
      onNotice("Delivery created");
    }
    setSaving(false);
    resetForm();
    void refreshDeliveries();
  }

  async function onCancel(id: string) {
    if (!window.confirm("Cancel this delivery?")) return;
    const res = await cancelDelivery(id);
    if (!res) return onNotice("Could not cancel");
    onNotice("Delivery cancelled");
    void refreshDeliveries();
  }

  async function onMarkReady(id: string) {
    const res = await updateDelivery(id, { status: "READY_FOR_DISPATCH" });
    if (!res) return onNotice("Could not mark the delivery ready");
    onNotice("Delivery ready for dispatch");
    void refreshDeliveries();
  }

  async function onDispatch(id: string) {
    const res = await updateDelivery(id, { status: "IN_TRANSIT" });
    if (!res) return onNotice("Could not dispatch");
    onNotice("Dispatcher assigned — the delivery is In Transit");
    void refreshDeliveries();
  }

  async function onComplete(id: string) {
    const res = await updateDelivery(id, { status: "COMPLETED_DELIVERED" });
    if (!res) return onNotice("Could not complete the delivery");
    onNotice("Delivery completed");
    void refreshDeliveries();
  }

  const byTab = tab === "Upcoming"
    ? ["PENDING", "READY_FOR_DISPATCH"]
    : tab === "Dispatch"
      ? ["IN_TRANSIT"]
      : ["COMPLETED_DELIVERED"];

  const rows = deliveries.filter((d) => byTab.includes(d.status));

  return (
    <div className="deliveries-view">
      <div className="module-tabs">
        {["Upcoming", "Dispatch", "Completed"].map((t) => (
          <Button
            key={t}
            variant="ghost"
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t} <span className="tab-count">{counts[t as keyof typeof counts]}</span>
          </Button>
        ))}
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>{tab === "Upcoming" ? "Upcoming deliveries" : tab === "Dispatch" ? "On dispatch" : "Completed"}</h2>
          <p>Pick an open order or the <em>New delivery</em> form to start a route.</p>
        </div>

        {tab === "Upcoming" && (
          <>
            <div className="form-grid">
              <div className="form-field"><Label htmlFor="d-order">Order</Label><select id="d-order" className="input" value={fOrderId} onChange={(e) => setFOrderId(e.target.value)}><option value="">Choose an order…</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.id} — {o.customer} ({o.status})</option>)}</select></div>
              <div className="form-field"><Label htmlFor="d-type">Fulfilment</Label><select id="d-type" className="input" value={fType} onChange={(e) => setFType(e.target.value)}><option value="HOME_DELIVERY">Home delivery</option><option value="PICKUP">Pickup</option><option value="COLLECTION">Collection</option></select></div>
              <div className="form-field"><Label htmlFor="d-dest">Destination</Label><Input id="d-dest" value={fDestination} onChange={(e) => setFDestination(e.target.value)} placeholder="Choose a delivery destination" /></div>
              <div className="form-field"><Label htmlFor="d-date">Scheduled</Label><Input id="d-date" type="datetime-local" value={fScheduled} onChange={(e) => setFScheduled(e.target.value)} /></div>
              <div className="form-field"><Label htmlFor="d-person">Delivery person</Label><Input id="d-person" value={fPerson} onChange={(e) => setFPerson(e.target.value)} placeholder="e.g. I. Kizza" /></div>
              <div className="form-field"><Label htmlFor="d-fee">Delivery fee (USh)</Label><Input id="d-fee" type="number" value={fFee} onChange={(e) => setFFee(e.target.value)} placeholder="75000" /></div>
            </div>
            <div className="form-field"><Label htmlFor="d-notes">Notes</Label><Input id="d-notes" value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="Custody, gate, contact…" /></div>
            <div className="flex justify-end gap-2">
              {editing
                ? <Button variant="secondary" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save delivery"}</Button>
                : <Button variant="secondary" onClick={onCreate} disabled={saving}><Plus size={16}/>{saving ? "Creating…" : "New delivery"}</Button>}
            </div>
          </>
        )}

        <div className="table-wrap">
          <table className="table data">
            <thead>
              <tr>
                <th>Order</th>
                <th>Destination</th>
                <th>Scheduled</th>
                <th>Person</th>
                <th>Fee</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const actions =
                  d.status === "PENDING"
                    ? (<><Button variant="secondary" size="sm" onClick={() => onMarkReady(d.id)}>Mark ready</Button><Button variant="ghost" size="sm" onClick={() => onCancel(d.id)}>Cancel</Button></>)
                    : d.status === "READY_FOR_DISPATCH"
                      ? isCollection(d)
                        ? (<><Button size="sm" onClick={() => onComplete(d.id)}>Complete collection</Button><Button variant="ghost" size="sm" onClick={() => onCancel(d.id)}>Cancel</Button></>)
                        : (<><Button size="sm" onClick={() => onDispatch(d.id)}>Dispatch</Button><Button variant="ghost" size="sm" onClick={() => onCancel(d.id)}>Cancel</Button></>)
                      : d.status === "IN_TRANSIT"
                        ? (<Button size="sm" onClick={() => onComplete(d.id)}>Complete delivery</Button>)
                        : <></>;
                return (
                  <tr key={d.id}>
                    <td>{d.orderId}</td>
                    <td>{d.destination}</td>
                    <td>{d.scheduledAt ? new Date(d.scheduledAt).toLocaleString("en-UG") : "—"}</td>
                    <td>{d.deliveryPerson || "—"}</td>
                    <td className="num">{d.deliveryFee ? money(d.deliveryFee) : "—"}</td>
                    <td><StatusBadge value={deliveryStatusLabel(d.status)} /></td>
                    <td className="actions">{actions}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="empty">{tab === "Upcoming" ? "No upcoming deliveries" : tab === "Dispatch" ? "Nothing out for dispatch" : "No completed deliveries yet"}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

