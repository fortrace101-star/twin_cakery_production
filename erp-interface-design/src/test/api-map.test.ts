import { describe, expect, it } from "vitest";
import { toUiOrder, orderStatusEnum, orderStatusLabel, paymentStatusEnum, paymentStatusLabel } from "@/lib/api";
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

  it("reads a completed order as delivered even when the delivery row lags", () => {
    const completed = { ...order, status: "COMPLETED_DELIVERED", deliveryStatus: "PENDING" } as unknown as ServerOrder;
    const ui = toUiOrder(completed, { "cust-sarah": customer }, { "prod-choc": product });
    expect(ui.status).toBe("Completed / Delivered");
    expect(ui.delivery).toBe("Completed / Delivered");
  });

  it("maps the COMPLETED_DELIVERED delivery enum to the delivered label", () => {
    const delivered = { ...order, deliveryStatus: "COMPLETED_DELIVERED" } as unknown as ServerOrder;
    const ui = toUiOrder(delivered, { "cust-sarah": customer }, { "prod-choc": product });
    expect(ui.delivery).toBe("Completed / Delivered");
  });

  it("surfaces the payment-ledger sum as paidAmount, capped at the order total", () => {
    const ui = toUiOrder(order, { "cust-sarah": customer }, { "prod-choc": product }, 1500);
    expect(ui.paidAmount).toBe(1500);
    const overpaid = toUiOrder(order, { "cust-sarah": customer }, { "prod-choc": product }, 99999);
    expect(overpaid.paidAmount).toBe(4500);
  });

  it("omits paidAmount when the ledger has nothing recorded", () => {
    const ui = toUiOrder(order, { "cust-sarah": customer }, { "prod-choc": product });
    expect(ui.paidAmount).toBeUndefined();
  });
});

describe("orderStatusEnum", () => {
  it("maps UI labels back to server enums", () => {
    expect(orderStatusEnum("Confirmed")).toBe("CONFIRMED");
    expect(orderStatusEnum("In production")).toBe("READY_FOR_PRODUCTION");
    expect(orderStatusEnum("Ready")).toBe("READY_FOR_DELIVERY");
    expect(orderStatusEnum("Awaiting Collection")).toBe("AWAITING_COLLECTION");
    expect(orderStatusEnum("In Transit")).toBe("IN_TRANSIT");
    expect(orderStatusEnum("Completed / Delivered")).toBe("COMPLETED_DELIVERED");
    expect(orderStatusEnum("Cancelled")).toBe("CANCELLED");
    expect(orderStatusEnum("Nonsense")).toBe("AWAITING_CONFIRMATION");
  });

  it("round-trips labels", () => {
    expect(orderStatusLabel(orderStatusEnum("In production"))).toBe("Ready for production");
  });
});

describe("paymentStatusEnum", () => {
  it("maps the modal's payment labels to server enums (incl. Processing)", () => {
    expect(paymentStatusEnum("Unpaid")).toBe("UNPAID");
    expect(paymentStatusEnum("Partially paid")).toBe("PARTIALLY_PAID");
    expect(paymentStatusEnum("Partial")).toBe("PARTIALLY_PAID");
    expect(paymentStatusEnum("Processing")).toBe("PROCESSING");
    expect(paymentStatusEnum("Paid")).toBe("PAID");
    expect(paymentStatusEnum("Nonsense")).toBe("UNPAID");
  });

  it("renders the Processing enum back as its UI label", () => {
    expect(paymentStatusLabel("PROCESSING")).toBe("Processing");
  });
});
