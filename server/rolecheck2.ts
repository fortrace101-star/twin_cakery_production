import { pool } from './database/db.js';
(async () => {
  const rows = await pool.query(`SELECT id, permission_id FROM role_permissions ORDER BY role_id`);
  const permIds = new Set(rows.rows.map(r => r.permission_id));
  console.log('role_permissions rows:', rows.rows.length);
  console.log('distinct permission_ids:', permIds.size);
  console.log('INSERTED role_permissions ids:', rows.rows.map(r => r.id));
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
