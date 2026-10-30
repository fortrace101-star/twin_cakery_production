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
function makeId(prefix: string) {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}
(async () => {
  await pool.query(`INSERT INTO suppliers (id, business_name, contact_person, phone, email, address, products_supplied, payment_terms, notes, active) VALUES
    ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10),
    ($11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
  ON CONFLICT (id) DO UPDATE SET business_name=EXCLUDED.business_name`, [
    makeId("sup"), "Bakers Supply Co.", "Supply Desk", "+256 700 100 001", "orders@bakerssupply.ug", "Kampala", "Flour; cocoa; sugar", "Net 15", "", true,
    makeId("sup"), "Fresh Dairy Uganda", "Dairy Desk", "+256 700 100 002", "orders@freshdairy.ug", "Kampala", "Butter; cream; eggs", "Net 30", "", true,
  ]);
  const r = await pool.query(`SELECT COUNT(*)::int AS c FROM suppliers`);
  console.log("suppliers", r.rows[0].c);
  await pool.end();
  process.exit(0);
})();
