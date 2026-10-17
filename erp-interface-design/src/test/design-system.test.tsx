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
    expect(toneOf("Awaiting pickup")).toBe("amber");
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

describe("density preference (persisted in localStorage)", () => {
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

  it("persists a change and re-reads it on remount", () => {
    localStorage.removeItem("tc-density");
    const { unmount } = render(
      <DensityProvider>
        <Probe onReady={() => {}} />
      </DensityProvider>,
    );
    fireEvent.click(screen.getByText("spacious"));
    expect(screen.getByTestId("density").textContent).toBe("spacious");
    expect(localStorage.getItem("tc-density")).toBe("spacious");
    unmount();
    render(
      <DensityProvider>
        <Probe onReady={() => {}} />
      </DensityProvider>,
    );
    expect(screen.getByTestId("density").textContent).toBe("spacious");
    localStorage.removeItem("tc-density");
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

  it("locks the contrast-validated teal accent pair (light + dark)", () => {
    // #2A7A8F on #F1F8FA = 4.57:1 (light) · #6FC6D9 on #0F323A = 6.99:1 (dark) — WCAG AA.
    expect(css).toContain("--teal-soft: oklch(.974 .008 217);");
    expect(css).toContain("--teal-ink: oklch(.5405 .0821 218.7);");
    expect(css).toContain("--teal-soft: oklch(.296 .042 215.5);");
    expect(css).toContain("--teal-ink: oklch(.779 .088 213.5);");
  });

  it("defines a stage-nav tone for every status tone", () => {
    for (const tone of ["gray", "amber", "green", "blue", "red", "violet", "teal", "orange", "rose"]) {
      expect(css).toContain(`.stage-nav-btn.tone-${tone} {`);
    }
  });
});
