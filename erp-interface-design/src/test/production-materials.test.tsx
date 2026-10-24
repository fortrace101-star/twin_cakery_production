import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within, act } from "@testing-library/react";
import { listProductionJobs, startProductionJob } from "@/lib/api";


import { Production } from "@/components/erp/production-view";

// The board reads live jobs + inventory from the API — mock both, plus the
// materials POST so the submit payload can be asserted without a server.
// Fixtures live inside vi.hoisted because vi.mock factories are hoisted above
// top-level consts (ReferenceError: Cannot access 'job' before initialization).
const { job, qcJob, flour, cream, order, order2, customer, product, startJob, recordJobMaterialsMock } = vi.hoisted(() => {
  const job = { id: "job-1", orderId: "ord-1", customerId: "cust-1", productId: "prod-choc", variantOptions: "", quantity: 1, recipeVersion: "v1.2", requiredBy: null, requiredAt: null, status: "IN_PRODUCTION", stage: "PRODUCE", progress: 40, notes: "", createdAt: "", updatedAt: "" };
  const qcJob = { ...job, id: "job-2", status: "READY_FOR_QUALITY" };
  const flour = { id: "inv-flour", sku: "ING-001", name: "Wheat flour", category: "Flour", unit: "kg", physicalStock: 10, reorderLevel: 4, supplierId: "", cost: 400, lastUpdated: "" };
  const cream = { id: "inv-cream", sku: "ING-006", name: "Whipping cream", category: "Dairy", unit: "L", physicalStock: 2, reorderLevel: 4, supplierId: "", cost: 650, lastUpdated: "" };
  // Order/customer/catalogue fixtures — the board shows the order a job represents.
  const order = { id: "ord-1", orderNumber: "TC-2001", customerId: "cust-1", items: [{ productId: "prod-choc", variantOptions: "", quantity: 2, unitPrice: 4500 }] };
  const customer = { id: "cust-1", name: "Ada Okafor" };
  const order2 = { id: "ord-2", orderNumber: "TC-2002", customerId: "cust-1", items: [{ productId: "prod-choc", variantOptions: "", quantity: 1, unitPrice: 4000 }] };
  const startJob = { id: "job-3", orderId: "ord-2", customerId: "cust-1", productId: "prod-choc", variantOptions: "", quantity: 1, recipeVersion: "v1.0", requiredBy: null, requiredAt: null, status: "SCHEDULED", stage: "CHECK_INVENTORY", progress: 10, notes: "", createdAt: "", updatedAt: "" };
  const product = { id: "prod-choc", name: "Chocolate celebration cake" };
  return { job, qcJob, flour, cream, order, order2, customer, product, startJob, recordJobMaterialsMock: vi.fn() };
});

vi.mock("@/lib/api", () => ({
  listProductionJobs: vi.fn().mockResolvedValue([job, qcJob]),
  listInventoryItems: vi.fn().mockResolvedValue([flour, cream]),
    listOrders: vi.fn().mockResolvedValue([order, { id: "ord-2", orderNumber: "TC-2002", customerId: "cust-1", items: [{ productId: "prod-choc", variantOptions: "", quantity: 1, unitPrice: 4000 }] }]),
  listProductionJobs: vi.fn().mockResolvedValue([job, qcJob, startJob]),
  listCustomers: vi.fn().mockResolvedValue([customer]),
  listCatalogueProducts: vi.fn().mockResolvedValue([product]),
  getProductionCosts: vi.fn().mockResolvedValue([]),
  getProductionConsumption: vi.fn().mockResolvedValue([]),
  recordJobMaterials: recordJobMaterialsMock,
  startProductionJob: vi.fn(),
  completeProductionJob: vi.fn(),
  recordQualityCheck: vi.fn(),
  recordProductionWastage: vi.fn(),
}));

vi.mock("@/components/erp/store", () => ({
  useWorkspace: () => ({ connected: true }),
}));

afterEach(cleanup);
beforeEach(() => {
  recordJobMaterialsMock.mockReset();
  recordJobMaterialsMock.mockResolvedValue([{ id: "pcon-1" }]);
});

async function openJob(id: string) {
  render(<Production tab="Jobs" search="" setSearch={() => {}} onNotice={() => {}} onSignIn={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: `Open ${id}` }));
  await screen.findByText("Materials used");
}

