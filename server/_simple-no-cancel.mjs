import { query } from "./database/db.js";

(async ()=>{
  const t = await query("SELECT rp.role_id, p.key FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id=$1 AND p.key=$2", ["role-admin", "orders.edit"]);
  console.log("orders.edit:", JSON.stringify(t.rows));
})();
