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
export type StatusTone =
  | "green"
  | "blue"
  | "red"
  | "amber"
  | "violet"
  | "gray"
  | "teal"
  | "orange"
  | "rose";

/** Fixed mapping of status word -> tone. Never colour body text with these. */
export const statusTones: Record<StatusTone, readonly string[]> = {
  green: ["Paid", "Ready", "Completed", "Delivered", "In stock", "Approved", "Active", "Passed"],
  blue: ["In production", "Sent", "Dispatched"],
  red: ["Low stock", "Unpaid", "Rejected", "Out of stock", "Error"],
  amber: ["Pending", "Partially paid", "Awaiting dispatch", "Pending confirmation"],
  violet: ["Confirmed", "Accepted"],
  gray: ["Draft", "Inactive", "Cancelled", "Queued", "Baking", "Decorating", "Packing"],
  // Order-pipeline extension tones (used via explicit `tone` prop /
  // `orderStageTone()` below so the locked vocabulary above never shifts).
  // Registries stay empty on purpose: `toneOf()` only resolves the six
  // locked tones, so listing words here would imply a mapping that never
  // fires. Stage -> tone lives in `ORDER_STAGE_TONES` (same file).
  teal: [],
  orange: [],
  rose: [],
};

/** Reverse lookup: status word -> tone (falls back to amber for unknowns). */
export function toneOf(status: string): StatusTone {
  for (const tone of ["green", "blue", "red", "amber", "violet", "gray"] as const) {
    if (statusTones[tone].includes(status)) return tone;
  }
  return "amber";
}

/**
 * Order-pipeline stage colours (dashboard "Order breakdown", order tables).
 * The 7 display stages collapse the backend's 14 statuses; each stage gets its
 * own distinct hue (green, blue, violet, teal, amber, orange, rose) so badges,
 * donut arcs, legend swatches and order-row tints can never share a colour.
 * The exact stage HEX values (#0F9D58, #1D4ED8, #9333EA, #65A30D, #EAB308,
 * #06B6D4, #166534) live in styles.css as the --*-solid / --*-soft / --*-ink
 * token families derived from each stage's base hex.
 * Stage words resolve here FIRST, then fall back to the locked `toneOf`
 * vocabulary — so `statusTones` above keeps its test-locked semantics.
 */
export const ORDER_STAGE_TONES = {
  "Pending confirmation": "green",
  Confirmed: "blue",
  "In production": "violet",
  Ready: "teal",
  "Awaiting Collection": "amber",
  "In Transit": "orange",
  "Completed / Delivered": "rose",
} as const satisfies Record<string, StatusTone>;

export function orderStageTone(status: string): StatusTone {
  return ORDER_STAGE_TONES[status as keyof typeof ORDER_STAGE_TONES] ?? toneOf(status);
}

/**
 * Pipeline ORDER of the 7 display stages (index = progress position). Keys are
 * exactly the keys of ORDER_STAGE_TONES above in flow order — the vertical
 * progress stepper on each order row renders strictly from this list, so the
 * two can never drift.
 */
export const ORDER_STAGE_PIPELINE = [
  "Pending confirmation",
  "Confirmed",
  "In production",
  "Ready",
  "Awaiting Collection",
  "In Transit",
  "Completed / Delivered",
] as const satisfies readonly (keyof typeof ORDER_STAGE_TONES)[];

/** Stage word that has a fixed position on the pipeline. */
export type OrderStage = (typeof ORDER_STAGE_PIPELINE)[number];

/** Pipeline position of a status word; -1 when off-pipeline (e.g. Cancelled). */
export function orderStageIndex(status: string): number {
  return ORDER_STAGE_PIPELINE.indexOf(status as OrderStage);
}
