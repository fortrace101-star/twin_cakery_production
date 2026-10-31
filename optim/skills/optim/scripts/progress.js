#!/usr/bin/env node
/**
 * Recompute the summary table and per-module Status in Optim_progress.md.
 *
 * Usage: node skills/optim/scripts/progress.js [path/to/Optim_progress.md] [--check]
 *
 * Counted lines start at column 0:   - [x] FIN-03 ...   or   - [ ] UI-FIN-02 ...
 * States: [ ] todo, [~] in progress (counts 0), [x] done, [-] not applicable (excluded from the total).
 * Indented sub-tasks are ignored. The Status line is rewritten unless it starts with "Blocked".
 * --check prints the table and exits 1 if the file would change (does not write).
 */
const fs = require("fs");

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--")) || "Optim/Optim_progress.md";
const check = args.includes("--check");

const text = fs.readFileSync(file, "utf8");
const itemRe = /^- \[([ ~x-])\] (UI-[A-Z]+-\d+|[A-Z]+-\d+)(?=[\s:\]])/gm;
const modRe = /(<!-- MODULE:([A-Z]+):BEGIN -->)([\s\S]*?)(<!-- MODULE:\2:END -->)/g;
const nameRe = /^## (.+?) \(`([A-Z]+)`\)/gm;

const names = {};
for (const m of text.matchAll(nameRe)) names[m[2]] = m[1];

function counts(block) {
  const g = { done: 0, prog: 0, na: 0, total: 0 };
  const u = { done: 0, prog: 0, na: 0, total: 0 };
  for (const m of block.matchAll(itemRe)) {
    const [, st, id] = m;
    const t = id.startsWith("UI-") ? u : g;
    t.total += 1;
    if (st === "x") t.done += 1;
    if (st === "~") t.prog += 1;
    if (st === "-") t.na += 1;
  }
  return [g, u];
}

const pct = (done, total, na) => {
  const den = total - na;
  return den <= 0 ? 0 : Math.round((100 * done) / den);
};

const rows = [];

let newText = text.replace(modRe, (whole, begin, mid, block, end) => {
  const [g, u] = counts(block);
  const gden = g.total - g.na;
  const uden = u.total - u.na;
  const done = g.done + u.done;
  const den = gden + uden;
  const overall = den <= 0 ? 0 : Math.round((100 * done) / den);
  const anyProg = g.prog + u.prog + done > 0;
  // Complete only when everything is done AND a UI checklist has been generated.
  const complete = den > 0 && done === den && uden > 0;
  const status = complete ? "Complete" : anyProg ? "In progress" : "Not started";

  const block2 = block.replace(/^- \*\*Status:\*\* (.*)$/m, (all, cur) =>
    cur.trim().startsWith("Blocked") ? all : `- **Status:** ${status}`
  );
  const shown = (block2.match(/^- \*\*Status:\*\* (.*)$/m) || [, status])[1].trim();

  const gtxt = `${g.done}/${gden} (${pct(g.done, g.total, g.na)}%)`;
  const utxt = u.total === 0 ? "not generated" : `${u.done}/${uden} (${pct(u.done, u.total, u.na)}%)`;
  rows.push(`| ${names[mid] || mid} (\`${mid}\`) | ${shown} | ${gtxt} | ${utxt} | ${overall}% |`);
  return begin + block2 + end;
});

const table = ["| Module | Status | General | UI | Overall |", "|---|---|---|---|---|", ...rows];
const summary = "<!-- SUMMARY:BEGIN -->\n" + table.join("\n") + "\n<!-- SUMMARY:END -->";
newText = newText.replace(/<!-- SUMMARY:BEGIN -->[\s\S]*?<!-- SUMMARY:END -->/, () => summary);

if (check) {
  console.log(table.join("\n"));
  process.exit(newText === text ? 0 : 1);
}
fs.writeFileSync(file, newText, "utf8");
console.log(table.join("\n"));
