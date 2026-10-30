import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarDays, Check, Search, MessageSquare } from "lucide-react";
import { StatusBadge as Status } from "@/components/data-table/StatusBadge";
import { formatOccasionDate, groupOccasions, initialOccasions, type GridRow, type Occasion, type OccasionPeriod } from "./data";
import { listCustomers, listCustomerEvents } from "@/lib/api";
import type { ServerCustomerEvent } from "@/lib/api";
import { CustomerE1Panels } from "./crm-panels";

/**
 * CRM two-pane: contact list + order history & occasions.
 *
 * Allowed exception to the table-as-default pattern (erp-design-system.md §5 /
 * erp_design.md): a conversation is read top-to-bottom, not scanned row-by-row,
 * so CRM renders a list + detail instead of a <DataTable>. Rows still come from
 * the shared `moduleRows('crm', …)` source, so every other module rule (status
 * vocabulary, badges, density) stays identical.
 */
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
  const [thread, setThread] = useState<string[]>([]);

  // The Occasions tab is a cross-customer calendar view, not the two-pane
  // conversation UI — short-circuit here so workspace/module-table stay unaware.
  if (tab === "Occasions") return <OccasionsView connected={connected} />;
  const active = contacts.find((c) => c.id === activeId) ?? contacts[0] ?? null;
  const pendingFollowUps = followUps?.filter((f) => f.customer === active?.name) ?? [];

  useEffect(() => {
    if (!active) {
      setThread([]);
      return;
    }
    let alive = true;
    void listCustomerEvents(active.id).then((events: ServerCustomerEvent[]) => {
      if (!alive) return;
      setThread(
        events
          .map((e) => e.notes && e.notes.trim())
          .filter(Boolean)
          .slice(-6)
          .reverse(),
      );
    });
    return () => {
      alive = false;
    };
  }, [active?.id]);

  return (
    <section className="panel crm-view">
      <div className="panel-heading">
        <div>
          <h2>{tab}</h2>
          <p>{contacts.length} contacts</p>
        </div>
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
                  onClick={() => setActiveId(c.id)}
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
                      {c.id} · {c.detail}
                    </small>
                  </span>
                  <Status value={c.status} />
                </button>
              </li>
            ))}
          </ul>
          {active && (
            <div className="crm-detail">
              <div className="crm-detail-head">
                <div>
                  <h3>{active.name}</h3>
                  <p>
                    {active.id} · {active.detail}
                  </p>
                </div>
                <Status value={active.status} />
              </div>
              <div className="crm-contact-meta">
                <MessageSquare size={14} className="inline-icon" />
                {active.detail}
              </div>
              <div className="crm-thread">
                {thread.length === 0 ? (
                  <p className="crm-msg crm-msg-in">No conversation notes yet.</p>
                ) : (
                  thread.map((m, i) => (
                    <p key={i} className={i % 2 ? "crm-msg crm-msg-out" : "crm-msg"}>
                      {m}
                    </p>
                  ))
                )}
              </div>
              <CustomerE1Panels name={active.name} connected={connected} />
              {pendingFollowUps.length > 0 ? (
                <div className="crm-detail-foot">
                  <span>{pendingFollowUps.length} completed order{pendingFollowUps.length === 1 ? '' : 's'} awaiting follow-up</span>
                  <Button variant="secondary" size="sm" onClick={() => pendingFollowUps.forEach((f) => onCompleteFollowUp?.(f.id))}>
                    <Check size={14}/> Document follow-up
                  </Button>
                </div>
              ) : (
                <div className="crm-detail-foot">
                  <span>{active.secondary}</span>
                  <strong>{active.value}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * CRM "Occasions" tab: every customer's occasions (birthdays, anniversaries,
 * graduations…) aggregated across customers and grouped by month (default),
 * Monday-start week, or a custom date range. Connected workspaces load live
 * data (listCustomers + one listCustomerEvents per customer); otherwise the
 * sample occasions from data.ts are shown.
 */
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

