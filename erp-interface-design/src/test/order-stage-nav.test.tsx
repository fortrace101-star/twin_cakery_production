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
    useWorkspace: () => ({ orders: [...orders, cancelled], updateOrder: vi.fn() }),
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

function currentStepLabel(): string | undefined {
  return screen.getAllByRole("listitem").find((li) => li.getAttribute("aria-current") === "step")?.textContent;
}

describe("OrderDialog stage strip (Phase E5)", () => {
  it("renders every pipeline stage as a horizontal strip, not a dropdown", () => {
    renderDialog(inProd);
    const list = screen.getByRole("list", { name: "Order pipeline stages" });
    expect(list.className).toContain("order-stage-strip");
    // Stage navigation is never a dropdown — the modal has no comboboxes at all.
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.getAllByRole("listitem")).toHaveLength(ORDER_STAGE_PIPELINE.length);
    expect(currentStepLabel()).toContain("In production");
  });

  it("opens on the ACTIVE stage and only advances when Next is clicked", () => {
    renderDialog(inProd);
    // Nothing pre-advances: the target equals the active stage on open.
    expect(currentStepLabel()).toContain("In production");
    expect(screen.getByRole("button", { name: "Previous: Confirmed" }).className).toContain("tone-blue");
    expect(screen.getByRole("button", { name: "Next: Ready" }).className).toContain("tone-teal");
    expect(screen.getByRole("button", { name: "Update status" })).toBeDisabled();
    // Manual step forward — the target moves one stage, submit unlocks.
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
    expect(screen.getByRole("button", { name: "Previous: In production" }).className).toContain("tone-violet");
    expect(screen.getByRole("button", { name: "Next: Awaiting Collection" }).className).toContain("tone-amber");
    expect(screen.getByRole("button", { name: "Update status" })).toBeEnabled();
    // Navigation follows the TARGET, so steps accumulate across clicks.
    fireEvent.click(screen.getByRole("button", { name: /^Previous/ }));
    expect(screen.getByRole("button", { name: "Update status" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Previous/ }));
    expect(screen.getByRole("button", { name: "Previous: Pending confirmation" }).className).toContain("tone-green");
    expect(screen.getByRole("button", { name: "Next: In production" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update status" })).toBeEnabled();
    // The strip always shows the STORE's current stage as the step.
    expect(currentStepLabel()).toContain("In production");
  });

  it("resolves the payment status from the amount paid — read-only, no picker", () => {
    renderDialog(inProd);
    expect(screen.queryByLabelText(/reason for change/i)).not.toBeInTheDocument();
    // The picker is gone: nothing on the modal can set payment by hand.
    expect(screen.queryByRole("combobox", { name: "Payment status" })).not.toBeInTheDocument();
    const display = screen.getByRole("textbox", { name: "Payment status" }) as HTMLInputElement;
    expect(display.value).toBe("Partially paid"); // TC-1048 · UGX 1,500 of 4,500 paid
    expect(display.readOnly).toBe(true);
    expect(screen.getByRole("button", { name: "Update status" })).toBeDisabled();
    // Only a stage move unlocks the update — payment status is never editable.
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
    expect(screen.getByRole("button", { name: "Update status" })).toBeEnabled();
  });

  it("locks both nav buttons and submit at the pipeline end (Completed)", () => {
    renderDialog(completed);
    expect(currentStepLabel()).toContain("Completed");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous: In Transit" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Update status" })).toBeDisabled();
  });

  it("falls back gracefully for orders outside the pipeline (Cancelled)", () => {
    renderDialog(cancelled);
    expect(screen.getByText(/sits outside the production pipeline/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Update status" })).toBeDisabled();
    // Cancelled is not a pipeline stage, so no strip item is the "step".
    expect(screen.getAllByRole("listitem").every((li) => li.getAttribute("aria-current") !== "step")).toBe(true);
  });
});
