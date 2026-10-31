import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CalendarDays, Check, Search, MessageSquare, Printer, Mail, Phone, Plus, Loader2, ArrowUpRight, UserPlus, Edit } from "lucide-react";
import { StatusBadge as Status } from "@/components/data-table/StatusBadge";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { useDensity } from "@/lib/density";
import { formatOccasionDate, groupOccasions, initialOccasions, type GridRow, type Occasion, type OccasionPeriod } from "./data";
import { listCustomers, listCustomerEvents, findCustomerByName, listCustomerFeedback, listCustomerOrders, createCustomerFeedback, printCustomerOrders, listEventReminders, orderStatusLabel, type ServerCustomer, type ServerCustomerEvent, type ServerCustomerFeedback, type ServerCustomerOrder, type ServerEventReminder } from "@/lib/api";
import { useAsync, Loading, Empty, StarRating, feedbackTypeLabel } from "./crm-panels";
import { money } from "./data";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock3, CalendarPlus } from "lucide-react";
import type { StatusTone } from "@/lib/theme-tokens";

function reminderStatus(status: string): { label: string; tone: StatusTone } {
  if (status === "CONTACTED") return { label: "Contacted", tone: "green" };
  if (status === "DISMISSED") return { label: "Dismissed", tone: "gray" };
  if (status === "REMINDED") return { label: "Reminded", tone: "blue" };
  return { label: "Pending", tone: "amber" };
}

function useCustomerContext(name: string, connected: boolean) {
  const { data: customer } = useAsync<ServerCustomer | null>(
    () => connected ? findCustomerByName(name).then((c) => c ?? null) : Promise.resolve(null),
    [name, connected],
  );
  const customerId = customer?.id ?? name;
  const { data: orders } = useAsync<ServerCustomerOrder[]>(
    () => connected ? listCustomerOrders(customerId) : Promise.resolve([]),
    [customerId, connected],
  );
  const { data: events } = useAsync<ServerCustomerEvent[]>(
    () => connected ? listCustomerEvents(customerId) : Promise.resolve([]),
    [customerId, connected],
  );
  const { data: feedback } = useAsync<ServerCustomerFeedback[]>(
    () => connected ? listCustomerFeedback(customerId) : Promise.resolve([]),
    [customerId, connected],
  );
  const totalSpent = (orders ?? []).reduce((sum: number, o: ServerCustomerOrder) => sum + o.total, 0);
  const lastOrder = (orders ?? []).slice().sort((a: ServerCustomerOrder, b: ServerCustomerOrder) => (b.requiredAt ?? b.createdAt ?? "").localeCompare(a.requiredAt ?? a.createdAt ?? ""))[0] as ServerCustomerOrder | undefined;
  return { customer, orders, events, feedback, totalSpent, lastOrder };
}

