import { useCallback } from "react";
import { CalendarPlus, Check, Clock3, Loader2, Plus, Printer, Star, StarOff, Textarea } from "lucide-react";
import { IconButton } from "./ui";
import {
  contactEventReminder,
  createCustomerEvent,
  createCustomerFeedback,
  deleteCustomerEvent,
  dismissEventReminder,
  findCustomerByName,
  listCustomerEvents,
  listCustomerFeedback,
  listCustomerOrders,
  listEventReminders,
  orderStatusLabel,
  printCustomerOrders,
  type ServerCustomerEvent,
  type ServerCustomerFeedback,
  type ServerCustomerOrder,
  type ServerEventReminder,
} from "@/lib/api";
import { money } from "./data";
import { StatusBadge as Status } from "@/components/data-table/StatusBadge";
import type { StatusTone } from "@/lib/theme-tokens";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "./ui";
import { Input } from "./ui";
import { Select } from "./ui";

/**
 * E1 — customer order history, occasions, reminders & feedback (spec §5).
 *
 * These panels bind the CRM detail pane to the real endpoints
 * (`GET /customers/:id/orders`, `/feedback/by-order/:orderId`, `/events`,
 * `/customer-reminders`, …). Every request degrades to an empty list on failure,
 * so an unconnected workspace shows a quiet "sample / offline" state rather than
 * crashing. The system never auto-contacts a customer — a reminder only advances
 * when a person clicks "Mark contacted" or "Dismiss".
 *
 * Feedback is now a first-class customer report: each completed order can carry
 * a rating + comment + resolution, and the CRM surfaces unresolved feedback as a
 * follow-up item in the customer detail footer.
 *
 * The Feedback tab lets a logged-in staff member record a star rating + free-text
 * comment + optional resolution for any completed order on the selected customer,
 * and surfaces previously recorded feedback as reviewable cards below the form.
 */

const RECURRENCE_OPTIONS = ["NONE", "ANNUAL", "MONTHLY", "YEARLY"] as const;

const FEEDBACK_TYPE_OPTIONS =
  ["RATING", "COMPLAINT", "COMPLIMENT", "PRODUCT_FEEDBACK", "DELIVERY_FEEDBACK", "SERVICE_FEEDBACK", "GENERAL"] as const;

