import { pool } from './database/db.js';
(async () => {
  const rows = await pool.query(`SELECT ur.user_id, r.name, r.id FROM user_roles ur JOIN roles r ON ur.role_id = r.id ORDER BY ur.user_id`);
  console.log('=== user_roles ===');
  console.table(rows.rows);
  const users = await pool.query(`SELECT id, username, display_name, role, is_admin, status FROM users ORDER BY id`);
  console.log('=== users ===');
  console.table(users.rows);
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
