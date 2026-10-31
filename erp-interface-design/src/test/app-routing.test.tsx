import { describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach } from "vitest";

// Mock the API layer so the workspace renders an authenticated session without a
// live backend. `me()` returns a signed-in user, so the auth gates (PrivateRoute
// / GuestPage) open and the dashboard + module workspaces render instead of
// redirecting to /login. The workspace only renders live API data now (the
// bundled `initialOrders` sample set was removed), so this mock feeds
// server-shaped orders + a customer through the API boundary — enough for the
// Finance payment rows and the CRM contact list to render.
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  const user = {
    id: "usr-test",
    username: "manager",
    displayName: "Test Manager",
    email: "manager@twincakery.test",
    role: "Manager",
    isAdmin: true,
    status: "active",
  };
  const customer = { id: "cust-sarah", name: "Sarah Mwangi" };
  const customer2 = { id: "cust-david", name: "David Ochieng" };
  const orders = [
    {
      id: "ord-1044",
      orderNumber: "TC-1044",
      customerId: customer.id,
      items: [{ productId: "prod-choc", variantOptions: "2 kg · Chocolate · Birthday", quantity: 1, unitPrice: 4500 }],
      subtotal: 4500,
      discount: 0,
      deliveryCharge: 0,
      taxAmount: 0,
      total: 4500,
      requiredBy: null,
      requiredAt: "2026-10-07T10:00:00.000Z",
      notes: "2 kg · Chocolate · Birthday · WhatsApp",
      status: "IN_PRODUCTION",
      paymentStatus: "UNPAID",
      deliveryStatus: "PENDING",
      createdBy: "",
      deliveredAt: null,
      station: "baking",
    },
    {
      id: "ord-1043",
      orderNumber: "TC-1043",
      customerId: customer2.id,
      items: [{ productId: "prod-choc", variantOptions: "1 kg · Vanilla", quantity: 1, unitPrice: 3000 }],
      subtotal: 3000,
      discount: 0,
      deliveryCharge: 0,
      taxAmount: 0,
      total: 3000,
      requiredBy: null,
      requiredAt: "2026-10-06T10:00:00.000Z",
      notes: "Pickup",
      status: "COMPLETED_DELIVERED",
      paymentStatus: "PAID",
      deliveryStatus: "COMPLETED_DELIVERED",
      createdBy: "",
      deliveredAt: "2026-10-06T15:00:00.000Z",
      station: "done",
    },
  ];
  return {
    ...actual,
    me: vi.fn(async () => ({ user, permissions: [] as string[] })),
    hasExistingUser: vi.fn(async () => true),
    login: vi.fn(async () => ({ token: "test-token", user })),
    logout: vi.fn(async () => undefined),
    listCustomers: vi.fn(async () => [customer, customer2]),
    listProducts: vi.fn(async () => []),
    listOrders: vi.fn(async () => orders),
    listAudit: vi.fn(async () => []),
  };
});

import App from "@/App";

afterEach(cleanup);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App routing", () => {
  it("renders the dashboard at /", async () => {
    renderAt("/");
    // me()/refresh() resolve asynchronously; findByText waits for the authenticated
    // dashboard (sidebar brand "Twin Cakery") to mount.
    expect(await screen.findByText("Twin Cakery")).toBeInTheDocument();
  });

  it("renders a module workspace at /workspace/sales", async () => {
    renderAt("/workspace/sales");
    expect(
      await screen.findByRole("heading", { name: /Sales & orders/ }),
    ).toBeInTheDocument();
  });

  it("renders the dedicated FinanceView at /workspace/finance", async () => {
    // Regression guard: Finance renders the dedicated payments/expenses/reports
    // view — not the generic module table.
    renderAt("/workspace/finance");
    // The heading carries an inline record count ("Payments 0"), so match the prefix.
    expect(await screen.findByRole("heading", { name: /^Payments/ })).toBeInTheDocument();
    expect(screen.getByText(/Record and review payments against orders/)).toBeInTheDocument();
    // Unsettled order payments are listed with their status badge (sample data).
    expect(await screen.findByText("#TC-1044")).toBeInTheDocument();
  });

  it("renders the CRM two-pane (list + detail) at /workspace/crm", async () => {
    // Regression guard: CRM is the one non-table module (erp-design-system.md §5).
    // The two-pane branch must be reachable — a stray generic-table `return` above it
    // once made this unreachable and CRM silently rendered as a plain table.
    renderAt("/workspace/crm");
    // Contact list (not a DataTable): selecting a contact drives the detail pane.
    expect(
      await screen.findByRole("button", { name: /Sarah Mwangi/ }),
    ).toBeInTheDocument();
    // The detail pane is present alongside the list and is genuinely the two-pane
    // (not a generic module table). The old conversation thread (.crm-thread) was
    // removed by the CRM makeover — the detail pane is now the tabbed
    // Order history / Feedback / Occasions content instead.
    await waitFor(() => {
      expect(document.querySelector(".crm-view")).not.toBeNull();
      expect(document.querySelector(".crm-detail")).not.toBeNull();
      expect(document.querySelector(".crm-tabs[role=tablist]")).not.toBeNull();
    });
    // The detail tabs are interactive — the makeover's tabs replaced the thread.
    expect(screen.getByRole("tab", { name: "Orders" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Occasions" })).toBeInTheDocument();
  });
});


