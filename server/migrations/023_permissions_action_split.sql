-- 023: Permission action split (SEC-07)
-- Route guards now name the action each key controls. Old keys are kept as
-- aliases (rbac.service PERMISSION_ALIASES) for one release; admin + the roles
-- below get both old and new grants so nothing 403s mid-deploy.
-- Safe to re-run: all INSERTs are ON CONFLICT DO NOTHING.

-- New action-level permission keys -------------------------------------------------------------
INSERT INTO permissions (id, key) VALUES
  ('perm-quotations-send', 'quotations.send')          ON CONFLICT (key) DO NOTHING,
  ('perm-analytics-operations', 'analytics.operations') ON CONFLICT (key) DO NOTHING,
  ('perm-analytics-finance', 'analytics.finance')       ON CONFLICT (key) DO NOTHING,
  ('perm-analytics-customers', 'analytics.customers')   ON CONFLICT (key) DO NOTHING,
  ('perm-analytics-staff', 'analytics.staff')           ON CONFLICT (key) DO NOTHING,
  ('perm-payments-refund', 'payments.refund')           ON CONFLICT (key) DO NOTHING,
  ('perm-payments-confirm-remittance', 'payments.confirm_remittance') ON CONFLICT (key) DO NOTHING,
  ('perm-expenses-approve', 'expenses.approve')         ON CONFLICT (key) DO NOTHING,
  ('perm-orders-override-price', 'orders.override_price') ON CONFLICT (key) DO NOTHING,
  ('perm-inventory-approve-writeoff', 'inventory.approve_writeoff') ON CONFLICT (key) DO NOTHING,
  ('perm-inventory-view-costs', 'inventory.view_costs') ON CONFLICT (key) DO NOTHING,
  ('perm-finance-view-margins', 'finance.view_margins') ON CONFLICT (key) DO NOTHING,
  ('perm-orders-view-all', 'orders.view_all')           ON CONFLICT (key) DO NOTHING,
  ('perm-deliveries-view-all', 'deliveries.view_all')   ON CONFLICT (key) DO NOTHING,
  ('perm-customers-view-all', 'customers.view_all')     ON CONFLICT (key) DO NOTHING,
  ('perm-production-view-all', 'production.view_all')   ON CONFLICT (key) DO NOTHING
ON CONFLICT (key) DO NOTHING;

-- Backfill: grant new keys to roles that held the parent key ------------------------------------
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-023-' || p.id, 'role-admin', p.id FROM permissions p
WHERE p.key IN (
  'quotations.send',        -- admin already had quotations.accept
  'analytics.operations',   -- admin already had sales.analytics
  'analytics.finance',
  'analytics.customers',
  'analytics.staff',
  'payments.refund',
  'payments.confirm_remittance',
  'expenses.approve',
  'orders.override_price',
  'inventory.approve_writeoff',
  'inventory.view_costs',
  'finance.view_margins',
  'orders.view_all',
  'deliveries.view_all',
  'customers.view_all',
  'production.view_all'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Matching grant for role-production (already carried most shipment ops)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-023-prod-' || p.id, 'role-production', p.id FROM permissions p
WHERE p.key IN (
  'deliveries.update', 'inventory.view_costs', 'production.view_all'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Matching grant for role-sales (orders.create + confirmations already held; quotes could already accept)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-023-sales-' || p.id, 'role-sales', p.id FROM permissions p
WHERE p.key IN (
  'quotations.send', 'analytics.operations', 'analytics.customers'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Matching grant for role-csr
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-023-csr-' || p.id, 'role-csr', p.id FROM permissions p
WHERE p.key IN ('deliveries.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;
