import { pool } from './database/db.js';
(async () => {
  const roles = await pool.query(`SELECT id, name, label, active FROM roles ORDER BY id`);
  console.log('=== ROLES ===');
  console.table(roles.rows);
  const perms = await pool.query(`SELECT id, key FROM permissions ORDER BY id`);
  console.log('=== PERMISSIONS ===');
  console.table(perms.rows);
  const rp = await pool.query(`SELECT rp.role_id, p.key FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id ORDER BY rp.role_id, p.key`);
  console.log('=== ROLE_PERMISSIONS ===');
  console.table(rp.rows);
  const users = await pool.query(`SELECT id, username, display_name, role, is_admin, status FROM users ORDER BY id`);
  console.log('=== USERS ===');
  console.table(users.rows);
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
