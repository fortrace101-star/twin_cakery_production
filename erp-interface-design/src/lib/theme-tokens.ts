/**
 * Single source of truth for the Twin Cakery ERP design tokens.
 *
 * Mirrors `erp-design-system.md` §2 (type scale), §3 (8px spacing grid) and
 * §6 (functional status colour), plus `erp_design.md` constraints C2-C4:
 * the status vocabulary is FIXED and every status must be legible without
 * colour (badge + word, never coloured body text).
 *
 * Tailwind values live in `src/styles.css @theme inline`; this module exists
 * so TypeScript code (mappers, tests, generated tables) shares the same
 * vocabulary instead of hard-coding strings.
 */

/* ---------- Type scale (erp-design-system.md §2) ---------- */
export const typeScale = {
  xs: { size: 11, weight: 400, use: "Table meta, timestamps, helper text" },
  sm: { size: 12, weight: 400, use: "Labels, secondary text" },
  base: { size: 13, weight: 400, use: "Body text, table cell content" },
  md: { size: 15, weight: 500, use: "Emphasized body / active row" },
  lg: { size: 18, weight: 600, use: "Section headings" },
  xl: { size: 24, weight: 600, use: "Page titles" },
  total: { size: 16, weight: 700, use: "Money totals / KPI numbers" },
} as const;

/* ---------- Spacing: strict 8px grid (erp-design-system.md §3) ---------- */
export const spacing = {
  1: 4, // half-step (icons inside badges, tight gaps)
  2: 8,
  3: 16,
  4: 24,
  5: 32,
  6: 40,
  7: 48,
} as const;

/* ---------- Layout (erp-design-system.md §4) ---------- */
export const layout = {
  sidebarWidth: 260,
  sidebarCollapsed: 68,
  topbarHeight: 64,
  contentPadding: 24,
} as const;

/* ---------- Status vocabulary (erp_design.md C2-C4 — LOCKED) ---------- */
export type StatusTone = "green" | "blue" | "red" | "amber" | "violet" | "gray";

/** Fixed mapping of status word -> tone. Never colour body text with these. */
export const statusTones: Record<StatusTone, readonly string[]> = {
  green: ["Paid", "Ready", "Completed", "Delivered", "In stock", "Approved", "Active", "Passed"],
  blue: ["In production", "Sent", "Dispatched"],
  red: ["Low stock", "Unpaid", "Rejected", "Out of stock", "Error"],
  amber: ["Pending", "Partially paid", "Awaiting dispatch", "Awaiting pickup", "Pending confirmation"],
  violet: ["Confirmed", "Accepted"],
  gray: ["Draft", "Inactive", "Cancelled", "Queued", "Baking", "Decorating", "Packing"],
};

/** Reverse lookup: status word -> tone (falls back to amber for unknowns). */
export function toneOf(status: string): StatusTone {
  for (const tone of ["green", "blue", "red", "amber", "violet", "gray"] as const) {
    if (statusTones[tone].includes(status)) return tone;
  }
  return "amber";
}
