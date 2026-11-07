-- 013: production.record_consumption (manual material usage entry on a job).
-- The seed's PERMS list is static and live DBs skip seeding (users > 0), so
-- live databases never received the key, and RBAC has no admin bypass —
-- mirroring 012, the key + role mappings land here. Safe to re-run (CONFLICT
-- on key / role+permission are no-ops).
INSERT INTO permissions (id, key) VALUES
  ('perm-production-record-consumption', 'production.record_consumption')
ON CONFLICT (key) DO NOTHING;

-- Admin owns everything; the Production Manager runs the job board day-to-day
-- (the file-store seed already grants the production.* family to that role).
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-admin-' || p.id, 'role-admin', p.id
FROM permissions p
WHERE p.key = 'production.record_consumption'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-production-' || p.id, 'role-production', p.id
FROM permissions p
WHERE p.key = 'production.record_consumption'
ON CONFLICT (role_id, permission_id) DO NOTHING;
