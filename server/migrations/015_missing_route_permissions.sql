-- 015: Route permissions that the live database is missing (E4 gate exposed
-- them: /finance/reports, /deliveries/:id/cancel, /feedback updates,
-- /inquiries + /quotations edits returned 403 for EVERY role — including
-- Admin — because the permission keys did not exist). The current seed.ts
-- already lists finance.view_reports + deliveries.cancel; feedback.update,
-- inquiries.edit and quotations.edit are added there too. Safe to re-run.
INSERT INTO permissions (id, key) VALUES
  ('perm-deliveries-cancel','deliveries.cancel'),
  ('perm-feedback-update','feedback.update'),
  ('perm-finance-view-reports','finance.view_reports'),
  ('perm-inquiries-edit','inquiries.edit'),
  ('perm-quotations-edit','quotations.edit')
ON CONFLICT (id) DO NOTHING;

-- Admin / Proprietor owns everything.
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-admin-' || p.id, 'role-admin', p.id FROM permissions p
WHERE p.key IN ('deliveries.cancel','feedback.update','finance.view_reports','inquiries.edit','quotations.edit')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Operational ownership: Production runs deliveries; Sales edits quotes and
-- inquiries; CSR resolves feedback.
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-prod-' || p.id, 'role-production', p.id FROM permissions p
WHERE p.key IN ('deliveries.cancel')
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-sales-' || p.id, 'role-sales', p.id FROM permissions p
WHERE p.key IN ('quotations.edit','inquiries.edit')
ON CONFLICT (role_id, permission_id) DO NOTHING;
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-csr-' || p.id, 'role-csr', p.id FROM permissions p
WHERE p.key IN ('feedback.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;