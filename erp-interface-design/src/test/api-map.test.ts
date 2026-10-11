import { describe, expect, it } from "vitest";
import { toUiOrder, orderStatusEnum, orderStatusLabel } from "@/lib/api";
import type { ServerCustomer, ServerOrder, ServerProduct } from "@/lib/api";

const customer = { id: "cust-sarah", name: "Sarah Mwangi" } as unknown as ServerCustomer;
const product = { id: "prod-choc", name: "Chocolate celebration cake", basePrice: 4500 } as unknown as ServerProduct;
const order = {
  id: "ord-1048",
  orderNumber: "TC-1048",
  customerId: "cust-sarah",
  items: [{ productId: "prod-choc", variantOptions: "2 kg · Chocolate · Birthday", quantity: 1, unitPrice: 4500 }],
  total: 4500,
  requiredAt: "2026-10-07T10:00:00.000Z",
  notes: "2 kg · Chocolate · Birthday · WhatsApp",
  status: "IN_PRODUCTION",
  paymentStatus: "PARTIALLY_PAID",
  deliveryStatus: "PENDING",
} as unknown as ServerOrder;

describe("toUiOrder", () => {
  it("maps a server order to the UI shape", () => {
    const ui = toUiOrder(order, { "cust-sarah": customer }, { "prod-choc": product });
    expect(ui.id).toBe("TC-1048");
    expect(ui.customer).toBe("Sarah Mwangi");
    expect(ui.initials).toBe("SM");
    expect(ui.product).toBe("Chocolate celebration cake");
    expect(ui.amount).toBe(4500);
    expect(ui.status).toBe("In production");
    expect(ui.payment).toBe("Partial");
    expect(ui.delivery).toBe("Pending");
    expect(ui.channel).toBe("WhatsApp");
    expect(ui.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("falls back to ids/placeholders when lookups miss", () => {
    const ui = toUiOrder(order, {}, {});
    expect(ui.customer).toBe("cust-sarah");
    expect(ui.product).toBe("Custom order");
  });
});

describe("orderStatusEnum", () => {
  it("maps UI labels back to server enums", () => {
    expect(orderStatusEnum("Confirmed")).toBe("CONFIRMED");
    expect(orderStatusEnum("In production")).toBe("IN_PRODUCTION");
    expect(orderStatusEnum("Ready")).toBe("READY_FOR_DELIVERY");
    expect(orderStatusEnum("Completed")).toBe("DELIVERED");
    expect(orderStatusEnum("Cancelled")).toBe("CANCELLED");
    expect(orderStatusEnum("Nonsense")).toBe("AWAITING_CONFIRMATION");
  });

  it("round-trips labels", () => {
    expect(orderStatusLabel(orderStatusEnum("In production"))).toBe("In production");
  });
});
