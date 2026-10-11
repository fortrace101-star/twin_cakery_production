# AutoTable — Unified ERP Design Guide

> **Consolidates:** the ERP reference in `erp-design-system.md`, the in-repo table spec
> `Table.md`, the dashboard pattern in `DashboardDesignPattern.md`, and the external
> enterprise/data-table guidance listed in §1.
> **Scope:** the WinUI 3 desktop app `AutoTable` — typography, spacing, layout, status
> colour, table and component conventions.
>
> **Status:** **Phase E1 largely implemented; E0 decisions taken, E2–E5 outstanding.** See
> [§11 Implementation status](#11-implementation-status).
>
> **Companion docs:** [`Light_mode.md`](Light_mode.md), [`Dark_mode.md`](Dark_mode.md).

---

## 1. Sources

| # | Source | Contributed |
|---|--------|-------------|
| E1 | `erp-design-system.md` (in-repo, "ERP Typography & Layout Style Guide") | Type scale and weights, 8px spacing grid, sidebar+topbar+content layout, table-as-default-pattern, functional status colour, "centralise tokens / build one shared `<DataTable>` + `<StatusBadge>`" |
| E2 | [Setproduct — Data table UI design reference guide](https://www.setproduct.com/blog/data-table-ui-design) | Table anatomy (toolbar/header/body/footer/sticky), cell-type alignment (**text left, numbers right**), three density modes, the full state set (default/hover/focus/selected/loading/empty/error/disabled), sort direction clarity, filter visibility, pagination vs virtualization, truncation + tooltip rule, target-size minimums (24×24 CSS px WCAG 2.2; 48dp Material), anti-patterns (hover-only actions, missing total count, arrowless sort) |
| E3 | [Pencil & Paper — Enterprise data tables UX patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) | Column actions/sticky/frozen considerations (unreachable at fetch time; corroborated by E2) |
| E4 | [Enterprise UX design guides (FuseLab / UX Pilot / NavaTech)](https://fuselabcreative.com/enterprise-ux-design-guide-2026-best-practices/) | "Information density done right" — don't oversimplify dense data; consistency across modules (partly unreachable; the density point is corroborated by E2) |
| E5 | [Inter typeface](https://fonts.google.com/specimen/Inter) (via E1) | The reference face, its tabular-number variant, and the rationale for a neutral sans with aligned figures |
| E6 | [LogRocket — Modal design in UX](https://blog.logrocket.com/ux-design/modal-ux-best-practices/) | Modals empower or interrupt: Slack's skippable onboarding vs LinkedIn's punitive restriction modal; Figma reserves confirmations for high-stakes actions; modal decision framework and alternatives (inline banners, tooltips, drawers, toasts); design for the least tech-savvy user |
| E7 | [Mykola Designer — Modal web design](https://www.mykoladesigner.com/article/modal-web-design) | Modal anatomy: overlay effect, focused interaction, temporary/contextual use, clear CTA, limited distraction; trigger-by-user-action distinction; accessibility and mobile pitfalls |
| E8 | [Uxcel — Best Practices for Designing UI Modals](https://uxcel.com/lessons/modals--dialogs-best-practices-166) | Purpose in the title; CTA labels that answer the title; overlay as focus tool; **multiple exit affordances (Cancel + Close + Escape)**; click-outside dismissal when safe; keyboard focus into the dialog; ≤2 actions; ≤1 modal at a time; red/icons to signal destructive weight; success states inline, not modal |
| E9 | [Eleken — Mastering Modal UX](https://www.eleken.co/blog-posts/modal-ux) | Modal vs modeless vs semi-modal; anatomy (focused purpose, concise message, action-driven buttons, easy dismissal); when modals work (critical confirmations, focused tasks, wizards, legal acknowledgments); stacking debate (max 2 layers, clear hierarchy); mistakes: modals for everything, mid-task interruption, too many fields, blocking context, forgotten accessibility |
| E10 | [Rapid Cloud Partners — Modular ERP Design](https://www.rapidcloudpartners.com/modular-erp-design) | Core ERP capabilities to evaluate: integration, automation, data analysis, reporting, tracking/visibility; native modules under one solution automate processes end-to-end |
| E11 | [Excited Agency — ERP Software UX](https://excited.agency/blog/erp-design) | Double-diamond ERP UX process; streamline complex processes into logical steps; role-based customizable dashboards; cross-platform accessibility; RBAC "only show what's relevant"; mistakes: ignoring end users, overcomplicated UI, late data-migration planning, missing integration planning |
| E12 | [Wavespace — How to Design an Effective ERP System](https://www.wavespace.agency/blog/erp-design) | UX is a dealbreaker, not a sideshow; scalable information architecture; task efficiency (autofill, batch, shortcuts); show key data fast; per-role views; same style + clear words + response + speed + accessibility as UI/UX pillars; challenges: tool sprawl, low adoption, hard steps, data overload, change pushback |

> **Fidelity note:** E1, E2 and E5 were read in full. E3 and E4 were unreachable
> (timeout) during this pass; no guideline below rests on them — every point attributed to
> them is independently present in E2 (density, states, alignment, target size). E6–E9 and
> E11–E12 were read in full on 23 Sep 2026. E10 renders as a short partner blog (Duda-hosted);
> its contribution is limited to the modular-ERP capability checklist summarized above.

---

## 2. Consolidated guidelines

### 2.1 Typography

**T1 — One neutral, highly legible sans; no serif.** Serif slows scanning of tables and numbers.
**T2 — A tight, role-based type scale** (meta → label → body → emphasised → section → page → totals).
**T3 — Weights carry meaning:** 400 body, 500 labels/active, 600 headers/totals,
**700 reserved for alerts and critical flags only** — never general emphasis.
**T4 — Numeric alignment is mandatory:** `tabular` figures so digits align by place value, and
numeric columns right-aligned with right-aligned headers.** E2: this one rule fixes more
"messy table" complaints than any restyle.**
**T5 — Line-height 1.3–1.5; dense screens must stay dense**, not airy.
**T6 — Truncate with ellipsis + tooltip**; reserve wrapping for one designated description column.

### 2.2 Spacing

**S1 — 8px base unit** for all padding/margin so modules built by different people still line up.
**S2 — A fixed token set** (`space-1..space-5`) rather than ad-hoc numbers.
**S3 — Row padding vs page padding vs card padding are named tokens**, not per-view literals.

### 2.3 Layout

**L1 — Persistent left sidebar for module navigation**, top bar for search / notifications / user.
**L2 — Data tables are the default content pattern**, not cards, for registers
(orders, inventory, accounting, fees, students).
**L3 — Every list page:** page title → filter/toolbar row → table (sticky header) → totals.
**L4 — Forms:** label above input; multi-part records grouped into tabs.
**L5 — Sticky table headers** on any list expected to scroll; frozen identifier column on
wide tables.
**L6 — Density is a feature:** compact / comfortable / spacious, and **persist the user's choice**.
**L7 — Modules must not feel stitched together** — same shell, same tokens, same table recipe.

### 2.4 Colour & status

**C1 — Low-saturation base + one brand accent;** colour is functional, not decorative.
**C2 — Status vocabulary is fixed:** green = paid/completed/in-stock; amber = pending/low;
red = overdue/out/error; grey = draft/inactive; accent = active/selected.
**C3 — Status is a small badge next to text, never coloured body text** — keeps tables scannable.
**C4 — Every status is distinguishable without colour** (label/icon pairing).

### 2.5 Components

**X1 — Centralise tokens in one place** so every module pulls from the same source.
**X2 — Build one shared `DataTable`** (sortable, sticky header, right-aligned numerics via a
column prop) and reuse it — do not rebuild tables per module.
**X3 — Build one shared `StatusBadge`** early; it gets used constantly.
**X4 — Every table state is designed:** default, hover, focus, selected, loading, empty,
error, disabled. "Empty" has two flavours: *first-run* and *no-results*.
**X5 — Interactive targets ≥ 24×24 px** (WCAG 2.2 Target Size Minimum); 48dp for touch-first.
**X6 — Visible focus indication that never depends on colour alone.**
**X7 — Show the total count / "showing N of M"**, and a real sort-direction arrow.**
**X8 — Actions must not be hover-only.**

---

## 3. Target specification for AutoTable — token deltas

### 3.1 Typography

The reference guide (E1) recommends **Inter**. AutoTable is a native **WinUI 3** desktop app
that currently uses **`Segoe UI`** everywhere. Recommendation:

> **Keep `Segoe UI` as the platform-native face** (it ships with Windows, matches OS chrome, and
> avoids embedding a font in the app package) **but adopt E1's structural rules verbatim** — the
> scale, the weights, and the numeric-alignment discipline. Optionally move to
> `Segoe UI Variable` for better optical sizing. Introduce the family as a **token**
> (`FontSansFamily`) so a future switch to Inter is a one-line change.

| Token | Current | **Target** | E1 role |
|-------|---------|-----------|---------|
| `PageTitleStyle` | 20 / SemiBold / Segoe UI | 20 / SemiBold ✓ | `text-xl` (20–24) |
| `SectionTitleStyle` | 16 / SemiBold ✓ | 16 / SemiBold ✓ | `text-lg` (16–18) |
| `BodyTextStyle` | 14 / Regular ✓ | 14 / Regular ✓ | `text-base` (13–14) |
| `MutedTextStyle` | 13 / Regular / **`TextSecondaryBrush`** | 13 / Regular / **`TextMutedBrush`** | `text-xs` (11) meta |
| `TableHeaderStyle` | 13 / SemiBold ✓ | 13 / SemiBold ✓ | header |
| `TableCellStyle` | 14 / Regular ✓ | 14 / Regular ✓ | body cell |
| `NumericCellStyle` | 14 / SemiBold, **no alignment** | 14 / SemiBold **+ `HorizontalAlignment="Right"` + tabular figures** | `text-total` (600–700) |
| **`EmphasisCellStyle`** *(new)* | — | 15 / Medium | `text-md` — active row / emphasised body |
| **`TotalsCellStyle`** *(new)* | — | 15 / SemiBold, right-aligned | totals row |
| `KpiValueStyle` | 28 / Bold | 28 / **SemiBold** (Bold only for alert KPIs, per T3) | key figures |
| `FontSansFamily` *(new token)* | — | `Segoe UI` | single source for the family |

### 3.2 Spacing & density

| Token | Current | **Target** |
|-------|---------|-----------|
| `Space1..Space8` | 4, 8, **12**, 16, 20, 24, 32 | 4, 8, **16**, 24, 32, 40, 48 → **strict 8px multiples** (`Space3=12` is the one off-grid value and is used widely) |
| `CardPadding` | `16` ✓ | `16` ✓ |
| `PagePadding` | `24` ✓ | `24` ✓ |
| `RowPadding` | `16,10` ✓ | `16,10` (comfortable) |
| **`RowPaddingCompact`** *(new)* | — | `16,4` → denser tables for power users (E2 density modes) |
| **`RowPaddingSpacious`** *(new)* | — | `16,14` |
| **Density setting** *(new)* | — | `Compact / Comfortable / Spacious` persisted per user |

> Migrating `Space3` from 12→16 is a **breaking visual change** across many views. Do it
> deliberately, one module at a time, or keep `Space3=12` and simply stop using it for new work
> (see plan §8 step 6 — this is a decision point).

### 3.3 Status

| Rule | Current | Target |
|------|---------|--------|
| Status as badge, not coloured text | ▲ badges exist (`BadgeSuccessStyle`/`Warning`/`Danger`/`Info`/`Neutral` in `Resources/DesignTokens.xaml`) but `Views/FeeCollectionView.xaml.cs` (`BalanceColorConverter` path) colours the *text* | Convert balance/fee states to a badge + label |
| Reusable badge component | ✘ only 5 `Border` styles keyed per status | Add a `StatusBadge` control with a `Status` enum → infers brush + label |
| Vocabulary | ▲ green/amber/red/blue/grey all present | Formalise the mapping table in code (`paid → Success`, `pending → Warning`, …) |
| Non-colour redundancy | ▲ mostly text labels beside dots | Always pair badge with a word |

---

## 4. Compliance audit — current app vs the guidelines

| Guideline | Status | Evidence |
|-----------|--------|----------|
| **T1** Neutral sans, no serif | ✔ | `Resources/DesignTokens.xaml` sets `FontFamily` = `Segoe UI` on every text style. No serif anywhere. |
| **T2** Role-based type scale | ▲ | Page 20 / Section 16 / Body 14 / Table 13 / KPI 28 all exist ✔. Missing `text-md` emphasised-body and a totals style; `KpiValueStyle` uses Bold. |
| **T3** Weights carry meaning | ▲ | 400/500/600/700 are all present. `KpiValueStyle` = Bold (28px) — acceptable for key figures but should be reserved per T3. `NumericCellStyle` uses SemiBold so *every* numeric cell is visually loud — dilutes the "totals stand out" signal. |
| **T4** Numeric alignment + tabular figures | ✘ | `NumericCellStyle` declares **no** `HorizontalAlignment`. `Table.md` §3.5 documents the right-align rule, but it relies on each view remembering to set it. **A repo-wide search for tabular-figure settings returns zero matches** — digits are proportional, so columns of money don't line up by place value. |
| **T5** Dense line-height | ▲ | Default line-height; `Table.md §5` sets compact row padding (`16,8`) ✔, but no explicit line-height token. |
| **T6** Truncate + tooltip | ▲ | `TextTrimming="CharacterEllipsis"` is used for names ✔; tooltips on truncated cells are not systematically applied. |
| **S1** 8px base | ▲ | `Space2=8`, `Space4=16`, `Space6=24`, `Space8=32` ✔ — but **`Space3=12` breaks the grid**, and `RowPadding=16,10` mixes a 10 into the vertical rhythm. |
| **S2/S3** Named spacing tokens | ✔ | `CardPadding`, `PagePadding`, `RowPadding` are named tokens and widely used. Good. |
| **L1** Sidebar + top bar | ✔ | `Views/ShellView.xaml`: 240px left rail with module sections (PERFORMANCE / ADMINISTRATION / FINANCIALS), 60px top bar with search (`TopSearchBox`), term selector, notifications, user. No tenant switcher needed (single-institution product). |
| **L2** Tables as the default pattern | ✔ | Every register is a table: Students, Classes, Teachers, Assessments, Report Cards, Fee Collection, Budget — all follow the `Table.md` recipe. |
| **L3** Title → toolbar → table → totals | ▲ | Title + filter bar + table ✔ in most modules. **No totals/summary row anywhere** — `Table.md` §7d has EXPECTED/PAID/BALANCE columns but no aggregate row, which E2 calls a missed "analyst favourite". |
| **L4** Forms: label above input, tabbed groups | ▲ | Pattern is used, but grouping into tabs for multi-part records (e.g. Student: Details / Orders / Payments / Notes) is not standardised — record editors are single long forms. **Verify per view before committing to a change.** |
| **L5** Sticky headers | ✘ | **`Table.md` §6 explicitly forbids an inner `ScrollViewer`** ("Remove `MaxHeight`; set `ScrollViewer.VerticalScrollBarVisibility="Disabled"`") so the *page* scrolls. That is a deliberate choice for consistency — but it makes the column-header band scroll away, which violates L5 and E2 (sticky header on long lists). This is the largest structural conflict to resolve. |
| **L6** Density as a feature | ✘ | One fixed density (`RowPadding=16,10`). No compact/spacious, no persisted preference. E2: "density is a feature, not a default." |
| **L7** Modules don't feel stitched together | ▲ | Shell + tokens unify most of it ✔, but per-view hard-coded colours (see `Light_mode.md` §4 P2 / `Dark_mode.md` §4 Dk1) and duplicated table markup work against it. |
| **C1** Low-saturation base + one accent | ▲ | Base palette is grays + one blue ✔; however six accent hues (blue/green/orange/red/purple/teal) are used decoratively in KPI accent colours and chart series, which dilutes the "one brand accent" rule. |
| **C2** Fixed status vocabulary | ✔ | `BadgeSuccessStyle`/`BadgeWarningStyle`/`BadgeDangerStyle`/`BadgeInfoStyle`/`BadgeNeutralStyle` map to green/amber/red/blue/grey consistently. |
| **C3** Badge, not coloured text | ✘ | `Views/FeeCollectionView.xaml` + `FormatConverters.BalanceColorConverter` colour the **balance text** red/green instead of badging it. Also `GradeColorConverter` colours grade letters (acceptable — grades are a scale, but worth noting). |
| **C4** Status without colour | ▲ | Status dots are usually paired with a label ✔ (e.g. Students status column), but the badge styles alone carry no icon/label. |
| **X1** Centralised tokens | ▲ | `Resources/DesignTokens.xaml` is the single token file ✔, but `Default`/`Light` are hand-duplicated and several views/code-behinds hard-code colours — so "one source of truth" is not yet true. |
| **X2** One shared `DataTable` | ✘ | Tables are **rebuilt by hand in every view** and kept aligned by a written spec (`Table.md`). `Views/Controls/` contains `KpiCard`, `StatusFooterBar`, `WhitePanel`, `AuthIllustration`, `ReportCardSheetView`, `MidTermSlipView`, `UserTourOverlay` — **no `DataTable`**. Every new table re-implements the geometry contract, which is exactly the drift E1 warns about. |
| **X3** Shared `StatusBadge` | ✘ | Only style keys; no control that takes a status and renders badge + label. |
| **X4** All table states designed | ✘ | Hover (`TableRowHoverStyle`) and selected (`TableRowSelectedStyle`) exist ✔. **No empty, loading, error, or disabled states**: a repo search for empty-state patterns finds only data strings like `"No Data"` in `Services/DatabaseDataService.cs`, never a designed empty-state surface. E2's "an empty table is a design surface, not an accident" is unmet. |
| **X5** Target size ≥24×24 | ▲ | In-table buttons use `Padding="8,3"` with `FontSize="11/12"` (`Table.md §5b`) → compact but possibly under 24px tall. Needs a measured pass. |
| **X6** Visible focus, not colour-only | ✘ | `FocusBorderColor` exists but the button/input styles declare no `Focused` visual state. |
| **X7** Total count + sort arrow | ✘ | No "showing N of M" in any table; `Table.md` describes no sort affordance at all → **no sortable columns**, so no sort direction indicator. E2 lists "sort arrows with no clear direction" among the top three anti-patterns — here the affordance is absent entirely. |
| **X8** No hover-only actions | ✔ | Row actions are always-visible buttons (Shift/View/Edit/Terminate), not hover-revealed. Good. |

---

## 5. Target layout (unchanged shell, upgraded table module)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Top bar: search · term selector · notifications · theme · user        │  (exists ✓)
├───────────┬──────────────────────────────────────────────────────────┤
│ Sidebar   │  Page title (20 SemiBold)                                │
│  240px    │  Filter bar (FilterBarStyle)          [compact|comfortable|spacious] │  ← new density control
│  modules  │  ┌────────────────────────────────────────────────────┐  │
│  grouped  │  │ toolbar: sort · columns · "Showing 1–25 of 412"    │  │  ← new count
│  by        │  ├────────────────────────────────────────────────────┤  │
│  domain    │  │ HEADER (sticky)      …                         │  │  ← L5 / X2
│            │  ├────────────────────────────────────────────────────┤  │
│            │  │ rows …                                  [rows]     │  │
│            │  ├────────────────────────────────────────────────────┤  │
│            │  │ TOTALS row (right-aligned numerics)                │  │  ← new
│            │  └────────────────────────────────────────────────────┘  │
│            │  empty / loading / error states live inside the card     │  ← new
└───────────┴──────────────────────────────────────────────────────────┘
```

---

## 6. Acceptance criteria

| Area | Requirement |
|------|-------------|
| Numerics | Every money/percent/quantity column right-aligned, its header right-aligned above it, digits aligned by place value |
| Density | Compact / Comfortable / Spacious selectable and persisted |
| Long lists | Column headers remain visible while the body scrolls |
| Counts | A visible "showing N of M" / total count on every register |
| Sorting | Clear direction indicator on the active column; unsorted columns quiet |
| States | Designed empty (first-run *and* no-results), loading (skeleton rows matching real row height), error (with retry), disabled |
| Status | Badge + word; never colour alone; no coloured body text for status |
| Reuse | One `DataTable` + one `StatusBadge` consume the token file; no per-view table geometry re-implementation |
| Tokens | No spacing literal outside the token set; no colour literal in feature views |
| Targets | Every interactive control ≥ 24×24 px |

---

## 7. Files in scope

| File | Change |
|------|--------|
| `Resources/DesignTokens.xaml` | `FontSansFamily`; right-aligned numeric/emphasis/totals text styles; strict 8px spacing set; `RowPadding*` density tokens |
| `Views/Controls/DataTable.xaml(.cs)` *(new)* | Shared sortable table: toolbar, count, sticky header, zebra/selected/hover/focus, totals row, empty/loading/error states, density |
| `Views/Controls/StatusBadge.xaml(.cs)` *(new)* | Status enum → brush + label |
| All `Views/*View.xaml` with tables | Migrate to `DataTable` (Students, Classes, Teachers, Assessments, Report Cards, Fee Collection, Budget) |
| `Services/` | Density + (with `Light_mode.md`/`Dark_mode.md`) theme preference persistence in the user settings store |
| `Views/FeeCollectionView.xaml(.cs)` | Balance text colouring → `StatusBadge` |
| `Table.md` | Update to describe the shared `DataTable` contract (and resolve §6 scrolling rule) |
| `DashboardDesignPattern.md` | Note the density/totals conventions so widgets stay consistent |

---

## 8. Implementation plan

> Sequenced so nothing waits on the new `DataTable`: typography and status are quick wins,
> the component is the long pole, and the structural decisions come last.

### Phase E0 — Decide the structural conflicts (decision gate, no code)
1. **Sticky headers vs `Table.md §6`.** Sticky headers require the table body to own its own
   scroll container, which the current spec forbids. Pick one:
   *(a)* keep page-level scroll and accept non-sticky headers at small list sizes,
   *(b)* give tables with >N rows an internal scroll + sticky header,
   *(c)* make it a property of `DataTable` (`IsStickyHeader`) so each register chooses.
2. **Density modes**: which registers get the density switch (all, or only student/fee registers)?
3. **`Space3` 12→16 migration**: adopt strict 8px grid (touches many views) or keep 12 for
   legacy spacing and use 8-multiples for new work?
4. **Font**: confirm Segoe UI (native) vs Inter (E1's recommendation).
5. Deliverable: one short decision note appended to this section.

### Phase E1 — Typography & numeric alignment (fast, high-value)
6. Add `FontSansFamily` and route all text styles through it.
7. Add `EmphasisCellStyle` and `TotalsCellStyle`; make `NumericCellStyle` right-aligned.
8. Tabular figures: if the chosen face/WinUI stack supports tabular numerals, set it in
   `NumericCellStyle`; if not, right-align + fixed-width numeric columns is the mitigation.
   *(Verify the WinUI capability before promising tabular figures — see §10 R1.)*
9. Point `MutedTextStyle` at `TextMutedBrush` so the meta role is consistent.
10. **Verify:** money columns align by place value at 3 window widths (per `Table.md §8`).

### Phase E2 — Status discipline
11. Build `StatusBadge` (enum → brush + label), mapping to the existing `Badge*` styles and
    the C2 vocabulary.
12. Replace coloured status text in `FeeCollectionView` (balance) with a badge.
13. **Verify:** every status in the app is badge + word, and legible in both themes.

### Phase E3 — Shared `DataTable` component
14. Implement `DataTable` with: toolbar slot, `ItemsSource`, column definitions carrying
    `Header`/`Width`/`Align`/`CellTemplate`, sticky header, count, totals row, and the
    full state set (X4).
15. Add sorting (drop in the direction indicator + quiet unsorted columns) and, where the
    data layer allows, server-side ordering for large sets.
16. Migrate one register end-to-end as a pilot — **Fee Collection** (it has the richest
    column set and a totals candidate) — and validate against `Table.md`'s geometry rules.
17. Migrate the remaining registers; delete the per-view geometry duplication.
18. **Verify:** header/row edges still align at narrow/typical/wide; row heights match the
    active density; totals row right-aligns with its columns.

### Phase E4 — Density, states, counts
19. Add the density selector + persisted preference; wire `RowPadding*` into `DataTable`.
20. Add "showing N of M" and skeleton loading rows; design first-run vs no-results empty
    states with distinct copy and a primary action.
21. Add error state with retry.
22. **Verify:** measure in-table button hit areas ≥24×24 px (X5).

### Phase E5 — Consistency sweep
23. Reduce decorative accent usage: keep one brand accent for primary actions; restrict the
    other hues to status/chart semantics (C1).
24. Unify forms: label-above-input everywhere; group multi-part records into tabs (L4) —
    only after per-view verification.
25. Update `Table.md` and `DashboardDesignPattern.md` to describe the shared components so
    future work follows the new path.

### Regression gate (every phase)
- `dotnet build AutoTable.csproj -p:Platform=x64` → 0 errors/warnings introduced.
- Integration tests in `Tests/AutoTable.IntegrationTests` pass.
- Walk every register in **both** themes at 3 window widths after each phase.

---

## 9. Acceptance checklist

- [ ] One `DataTable` component serves every register; no view re-implements table geometry.
- [ ] Every numeric column right-aligned with a right-aligned header; digits align by place value.
- [ ] Totals row present on money/register tables.
- [ ] "Showing N of M" visible on every register.
- [ ] Sort direction obvious; unsorted columns quiet.
- [ ] Empty (both flavours), loading, error and disabled states designed and themed.
- [ ] Density modes shipped and persisted.
- [ ] Column headers stay visible on long lists (per the E0 decision).
- [ ] Status is always badge + label; no coloured body text.
- [ ] `StatusBadge` is the single source of status styling.
- [ ] Spacing uses only the token set (8px multiples).
- [ ] Bold reserved for alerts/critical; `NumericCellStyle` no longer shouts on every cell.
- [ ] Interactive targets ≥ 24×24 px.
- [ ] `Table.md` / `DashboardDesignPattern.md` updated to the new contract.

---

## 10. Open items / risks

| # | Item | Note |
|---|------|------|
| R1 | **Tabular figures are not guaranteed on this stack.** WPF exposes `Typography.NumeralAlignment`; WinUI 3 does not expose an equivalent attached property in the same way. | Verify with a small spike before promising T4 fully. Fallback: right-align + fixed-width numeric columns + a face with tabular digits. |
| R2 | **Sticky headers conflict with the current scroll model** (`Table.md §6`). | This is the single biggest plan decision — gate it in phase E0 and get a product call, because it changes the "one scrollbar for the whole page" guarantee. |
| R3 | Migrating `Space3` (12→16) is a broad visual change. | Either accept the churn in one pass or freeze legacy spacing; don't half-migrate. |
| R4 | `DataTable` migration is the largest single piece of work here. | Pilot on Fee Collection; keep `Table.md` as the contract test while migrating. |
| R5 | Server-side sorting/paging depends on the data layer. | `Services/DatabaseDataService.cs` currently loads full lists; if registers grow, sorting/paging must move server-side or it will only sort the visible page (E2). |
| R6 | Inter would need to ship with the app package. | **Resolved: keeping `Segoe UI`** via the new `FontSansFamily` token, so a future swap is a one-line change. |
| R7 | **`DataTable` rows are not virtualized.** The body is a plain `StackPanel`, because `ElementFactory` is not available on this WinUI 3 build and the documented alternative (`IElementFactory` on `ItemsRepeater.ItemTemplate`) has open crash reports (microsoft-ui-xaml #3448, #4705). | Fine for the current registers (hundreds of rows, all loaded at once anyway per R5). If a register passes ~1–2k rows, host it in a virtualizing container before adding columns. |
| R8 | `StatusBadge`/`DataTable` are wired into **5 registers so far**: Fee Collection (pilot), Teachers, Budget, Assessments, and — as of the third pass — Grade Book and Marks Entry. | The remaining registers still own their old markup; migrate them one at a time against `Table.md`'s geometry rules, and delete the per-view duplication as each lands. |

---

## 11. Implementation status

### Decisions taken (phase E0)

| # | Decision |
|---|----------|
| 1 | **Sticky headers:** `DataTable` will expose `IsStickyHeader` (default **off**), preserving the page-scroll contract in `Table.md §6` for existing registers and letting long registers opt in. |
| 2 | **Density:** the token layer is ready (`RowPaddingCompact` `16,4` / `RowPaddingSpacious` `16,14` added beside `RowPadding` `16,10`); the selector itself ships with `DataTable`. |
| 3 | **Spacing:** `Space3=12` and `Space5=20` are **kept for now** so this pass stays free of broad visual churn. New work should use 8-multiples. Migrating them remains an open item. |
| 4 | **Font:** `Segoe UI`, exposed as the `FontSansFamily` token. |

### Completed

| Item | State |
|------|-------|
| `FontSansFamily` token added; every typography style now routes its `FontFamily` through it | ✅ `Resources/DesignTokens.xaml` |
| `NumericCellStyle` now sets `HorizontalAlignment="Right"` (T4) | ✅ |
| `EmphasisCellStyle` (15 / Medium) and `TotalsCellStyle` (15 / SemiBold, right-aligned) added (T2) | ✅ |
| `MutedTextStyle` foreground → `TextMutedBrush`, so the meta role is consistent | ✅ |
| Density row-padding tokens added (S3) | ✅ |
| Focus/contrast fixes the guides share: `TextMuted` AA fix, accent-as-text `LinkTextBrush`, theme-aware sidebar and status colours | ✅ see `Light_mode.md` §11 |

### Completed in this pass

| Phase | Item | Where |
|-------|------|-------|
| E2 | **`StatusBadge`** control: status vocabulary → subtle fill + per-mode accent-**text** label, so status is always a badge plus a word and is legible in both themes | `Views/Controls/StatusBadge.xaml(.cs)` |
| E2 | `StatusLevelConverter` maps the data layer's status words onto that vocabulary; `FeeCollectionView`'s coloured **balance text is gone** | `Converters/FormatConverters.cs` |
| E2 | Dead `BalanceColorConverter` (three hard-coded light-mode colours, one call site) removed | `App.xaml` de-registration |
| E2 | `Badge*TextStyle` tokens added so hand-built badges have a compliant option | `Resources/DesignTokens.xaml` |
| E3 | **`DataTable`** control: dynamic `Columns` (`Header`/`Width`/`Align`/`CellTemplate`/`SortPath`), one geometry source for header **and** rows | `Views/Controls/DataTable.xaml(.cs)` |
| E3 | Sorting with a direction indicator; the active column is accented, sortable-but-quiet columns show a muted chevron | `Views/Controls/DataTable.xaml.cs` |
| E3 | Count, totals row, row numbers, opt-in zebra, hover state, `IsStickyHeader` (default **off** per E0) | `Views/Controls/DataTable.xaml(.cs)` |
| E3 | **Pilot migration: Fee Collection** — 9 columns, cell templates only in the page, totals from the view model; the old header/row column-count mismatch (10 vs 11) is impossible by construction now | `Views/FeeCollectionView.xaml(.cs)` |
| E4 | Density (Compact/Comfortable/Spacious) as a **persisted preference** (`LocalSettings`, same convention as the theme), surfaced in every `DataTable` toolbar | `Services/DensityService.cs` |
| E4 | Empty (first-run vs no-results), loading (skeleton rows at the active density) and error-with-retry states | `Views/Controls/DataTable.xaml.cs` |
| E4 | ≥24×24 targets on the sort headers and in-table buttons | `TableSortHeaderButtonStyle` |

### Completed in the second pass (22 Sep 2026)

| Phase | Item | Where |
|-------|------|-------|
| **E1** | **R1 resolved — the spike came back positive.** WinUI 3 *does* expose `Microsoft.UI.Xaml.Documents.Typography.NumeralAlignment`, and the enum `Microsoft.UI.Xaml.FontNumeralAlignment` has a `Tabular` member. Every numeric role now sets it: `NumericCellStyle`, `TotalsCellStyle`, `KpiValueStyle`, `KpiMetricValueStyle` (XAML `Typography.NumeralAlignment="Tabular"`) and the chart annotations (C#). No font swap, no fixed-width-column hack | `Resources/DesignTokens.xaml`, `AnalyticsView.xaml.cs`, `DefaultersAnalyticsView.xaml.cs` |
| E1 | `NumericCellStyle` weight `SemiBold` → `Normal`, so **bold is reserved for alerts/critical** (the last unchecked E1 box) | `Resources/DesignTokens.xaml` |
| **E3** | **Teachers** register migrated — the six column definitions were written twice (header + rows) with `16,10` header padding against `16,8` row padding; now one `Columns` list. Gains sorting, a count and real empty states | `Views/TeachersView.xaml(.cs)` |
| **E3** | **Budget** register migrated. Its `Spent`/`Remaining` cells were **coloured body text** — the exact C3 violation — and are now plain numbers with a labelled `StatusBadge`; totals row wired from the view model | `Views/BudgetView.xaml(.cs)` |
| **E3** | **Assessments** register migrated (8 columns): weight/date/marks/status/author, with the marks-entry progress ring as a cell template | `Views/AssessmentsView.xaml(.cs)` |
| E2 | `StatusLevelConverter` vocabulary extended for the registers the sweep touched (`On Track`, `Near Limit`, `Over Budget`, `Verified`, `Published`, `Complete`, `Confirmed`, `Promoted`, `Repeat`, …) so status wording has one owner instead of per-view colour logic | `Converters/FormatConverters.cs` |
| **E4** | `IsLoading` / `ErrorMessage` **wired**: `TeachersViewModel`, `BudgetViewModel` and `AssessmentsViewModel` now expose `IsBusy` + `ErrorMessage` (same convention as `LoginViewModel`) and the three `DataTable`s bind them. A slow load shows the skeleton; a failed load shows the retryable error state with the exception message | 3 view models + 3 views |
| **E5** | Decorative accent usage reduced (C1): new `KpiMetricValueStyle` (20px SemiBold, primary, tabular) and `KpiMetricAttentionStyle` (bold, host picks amber/red). Applied in Fee Collection, Budget, Term Management, Promotion, Financials and Assessments. Note `KpiValueStyle` (28px) already existed — a duplicate was created and corrected to `KpiMetricValueStyle` rather than shadowing it | `Resources/DesignTokens.xaml` + 6 views |
| **E5** | `Table.md` refreshed: banner marking §3/§8 **superseded for new work** by the `DataTable` component, retained as rationale + legacy reference | `Table.md` |
| **E5** | `DashboardDesignPattern.md` refreshed: new §5 on KPI/status colour discipline (which token for which figure, bold reserved for alerts, colour never alone, tabular alignment) | `DashboardDesignPattern.md` |
| R1 | Closed by the spike above; fallback (right-align + fixed-width columns) not needed | — |
| R6 | Closed earlier: `Segoe UI` via `FontSansFamily` | — |

**Verification:** `dotnet build AutoTable.csproj -p:Platform=x64 --nologo` → **0 errors**, 5,637 warnings (all pre-existing `CA1416` platform-availability warnings).
Theme token parity verified by `_check_theme_parity.ps1` → **175 / 175 / 175** keys across Default/Light/Dark.
The integration-test project (`Tests/AutoTable.IntegrationTests`) was still not run: it covers licence and
DB logic, none of which this pass touches.

### Completed in the third pass (22 Sep 2026)

| Phase | Item | Where |
|-------|------|-------|
| **E3** | **Grade Book** register migrated (10 columns). The columns were declared twice — once for the header grid and once inside the row template — and the **header grid carried no padding while the row grid carried `16,9`**, so every heading sat 16px left of the column it labelled. Now one `Columns` list; gains sorting, a count, a class-average/at-risk totals row and real empty/loading/error states | `Views/GradebookView.xaml(.cs)` |
| **E3** | **Marks Entry** register migrated (6 columns + row numbers). Same header/row padding mismatch, and the first column was headed `#` while displaying the internal `StudentId` — replaced by real row numbers, so the internal id leaves the UI. The `Mark` column sorts on the numeric `Mark` rather than the editor's text (`9` can no longer land after `100`), and the two inline editors are new cell templates | `Views/MarksEntryView.xaml(.cs)` |
| **E3** | `DataTableColumn.CellAlign.Stretch` added so an inline-edit cell fills its column while the header stays left-aligned; previously only `Left`/`Center`/`Right` existed and any editor-sized-to-content cell collapsed to a few pixels | `Views/Controls/DataTableColumn.cs` |
| **E2** | **Badge wording fix (app-wide).** `StatusBadge` fell back to `Status.ToString()` — the *level* name — so the domain word was replaced by the vocabulary word: `At Risk` rendered as “Overdue”, `Excellent` as “Paid”, `Surplus` as “Active”. All four call sites (Fee Collection, Budget, Assessments, Grade Book) now pass the real word through the badge's `Text` override, so the level only chooses the colour. This is what C2's “badge plus a word” actually requires | 4 views + `Views/Controls/StatusBadge.xaml` docs |
| E2 | `StatusLevelConverter` vocabulary extended for the grade band words (`Excellent` → positive, `At Risk` → attention, `No Data` → neutral, i.e. *no mark yet* is not a problem to flag red) | `Converters/FormatConverters.cs` |
| **E4** | `IsLoading` / `ErrorMessage` wired for the two registers above: `GradebookViewModel` and `MarksEntryViewModel` now expose `IsBusy` + `ErrorMessage`, with `LoadAsync` / `LoadMarks` wrapped in try/catch/finally so a failed load shows the retryable error state instead of an empty table. Marks Entry also clears its rows on failure so a stale roster cannot be submitted | 2 view models + 2 views |
| **E5** | Decorative accent removed from the Grade Book KPI strip (Class Average and Top Performers were blue/green regardless of the figure); amber/red is kept only on *At Risk*, which genuinely signals attention. The Marks Entry completion figure moved to `KpiMetricValueStyle` — and now renders `62%` instead of the bare `62` under a “Completion” label next to a 0–100 bar | `Views/GradebookView.xaml`, `Views/MarksEntryView.xaml` |
| **E5** | The Grade Book's grade-letter badge (blue fill, blue text — `InfoBlue` as text fails AA in light mode at 3.1:1) became plain text: a grade letter is a classification, not a status, so colouring it was a redundant second signal | `Views/GradebookView.xaml` |

**Verification (third pass):** `dotnet build AutoTable.csproj --nologo` → **0 errors**, 5,666 warnings (all
pre-existing `CA1416`; the +29 over the second pass is generated-XAML code lines from the two new
`DataTable` hosts). `dotnet test Tests/AutoTable.IntegrationTests` → **57 passed, 0 failed, 0 skipped** —
the first time this suite has been run in this work; it covers licence duration and DB logic and is
therefore a regression check on the shared layer the register work depends on, not on the views themselves.

### Fourth pass — the register sweep completed (23 Sep 2026)

| Phase | Change | Files |
|-------|--------|-------|
| **E3** | **All 13 primary registers now on `DataTable`.** **Classes** (grading systems stay a card list — not a register; rows regain their open-editor click via the new `RowClick` event), **Report Cards**, **Student Performance** (blue Overall text and blue-on-blue grade badge removed, same as Grade Book), **Defaulters** — both its registers; the cohort summary's four coloured counts are now plain tabular numbers, and the decorative ellipse in the `#` column is gone, **Analytics Class Breakdown** (its rows coloured Average blue, At-Risk red and Excellent green — three C3 violations in one table), **Financials Recent Transactions** (bold-green amount → `NumericCellStyle`; the dead “View all →” link, which had no handler, is dropped with the header band; `Confirmed` status now a `StatusBadge`) | 6 views + code-behinds |
| **E3** | `DataTable.RowClick` — additive event so a register whose row opens an editor (Classes) keeps the affordance on the shared control | `Views/Controls/DataTable.xaml.cs` |
| **E4** | `IsBusy` + `ErrorMessage` wired on the six remaining register view models, bound to `DataTable.IsLoading`/`ErrorMessage` — skeleton on load, retryable error on failure | 6 view models + 6 views |
| **E2** | **Promotion status chip → `StatusBadge`.** The chip was a hard-coded `NavySidebarBrush` fill with `TextOnDarkBrush` text — a dark-mode-only treatment that ignored the active theme entirely. “Shifted” added to the vocabulary (accent blue) | `Views/PromotionView.xaml`, `Converters/StatusVocabulary.cs` |
| **E2** | **Status vocabulary extracted and locked by tests.** The `StatusLevel` enum and the ~40-word mapping moved to `Converters/StatusVocabulary.cs`, which is deliberately WinUI-free so the integration test project compiles it; `StatusLevelConverter` now delegates to `StatusVocabulary.Map` and `StatusBadge` consumes the shared enum. **46 new tests** pin every word → level mapping plus domain-contract guards on the words the data layer actually emits (`Transaction` defaults to “Confirmed”, `PromotionRow` emits “Promoted/Repeat/Shifted”, `AssessmentItem` emits “Published/Verified/Complete/In Progress”) — a wrong entry now fails a test instead of silently re-colouring badges | `Converters/StatusVocabulary.cs` (new), `Converters/FormatConverters.cs`, `Views/Controls/StatusBadge.xaml.cs`, `Tests/.../StatusVocabularyTests.cs` (new) |
| **E5/L4** | **Edit Class modal grouped into `TabView` tabs** (Details / Streams / Subjects) — the one genuine multi-part record editor, previously an ~8-section single scroll. Tabs keep the single-step save/cancel flow while giving each part its own screen. The enrollment form keeps its sectioned single scroll deliberately: it is a short paper-form metaphor, not a multi-part record. The modal's status text was hard-coded translucent white — unreadable in Light — now `TextSecondaryBrush` | `Views/ClassesView.xaml.cs` |
| **E5** | Analytics KPI strip de-accented: School Average (blue), Best Class (green) and Term Trend (green) were decorative; red stays only on “Needs Attention”, which signals real attention | `Views/AnalyticsView.xaml` |

**Verification (fourth pass):** `dotnet build AutoTable.csproj --nologo` → **0 errors**
(all warning codes pre-existing: `CA1416`, `NETSDK1198`, `MVVMTK0034`; the rise over the third pass is
generated-XAML code from six more `DataTable` hosts, offset by a removed duplicate-using warning).
`dotnet test Tests/AutoTable.IntegrationTests` → **103 passed, 0 failed, 0 skipped** (57 prior + 46 vocabulary).

### Outstanding

| Phase | Item |
|-------|------|
| — | **Closed this pass:** all 13 primary registers on `DataTable` (E3), `StatusLevelConverter` test coverage (E2), form-tab unification for the one multi-part editor (L4), status vocabulary single-owner extraction (E2) |
| — | **Closed 24 Sep 2026:** the §12.1 checklist's automatable portion is now a runnable smoke suite (`Tests/smoke_modal_checks.ps1`, 11/11); M11 inline validation shipped in the five code-built editors + enrollment form; the launch-requirement fix (`WindowsAppSDKSelfContained`) made Debug exes machine-independent |
| E1/E2 | Focus visual states on property-only styles — still open (needs a keyboard-walk in the running app to verify) |
| E3 | `AutoTable/Views/StudentsView.xaml` — the student list is a master-detail page, not a register; migrating it is a design decision (what the detail pane becomes), not a mechanical swap |
| R7 | Row virtualization — deliberately deferred, see the note below |

### R7 — virtualization: deliberate deferral

Not implemented, on purpose. The two available mechanisms on this WinUI 3 build are both
unverifiable without running the app: `ElementFactory` does not exist, and `IElementFactory` on
`ItemsRepeater.ItemTemplate` has open crash reports (microsoft-ui-xaml #3448, #4705). A `ListView`
can virtualize, but only when it owns a bounded viewport — which contradicts the `Table.md §6`
single-page-scroll contract that every current register still uses. Nothing in the app opts into
`IsStickyHeader` yet, so a virtualizing path would be dead code whose correct rendering I cannot
confirm headlessly. The agreed approach when a register actually passes ~1–2k rows: render the body
through a `ListView` with a stretch container style, bounded by `StickyMaxHeight`, only on the
`IsStickyHeader` path so no existing view changes behaviour.

The integration-test project (`Tests/AutoTable.IntegrationTests`) was not run: it covers licence and
DB logic, none of which this pass touches.

---

*Fourth pass recorded 23 Sep 2026. All 13 primary registers are on `DataTable`; the status
vocabulary is extracted (`Converters/StatusVocabulary.cs`) and locked by 46 tests; the one genuine
multi-part editor is tabbed. What remains needs the running app: a visual pass over the six newest
`DataTable` hosts and a keyboard walk for focus states — plus the student-list design decision and
the R7 deferral above.*

*Fifth pass recorded 23 Sep 2026 (§12/§13): modal-design and general ERP-UX sources added to
§1 (E6–E12). Modal gaps fixed: themed dialog chrome via `ContentDialog*` theme-resource overrides
in all three dictionaries (M1 — every one of the 109 dialog sites now renders on-token); Esc
affordance restored on the two dialogs missing `CloseButtonText` (M3); the code-built modal close
button's literal `"?"` replaced with the `E711` ChromeClose glyph (M4). Copy discipline was
audited and found already compliant (M2, M5, M6, M8); destructive-default rule (M6) recorded as
forward-looking. `dotnet build` and the 103-test suite re-verified after these changes.*

*Fifth-pass audit addendum (same day, §12.1/§13.1): re-reading M6 against WinUI's actual
`DefaultButton` default exposed that the three destructive confirms fired Delete on Enter — all
fixed to Close-default. The M8 audit was corrected (broken grep had missed one true success
modal, removed; LoginView exempted as a security acknowledgment). Edit Class modal width-clamp
fixed (M12). U1–U8 audited per-page: all conformed except U7 (user-research loop — product
owner). Final build **0 errors**; tests **103/103**.*
## 12. Modal & dialog standards (E6–E9)

AutoTable is dialog-dense: **109 `new ContentDialog` sites across 15 files**. The modal guides
agree on a compact canon; AutoTable's version of it:

| # | Principle (source) | AutoTable rule |
|---|--------------------|----------------|
| M1 | The overlay is part of the modal: it dims and disables the background and signals urgency (E6, E7, E8). | **Themed chrome via theme-resource override, not an implicit Style.** WinUI's `ContentDialog` reads `ContentDialog*` theme brushes; overriding `ContentDialogBackground`, `ContentDialogSmokeFill`, `ContentDialogBorderBrush`, `ContentDialogForeground`, `ContentDialogSecondaryForeground` and `ContentDialogSeparatorBorderBrush` in all three theme dictionaries re-skins **every dialog at once** (SurfaceElevated + BorderLight + our text tokens + our overlay). An implicit `Style TargetType=ContentDialog` would drop the control template and render a blank window — forbidden. |
| M2 | Purpose lives in the title; the CTA answers it; body adds context (E8, E9). | Existing convention, keep: titles like "Delete Class — {name}", body states consequences. |
| M3 | Users must never feel trapped: multiple, visible exits — Cancel/Close **plus Escape** (E6, E8, E9). | **Every `ContentDialog` sets `CloseButtonText`.** WinUI maps Escape to the Close button only; a dialog without one has a dead Esc key. Audit result: 107/109 compliant; the two gaps (ShellView license alert, StudentPerformance modal) were fixed and both now carry `CloseButtonText = "Close"`. |
| M4 | An explicit ✕ close affordance in the top-right for large modals (E9: "visible close button, not hidden in a corner"). | Custom hosted modals (`StudentPerformanceModalView`) carry a `DialogCloseButtonStyle` ✕. The code-built copy used a literal `"?"` as its content — fixed to the `E711` ChromeClose glyph. |
| M5 | ≤ 2 actions; explicit, outcome-stated labels; never Yes/No/OK-only (E8, E9). | Already near-perfect: exactly one `"OK"` primary existed, now paired with a Close button; destructive primaries say "Delete"/"Terminate" and pair with "Cancel". New dialogs must follow. |
| M6 | Confirmation only for high-stakes actions; stated consequences; destructive default = **Close** (E6/Figma, E8). | The three delete-confirms (Classes ×2, SchoolSettings account) state consequences explicitly. **`DefaultButton = Primary` on a destructive dialog is forbidden going forward** — Enter must never fire a delete. Existing confirms are non-default (safe). |
| M7 | One modal at a time (E8, E9 — stacking costs context and accessibility). | Max 2 layers, only for confirm-inside-a-flow (Eleken's sanctioned case). The Edit Class modal's grading-system delete confirm is the pattern to copy. |
| M8 | Success is inline/toast feedback, never a modal (E8, E6). | Verified: zero success modals in the app. Keep it that way. |
| M9 | Keyboard focus enters the dialog; keyboard can reach every control (E8, E9). | `DefaultButton` is set on 9 audit-confirmed sites; ContentDialog traps focus by template. Verification-in-app remains (§11 fifth pass). |
| M10 | Restriction/alert dialogs get empathy and a recovery path, not a dead end (E6/LinkedIn, E8). | License-issue dialogs now offer Close and explain what to do ("contact your vendor…"). Extend this tone to every new blocking message. |
| M11 | Prefer lighter patterns when interruption isn't justified (E6, E9): inline banners, toasts, drawers, inline expansion. | Validation errors inside modal forms stay inline next to fields; only blocking decisions justify ShowAsync. |

**Verification hooks:** a full `CloseButtonText` audit can be re-run headlessly with the awk
one-liner used in the 23 Sep pass (blocks with `ShowAsync` but no `CloseButtonText` = failures).

### 12.1 Fifth-pass audit — sizing, density, defaults (23 Sep 2026)

| # | Finding | Result |
|---|---------|--------|
| M12 | **Wide-dialog width overrides were inconsistent.** Teachers (×2) and the Students enrollment modal override `ContentDialogMaxWidth` (~548px default) to fit their two-column layouts, but the widest editor of all — Edit Class (identity + streams + subjects, tabbed) — was silently clamped to ~548px into a cramped single column. | Fixed: Edit Class now overrides to 1040 via a `ModalWidth` const matching TeachersView. **Rule: any editor that hosts a multi-column or tabbed layout must override `ContentDialogMaxWidth`; the app's wide-editor width is 1040.** |
| M6 | **Re-reading the rule exposed a live violation class.** WinUI's `ContentDialog.DefaultButton` **defaults to Primary** — so the three destructive confirms that never set it fired *Delete* on Enter, exactly what M6 forbids. The earlier audit statement that they were "non-default (safe)" was wrong. | Fixed: Delete class, delete grading system, and remove account now set `DefaultButton = Close` explicitly (Student terminate already did). LoginView's "Reset" and all creation dialogs keep Enter-primary deliberately — completing a user-requested form is not destruction. |
| M8 | **Correction to the earlier audit:** the success-modal grep had an unclosed group and silently matched nothing. The corrected audit found one true success modal — Fee Collection's "Status Updated", shown *on top of the toast the same handler had already raised* (the exact double-notification E6 warns about). The other matches are InfoBars (inline, correct pattern) and LoginView's "Success" (credential reset = security acknowledgment, sanctioned by E9). | Fixed: the Fee Collection modal is removed; the toast remains. LoginView exempted with rationale. **Rule: toast *or* modal, never both, and success = toast unless the user must acknowledge a state change.** |
| — | **Sanctioned traps:** two dialogs intentionally block dismissal. The Per-Class Term Fees dialog has no `CloseButtonText` — bulk fee entry must be completed first. `LicenseActivationDialog` cancels every `Closing` until activation resolves (a live Esc would otherwise let an unlicensed machine into the shell). | The M3 exemption list lives in `Tests/smoke_modal_checks.ps1` (`$exemptions`) and is enforced, not just recorded. Do not add to it without a product decision. |
| — | **Density:** validated dialogs gate the primary via `IsPrimaryButtonEnabled`; the M11 improvement path (inline banners + field highlight, no error dialogs) shipped 24 Sep 2026 via `Views/ModalValidation.cs` in the five code-built editors + the enrollment form. | Closed — new editors use `ModalValidation`; never a second modal for validation, never a silent discard. |

**Verification — `Tests/smoke_modal_checks.ps1` (automated; 15 checks; `powershell -NoProfile -ExecutionPolicy Bypass -File Tests\smoke_modal_checks.ps1`):**

| Check | Rule | Method |
|---|---|---|
| Six `ContentDialog*` brush overrides present in all three theme dictionaries | M1 | static — DesignTokens.xaml |
| Every `ShowAsync` dialog block sets `CloseButtonText`, minus `$exemptions` | M3 | static — Views/**/*.xaml.cs |
| No destructive confirm (`Delete`/`Terminate`/`Remove` primary) omits `DefaultButton` | M6 | static |
| Close glyph is ChromeClose `E711`, not a literal `"?"` | M4 | static — StudentPerformanceView |
| No success-titled dialogs outside the LoginView exemption (`InfoBar.Title` excluded — it *is* the inline pattern) | M8 | static — all views |
| Wide/tabbed editors (Classes, Teachers) override `ContentDialogMaxWidth` at 1040 | M12 | static |
| Demo-mode launch survives 15s; no `autotable_init_error.txt`; no unhandled exceptions in the desktop log | — | runtime |

**In-app manual remainder (needs eyes on the running app; each maps to a rule):**

1. Flip theme both ways, open any CRUD dialog — chrome is the elevated surface with themed border/text; scrim matches theme (M1).
2. Esc closes: license alert, StudentPerformance modal, any CRUD dialog (M3).
3. Keyboard walk on a delete confirm: **Enter does not delete**; Esc/Cancel does (M6).
4. Edit Class modal opens ~1040px wide with usable tabs (M12 + fourth pass).

**Launch-requirement fix (24 Sep 2026):** the first smoke run exposed that a CLI-launched Debug
exe crashed with `REGDB_E_CLASSNOTREG` before any app code ran — the Debug exe depended on the
*installed* Windows App Runtime MSIX, and the installed set did not satisfy the bootstrapper's
version contract for SDK 2.3.1 (the machine holds 2.3.2-experimentalA and 2.4, neither acceptable
to it), while the shipping `publish/` build is self-contained and was immune. Fixed with
`<WindowsAppSDKSelfContained>true</WindowsAppSDKSelfContained>` for all configurations, aligning
Debug with the shipping model: the runtime payload now lives app-local in `bin\x64\...` and
launch no longer depends on what MSIX runtimes a machine happens to have.

**SDK upgrade (24 Sep 2026):** `Microsoft.WindowsAppSDK` **2.3.1 → 2.4.0** — matching the
stable 2.4 runtime the machine already has (the stable 2.x line runs 2.0.1 → 2.5.1; 2.3.1 was
confirmed a *stable* release, correcting an earlier note here that mislabelled it experimental).
Build 0 errors, launch verified, smoke suite 15/15, tests 103/103.

**Checklist status:** of the original six manual checks, **the statically-checkable ones are now
automated** (M1/M3/M4/M6/M8/M12 + launch runtime; the suite runs 15 checks). The genuinely-visual
remainder is the four items printed at the end of the script.

---

## 13. General ERP UX principles (E10–E12)

Where §2–§5 govern components, these govern the product. Sources E10–E12 converge on:

| # | Principle | Source | AutoTable application |
|---|-----------|--------|----------------------|
| U1 | **Modular capability spine:** integration, automation, data analysis, reporting, tracking/visibility — native modules automate end-to-end. | E10 | The module map already matches (registers → analytics → reports). New features must declare which capability they serve before implementation. |
| U2 | **Streamline complex processes into logical steps; progress visibility.** | E11, E12 | Multi-part records group into tabs (Edit Class modal — done §11 fourth pass); wizards show steps; long operations surface `IsBusy` states (E4, done). |
| U3 | **Role-based access & relevance: only show what's relevant per role.** | E11, E12 | `UserEntity.AllowedPages` gates navigation; extension work must keep screens role-relevant, not hide behind feature flags alone. |
| U4 | **Same style everywhere; clear words; response to every action; speed affordances (shortcuts, autofill, batch); accessible to all.** | E12 | This is §2–§5 plus the shared `DataTable`/`StatusBadge`/status-vocabulary layer — new UI composes from these, never re-invents. |
| U5 | **Scalable information architecture; avoid deep menu trees; names that say the action.** | E11, E12 | Sidebar navigation is flat (two levels max). New pages must name themselves as the task ("Fee Collection", not "Module 7"). |
| U6 | **Key data first: dashboards surface what the role needs to act on.** | E12 | KPI discipline (E5): figures neutral unless they demand action; breakdowns live one drill-down away. |
| U7 | **Design with end users; treat adoption/feedback as part of the build.** | E11, E12 | Out of scope for code passes; flagged for the product owner — the in-app user tour (already shipped) is the current feedback surface. |
| U8 | **Cross-device continuity.** | E11, E12 | AutoTable is Windows-desktop by deployment; window-resize behaviour (min width, single-scrollbar contract) is the in-scope interpretation. Mobile is out of scope. |

### 13.1 Per-page audit against U1–U8 (23 Sep 2026)

| U | Finding in AutoTable | Status |
|---|----------------------|--------|
| U1 | Capability map: registers + enrollment (integration), assessments/marks entry (automation), analytics/report cards (analysis + reporting), audit log + fee/defaulters tracking (visibility). | ✅ conformed — new features must name their capability in the implementation log before work starts |
| U2 | Multi-part records grouped into tabs (Edit Class); E4 busy/error states on all 13 registers; enrollment form is a sectioned short scroll by design. | ✅ conformed |
| U3 | `AllowedPages` is enforced at navigation, not merely stored: ShellView gates routes (ShellView.xaml.cs ~144/~284/~295) and lands restricted users on their first granted route (~343); SchoolSettings edits grants; invite codes carry grants. | ✅ conformed (verified by code inspection this pass) |
| U4 | Consistency: token layer + shared `DataTable`/`StatusBadge`/status vocabulary; clear words: M2/M5 audited; response: E4 states; speed: typeahead search in fee entry, batch fee dialog; accessibility: focus walk still open. | ✅ partial — the keyboard/focus walk is the open item |
| U5 | Sidebar is a flat list of 21 task-named buttons, no nesting; pages named by task ("Fee Collection", "Marks Entry"), not module numbers. | ✅ conformed |
| U6 | Dashboard + per-module KPIs with E5 discipline (neutral unless attention); drill-downs exist (class breakdown, defaulters cohort). | ✅ conformed |
| U7 | The in-app user tour (`UserTourOverlay`) is the embedded-guidance surface; a structured feedback loop with real users (interviews, observation per E11/E12) is not something a code pass can do. | ⚠ product-owner action — flagged, not implementable here |
| U8 | Windows-desktop deployment; the in-scope interpretation is resize behaviour + the single-scrollbar contract. | ✅ scoped, documented |

**How to use this table:** when a new page or feature lands, add a row per U-principle it
touches — same discipline as the M-rules for dialogs. A feature that cannot name its U1
capability or its per-role relevance (U3) is not ready to build.

---

