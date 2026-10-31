import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/lib/live";
import { Check, Eye, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge as Status } from "../data-table/StatusBadge";
import { money } from "./data";
import {
  cancelOrderProposal,
  confirmOrderProposal,
  getOrderProposal,
  listOrderProposals,
} from "@/lib/api";
import type { OrderProposal, OrderProposalStatus } from "@/lib/types";

const STATUS_FILTERS: Array<"All" | OrderProposalStatus> = [
  "All",
  "PENDING_REVIEW",
  "CONFIRMED",
  "CANCELLED",
];

function statusLabel(status: OrderProposalStatus): string {
  if (status === "PENDING_REVIEW") return "Pending review";
  if (status === "CONFIRMED") return "Confirmed";
  return "Cancelled";
}

function proposalTotal(p: OrderProposal): number {
  return p.items.reduce((n, i) => n + (Number(i.total) || 0), 0);
}

/**
 * E6 staff review queue: website order-form submissions land here as
 * PENDING_REVIEW. Confirm mints the INQUIRY-status order draft that enters
 * the normal confirm -> produce -> deliver pipeline; cancel records a note.
 * The public form never creates orders directly ("does not bypass Admin
 * confirmation").
 */
export function OrderProposalsView({ onNotice }: { onNotice: (s: string) => void }) {
  const [proposals, setProposals] = useState<OrderProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | OrderProposalStatus>("All");
  const [selected, setSelected] = useState<OrderProposal | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProposals(await listOrderProposals());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useLiveRefresh(refresh);

  const visible = proposals.filter((p) => {
    if (statusFilter !== "All" && p.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.proposalNumber.toLowerCase().includes(q) ||
      p.customerName.toLowerCase().includes(q) ||
      p.phone.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.productSummary.toLowerCase().includes(q)
    );
  });

  const pending = proposals.filter((p) => p.status === "PENDING_REVIEW").length;

  async function openDetail(id: string) {
    const detail = await getOrderProposal(id);
    if (!detail) {
      onNotice("Could not load that proposal");
      return;
    }
    setSelected(detail);
    setReviewNotes(detail.reviewNotes || "");
  }

  function closeDetail() {
    setSelected(null);
    setReviewNotes("");
    setBusy(false);
  }
  async function onConfirm() {
    if (!selected || busy) return;
    setBusy(true);
    const res = await confirmOrderProposal(selected.id, reviewNotes.trim() || undefined);
    setBusy(false);
    if (!res) {
      onNotice("Could not confirm - check your permissions");
      return;
    }
    onNotice(`Proposal ${res.proposal.proposalNumber} confirmed - order draft created`);
    closeDetail();
    void refresh();
  }

  async function onCancel() {
    if (!selected || busy) return;
    if (!reviewNotes.trim()) {
      onNotice("Add a review note explaining why this proposal is cancelled");
      return;
    }
    setBusy(true);
    const res = await cancelOrderProposal(selected.id, reviewNotes.trim());
    setBusy(false);
    if (!res) {
      onNotice("Could not cancel - check your permissions");
      return;
    }
    onNotice(`Proposal ${res.proposalNumber} cancelled`);
    closeDetail();
    void refresh();
  }

  return (
    <div className="space-y-4">
      <section className="panel module-table">
        <div className="panel-heading">
          <h2>
            Order proposals <span className="inline-count">{visible.length}</span>
          </h2>
          <span className="text-muted-foreground text-xs">
            {pending > 0
              ? `${pending} awaiting staff review - confirm into the order pipeline or cancel with a note`
              : "Website order-form submissions, reviewed before they enter the order pipeline"}
          </span>
        </div>
        <div className="table-controls">
          <label className="search-box">
            <Search size={16} />
            <input
              aria-label="Search proposals"
              placeholder="Search proposals, customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="filter-select">
            <SlidersHorizontal size={14} />
            <select
              aria-label="Filter proposals by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "All" | OrderProposalStatus)}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All statuses" : statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
        <div className="table-wrap">
          <table className="table data">
            <thead>
              <tr>
                <th>Proposal</th>
                <th>Customer</th>
                <th>Items</th>
                <th className="num">Total</th>
                <th>Preferred</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.proposalNumber}</strong>
                    <div className="cell-sub">{new Date(p.createdAt).toLocaleDateString("en-UG")}</div>
                  </td>
                  <td>
                    {p.customerName}
                    <div className="cell-sub">{p.phone}{p.email ? ` - ${p.email}` : ""}</div>
                  </td>
                  <td>
                    {p.productSummary || `${p.items.length} items`}
                    <div className="cell-sub">
                      {p.deliveryType}{p.deliveryLocation ? ` - ${p.deliveryLocation}` : ""}
                    </div>
                  </td>
                  <td className="num">{money(proposalTotal(p))}</td>
                  <td>{p.preferredDate ? new Date(p.preferredDate).toLocaleDateString("en-UG") : "-"}</td>
                  <td>
                    <Status value={statusLabel(p.status)} />
                  </td>
                  <td className="actions">
                    <Button variant="ghost" size="sm" onClick={() => void openDetail(p.id)}>
                      <Eye size={14} /> Review
                    </Button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    {loading ? "Loading proposals..." : "No proposals match"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>{visible.length} proposals</span>
          <span>October 2026</span>
        </div>
      </section>
      <Dialog open={selected !== null} onOpenChange={(v) => { if (!v) closeDetail(); }}>
        <DialogContent className="order-form-dialog">
          {selected && (
            <>
              <DialogTitle>Review {selected.proposalNumber}</DialogTitle>
              <DialogDescription>
                {selected.customerName} - {selected.phone}
                {selected.email ? ` - ${selected.email}` : ""} -{" "}
                {statusLabel(selected.status).toLowerCase()}
                {selected.orderId ? ` - order ${selected.orderId}` : ""}
              </DialogDescription>
              <div className="order-form-scroll">
                <div className="kpi-grid">
                  <div className="kpi">
                    <span className="kpi-label">Items</span>
                    <strong className="kpi-value">{selected.items.length}</strong>
                  </div>
                  <div className="kpi">
                    <span className="kpi-label">Total</span>
                    <strong className="kpi-value">{money(proposalTotal(selected))}</strong>
                  </div>
                  <div className="kpi">
                    <span className="kpi-label">Preferred date</span>
                    <strong className="kpi-value">
                      {selected.preferredDate
                        ? new Date(selected.preferredDate).toLocaleDateString("en-UG")
                        : "-"}
                    </strong>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="table data">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Options</th>
                        <th className="num">Qty</th>
                        <th className="num">Unit</th>
                        <th className="num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.items.map((i) => (
                        <tr key={i.id}>
                          <td>{i.productName}</td>
                          <td>{i.variantOptions || "-"}</td>
                          <td className="num">{i.quantity}</td>
                          <td className="num">{money(i.unitPrice)}</td>
                          <td className="num">{money(i.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selected.customerNotes && (
                  <p className="cell-sub">Customer notes: {selected.customerNotes}</p>
                )}
                {selected.deliveryLocation && (
                  <p className="cell-sub">Delivery: {selected.deliveryLocation}</p>
                )}
                {selected.status !== "PENDING_REVIEW" ? (
                  <p className="cell-sub">
                    Reviewed{selected.reviewedAt ? ` ${new Date(selected.reviewedAt).toLocaleString("en-UG")}` : ""}
                    {selected.reviewNotes ? ` - ${selected.reviewNotes}` : ""}
                  </p>
                ) : (
                  <div className="form-field">
                    <Label htmlFor="proposal-review-notes">Review notes</Label>
                    <Textarea
                      id="proposal-review-notes"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Confirm: handover note. Cancel: reason (required)."
                      rows={3}
                    />
                  </div>
                )}
              </div>
              <div className="dialog-actions">
                <Button variant="outline" onClick={closeDetail} disabled={busy}>
                  <X size={15} /> Close
                </Button>
                {selected.status === "PENDING_REVIEW" && (
                  <>
                    <Button variant="ghost" onClick={() => void onCancel()} disabled={busy}>
                      Cancel proposal
                    </Button>
                    <Button onClick={() => void onConfirm()} disabled={busy}>
                      <Check size={15} /> {busy ? "Working..." : "Confirm - create order"}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

