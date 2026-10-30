import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const requireFromFrontend = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "erp-interface-design", "package.json"),
);
const dotenvModule = requireFromFrontend("dotenv") as { config: () => void };
dotenvModule.config();
import { pool } from "./server/database/db.ts";
(async () => {
  const r = await pool.query(`SELECT id, business_name FROM suppliers ORDER BY id LIMIT 5`);
  console.log("suppliers", r.rows.map((x:any)=>x.business_name));
  const c = await pool.query(`SELECT id, name FROM production_fixed_cost_categories ORDER BY id LIMIT 5`);
  console.log("cats", c.rows.map((x:any)=>x.name));
  await pool.end();
  process.exit(0);
})();
