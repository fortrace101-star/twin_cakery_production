import { describe, expect, it } from "vitest";
import { formatOccasionDate, groupOccasions, initialOccasions, type Occasion } from "@/components/erp/data";

const sample: Occasion[] = [
  { id: "OCC-001", customer: "Sarah Mwangi", type: "Birthday", date: "2026-10-18", recurrence: "ANNUAL" },
  { id: "OCC-002", customer: "David Ochieng", type: "Wedding anniversary", date: "2026-10-24", recurrence: "ANNUAL" },
  { id: "OCC-003", customer: "Faith Akinyi", type: "Birthday", date: "2026-10-31", recurrence: "MONTHLY" },
  { id: "OCC-004", customer: "Grace Wanjiku", type: "Birthday", date: "2026-11-02", recurrence: "ANNUAL" },
  { id: "OCC-005", customer: "James Kamau", type: "Graduation", date: "2026-11-06", recurrence: "NONE" },
];

describe("groupOccasions (Occasions tab)", () => {
  it("groups by month by default with en-GB labels and ascending order", () => {
    const groups = groupOccasions(sample);
    expect(groups.map((g) => g.label)).toEqual(["October 2026", "November 2026"]);
    expect(groups[0]?.items.map((o) => o.id)).toEqual(["OCC-001", "OCC-002", "OCC-003"]);
    expect(groups[1]?.items.map((o) => o.id)).toEqual(["OCC-004", "OCC-005"]);
  });

  it("groups by Monday-start week (Sun 18 Oct → week of Mon 12 Oct)", () => {
    const groups = groupOccasions(sample, "Week");
    expect(groups.map((g) => g.label)).toEqual([
      "Week of 12 Oct 2026",
      "Week of 19 Oct 2026",
      "Week of 26 Oct 2026",
      "Week of 2 Nov 2026",
    ]);
    expect(groups[0]?.items).toHaveLength(1); // 18 Oct (Sun) and 24 Oct (Sat) sit in different weeks
  });

  it("keeps only the items inside a custom date range, bucketed per day", () => {
    const groups = groupOccasions(sample, "Custom", { from: "2026-10-20", to: "2026-11-02" });
    expect(groups.map((g) => g.items[0]?.id)).toEqual(["OCC-002", "OCC-003", "OCC-004"]);
    expect(groups[2]?.label).toBe("Mon, 2 Nov 2026");
  });

  it("drops entries with an invalid date and does not mutate the input", () => {
    const input: Occasion[] = [
      { id: "BROKEN", customer: "X", type: "Birthday", date: "not-a-date", recurrence: "NONE" },
      ...sample,
    ];
    const before = input.map((o) => o.id);
    const groups = groupOccasions(input);
    expect(groups.flatMap((g) => g.items.map((o) => o.id))).not.toContain("BROKEN");
    expect(input.map((o) => o.id)).toEqual(before);
  });

  it("renders a stable date format from the sample seed data", () => {
    expect(formatOccasionDate("2026-10-18")).toBe("18 Oct 2026");
    const groups = groupOccasions(initialOccasions);
    expect(groups[0]?.label).toBe("October 2026");
    expect(groups[0]?.items).toHaveLength(3);
  });
});
