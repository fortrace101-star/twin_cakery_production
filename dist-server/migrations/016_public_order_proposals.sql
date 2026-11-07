-- Twin Cakery ERP — 016 public order proposals (Postgres 16+)
--
-- E6 (governing architecture doc §§29–31): the public website's order form must
-- persist into the ERP so staff can review → confirm into the normal pipeline.
-- Until now POST /public/order-proposals built an in-memory object, never saved
-- it, and returned totals of 0 — proposals vanished on restart and never
-- reached CRM.
--
-- Data flow: website order form → POST /api/v1/public/order-proposals
-- (server-validated vs the live catalogue) → order_proposals (+ items) →
-- linked inquiry (source ORDER_FORM, channel Website) → CSR/Admin notified →
-- staff confirm (POST /order-proposals/:id/confirm) creates the order draft.
--
-- FK-safe by design: proposals store the raw contact fields (name/phone/email)
-- and an OPTIONAL customer_id that is only set when an existing customer is
-- matched — never a NOT NULL FK to a row that may not exist (the old public
-- inquiry route wrote customer_id "public-<ts>" and 500'd the write-back).
-- Purely additive and idempotent (IF NOT EXISTS) so the runner is safe to re-run.

-- ---------------------------------------------------------------------------
-- Order proposals: one row per website order-form submission.
-- status: PENDING_REVIEW | CONFIRMED | CANCELLED.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_proposals (
  id TEXT PRIMARY KEY,
  proposal_number TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  product_summary TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  preferred_date DATE,
  preferred_time TEXT NOT NULL DEFAULT '',
  delivery_type TEXT NOT NULL DEFAULT 'PICKUP',
  delivery_location TEXT NOT NULL DEFAULT '',
  customer_notes TEXT NOT NULL DEFAULT '',
  reference_image TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  inquiry_id TEXT REFERENCES inquiries(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_proposals_status ON order_proposals(status);
CREATE INDEX IF NOT EXISTS idx_order_proposals_customer ON order_proposals(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_proposals_created ON order_proposals(created_at);

-- ---------------------------------------------------------------------------
-- Proposal items: one row per product line (validated vs live catalogue).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_proposal_items (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES order_proposals(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  variant_options TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_proposal_items_proposal ON order_proposal_items(proposal_id);
