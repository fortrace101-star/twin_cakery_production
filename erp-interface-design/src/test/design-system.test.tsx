import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import { StatusBadge } from "@/components/data-table/StatusBadge";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { statusTones, toneOf, spacing, typeScale } from "@/lib/theme-tokens";
import { DensityProvider, useDensity } from "@/lib/density";
import type { Density } from "@/components/data-table/DataTable";

afterEach(cleanup);

describe("status vocabulary (erp_design.md C2-C4 — locked)", () => {
  it("maps every vocabulary word to its fixed tone", () => {
    expect(toneOf("Paid")).toBe("green");
    expect(toneOf("Completed")).toBe("green");
    expect(toneOf("In stock")).toBe("green");
    expect(toneOf("In production")).toBe("blue");
    expect(toneOf("Dispatched")).toBe("blue");
    expect(toneOf("Low stock")).toBe("red");
    expect(toneOf("Unpaid")).toBe("red");
    expect(toneOf("Pending")).toBe("amber");
    expect(toneOf("Confirmed")).toBe("violet");
    expect(toneOf("Accepted")).toBe("violet");
    expect(toneOf("Draft")).toBe("gray");
    expect(toneOf("Inactive")).toBe("gray");
    // Disambiguated words (must resolve to exactly one tone — see overlap guard below)
    expect(toneOf("Active")).toBe("green");
    expect(toneOf("Awaiting dispatch")).toBe("amber");
    expect(toneOf("Partially paid")).toBe("amber");
    expect(toneOf("Processing")).toBe("violet");
    expect(toneOf("Baking")).toBe("gray");
    expect(toneOf("Out of stock")).toBe("red");
  });

  it("falls back to amber for unknown statuses", () => {
    expect(toneOf("Something new")).toBe("amber");
  });

  it("keeps the vocabulary free of overlap between tones", () => {
    const all = Object.values(statusTones).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it("renders badge + word (never colour alone)", () => {
    render(<StatusBadge value="Paid" />);
    const badge = screen.getByText("Paid");
    expect(badge.className).toContain("status status-green");
    // word itself is inside the badge — text carries the meaning
    expect(badge.textContent).toBe("Paid");
  });
});

describe("density preference (session-only, no browser storage)", () => {
  function Probe({ onReady }: { onReady: (v: Density) => void }) {
    const { density, setDensity } = useDensity();
    onReady(density);
    return (
      <div>
        <button onClick={() => setDensity("compact")}>compact</button>
        <button onClick={() => setDensity("spacious")}>spacious</button>
        <button onClick={() => setDensity("comfortable")}>comfortable</button>
        <span data-testid="density">{density}</span>
      </div>
    );
  }

  it("defaults to comfortable outside the provider", () => {
    render(<Probe onReady={() => {}} />);
    expect(screen.getByTestId("density").textContent).toBe("comfortable");
  });

  it("applies a change for the session and starts fresh on remount", () => {
    localStorage.removeItem("tc-density");
    const { unmount } = render(
      <DensityProvider>
        <Probe onReady={() => {}} />
      </DensityProvider>,
    );
    fireEvent.click(screen.getByText("spacious"));
    expect(screen.getByTestId("density").textContent).toBe("spacious");
    // E2 keeps the preference session-only — nothing is written to localStorage.
    expect(localStorage.getItem("tc-density")).toBeNull();
    unmount();
    render(
      <DensityProvider>
        <Probe onReady={() => {}} />
      </DensityProvider>,
    );
    expect(screen.getByTestId("density").textContent).toBe("comfortable");
  });
});

describe("tokens", () => {
  it("uses the 8px grid (4 = half step)", () => {
    expect(spacing[1]).toBe(4);
    expect(spacing[2]).toBe(8);
    expect(spacing[3]).toBe(16);
    expect(spacing[4]).toBe(24);
  });

  it("locks the type scale sizes", () => {
    expect(typeScale.xs.size).toBe(11);
    expect(typeScale.base.size).toBe(13);
    expect(typeScale.xl.size).toBe(24);
  });
});

type Row = { id: string; name: string; amount: number };
const rows: Row[] = [
  { id: "r1", name: "Alpha", amount: 5000 },
  { id: "r2", name: "Beta", amount: 1200 },
];
const columns: Column<Row>[] = [
  { header: "Name", sortKey: "name", cell: (r) => r.name },
  { header: "Amount", align: "right", sortKey: "amount", cell: (r) => r.amount },
];

describe("DataTable", () => {
  it("renders headers, rows and right-aligns numeric columns", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    const amountHeader = screen.getByText("Amount").closest("th");
    expect(amountHeader?.className).toContain("num-col");
    expect(screen.getByText("5000").className).toContain("num-col");
  });

  it("exposes aria-sort and toggles direction on header click", async () => {
    let sort: { key: string; dir: "asc" | "desc" } | null = null;
    const onSortChange = (next: typeof sort) => {
      sort = next;
    };
    const { rerender } = render(
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} sort={null} onSortChange={onSortChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sort by Amount" }));
    expect(sort).toEqual({ key: "amount", dir: "asc" });
    rerender(
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} sort={{ key: "amount", dir: "asc" }} onSortChange={onSortChange} />,
    );
    expect(screen.getByText("Amount").closest("th")?.getAttribute("aria-sort")).toBe("ascending");
  });

  it("activates a row via click and Enter", async () => {
    const picked: string[] = [];
    render(
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowActivate={(r) => picked.push(r.id)} />,
    );
    fireEvent.click(screen.getByText("Alpha"));
    expect(picked).toEqual(["r1"]);
    screen.getByText("Alpha").focus();
    fireEvent.keyDown(screen.getByText("Alpha"), { key: "Enter" });
    expect(picked).toEqual(["r1", "r1"]);
  });

  it("renders the empty state when there are no rows", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(r: Row) => r.id}
        empty={<div>No orders found</div>}
      />,
    );
    expect(screen.getByText("No orders found")).toBeInTheDocument();
  });

  it("applies the density class", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} density="compact" />);
    expect(document.querySelector("table")?.className).toContain("dt-compact");
  });
});