function CustomerProfileHeader({ name, id, status, detail, onPrint }: { name: string; id: string; status: string; detail?: string; onPrint: () => void }) {
  return (
    <div className="crm-profile-header-inner">
      <div className="crm-profile-main">
        <span className="customer-avatar avatar-0 crm-profile-avatar">
          {name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
        </span>
        <div className="crm-profile-info">
          <h3>{name}</h3>
          <p className="text-muted-foreground text-sm">{id}{detail ? ` · ${detail}` : ''}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">Customer type: External</span>
          </div>
        </div>
      </div>
      <div className="crm-profile-actions">
        <Status value={status} />
        <Button variant="outline" size="sm" onClick={() => {}}><Edit size={14} /> Edit</Button>
        <Button variant="ghost" size="icon" onClick={onPrint} title="Print"><Printer size={16} /></Button>
      </div>
    </div>
  );
}

function CustomerMetricsSnapshot({ name, connected }: { name: string; connected: boolean }) {
  const ctx = useCustomerContext(name, connected);
  if (!connected || !ctx.customer) return null;
  const orders = ctx.orders ?? [];
  const lastOrder = ctx.lastOrder;
  const totalSpent = ctx.totalSpent;

  return (
    <div className="crm-profile-metrics">
      <div className="flex items-center gap-4">
        <div className="metric-item">
          <Badge variant="secondary">{orders.length} orders</Badge>
        </div>
        <Separator orientation="vertical" className="h-6" />
        <div className="metric-item">
          <span className="text-muted-foreground text-xs">Total spent</span>
          <strong className="text-sm">{money(totalSpent)}</strong>
        </div>
        <Separator orientation="vertical" className="h-6" />
        <div className="metric-item">
          <span className="text-muted-foreground text-xs">Last order</span>
          <span className="text-sm">{lastOrder ? new Date(lastOrder.requiredAt ?? lastOrder.createdAt ?? '').toLocaleDateString() : '—'}</span>
        </div>
      </div>
    </div>
  );
}

function CustomerDetailsTabs({ detailTab, setDetailTab }: { detailTab: string; setDetailTab: (t: any) => void }) {
  return (
    <div className="crm-tabs" role="tablist">
      {(['Overview', 'Orders', 'Feedback', 'Occasions'] as const).map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={detailTab === t}
          className={detailTab === t ? 'selected' : ''}
          onClick={() => setDetailTab(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function CustomerOverview({ name, connected }: { name: string; connected: boolean }) {
  const ctx = useCustomerContext(name, connected);

  if (!connected) {
    return <p className="crm-note text-muted-foreground text-xs">Sign in to see this customer's profile details.</p>;
  }
  if (!ctx.customer) {
    return <p className="crm-note text-muted-foreground text-xs">No customer record found for {name}.</p>;
  }

  const { customer, orders, feedback, totalSpent, lastOrder } = ctx;
  const recentOrders = (orders ?? []).slice(0, 5);
  const recentFeedback = (feedback ?? []).slice(0, 3);

  return (
    <div className="crm-overview">
      <div className="crm-section">
        <h4 className="crm-section-title">Contact Information</h4>
        <div className="crm-contact-grid">
          <div className="crm-contact-item">
            <Phone size={14} className="inline-icon" />
            <span>{customer.phone || '—'}</span>
          </div>
          <div className="crm-contact-item">
            <Mail size={14} className="inline-icon" />
            <span>{customer.email || '—'}</span>
          </div>
          <div className="crm-contact-item">
            <Status value={customer.status} />
          </div>
        </div>
      </div>
      <div className="crm-section">
        <h4 className="crm-section-title">Summary</h4>
        <div className="crm-metrics">
          <div className="crm-metric">
            <span className="metric-value">{(orders ?? []).length}</span>
            <span className="metric-label">Total orders</span>
          </div>
          <div className="crm-metric">
            <span className="metric-value">{lastOrder ? money(lastOrder.total) : '—'}</span>
            <span className="metric-label">Last order value</span>
          </div>
          <div className="crm-metric">
            <span className="metric-value">{lastOrder ? new Date(lastOrder.requiredAt ?? lastOrder.createdAt ?? '').toLocaleDateString() : '—'}</span>
            <span className="metric-label">Last order date</span>
          </div>
          <div className="crm-metric">
            <span className="metric-value">{money(totalSpent)}</span>
            <span className="metric-label">Total spent</span>
          </div>
        </div>
      </div>
      {(recentOrders.length > 0 || recentFeedback.length > 0) && (
        <div className="crm-section">
          <h4 className="crm-section-title">Recent Activity</h4>
          {recentOrders.length > 0 && (
            <div className="crm-activity-section">
              <small className="text-muted-foreground">Recent orders</small>
              <ul className="crm-activity-list">
                {recentOrders.map((o) => (
                  <li key={o.id}>
                    <strong>{o.orderNumber || o.id}</strong>
                    <small className="text-muted-foreground">{o.requiredAt ? new Date(o.requiredAt).toLocaleDateString() : '—'}</small>
                    <span>{money(o.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recentFeedback.length > 0 && (
            <div className="crm-activity-section">
              <small className="text-muted-foreground">Recent feedback</small>
              <ul className="crm-activity-list">
                {recentFeedback.map((f) => (
                  <li key={f.id}>
                    <strong>{feedbackTypeLabel(f.type)}</strong>
                    <small className="text-muted-foreground">{f.comment}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomerOrders({ name, connected }: { name: string; connected: boolean }) {
  const ctx = useCustomerContext(name, connected);
  const { density } = useDensity();

  if (!connected) {
    return <p className="crm-note text-muted-foreground text-xs">Sign in to view order history.</p>;
  }
  if (!ctx.customer) {
    return <p className="crm-note text-muted-foreground text-xs">No customer record found.</p>;
  }
  if (ctx.orders === null) return <Loading />;
  const orderList = ctx.orders;
  const customer = ctx.customer!;

  const columns: Column<ServerCustomerOrder>[] = [
    { header: "Order", cell: (o) => <><strong className="product-name">{o.orderNumber || o.id}</strong>{o.snapshot && <small className="cell-sub">{o.snapshot.snapshotName}</small>}</> },
    { header: "Date", cell: (o) => <small className="text-muted-foreground">{o.requiredAt ? new Date(o.requiredAt).toLocaleDateString() : '—'}</small> },
    { header: "Amount", align: "right", cell: (o) => <span className="amount-cell">{money(o.total)}</span> },
    { header: "Status", cell: (o) => <Status value={orderStatusLabel(o.status)} /> },
    { header: "", cell: () => <Button variant="ghost" size="icon" title="View order"><ArrowUpRight size={14} /></Button> },
  ];

  return (
    <div className="crm-orders">
      <div className="crm-panel-head">
        <h3>Order History <span className="inline-count">{orderList.length}</span></h3>
        <Button variant="outline" size="sm" onClick={() => void printCustomerOrders(customer.id).then(p => { if (p) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([p.orders.map(o => `${o.orderNumber} · ${new Date(o.date).toLocaleDateString()} · ${o.status} · ${money(o.total)}`).join('\n')], {type: 'text/plain'})); a.download = `${customer.name.replace(/\s+/g, '-').toLowerCase()}-orders.txt`; a.click(); URL.revokeObjectURL(a.href); } })}><Printer size={14} /> Print</Button>
      </div>
      {orderList.length === 0 ? (
        <Empty icon={<Clock3 />} title="No orders yet" body="This customer hasn't placed any orders yet." />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={orderList}
            rowKey={(o) => o.id}
            stickyHeader
            density={density}
            empty={<Empty icon={<Clock3 />} title="No orders yet" body="This customer hasn't placed any orders yet." />}
          />
          <div className="table-foot"><span>{orderList.length} orders</span></div>
        </>
      )}
    </div>
  );
}

function RecordFeedbackDialog({
  open, onOpenChange, customerId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: string;
  onSaved: () => void;
}) {
  const { data: orders } = useAsync<ServerCustomerOrder[]>(() => listCustomerOrders(customerId), [customerId]);
  const [rating, setRating] = useState(0);
  const [type, setType] = useState('GENERAL');
  const [comment, setComment] = useState('');
  const [resolution, setResolution] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [busy, setBusy] = useState(false);

  const completedOrders = (orders ?? []).filter(o => o.status === 'COMPLETED_DELIVERED' || o.status === 'COMPLETED');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId || rating === 0) return;
    setBusy(true);
    void createCustomerFeedback({
      customerId,
      orderId: selectedOrderId,
      rating,
      type,
      comment: comment.trim(),
      resolution: resolution.trim() || undefined,
    }).then((record) => {
      setBusy(false);
      if (record) {
        onSaved();
        setRating(0);
        setComment('');
        setResolution('');
        setSelectedOrderId('');
        setType('GENERAL');
      }
    });
  };

  if (orders === null) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Record Customer Feedback</DialogTitle>
        <DialogDescription>Add feedback for a completed order.</DialogDescription>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-field">
            <Label>Select completed order</Label>
            <Select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)}>
              <option value="">Choose an order...</option>
              {completedOrders.map((o) => (
                <option key={o.id} value={o.id}>{o.orderNumber || o.id} - {new Date(o.requiredAt ?? o.createdAt ?? '').toLocaleDateString()}</option>
              ))}
            </Select>
          </div>
          <div className="form-field">
            <Label>Feedback type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="RATING">Rating</option>
              <option value="COMPLAINT">Complaint</option>
              <option value="COMPLIMENT">Compliment</option>
              <option value="GENERAL">General feedback</option>
            </Select>
          </div>
          <div className="form-field">
            <Label>Rating</Label>
            <StarRating rating={rating} onChange={setRating} />
          </div>
          <div className="form-field">
            <Label>Comment</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Customer feedback..." rows={3} />
          </div>
          <div className="form-field">
            <Label>Resolution (optional)</Label>
            <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="How was it resolved?" rows={2} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !selectedOrderId || rating === 0}>{busy ? <Loader2 className="animate-spin" /> : <Check />} Record feedback</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CustomerFeedback({ name, connected }: { name: string; connected: boolean }) {
  const ctx = useCustomerContext(name, connected);
  const { density } = useDensity();
  const [refreshKey, setRefreshKey] = useState(0);

  if (!connected) {
    return <p className="crm-note text-muted-foreground text-xs">Sign in to view feedback.</p>;
  }
  if (!ctx.customer) {
    return <p className="crm-note text-muted-foreground text-xs">No customer record found.</p>;
  }
  if (ctx.feedback === null) return <Loading />;
  const feedbackList = ctx.feedback;
  const customer = ctx.customer!;
  const [showRecordDialog, setShowRecordDialog] = useState(false);

  const columns: Column<ServerCustomerFeedback>[] = [
    { header: "Rating", cell: (f) => <StarRating rating={f.rating} readonly /> },
    { header: "Type", cell: (f) => <small className="text-muted-foreground">{feedbackTypeLabel(f.type)}</small> },
    { header: "Date", cell: (f) => <small className="text-muted-foreground">{new Date(f.createdAt).toLocaleDateString()}</small> },
    { header: "Comment", cell: (f) => <span className="text-sm">{f.comment || '—'}</span> },
    { header: "Resolution", cell: (f) => <span className="text-sm">{f.resolution || '—'}</span> },
    { header: "Order", cell: (f) => <small className="text-muted-foreground">{f.orderId || '—'}</small> },
  ];

  return (
    <div className="crm-feedback-tab">
      <div className="crm-panel-head">
        <h3>Customer Feedback <span className="inline-count">{feedbackList.length}</span></h3>
        <Button variant="outline" size="sm" onClick={() => setShowRecordDialog(true)}><Plus size={14} /> Record feedback</Button>
      </div>
      {feedbackList.length === 0 ? (
        <Empty icon={<MessageSquare />} title="No feedback recorded" body="Record feedback from a completed order." />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={feedbackList}
            rowKey={(f) => f.id}
            stickyHeader
            density={density}
            empty={<Empty icon={<MessageSquare />} title="No feedback recorded" body="Record feedback from a completed order." />}
          />
          <div className="table-foot"><span>{feedbackList.length} feedback entries</span></div>
        </>
      )}
      <RecordFeedbackDialog
        open={showRecordDialog}
        onOpenChange={setShowRecordDialog}
        customerId={customer.id}
        onSaved={() => { setRefreshKey((k) => k + 1); setShowRecordDialog(false); }}
      />
    </div>
  );
}

function CustomerOccasions({ name, connected }: { name: string; connected: boolean }) {
  const ctx = useCustomerContext(name, connected);

  if (!connected) {
    return <p className="crm-note text-muted-foreground text-xs">Sign in to view occasions and reminders.</p>;
  }
  if (!ctx.customer) {
    return <p className="crm-note text-muted-foreground text-xs">No customer record found.</p>;
  }
  if (ctx.events === null) return <Loading />;
  const eventList = ctx.events;
  const customer = ctx.customer!;
  const { data: reminders } = useAsync<ServerEventReminder[]>(
    () => connected ? listEventReminders(30).then((r) => (r ?? []).filter((rem) => rem.customerId === customer.id)) : Promise.resolve([]),
    [customer.id, connected],
  );
  const remindersList = reminders ?? [];

  return (
    <div className="crm-occasions-tab">
      <div className="crm-section">
        <div className="crm-panel-head">
          <h3>Occasions <span className="inline-count">{eventList.length}</span></h3>
          <Button variant="outline" size="sm" onClick={() => {}}><Plus size={14} /> Add</Button>
        </div>
        {eventList.length === 0 ? (
          <Empty icon={<CalendarPlus />} title="No occasions" body="Add a birthday or anniversary." />
        ) : (
          <ul className="crm-event-list compact">
            {eventList.map((ev) => (
              <li key={ev.id} className="crm-event-card compact">
                <div>
                  <strong>{ev.eventType}</strong>
                  <small className="text-muted-foreground">{ev.eventDate ? new Date(ev.eventDate).toLocaleDateString() : '—'}</small>
                  {ev.recurrenceRule && ev.recurrenceRule !== 'NONE' && <small className="text-muted-foreground">Repeats: {ev.recurrenceRule.toLowerCase()}</small>}
                </div>
                {ev.notes && <p className="text-muted-foreground text-sm">{ev.notes}</p>}
                <div className="crm-event-actions">
                  <span className="text-muted-foreground text-xs">Next reminder: {ev.eventDate ? formatOccasionDate(ev.eventDate) : '—'}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="crm-section">
        <div className="crm-panel-head">
          <h3>Upcoming Reminders <span className="inline-count">{remindersList.length}</span></h3>
          <small className="text-muted-foreground text-xs">Lead time: 30 days</small>
        </div>
        {remindersList.length === 0 ? (
          <Empty icon={<Clock3 />} title="No reminders due" body="Upcoming occasions will appear here." />
        ) : (
          <ul className="crm-reminder-list compact">
            {remindersList.map((r) => (
              <li key={r.id} className="crm-reminder-card compact">
                <div>
                  <strong>{r.eventType}</strong>
                  <small className="text-muted-foreground">{new Date(r.nextReminderAt).toLocaleDateString()}</small>
                  <Status value={reminderStatus(r.status).label} tone={reminderStatus(r.status).tone} />
                </div>
                <span className="text-muted-foreground text-xs">{r.outcome || ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CustomerTabContent({ detailTab, name, connected }: { detailTab: string; name: string; connected: boolean }) {
  return (
    <div className="crm-tab-content" role="tabpanel">
      {detailTab === 'Overview' && <CustomerOverview name={name} connected={connected} />}
      {detailTab === 'Orders' && <CustomerOrders name={name} connected={connected} />}
      {detailTab === 'Feedback' && <CustomerFeedback name={name} connected={connected} />}
      {detailTab === 'Occasions' && <CustomerOccasions name={name} connected={connected} />}
    </div>
  );
}

function OccasionsView({ connected }: { connected: boolean }) {
  const [period, setPeriod] = useState<OccasionPeriod>("Month");
  const [rangeFrom, setRangeFrom] = useState("2026-10-10");
  const [rangeTo, setRangeTo] = useState("2026-11-30");
  const [live, setLive] = useState<Occasion[] | null>(null);

  useEffect(() => {
    let stale = false;
    if (!connected) {
      setLive(null);
      return;
    }
    void (async () => {
      try {
        const customers = await listCustomers();
        const perCustomer = await Promise.all(customers.map((c) => listCustomerEvents(c.id)));
        if (stale) return;
        const flat: Occasion[] = [];
        customers.forEach((c, i) => {
          for (const ev of perCustomer[i] ?? []) {
            if (!ev.eventDate) continue;
            flat.push({
              id: `${c.id}:${ev.id}`,
              customer: c.name,
              type: ev.eventType,
              date: ev.eventDate.slice(0, 10),
              recurrence: ev.recurrenceRule ?? "NONE",
            });
          }
        });
        setLive(flat);
      } catch {
        if (!stale) setLive([]);
      }
    })();
    return () => {
      stale = true;
    };
  }, [connected]);

  const occasions = connected && live ? live : initialOccasions;
  const groups = groupOccasions(occasions, period, period === "Custom" ? { from: rangeFrom, to: rangeTo } : undefined);

  return (
    <section className="panel crm-view occasions-panel">
      <div className="panel-heading">
        <div>
          <h2>Occasions</h2>
          <p>
            {occasions.length} occasions ·{" "}
            {connected && live === null
              ? "loading from your workspace"
              : `grouped by ${period === "Custom" ? "date range" : period.toLowerCase()}`}
          </p>
        </div>
      </div>
      <div className="occasions-toolbar">
        <div className="segmented" role="group" aria-label="Group occasions by">
          {(["Month", "Week", "Custom"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              className={period === p ? "selected" : ""}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
        {period === "Custom" && (
          <span className="date-range">
            <CalendarDays size={14} />
            <label>
              From
              <input type="date" aria-label="Range from" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" aria-label="Range to" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
            </label>
          </span>
        )}
      </div>
      {groups.length === 0 ? (
        <div className="empty-state">
          <CalendarDays />
          <h3>No occasions in this period</h3>
          <p>Switch the grouping or widen the date range.</p>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="occasions-group">
            <h3>
              {g.label} <span className="inline-count">{g.items.length}</span>
            </h3>
            <ul className="configuration-list crm-event-list">
              {g.items.map((o) => (
                <li key={o.id}>
                  <div>
                    <strong>{o.customer}</strong>
                    <small className="cell-sub">
                      {o.type}
                      {o.recurrence && o.recurrence !== "NONE" ? ` · repeats ${o.recurrence.toLowerCase()}` : ""}
                    </small>
                  </div>
                  <small className="text-muted-foreground text-xs">{formatOccasionDate(o.date)}</small>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <p className="crm-note text-muted-foreground text-xs">
        Reminders are scheduled automatically — the system never contacts the customer for you.
      </p>
    </section>
  );
}

export function CrmView({
  tab,
  contacts,
  search,
  setSearch,
  connected,
  followUps,
  onCompleteFollowUp,
}: {
  tab: string;
  contacts: GridRow[];
  search: string;
  setSearch: (s: string) => void;
  connected: boolean;
  followUps?: { id: string; customer: string }[] | undefined;
  onCompleteFollowUp?: ((id: string) => void) | undefined;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'Overview' | 'Orders' | 'Feedback' | 'Occasions'>('Overview');

  const handleActiveIdChange = useCallback((id: string | null) => {
    setActiveId(id);
    if (id === null || !contacts.some((c) => c.id === id)) {
      setDetailTab('Overview');
    }
  }, [contacts]);

  if (tab === "Occasions") return <OccasionsView connected={connected} />;
  const active = contacts.find((c) => c.id === activeId) ?? contacts[0] ?? null;

  return (
    <section className="panel crm-view">
      <div className="panel-heading">
        <div>
          <h2>{tab}</h2>
          <p>{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {}}><UserPlus size={14} /> Add customer</Button>
      </div>
      <div className="table-controls">
        <label className="search-box">
          <Search size={16} />
          <input
            aria-label={`Search ${tab}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${tab.toLowerCase()}...`}
          />
        </label>
      </div>
      {contacts.length === 0 ? (
        <div className="empty-state">
          <Search />
          <h3>No contacts found</h3>
          <p>Try a different search.</p>
        </div>
      ) : (
        <div className="crm-body">
          <ul className="crm-list">
            {contacts.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={active?.id === c.id ? "selected" : ""}
                  aria-current={active?.id === c.id ? "true" : undefined}
                  onClick={() => handleActiveIdChange(c.id)}
                >
                  <span className="customer-avatar avatar-0">
                    {c.name
                      .split(" ")
                      .map((s) => s[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <span className="crm-contact-meta">
                    <strong>{c.name}</strong>
                    <small>
                      {c.id}
                      {c.detail ? ` · ${c.detail}` : ''}
                    </small>
                    <small className="text-muted-foreground">{c.secondary || ''}</small>
                  </span>
                  <Status value={c.status} />
                </button>
              </li>
            ))}
          </ul>
          {active && (
            <div className="crm-detail">
              <div className="crm-profile-header sticky">
                <CustomerProfileHeader
                  name={active.name}
                  id={active.id}
                  status={active.status}
                  detail={active.detail}
                  onPrint={() => {}}
                />
                <CustomerMetricsSnapshot name={active.name} connected={connected} />
              </div>
              <CustomerDetailsTabs detailTab={detailTab} setDetailTab={setDetailTab} />
              <CustomerTabContent detailTab={detailTab} name={active.name} connected={connected} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
