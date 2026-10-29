import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProductionView } from "@/components/erp/production-view";
import type { ServerOrder } from "@/lib/api";
import {
  listOrders,
  listProductionJobs,
  listInventoryItems,
  recordJobMaterials,
  listCustomers,
  listCatalogueProducts,
  updateOrderStation,
  createProductionJobForOrder,
  propagateBakingStatus,
  listPayments,
  recordPayment,
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listOrders: vi.fn(),
  listProductionJobs: vi.fn(),
  listInventoryItems: vi.fn(),
  recordJobMaterials: vi.fn(),
  listCustomers: vi.fn(),
  listCatalogueProducts: vi.fn(),
  updateOrderStation: vi.fn(),
  createProductionJobForOrder: vi.fn(),
  propagateBakingStatus: vi.fn(),
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
    status: "Confirmed",
    paymentStatus: "UNPAID",
    deliveryStatus: "PENDING",
    createdBy: "",
    deliveredAt: null,
    station: "pendingConfirm",
    ...overrides,
  };
}

function stubApi(orders: ServerOrder[]) {
  (listOrders as ReturnType<typeof vi.fn>).mockResolvedValue(orders);
  (listProductionJobs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (listInventoryItems as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (listCustomers as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (listCatalogueProducts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (recordJobMaterials as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (listPayments as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (recordPayment as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "pay-1", orderId: "ord-1" });
}

describe("ProductionView station board", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the active station board with the sample order", async () => {
    stubApi([makeOrder()]);

    render(<ProductionView />);

    expect(await screen.findByText("TC-1048")).toBeInTheDocument();
    expect(screen.getByText("Chocolate cake for Naomy")).toBeInTheDocument();
    expect(screen.getByText("cust-1")).toBeInTheDocument();
    expect(screen.getByText("1 order")).toBeInTheDocument();
  });

  it("moves an order to confirmed and creates a production job", async () => {
    stubApi([makeOrder({ station: "pendingConfirm" })]);

    render(<ProductionView />);

    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(createProductionJobForOrder).toHaveBeenCalledWith("ord-1");
      expect(updateOrderStation).toHaveBeenCalledWith("ord-1", "confirmed");
    });
    expect(updateOrderStation).toHaveBeenCalledTimes(1);
    expect(createProductionJobForOrder).toHaveBeenCalledTimes(1);
    expect(propagateBakingStatus).not.toHaveBeenCalled();
  });

  it("allows a confirmed order to move into baking", async () => {
    stubApi([makeOrder({ station: "confirmed" })]);

    render(<ProductionView />);

    fireEvent.click(await screen.findByRole("button", { name: "Start baking" }));

    await waitFor(() => {
      expect(updateOrderStation).toHaveBeenCalledWith("ord-1", "baking");
      expect(propagateBakingStatus).toHaveBeenCalledWith("ord-1");
    });
    expect(updateOrderStation).toHaveBeenCalledTimes(1);
    expect(propagateBakingStatus).toHaveBeenCalledTimes(1);
  });

  it("completes a baking order", async () => {
    stubApi([makeOrder({ station: "baking" })]);

    render(<ProductionView />);

    fireEvent.click(await screen.findByRole("button", { name: "Complete" }));

    await waitFor(() => {
      expect(updateOrderStation).toHaveBeenCalledWith("ord-1", "done");
    });
    expect(updateOrderStation).toHaveBeenCalledTimes(1);
  });

  it("sends a confirmed order back to pendingConfirm (Undo confirm)", async () => {
    stubApi([makeOrder({ station: "confirmed" })]);

    render(<ProductionView />);

    fireEvent.click(await screen.findByRole("button", { name: "Undo confirm" }));

    await waitFor(() => {
      expect(updateOrderStation).toHaveBeenCalledWith("ord-1", "pendingConfirm");
    });
    expect(createProductionJobForOrder).not.toHaveBeenCalled();
    expect(propagateBakingStatus).not.toHaveBeenCalled();
  });

  it("opens the revenue dialog on a done order and records the outstanding balance", async () => {
    stubApi([makeOrder({ station: "done", paymentStatus: "UNPAID" })]);

    render(<ProductionView />);
    // Done orders live on the History tab — switch there before the CTA.
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    fireEvent.click(await screen.findByRole("button", { name: "Record revenue & mark paid" }));

    // Pre-filled with the outstanding balance (total minus existing payments)
    const amount = await screen.findByLabelText("Revenue amount");
    expect((amount as HTMLInputElement).value).toBe("50000");

    fireEvent.click(screen.getByRole("button", { name: "Mark fully paid" }));

    await waitFor(() => {
      expect(recordPayment).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: "ord-1", amount: 50000 }),
      );
    });
  });

  it("reloads the board after a station transition", async () => {
    stubApi([makeOrder()]);

    render(<ProductionView />);

    expect(await screen.findByText("TC-1048")).toBeInTheDocument();
    expect(listOrders).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(listOrders).toHaveBeenCalledTimes(2);
    });
  });
});
