# Table Layout Template

This document defines the canonical table layout used across the ERP UI. It is derived from the Orders table (`orders-view.tsx`) and the shared table patterns used by Staff/Salary and other module tables. New tables should copy this structure and CSS classes exactly unless a module-specific requirement justifies a documented deviation.

## 1. Outer Container

```tsx
<section className="panel module-table">
  ...
</section>
```

- `panel`: card container with border, rounded corners, and background (`--card`).
- `module-table`: marks the section as a table surface. It enables the constrained scroll area and responsive heading behavior.
- The section is full width of the content area. Do not wrap it in `.workspace`, `.flex`, or any constrained grid unless the module already requires a split layout.

## 2. Panel Heading

```tsx
<div className="panel-heading">
  <h2>
    Table title <span className="inline-count">{rows.length}</span>
  </h2>
  <span className="text-muted-foreground text-xs">
    Short descriptive subtitle
  </span>
</div>
```

- Heading padding: `16px 24px 0` desktop, `16px 15px 0` mobile.
- Title font size: `12px` inside `.module-table`; weight follows global heading styles.
- `.inline-count`: muted background, `11px`, weight `500`, padding `2px 6px`, radius `4px`.
- Subtitle: muted foreground, `11px` (mobile), `12px` desktop where applicable.

## 3. Table Controls

```tsx
<div className="table-controls">
  <label className="search-box">
    <Search size={16} />
    <input
      aria-label="Search ..."
      placeholder="Search ..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  </label>

  <label className="filter-select">
    <SlidersHorizontal size={14} />
    <select aria-label="Filter ..." value={filter} onChange={...}>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  </label>
</div>
```

- Container padding: `16px 24px` desktop, `14px 13px` mobile.
- Layout: flex row, `align-items:center`, `justify-content:space-between`, gap `12px` desktop / `8px` mobile.
- Search box: full-width up to `320px`, icon `16px`, input font `12px`.
- Filter select: icon `14px`, aligned to the right on mobile (`margin-left:auto`).
- Controls should wrap on small screens (`flex-wrap:wrap`).

## 4. Scroll Container

```tsx
<div className="table-scroll">
  <table className="orders-table">...</table>
</div>
```

- `.table-scroll`: `overflow:auto`.
- `.module-table .table-scroll`: `max-height: calc(100vh - 340px); overflow:auto;`.
- The scroll container is the only vertically scrollable table region. Keep headers sticky inside it.

## 5. Table Element

```tsx
<table className="orders-table">
```

- `width:100%`.
- `border-collapse:collapse`.
- `white-space:nowrap`.
- `text-align:left`.
- Use `orders-table` as the shared table class even for Staff/Salary-style tables unless a module needs a separate documented class.

## 6. Header (`thead`)

```tsx
<thead>
  <tr>
    <th>Column</th>
    <th className="num-col">Amount</th>
  </tr>
</thead>
```

- Background: `var(--background)`.
- Top border: `1px solid var(--border)`.
- Bottom border: `1px solid var(--border)`.
- Position: `sticky; top:0; z-index:2`.
- Header cells:
  - Padding: `11px 13px`.
  - First child padding-left: `20px` desktop, `15px` mobile.
  - Font size: `11px`.
  - Font weight: `500`.
  - Color: `var(--muted-foreground)`.
- Numeric header: `text-align:right` via `.num-col`.
```

## 7. Body Cells (`td`)

- Padding: `14px 12px` desktop, `14px 10px` mobile.
- First child padding-left: `20px` desktop, `15px` mobile.
- Last child padding: `padding-left:0; padding-right:8px`.
- Font size: `12px`.
- `font-variant-numeric:tabular-nums`.
- Bottom border: `1px solid var(--border)`.
- Last row removes bottom border.
- Numeric cell: `text-align:right; font-variant-numeric:tabular-nums` via `.num`.
- Amount cell: `font-weight:600; font-variant-numeric:tabular-nums; text-align:right` via `.amount-cell`.

## 8. Row Behavior

```tsx
<tr className="order-row-tint tone-blue" onClick={() => onSelect(row)}>
```

- Body rows are clickable: `cursor:pointer`.
- Hover background: `var(--background)`.
- Optional tinted rows use `.order-row-tint` plus a tone class:
  - `tone-green`, `tone-blue`, `tone-violet`, `tone-red`, `tone-amber`, `tone-gray`, `tone-teal`, `tone-orange`, `tone-rose`.
- Tint gradient runs left-to-right from the tone color to `--card`/`--background`.
- Tinted row cells must have transparent backgrounds so the row gradient shows.
- Hover on tinted rows shifts the gradient toward `--background`.

## 9. Common Cell Patterns

### Product / Primary Name

```tsx
<td>
  <span className="product-name">{name}</span>
  <span className="cell-sub">{subtitle}</span>
