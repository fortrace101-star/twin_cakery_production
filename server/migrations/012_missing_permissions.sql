-- 013: finance.view_reports landed in seed.ts AFTER the DB was first seeded.
-- The seed skips non-empty databases (users > 0), so live DBs never received
-- it, and RBAC has no admin bypass — role-admin was locked out of the finance
-- report endpoint. content.edit already exists, so only the missing key goes
-- here. Safe to re-run (CONFLICT on key / role+permission are no-ops).
INSERT INTO permissions (id, key) VALUES
  ('perm-finance-view-reports', 'finance.view_reports'),
  ('perm-content-edit', 'content.edit')
ON CONFLICT (key) DO NOTHING;

-- Map the new permissions to Admin / Proprietor (the seed's only mapped role),
-- with stable ids so re-running the migration is a no-op.
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-admin-' || p.id, 'role-admin', p.id
FROM permissions p
WHERE p.key IN ('finance.view_reports', 'content.edit')
ON CONFLICT (role_id, permission_id) DO NOTHING;
