// Temporary script to query PostgreSQL RBAC tables
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:90210@localhost:5432/twin_cakery',
  ssl: false,
});

(async () => {
  const c = await pool.connect();
  try {
    // 1. Roles
    const roles = await c.query('SELECT id, name, label, active FROM roles ORDER BY id');
    console.log('=== ROLES ===');
    console.table(roles.rows);

    // 2. inventory permissions
    const perms = await c.query(
      "SELECT id, key FROM permissions WHERE key LIKE 'inventory%' ORDER BY key"
    );
    console.log('=== PERMISSIONS (inventory%) ===');
    console.table(perms.rows);

    // 3. role_permissions for inventory.adjust + inventory.view
    const rp = await c.query(`
      SELECT rp.role_id, p.key
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE p.key IN ('inventory.view', 'inventory.adjust')
      ORDER BY rp.role_id, p.key
    `);
    console.log('=== ROLE_PERMISSIONS (inventory.view, inventory.adjust) ===');
    console.table(rp.rows);

    // 4. user_roles with username and user.role label
    const ur = await c.query(`
      SELECT ur.user_id, u.username, u.role AS user_label, ur.role_id
      FROM user_roles ur
      JOIN users u ON ur.user_id = u.id
      ORDER BY ur.role_id, u.username
    `);
    console.log('=== USER_ROLES ===');
    console.table(ur.rows);

    // 5. users table (for token-based auth context)
    const users = await c.query(
      'SELECT id, username, display_name, role, is_admin, status FROM users ORDER BY username'
    );
    console.log('=== USERS ===');
    console.table(users.rows);

    // 6. Migrations applied
    const migrations = await c.query(
      'SELECT id, name, applied_at FROM _migrations ORDER BY id'
    );
    console.log('=== MIGRATIONS APPLIED ===');
    console.table(migrations.rows);
  } finally {
    c.release();
    await pool.end();
  }
})().catch((e) => {
  console.error('DB ERROR:', e.message);
  process.exit(1);
});
