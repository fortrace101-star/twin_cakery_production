-- 014: Role → permission grants for the non-admin roles.
-- Until now only role-admin received role_permissions (seed.ts) — Production /
-- Sales / CSR users had ZERO permissions, which made every required() route
-- 403 for them and would have emptied a permission-aware navigation bar.
-- Grants mirror the file-store baseline (server/database/index.ts) plus the
-- spec's "Sales needs delegation to confirm" rule (Updated doc) and a
-- view-only catalogue grant so staff can browse products.
-- Safe to re-run: UNIQUE (role_id, permission_id) + ON CONFLICT DO NOTHING.

-- Production Manager: runs jobs, stock, purchasing, deliveries end-to-end.
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
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sales Manager: orders/quotes/inquiries + analytics + payments + tracking.
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
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- CSR: inbound support — customers, inquiries, interactions, feedback.
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-csr-' || p.id, 'role-csr', p.id FROM permissions p
WHERE p.key IN (
  'orders.view','inquiries.view','inquiries.create',
  'customers.view','customers.create','customers.interact',
  'feedback.view','feedback.create','quotations.view','catalogue.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;