-- Twin Cakery ERP — 008 customer order history, events & recurring reminders
-- E1 extension (governing architecture doc §5 "Customer Order History & Repeat-Order
-- Intelligence", rules 26-29). Purely additive: no existing table is altered, every
-- statement is IF NOT EXISTS so the runner is idempotent (see _migrations tracking).

-- Immutable snapshot of the customer/contact details captured at order time.
-- Rule: "Historical order snapshots must remain unchanged after a customer profile
-- is edited" — exactly one snapshot per order, never rewritten. Name-only matching
-- is forbidden: orders still FK to the canonical customers.id, this only preserves
-- what the contact looked like when the order was placed.
CREATE TABLE IF NOT EXISTS order_customer_snapshots (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  snapshot_name TEXT NOT NULL,
  snapshot_phone TEXT NOT NULL DEFAULT '',
  snapshot_email TEXT NOT NULL DEFAULT '',
  snapshot_address TEXT NOT NULL DEFAULT '',
  snapshot_preferred_contact TEXT NOT NULL DEFAULT '',
  captured_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_customer_snapshots_customer ON order_customer_snapshots(customer_id);

-- Customer occasions/events (birthdays, wedding anniversaries, graduations) tied to
-- a customer and optionally to the order that originated them. Backs the
-- GET|POST /customers/:id/events endpoints and the Occasion filter in order history.
CREATE TABLE IF NOT EXISTS customer_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_date DATE NOT NULL,
  recurrence_rule TEXT NOT NULL DEFAULT 'ANNUAL',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_events_customer ON customer_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_events_order ON customer_events(order_id);
CREATE INDEX IF NOT EXISTS idx_customer_events_date ON customer_events(event_date);

-- Internal reminder generated for a future occurrence of a customer event. The system
-- must NEVER auto-contact the customer — staff mark a reminder Reminded/Contacted and
-- record the outcome. Backs GET /customer-reminders (next 7/30 days, month, week) and
-- PATCH /customer-reminders/:id/contacted, plus the dashboard Notifications area.
CREATE TABLE IF NOT EXISTS customer_event_reminders (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES customer_events(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  reminder_for_date DATE NOT NULL,
  next_reminder_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  last_contacted_at TIMESTAMPTZ,
  contacted_by TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT '',
  follow_up_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_event_reminders_customer ON customer_event_reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_event_reminders_next ON customer_event_reminders(next_reminder_at);
CREATE INDEX IF NOT EXISTS idx_customer_event_reminders_event ON customer_event_reminders(event_id);
