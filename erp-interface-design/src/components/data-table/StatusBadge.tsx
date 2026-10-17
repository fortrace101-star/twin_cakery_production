import { orderStageTone, type StatusTone } from "@/lib/theme-tokens";

/**
 * Shared status badge — `erp_design.md` X2 / DashboardDesignPattern §5:
 * always badge + word, never coloured text alone. Renders the same DOM as the
 * legacy `<Status>` wrapper (`span.status.status-<tone>`) so existing CSS in
 * `styles.css` applies unchanged.
 */
export function StatusBadge({ value, tone }: { value: string; tone?: StatusTone }) {
  // Order-stage words win first (distinct hue per pipeline stage); everything
  // else resolves through the locked toneOf vocabulary unchanged.
  const resolved = tone ?? orderStageTone(value);
  return (
    <span className={`status status-${resolved}`}>
      <span aria-hidden="true" />
      {value}
    </span>
  );
}
