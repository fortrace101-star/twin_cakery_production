import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProductionView } from "@/components/erp/production-view";
import type { ServerOrder } from "@/lib/api";
import {
  listOrders,
  listProductionJobs,
  createProductionJob,
  startProductionJob,
  listPayments,
  recordPayment,
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listOrders: vi.fn(),
  listProductionJobs: vi.fn(),
  createProductionJob: vi.fn(),
  startProductionJob: vi.fn(),
  listPayments: vi.fn(),
  recordPayment: vi.fn(),
}));

// The board reads its connection flag from the workspace store; the tests run
// against a signed-in workspace without mounting the whole WorkspaceProvider.
vi.mock("@/components/erp/store", () => ({
  useWorkspace: () => ({ connected: true }),
}));

function makeOrder(overrides: Partial<ServerOrder> = {}): ServerOrder {
  return {
    id: "ord-1",
    orderNumber: "TC-1048",
    customerId: "cust-1",
    items: [{ productId: "prod-choc", variantOptions: "", quantity: 1, unitPrice: 50000 }],
    subtotal: 50000,
    discount: 0,
    deliveryCharge: 0,
    taxAmount: 0,
    total: 50000,
    requiredBy: null,
    requiredAt: null,
    notes: "Chocolate cake for Naomy",
    status: "CONFIRMED",
    paymentStatus: "UNPAID",
    deliveryStatus: "PENDING",
    createdBy: "",
    deliveredAt: null,
    station: "confirmed",
    ...overrides,
  } as ServerOrder;
}

function stubApi(orders: ServerOrder[]) {
  (listOrders as ReturnType<typeof vi.fn>).mockResolvedValue(orders);
  (listProductionJobs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (listPayments as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (recordPayment as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "pay-1", orderId: "ord-1" });
  (createProductionJob as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "job-1", orderId: "ord-1" });
  (startProductionJob as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "job-1", orderId: "ord-1" });
}

describe("ProductionView station board", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the production stations with the sample order", async () => {
    stubApi([makeOrder()]);

    render(<ProductionView />);

    expect(await screen.findByText("TC-1048")).toBeInTheDocument();
    expect(screen.getByText("Chocolate cake for Naomy")).toBeInTheDocument();
    expect(screen.getByText("cust-1")).toBeInTheDocument();
  });

  it("moves a confirmed order to baking station", async () => {
    stubApi([makeOrder({ status: "CONFIRMED" })]);

    render(<ProductionView />);

    fireEvent.click(await screen.findByRole("button", { name: "Move to Baking Station" }));

    await waitFor(() => {
      expect(createProductionJob).toHaveBeenCalledWith("ord-1");
    });
  });

  it("shows orders in IN_PRODUCTION on baking station", async () => {
    stubApi([makeOrder({ status: "IN_PRODUCTION" })]);
    (listProductionJobs as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "job-1", orderId: "ord-1", status: "IN_PRODUCTION" }]);

    render(<ProductionView />);
    fireEvent.click(screen.getByRole("button", { name: "Baking Station" }));

    expect(await screen.findByText("TC-1048")).toBeInTheDocument();
  });

  it("shows orders in IN_PRODUCTION on decorating station when job is in quality check", async () => {
    stubApi([makeOrder({ status: "IN_PRODUCTION" })]);
    (listProductionJobs as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "job-1", orderId: "ord-1", status: "QUALITY_CHECK" }]);

    render(<ProductionView />);
    fireEvent.click(screen.getByRole("button", { name: "Decorating Station" }));

    expect(await screen.findByText("TC-1048")).toBeInTheDocument();
  });

  it("does not show READY_FOR_DELIVERY orders in production board", async () => {
    stubApi([makeOrder({ status: "READY_FOR_DELIVERY" })]);

    render(<ProductionView />);

    // Should not find the order in any station
    await waitFor(() => {
      expect(screen.queryByText("TC-1048")).not.toBeInTheDocument();
    });
  });
});
