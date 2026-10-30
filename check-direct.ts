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
  const rows = await pool.query(`SELECT tablename FROM pg_tables WHERE tablename IN ('suppliers','production_fixed_cost_categories','production_fixed_cost_entries','production_costs','production_jobs') ORDER BY tablename`);
  console.log("tables", rows.rows.map((r:any)=>r.tablename));
  const r2 = await pool.query(`SELECT COUNT(*)::int AS c FROM suppliers`);
  console.log("suppliers", r2.rows[0].c);
  const r3 = await pool.query(`SELECT COUNT(*)::int AS c FROM production_fixed_cost_categories`);
  console.log("cats", r3.rows[0].c);
  await pool.end();
  process.exit(0);
})();
