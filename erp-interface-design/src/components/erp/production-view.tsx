import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveRefresh } from "@/lib/live";
import { useIsMobile } from "@/hooks/use-mobile";
import { StageTabs } from "./stage-tabs";
import type { ServerOrder } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StatusBadge as Status } from "@/components/data-table/StatusBadge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";

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
  readyProductionJob,
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

function OrderDetailContent({
  confirmedDialogOrder,
  customerDisplayConfirmed,
  starting,
  connected,
  onNotice,
  confirmedJobId,
}: {
  confirmedDialogOrder: ServerOrder | null;
  customerDisplayConfirmed: string;
  starting: boolean;
  connected: boolean;
  onNotice: (s: string) => void;
  confirmedJobId?: string;
}) {
  if (onNotice == null) onNotice = (() => {}) as (s: string) => void;
  // Consumption is attached to the *job* the confirmed order drives, so read
  // its rows from the resolved job id supplied by BakeryStation.
  const confirmedJobIdLocal = confirmedJobId ?? undefined;
  const [materialEntries, setMaterialEntries] = useState<Array<{ itemId: string; quantity: number; notes: string }>>([
    { itemId: "", quantity: 0, notes: "" },
  ]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [consumption, setConsumption] = useState<any[]>([]);
  const [busyAction, setBusyAction] = useState(false);

  // Consumption is attached to the *job* the confirmed order drives, so read
  // its rows from the prop supplied by BakeryStation (resolved from jobsRef).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const items = await listInventoryItems();
        if (alive) setInventoryItems(items || []);
      } catch {
        if (alive) setInventoryItems([]);
      }
      try {
        const cons = confirmedJobIdLocal ? await getProductionConsumption(confirmedJobIdLocal) : [];
        if (alive) setConsumption(cons || []);
      } catch {
        if (alive) setConsumption([]);
      }
    })();
    return () => { alive = false; };
  }, [confirmedJobId]);

  async function handleRecordMaterials() {
    const items = materialEntries.filter(m => m.itemId && Number(m.quantity) > 0).map(m => ({ itemId: m.itemId, quantity: Number(m.quantity), notes: m.notes || '' }));
    if (items.length === 0) { if (onNotice) onNotice('Add at least one material with quantity'); return; }
    setBusyAction(true);
    try {
      const res = await recordJobMaterials(confirmedDialogOrder?.id || '', items);
      if (res) {
        if (onNotice) onNotice('Materials recorded and inventory updated');
        setMaterialEntries([{ itemId: "", quantity: 0, notes: "" }]);
        const cons = await getProductionConsumption(confirmedDialogOrder?.id || '');
        setConsumption(cons || []);
      } else if (onNotice) onNotice('Failed to record materials');
    } finally {
      setBusyAction(false);
    }
  }

  const formatMoney = (v: unknown) => {
    if (typeof v === "number") return v.toLocaleString("en-UG");
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n.toLocaleString("en-UG") : v;
    }
    return v;
  };

  const noteText = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (v === null || v === undefined) return "";
    return String(v);
  };

  return (
    <div className="order-detail-dialog">
      {/* Summary */}
      <div className="configuration-list">
        <p><span>Customer</span><strong>{customerDisplayConfirmed}</strong></p>
        <p><span>Order ID</span><strong>{confirmedDialogOrder?.orderNumber}</strong></p>
        <p><span>Status</span><strong>{String(confirmedDialogOrder?.status ?? "—")}</strong></p>
        <p><span>Notes</span><strong>{noteText(confirmedDialogOrder?.notes)}</strong></p>
        <p><span>Total</span><strong>{String(confirmedDialogOrder?.total ?? "—")}</strong></p>
      </div>

      {/* Materials section — job materials entry + recorded consumption, same on PC and Mobile */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold mb-2">Materials / Ingredients Used</h3>

        {consumption.length === 0 ? (
          <p className="text-xs text-muted-foreground mb-2">No materials recorded yet.</p>
        ) : (
          <div className="space-y-1 mb-2">
            {consumption.map(c => {
              const item = inventoryItems.find(it => it.id === c.itemId);
              const name = item?.name || c.itemId;
              return (
                <div key={c.id} className="flex justify-between text-xs">
                  <span>{name} × {Number(c.quantity).toLocaleString()} {c.unit}</span>
                  <span className="text-muted-foreground">{c.notes || ""}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-2 space-y-2">
          {materialEntries.map((m, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select className="input flex-1" value={m.itemId} onChange={e => {
                const next = [...materialEntries];
                next[idx] = { itemId: e.target.value, quantity: next[idx]?.quantity ?? 0, notes: next[idx]?.notes ?? '' };
                setMaterialEntries(next);
              }}>
                <option value="">Select item...</option>
                {inventoryItems.map(it => (
                  <option key={it.id} value={it.id}>{it.name} - {Number(it.physicalStock || 0).toLocaleString()} {it.unit}</option>
                ))}
              </select>
              <input className="input w-24" type="number" placeholder="Qty" value={m.quantity || ''} onChange={e => {
                const next = [...materialEntries];
                next[idx] = { itemId: next[idx]?.itemId ?? '', quantity: Number(e.target.value), notes: next[idx]?.notes ?? '' };
                setMaterialEntries(next);
              }} />
              <input className="input flex-1" placeholder="Notes" value={m.notes} onChange={e => {
                const next = [...materialEntries];
                next[idx] = { itemId: next[idx]?.itemId ?? '', quantity: next[idx]?.quantity ?? 0, notes: e.target.value };
                setMaterialEntries(next);
              }} />
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMaterialEntries([...materialEntries, { itemId: "", quantity: 0, notes: "" }])}>Add Row</Button>
            <Button size="sm" onClick={handleRecordMaterials} disabled={busyAction || !connected}>Record Items Used</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BakeryStation({ onSelect, onNotice }: { onSelect?: (order: any) => void; onNotice?: (s: string) => void } = {}) {
  const { connected, orders: uiOrders } = useWorkspace();
  const handleNotice = (m: string) => onNotice?.(m);
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
  const isMobile = useIsMobile();
  const [scheduleStage, setScheduleStage] = useState("confirmed");

  // 5s cached fallback tick: the board re-reads orders + jobs from Postgres
  // every 5s so the schedule never goes stale; the SSE stream still updates
  // the board immediately on every server change.
  const refreshBoard = useCallback(async (jobsArg?: ServerProductionJob[], ordersArg?: ServerOrder[]) => {
    try {
      let nextJobs = jobsArg;
      let nextOrders = ordersArg;
      if (nextJobs === undefined || nextOrders === undefined) {
        const [fetchedJobs, fetchedOrders] = await Promise.all([
          listProductionJobs(),
          listOrders(),
        ]);
        if (nextJobs === undefined) nextJobs = fetchedJobs;
        if (nextOrders === undefined) nextOrders = fetchedOrders;
      }
      setOrderOrders(nextOrders || []);
      setJobs(nextJobs || []);
      jobsRef.current = nextJobs || [];
    } catch (e) {
      console.error("Failed to load production schedule:", e);
    } finally {
      setLoaded(true);
      setBoardLoading(false);
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
    // Orders reaching Ready for delivery leave the station board for baking and
    // decoration, and only enter the ready station once delivery/pickup is due.
    if (
      jobStatus !== "READY_FOR_DELIVERY" && (
        jobStatus === "READY_FOR_DECORATION" || jobStatus === "DECORATING" || jobStatus === "IN_DECORATION" ||          jobStatus === "READY_FOR_QUALITY" || jobStatus === "QUALITY_CHECK" || jobStatus === "REWORK_REQUIRED" ||
        station === "decorating"
      )
    ) {
      return "decorating";
    }
    if (
      status === "READY_FOR_DELIVERY" || status === "READY" || jobStatus === "READY_FOR_DELIVERY" || jobStatus === "READY" || jobStatus === "COMPLETED" || jobStatus === "COMPLETE" || station === "done" || station === "ready"
    ) {
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

  const handleOpenOrder = (order: ServerOrder) => {
    if (!isMobile) return;
    setConfirmedDialogOrder(order);
  };

  const renderOrderCard = (order: ServerOrder, station: "confirmed" | "baking" | "decorating" | "ready") => {
    const status = String(order.status || "").toUpperCase().replace(/\s+/g, "_");
    const isAwaitingPickup = status === "AWAITING_COLLECTION" || status === "AWAITING_PICKUP";
    // Schedule cards are display-only on desktop; on mobile the card tap
    // opens the order detail drawer (PC uses the modal Dialog).
    const isClickable = isMobile;
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
      <div
        key={order.id}
        className={`order-card ${isAwaitingPickup ? "u-awaiting-pickup" : ""}`}
        style={cardStyle}
        onClick={() => handleOpenOrder(order)}
        role="button"
        tabIndex={isClickable ? 0 : -1}
      >
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <strong>{order.orderNumber}</strong>
          {badgeValue ? <Status value={badgeValue} /> : null}
        </div>
        <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginBottom: "6px" }}>{customerDisplay}</div>
        <div style={{ fontSize: "12px", marginBottom: "6px" }}>{order.notes || "—"}</div>

      </div>
    );
  };

  // The confirmed order carries an order id, not the job id directly, so the
  // matching production job resolves from the same board refresh that feeds the
  // schedule cards. A live job status drives which action this order wants.
  const confirmedJob = jobsRef.current.find(
    (j: any) => j.orderId === confirmedDialogOrder?.orderNumber || j.id === confirmedDialogOrder?.id
  );
  const confirmedJobId = confirmedJob?.id;
  const confirmedJobStatus = (confirmedJob?.status || "").toUpperCase();
  const getActionLabel = (): string => {
    if (confirmedJobStatus === "IN_PRODUCTION") return "Mark Production Complete";
    if (confirmedJobStatus === "READY_FOR_DELIVERY" || confirmedJobStatus === "COMPLETED") {
      return "Mark as Awaiting Pickup";
    }
    return "Start Production";
  };

  const getActionOnClick = (): (() => void) => {
    return () => void handleStartProductionFromConfirmed();
  };

  const handleStartProductionFromConfirmed = async () => {
    if (!confirmedDialogOrder || !connected) return;
    setStarting(true);
    try {
      if (confirmedJobStatus === "IN_PRODUCTION") {
        await completeProductionJob(confirmedJob.id);
      } else if (confirmedJobStatus === "READY_FOR_DELIVERY" || confirmedJobStatus === "COMPLETED") {
        // Await pickup moves the order off the production board via the order
        // status (server contract: AWAITING_PICKUP → AWAITING_COLLECTION), not the job.
        await updateOrderApi(confirmedDialogOrder.id, { status: "AWAITING_COLLECTION" });
      } else {
        await startProductionForOrder(confirmedDialogOrder.id);
      }
      setConfirmedDialogOrder(null);
      // Optimistic: the board re-reads the affected orders/jobs from listOrders
      // on the next live-driven / fallback refresh, before the next SSE event.
      void refreshBoard();
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
      {(() => {
        const scheduleStages = [
          { id: "confirmed", label: "Confirmed", count: confirmedOrders.length, items: confirmedOrders, render: (o: ServerOrder) => renderOrderCard(o, "confirmed") },
          { id: "baking", label: "Baking Station", count: bakingOrders.length, items: bakingOrders, render: (o: ServerOrder) => renderOrderCard(o, "baking") },
          { id: "decorating", label: "Decorating Station", count: decoratingOrders.length, items: decoratingOrders, render: (o: ServerOrder) => renderOrderCard(o, "decorating") },
          { id: "ready", label: "Ready", count: readyOrders.length, items: readyOrders, render: (o: ServerOrder) => renderOrderCard(o, "ready") },
        ];
        const activeSchedule = scheduleStages.some(st => st.id === scheduleStage && st.count > 0) ? scheduleStage : (scheduleStages.find(st => st.count > 0)?.id || "confirmed");
        return (<>
          {isMobile && <StageTabs stages={scheduleStages.map(st => ({id:st.id,label:st.label,count:st.count}))} active={activeSchedule} onChange={setScheduleStage} />}
          <div className="station-board">
            {scheduleStages.map(st => {
              const items = showCardSkeletons ? [] : (st.items.length === 0 ? [] : st.items);
              const empty = showCardSkeletons ? false : (st.items.length === 0);
              return (
                <div key={st.id} data-stage={st.id} data-station-section data-station-section-active={!isMobile || activeSchedule===st.id ? true : undefined}>
                  <h3 className="board-col-title">{st.label} <span className="inline-count">{st.count}</span></h3>
                  {showCardSkeletons ? <ColumnCardSkeletons count={2} /> : (<>
                    {empty && <p className="board-empty">No orders</p>}
                    {items.map(st.render)}
                  </>)}
                </div>
              );
            })}
          </div>
        </>);
      })()}
      <>
        {isMobile ? (
          <Drawer open={!!confirmedDialogOrder} onOpenChange={(v) => { if (!v) setConfirmedDialogOrder(null); }}>
            <DrawerContent className="order-detail-dialog">
              <DrawerTitle>{confirmedDialogOrder?.orderNumber}</DrawerTitle>
              <DrawerDescription>Order details</DrawerDescription>
              <OrderDetailContent
                confirmedDialogOrder={confirmedDialogOrder}
                customerDisplayConfirmed={customerDisplayConfirmed}
                starting={starting}
                connected={connected}
                confirmedJobId={confirmedJobId}
                onNotice={handleNotice}
              />              <div className="dialog-actions">
                <Button onClick={() => void handleStartProductionFromConfirmed()} disabled={starting || !connected}>{getActionLabel()}</Button>
                <Button variant="ghost" onClick={() => setConfirmedDialogOrder(null)}>Cancel</Button>
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={!!confirmedDialogOrder} onOpenChange={(v) => { if (!v) setConfirmedDialogOrder(null); }}>
            <DialogContent className="order-detail-dialog">
              <DialogTitle>{confirmedDialogOrder?.orderNumber}</DialogTitle>
              <DialogDescription>Order details</DialogDescription>
              <OrderDetailContent
                confirmedDialogOrder={confirmedDialogOrder}
                customerDisplayConfirmed={customerDisplayConfirmed}
                starting={starting}
                connected={connected}
                confirmedJobId={confirmedJobId}
                onNotice={handleNotice}
              />
              <div className="dialog-actions">
                <Button onClick={() => void handleStartProductionFromConfirmed()} disabled={starting || !connected}>{getActionLabel()}</Button>
                <Button variant="ghost" onClick={() => setConfirmedDialogOrder(null)}>Cancel</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}</>
    </div>
  );
}

export function JobsBoard({ onSelect, onNotice }: { onSelect?: (job: any) => void; onNotice?: (s: string) => void } = {}) {
  const { connected, orders: uiOrders } = useWorkspace();
  const handleNotice = (m: string) => onNotice?.(m);
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
  const isMobile = useIsMobile();
  const [jobsStage, setJobsStage] = useState("queued");

  // 5s cached fallback tick: the board re-reads jobs + orders from Postgres
  // every 5s so it never goes stale between mutations. The SSE stream still
  // drives a synchronous refresh on every server change.
  const refreshBoard = useCallback(async (js?: ServerProductionJob[], os?: ServerOrder[]) => {
    try {
      let nextJobs = js;
      let nextOrders = os;
      if (nextJobs === undefined || nextOrders === undefined) {
        const [fetchedJobs, fetchedOrders] = await Promise.all([
          listProductionJobs(),
          listOrders(),
        ]);
        if (nextJobs === undefined) nextJobs = fetchedJobs;
        if (nextOrders === undefined) nextOrders = fetchedOrders;
      }
      setJobs(nextJobs || []);
      setServerOrders(nextOrders || []);
    } catch (e) {
      console.error("Failed to load jobs board:", e);
    } finally {
      setLoaded(true);
      setBoardLoading(false);
    }
  }, []);
  useEffect(() => { void refreshBoard(); }, [refreshBoard]);
  useLiveRefresh(refreshBoard);
  useProductionBoardCache(refreshBoard);

  const getColumnForJob = (job: any): "queued" | "baking" | "decorating" | "ready" | null => {
    const status = String(job?.status || "").toUpperCase();
    // An order marked Ready leaves the decorating column even if its job
    // row still carries a decorating/quality status.
    const linkedOrder = serverOrders.find((o: any) => o.id === job?.orderId || o.orderNumber === job?.orderId);
    const orderStatus = String(linkedOrder?.status || "").toUpperCase();
    if (orderStatus === "READY_FOR_DELIVERY" || orderStatus === "READY" || orderStatus === "AWAITING_COLLECTION") {
      return "ready";
    }
    if (status === "COMPLETED" || status === "COMPLETE") {
      return "ready";
    }
    if (status === "IN_PRODUCTION") {
      return "baking";
    }
    // DECORATING is the status the server sets when baking completes; the
    // READY_FOR_* names are the older decorating/quality spellings.
    if (
      status === "DECORATING" ||
      status === "IN_DECORATION" ||
      status === "READY_FOR_DECORATION" ||
      status === "READY_FOR_QUALITY" ||
      status === "QUALITY_CHECK" ||
      status === "REWORK_REQUIRED"
    ) {
      return "decorating";
    }
    if (status === "PENDING" || status === "SCHEDULED" || status === "READY_FOR_PRODUCTION") {
      return "queued";
    }
    if (status === "READY_FOR_DELIVERY" || status === "READY") {
      return "ready";
    }
    // DONE is finished goods (stock jobs) or a job the server parked there.
    // Never call it Queued: while its order is still in production the job
    // belongs beside that order, otherwise it is finished.
    if (status === "DONE") {
      if (!linkedOrder) return "ready";
      if (orderStatus === "IN_PRODUCTION" || orderStatus === "PRODUCTION_REVIEW") return "baking";
      return "ready";
    }
    // Cancelled jobs are known but belong to no column on the board.
    if (status === "CANCELLED") return null;
    // Any other unknown status is a data problem, not a queued job — leave it
    // out of the columns and surface it in the "needs attention" notice.
    return null;
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
  // Jobs whose status no column recognises: shown as a notice, never as Queued.
  const unattachedJobs = jobs.filter((j) =>
    getColumnForJob(j) === null && !orderLeftProduction(j) && String(j.status || "").toUpperCase() !== "CANCELLED",
  );

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

  /** §1 — Single "Set to Ready" guard (decorating jobs). Forwards to
   * POST /jobs/:id/ready, which requires the production.set_ready permission
   * (added in migration 024). Decorating jobs roll to READY_FOR_DELIVERY;
   * produce jobs are not affected by this guard and complete via Mark Production Complete. */
  const handleSetToReady = async () => {
    const jobId = productionJob?.id || selectedJob?.id;
    if (!jobId) return;
    setBusyAction(true);
    try {
      const res = await withActionTimeout(readyProductionJob(jobId), 20000, "Set to Ready");
      if (res) {
        void refreshJob();
        void refreshBoard();
        if (onNotice) onNotice("Job marked ready for delivery");
      } else if (onNotice) onNotice("Failed to set to ready");
    } catch (e) {
      console.error(e);
      if (onNotice) onNotice(e instanceof Error ? e.message : "Error setting to ready");
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
  // Every status the job dialog can act on; anything else shows a message
  // instead of an empty footer.
  const jobHasAction = ['PENDING', 'SCHEDULED', 'READY_FOR_PRODUCTION', 'IN_PRODUCTION', 'DECORATING', 'READY_FOR_DELIVERY', 'COMPLETED']
    .includes(String(jobToShow?.status || '').toUpperCase());

  const showCardSkeletons = boardLoading && !loaded;
  return (
    <div style={{ padding: "16px" }}>
      {(() => {
        const jobStages = [
          { id: "queued", label: "Queued", count: queuedJobs.length, items: queuedJobs, render: (j: any) => renderJobCard(j, "queued") },
          { id: "baking", label: "Baking", count: bakingJobs.length, items: bakingJobs, render: (j: any) => renderJobCard(j, "baking") },
          { id: "decorating", label: "Decorating", count: decoratingJobs.length, items: decoratingJobs, render: (j: any) => renderJobCard(j, "decorating") },
          { id: "ready", label: "Ready", count: readyJobs.length, items: readyJobs, render: (j: any) => renderJobCard(j, "ready") },
        ];
        const activeJobs = jobStages.some(st => st.id === jobsStage && st.count > 0) ? jobsStage : (jobStages.find(st => st.count > 0)?.id || "queued");
        return (<>
          {unattachedJobs.length > 0 && (
            <p className="board-empty" role="status">
              {unattachedJobs.length} job{unattachedJobs.length === 1 ? "" : "s"} with a status the board does not recognise
              {` (${[...new Set(unattachedJobs.map((j: any) => String(j.status || "unknown")))].join(", ")})`} — check it on the server.
            </p>
          )}
          {isMobile && <StageTabs stages={jobStages.map(st => ({id:st.id,label:st.label,count:st.count}))} active={activeJobs} onChange={setJobsStage} />}
          <div className="station-board">
            {jobStages.map(st => {
              const items = showCardSkeletons ? [] : (st.items.length === 0 ? [] : st.items);
              const empty = showCardSkeletons ? false : (st.items.length === 0);
              return (
                <div key={st.id} data-stage={st.id} data-station-section data-station-section-active={!isMobile || activeJobs===st.id ? true : undefined}>
                  <h3 className="board-col-title">{st.label} <span className="inline-count">{st.count}</span></h3>
                  {showCardSkeletons ? <ColumnCardSkeletons count={2} /> : (<>
                    {empty && <p className="board-empty">No jobs</p>}
                    {items.map(st.render)}
                  </>)}
                </div>
              );
            })}
          </div>
        </>);
      })()}
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
              {jobToShow?.status === 'DECORATING' && <Button size="sm" onClick={handleSetToReady} disabled={busyAction || !connected}>Set to Ready</Button>}
              {(jobToShow?.status === 'READY_FOR_DELIVERY' || jobToShow?.status === 'COMPLETED') && (<Button size="sm" onClick={handleMarkAwaitingPickup} disabled={busyAction || !connected}>Mark as Awaiting Pickup</Button>)}
              {jobToShow && !jobHasAction && (
                <p className="text-xs text-muted-foreground">
                  No action is available for status {String(jobToShow.status || "unknown").replace(/_/g, ' ')}. Check the job on the server.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
