-- 037: Order editing foundation (spec: order-editing-feature.md)
-- Adds editable order fields, optimistic-lock version, revision history table,
-- and permissions for order editing. Idempotent / safe to re-run.

-- New order columns (model + UI already expect these conceptually)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reference TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_count INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_name TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Revision history (one row per saved edit)
CREATE TABLE IF NOT EXISTS order_revisions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  changed_by TEXT NOT NULL DEFAULT '',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL DEFAULT '',
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_before NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_after NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_revisions_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_order_revisions_order_id ON order_revisions(order_id);

-- Permissions
INSERT INTO permissions (id, key) VALUES
  ('perm-orders-update', 'orders.update'),
  ('perm-orders-update-price', 'orders.update_price'),
  ('perm-orders-update-locked', 'orders.update_locked')
ON CONFLICT (key) DO NOTHING;

-- Role defaults: Admin gets all three; Sales gets update + price; Production and
-- CSR get update (scoped by status rules in the endpoint).
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-admin-' || p.id, 'role-admin', p.id FROM permissions p
WHERE p.key IN ('orders.update','orders.update_price','orders.update_locked')
  AND EXISTS (SELECT 1 FROM roles WHERE id = 'role-admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-sales-' || p.id, 'role-sales', p.id FROM permissions p
WHERE p.key IN ('orders.update','orders.update_price')
  AND EXISTS (SELECT 1 FROM roles WHERE id = 'role-sales')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-prod-' || p.id, 'role-production', p.id FROM permissions p
WHERE p.key IN ('orders.update')
  AND EXISTS (SELECT 1 FROM roles WHERE id = 'role-production')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-csr-' || p.id, 'role-csr', p.id FROM permissions p
WHERE p.key IN ('orders.update')
  AND EXISTS (SELECT 1 FROM roles WHERE id = 'role-csr')
ON CONFLICT (role_id, permission_id) DO NOTHING;
