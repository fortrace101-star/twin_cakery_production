import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveRefresh } from "@/lib/live";
import type { ServerOrder } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StatusBadge as Status } from "@/components/data-table/StatusBadge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

async function withActionTimeout<T>(promise: Promise<T>, ms = 20000, label = "Action"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out. The server may still be processing; refresh to check.`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
import { Skeleton } from "@/components/ui/skeleton";
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
  useProductionBoardCache,
} from "@/lib/api";
import { useWorkspace } from "@/components/erp/store";
import { orderStageTone, type StatusTone } from "@/lib/theme-tokens";
import type { ServerProductionJob } from "@/lib/api";

// Fetch only statuses relevant to production boards instead of the full order history.
const PRODUCTION_ORDER_STATUSES = [
  "CONFIRMED",
  "PRODUCTION_REVIEW",
  "READY_FOR_PRODUCTION",
  "IN_PRODUCTION",
  "AWAITING_COLLECTION",
  "READY_FOR_DELIVERY",
];
// Jobs board also needs orders that left production so it can hide their jobs.
const JOBS_ORDER_STATUSES = [
  ...PRODUCTION_ORDER_STATUSES,
  "IN_TRANSIT",
  "COMPLETED_DELIVERED",
  "CANCELLED",
];

function ProductionCardSkeleton() {
  return (
    <div
      className="order-card"
      aria-hidden="true"
      style={{
        border: "1px solid var(--border)",
        backgroundColor: "var(--card, transparent)",
        padding: "12px",
        marginBottom: "8px",
        borderRadius: "8px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginBottom: "6px", gap: "8px" }}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-32 mb-2" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

function ColumnCardSkeletons({ count = 2 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <ProductionCardSkeleton key={i} />
      ))}
    </>
  );
}

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
      {onSelect ? <BakeryStation onSelect={onSelect} /> : null}
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
      {onSelect ? <JobsBoard onSelect={onSelect} /> : null}
    </section>
  );
}

export function BakeryStation({ onSelect }: { onSelect?: (order: any) => void } = {}) {
  const { connected, orders: uiOrders } = useWorkspace();
  const { notes, setNotes, clearNotes } = useNotes();
  const [boardLoading, setBoardLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [orderOrders, setOrderOrders] = useState<ServerOrder[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const jobsRef = useRef<any[]>([]);
  const connectedRef = useRef(connected);
  const ensuringRef = useRef(false);
  const [confirmedDialogOrder, setConfirmedDialogOrder] = useState<ServerOrder | null>(null);
  const [starting, setStarting] = useState(false);

  // 5s cached fallback tick: the board re-reads orders + jobs from Postgres
  // every 5s so the schedule never goes stale; the SSE stream still updates
  // the board immediately on every server change.
  const refreshBoard = useCallback((jobs?: ServerProductionJob[], orders?: ServerOrder[]) => {
    if (orders) {
      setOrderOrders(orders);
    }
    if (jobs) {
      setJobs(jobs || []);
      jobsRef.current = jobs || [];
    }
  }, []);
  useEffect(() => { void refreshBoard(); }, [refreshBoard]);
  useLiveRefresh(refreshBoard);
  useProductionBoardCache(refreshBoard);

  // Job self-healing is handled server-side by GET /production/jobs (reconcile);
  // avoid client-side serial create calls on load, which slow reload/actions.

  const getStationForOrder = (order: ServerOrder): "confirmed" | "baking" | "decorating" | "ready" | null => {
    const status = String(order.status || "").toUpperCase();
    const station = (order as any).station;
    const job = jobs.find((j: any) => j.orderId === order.id || j.orderId === order.orderNumber);
    const jobStatus = String(job?.status || "").toUpperCase();
    // Orders handed over to fulfilment (In Transit / Delivered / Cancelled)
    // leave the production board entirely.
    if (status === "IN_TRANSIT" || status === "COMPLETED_DELIVERED" || status === "CANCELLED") {
      return null;
    }
    if (status === "AWAITING_CONFIRMATION" || status === "PENDING_CONFIRMATION") {
      return null;
    }
    if (status === "AWAITING_COLLECTION") {
      return "ready";
    }
    // Job has finished production and is moving through decoration/quality — show in Decorating,
    // even if order/job status would otherwise resolve to Ready.
    if (
      jobStatus === "READY_FOR_QUALITY" || jobStatus === "QUALITY_CHECK" || jobStatus === "REWORK_REQUIRED" ||
      jobStatus === "DECORATING" || jobStatus === "READY_FOR_DECORATION" || jobStatus === "IN_DECORATION" ||
      station === "decorating"
    ) {
      return "decorating";
    }
    if (status === "READY_FOR_DELIVERY" || jobStatus === "READY_FOR_DELIVERY" || jobStatus === "COMPLETED" || station === "done") {
      return "ready";
    }
    if (jobStatus === "IN_PRODUCTION" || status === "IN_PRODUCTION" || station === "baking") {
      return "baking";
    }
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
    const status = String(order.status || "").toUpperCase().replace(/\s+/g, "_");
    const isAwaitingPickup = status === "AWAITING_COLLECTION" || status === "AWAITING_PICKUP";
    // Schedule cards are display-only.
    const isClickable = false;
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
          cursor: "default" as const,
          boxShadow: "0 0 0 1px rgba(194,112,58,0.3)",
        }
      : orderCardStyle(station, isClickable);
    return (
      <div key={order.id} className="order-card" style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
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
      const res = await withActionTimeout(startProductionForOrder(confirmedDialogOrder.id), 20000, "Start production");
      if (res) {
        setConfirmedDialogOrder(null);
        // Optimistic: the board re-reads the affected orders from listOrders on
        // the next live-driven / fallback refresh, before the next SSE event.
        void refreshBoard();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setStarting(false);
    }
  };

  const uiMatchConfirmed = confirmedDialogOrder ? ((uiOrders as any[])?.find((o: any) => o.id === confirmedDialogOrder.orderNumber || o.id === confirmedDialogOrder.id)) : null;
  const customerDisplayConfirmed = uiMatchConfirmed?.customer || confirmedDialogOrder?.customerId || "—";

  const showCardSkeletons = boardLoading && !loaded;
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px" }}>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Confirmed</h3>
          {showCardSkeletons ? <ColumnCardSkeletons count={2} /> : (<>
            {confirmedOrders.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No orders</p>}
            {confirmedOrders.map((o) => renderOrderCard(o, "confirmed"))}
          </>)}
        </div>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Baking Station</h3>
          {showCardSkeletons ? <ColumnCardSkeletons count={2} /> : (<>
            {bakingOrders.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No orders</p>}
            {bakingOrders.map((o) => renderOrderCard(o, "baking"))}
          </>)}
        </div>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Decorating Station</h3>
          {showCardSkeletons ? <ColumnCardSkeletons count={2} /> : (<>
            {decoratingOrders.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No orders</p>}
            {decoratingOrders.map((o) => renderOrderCard(o, "decorating"))}
          </>)}
        </div>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Ready</h3>
          {showCardSkeletons ? <ColumnCardSkeletons count={2} /> : (<>
            {readyOrders.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No orders</p>}
            {readyOrders.map((o) => renderOrderCard(o, "ready"))}
          </>)}
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
  const [loaded, setLoaded] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [serverOrders, setServerOrders] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [productionJob, setProductionJob] = useState<any | null>(null);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [consumption, setConsumption] = useState<any[]>([]);
  const [materialEntries, setMaterialEntries] = useState<Array<{ itemId: string; quantity: number; notes: string }>>([{ itemId: "", quantity: 0, notes: "" }]);
  const [busyAction, setBusyAction] = useState(false);

  // 5s cached fallback tick: the board re-reads jobs + orders from Postgres
  // every 5s so it never goes stale between mutations. The SSE stream still
  // drives a synchronous refresh on every server change.
  const refreshBoard = useCallback((js?: ServerProductionJob[], os?: ServerOrder[]) => {
    if (js) {
      setJobs(js || []);
    }
    if (os) {
      setServerOrders(os || []);
    }
  }, []);
  useEffect(() => { void refreshBoard(); }, [refreshBoard]);
  useLiveRefresh(refreshBoard);
  useProductionBoardCache(refreshBoard);

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
      const res = await withActionTimeout(startProductionJob(jobId), 20000, "Start production");
      if (res) {
        // Optimistic: the job card re-reads the affected job and the board
        // re-reads orders affected by the job's status transition on the
        // next live-driven / fallback refresh, before the next SSE event.
        void refreshJob();
        void refreshBoard();
      }
      else if (onNotice) onNotice("Failed to start production");
    } catch (e) {
      console.error(e);
      if (onNotice) onNotice(e instanceof Error ? e.message : "Failed to start production");
    } finally {
      setBusyAction(false);
    }
  };

  const handleCompleteJob = async () => {
    const jobId = productionJob?.id || selectedJob?.id;
    if (!jobId) return;
    setBusyAction(true);
    try {
      const res = await withActionTimeout(completeProductionJob(jobId), 20000, "Mark complete");
      if (res) {
        // Optimistic: the job card re-reads the affected job and the board
        // re-reads orders affected by the job's status transition on the
        // next live-driven / fallback refresh, before the next SSE event.
        void refreshJob();
        void refreshBoard();
      }
      else if (onNotice) onNotice("Failed to mark production complete");
    } catch (e) {
      console.error(e);
      if (onNotice) onNotice(e instanceof Error ? e.message : "Failed to mark production complete");
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
      if (res) {
        // Optimistic: the job card re-reads the affected job and the board
        // re-reads orders affected by the material entry on the next live-driven
        // / fallback refresh, before the next SSE event.
        void refreshJob();
        void refreshBoard();
        setMaterialEntries([{ itemId: "", quantity: 0, notes: "" }]);
      }
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
      if (res) {
        // Optimistic: the job card re-reads the affected job and the board
        // re-reads orders affected by the quality transition on the next
        // live-driven / fallback refresh, before the next SSE event.
        void refreshJob();
        void refreshBoard();
      }
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
      if (res) {
        // Optimistic: the job card re-reads the affected job and the board
        // re-reads orders affected by the quality transition on the next
        // live-driven / fallback refresh, before the next SSE event.
        void refreshJob();
        void refreshBoard();
      }
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
        // Optimistic: the job/order card re-reads the affected job and the
        // board re-reads orders affected by the status transition on the next
        // live-driven / fallback refresh, before the next SSE event.
        void refreshJob();
        void refreshBoard();
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
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
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

  const showCardSkeletons = boardLoading && !loaded;
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px" }}>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Queued</h3>
          {showCardSkeletons ? <ColumnCardSkeletons count={2} /> : (<>
            {queuedJobs.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No jobs</p>}
            {queuedJobs.map((j) => renderJobCard(j, "queued"))}
          </>)}
        </div>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Baking</h3>
          {showCardSkeletons ? <ColumnCardSkeletons count={2} /> : (<>
            {bakingJobs.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No jobs</p>}
            {bakingJobs.map((j) => renderJobCard(j, "baking"))}
          </>)}
        </div>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Decorating</h3>
          {showCardSkeletons ? <ColumnCardSkeletons count={2} /> : (<>
            {decoratingJobs.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No jobs</p>}
            {decoratingJobs.map((j) => renderJobCard(j, "decorating"))}
          </>)}
        </div>
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 600 }}>Ready</h3>
          {showCardSkeletons ? <ColumnCardSkeletons count={2} /> : (<>
            {readyJobs.length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>No jobs</p>}
            {readyJobs.map((j) => renderJobCard(j, "ready"))}
          </>)}
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
                  <select className="input flex-1" value={m.itemId} onChange={e => { const next = [...materialEntries]; next[idx] = { itemId: e.target.value, quantity: next[idx]?.quantity ?? 0, notes: next[idx]?.notes ?? '' }; setMaterialEntries(next); }}>
                    <option value="">Select item...</option>
                    {inventoryItems.map((it: any) => <option key={it.id} value={it.id}>{it.name} - {it.physicalStock} {it.unit}</option>)}
                  </select>
                  <input className="input w-24" type="number" placeholder="Qty" value={m.quantity || ''} onChange={e => { const next = [...materialEntries]; next[idx] = { itemId: next[idx]?.itemId ?? '', quantity: Number(e.target.value), notes: next[idx]?.notes ?? '' }; setMaterialEntries(next); }} />
                  <input className="input flex-1" placeholder="Notes" value={m.notes} onChange={e => { const next = [...materialEntries]; next[idx] = { itemId: next[idx]?.itemId ?? '', quantity: next[idx]?.quantity ?? 0, notes: e.target.value }; setMaterialEntries(next); }} />
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
