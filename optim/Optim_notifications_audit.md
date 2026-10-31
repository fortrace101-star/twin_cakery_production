# Optim — Notifications, Audit and the Event Spine

**Owner of:** `domain_events`, the `emit()` helper, notification delivery and rules, the audit trail, order/job comments and escalations.
**Depends on:** `Optim_architecture.md` (transactions, `transition()`), `Optim_security_rbac.md` (permissions).
**Consumed by:** every other `Optim_*.md` file (each module lists the events it emits and the rules it needs).

> Based on `server/services/notification.service.ts`, `server/routes/notifications.ts`, `server/database/store.ts` (`getUserNotifications`, `createNotification`, `markAsRead`), `server/services/stock-alerts.ts` and migrations `001`–`021` (tables `notifications`, `notification_recipients`, `notification_preferences`, `notification_templates`, `audit_logs`). The app was not run.

---

# PART A — ASSESSMENT

## A1. What exists
- Topbar bell with unread badge, mark-read, mark-all-read and click-through (`erp-interface-design/src/components/erp/topbar.tsx`, `api.ts` → `listNotifications`, `markAsRead`).
- About 28 event types with templates for IN_APP, WHATSAPP, EMAIL, SMS; a `ROLES_FOR_EVENT` map; a `notification_preferences` table and endpoints; a CRM follow-up banner after delivery.
- `audit_logs` with `actor, action, entity_type, entity_id, previous_status, new_status, reason, timestamp`.

## A2. Defects (verified in code unless marked)
| # | Finding | Where | Scenario |
|---|---|---|---|
| 1 | **Everyone sees everyone's notifications.** `store.getUserNotifications(userId)` does `void userId;` and returns the latest 50 across all users. `routes/notifications.ts` uses this version. | `store.ts:1413` | A baker opens the bell and reads "Refund of UGX 400,000 approved" and payroll alerts. |
| 2 | **Role routing is bypassed.** `publishEvent` is called with `isAdmin: true` (e.g. `markOrderPaid`, `purchasing.ts` receive, `production.ts` wastage), so every active user is a recipient. | `notification.service.ts:265`, call sites | `ROLES_FOR_EVENT` never narrows anything. |
| 3 | **Role names don't match data.** The map uses "Finance" and "Customer Service Representative"; the seed creates Admin, Production Manager, Sales Manager. | `notification.service.ts:229-` | Finance alerts have no possible recipient except Admin. |
| 4 | **Nothing is sent externally.** `publishEvent` loops `IN_APP, WHATSAPP, EMAIL, SMS`, calls `notifyUser` for each, and returns an empty `delivered` array. | `notification.service.ts:329-338` | Four near-identical rows per user per event; WhatsApp never leaves the server. |
| 5 | **Inflated unread badge.** One recipient row per channel. | `notifyUser` | One payment = badge of 4; marking one read clears one. |
| 6 | **Generic text.** `notifyUser` uses the template and ignores the caller's `title`/`message`; `{{orderNumber}}` placeholders are not filled. | `notification.service.ts` | "A payment has been received against an order" — which order? |
| 7 | **Preferences ignored.** `getPreferencesForEvent` exists; `publishEvent` never calls it. | | A user switches off SMS; nothing changes. |
| 8 | **Orphan notifications.** `payments.ts` callback uses `store.createNotification` directly: a notification row with no recipient rows. | `payments.ts` `/:id/callback` | The M-Pesa failure alert shows in lists but nobody's badge counts it. |
| 9 | **No live updates.** No SSE, websocket or polling found in `topbar.tsx`/`store.tsx`. | | A baker doesn't see a new order until reloading. |
| 10 | **`PATCH /notifications/preferences` reads `enabled` from `req.query`**, not the body. | `routes/notifications.ts` | `enabled` is computed as `enabled === "true"` from the query string. A client that sends `{ enabled: true }` in a JSON body (and no query string) always stores `false`. |
| 11 | **Audit is thin.** No old/new values, no IP, no correlation id; expense edit/delete and several PATCH paths write no audit row (not exhaustively verified). | `audit_logs` DDL | "Who changed this order's total?" cannot be answered. |
| 12 | **No cross-role communication.** No order/job comments, @mentions, assignment or handoff statuses. | — | Sales cannot ask the baker about a design inside the app. |

---

# PART B — OPTIMIZATION, CORRECTION AND IMPROVEMENT

## B1. The event spine (`domain_events`)

