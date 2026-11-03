---
name: optim
description: Implements the Twin Cakery ERP optimization plan one module at a time. Use this skill whenever the user asks to optimize, re-optimize, implement, continue, resume, or check progress on any module of the Twin Cakery ERP (security/RBAC, orders, quotations, production, inventory, purchasing, deliveries, finance, analytics, notifications/audit, CRM, catalogue/recipes, staff/payroll, website, architecture), or mentions Optim.md, Optim_progress.md, Optim_MODULE.md, Optimize.md, "the plan", "next module", module IDs such as SEC, ORD, QUO, PROD, INV, PUR, DEL, FIN, ANA, NOT, CRM, CAT, STF, WEB, ARC, or step IDs like FIN-03. Always use it for any change that is listed in the Optim plan, even if the user only names the feature (for example "fix the delivery cash payment" or "make payments append-only"), because the skill carries the unified, multi-layer procedure, the UI checklist, and the progress bookkeeping that keep the modules consistent.
---

# optim: execute the Optim plan for one module

You implement the optimization plan for the Twin Cakery ERP (React admin app, Express + Postgres server, public website). The plan is split across files that sit together in one folder, `Optim/`, at the project root. Your job for a given module is to **combine three sources into one unified plan, implement it at every layer, and keep the plan and progress documents truthful.**

## 1. Files you work with

All paths are relative to the project root.

| File | Role | You may edit it? |
|---|---|---|
| `Optim/Optim.md` | The plan. One section per module: general steps and checklist, source links, plan-adjustments table | Yes, only the module's **Plan adjustments** table and annotations on steps (never delete original steps) |
| `Optim/Optim_<module>.md` | Detailed assessment, scenarios and code snippets for the module (13 exist; `CAT` and `WEB` may not) | No (read only) |
| `Optim/Optimize.md` | The original audit with the evidence. Line ranges for each module are in the plan section | No (read only) |
| `Optim/Optim_progress.md` | Per-module status, percentages, general checklist, UI checklist | Yes, constantly |
| `skills/optim/references/ui-features.md` | Catalogue of specific UI features per module | Yes: append under **Added during implementation** |
| `skills/optim/references/templates.md` | Formats for adjustments, UI checklist, log entries | Read only |
| `skills/optim/references/codebase-map.md` | Verified map of the repo and gotchas | Yes: correct it when you find it wrong |
| `skills/optim/scripts/progress.js` | Recomputes percentages from the checkboxes | Run it |

Module IDs: `SEC`, `ORD`, `QUO`, `PROD`, `INV`, `PUR`, `DEL`, `FIN`, `ANA`, `NOT`, `CRM`, `CAT`, `STF`, `WEB`, `ARC`. Step IDs look like `FIN-03`; UI IDs look like `UI-FIN-02`. `<ID>-00` is always the reconcile step.

If `Optim/` is somewhere else, find it (search for `Optim.md`) and use that folder consistently. If a file you need is missing, say so and continue with what exists; never invent its contents.

## 2. Inputs

The user names a module (ID or name), optionally a phase (`P0`-`P6`) or specific step IDs. Examples: "optimize finance", "FIN phase P1", "do DEL-01 to DEL-04", "continue". If no module is named, read `Optim_progress.md` and propose the next one by phase order and dependencies, then proceed once the user agrees.

## 3. Workflow (follow in order)

### Step A. Preflight

1. Read the **header and sections 1 to 5** of `Optim/Optim.md` (folder layout, provenance, phases, conventions).
2. Read the module's section in `Optim/Optim.md`, and its block in `Optim/Optim_progress.md`.
3. **Dependencies.** Look at the module's *Depends on* list. For each dependency, check its P0-P2 steps in the progress file. If any are unfinished, tell the user which, and ask whether to proceed. Do not silently proceed on a module whose security or money fixes are pending.
4. **Repo state.** Check git status. Work on a branch named `optim/<id>-<short-topic>`. If the tree is dirty with unrelated changes, tell the user before touching anything.
5. Mark the module `In progress` in the progress file (use `[~]` on the step you are starting) and note the branch in the block.

### Step B. Gather the three sources

Read, in full for the relevant parts:

1. **The module's section in `Optim.md`** (steps, touches, tests, adjustments so far).
2. **`Optim/Optim_<module>.md`**, the detailed document the section was derived from (path is in the section's table). If it does not exist (`CAT`, `WEB`), say so and rely on the audit.
3. **`Optim/Optimize.md`**, only the line ranges listed in the module section (use `sed -n 'a,bp'`), plus any cross-referenced sections.

### Step C. Reconcile with reality (`<ID>-00`)

The audit was written without running the app, and parts were only skimmed. For each finding and step in scope:

1. Open the code anchors listed in the module section and **verify the finding is still true** (grep the function, read the route). Record: confirmed, already fixed, different from described, or cannot find.
2. Compare `Optim_<module>.md` against the plan section: anything in the document that the section lacks is a gap.
3. Check the **inbound touchpoints** table in the module section: other modules' steps that change this module's area.
4. Check existing migrations (`server/migrations`), permission keys, and existing tests that the work will touch.

Write what you found into the module's **Plan adjustments** table in `Optim.md` using the format in `references/templates.md`. Add new steps as `<ID>-NN` with the next free number (also add the matching line to the progress file). If a step is already done or wrong, annotate it (`~~struck through~~ + reason`); do not delete it.

### Step D. Build the unified plan

Produce one plan for this module that merges the three sources and the code reality. **Unified means every layer and every affected module for each step**, not just the module's own files. For each step in scope list, in this layer order:

1. **Database:** migration (next free number), constraints, indexes, backfill, rollback note, backup first.
2. **Server:** repository/service functions, route(s), Zod schema, field whitelist, state-machine transition, transaction boundary.
3. **Events:** `domain_events` emitted in the same transaction; names and payload.
4. **RBAC:** permission keys added or renamed, which roles get them, record-level scoping, approval rule.
5. **Notifications and audit:** event, recipients (by permission), template variables, escalation.
6. **Finance and analytics effects:** journal entries, report fields, metric definitions, date basis.
7. **Other modules (the step's *Touches* list):** the concrete change in each, owned and implemented by you now.
8. **Frontend:** the UI items from `references/ui-features.md` that support the step.
9. **Tests:** server and frontend.

Keep this unified plan in your working notes and summarise it to the user before large changes (a short list, not the whole thing). Persist only what matters: adjustments in `Optim.md`, progress in `Optim_progress.md`.

### Step E. Draft UI plan and generate the UI checklist (before implementation)

Run in this order, after the reconcile step and the unified plan and BEFORE any implementation:

a. **Read module doc:** Read the module's document `Optim/Optim_<module>.md`: its UI tables (new and adjusted) and every change-set row for the front end, including front-end changes that come from other modules' steps (inbound touchpoints).
b. **Read plan and catalogue:** Read the module's table in `Optim/ui-features.md` and the module's current "UI features" section in `Optim/Optim.md`.
c. **Inspect real frontend:** Inspect the real frontend for the module (views, dialogs, shared components, sidebar, topbar) and record what already exists.
d. **Draft comprehensive UI plan:** Merge the three inputs, remove duplicates, and add anything missing. Consider screens, forms and dialogs, read-only displays of new backend data, changes to existing elements, notification and approval surfaces, permission-aware behaviour, states (empty, loading, error, forbidden, offline), live updates for any status view, responsive and theme support, accessibility, and role-specific views.
e. **Update plan:** Write the result between the `<!-- UI-PLAN:BEGIN -->` and `<!-- UI-PLAN:END -->` markers in the module's section of `Optim/Optim.md`: set "Drafted for execution: yes (YYYY-MM-DD)", keep existing rows, and add new rows with the next free `UI-<ID>-NN`. Each row supports exactly one step; if no step fits, add a new step to the module (next free `<ID>-NN`) in `Optim.md`, `Optim_progress.md` and `modules.json`. Set Source to `catalogue`, `module doc <section>`, `code review` or `added <date>`.
f. **Sync catalogue:** Append any new items to the module's table in `Optim/ui-features.md` under "Added during implementation" so the reference stays in sync.
g. **Generate checklist:** From the plan's UI features section, generate the detailed checklist in the module's `<!-- UI-CHECKLIST:BEGIN -->` block in `Optim/Optim_progress.md`: one top-level line per item at column 0, `supports <ID>-NN`, with sub-tasks (target confirmed, data source, states, permission gating, responsive/theme/accessibility, live update, test).
h. **Log:** Append a dated row in the module's Plan adjustments: what was added and the evidence.

**Gates:**
- A module cannot be marked In progress or Complete while its plan section says "Drafted for execution: no".
- A step with open mapped UI items cannot be ticked unless it is `[-]` with a written reason.
- For list/board/table/status views, the "live update" sub-task is required.
- If a step is ticked but its mapped UI items are open, reopen the step as `[~]` and tell the user.

### Step F. Implement

For each step in scope, in phase and dependency order:

1. **Implement with UI together:** A step is implemented together with its mapped UI items, in the same branch and commits (`optim(<STEP-ID>): ...`, UI included): backend first, then the UI that uses it. Set the step to `[~]`.
2. **Layer by layer:** Make the changes layer by layer (Step D order).
3. **Tests:** Write or update tests **before or with** the change. For money and permissions, tests first.
4. **Verify:** Run checks (see section 5). Fix failures; do not tick a step with failing checks. A step cannot be ticked while a mapped UI item is open, unless it is `[-]` with a written reason.
5. **UI completion rules:** A UI item is `[x]` only when it renders in all states, respects permissions, follows the design system, updates live where it shows status, and has a test or a documented manual check.
6. **Handle new UI needs:** A UI need found during implementation is added to the plan's UI features section immediately, and logged in Plan adjustments.
7. **Tick and update:** Tick the step `[x]` in the progress file, tick its mapped UI items, add a line to the **Activity log**, then run:
   `node skills/optim/scripts/progress.js Optim/Optim_progress.md`
   which rewrites the summary table and the module's Status line.
8. **Plan changes:** If you learn something that changes the plan (a finding was wrong, a better approach, a new dependency), add a row to **Plan adjustments** in `Optim.md` immediately, not at the end.

**Gate:** A module cannot be In progress while its plan section says "Drafted for execution: no".

### Step G. Finish the module (or phase)

1. All steps in scope `[x]` or `[-]` with reasons; UI items done; tests and build pass.
2. Update the **Notes and blockers** block in the progress file (what was deferred and why).
3. Re-run `progress.js`; confirm the percentages.
4. Report to the user: what changed per layer, what other modules were touched, migrations added (numbers), new permissions, tests added, anything left, and the suggested next module.

## 4. Rules that always apply

**Safety**
- Never run destructive commands on data (`DROP`, `TRUNCATE`, history rewrite, deleting `backups/` or `erp.db`) without explicit user approval in this conversation. For `ARC` repo hygiene, list what will be removed and wait for a yes.
- Take a database backup outside the repo before running a migration on real data.
- Never print or commit secrets from `.env`. If `.env` or backups were ever committed, tell the user to rotate secrets.
- Do not edit applied migrations; add new ones. Backfills must be idempotent.

**Engineering**
- Permissions are enforced on the **server** with the shared `requirePermission`; deny by default. UI hiding is only convenience.
- Money: integer UGX or rounding at each step; finance tables are append-only; corrections are reversing rows linked to the original.
- Store UTC; compute day boundaries in `Africa/Kampala`.
- Every state change goes through the state machine and emits an event in the same transaction as the change.
- No empty `catch {}` on business steps: roll back or create a `needs_attention` record.
- Validate request bodies with Zod and whitelist fields per action.
- Match existing code style, folder layout and the design system (`erp-design-system.md`, `AGENTS.md` in `erp-interface-design/`). Read `AGENTS.md` before frontend work.

**Honesty**
- Do not tick a box for work you did not do or could not verify. If you could not run the app or tests, say so in the log and leave the step `[~]`.
- Do not claim a finding is real without looking at the code. Do not claim it is fixed without a test or a demonstrable check.
- Where the audit and the code disagree, the code wins; record it in Plan adjustments.

**Conflicts between sources**
- `Optim_<module>.md` wins over `Optim.md` for detail and snippets; `Optimize.md` wins for what the finding is; the code wins for what is true now. Record every conflict resolution.

## 5. Checks to run

From `erp-interface-design/` (the root `package.json` delegates here):
- Type-check the server: `npm run build:api` (tsc). Frontend: `npx tsc --noEmit -p .` or `npm run build`.
- Tests: `npm run test` (vitest). Server tests introduced by `ARC-01` live with the server; run them too once they exist.
- Lint: `npm run lint`.
- Migrations: `npm run db:migrate` against a **disposable database copy**, then re-run to prove idempotence.

If the environment has no database or network, run what you can, state what you could not, and keep the step `[~]`.

## 6. Cross-module ownership

- The module that **owns** a step implements it in full, including the parts in other modules listed in *Touches*.
- Those parts show up in the other modules' **Inbound touchpoints** table; you do not need to re-implement them when you later run that module, only verify them (a quick check in its `<ID>-00`).
- If a step needs a permission, event, or table that another unfinished module owns (for example the state machine from `ARC-05`), either do the minimal version in the owner's step now and note it, or stop and tell the user. Do not create a second, competing version.

## 7. Updating the plan documents: what is allowed

- `Optim.md`: add rows to the module's **Plan adjustments**; add new steps as new IDs; annotate (strike through plus reason) steps that are obsolete. Never reorder or renumber existing IDs; the progress file and scripts depend on them.
- `Optim_progress.md`: edit checkboxes, Status, branch, notes, activity log, UI checklist block. Never edit the summary table by hand.
- `ui-features.md`: append only.
- Keep each edit minimal and dated (`2026-MM-DD`).

## 8. Reporting style

Be concrete and short. After each step or batch: what changed (files, migration number, permissions), test result, percentage now, what is next. If you are blocked, say exactly what you need from the user.
