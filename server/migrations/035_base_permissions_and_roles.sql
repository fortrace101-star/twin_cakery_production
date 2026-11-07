-- 035: Base permission keys + core roles + base grants (idempotent bootstrap)
-- Ensures a fresh/migrated DB has the permission rows, roles, and baseline
-- role->permission grants that the UI (module gating) and earlier migrations
-- (014/015/013) expect. Safe to re-run.

-- Core roles (guarded grants in 012-015,017,023,034 check for these)
INSERT INTO roles (id, name, label, active, granted_at, created_at, updated_at)
VALUES
  ('role-admin',      'Admin / Proprietor', 'Admin / Proprietor', TRUE, now(), now(), now()),
  ('role-production', 'Production Manager', 'Production Manager', TRUE, now(), now(), now()),
  ('role-sales',      'Sales Manager',      'Sales Manager',      TRUE, now(), now(), now()),
  ('role-csr',        'Customer Service',   'Customer Service',   TRUE, now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- Base permission keys (frontend module gating + keys referenced by 013/014/015 grants)
INSERT INTO permissions (id, key) VALUES
  ('perm-customers-view','customers.view'),
  ('perm-orders-view','orders.view'),
  ('perm-catalogue-view','catalogue.view'),
  ('perm-content-view','content.view'),
  ('perm-production-view','production.view'),
  ('perm-inventory-view','inventory.view'),
  ('perm-purchasing-view','purchasing.view'),
  ('perm-deliveries-view','deliveries.view'),
  ('perm-finance-view','finance.view'),
  ('perm-sales-analytics','sales.analytics'),
  ('perm-users-manage','users.manage'),
  ('perm-staff-view','staff.view'),
  ('perm-production-schedule','production.schedule'),
  ('perm-production-start','production.start'),
  ('perm-production-complete','production.complete'),
  ('perm-production-quality-check','production.quality_check'),
  ('perm-production-record-wastage','production.record_wastage'),
  ('perm-production-record-consumption','production.record_consumption'),
  ('perm-inventory-adjust','inventory.adjust'),
  ('perm-inventory-reserve','inventory.reserve'),
  ('perm-inventory-consume','inventory.consume'),
  ('perm-purchasing-create','purchasing.create'),
  ('perm-purchasing-receive','purchasing.receive'),
  ('perm-deliveries-create','deliveries.create'),
  ('perm-deliveries-dispatch','deliveries.dispatch'),
  ('perm-deliveries-complete','deliveries.complete'),
  ('perm-orders-create','orders.create'),
  ('perm-orders-cancel','orders.cancel'),
  ('perm-orders-confirm','orders.confirm'),
  ('perm-quotations-view','quotations.view'),
  ('perm-quotations-create','quotations.create'),
  ('perm-quotations-accept','quotations.accept'),
  ('perm-inquiries-view','inquiries.view'),
  ('perm-inquiries-create','inquiries.create'),
  ('perm-customers-create','customers.create'),
  ('perm-customers-edit','customers.edit'),
  ('perm-customers-interact','customers.interact'),
  ('perm-feedback-view','feedback.view'),
  ('perm-feedback-create','feedback.create'),
  ('perm-payments-view','payments.view'),
  ('perm-payments-record','payments.record')
ON CONFLICT (key) DO NOTHING;

-- Baseline role grants (mirrors 014; idempotent)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-prod-' || p.id, 'role-production', p.id FROM permissions p
WHERE p.key IN (
  'production.view','production.schedule','production.start','production.complete',
  'production.quality_check','production.record_wastage','production.record_consumption',
  'inventory.view','inventory.adjust','inventory.reserve','inventory.consume',
  'purchasing.view','purchasing.create','purchasing.receive',
  'deliveries.view','deliveries.create','deliveries.dispatch','deliveries.complete',
  'orders.view','orders.confirm','customers.view','catalogue.view'
)
  AND EXISTS (SELECT 1 FROM roles WHERE id = 'role-production')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-sales-' || p.id, 'role-sales', p.id FROM permissions p
WHERE p.key IN (
  'orders.view','orders.create','orders.cancel','orders.confirm',
  'quotations.view','quotations.create','quotations.accept',
  'inquiries.view','inquiries.create',
  'customers.view','customers.create','customers.edit',
  'feedback.view','feedback.create',
  'sales.analytics','payments.view','payments.record',
  'deliveries.view','catalogue.view'
)
  AND EXISTS (SELECT 1 FROM roles WHERE id = 'role-sales')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-csr-' || p.id, 'role-csr', p.id FROM permissions p
WHERE p.key IN (
  'orders.view','inquiries.view','inquiries.create',
  'customers.view','customers.create','customers.interact',
  'feedback.view','feedback.create','quotations.view','catalogue.view'
)
  AND EXISTS (SELECT 1 FROM roles WHERE id = 'role-csr')
ON CONFLICT (role_id, permission_id) DO NOTHING;
