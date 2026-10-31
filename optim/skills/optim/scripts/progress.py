#!/usr/bin/env python3
"""Recompute the summary table and per-module Status in Optim_progress.md.

Usage: python skills/optim/scripts/progress.py [path/to/Optim_progress.md] [--check]

Counted lines start at column 0:   - [x] FIN-03 ...   or   - [ ] UI-FIN-02 ...
States: [ ] todo, [~] in progress (counts 0), [x] done, [-] not applicable (excluded from the total).
Indented sub-tasks are ignored. The Status line is rewritten unless it starts with "Blocked".
"""
import re, sys

path = next((a for a in sys.argv[1:] if not a.startswith("--")), "Optim/Optim_progress.md")
check = "--check" in sys.argv

text = open(path, encoding="utf-8").read()
item = re.compile(r"^- \[([ ~x-])\] (UI-[A-Z]+-\d+|[A-Z]+-\d+)(?=[\s:\]])", re.M)
mod_re = re.compile(r"(<!-- MODULE:([A-Z]+):BEGIN -->)(.*?)(<!-- MODULE:\2:END -->)", re.S)
name_re = re.compile(r"^## (.+?) \(`([A-Z]+)`\)", re.M)
names = {m.group(2): m.group(1) for m in name_re.finditer(text)}


def counts(block):
    g = dict(done=0, prog=0, na=0, total=0)
    u = dict(done=0, prog=0, na=0, total=0)
    for st, ident in item.findall(block):
        t = u if ident.startswith("UI-") else g
        t["total"] += 1
        t["done"] += st == "x"
        t["prog"] += st == "~"
        t["na"] += st == "-"
    return g, u


def pct(d, t, na):
    den = t - na
    return 0 if den <= 0 else round(100 * d / den)


rows, order, new_text = [], [], text


def repl(m):
    mid, block = m.group(2), m.group(3)
    g, u = counts(block)
    gden, uden = g["total"] - g["na"], u["total"] - u["na"]
    done, den = g["done"] + u["done"], gden + uden
    overall = pct(done, den + 0, 0)
    anyprog = g["prog"] + u["prog"] + done > 0
    complete = den > 0 and done == den and uden > 0
    if den > 0 and done == den and uden == 0:
        complete = False  # UI checklist not generated yet: cannot be complete
    status = "Complete" if complete else ("In progress" if anyprog else "Not started")

    def fix_status(mm):
        cur = mm.group(1).strip()
        return mm.group(0) if cur.startswith("Blocked") else f"- **Status:** {status}"

    block2 = re.sub(r"^- \*\*Status:\*\* (.*)$", fix_status, block, count=1, flags=re.M)
    shown = re.search(r"^- \*\*Status:\*\* (.*)$", block2, re.M)
    shown = shown.group(1).strip() if shown else status
    gtxt = f"{g['done']}/{gden} ({pct(g['done'], g['total'], g['na'])}%)"
    utxt = "not generated" if u["total"] == 0 else f"{u['done']}/{uden} ({pct(u['done'], u['total'], u['na'])}%)"
    rows.append(f"| {names.get(mid, mid)} (`{mid}`) | {shown} | {gtxt} | {utxt} | {overall}% |")
    order.append((mid, overall))
    return m.group(1) + block2 + m.group(4)


new_text = mod_re.sub(repl, text)
table = ["| Module | Status | General | UI | Overall |", "|---|---|---|---|---|"] + rows
summary = "<!-- SUMMARY:BEGIN -->\n" + "\n".join(table) + "\n<!-- SUMMARY:END -->"
new_text = re.sub(r"<!-- SUMMARY:BEGIN -->.*?<!-- SUMMARY:END -->", lambda _: summary, new_text, flags=re.S)

if check:
    print("\n".join(table))
    sys.exit(0 if new_text == text else 1)
open(path, "w", encoding="utf-8").write(new_text)
print("\n".join(table))
