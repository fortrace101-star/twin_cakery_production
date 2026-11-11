import { money, type Order } from "./data";
import { ORDER_STAGE_PIPELINE, orderStageIndex } from "@/lib/theme-tokens";
import { tone } from "./data";
import { StatusBadge as Status } from "../data-table/StatusBadge";

function formatDueDate(dateStr: string, timeStr?: string): { label: string; urgency: "overdue" | "today" | "soon" | "none" } {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return { label: [dateStr, timeStr].filter(Boolean).join(" · ") || "—", urgency: "none" };
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  const weekday = due.toLocaleDateString("en-GB", { weekday: "short" });
  const dayMonth = due.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  let prefix = `${weekday} ${dayMonth}`;
  if (diffDays === 0) prefix = "Today";
  else if (diffDays === 1) prefix = "Tomorrow";
  else if (diffDays === -1) prefix = "Yesterday";

  const label = [prefix, timeStr].filter(Boolean).join(" · ");
  let urgency: "overdue" | "today" | "soon" | "none" = "none";
  if (diffDays < 0) urgency = "overdue";
  else if (diffDays === 0) urgency = "today";
  else if (diffDays <= 2) urgency = "soon";
  return { label, urgency };
}

export function OrderProgressBar({ status }: { status: string }) {
  const current = orderStageIndex(status);
  const t = tone(status);
  if (current < 0) return null;
  return (
    <div className={`order-progress-bar tone-${t}`} aria-label={`Order progress: step ${current + 1} of ${ORDER_STAGE_PIPELINE.length}`}>
      {ORDER_STAGE_PIPELINE.map((stage, i) => (
        <span
          key={stage}
          className={i < current ? "is-done" : i === current ? "is-current" : "is-ahead"}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function OrderMobileCard({ order, index = 0, showStatusBadge = true }: { order: Order; index?: number; showStatusBadge?: boolean }) {
  const t = tone(order.status);
  const paid = order.paidAmount ?? 0;
  const balance = Math.max(0, (order.amount ?? 0) - paid);
  const due = formatDueDate(order.date, order.time);
  const productLine = [order.product, ...(order.options || "").split(" · ").map((s) => s.trim()).filter(Boolean).slice(0, 2)]
    .filter(Boolean)
    .join(" · ");
  const dueClass = due.urgency === "overdue" || due.urgency === "today" ? "is-urgent" : "";
  const initials = order.initials || (order.customer || "?").slice(0, 2).toUpperCase();

  return (
    <div className={`order-mobile-card tone-${t}`}>
      <div className="omc-accent" aria-hidden="true" />
      <div className="omc-content">
        <div className="omc-row omc-top">
          <span className="omc-customer">
            <span className={`customer-avatar avatar-${index % 4}`}>{initials}</span>
            <span className="omc-customer-text">
              <strong className="omc-name">{order.customer}</strong>
              <small className="omc-id">#{order.id}</small>
            </span>
          </span>
          <span className="omc-amount">
            <strong>{money(order.amount)}</strong>
            {paid > 0 && <small className={balance > 0 ? "omc-paid is-due" : "omc-paid"}>({money(paid)} paid)</small>}
          </span>
        </div>
        <div className="omc-row omc-product"><span>{productLine || "—"}</span></div>
        <div className="omc-row omc-meta">
          <span className={`omc-due ${dueClass}`}>{due.label}</span>
          <span className="omc-delivery">{order.delivery || "—"}</span>
        </div>
        {showStatusBadge && (
          <div className="omc-row omc-badges">
            <Status value={order.status} />
            <Status value={order.payment} />
          </div>
        )}
        <OrderProgressBar status={order.status} />
      </div>
    </div>
  );
}
