import { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import { OrderDialog } from "@/components/erp/dialogs";
import { WorkspaceProvider } from "@/components/erp/store";
import { initialOrders, type Order } from "@/components/erp/data";
import { ORDER_STAGE_PIPELINE } from "@/lib/theme-tokens";

// The dialog resolves its order from the workspace STORE (by id), so the
// Cancelled case needs a store that actually contains one.
vi.mock("@/components/erp/store", async () => {
  const { initialOrders: orders } = await import("@/components/erp/data");
  const cancelled: Order = { ...orders[0]!, id: "TC-0000", status: "Cancelled" };
  return {
    WorkspaceProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    useWorkspace: () => ({ orders: [...orders, cancelled], updateOrder: vi.fn(async () => ({ ok: true })) }),
  };
});

afterEach(cleanup);

function renderDialog(order: Order) {
  const onNotice = vi.fn();
  render(
    <WorkspaceProvider>
      <OrderDialog order={order} onClose={() => {}} onNotice={onNotice} />
    </WorkspaceProvider>,
  );
  return { onNotice };
}

const inProd = initialOrders.find((o) => o.status === "In production")!; // TC-1048 · idx 2
const completed = initialOrders.find((o) => o.status === "Completed / Delivered")!; // TC-1043 · idx 6 (end)
const cancelled = { ...initialOrders[0]!, id: "TC-0000", status: "Cancelled" }; // off-pipeline

describe("OrderDialog stage strip (Phase E5)", () => {
  it("renders the pipeline as a compact progress bar, not a dropdown", () => {
    renderDialog(inProd);
    const group = screen.getByRole("group", { name: "Order pipeline stages" });
    expect(group).toBeInTheDocument();
    // Stage navigation is never a dropdown — the modal has no comboboxes at all.
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemax", String(ORDER_STAGE_PIPELINE.length));
    expect(bar).toHaveAttribute("aria-valuenow", "3"); // In production = step 3
    expect(screen.getByText(`Step 3 of ${ORDER_STAGE_PIPELINE.length} · In production`)).toBeInTheDocument();
  });

  it("shows one-tap Back and primary move actions for the current stage", () => {
    renderDialog(inProd);
    expect(screen.getByRole("button", { name: "Back: Confirmed" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move to Ready" })).toBeEnabled();
    // No separate two-step "Update status" flow.
    expect(screen.queryByRole("button", { name: "Update status" })).not.toBeInTheDocument();
  });

  it("shows payment status as a read-only chip — no picker", () => {
    renderDialog(inProd);
    expect(screen.queryByLabelText(/reason for change/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Payment status" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Payment status" })).not.toBeInTheDocument();
    // TC-1048 · UGX 1,500 of 4,500 paid → Partially paid
    expect(screen.getByText(/Partially paid/)).toBeInTheDocument();
  });

  it("locks the primary action and enables Back at the pipeline end (Completed)", () => {
    renderDialog(completed);
    expect(screen.getByText(/Step 7 of 7 · Completed \/ Delivered/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No next stage" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back: In Transit" })).toBeEnabled();
  });

  it("falls back gracefully for orders outside the pipeline (Cancelled)", () => {
    renderDialog(cancelled);
    expect(screen.getByText(/sits outside the production pipeline/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "No next stage" })).toBeDisabled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
