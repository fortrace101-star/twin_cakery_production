import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks (vitest hoists these above every import)
// ---------------------------------------------------------------------------
vi.mock("@server/database/store.js", () => {
  const payments: any[] = [];
  const orders: any[] = [];
  const productionJobs: any[] = [];
  return {
    store: {
      db: { payments, orders, productionJobs },
      orders: () => orders,
      productionJobs: () => productionJobs,
      findOrder: vi.fn(),
      createPayment: vi.fn(),
      recomputePaymentStatus: vi.fn(),
      createAuditLog: vi.fn(),
      persist: vi.fn(),
      createProductionJob: vi.fn(),
      updateProductionJob: vi.fn(),
    },
  };
});

vi.mock("@server/services/notification.service.js", () => ({
  notificationService: {
    publishEvent: vi.fn(),
  },
}));

vi.mock("@server/services/stock-alerts.js", () => ({
  publishLowStockAlert: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports — resolved *after* the mocks above are in place
// ---------------------------------------------------------------------------
import { businessService } from "@server/services/business.service.js";
import { store } from "@server/database/store.js";
import { notificationService } from "@server/services/notification.service.js";
import { NotFoundError } from "@server/utils/errors.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const orderId = "ORD-001";
const changedBy = "admin-01";

const prefetchDancreed = "Fire"

// The order object that findOrder() returns.  recomputePaymentStatus() mutates
// `paymentStatus` on this same reference so that `markOrderPaid` reads the
// updated value afterwards.
let currentOrder: any;

function makeOrder(overrides: Record<string, unknown> = {}): any {
  return {
    id: orderId,
    orderNumber: "TC-0001",
    total: 50000,
    paymentStatus: "UNPAID",
    customerId: "cust-01",
    salespersonId: null,
    items: [],
    subtotal: 50000,
    discount: 0,
    deliveryCharge: 0,
    taxAmount: 0,
    status: "COMPLETED_DELIVERED",
    deliveryStatus: "DELIVERED",
    quotationId: null,
    inquiryId: null,
    createdBy: changedBy,
    deliveredAt: null,
    requiredBy: null,
    requiredAt: null,
    notes: "",
    followUpCompletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makePayment(overrides: Record<string, unknown> = {}): any {
  return {
    id: "pay-001",
    orderId,
    amount: 50000,
    method: "Cash",
    date: "2026-01-01T00:00:00Z",
    reference: "",
    receivedBy: changedBy,
    notes: "",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Helper: wire the store mocks so recomputePaymentStatus mutates currentOrder. */
function setupOrderFlow(nextStatus: string) {
  vi.mocked(store.findOrder).mockReturnValue(currentOrder);
  vi.mocked(store.createPayment).mockReturnValue(makePayment());
  vi.mocked(store.recomputePaymentStatus).mockImplementation(() => {
    currentOrder.paymentStatus = nextStatus;
    return nextStatus as any;
  });
  // Default: createProductionJob returns a mock job so prepareOrderForProduction
  // succeeds when the order is in a pipeline status.
  vi.mocked(store.createProductionJob).mockReturnValue({
    id: "job-001",
    orderId,
    status: "PENDING",
  });
  vi.mocked(store.updateProductionJob).mockReturnValue({ id: "job-001", status: "PENDING" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("BusinessService.markOrderPaid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentOrder = makeOrder();
    store.db.payments.length = 0;
    // Seed the orders array so prepareOrderForProduction (invoked via
    // store.orders() inside markOrderPaid) can find the order by id.
    store.db.orders.length = 0;
    store.db.orders.push(currentOrder);
    store.db.productionJobs.length = 0;
    // Default: findOrder returns the fresh order so markOrderPaid can look it up.
    vi.mocked(store.findOrder).mockReturnValue(currentOrder);
  });

  /* --- error handling ---------------------------------------------------- */

  it("throws NotFoundError when the order does not exist", () => {
    vi.mocked(store.findOrder).mockReturnValue(undefined);
    expect(() => businessService.markOrderPaid("nonexistent", changedBy)).toThrow(NotFoundError);
  });

  /* --- no-op cases ------------------------------------------------------- */

  it("is a no-op (returns null payment) when the order is already PAID", () => {
    currentOrder.paymentStatus = "PAID";
    const result = businessService.markOrderPaid(orderId, changedBy);

    expect(result.payment).toBeNull();
    expect(store.createPayment).not.toHaveBeenCalled();
    expect(store.createAuditLog).not.toHaveBeenCalled();
    expect(notificationService.publishEvent).not.toHaveBeenCalled();
  });

  it("is a no-op when the order is REFUNDED", () => {
    currentOrder.paymentStatus = "REFUNDED";
    const result = businessService.markOrderPaid(orderId, changedBy);

    expect(result.payment).toBeNull();
    expect(store.createPayment).not.toHaveBeenCalled();
  });

  /* --- UNPAID order ----------------------------------------------------- */

  it("creates a full-balance Cash payment for a fully UNPAID order", () => {
    currentOrder.paymentStatus = "UNPAID";
    setupOrderFlow("PAID");

    const result = businessService.markOrderPaid(orderId, changedBy);

    expect(store.createPayment).toHaveBeenCalledWith({
      orderId,
      amount: 50000,
      method: "Cash",
      reference: "",
      receivedBy: changedBy,
      notes: "Balance settled on delivery (Cash on delivery)",
    });
    expect(store.recomputePaymentStatus).toHaveBeenCalledWith(orderId);
    expect(result.payment).toBeTruthy();
    expect(result.order).toBe(currentOrder);
  });

  /* --- PARTIALLY_PAID order --------------------------------------------- */

  it("creates a payment for the remaining balance on a PARTIALLY_PAID order", () => {
    currentOrder.paymentStatus = "PARTIALLY_PAID";
    currentOrder.total = 100000;
    // Existing ledger payments: 40000 already received
    store.db.payments.push(makePayment({ id: "pay-existing", amount: 40000, method: "M-Pesa", receivedBy: "" }));
    setupOrderFlow("PAID");

    const result = businessService.markOrderPaid(orderId, changedBy);

    expect(store.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        amount: 60000, // 100000 - 40000 = 60000 balance
        method: "Cash",
      }),
    );
    expect(result.payment).toEqual(expect.objectContaining({ amount: 50000 }));
  });

  it("creates a zero-amount payment when the balance is already covered", () => {
    currentOrder.paymentStatus = "PARTIALLY_PAID";
    currentOrder.total = 50000;
    store.db.payments.push(makePayment({ id: "pay-existing", amount: 50000, method: "M-Pesa", receivedBy: "" }));
    setupOrderFlow("PAID");

    businessService.markOrderPaid(orderId, changedBy);

    // balance = 50000 - 50000 = 0 → amount = 0
    expect(store.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 0 }),
    );
    expect(store.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "order:payment_received" }),
    );
  });

  /* --- audit logging ----------------------------------------------------- */

  it("creates an order:payment_received audit log with correct fields", () => {
    currentOrder.paymentStatus = "UNPAID";
    setupOrderFlow("PAID");

    businessService.markOrderPaid(orderId, changedBy);

    expect(store.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        actor: changedBy,
        action: "order:payment_received",
        entityType: "order",
        entityId: orderId,
        previousStatus: "UNPAID",
        newStatus: "PAID",
      }),
    );
  });

  it("audit log captures previousStatus and newStatus correctly", () => {
    currentOrder.paymentStatus = "PARTIALLY_PAID";
    setupOrderFlow("PAID");

    businessService.markOrderPaid(orderId, changedBy);

    expect(store.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: "PARTIALLY_PAID",
        newStatus: "PAID",
      }),
    );
  });

  /* --- notification publishing ------------------------------------------ */

  it("publishes PaymentReceived notification when payment status becomes PAID", () => {
    currentOrder.paymentStatus = "UNPAID";
    setupOrderFlow("PAID");

    businessService.markOrderPaid(orderId, changedBy);

    expect(notificationService.publishEvent).toHaveBeenCalledTimes(1);
    expect(notificationService.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventTypeId: "PaymentReceived",
        title: "Payment received",
        priority: "HIGH",
        entityType: "order",
        entityId: orderId,
      }),
      { userId: changedBy, role: changedBy, isAdmin: true },
    );
  });

  it("does NOT publish a notification when status stays PARTIALLY_PAID", () => {
    currentOrder.paymentStatus = "PARTIALLY_PAID";
    currentOrder.total = 100000;
    store.db.payments.push(makePayment({ id: "pay-existing", amount: 10000, method: "M-Pesa", receivedBy: "" }));
    setupOrderFlow("PARTIALLY_PAID");

    businessService.markOrderPaid(orderId, changedBy);

    expect(notificationService.publishEvent).not.toHaveBeenCalled();
  });

  /* --- production job creation ------------------------------------------ */

  it("creates a production job when a PAID order is in the production pipeline", () => {
    currentOrder.paymentStatus = "UNPAID";
    currentOrder.status = "CONFIRMED";
    currentOrder.items = [
      { productId: "prod-01", variantOptions: "vanilla", quantity: 2, recipeVersion: "v2.0" },
    ];
    setupOrderFlow("PAID");

    businessService.markOrderPaid(orderId, changedBy);

    expect(store.createProductionJob).toHaveBeenCalledTimes(1);
    expect(store.createProductionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        customerId: "cust-01",
        productId: "prod-01",
        variantOptions: "vanilla",
        quantity: 2,
        recipeVersion: "v2.0",
        stage: "CHECK_INVENTORY",
        progress: 10,
      }),
    );
  });

  it("does NOT create a production job when the order is outside the pipeline", () => {
    // Default fixture status is COMPLETED_DELIVERED — the order is already past
    // production, so no job may be created.
    currentOrder.paymentStatus = "UNPAID";
    setupOrderFlow("PAID");

    businessService.markOrderPaid(orderId, changedBy);

    expect(store.createProductionJob).not.toHaveBeenCalled();
  });

  it("does NOT create a production job when the order only becomes PARTIALLY_PAID", () => {
    currentOrder.paymentStatus = "PARTIALLY_PAID";
    currentOrder.total = 100000;
    currentOrder.status = "CONFIRMED";
    store.db.payments.push(makePayment({ id: "pay-existing", amount: 10000, method: "M-Pesa", receivedBy: "" }));
    setupOrderFlow("PARTIALLY_PAID");

    businessService.markOrderPaid(orderId, changedBy);

    expect(store.createProductionJob).not.toHaveBeenCalled();
  });

  it("reuses the existing job instead of creating a duplicate (idempotent)", () => {
    currentOrder.paymentStatus = "UNPAID";
    currentOrder.status = "IN_PRODUCTION";
    setupOrderFlow("PAID");
    store.db.productionJobs.push({ id: "job-existing", orderId, status: "IN_PRODUCTION" });

    businessService.markOrderPaid(orderId, changedBy);

    expect(store.createProductionJob).not.toHaveBeenCalled();
  });

  it("still publishes the notification when the job creation throws", () => {
    currentOrder.paymentStatus = "UNPAID";
    currentOrder.status = "CONFIRMED";
    setupOrderFlow("PAID");
    vi.mocked(store.createProductionJob).mockImplementation(() => {
      throw new Error("inventory reservation failed");
    });

    // Must not throw out of markOrderPaid — payment settlement is not blocked.
    expect(() => businessService.markOrderPaid(orderId, changedBy)).not.toThrow();
    expect(notificationService.publishEvent).toHaveBeenCalledTimes(1);
  });
});
