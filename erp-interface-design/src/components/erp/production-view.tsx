import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/lib/live";
import type { ServerOrder } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StatusBadge as Status } from "@/components/data-table/StatusBadge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  listOrders,
  listProductionJobs,
  startProductionJob,
  createProductionJob,
  startProductionForOrder,
  completeProductionJob,
  recordQualityCheck,
  getProductionConsumption,
  listInventoryItems,
  recordJobMaterials,
  updateOrderApi,
} from "@/lib/api";
import { useWorkspace } from "@/components/erp/store";
import { orderStageTone, type StatusTone } from "@/lib/theme-tokens";

type OrderNotes = Record<string, string>;

function useNotes(): {
  notes: OrderNotes;
  setNotes: (orderId: string, value: string) => void;
  clearNotes: (orderId: string) => void;
} {
  const [notes, setNotesState] = useState<OrderNotes>({});
  const setNotes = useCallback((orderId: string, value: string) => {
    setNotesState((prev) => ({ ...prev, [orderId]: value }));
  }, []);
  const clearNotes = useCallback((orderId: string) => {
    setNotesState((prev) => {
      if (!(orderId in prev)) return prev;
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  }, []);
  return { notes, setNotes, clearNotes };
}

const ORDER_STATION_TONES: Record<string, StatusTone> = {
  confirmed: orderStageTone("Confirmed"),
  baking: orderStageTone("In production"),
  decorating: "orange",
  ready: orderStageTone("Ready"),
  queued: "amber",
};

function orderCardStyle(station: string, isClickable: boolean = false): React.CSSProperties {
  const tone = (ORDER_STATION_TONES as any)[station] ?? "amber";
  return {
    border: "1px solid var(--border)",
    backgroundColor: `color-mix(in srgb, var(--${tone}-solid) 18%, transparent)`,
    borderColor: `var(--${tone}-solid)`,
    padding: "12px",
    marginBottom: "8px",
    borderRadius: "8px",
    cursor: isClickable ? "pointer" : "default",
  };
}

export function ProductionView({ onSelect }: { onSelect?: (order: any) => void } = {}) {
  return (
    <section className="panel module-table">
      <div className="panel-heading">
        <div>
          <h2>Production</h2>
          <p>Order station board</p>
        </div>
      </div>
      <BakeryStation onSelect={onSelect} />
    </section>
  );
}

export function JobsView({ onSelect }: { onSelect?: (job: any) => void } = {}) {
  return (
    <section className="panel module-table">
      <div className="panel-heading">
        <div>
          <h2>Jobs</h2>
          <p>Job station board</p>
        </div>
      </div>
      <JobsBoard onSelect={onSelect} />
    </section>
  );
}

export function BakeryStation({ onSelect }: { onSelect?: (order: any) => void } = {}) {
  const { connected, orders: uiOrders } = useWorkspace();
  const { notes, setNotes, clearNotes } = useNotes();
  const [boardLoading, setBoardLoading] = useState(true);
  const [orderOrders, setOrderOrders] = useState<ServerOrder[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [confirmedDialogOrder, setConfirmedDialogOrder] = useState<ServerOrder | null>(null);
  const [starting, setStarting] = useState(false);

  const refreshBoard = useCallback(async () => {
    setBoardLoading(true);
    const [os, js] = await Promise.all([listOrders(), listProductionJobs()]);
    setOrderOrders(os);
    setJobs(js || []);
    setBoardLoading(false);
  }, []);
  useEffect(() => { void refreshBoard(); }, [refreshBoard]);
  useLiveRefresh(refreshBoard);

  useEffect(() => {
    const ensureJobs = async () => {
      try {
        let changed = false;
        for (const order of orderOrders) {
          const status = String(order.status || "").toUpperCase();
          if (["CONFIRMED", "PRODUCTION_REVIEW", "READY_FOR_PRODUCTION", "IN_PRODUCTION"].includes(status)) {
            const hasJob = jobs.some((j: any) => j.orderId === order.id || j.orderId === order.orderNumber);
            if (!hasJob && connected) {
              try { await createProductionJob(order.id); changed = true; } catch {}
            }
          }
        }
        if (changed) await refreshBoard();
      } catch {}
    };
    if (orderOrders.length > 0) {
      void ensureJobs();
    }
  }, [orderOrders]);

  const getStationForOrder = (order: ServerOrder): "confirmed" | "baking" | "decorating" | "ready" | null => {
    const status = String(order.status || "").toUpperCase();
    const station = (order as any).station;
    const job = jobs.find((j: any) => j.orderId === order.id || j.orderId === order.orderNumber);
    const jobStatus = String(job?.status || "").toUpperCase();
    // Orders handed over to fulfilment (In Transit / Delivered / Cancelled)
    // leave the production board entirely — checked BEFORE the ready branch so
    // a READY_FOR_DELIVERY job can't keep an in-transit order on display.
    if (status === "IN_TRANSIT" || status === "COMPLETED_DELIVERED" || status === "CANCELLED") {
      return null;
    }
    if (status === "AWAITING_CONFIRMATION" || status === "PENDING_CONFIRMATION") {
      return null;
    }
    if (status === "AWAITING_COLLECTION") {
      return "ready";
    }
    if (status === "READY_FOR_DELIVERY" || jobStatus === "READY_FOR_DELIVERY" || jobStatus === "COMPLETED" || station === "done") {
      return "ready";
    }
    if (jobStatus === "READY_FOR_QUALITY" || jobStatus === "QUALITY_CHECK" || jobStatus === "REWORK_REQUIRED") {
      return "decorating";
    }
    if (jobStatus === "IN_PRODUCTION" || status === "IN_PRODUCTION" || station === "baking") {
      return "baking";
    }
    if (station === "decorating") return "decorating";
    if (station === "confirmed" || status === "CONFIRMED" || status === "PRODUCTION_REVIEW" || status === "READY_FOR_PRODUCTION") {
      return "confirmed";
    }
    return null;
  };

  const confirmedOrders = orderOrders.filter((o) => getStationForOrder(o) === "confirmed");
  const bakingOrders = orderOrders.filter((o) => getStationForOrder(o) === "baking");
  const decoratingOrders = orderOrders.filter((o) => getStationForOrder(o) === "decorating");
  const readyOrders = orderOrders.filter((o) => getStationForOrder(o) === "ready");

  const handleMoveToProduction = async (orderId: string) => {
    if (!connected) return;
    try {
      let job = jobs.find((j: any) => j.orderId === orderId);
      if (!job) {
        const created = await createProductionJob(orderId);
        if (created) {
          job = created;
          await refreshBoard();
        }
      }
      if (job) {
        await startProductionJob(job.id);
        await refreshBoard();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const renderOrderCard = (order: ServerOrder, station: "confirmed" | "baking" | "decorating" | "ready") => {
    const job = jobs.find((j: any) => j.orderId === order.id);
    const status = String(order.status || "").toUpperCase().replace(/\s+/g, "_");
    const isAwaitingPickup = status === "AWAITING_COLLECTION" || status === "AWAITING_PICKUP";
    const isClickable = station === "confirmed";
    const handleOpen = () => {
      if (!isClickable) return;
      if (station === "confirmed") {
        setConfirmedDialogOrder(order);
        return;
      }
      if (onSelect) {
        const uiMatch = (uiOrders as any[])?.find((o: any) => o.id === order.orderNumber || o.id === order.id);
        onSelect(uiMatch || { id: order.orderNumber || order.id, customer: order.customerId, product: order.notes || "Order", status: order.status, amount: order.total, payment: order.paymentStatus, delivery: order.deliveryStatus } as any);
      }
    };
    const badgeValue = station === "confirmed" ? "" : station === "baking" ? "Baking" : station === "decorating" ? "Decorating" : isAwaitingPickup ? "Pick Up" : "Ready";
    const uiMatch = (uiOrders as any[])?.find((o: any) => o.id === order.orderNumber || o.id === order.id);
    const customerDisplay = uiMatch?.customer || order.customerId || "—";
    const cardStyle = isAwaitingPickup
      ? {
          border: "1px solid var(--border)",
          backgroundColor: "color-mix(in srgb, #C2703A 22%, transparent)",
          borderColor: "#C2703A",
          padding: "12px",
          marginBottom: "8px",
          borderRadius: "8px",
          cursor: isClickable ? "pointer" : "default",
          boxShadow: "0 0 0 1px rgba(194,112,58,0.3)",
        }
      : orderCardStyle(station, isClickable);
    return (
      <div key={order.id} className="order-card" style={cardStyle} onClick={handleOpen}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <strong>{order.orderNumber}</strong>
          {badgeValue ? <Status value={badgeValue} /> : null}
        </div>
        <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginBottom: "6px" }}>{customerDisplay}</div>
        <div style={{ fontSize: "12px", marginBottom: "6px" }}>{order.notes || "—"}</div>

      </div>
    );
  };

  const handleStartProductionFromConfirmed = async () => {
    if (!confirmedDialogOrder || !connected) return;
    setStarting(true);
    try {
      await startProductionForOrder(confirmedDialogOrder.id);
      setConfirmedDialogOrder(null);
      await refreshBoard();
    } catch (e) {
      console.error(e);
    } finally {
      setStarting(false);
    }
  };

  const uiMatchConfirmed = confirmedDialogOrder ? ((uiOrders as any[])?.find((o: any) => o.id === confirmedDialogOrder.orderNumber || o.id === confirmedDialogOrder.id)) : null;
  const customerDisplayConfirmed = uiMatchConfirmed?.customer || confirmedDialogOrder?.customerId || "—";

  return (
    <div style={{ padding: "16px" }}>
      {boardLoading && <p>Loading orders…</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px" }}>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Confirmed</h3>
          {confirmedOrders.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No orders</p>}
          {confirmedOrders.map((o) => renderOrderCard(o, "confirmed"))}
        </div>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Baking Station</h3>
          {bakingOrders.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No orders</p>}
          {bakingOrders.map((o) => renderOrderCard(o, "baking"))}
        </div>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Decorating Station</h3>
          {decoratingOrders.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No orders</p>}
          {decoratingOrders.map((o) => renderOrderCard(o, "decorating"))}
        </div>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Ready</h3>
          {readyOrders.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No orders</p>}
          {readyOrders.map((o) => renderOrderCard(o, "ready"))}
        </div>
      </div>
      <Dialog open={!!confirmedDialogOrder} onOpenChange={(v) => { if (!v) setConfirmedDialogOrder(null); }}>
        <DialogContent className="order-detail-dialog">
          <DialogTitle>{confirmedDialogOrder?.orderNumber}</DialogTitle>
          <DialogDescription>Order details</DialogDescription>
          <div className="configuration-list">
            <p><span>Customer</span><strong>{customerDisplayConfirmed}</strong></p>
            <p><span>Order ID</span><strong>{confirmedDialogOrder?.orderNumber}</strong></p>
            <p><span>Status</span><strong>{confirmedDialogOrder?.status}</strong></p>
            <p><span>Notes</span><strong>{confirmedDialogOrder?.notes || "—"}</strong></p>
            <p><span>Total</span><strong>{confirmedDialogOrder?.total}</strong></p>
          </div>
          <div className="dialog-actions">
            <Button onClick={() => void handleStartProductionFromConfirmed()} disabled={starting || !connected}>Start Production</Button>
            <Button variant="ghost" onClick={() => setConfirmedDialogOrder(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function JobsBoard({ onSelect, onNotice }: { onSelect?: (job: any) => void; onNotice?: (s: string) => void } = {}) {
  const { connected, orders: uiOrders } = useWorkspace();
  const [boardLoading, setBoardLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [serverOrders, setServerOrders] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [productionJob, setProductionJob] = useState<any | null>(null);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [consumption, setConsumption] = useState<any[]>([]);
  const [materialEntries, setMaterialEntries] = useState<Array<{ itemId: string; quantity: number; notes: string }>>([{ itemId: "", quantity: 0, notes: "" }]);
  const [busyAction, setBusyAction] = useState(false);

  const refreshBoard = useCallback(async () => {
    setBoardLoading(true);
    const [js, orders] = await Promise.all([listProductionJobs(), listOrders()]);
    setJobs(js || []);
    setServerOrders(orders || []);
    setBoardLoading(false);
  }, []);
  useEffect(() => { void refreshBoard(); }, [refreshBoard]);
  useLiveRefresh(refreshBoard);

  const getColumnForJob = (job: any): "queued" | "baking" | "decorating" | "ready" | null => {
    const status = String(job?.status || "").toUpperCase();
    if (status === "COMPLETED" || status === "READY_FOR_DELIVERY") {
      return "ready";
    }
    if (status === "IN_PRODUCTION") {
      return "baking";
    }
    if (status === "READY_FOR_QUALITY" || status === "QUALITY_CHECK" || status === "REWORK_REQUIRED") {
      return "decorating";
    }
    if (status === "PENDING" || status === "SCHEDULED" || status === "READY_FOR_PRODUCTION") {
      return "queued";
    }
    return "queued";
  };

  // An order that moved to In Transit (or was delivered / cancelled) has left
  // production — its job must not keep occupying a column on the Jobs board.
  const orderLeftProduction = (job: any): boolean => {
    const order = serverOrders.find((o: any) => o.id === job?.orderId || o.orderNumber === job?.orderId);
    const status = String(order?.status || "").toUpperCase();
    return status === "IN_TRANSIT" || status === "COMPLETED_DELIVERED" || status === "CANCELLED";
  };

  const queuedJobs = jobs.filter((j) => getColumnForJob(j) === "queued" && !orderLeftProduction(j));
  const bakingJobs = jobs.filter((j) => getColumnForJob(j) === "baking" && !orderLeftProduction(j));
  const decoratingJobs = jobs.filter((j) => getColumnForJob(j) === "decorating" && !orderLeftProduction(j));
  const readyJobs = jobs.filter((j) => getColumnForJob(j) === "ready" && !orderLeftProduction(j));

  useEffect(() => {
    if (!selectedJob) { setProductionJob(null); setConsumption([]); setMaterialEntries([{ itemId: "", quantity: 0, notes: "" }]); return; }
    let alive = true;
    void (async () => {
      const job = jobs.find(j => j.id === selectedJob.id) || selectedJob;
      if (alive) setProductionJob(job);
      try {
        const items = await listInventoryItems();
        if (alive) setInventoryItems(items || []);
      } catch { if (alive) setInventoryItems([]); }
      try {
        const cons = await getProductionConsumption(job.id);
        if (alive) setConsumption(cons || []);
      } catch { if (alive) setConsumption([]); }
    })();
    return () => { alive = false; };
  }, [selectedJob, jobs]);

  const refreshJob = async () => {
    try {
      const list = await listProductionJobs();
      setJobs(list || []);
      const job = (list || []).find(j => j.id === (productionJob?.id || selectedJob?.id));
      if (job) { setProductionJob(job); setSelectedJob(job); }
      const cons = await getProductionConsumption(job?.id || productionJob?.id || selectedJob?.id || '');
      setConsumption(cons || []);
    } catch {}
  };

  const handleStartJob = async () => {
    const jobId = productionJob?.id || selectedJob?.id;
    if (!jobId) return;
    setBusyAction(true);
    try {
      const res = await startProductionJob(jobId);
      if (res) { await refreshJob(); await refreshBoard(); }
    } finally {
      setBusyAction(false);
    }
  };

  const handleCompleteJob = async () => {
    const jobId = productionJob?.id || selectedJob?.id;
    if (!jobId) return;
    setBusyAction(true);
    try {
      const res = await completeProductionJob(jobId);
      if (res) { await refreshJob(); await refreshBoard(); }
    } finally {
      setBusyAction(false);
    }
  };

  const handleRecordMaterials = async () => {
    const jobId = productionJob?.id || selectedJob?.id;
    if (!jobId) return;
    const items = materialEntries.filter(m => m.itemId && Number(m.quantity) > 0).map(m => ({ itemId: m.itemId, quantity: Number(m.quantity), notes: m.notes || '' }));
    if (items.length === 0) return;
    setBusyAction(true);
    try {
      const res = await recordJobMaterials(jobId, items);
      if (res) { setMaterialEntries([{ itemId: "", quantity: 0, notes: "" }]); await refreshJob(); await refreshBoard(); }
    } finally {
      setBusyAction(false);
    }
  };

  const handleQualityPass = async () => {
    const jobId = productionJob?.id || selectedJob?.id;
    if (!jobId) return;
    setBusyAction(true);
    try {
      const res = await recordQualityCheck(jobId, { result: 'PASS' });
      if (res) { await refreshJob(); await refreshBoard(); }
    } finally {
      setBusyAction(false);
    }
  };

  const handleQualityFail = async () => {
    const jobId = productionJob?.id || selectedJob?.id;
    if (!jobId) return;
    setBusyAction(true);
    try {
      const res = await recordQualityCheck(jobId, { result: 'FAIL', reworkRequired: true });
      if (res) { await refreshJob(); await refreshBoard(); }
    } finally {
      setBusyAction(false);
    }
  };

  const handleMarkAwaitingPickup = async () => {
    const jobOrderId = selectedJob?.orderId;
    const serverOrder = serverOrders.find((o: any) => o.id === jobOrderId || o.orderNumber === jobOrderId) || orderMatchSel;
    const orderId = serverOrder?.id || jobOrderId;
    if (!orderId || !connected) {
      if (onNotice) onNotice("Not connected or no order found");
      return;
    }
    setBusyAction(true);
    try {
      const res = await updateOrderApi(orderId, { status: "AWAITING_COLLECTION" });
      if (res) {
        if (onNotice) onNotice("Marked as awaiting pickup");
        await refreshJob();
        await refreshBoard();
      } else {
        if (onNotice) onNotice("Failed to update order status");
      }
    } catch (e) {
      console.error(e);
      if (onNotice) onNotice("Error updating order status");
    } finally {
      setBusyAction(false);
    }
  };

  const renderJobCard = (job: any, column: "queued" | "baking" | "decorating" | "ready") => {
    const orderMatch = (uiOrders as any[])?.find((o: any) => o.id === job.orderId || o.orderNumber === job.orderId);
    const serverOrderMatch = serverOrders.find((o: any) => o.id === job.orderId || o.orderNumber === job.orderId);
    const orderInfo = orderMatch || serverOrderMatch;
    const normStatus = String((orderInfo as any)?.status || (serverOrderMatch as any)?.status || "").toUpperCase().replace(/\s+/g, "_");
    const isAwaitingPickup = normStatus === "AWAITING_COLLECTION" || normStatus === "AWAITING_PICKUP";
    const badgeValue = column === "queued" ? "Queued" : column === "baking" ? "Baking" : column === "decorating" ? "Decorating" : isAwaitingPickup ? "Pick Up" : "Ready";
    const cardStyle = isAwaitingPickup
      ? {
          border: "1px solid var(--border)",
          backgroundColor: "color-mix(in srgb, #C2703A 22%, transparent)",
          borderColor: "#C2703A",
          padding: "12px",
          marginBottom: "8px",
          borderRadius: "8px",
          cursor: "pointer",
          boxShadow: "0 0 0 1px rgba(194,112,58,0.3)",
        }
      : orderCardStyle(column, true);
    const handleOpen = () => {
      setSelectedJob({ ...job, order: orderInfo });
      if (onSelect) {
        onSelect({ ...job, order: orderInfo });
      }
    };
    const productDisplay = orderInfo?.product || (serverOrderMatch as any)?.notes || job.variantOptions || job.productId || job.notes || "—";
    const displayId = orderInfo?.orderNumber || (serverOrderMatch as any)?.orderNumber || orderInfo?.id || (serverOrderMatch as any)?.id || (job.orderId ? `TC-${String(job.orderId).replace(/^.*-/, '')}` : job.id);
    const jobDisplayId = displayId.startsWith('TC-') && !displayId.startsWith('TC-Job') ? displayId.replace('TC-', 'TC-Job-') : displayId;
    return (
      <div key={job.id} className="order-card" style={cardStyle} onClick={handleOpen}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <strong>{jobDisplayId}</strong>
          {badgeValue ? <Status value={badgeValue} /> : null}
        </div>
        <div style={{ fontSize: "12px", marginBottom: "6px" }}>{productDisplay}</div>
        {job.requiredBy && <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Due: {String(job.requiredBy).split('T')[0]}</div>}
      </div>
    );
  };

  const orderMatchSel = selectedJob ? ((uiOrders as any[])?.find((o: any) => o.id === selectedJob.orderId || o.orderNumber === selectedJob.orderId)) : null;
  const jobToShow = productionJob || selectedJob;
  const displayIdSel = orderMatchSel?.orderNumber || orderMatchSel?.id || (selectedJob?.orderId ? `TC-${String(selectedJob.orderId).replace(/^.*-/, '')}` : selectedJob?.id);
  const jobDisplayIdSel = displayIdSel && displayIdSel.startsWith('TC-') && !String(displayIdSel).startsWith('TC-Job') ? String(displayIdSel).replace('TC-', 'TC-Job-') : displayIdSel;

  return (
    <div style={{ padding: "16px" }}>
      {boardLoading && <p>Loading jobs…</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px" }}>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Queued</h3>
          {queuedJobs.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No jobs</p>}
          {queuedJobs.map((j) => renderJobCard(j, "queued"))}
        </div>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Baking</h3>
          {bakingJobs.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No jobs</p>}
          {bakingJobs.map((j) => renderJobCard(j, "baking"))}
        </div>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Decorating</h3>
          {decoratingJobs.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No jobs</p>}
          {decoratingJobs.map((j) => renderJobCard(j, "decorating"))}
        </div>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Ready</h3>
          {readyJobs.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No jobs</p>}
          {readyJobs.map((j) => renderJobCard(j, "ready"))}
        </div>
      </div>
      <Dialog open={!!selectedJob} onOpenChange={(v) => { if (!v) setSelectedJob(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>{jobDisplayIdSel}</DialogTitle>
          <DialogDescription>{jobToShow?.id} · Jobs</DialogDescription>
          <div className="space-y-4">
            <div className="configuration-list">
              <p><span>Order/Job</span><strong>{orderMatchSel?.orderNumber || selectedJob?.orderId}</strong></p>
              <p><span>Product</span><strong>{orderMatchSel?.product || selectedJob?.variantOptions || selectedJob?.productId || "—"}</strong></p>
              <p><span>Status</span><Status value={jobToShow?.status?.replace(/_/g, ' ') || ''} /></p>
              <p><span>Progress</span><strong>{jobToShow?.progress ?? "—"}%</strong></p>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Materials/Ingredients/Consumables Used</h3>
              {consumption.length === 0 ? <p className="text-xs text-muted-foreground">No materials recorded yet.</p> : (<div className="space-y-1">{consumption.map((c: any) => {
                const item = inventoryItems.find((it: any) => it.id === c.itemId);
                const name = item?.name || c.itemId;
                return (<div key={c.id} className="flex justify-between text-xs"><span>{name} × {c.quantity} {c.unit}</span><span>{c.notes || ''}</span></div>);
              })}</div>)}
              <div className="mt-3 space-y-2">
                {materialEntries.map((m, idx) => (<div key={idx} className="flex gap-2 items-center">
                  <select className="input flex-1" value={m.itemId} onChange={e => { const next = [...materialEntries]; next[idx] = { ...next[idx], itemId: e.target.value }; setMaterialEntries(next); }}>
                    <option value="">Select item...</option>
                    {inventoryItems.map((it: any) => <option key={it.id} value={it.id}>{it.name} - {it.physicalStock} {it.unit}</option>)}
                  </select>
                  <input className="input w-24" type="number" placeholder="Qty" value={m.quantity || ''} onChange={e => { const next = [...materialEntries]; next[idx] = { ...next[idx], quantity: Number(e.target.value) }; setMaterialEntries(next); }} />
                  <input className="input flex-1" placeholder="Notes" value={m.notes} onChange={e => { const next = [...materialEntries]; next[idx] = { ...next[idx], notes: e.target.value }; setMaterialEntries(next); }} />
                </div>))}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setMaterialEntries([...materialEntries, { itemId: "", quantity: 0, notes: "" }])}>Add Row</Button>
                  <Button size="sm" onClick={handleRecordMaterials} disabled={busyAction || !connected}>Record Items Used</Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(jobToShow?.status === 'PENDING' || jobToShow?.status === 'SCHEDULED' || jobToShow?.status === 'READY_FOR_PRODUCTION') && <Button size="sm" onClick={handleStartJob} disabled={busyAction || !connected}>Start Production</Button>}
              {jobToShow?.status === 'IN_PRODUCTION' && <Button size="sm" onClick={handleCompleteJob} disabled={busyAction || !connected}>Mark Production Complete</Button>}
              {(jobToShow?.status === 'READY_FOR_QUALITY' || jobToShow?.status === 'QUALITY_CHECK') && (<><Button size="sm" onClick={handleQualityPass} disabled={busyAction || !connected}>Pass Quality Check</Button><Button size="sm" variant="outline" onClick={handleQualityFail} disabled={busyAction || !connected}>Fail & Rework</Button></>)}
              {(jobToShow?.status === 'READY_FOR_DELIVERY' || jobToShow?.status === 'COMPLETED') && (<Button size="sm" onClick={handleMarkAwaitingPickup} disabled={busyAction || !connected}>Mark as Awaiting Pickup</Button>)}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