function selectItem(name: string) {
  fireEvent.change(screen.getByLabelText("Ingredient"), { target: { value: name } });
}

describe("Production job materials entry (used materials → inventory)", () => {
  it("offers the materials entry for an in-production job, with live stock in the options", async () => {
    await openJob("job-1");
    // The rows/dialog present the order the job represents: order no · item, customer · job id.
    // Both fixture jobs share order TC-2001, so the primary line appears on both rows.
    expect(screen.getAllByText("TC-2001 · 2× Chocolate celebration cake")).toHaveLength(2);
    expect(screen.getByText("Ada Okafor · job-1")).toBeInTheDocument();
    expect(screen.getByText("Order TC-2001 — Chocolate celebration cake")).toBeInTheDocument();
    expect(screen.getByLabelText("Ingredient")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity used")).toBeInTheDocument();
    expect(screen.getByText(/Wheat flour \(kg\) · 10 in stock/)).toBeInTheDocument();
    expect(screen.getByText(/Whipping cream \(L\) · 2 in stock/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add material" })).toBeDisabled();
  });

  it("adds materials to a pending list with costs, and removes them again", async () => {
    await openJob("job-1");
    selectItem("inv-flour");
    fireEvent.change(screen.getByLabelText("Quantity used"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Add material" }));
    expect(screen.getByText(/Pending materials \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Wheat flour · 3 kg/)).toBeInTheDocument();
    expect(screen.getByText("UGX 1,200")).toBeInTheDocument(); // 3 × 400
    // Quantity cleared for the next line; item stays selected for rapid entry.
    expect((screen.getByLabelText("Quantity used") as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Remove Wheat flour" }));
    expect(screen.queryByText(/Pending materials/)).not.toBeInTheDocument();
  });

  it("blocks quantities above available stock with an inline warning", async () => {
    await openJob("job-1");
    selectItem("inv-cream");
    fireEvent.change(screen.getByLabelText("Quantity used"), { target: { value: "5" } });
    expect(screen.getByText(/Only 2 L of Whipping cream in stock/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add material" })).toBeDisabled();
  });

  it("posts the pending list and clears it on success", async () => {
    const onNotice = vi.fn();
    render(<Production tab="Jobs" search="" setSearch={() => {}} onNotice={onNotice} onSignIn={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open job-1" }));
    await screen.findByText("Materials used");

    selectItem("inv-flour");
    fireEvent.change(screen.getByLabelText("Quantity used"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Add material" }));
    selectItem("inv-cream");
    fireEvent.change(screen.getByLabelText("Quantity used"), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "for the topping" } });
    fireEvent.click(screen.getByRole("button", { name: "Add material" }));

    fireEvent.click(screen.getByRole("button", { name: "Record materials used (2)" }));
    await waitFor(() => expect(recordJobMaterialsMock).toHaveBeenCalledWith("job-1", [
      { itemId: "inv-flour", quantity: 3, notes: undefined },
      { itemId: "inv-cream", quantity: 1.5, notes: "for the topping" },
    ]));
    expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/deducted from inventory/));
    await waitFor(() => expect(screen.queryByText(/Pending materials/)).not.toBeInTheDocument());
  });

  it("shows history but no entry form once the job moves past production", async () => {
    await openJob("job-2"); // READY_FOR_QUALITY
    expect(screen.getByText("Materials used")).toBeInTheDocument();
    expect(screen.queryByLabelText("Ingredient")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record materials used/ })).not.toBeInTheDocument();
  });
  it("shows the linked order moving to IN_PRODUCTION after the job starts", async () => {
    const onNotice = vi.fn();
    render(<Production tab="Jobs" search="" setSearch={() => {}} onNotice={onNotice} onSignIn={() => {}} />);
    const openButton = await screen.findByRole("button", { name: "Open job-3" });
    fireEvent.click(openButton);
    listProductionJobs.mockResolvedValue([job, qcJob, startJob]);
    startProductionJob.mockImplementation(async () => {
      listProductionJobs.mockResolvedValue([job, qcJob, { ...startJob, status: "IN_PRODUCTION" }]);
      return startJob;
    });
    const startButton = screen.getByRole("button", { name: "Start production" });
    expect(startButton).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(startButton);
    });
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith("Production started");
    });
    expect(screen.queryByText(/Scheduled/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/In production/).length).toBe(2);
  });
});
