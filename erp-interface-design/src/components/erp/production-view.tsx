import { useCallback, useEffect, useState } from "react";
import type { ServerOrder, PaymentMethod } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StatusBadge as Status } from "@/components/data-table/StatusBadge";
import { DataTable } from "@/components/data-table/DataTable";
import {
  listOrders,
  listProductionJobs,
  listInventoryItems,
  recordJobMaterials,
  listCustomers,
  listCatalogueProducts,
  updateOrderStation,
  createProductionJobForOrder,
  propagateBakingStatus,
  listPayments,
  recordPayment,
} from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { money } from "./data";
import { useWorkspace } from "@/components/erp/store";

// ── Small helpers (shared by the station board) ──────────────────────────────

type Station = 'pendingConfirm' | 'confirmed' | 'baking' | 'done';

type TransitionMap = Readonly<Record<Station, readonly Station[]>>;

const stationTransitions: TransitionMap = {
  pendingConfirm: ["confirmed"],
  // "Undo confirm" sends a confirmed order back one step.
  confirmed: ["baking", "pendingConfirm"],
  baking: ["done"],
  done: [],
};

function isValidTransition(current: Station | null | undefined, next: Station): boolean {
  return (stationTransitions[current ?? "pendingConfirm"] ?? []).includes(next);
}

function canTransitionTo(order: Readonly<ServerOrder>, next: Station): boolean {
  return order.station != null && isValidTransition(order.station, next);
}

// ── Local view state: active tab + per-order scratch notes ──────────────────

type JobTab = "active" | "confirmed" | "history";