### B1.1 Migration
```sql
-- 023_domain_events.sql
CREATE TABLE domain_events (
  id             BIGSERIAL PRIMARY KEY,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type     TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      TEXT NOT NULL,
  order_id       TEXT, customer_id TEXT, job_id TEXT,
  actor_id       TEXT,                      -- NULL = system / scheduler
  from_status    TEXT, to_status TEXT,
  amount         NUMERIC(14,2),
  data           JSONB NOT NULL DEFAULT '{}',   -- old/new values, reason, ip
  correlation_id TEXT
);
CREATE INDEX ON domain_events (order_id, occurred_at);
CREATE INDEX ON domain_events (event_type, occurred_at);
CREATE INDEX ON domain_events (entity_type, entity_id);

-- append-only for the application role (adjust role name)
REVOKE UPDATE, DELETE, TRUNCATE ON domain_events FROM erp_app;
-- belt and braces, works even if the app connects as owner:
CREATE FUNCTION domain_events_immutable() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN RAISE EXCEPTION 'domain_events is append-only'; END $$;
CREATE TRIGGER trg_domain_events_immutable BEFORE UPDATE OR DELETE ON domain_events
  FOR EACH ROW EXECUTE FUNCTION domain_events_immutable();

-- backfill from the existing audit trail so history is not lost
INSERT INTO domain_events (occurred_at, event_type, entity_type, entity_id, order_id, actor_id, from_status, to_status, data)
SELECT timestamp, action, entity_type, entity_id, order_id, NULLIF(actor,''), NULLIF(previous_status,''), NULLIF(new_status,''),
       jsonb_build_object('reason', reason, 'backfilled', true)
FROM audit_logs;

-- keep the old name working for existing readers (store.createAuditLog, UI audit list)
ALTER TABLE audit_logs RENAME TO audit_logs_legacy;
CREATE VIEW audit_logs AS
SELECT id::text AS id, order_id, COALESCE(actor_id,'') AS actor, event_type AS action, entity_type, entity_id,
       COALESCE(from_status,'') AS previous_status, COALESCE(to_status,'') AS new_status,
       COALESCE(data->>'reason','') AS reason, occurred_at AS timestamp,
       occurred_at AS created_at, occurred_at AS updated_at
FROM domain_events;
```
Backfill caveat: only rows that `audit_logs` actually holds can be recovered. Check that every status path writes an audit row before trusting milestone history (see `Optim_analytics.md` §B2).

### B1.2 The emit helper
```ts
// server/services/events.ts
import type { TxClient } from "../database/db.js";
export interface DomainEvent {
  type: string; entity: string; entityId: string;
  orderId?: string; customerId?: string; jobId?: string;
  from?: string; to?: string; amount?: number;
  actor?: { userId?: string; ip?: string }; data?: Record<string, unknown>;
}
export async function emit(tx: TxClient, e: DomainEvent): Promise<number> {
  const { rows } = await tx.query(
    `INSERT INTO domain_events (event_type, entity_type, entity_id, order_id, customer_id, job_id,
       actor_id, from_status, to_status, amount, data, correlation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [e.type, e.entity, e.entityId, e.orderId ?? null, e.customerId ?? null, e.jobId ?? null,
     e.actor?.userId ?? null, e.from ?? null, e.to ?? null, e.amount ?? null,
     JSON.stringify({ ...e.data, ip: e.actor?.ip }), currentCorrelationId()]);
  await tx.query(`SELECT pg_notify('domain_events', $1)`, [String(rows[0].id)]);   // wakes the rules worker
  return rows[0].id;
}
```
`pg_notify` inside the transaction only fires on commit, so a rolled-back change never triggers a notification.

## B2. Notifications rebuilt as a consumer of events

### B2.1 Migration — rules, one-row-per-user notifications, delivery log
```sql
-- 024_notification_rules.sql
CREATE TABLE notification_rules (
  id TEXT PRIMARY KEY, event_type TEXT NOT NULL, condition JSONB NOT NULL DEFAULT '{}',
  recipient_permission TEXT NOT NULL,           -- resolved via role_permissions, not role names
  channels TEXT[] NOT NULL DEFAULT '{IN_APP}', severity TEXT NOT NULL DEFAULT 'INFO',
  dedupe_minutes INT NOT NULL DEFAULT 0, escalate_after_minutes INT, escalate_to_permission TEXT,
  requires_ack BOOLEAN NOT NULL DEFAULT FALSE, active BOOLEAN NOT NULL DEFAULT TRUE
);
ALTER TABLE notifications
  ADD COLUMN event_id BIGINT REFERENCES domain_events(id),
  ADD COLUMN rule_id TEXT REFERENCES notification_rules(id),
  ADD COLUMN severity TEXT NOT NULL DEFAULT 'INFO';
ALTER TABLE notification_recipients
  ADD COLUMN acknowledged_at TIMESTAMPTZ, ADD COLUMN escalated_at TIMESTAMPTZ;
CREATE UNIQUE INDEX uq_notif_recipient ON notification_recipients (notification_id, user_id);

