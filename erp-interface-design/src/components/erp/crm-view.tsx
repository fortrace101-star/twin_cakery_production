import { useState } from "react";
import { Search } from "lucide-react";
import { StatusBadge as Status } from "@/components/data-table/StatusBadge";
import type { GridRow } from "./data";
import { CustomerE1Panels } from "./crm-panels";

/**
 * CRM two-pane: contact list + conversation thread.
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
}: {
  tab: string;
  contacts: GridRow[];
  search: string;
  setSearch: (s: string) => void;
  connected: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = contacts.find((c) => c.id === activeId) ?? contacts[0] ?? null;
  const thread = [
    "Thanks for choosing Twin Cakery Bakery! How can we help with this order?",
    "Noted — the team will follow up shortly.",
  ];

  return (
    <section className="panel crm-view">
      <div className="panel-heading">
        <div>
          <h2>{tab}</h2>
          <p>{contacts.length} contacts · select a conversation</p>
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
              <div className="crm-thread">
                {thread.map((m, i) => (
                  <p key={i} className={i % 2 ? "crm-msg crm-msg-out" : "crm-msg"}>
                    {m}
                  </p>
                ))}
              </div>
              <CustomerE1Panels name={active.name} connected={connected} />
              <div className="crm-detail-foot">
                <span>{active.secondary}</span>
                <strong>{active.value}</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