function useJobTab(): [JobTab, (tab: JobTab) => void] {
  const [tab, setTab] = useState<JobTab>("active");
  const setJobTab = useCallback((next: JobTab) => setTab(next), []);
  return [tab, setJobTab];
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

// Used only to keep the refresh path fresh after a station transition.
function useForceUpdate(): () => void {
  const [, setTick] = useState<number>(0);
  return useCallback(() => setTick((t) => t + 1), []);
}

// ── ProductionView (thin wrapper; rendered by workspace.tsx) ────────────────

export function ProductionView() {
  return (
    <section className="panel module-table">
      <div className="panel-heading">
        <div>
          <h2>Production</h2>
          <p>Order station board</p>
        </div>
      </div>
      <BakeryStation />
    </section>
  );
}

// ── Bakery station board (order lifecycle: pendingConfirm → confirmed → baking → done) ──
// Confirmed is its own station: orders land in it when staff confirms them, and
// live there independently until they are explicitly moved to the next station.

export function BakeryStation() {
  const { connected } = useWorkspace();
  const [tab, setTab] = useJobTab();
  const { notes, setNotes, clearNotes } = useNotes();
  const [boardLoading, setBoardLoading] = useState(true);
  const [orderOrders, setOrderOrders] = useState<ServerOrder[]>([]);
  const [focusedOrder, setFocusedOrder] = useState<ServerOrder | null>(null);
  // Revenue dialog (task 2.2): opens pre-filled with the outstanding balance.
  const [revenueDialog, setRevenueDialog] = useState<{ order: ServerOrder; outstanding: number } | null>(null);
  const [revenueAmount, setRevenueAmount] = useState("");
  const [revenueMethod, setRevenueMethod] = useState<PaymentMethod>("Cash");
  const [recording, setRecording] = useState(false);

  const refreshBoard = useCallback(async () => {
    setBoardLoading(true);
    const [os] = await Promise.all([listOrders()]);
    setOrderOrders(os);
    setBoardLoading(false);
  }, []);
  useEffect(() => { void refreshBoard(); }, [refreshBoard]);

  const visible = filteredOrders(tab);

  return (
    <section className="panel module-table">
      <div className="panel-heading">
        <div>
          <h2>{tab === 'active' ? 'Active station board' : tab === 'confirmed' ? 'Confirmed orders' : 'Order history'}</h2>
          <p>{boardLoading ? 'Loading orders…' : `${visible.length} order${visible.length === 1 ? '' : 's'}`}</p>
        </div>
        <div className="panel-heading-actions">
          <button type="button" className={`tab-btn ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>Active</button>
          <button type="button" className={`tab-btn ${tab === 'confirmed' ? 'active' : ''}`} onClick={() => setTab('confirmed')}>Confirmed</button>
          <button type="button" className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
        </div>
      </div>
      <DataTable
        columns={[
          { header:'Order', cell:(o:ServerOrder) => <><strong className="product-name">{o.orderNumber}</strong><small className="cell-sub">{o.notes || '—'}</small></> },
          { header:'Customer', cell:(o:ServerOrder) => o.customerId },
          { header:'Station', cell:(o:ServerOrder) => <Status value={o.station ?? 'pendingConfirm'} /> },
          { header:'', cell:(o:ServerOrder) => (o.station === 'confirmed' && tab === 'confirmed') ? (
            <Button variant="outline" size="sm" onClick={() => void handleStationTransition(o.id, 'baking')}>Move to baking</Button>
          ) : (
            <div style={{ display:'flex', gap:'6px' }}>
              {o.station !== 'done' && tab === 'active' && (
                <>
                  {o.station === 'pendingConfirm' && (
                    <Button variant="outline" size="sm" onClick={() => void handleStationTransition(o.id, 'confirmed')}>Confirm</Button>
                  )}
                  {o.station === 'confirmed' && (
                    <Button variant="outline" size="sm" onClick={() => void handleStationTransition(o.id, 'baking')}>Start baking</Button>
                  )}
                </>
              )}
              {o.station === 'baking' && tab === 'active' && (
                <Button variant="outline" size="sm" onClick={() => void handleStationTransition(o.id, 'done')}>Complete</Button>
              )}
              {o.station === 'done' && o.paymentStatus !== 'PAID' && o.total > 0 && (
                <Button variant="default" size="sm" onClick={() => void openRevenueDialog(o)}>Record revenue & mark paid</Button>
              )}
              {o.station === 'confirmed' && tab === 'active' && (
                <Button variant="outline" size="sm" onClick={() => void handleStationTransition(o.id, 'pendingConfirm')}>Undo confirm</Button>
              )}
            </div>
          )},
          { header:'Notes', cell:(o:ServerOrder) => (
            <div style={{ display:'flex', gap:'6px', alignItems:'flex-start' }}>
              <textarea
                className="notes-input"
                value={notes[o.id] ?? ''}
                onChange={(e) => setNotes(o.id, e.target.value)}
                rows={2}
              />
              <Button variant="ghost" size="sm" onClick={() => clearNotes(o.id)} title="Clear notes">Clear</Button>
            </div>
          )},
        ]}
        rows={visible}
        rowKey={(o) => o.id}
      />
      <aside className="panel panel-side">
        {focusedOrder ? (
          <div className="side-block">
            <h3>Order details</h3>
            <p><strong>Order:</strong> {focusedOrder.orderNumber}</p>
            <p><strong>Customer:</strong> {focusedOrder.customerId}</p>
            <p><strong>Station:</strong> {focusedOrder.station ?? 'pendingConfirm'}</p>
            <p><strong>Notes:</strong></p>
            <textarea
              className="notes-input"
              value={notes[focusedOrder.id] ?? ''}
              onChange={(e) => setNotes(focusedOrder.id, e.target.value)}
              rows={6}
            />
            <div className="side-actions">
              <Button variant="outline" size="sm" onClick={() => setFocusedOrder(null)}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="side-block">
            <h3>Job materials</h3>
            <p>Select a production job to record materials.</p>
          </div>
        )}
      </aside>
      {revenueDialog && (
        <Dialog open onOpenChange={(v) => { if (!v && !recording) setRevenueDialog(null); }}>
          <DialogContent>
            <DialogTitle>Record revenue — {revenueDialog.order.orderNumber}</DialogTitle>
            <DialogDescription>
              Total {money(revenueDialog.order.total)} · still outstanding {money(revenueDialog.outstanding)}.
              Recording the outstanding balance flips the order to PAID; a smaller amount is a partial payment.
            </DialogDescription>
            <div style={{ display: "grid", gap: "8px" }}>
              <label>
                Revenue amount
                <Input
                  value={revenueAmount}
                  onChange={(e) => setRevenueAmount(e.target.value)}
                  inputMode="decimal"
                  aria-label="Revenue amount"
                />
              </label>
              <label>
                Payment method
                <select
                  value={revenueMethod}
                  onChange={(e) => setRevenueMethod(e.target.value as PaymentMethod)}
                  aria-label="Payment method"
                >
                  {["Cash", "M-Pesa", "Card", "Bank transfer", "Cheque"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" disabled={recording} onClick={() => setRevenueDialog(null)}>Cancel</Button>
              <Button
                size="sm"
                disabled={recording || Math.round(Number(revenueAmount) || 0) <= 0}
                onClick={() => void submitRevenue()}
              >
                {recording
                  ? "Recording…"
                  : Math.round(Number(revenueAmount) || 0) >= revenueDialog.outstanding
                    ? "Mark fully paid"
                    : "Record partial payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );

  // ── Derived helpers (inside BakeryStation so they can reach the live state) ──

  // Revenue CTA (docs: finance_production.md task 2.2). The dialog is opened
  // pre-filled with whatever is still outstanding — the ledger runs behind
  // GET /payments?orderId=…, so a fully-settled order never opens it and a
  // partial record can never overpay (server recomputes paymentStatus).
  async function openRevenueDialog(order: ServerOrder) {
    const payments = await listPayments(order.id);
    const outstanding = order.total - payments.reduce((sum, p) => sum + p.amount, 0);
    if (outstanding <= 0) return; // already settled (race-safe) — nothing to record
    setRevenueMethod("Cash");
    setRevenueAmount(String(Math.round(outstanding)));
    setRevenueDialog({ order, outstanding });
  }

  async function submitRevenue() {
    if (!revenueDialog || recording) return;
    const amount = Math.min(Math.max(0, Math.round(Number(revenueAmount) || 0)), revenueDialog.outstanding);
    if (amount <= 0) return;
    setRecording(true);
    const paid = await recordPayment({
      orderId: revenueDialog.order.id,
      amount,
      method: revenueMethod,
      // Compare numerically, not as strings: the input holds the *rounded*
      // prefill, so "50000" vs an outstanding of 49999.5 would mislabel a
      // full payment as partial. amount is already clamped to outstanding.
      notes: amount >= revenueDialog.outstanding
        ? "Recorded from production History (full balance)"
        : "Recorded from production History (partial balance)",
    });
    setRecording(false);
    if (paid === null) return; // safe() swallowed the failure — keep the dialog open
    setRevenueDialog(null);
    await refreshBoard();
  }

  function filteredOrders(currentTab: string): ServerOrder[] {
    if(currentTab === 'active') return orderOrders.filter(o => o.station !== 'done');
    if(currentTab === 'confirmed') return orderOrders.filter(o => o.station === 'confirmed');
    return orderOrders.filter(o => o.station === 'done');
  }

  async function handleStationTransition(orderId: string, next: Station) {
    const order = orderOrders.find(o => o.id === orderId);
    if(!order) return;
    if(!connected) { /* guard detected by caller. */ return; }
    if(!canTransitionTo(order, next)) return;
    setFocusedOrder(order);
    if(next === 'confirmed') {
      const created = await createProductionJobForOrder(order.id);
      if(created === null) { /* caller surfaces notice. */ return; }
    }
    const updated = await updateOrderStation(order.id, next);
    if(updated === null) { /* caller surfaces notice. */ return; }
    if(next === 'baking') {
      const prop = await propagateBakingStatus(order.id);
      if(prop === null) { /* caller surfaces notice. */ return; }
    }
    await refreshBoard();
  }
}