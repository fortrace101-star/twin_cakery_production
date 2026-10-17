const fs = require("fs");
const p = "erp-interface-design/src/components/data-table/DataTable.tsx";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
lines.forEach((l, i) => {
  if (l.includes("rowClassName")) console.log((i + 1) + ":" + JSON.stringify(l));
});
