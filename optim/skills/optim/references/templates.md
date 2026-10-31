# Templates used by the optim skill

## 1. Plan adjustment row (in `Optim/Optim.md`, module section → *Plan adjustments*)

Replace the `_none yet_` row on first use. One row per adjustment.

```markdown
| 2026-11-02 | FIN-01 | Added step FIN-13: DB trigger blocking UPDATE/DELETE on `payments` | `store.ts` line 812 still splices rows on M-Pesa failure; audit only covered the API path |
| 2026-11-02 | DEL-04 | Annotated: `collected.reference` required only for non-cash | Matches Optim_deliveries.md section 3.2, plan said "always" |
| 2026-11-02 | ORD-07 | ~~Remove dead status/station sync~~ (already removed in commit abc123) | grep shows no remaining reference |
```

Allowed change types: **added** (new step ID), **annotated** (clarified or corrected), **struck** (obsolete, with evidence), **conflict-resolved** (which source won and why).

When you add a step, also add to the module's `Optim.md` checklist (as the next free ID) and to `Optim_progress.md`.

## 2. UI checklist block (in `Optim/Optim_progress.md`)

Replace everything between `<!-- UI-CHECKLIST:BEGIN -->` and `<!-- UI-CHECKLIST:END -->`. **Top-level lines start at column 0 and are the only lines counted.** Sub-tasks are indented and not counted.

```markdown
<!-- UI-CHECKLIST:BEGIN -->
- [ ] UI-DEL-01 [ADJUST] Settlement dialog on "Complete delivery" → supports DEL-04
  - [ ] Target confirmed: `erp-interface-design/src/components/erp/deliveries-view.tsx`
  - [ ] Shows balance due from API (`balanceDue`) before enabling confirm
  - [ ] Fields: collected amount, method (Cash, MTN MoMo, Airtel Money, Bank), reference (required if not cash), or "nothing collected" + reason
  - [ ] States: loading, 409 (wrong status), 422 (missing settlement), network error
  - [ ] Permission: visible only with `deliveries.complete`
  - [ ] Responsive / large touch targets (driver on phone), dark + light mode
  - [ ] Test: component test for disabled/enabled confirm; API contract test
- [ ] UI-DEL-02 [ADJUST] Delivery card shows balance due and payment chips → supports DEL-01
  - [ ] ...
<!-- UI-CHECKLIST:END -->
```

Mandatory sub-tasks per UI item (add those that apply): target confirmed, data source (endpoint and fields), states (empty, loading, error, forbidden), permission gating, responsive and dark mode, accessibility (labels, focus, keyboard), test.

Mapping rule: every UI item names **one** general step ID (`→ supports XXX-NN`). A general step with open mapped UI items cannot be ticked.

## 3. Activity log line (in `Optim_progress.md`)

```markdown
| 2026-11-02 | DEL | DEL-04 | Settlement endpoint + dialog; migration 022_delivery_collections.sql; 6 tests added, all pass |
```

## 4. Status values

`Not started`, `In progress`, `Blocked (reason)`, `Complete`. `progress.py` sets `In progress` and `Complete` automatically; set `Blocked` by hand in the module block (the script will not overwrite a Status line that starts with `Blocked`).

## 5. Commit message format

`optim(<STEP-ID>): <imperative summary>` for example `optim(FIN-01): make payments append-only`.

## 6. Final report to the user (end of module or phase)

```text
Module: FIN (phase P1)  | Progress: 41% overall (general 5/13, UI 2/7)
Changed: DB (migration 023_payments_append_only.sql), server (payments.ts, finance repo), events (payment.recorded, payment.reversed), RBAC (payments.refund), notifications (reversal alert), UI (reversal dialog)
Touched other modules: DEL (settlement posts through payments service), NOT (alert rule), ANA (period filter)
Tests: 14 added, all passing; build OK
Deferred: FIN-05..FIN-12 (P4/P5)
Plan adjustments: 2 rows added in Optim.md
Next suggested: DEL P1 (DEL-04), then ORD P2
```