describe("styles.css order-stage token locks", () => {
  const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

  it("locks the stage tone pairs derived from the exact stage HEXes (light + dark)", () => {
    // Ready stage: #65A30D lime — solid anchor + AA-verified soft/ink pairs
    // (5.31:1 light, 8.91:1 dark — see the contrast table in styles.css).
    expect(css).toContain("--teal-solid: #65A30D;");
    expect(css).toContain("--teal-soft: color-mix(in oklch, #65A30D 20%, white);");
    expect(css).toContain("--teal-ink: color-mix(in oklch, #65A30D 73%, black);");
    expect(css).toContain("--teal-soft: oklch(0.30 0.048 132);");
    expect(css).toContain("--teal-ink: color-mix(in oklch, #65A30D 40%, white);");
  });

  it("defines a stage-nav tone for every status tone", () => {
    for (const tone of ["gray", "amber", "green", "blue", "red", "violet", "teal", "orange", "rose"]) {
      expect(css).toContain(`.stage-nav-btn.tone-${tone} {`);
    }
  });

  it("keeps modal status colours as flat fills and the gradients on the order rows", () => {
    // Update-status modal + badges: solid status fills, never gradients.
    expect(css).toContain(".status-green {background:var(--green-soft);color:var(--green-ink);}");
    expect(css).toContain(".status-amber {background:var(--peach-soft);color:var(--amber-ink);}");
    expect(css).toContain(".order-stage-strip li.is-current {background:var(--stage-tone-soft);");
    expect(css).toContain(".stage-nav-btn {background:var(--stage-tone-soft);");
    expect(css).toContain(".order-status-grid>div {padding:9px 10px;border-radius:8px;border:1px solid color-mix(in oklch,var(--tile-tone,var(--border)) 25%,var(--border));background:var(--tile-tone-soft,var(--muted));}");
    expect(css).toContain(".payments-processing.tone-violet {border-color:color-mix(in oklch,var(--violet-ink) 30%,var(--border));background:var(--violet-soft);");
    // Gradients belong to the order rows (previous design language).
    expect(css).toContain(".orders-table tbody tr.order-row-tint {--row-tint:var(--muted);background:linear-gradient(to right,var(--row-tint)");
  });
});
