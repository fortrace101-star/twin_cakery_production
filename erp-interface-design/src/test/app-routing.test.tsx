import { describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach } from "vitest";

// Mock the API layer so the workspace renders an authenticated session without a
// live backend. `me()` returns a signed-in user, so the auth gates (PrivateRoute
// / GuestPage) open and the dashboard + module workspaces render instead of
// redirecting to /login. The list helpers resolve to [] so refresh() settles and
// `loading` flips to false; the workspace then falls back to bundled sample data
// (initialOrders), which is exactly what these routing assertions target.
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
  return {
    ...actual,
    me: vi.fn(async () => ({ user, permissions: [] as string[] })),
    hasExistingUser: vi.fn(async () => true),
    login: vi.fn(async () => ({ token: "test-token", user })),
    logout: vi.fn(async () => undefined),
    listCustomers: vi.fn(async () => []),
    listProducts: vi.fn(async () => []),
    listOrders: vi.fn(async () => []),
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

  it("renders the CRM two-pane (list + conversation) at /workspace/crm", async () => {
    // Regression guard: CRM is the one non-table module (erp-design-system.md §5).
    // The two-pane branch must be reachable — a stray generic-table `return` above it
    // once made this unreachable and CRM silently rendered as a plain table.
    renderAt("/workspace/crm");
    // Contact list (not a DataTable): selecting a conversation drives the detail pane.
    expect(
      await screen.findByRole("button", { name: /Sarah Mwangi/ }),
    ).toBeInTheDocument();
    // The conversation detail pane is present alongside the list, and it is genuinely
    // the two-pane (not a generic module table).
    await waitFor(() => {
      expect(document.querySelector(".crm-view")).not.toBeNull();
      expect(document.querySelector(".crm-detail")).not.toBeNull();
      expect(document.querySelector(".crm-thread")).not.toBeNull();
    });
  });
});