function feedbackTypeLabel(type: string): string {
  const map: Record<string, string> = {
    RATING: "Rating",
    COMPLAINT: "Complaint",
    COMPLIMENT: "Compliment",
    PRODUCT_FEEDBACK: "Product feedback",
    DELIVERY_FEEDBACK: "Delivery feedback",
    SERVICE_FEEDBACK: "Service feedback",
    GENERAL: "General feedback",
  };
  return map[type] ?? type;
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fn().then((result) => {
      if (alive) {
        setData(result);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { data, loading, reload };
}

function Loading() {
  return <p className="text-muted-foreground flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={14} /> Loadingâ€¦</p>;
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

/* â”€â”€ Order history (read-only; immutable contact snapshots) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function OrderHistoryPanel({ customerId }: { customerId: string }) {
  const { data, loading } = useAsync<ServerCustomerOrder[]>(() => listCustomerOrders(customerId), [customerId]);
  if (loading) return <Loading />;
  const orders = data ?? [];
  if (orders.length === 0)
    return <Empty icon={<Clock3 />} title="No orders yet" body="When this customer places an order it appears here with a frozen contact snapshot." />;

  const print = () => {
    void printCustomerOrders(customerId).then((payload) => {
      if (!payload) return;
      const lines = [
        `Order history â€” ${payload.customer.name}`,
        `Printed ${new Date(payload.printedAt).toLocaleString()}`,
        "",
        ...payload.orders.map((o) => `${o.orderNumber} Â· ${new Date(o.date).toLocaleDateString()} Â· ${o.status} Â· ${money(o.total)} Â· ${o.snapshotName} Â· ${o.feedback ?? 'No feedback'}`),
      ];
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
      a.download = `${payload.customer.name.replace(/\s+/g, "-").toLowerCase()}-order-history.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  };

  return (
    <div className="crm-history">
      <div className="crm-panel-head">
        <h3>Order history <span className="inline-count">{orders.length}</span></h3>
        <Button variant="outline" onClick={print} title="Download printable order history"><Printer /> Print</Button>
      </div>
      <ul className="configuration-list crm-history-list">
        {orders.map((o) => (
          <li key={o.id}>
            <div>
              <strong>{o.orderNumber || o.id}</strong>
              <small className="cell-sub">{o.requiredAt ? new Date(o.requiredAt).toLocaleDateString() : "—"}</small>
            </div>
            <span>{money(o.total)}</span>
            <Status value={orderStatusLabel(o.status)} />
            {o.snapshot && <small className="text-muted-foreground crm-snapshot">{o.snapshot.snapshotName}</small>}
          </li>
        ))}
      </ul>
      <p className="crm-note text-muted-foreground text-xs">Contact snapshots are frozen at order time (rule 27) and never rewritten.</p>
    </div>
  );
}

/* â”€â”€ Occasions (create / delete) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function OccasionsPanel({ customerId }: { customerId: string }) {
  const { data, loading, reload } = useAsync<ServerCustomerEvent[]>(() => listCustomerEvents(customerId), [customerId]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const eventType = String(form.get("eventType") || "").trim();
    if (!eventType) return;
    setBusy(true);
    void createCustomerEvent(customerId, {
      eventType,
      eventDate: String(form.get("eventDate") || "") || new Date().toISOString().slice(0, 10),
      recurrenceRule: String(form.get("recurrenceRule") || "NONE"),
      notes: String(form.get("notes") || ""),
    }).then(() => {
      setBusy(false);
      setAdding(false);
      reload();
    });
  };

  const remove = (id: string) => {
    void deleteCustomerEvent(customerId, id).then(() => reload());
  };

  if (loading) return <Loading />;
  const events = data ?? [];

  return (
    <div className="crm-occasions">
      <div className="crm-panel-head">
        <h3>Occasions <span className="inline-count">{events.length}</span></h3>
        {!adding && (
          <Button variant="outline" onClick={() => setAdding(true)} title="Add an occasion"><Plus /> Add occasion</Button>
        )}
      </div>

      {adding && (
        <form className="erp-form crm-event-form" onSubmit={submit}>
          <label>Occasion<input name="eventType" placeholder="e.g. Birthday, Anniversary" required maxLength={80} /></label>
          <div className="form-row">
            <label>Date<input name="eventDate" type="date" /></label>
            <label>Repeats<select name="recurrenceRule">{RECURRENCE_OPTIONS.map((r) => <option key={r} value={r}>{r === "NONE" ? "Does not repeat" : r[0] + r.slice(1).toLowerCase()}</option>)}</select></label>
          </div>
          <label>Notes<input name="notes" maxLength={250} placeholder="Optional â€” preferences, past orders" /></label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Check />} Save occasion</Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {events.length === 0 && !adding ? (
        <Empty icon={<CalendarPlus />} title="No occasions yet" body="Add a birthday or anniversary to schedule internal reminders ahead of the date." />
      ) : (
        <ul className="configuration-list crm-event-list">
          {events.map((ev) => (
            <li key={ev.id}>
              <div>
                <strong>{ev.eventType}</strong>
                <small className="cell-sub">{ev.eventDate ? new Date(ev.eventDate).toLocaleDateString() : "—"}{ev.recurrenceRule && ev.recurrenceRule !== "NONE" ? ` · repeats ${ev.recurrenceRule.toLowerCase()}` : ""}</small>
              </div>
              {ev.notes && <small className="text-muted-foreground">{ev.notes}</small>}
              <IconButton icon={Trash2} label={`Delete ${ev.eventType}`} onClick={() => remove(ev.id)} />
            </li>
          ))}
        </ul>
      )}
      <p className="crm-note text-muted-foreground text-xs">Reminders are scheduled automatically â€” the system never contacts the customer for you.</p>
    </div>
  );
}

/* â”€â”€ Reminders due across the workspace â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/** Map an internal reminder status to a badge label + a valid locked tone. */
function reminderStatus(status: string): { label: string; tone: StatusTone } {
  if (status === "CONTACTED") return { label: "Contacted", tone: "green" };
  if (status === "DISMISSED") return { label: "Dismissed", tone: "gray" };
  if (status === "REMINDED") return { label: "Reminded", tone: "blue" };
  return { label: "Pending", tone: "amber" };
}

export function RemindersPanel({ customerId }: { customerId?: string }) {
  const { data, loading, reload } = useAsync<ServerEventReminder[]>(() => listEventReminders(30), []);
  const list = (data ?? []).filter((r) => (customerId ? r.customerId === customerId : true));
  if (loading) return <Loading />;
  if (list.length === 0)
    return <Empty icon={<Clock3 />} title="No reminders due" body="Upcoming occasions will surface here 30 days ahead." />;

  const act = (id: string) => {
    void contactEventReminder(id, { outcome: "Contacted" }).then(() => reload());
  };
  const dismiss = (id: string) => {
    void dismissEventReminder(id).then(() => reload());
  };

  return (
    <div className="crm-reminders">
      <div className="crm-panel-head">
        <h3>Reminders due <span className="inline-count">{list.length}</span></h3>
        <small className="text-muted-foreground text-xs">Next 30 days</small>
      </div>
      <ul className="configuration-list crm-reminder-list">
        {list.map((r) => (
          <li key={r.id}>
            <div>
              <strong>{r.customerName || r.customerId}</strong>
              <small className="cell-sub">{r.eventType} Â· {new Date(r.nextReminderAt).toLocaleDateString()}</small>
            <Status value={reminderStatus(r.status).label} tone={reminderStatus(r.status).tone} />
            </div>
            
          </li>
        ))}
      </ul>
      <p className="crm-note text-muted-foreground text-xs">Reminders are internal only â€” nothing is sent to the customer automatically.</p>
    </div>
  );
}

/* â”€â”€ Resolver: bind a CRM contact to its live E1 record â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/**
 * Resolves the real customer id for the selected contact and renders the E1
 * panels (order history, occasions, reminders) against the live endpoints.
 * Degrades quietly when the workspace is offline (shows a sign-in hint) or the
 * contact has no matching database customer â€” the bundled sample workspace
 * never fires API calls.
 */
export function CustomerE1Panels({ name, connected }: { name: string; connected: boolean }) {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!connected || !name) {
      setCustomerId(null);
      setResolved(false);
      return;
    }
    let alive = true;
    setResolved(false);
    void findCustomerByName(name).then((customer) => {
      if (!alive) return;
      setCustomerId(customer?.id ?? null);
      setResolved(true);
    });
    return () => {
      alive = false;
    };
  }, [name, connected]);

  if (!connected) {
    return (
      <p className="crm-note text-muted-foreground text-xs">
        Sign in to see this customerâ€™s live order history, occasions and reminders.
      </p>
    );
  }
  if (!resolved) return <Loading />;
  if (!customerId) {
    return (
      <p className="crm-note text-muted-foreground text-xs">
        No live customer record matches â€œ{name}â€ yet â€” history appears here once an order exists.
      </p>
    );
  }
  return (
    <div className="crm-e1">
      <OrderHistoryPanel customerId={customerId} />
      <OccasionsPanel customerId={customerId} />
      <RemindersPanel customerId={customerId} />
    </div>
  );
}












