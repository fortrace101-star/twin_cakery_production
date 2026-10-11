import { describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach } from "vitest";

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
  it("renders the dashboard at /", () => {
    renderAt("/");
    expect(screen.getByText("Twin Cakery Bakery")).toBeInTheDocument();
  });

  it("renders a module workspace at /workspace/sales", () => {
    renderAt("/workspace/sales");
    expect(screen.getByRole("heading", { name: /Sales & orders/ })).toBeInTheDocument();
  });

  it("renders the CRM two-pane (list + conversation) at /workspace/crm", () => {
    // Regression guard: CRM is the one non-table module (erp-design-system.md §5).
    // The two-pane branch must be reachable — a stray generic-table `return` above it
    // once made this unreachable and CRM silently rendered as a plain table.
    renderAt("/workspace/crm");
    // Contact list (not a DataTable): selecting a conversation drives the detail pane.
    expect(screen.getByRole("button", { name: /Sarah Mwangi/ })).toBeInTheDocument();
    // The conversation detail pane is present alongside the list.
    expect(document.querySelector(".crm-detail")).not.toBeNull();
    expect(document.querySelector(".crm-thread")).not.toBeNull();
    // And it is genuinely the two-pane, not a generic module table.
    expect(document.querySelector(".crm-view")).not.toBeNull();
  });
});

