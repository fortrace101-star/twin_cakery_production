import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const requireFromFrontend = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "erp-interface-design", "package.json"),
);
const dotenvModule = requireFromFrontend("dotenv") as { config: () => void };
dotenvModule.config();
import { pool } from "./server/database/db.ts";
const { randomBytes } = requireFromFrontend("crypto");
function makeId(prefix: string) { return `${prefix}-${randomBytes(4).toString("hex")}`; }
(async () => {
  await pool.query(`INSERT INTO production_fixed_cost_categories (id, name, description, cost_type, unit, default_unit_cost, active) VALUES
    ($1,$2,$3,$4,$5,$6,$7),
    ($8,$9,$10,$11,$12,$13,$14)
  ON CONFLICT (id) DO NOTHING`, [
    makeId("fcc"), "Utilities", "Bakehouse electricity/gas allocations", "perJob", "", 4500, true,
    makeId("fcc"), "Packaging", "Box/band/label overhead per job", "perJob", "", 1200, true,
  ]);
  const r = await pool.query(`SELECT COUNT(*)::int AS c FROM production_fixed_cost_categories`);
  console.log("cats", r.rows[0].c);
  await pool.end();
  process.exit(0);
})();
