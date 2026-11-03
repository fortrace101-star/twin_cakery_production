import re
from pathlib import Path

root = Path('/c/Users/manue/Desktop/twin_cakery/erp')
optim_md = root / 'Optim' / 'Optim.md'
ui_feat = root / 'skills' / 'optim' / 'references' / 'ui-features.md'

text = ui_feat.read_text(encoding='utf-8')
modules_map = {}
for m in re.findall(r'^## ([A-Z]+):', text, re.M):
    start = text.find(f'## {m}:')
    end = text.find('\n## ', start + 1)
    if end == -1: end = len(text)
    sec = text[start:end]
    rows = []
    for line in sec.splitlines():
        if line.strip().startswith('| UI-'):
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 7:
                rows.append({
                    'id': parts[1],
                    'kind': parts[2],
                    'target': parts[3],
                    'element': parts[4],
                    'supports': parts[5]
                })
    modules_map[m] = rows

content = optim_md.read_text(encoding='utf-8')
for m, rows in modules_map.items():
    mstart = content.find(f'## {m}:')
    if mstart == -1: continue
    mend = content.find('\n## ', mstart + 1)
    if mend == -1: mend = len(content)
    section = content[mstart:mend]
    scope_match = re.search(r'### UI scope\n.*?(?=\n### |\Z)', section, re.S)
    if not scope_match:
        continue
    table_lines = []
    table_lines.append('| ID | Kind | Target | Element / behaviour | Supports | Source |')
    table_lines.append('|---|---|---|---|---|---|')
    for r in rows:
        table_lines.append(f"| {r['id']} | {r['kind']} | {r['target']} | {r['element']} | {r['supports']} | catalogue |")
    new_ui = "### UI features\nThe module's UI work, drafted at execution time.\n<!-- UI-PLAN:BEGIN -->\n**Drafted for execution:** no (seeded from catalogue only)\n\n" + '\n'.join(table_lines) + "\n<!-- UI-PLAN:END -->\n"
    new_section = section[:scope_match.start()] + new_ui + section[scope_match.end():]
    content = content[:mstart] + new_section + content[mend:]

optim_md.write_text(content, encoding='utf-8')
print('done')
