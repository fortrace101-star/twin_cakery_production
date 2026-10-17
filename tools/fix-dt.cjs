const fs = require("fs");
const p = "erp-interface-design/src/components/data-table/DataTable.tsx";
const raw = fs.readFileSync(p, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(eol);
// remove line 54 (index 53) which is the duplicate "  rowClassName,"
if (lines[53] !== "  rowClassName,") { console.log("unexpected line 54:", JSON.stringify(lines[53])); process.exit(1); }
lines.splice(53, 1);
fs.writeFileSync(p, lines.join(eol));
console.log("removed duplicate; count now", (lines.join(eol).match(/rowClassName/g) || []).length);
