import type { ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";

/** Column definition — `erp_design.md` §7 AutoTable contract. */
export type Column<T> = {
  header: string;
  align?: "left" | "right";
  width?: string;
  /** Sort key; when present the header becomes a sort button (quiet until sorted). */
  sortKey?: string;
  cell: (row: T, index: number) => ReactNode;
};

export type SortState = { key: string; dir: "asc" | "desc" } | null;

/** Row density — `erp_design.md` E2 three modes (padding vertical/horizontal). */
export type Density = "compact" | "comfortable" | "spacious";

const densityClass: Record<Density, string> = {
  compact: "dt-compact",
  comfortable: "dt-comfortable",
  spacious: "dt-spacious",
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** Optional per-row class (e.g. status-tinted order rows). */
  rowClassName?: (row: T, index: number) => string | undefined;
  /** Opt-in sticky header for internally scrolling tables (E3 decision). */
  stickyHeader?: boolean;
  density?: Density;
  sort?: SortState;
  onSortChange?: (next: SortState) => void;
  /** Row activation (click + Enter). */
  onRowActivate?: (row: T) => void;
  /** Rendered in place of rows when `rows` is empty. */
  empty?: ReactNode;
  /** Footer line under the table (record count / totals). */
  footer?: ReactNode;
  className?: string;
};

/**
 * Shared ERP data table (erp_design.md X2): sortable headers, right-aligned
 * numerics, sticky header option, density modes, empty state, footer count.
 * Reused by Orders, Inventory, Finance … instead of per-module tables.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowClassName,
  stickyHeader = false,
  density = "comfortable",
  sort = null,
  onSortChange,
  onRowActivate,
  empty,
  footer,
  className = "",
}: DataTableProps<T>) {
  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    const next: SortState =
      sort && sort.key === key ? (sort.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" };
    onSortChange(next);
  };

  return (
    <div className={`table-scroll${stickyHeader ? " sticky-head" : ""}`}>
      <table className={`orders-table dt-table ${densityClass[density]} ${className}`}>
        <thead>
          <tr>
            {columns.map((col) => {
              const sorted = Boolean(col.sortKey && sort && sort.key === col.sortKey);
              return (
                <th
                  key={col.header}
                  className={col.align === "right" ? "num-col" : undefined}
                  style={col.width ? { width: col.width } : undefined}
                  aria-sort={sorted ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  {col.sortKey && onSortChange ? (
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => toggleSort(col.sortKey!)}
                      aria-label={`Sort by ${col.header}`}
                    >
                      {col.header}
                      <ChevronDown size={12} className={sorted && sort!.dir === "asc" ? "rotated" : undefined} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className={rowClassName?.(row, i)}
              onClick={onRowActivate ? () => onRowActivate(row) : undefined}
              tabIndex={onRowActivate ? 0 : undefined}
              onKeyDown={
                onRowActivate
                  ? (e) => {
                      if (e.key === "Enter") onRowActivate(row);
                    }
                  : undefined
              }
            >
              {columns.map((col) => (
                <td key={col.header} className={col.align === "right" ? "num-col" : undefined} style={col.width ? { width: col.width } : undefined}>
                  {col.cell(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (empty ?? <div className="empty-state"><Search /><h3>No records found</h3><p>Try a different search or filter.</p></div>)}
      {footer && <div className="table-foot">{footer}</div>}
    </div>
  );
}
