# Dashboard Design Patterns — Reusable Template

> A simple design template describing how the **Dashboard** renders its widgets
> (KPI cards, AI Insights, Recent Activity) so the same pattern can be applied
> anywhere else — activity feeds, notification lists, audit logs.

---

## 1. The card → list → bordered-item pattern

Every dashboard widget follows the same three-layer visual hierarchy:

```
Card (KpiCardStyle / TableCardStyle Border with an Optional header)
└── List (ListView / ItemsControl bound to a collection)
    └── Item (Border with SurfaceGrayBrush background, rounded, padded)
```

### Layers

| Layer | Element | Purpose |
|-------|---------|---------|
| Card | `Border` with a theme style (`KpiCardStyle`, `TableCardStyle`, …) | Groups the widget, gives it the card background/radius/border |
| List | `ListView` / `ItemsControl` bound to an `ObservableCollection` | Renders N items; non-interactive lists use `ItemsControl` |
| Item row | `Border Background="{ThemeResource SurfaceGrayBrush}" CornerRadius="8" Padding="10,8"` | Gives each entry a **darker, inset background** against the card, matching the AI Insights entries |

### Why bracketed rows?

- Visually separates each entry so a long list stays scannable.
- Turns a plain text dump into a set of discrete cards, exactly like **AI Insights**.
- The `SurfaceGrayBrush` token stays theme-aware (light-mode gray / dark-mode dark)
  automatically.

---

## 2. Worked example — AI Insights / Recent Activity

### Recent Activity (Dashboard)

```xml
<ListView
    ItemsSource="{Binding RecentActivities}"
    SelectionMode="None"
    IsItemClickEnabled="False"
    ScrollViewer.VerticalScrollBarVisibility="Disabled"
    ScrollViewer.HorizontalScrollBarVisibility="Disabled">
    <ListView.ItemTemplate>
        <DataTemplate>
            <Border Background="{ThemeResource SurfaceGrayBrush}"
                    CornerRadius="8"
                    Padding="10,8"
                    Margin="0,0,0,6">
                <StackPanel Orientation="Horizontal" Spacing="8">
                    <Ellipse Width="6" Height="6"
                             Fill="{ThemeResource PrimaryBlueBrush}"
                             VerticalAlignment="Center"
                             Margin="0,1,0,0" />
                    <TextBlock Text="{Binding}"
                               TextWrapping="WrapWholeWords"
                               FontSize="13"
                               Foreground="{ThemeResource TextPrimaryBrush}" />
                </StackPanel>
            </Border>
        </DataTemplate>
    </ListView.ItemTemplate>
</ListView>
```

### Key elements

- **`SurfaceGrayBrush` background** — darker than the card surface, so each entry
  reads as an inset tile (the dark background the request asked for).
- **`CornerRadius="8"`** — soft, modern corners.
- **`Padding="10,8"`** — comfortable row height without being bulky.
- **`Margin="0,0,0,6"`** — a small vertical gap so rows don't touch.
- **`Ellipse` bullet** — a 6×6 theme accent dot (`PrimaryBlueBrush`) acts as a
  leading marker, like the AI insight glyph.

---

## 3. When to reuse this pattern

- **Activity feeds** (`RecentActivities` already does this).
- **Notification / audit lists** — each event as its own insert row.
- **Alerts / warnings panel** — e.g. unpaid students, expiring terms.
- **Any dashboard "latest N" list** where entries are short text lines.

### Variations

- **No bullet:** omit the `Ellipse` and keep just the text inside the Border.
- **Two-line entries:** add a second `TextBlock` (muted `TextSecondaryBrush`,
  `FontSize="12"`) beneath the primary one inside the same Border.
- **Actionable rows:** wrap the Border in a `Button` template or add a trailing
  chevron/button; keep the same background/radius/padding.
- **Icon leading:** replace the `Ellipse` with a small `FontIcon`
  (e.g. glyph `&#xE930;` for a check, `&#xE7BA;` for an alert) using the semantic
  brush for its color.

---

## 4. Checklist for applying this pattern

- [ ] Wrap each list item in `Border Background="{ThemeResource SurfaceGrayBrush}"`.
- [ ] Set `CornerRadius="8"` and `Padding="10,8"` on that Border.
- [ ] Add `Margin="0,0,0,6"` (or `Spacing`) for row separation.
- [ ] Disable the ListView inner scrollbars so the outer `ScrollViewer` scrolls.
- [ ] Use theme brushes (`TextPrimaryBrush`, `TextSecondaryBrush`, `SurfaceGrayBrush`)
      — never hard-coded colors.
- [ ] Use the `Ellipse`-or-icon leading marker consistently within one list.

---

## 5. KPI and status colour discipline (22 Sep 2026)

Colour is a scarce signal, not decoration — see [`erp_design.md`](erp_design.md) §2.4 (C1–C3)
and the audits in [`Light_mode.md`](Light_mode.md) / [`Dark_mode.md`](Dark_mode.md).

Two styles own every KPI figure:

| Token | Use for | Look |
|-------|---------|------|
| `KpiValueStyle` | Headline dashboard numbers | 28px Bold, `TextPrimaryBrush`, tabular figures |
| `KpiMetricValueStyle` | Informational card figures (e.g. "Collected", "Collection Rate", "Remaining") | 20px SemiBold, `TextPrimaryBrush`, tabular figures |
| `KpiMetricAttentionStyle` | Figures that genuinely signal attention (Outstanding, Unpaid, Repeat, Spent) | 20px Bold, host picks the amber/red brush, tabular figures |

Rules:

- **Do not colour a figure just because it is a number.** Green "collected" and blue "rate"
  spend the alert budget on values that carry no alert — use the informational style.
- **Bold is reserved for alerts/critical.** Informational KPI values are SemiBold.
- **Colour is never the only signal.** Every attention-styled figure sits under a label that
  already states its meaning ("Outstanding", "Suggested Repeat"), so the value is legible
  without the colour.
- **Status is always a badge plus a word.** Use `Views/Controls/StatusBadge.xaml` and feed it
  through `StatusLevelConverter`, which maps status wording onto the shared vocabulary. Never
  colour body text to convey status.
- **Numeric alignment:** numeric KPI values and table cells use tabular figures
  (`Typography.NumeralAlignment="Tabular"`), so digits align by place value and totals stop
  jittering as values change.
- [ ] Verify at light and dark theme — `SurfaceGrayBrush` must stay readable in both.