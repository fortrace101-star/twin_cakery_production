import { describe, expect, it } from "vitest";
import { isActiveOrder, TERMINAL_ORDER_STATUSES, initialOrders, type Order } from "@/components/erp/data";

describe("isActiveOrder", () => {
  it("treats Completed and Cancelled as terminal (not active)", () => {
    expect(TERMINAL_ORDER_STATUSES).toContain("Completed");
    expect(TERMINAL_ORDER_STATUSES).toContain("Cancelled");
    expect(isActiveOrder({ status: "Completed" })).toBe(false);
    expect(isActiveOrder({ status: "Cancelled" })).toBe(false);
  });

  it("treats every non-terminal status as active", () => {
    for (const status of ["Pending confirmation", "Confirmed", "In production", "Ready", "Awaiting dispatch"]) {
      expect(isActiveOrder({ status })).toBe(true);
    }
  });
});

describe("active-order list (history retained, not active)", () => {
  // Mirrors the workspace `filtered` computation for the default "All statuses" view.
  const activeByDefault = (orders: Order[]) => orders.filter((o) => isActiveOrder(o));

  it("drops completed orders from the active list but keeps them in the source", () => {
    const completed = initialOrders.filter((o) => o.status === "Completed");
    expect(completed.length).toBeGreaterThan(0); // TC-1043 is Completed in the sample data

    const active = activeByDefault(initialOrders);
    // Completed order(s) are gone from the active list...
    expect(active.some((o) => o.status === "Completed")).toBe(false);
    // ...but still present in the full set for history/analytics.
    expect(initialOrders.some((o) => o.status === "Completed")).toBe(true);
  });

  it("keeps an explicit Completed filter able to surface the historical order", () => {
    const statusFilter = "Completed";
    const explicit = initialOrders.filter((o) => o.status === statusFilter);
    expect(explicit.length).toBeGreaterThan(0);
  });
});
