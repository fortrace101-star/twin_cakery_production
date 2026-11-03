import { pool } from './database/db.js';
(async () => {
  const rows = await pool.query(`SELECT rp.role_id, p.key FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id ORDER BY rp.role_id`);
  const byRole = new Map<string, string[]>();
  for (const r of rows.rows) {
    if (!byRole.has(r.role_id)) byRole.set(r.role_id, []);
    byRole.get(r.role_id)!.push(r.key);
  }
  for (const [role, perms] of byRole) {
    console.log(role, perms.length, perms.join(', '));
  }
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
