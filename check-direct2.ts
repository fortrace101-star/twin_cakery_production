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
  await pool.end();
  console.log("closed");
  process.exit(0);
})();
