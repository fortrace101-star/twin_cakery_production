import { describe, expect, it } from "vitest";
import { isActiveOrder, modules, TERMINAL_ORDER_STATUSES, initialOrders, type Order } from "@/components/erp/data";

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

describe("Order history tab (sales > Order history)", () => {
  // Mirrors the workspace `historyFiltered` computation for the history tab with
  // search empty and the status filter at its "All statuses" default.
  const historyView = (orders: Order[]) => orders.filter((o) => !isActiveOrder(o));

  it("shows every terminal order and no active ones", () => {
    const history = historyView(initialOrders);
    expect(history.length).toBeGreaterThan(0);
    expect(history.some((o) => o.status === "Completed")).toBe(true); // TC-1043
    expect(history.every((o) => !isActiveOrder(o))).toBe(true);
    expect(history.some((o) => isActiveOrder(o))).toBe(false);
  });

  it("partitions the source: active + history = every order (nothing is deleted)", () => {
    const active = initialOrders.filter((o) => isActiveOrder(o));
    const history = historyView(initialOrders);
    expect(active.length + history.length).toBe(initialOrders.length);
  });

  it("offers every terminal status as a history filter option", () => {
    // Mirrors the workspace history-tab status select options.
    const historyOptions = ["All statuses", "Completed", "Cancelled"];
    for (const status of TERMINAL_ORDER_STATUSES) expect(historyOptions).toContain(status);
  });

  it("exposes the Order history tab on the Sales module, after the working list", () => {
    const sales = modules.find((m) => m.id === "sales");
    expect(sales?.tabs).toContain("Order history");
    expect(sales?.tabs[0]).toBe("Orders"); // the active working list stays the default landing tab
  });

  it("mirrors the same history tab under Analytics (both modules share the view)", () => {
    const analytics = modules.find((m) => m.id === "analytics");
    expect(analytics?.tabs).toContain("Order history");
    expect(analytics?.tabs[0]).toBe("Overview"); // Analytics keeps its own default landing tab
  });
});
