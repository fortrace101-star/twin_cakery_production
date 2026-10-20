// ---------------------------------------------------------------------------
// §33 — Search, Filtering & Pagination (shared helper)
//
// Backward compatible by contract: when NEITHER `?page` nor `?pageSize` is
// present the rows are returned untouched as a plain array, so every existing
// client keeps working unchanged. Opting in returns a PageEnvelope:
//
//   GET /orders?page=1&pageSize=25&sortBy=createdAt&sortOrder=desc
//          &search=tc&from=2026-01-01&to=2026-06-30
//
// Per-route filters (status, category, customerId, outOfStock …) stay in the
// route — the helper only standardises the §33 params that are generic:
// `page`, `pageSize`, `search` (whitelisted fields), `from`/`to` (one date
// field), `sortBy`/`sortOrder` (whitelisted fields).
// ---------------------------------------------------------------------------

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

export interface PageEnvelope<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface PaginateOptions {
  /** Fields `?sortBy=` may name. Unknown fields are ignored (no sort). */
  sortable?: readonly string[];
  /** Field compared against `?from=` / `?to=` (inclusive, ISO prefix match). */
  dateField?: string;
  /** Fields `?search=` matches case-insensitively (substring). */
  searchFields?: readonly string[];
}

function toInt(value: unknown, fallback: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Apply the §33 standard params to a filtered list. See contract above —
 * returns `T[]` when pagination was not requested, `PageEnvelope<T>` when it
 * was. `res.json(...)` accepts both, so call sites stay one-liners.
 */
export function paginate<T>(
  rows: readonly T[],
  query: unknown,
  options: PaginateOptions = {},
): T[] | PageEnvelope<T> {
  const q = ((query ?? {}) ?? {}) as Record<string, unknown>;
  // Opt-out: no page params → plain array, exactly as before.
  if (q["page"] === undefined && q["pageSize"] === undefined) return [...rows];

  let list = [...rows];

  // ?search= — case-insensitive substring across the whitelisted fields.
  const search = String(q["search"] ?? "").trim().toLowerCase();
  if (search && options.searchFields?.length) {
    list = list.filter((row) =>
      options.searchFields!.some((field) =>
        String((row as Record<string, unknown>)[field] ?? "").toLowerCase().includes(search),
      ),
    );
  }

  // ?from= / ?to= — inclusive. Values are compared as strings, so a
  // full ISO timestamp `2026-06-30T12:00:00Z` still falls inside `to=2026-06-30`
  // (prefix compare) and rows without the date field are kept.
  const from = String(q["from"] ?? "").trim();
  const to = String(q["to"] ?? "").trim();
  if ((from || to) && options.dateField) {
    const field = options.dateField;
    list = list.filter((row) => {
      const value = String((row as Record<string, unknown>)[field] ?? "");
      if (!value) return true;
      if (from && value.slice(0, from.length) < from) return false;
      if (to && value.slice(0, to.length) > to) return false;
      return true;
    });
  }

  // ?sortBy= / ?sortOrder= — whitelist enforced; numbers compare numerically,
  // everything else as locale strings. Default order (desc via sortOrder when
  // sortBy given, but if sortOrder omitted → desc, matching newest-first lists).
  const sortBy = String(q["sortBy"] ?? "").trim();
  if (sortBy && options.sortable?.includes(sortBy)) {
    const dir = String(q["sortOrder"] ?? "").toLowerCase() === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortBy];
      const bv = (b as Record<string, unknown>)[sortBy];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }

  const page = Math.max(1, toInt(q["page"], 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, toInt(q["pageSize"], DEFAULT_PAGE_SIZE)));
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;

  return {
    items: list.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}