import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginate,
  type PageEnvelope,
} from "../../../server/utils/paginate";

// ---------------------------------------------------------------------------
// §33 — shared paginate() helper. The contract: NO page/pageSize params means
// a plain array (backward compatible); opt-in params return a PageEnvelope.
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  name: string;
  createdAt: string;
  total: number;
}

const rows: Row[] = [
  { id: "r3", name: "Beta Two", createdAt: "2026-03-01T10:00:00Z", total: 300 },
  { id: "r1", name: "alpha one", createdAt: "2026-01-15T10:00:00Z", total: 100 },
  { id: "r2", name: "Gamma", createdAt: "2026-02-20T10:00:00Z", total: 200 },
  { id: "r0", name: "No Date", createdAt: "", total: 50 },
];

const sortable = ["name", "total", "createdAt"] as const;
const searchFields = ["name", "id"] as const;
const dateField = "createdAt";

function envelope<T>(result: T[] | PageEnvelope<T>): PageEnvelope<T> {
  if (Array.isArray(result)) throw new Error("expected a PageEnvelope, got a plain array");
  return result;
}

describe("paginate (§33)", () => {
  it("returns a plain array when no page params are present (backward compatible)", () => {
    const result = paginate(rows, {}, { sortable, searchFields, dateField });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(rows.length);
    // original order preserved — no implicit sorting
    expect((result as Row[]).map((r) => r.id)).toEqual(["r3", "r1", "r2", "r0"]);
  });

  it("returns an envelope for the first page", () => {
    const env = envelope(paginate(rows, { page: "1", pageSize: "2" }, { sortable, searchFields, dateField }));
    expect(env.page).toBe(1);
    expect(env.pageSize).toBe(2);
    expect(env.items).toHaveLength(2);
    expect(env.total).toBe(4);
    expect(env.totalPages).toBe(2);
    expect(env.hasPrev).toBe(false);
    expect(env.hasNext).toBe(true);
  });

  it("slices the second page and flips hasPrev/hasNext", () => {
    const env = envelope(paginate(rows, { page: "2", pageSize: "3" }, { sortable, searchFields, dateField }));
    expect(env.items).toHaveLength(1);
    expect(env.hasPrev).toBe(true);
    expect(env.hasNext).toBe(false);
  });

  it("returns empty items past the end without crashing", () => {
    const env = envelope(paginate(rows, { page: "9", pageSize: "2" }, { sortable, searchFields, dateField }));
    expect(env.items).toHaveLength(0);
    expect(env.total).toBe(4);
    expect(env.hasNext).toBe(false);
    expect(env.hasPrev).toBe(true);
  });

  it("clamps pageSize to MAX_PAGE_SIZE and defaults to DEFAULT_PAGE_SIZE", () => {
    const clamped = envelope(paginate(rows, { page: "1", pageSize: "5000" }, { sortable }));
    expect(clamped.pageSize).toBe(MAX_PAGE_SIZE);
    const defaults = envelope(paginate(rows, { page: "1" }, { sortable }));
    expect(defaults.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("filters case-insensitively via ?search= across whitelisted fields", () => {
    const env = envelope(paginate(rows, { page: "1", search: "BETA" }, { sortable, searchFields, dateField }));
    expect(env.items).toHaveLength(1);
    expect(env.items[0]?.id).toBe("r3");
    const byId = envelope(paginate(rows, { page: "1", search: "r2" }, { sortable, searchFields, dateField }));
    expect(byId.items).toHaveLength(1);
    expect(byId.items[0]?.id).toBe("r2");
  });

  it("filters by ?from=/?to= on the date field, keeping rows without the field", () => {
    const from = envelope(paginate(rows, { page: "1", from: "2026-02-01" }, { sortable, searchFields, dateField }));
    expect(from.items.map((r) => r.id).sort()).toEqual(["r0", "r2", "r3"]);
    // full ISO timestamps still fall inside an inclusive day boundary
    const to = envelope(paginate(rows, { page: "1", to: "2026-01-31" }, { sortable, searchFields, dateField }));
    expect(to.items.map((r) => r.id).sort()).toEqual(["r0", "r1"]);
  });

  it("sorts ascending/descending on whitelisted fields (strings and numbers)", () => {
    const asc = envelope(paginate(rows, { page: "1", sortBy: "name", sortOrder: "asc" }, { sortable, searchFields }));
    expect(asc.items.map((r) => r.name)).toEqual(["alpha one", "Beta Two", "Gamma", "No Date"]);
    const desc = envelope(paginate(rows, { page: "1", sortBy: "total", sortOrder: "desc" }, { sortable, searchFields }));
    expect(desc.items.map((r) => r.total)).toEqual([300, 200, 100, 50]);
  });

  it("ignores unknown sortBy fields instead of crashing", () => {
    const env = envelope(paginate(rows, { page: "1", sortBy: "__bogus__", sortOrder: "asc" }, { sortable, searchFields }));
    expect(env.items.map((r) => r.id)).toEqual(["r3", "r1", "r2", "r0"]);
  });

  it("pageSize alone opts into the envelope", () => {
    const env = envelope(paginate(rows, { pageSize: "1" }, { sortable, searchFields }));
    expect(env.page).toBe(1);
    expect(env.items).toHaveLength(1);
    expect(env.total).toBe(4);
  });
});
