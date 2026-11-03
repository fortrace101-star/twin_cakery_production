import fs from 'fs';
import path from 'path';

const root = process.cwd();
const optimMd = path.join(root, 'Optim', 'Optim.md');
const uiFeat = path.join(root, 'skills', 'optim', 'references', 'ui-features.md');

const text = fs.readFileSync(uiFeat, 'utf8');
const modulesMap = {};
const modRe = /^## ([A-Z]+):/gm;
let m;
while ((m = modRe.exec(text)) !== null) {
  const mod = m[1];
  const start = text.indexOf(`## ${mod}:`);
  const end = text.indexOf('\n## ', start + 1);
  const sec = end === -1 ? text.slice(start) : text.slice(start, end);
  const rows = [];
  for (const line of sec.split(/\r?\n/)) {
    if (line.trim().startsWith('| UI-')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 7) {
        rows.push({id: parts[1], kind: parts[2], target: parts[3], element: parts[4], supports: parts[5]});
      }
    }
  }
  modulesMap[mod] = rows;
}

let content = fs.readFileSync(optimMd, 'utf8');
for (const [mod, rows] of Object.entries(modulesMap)) {
  const mstart = content.indexOf(`## ${mod}:`);
  if (mstart === -1) continue;
  const mend = content.indexOf('\n## ', mstart + 1);
  const section = mend === -1 ? content.slice(mstart) : content.slice(mstart, mend);
  const scopeRe = /### UI scope\n.*?(?=\n### |\Z)/s;
  const scopeMatch = section.match(scopeRe);
  if (!scopeMatch) continue;
  const tableLines = [];
  tableLines.push('| ID | Kind | Target | Element / behaviour | Supports | Source |');
  tableLines.push('|---|---|---|---|---|---|');
  for (const r of rows) {
    tableLines.push(`| ${r.id} | ${r.kind} | ${r.target} | ${r.element} | ${r.supports} | catalogue |`);
  }
  const newUi = `### UI features\nThe module's UI work, drafted at execution time.\n<!-- UI-PLAN:BEGIN -->\n**Drafted for execution:** no (seeded from catalogue only)\n\n${tableLines.join('\n')}\n<!-- UI-PLAN:END -->\n`;
  const newSection = section.slice(0, scopeMatch.index) + newUi + section.slice(scopeMatch.index + scopeMatch[0].length);
  content = content.slice(0, mstart) + newSection + (mend === -1 ? '' : content.slice(mend));
}
fs.writeFileSync(optimMd, content);
console.log('done');