CREATE TABLE notification_deliveries (                -- one row per external channel attempt
  id BIGSERIAL PRIMARY KEY, recipient_id TEXT NOT NULL REFERENCES notification_recipients(id),
  channel TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING|SENT|FAILED|SKIPPED
  provider_ref TEXT, error TEXT, attempted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- collapse the 4-rows-per-event legacy data to one recipient row per notification+user
DELETE FROM notification_recipients a USING notification_recipients b
 WHERE a.notification_id = b.notification_id AND a.user_id = b.user_id AND a.id > b.id;
```
(Verify column names against `001_core.sql`/`009_content.sql` — the DDL above follows the table list but the audit did not re-read every column.)

### B2.2 Seed the starter rules (permission-based, not role-name based)
```sql
INSERT INTO notification_rules (id,event_type,recipient_permission,channels,severity,dedupe_minutes,escalate_after_minutes,escalate_to_permission,requires_ack) VALUES
 ('payment-received','payment.recorded','payments.view','{IN_APP}','INFO',0,NULL,NULL,false),
 ('payment-mismatch','delivery.cash_mismatch','finance.view_reports','{IN_APP}','HIGH',0,1440,'roles.manage',true),
 ('order-confirmed','order.confirmed','production.view','{IN_APP}','INFO',0,NULL,NULL,false),
 ('qc-failed','job.qc_failed','production.view','{IN_APP}','HIGH',0,60,'roles.manage',false),
 ('low-stock','inventory.below_reorder','inventory.view','{IN_APP}','WARN',1440,NULL,NULL,false),
 ('refund-over-limit','payment.refund_requested','payments.approve_refund','{IN_APP}','HIGH',0,240,'roles.manage',true);
```
Use the permission keys that exist in your `permissions` table (see migrations `012`, `014`, `015`); new ones are added by the module files and `Optim_security_rbac.md`.

### B2.3 Corrected service
```ts
// server/services/notification.service.ts (replace publishEvent / notifyUser / getUserNotifications)
export async function dispatchEvent(tx: TxClient, ev: { id: number; type: string; data: any; orderRef?: string }) {
  const rules = (await tx.query(`SELECT * FROM notification_rules WHERE event_type=$1 AND active`, [ev.type])).rows;
  for (const rule of rules) {
    if (!matches(rule.condition, ev.data)) continue;
    const users = (await tx.query(
      `SELECT DISTINCT u.id FROM users u
         JOIN user_roles ur ON ur.user_id=u.id JOIN role_permissions rp ON rp.role_id=ur.role_id
         JOIN permissions p ON p.id=rp.permission_id
        WHERE p.key=$1 AND u.status='Active'`, [rule.recipient_permission])).rows;
    if (!users.length) { await emit(tx, { type: "notification.unrouted", entity: "rule", entityId: rule.id, data: { eventId: ev.id } }); continue; }
    const { title, body } = render(rule.id, ev.data);            // fills {{orderNumber}}, {{amount}}, {{customer}}
    const n = await insertNotification(tx, { eventId: ev.id, ruleId: rule.id, title, body, severity: rule.severity });
    for (const u of users) {
      if (await recentlyNotified(tx, u.id, rule, ev, rule.dedupe_minutes)) continue;
      const rec = await insertRecipient(tx, n.id, u.id);                  // ONE row per user
      for (const ch of rule.channels.filter((c: string) => c !== "IN_APP"))
        if (await userAllows(tx, u.id, ev.type, ch) && providerConfigured(ch))
          await queueDelivery(tx, rec.id, ch);                            // external rows only when real
    }
  }
}
// scoped read: only what this user was actually sent
export const listForUser = (tx: TxClient, userId: string, limit = 50) => tx.query(
  `SELECT n.*, r.read_at, r.acknowledged_at FROM notification_recipients r
     JOIN notifications n ON n.id=r.notification_id
    WHERE r.user_id=$1 ORDER BY n.created_at DESC LIMIT $2`, [userId, limit]);
```
Interim one-line fix for the data leak before any of this lands (store version):
```ts
getUserNotifications(userId: string, limit = 50): Notification[] {
  const mine = new Set(this.db.notificationRecipients.filter(r => r.userId === userId).map(r => r.notificationId));
  return this.db.notifications.filter(n => mine.has(n.id))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, mapNum(limit) || 50);
}
```
And fix preferences to read the body:
```ts
const { eventTypeId, channel, enabled } = req.body || {};      // was req.query.enabled
```

### B2.4 Real-time delivery
```ts
// server/routes/notifications.ts
router.get("/stream", requireAuth, (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const uid = sessionUserId(req);
  const off = bus.subscribe(uid, (n) => res.write(`data: ${JSON.stringify(n)}\n\n`));
  const ka = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => { off(); clearInterval(ka); });
});
```
`EventSource` cannot set an `Authorization` header: either use a short-lived stream ticket (`POST /notifications/stream-ticket` → `?t=`) or fetch-based SSE. As a first step, poll `GET /notifications/unread-count` every 30 s in `store.tsx`.

### B2.5 Escalation and SLA worker
A scheduled job (`node-cron`, every 5 min) that, for each rule with `escalate_after_minutes`, finds unread/unacknowledged recipients past the threshold and creates a second notification for `escalate_to_permission` plus a `notification.escalated` event. The same worker runs SLA checks owned by `Optim_analytics.md` (§B3).

## B3. Comments, @mentions, assignment and handoffs (new feature)
```sql
-- 025_comments.sql
CREATE TABLE entity_comments (
  id BIGSERIAL PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  author_id TEXT NOT NULL, body TEXT NOT NULL, mentions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), edited_at TIMESTAMPTZ
);
CREATE INDEX ON entity_comments (entity_type, entity_id, created_at);
ALTER TABLE orders ADD COLUMN assigned_to TEXT, ADD COLUMN handoff_state TEXT;  -- e.g. NEEDS_INFO_SALES, DESIGN_APPROVED
ALTER TABLE production_jobs ADD COLUMN assigned_to TEXT;
```
- API: `GET/POST /orders/:id/comments`, `GET/POST /production/jobs/:id/comments`, `PATCH /orders/:id/handoff`. Permissions: `comments.view`, `comments.create` (granted to every role that can already view the parent entity).
- Each post emits `comment.created`; mentions create a `notification` rule hit (`recipient` = mentioned users) through the same dispatcher.
- **UI (new):** a "Discussion" tab in the order drawer and job drawer (`production-view.tsx`, `module-table.tsx` drawers) with @mention autocomplete from `GET /users?role=…`, an "Assign to" select, and a handoff dropdown that shows "Needs info from sales" chips on the Kanban/job cards.

## B4. Audit trail — what changes
- Every transition and every money action calls `emit()` (see `Optim_architecture.md` §B1.2). `data` carries `{ old, new, reason, ip }`. Add a `diff(oldRow, newRow)` helper for PATCH-style edits (customers, expenses, catalogue prices).
- Routes that currently write nothing — expense `PATCH`/`DELETE` (`routes/expenses.ts`), catalogue price edits, customer edits — get an `emit()` call. Expense `DELETE` becomes a soft delete (`voided_at`, `void_reason`) owned by `Optim_finance.md`.
- **UI (new):** an "Activity" tab on orders, payments, jobs and customers, backed by `GET /audit?entityType=&entityId=`, plus a global Audit page (Admin / `audit.view`) with filters: actor, action, date, entity, and a diff viewer for `data.old`/`data.new`. CSV export.
- Notification lifecycle events (`notification.created/.delivered/.read/.acknowledged/.failed`) are written so "was the refund-over-limit alert seen?" has an answer.

## B5. Notification UI changes (existing elements)
| Element | Today | Change |
|---|---|---|
| Bell (`topbar.tsx`) | list + badge | Badge from `unread-count` (now one row per user); tabs All/Unread/Needs action; severity icon; "Acknowledge" button where `requires_ack` |
| Notification item | generic template text | Rendered title/body with order number, customer, amount; deep link to the filtered record |
| Preferences panel | exists | Matrix event × channel; disable channels with no provider (shows "Not configured"); quiet hours; daily digest toggle |
| New: Notification centre page | — | Full history with filters; admin-only "Rule editor" over `notification_rules` (permission, channels, dedupe, escalation) |
| New: WhatsApp quick action | — | For customer-facing reminders, a `wa.me/<number>?text=` button that prefills the template (see `Optim_crm.md`), logged as an interaction |

## B6. Unified impact matrix
| Change | DB | Back end | RBAC | Front end | Other modules |
|---|---|---|---|---|---|
| Recipient scoping | none | `listForUser` | none | bell | all (stops leak) |
| `domain_events` | 023 | `emit()` in every transition | `audit.view` (already exists in `routes/rbac.ts`) | Activity tab, Audit page | Analytics milestones, Finance journal posting |
| Rules engine | 024 | `dispatchEvent`, worker | `notifications.manage_rules` | Rule editor | every module's alert list |
| Comments/handoffs | 025 | comment routes | `comments.*` | Discussion tab | Orders, Production, Deliveries |
| SSE | none | `/stream` | auth | `store.tsx` subscription | all |

## B7. Tests
- A user without a recipient row gets none of another user's notifications.
- An event matching a rule creates exactly one notification and one recipient row per permitted user.
- Disabling SMS in preferences means no `SMS` delivery row.
- Rolled-back transaction → no event, no notification.
- Escalation fires once after the threshold.
