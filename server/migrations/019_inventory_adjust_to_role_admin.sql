-- 019: Ensure the Admin / Proprietor role includes the inventory.adjust
-- permission even on non-fresh databases where `db:seed` never re-runs.
--
-- Idempotent: safe to re-run (ON CONFLICT DO NOTHING catches both the
-- primary-key (id) and the (role_id, permission_id) unique constraints).
--
-- Cache note: role_permissions are mirrored into the in-memory store cache
-- (store.rolePermissions / rbacService) at boot. After applying this
-- migration to a running server, restart the API process so the in-memory
-- RBAC cache reloads from the database; otherwise /api/inventory/adjust may
-- still 403 for Admin/Proprietor until restart.
INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT 'rp-admin-invadj-' || p.id, 'role-admin', p.id, now(), now()
FROM permissions p
WHERE p.key = 'inventory.adjust'
ON CONFLICT DO NOTHING;
