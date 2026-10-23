import { describe, expect, it } from "vitest";
import { modules, MODULE_PERMISSIONS, visibleModules } from "@/components/erp/data";

/**
 * E5 — "Navigation must be permission-aware" (Updated architecture doc §4):
 * every module maps to a permission and the nav filter hides the modules the
 * signed-in permission set lacks. Preview mode (null) keeps everything.
 */
describe("permission-aware navigation (E5)", () => {
  it("maps every module to a permission", () => {
    for (const m of modules) {
      expect(MODULE_PERMISSIONS[m.id], `module ${m.id}`).toBeTruthy();
    }
  });

  it("shows every module in preview mode (null permissions)", () => {
    expect(visibleModules(modules, null)).toHaveLength(modules.length);
  });

  it("shows every module to a full-permission (Admin) set", () => {
    expect(visibleModules(modules, Object.values(MODULE_PERMISSIONS))).toHaveLength(modules.length);
  });

  it("hides every gated module for a signed-in user with no grants", () => {
    expect(visibleModules(modules, [])).toHaveLength(0);
  });

  it("gives the Production Manager operations but not analytics/admin/finance", () => {
    const production = ["production.view", "inventory.view", "purchasing.view", "deliveries.view", "orders.view", "customers.view", "catalogue.view"];
    const ids = visibleModules(modules, production).map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["production", "inventory", "purchasing", "delivery", "sales", "crm", "catalogue"]));
    expect(ids).not.toContain("analytics");
    expect(ids).not.toContain("administration");
    expect(ids).not.toContain("finance");
    expect(ids).not.toContain("webapp");
  });

  it("gives Sales analytics + orders but not production/admin", () => {
    const sales = ["orders.view", "sales.analytics", "customers.view", "deliveries.view", "payments.view", "catalogue.view", "quotations.view", "inquiries.view", "feedback.view"];
    const ids = visibleModules(modules, sales).map((m) => m.id);
    expect(ids).toContain("analytics");
    expect(ids).toContain("sales");
    expect(ids).not.toContain("production");
    expect(ids).not.toContain("administration");
    expect(ids).not.toContain("finance");
  });

  it("gates Staff & Salary behind staff.view (E7)", () => {
    expect(MODULE_PERMISSIONS["staff"]).toBe("staff.view");
    const withStaff = visibleModules(modules, ["staff.view", "orders.view"]).map((m) => m.id);
    expect(withStaff).toContain("staff");
    const withoutStaff = visibleModules(modules, ["orders.view", "remuneration.view"]).map((m) => m.id);
    expect(withoutStaff).not.toContain("staff");
  });
});