import { ready, getDb } from "./server/database/index.new.ts";
console.log("start");
ready.then(()=>{ console.log("loaded", getDb().suppliers.length, getDb().productionFixedCostCategories.length); process.exit(0); });
