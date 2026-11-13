-- 024: Production workflow — DECORATING status + production.set_ready permission
-- The Production Layout plan replaces QC pass/fail + rework with a single
-- "Set to Ready" guard. The DB keeps production_jobs.status as plain TEXT, so
-- the new status value (and its label) lives in the TypeScript enum in
-- server/database/types.ts only; this migration adds:
--   - production.set_ready permission key (guarded POST /production/jobs/:id/ready)
--   - role-admin + role-production grants for it
-- Safe to re-run (ON CONFLICT DO NOTHING).

-- New permission key -----------------------------------------------------------
INSERT INTO permissions (id, key) VALUES
  ('perm-production-set-ready', 'production.set_ready')
ON CONFLICT (key) DO NOTHING;

-- Route guards reference the new key; Admin / Proprietor and the Production
-- Manager role own it. role-admin was already granted the production.* family
-- in 014_role_permissions.sql, so only role-production needs this explicit row.
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-setready-admin-' || p.id, 'role-admin', p.id
FROM permissions p
WHERE p.key = 'production.set_ready'
  AND EXISTS (SELECT 1 FROM roles WHERE id = 'role-admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-setready-prod-' || p.id, 'role-production', p.id
FROM permissions p
WHERE p.key = 'production.set_ready'
  AND EXISTS (SELECT 1 FROM roles WHERE id = 'role-production')
ON CONFLICT (role_id, permission_id) DO NOTHING;