</td>
```

- `.product-name`: font weight `500`, font size `12px`; inside `.module-table` becomes `13px`.
- `.cell-sub`: block, muted foreground, `11px`, margin-top `4px`.
- `.customer-cell strong` inside `.module-table`: `13px`.

### Numeric Columns

- Use `.num` for plain numeric values.
- Use `.amount-cell` for money values.
- Always right-align numeric columns and use tabular numerals.

### Status Badges

- Use the shared status badge classes (`status`, `status-paid`, `status-pending`, etc.).
- Badge text should remain compact and use the module’s semantic color tokens (`--green`, `--amber`, `--red`, etc.).
- Do not introduce ad hoc badge colors.

### Action Column

- Last column contains icon buttons.
- Last cell button size: `height:25px; width:25px`.
- Last cell icon size: `width:13px`.
- Last cell has reduced right padding (`8px`).

## 10. Table Footer

```tsx
<div className="table-foot">
  <span>{rows.length} rows</span>
  <span>{new Date().toLocaleString("en", { month: "long", year: "numeric" })}</span>
</div>
```

- Border top: `1px solid var(--border)`.
- Padding: `13px 24px` desktop, `12px` mobile.
- Layout: flex, `justify-content:space-between`.
- Color: `var(--muted-foreground)`.
- Font size: `11px` desktop, `7px` mobile for `.orders-panel .table-foot`.
- Use the footer for row count and contextual metadata.

## 11. Empty State

```tsx
<div className="empty-state">
  <Icon />
  <h3>No records found</h3>
  <p>Try changing filters or search terms.</p>
</div>
```

- Padding: `50px 20px`.
- Text align: center.
- Color: `var(--muted-foreground)`.
- Icon: centered, bottom margin `15px`.
- Heading: `14px`, foreground color.
- Paragraph: `12px`, margin-top `8px`.

## 12. Colors and Tokens

Use existing CSS variables only:

- Background: `var(--background)`.
- Card: `var(--card)`.
- Border: `var(--border)`.
- Muted background: `var(--muted)`.
- Muted text: `var(--muted-foreground)`.
- Foreground: `var(--foreground)`.
- Semantic tones: `--green-soft`, `--blue-soft`, `--violet-soft`, `--red-soft`, `--peach-soft`, `--teal-soft`, `--orange-soft`, `--rose-soft`.

Do not hardcode colors. Dark mode must continue to work through these tokens.

## 13. Typography

- Table body: `12px`.
- Table headers: `11px`, weight `500`.
- Module table primary names: `13px`.
- Subtitles/cell subtext: `11px`.
- Footer and controls: `11px`–`12px`.
- Use the app’s default font stack; do not introduce new font families.

## 14. Spacing Summary

| Element | Desktop | Mobile |
|---|---:|---:|
| Panel heading padding | `16px 24px 0` | `16px 15px 0` |
| Table controls padding | `16px 24px` | `14px 13px` |
| Header cell padding | `11px 13px` | `11px 13px` |
| First column padding-left | `20px` | `15px` |
| Body cell padding | `14px 12px` | `14px 10px` |
| Last cell padding-right | `8px` | `8px` |
| Footer padding | `13px 24px` | `12px` |
| Empty state padding | `50px 20px` | `50px 20px` |

## 15. Responsive Behavior

At `max-width: 700px`:

- Table controls wrap and search box becomes full width.
- Filter select moves to the right.
- Header and body first-column padding reduces to `15px`.
- Body cell padding reduces to `14px 10px`.
- Footer font size reduces to `7px` for `.orders-panel .table-foot`.
- Module table heading and buttons reduce to `11px`.
- Product/customer primary text remains `13px` inside `.module-table`.

Keep `white-space:nowrap` and horizontal scrolling rather than collapsing columns.

## 16. Canonical Template

```tsx
<section className="panel module-table">
  <div className="panel-heading">
    <h2>
      Records <span className="inline-count">{rows.length}</span>
    </h2>
    <span className="text-muted-foreground text-xs">
      Description of this table
    </span>
  </div>

  <div className="table-controls">
    <label className="search-box">
      <Search size={16} />
      <input
        aria-label="Search records"
        placeholder="Search records..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </label>

    <label className="filter-select">
      <SlidersHorizontal size={14} />
      <select
        aria-label="Filter records"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        {filters.map((f) => (
          <option key={f}>{f}</option>
        ))}
      </select>
    </label>
  </div>

  <div className="table-scroll">
    <table className="orders-table">
      <thead>
        <tr>
          <th>Name</th>
          <th className="num-col">Amount</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className={`order-row-tint ${row.tone}`}
            onClick={() => onSelect(row)}
          >
            <td>
              <span className="product-name">{row.name}</span>
              <span className="cell-sub">{row.subtitle}</span>
            </td>
            <td className="num amount-cell">{row.amount}</td>
            <td>
              <span className={`status ${row.statusClass}`}>
                {row.status}
              </span>
            </td>
            <td>
              <button aria-label="Open row">
                <Eye size={13} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  <div className="table-foot">
    <span>{rows.length} records</span>
    <span>
      {new Date().toLocaleString("en", {
        month: "long",
        year: "numeric",
      })}
    </span>
  </div>
</section>
```

## 17. Implementation Rules

- Reuse `orders-table`, `table-scroll`, `table-controls`, `table-foot`, and `empty-state` classes.
- Keep table rows clickable only when a detail view exists.
- Use semantic status classes and tone classes; do not create new color variants without updating this document.
- Preserve sticky headers and constrained scroll height.
- Preserve `white-space:nowrap`; allow horizontal scrolling instead of wrapping cell content.
- Test both light and dark modes before considering a table complete.
```
```