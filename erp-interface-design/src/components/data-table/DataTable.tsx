import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type MobileRole = "lead" | "title" | "meta" | "value" | "badge" | "drawer" | "action" | "hide";

/** Column definition — `erp_design.md` §7 AutoTable contract. */
export type Column<T> = {
  header: string;
  align?: "left" | "right";
  width?: string;
  /** Sort key; when present the header becomes a sort button (quiet until sorted). */
  sortKey?: string;
  /** Optional stable value used for row metadata/debugging. */
  accessorKey?: string;
  /** Optional accessor function; used when the column is backed by a derived value. */
  accessorFn?: (row: T) => unknown;
  cell: (row: T, index: number) => ReactNode;
  /** Optional render override; falls back to `cell` when omitted. */
  render?: (row: T) => ReactNode;
  mobile?: MobileRole;
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
  caption?: string;
  mobileTitle?: (row: T) => string;
  mobileSubtitle?: (row: T) => string;
  openLabel?: string;
  hideOpenAction?: boolean;
  mobileDetailTop?: (row: T) => ReactNode;
  cardMode?: "auto" | "table" | "cards";
  tapAction?: "drawer" | "activate";
  /** Detail presentation in card mode. Modal on desktop when set; mobile keeps drawer. */
  detailVariant?: "drawer" | "modal";
  /** Optional custom mobile card body. Keeps tap-to-drawer/activate and row wrapper behavior. */
  renderMobileCard?: (row: T, index: number) => ReactNode;
  /** Optional custom action rendered in the detail footer (replaces/augments open action). */
  renderDrawerAction?: (row: T, index: number, close: () => void) => ReactNode;
};

function resolveMobileRole<T>(col: Column<T>, idx: number, cols: Column<T>[], used: Set<MobileRole>): MobileRole {
  if (col.mobile) return col.mobile;
  if (col.header === "" || /action/i.test(col.header) || col.header === " ") return "action";
  if (col.align === "right" && !used.has("value")) { used.add("value"); return "value"; }
  if (/status/i.test(col.header) && !Array.from(used).filter(r => r === "badge").length) return "badge";
  // first non-action column becomes title
  const earlier = cols.slice(0, idx).filter(c => c.mobile !== "action" && c.mobile !== "hide");
  if (earlier.length === 0) return "title";
  if (earlier.filter(c => (c.mobile || "meta") === "meta").length < 2) return "meta";
  return "drawer";
}

/**
 * Shared ERP data table (erp_design.md X2): sortable headers, right-aligned
 * numerics, sticky header option, density modes, empty state, footer count.
 * Reused by Orders, Inventory, Finance … instead of per-module tables.
 * On phones (>2 data columns), renders card list + detail drawer (F0.7).
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
  caption,
  mobileTitle,
  mobileSubtitle,
  openLabel,
  hideOpenAction,
  mobileDetailTop,
  cardMode = "auto",
  tapAction = "drawer",
  detailVariant = "drawer",
  renderMobileCard,
  renderDrawerAction,
}: DataTableProps<T>) {
  const isMobile = useIsMobile();
  const [activeRow, setActiveRow] = useState<T | null>(null);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const showModal = detailVariant === "modal" && !isMobile;
  const [shown, setShown] = useState<T | null>(null);
  const pending = useRef<null | (() => void)>(null);

  useEffect(() => { if (activeRow) setShown(activeRow); }, [activeRow]);

  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    const next: SortState =
      sort && sort.key === key ? (sort.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" };
    onSortChange(next);
  };

  const renderCell = (col: Column<T>, row: T, i: number) => (col.render ? col.render(row) : col.cell(row, i));

  const useCards = cardMode === "cards" || (isMobile && cardMode !== "table" && columns.length > 2);
  if (useCards) {
    const used = new Set<MobileRole>();
    const resolved = columns.map((c, i) => ({ col: c, role: resolveMobileRole(c, i, columns, used) }));
    const lead = resolved.find(r => r.role === "lead");
    const title = resolved.find(r => r.role === "title") || resolved.find(r => r.role !== "hide" && r.role !== "action");
    const metas = resolved.filter(r => r.role === "meta").slice(0, 2);
    const value = resolved.find(r => r.role === "value");
    const badges = resolved.filter(r => r.role === "badge").slice(0, 2);
    const drawerCols = resolved.filter(r => !["hide", "action", "lead"].includes(r.role));
    const actionCols = resolved.filter(r => r.role === "action");
    const sortCols = columns.filter(c => c.sortKey);

    const open = (row: T, i: number) => {
      if (tapAction === "activate" && onRowActivate) { onRowActivate(row); return; }
      setActiveIdx(i);
      setActiveRow(row);
    };

    return (
      <div className={`table-scroll${stickyHeader ? " sticky-head" : ""}`}>
        {sortCols.length > 0 && onSortChange && (
          <label className="dt-sort">
            <span className="sr-only">Sort by</span>
            <select
              value={sort ? `${sort.key}:${sort.dir}` : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) { onSortChange(null); return; }
                const [key, dir] = v.split(":") as [string, "asc" | "desc"];
                onSortChange({ key, dir });
              }}
            >
              <option value="">Sort: Default</option>
              {sortCols.flatMap(c => ([
                <option key={`${c.sortKey}:asc`} value={`${c.sortKey}:asc`}>{c.header} ↑</option>,
                <option key={`${c.sortKey}:desc`} value={`${c.sortKey}:desc`}>{c.header} ↓</option>,
              ]))}
            </select>
          </label>
        )}
        {rows.length > 0 ? (
          <ul className="dt-cards" role="list" aria-label={caption}>
            {rows.map((row, i) => (
              <li className={"dt-card " + (rowClassName?.(row, i) ?? "")} key={rowKey(row, i)}>
                <div
                  className="dt-card-main"
                  role="button"
                  tabIndex={0}
                  aria-haspopup={tapAction === "activate" && onRowActivate ? undefined : "dialog"}
                  onClick={() => open(row, i)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(row, i); } }}
                >
                  {renderMobileCard ? (
                    renderMobileCard(row, i)
                  ) : (
                    <>
                      {lead && <span className="dt-card-lead">{renderCell(lead.col, row, i)}</span>}
                      <span className="dt-card-body">
                        {title && <span className="dt-card-title">{renderCell(title.col, row, i)}</span>}
                        {metas.map(r => <span className="dt-card-meta" key={r.col.header}>{renderCell(r.col, row, i)}</span>)}
                        {badges.length > 0 && <span className="dt-card-badges">{badges.map(r => <span key={r.col.header}>{renderCell(r.col, row, i)}</span>)}</span>}
                      </span>
                      <span className="dt-card-side">
                        {value && <span className="dt-card-value">{renderCell(value.col, row, i)}</span>}
                        <ChevronRight size={18} aria-hidden="true" />
                      </span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          empty ?? <div className="empty-state"><Search /><h3>No records found</h3><p>Try a different search or filter.</p></div>
        )}
        {footer && <div className="table-foot">{footer}</div>}
        {showModal ? (
          <Dialog open={!!activeRow} onOpenChange={(open) => { if (!open) { setActiveRow(null); if (pending.current) { const f = pending.current; pending.current = null; f(); } } }}>
            <DialogContent className="dt-drawer dt-detail-modal sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{(shown && mobileTitle?.(shown)) || (shown && title ? String(renderCell(title.col, shown, activeIdx) as any) : "Details")}</DialogTitle>
                <DialogDescription>{shown ? mobileSubtitle?.(shown) : undefined}</DialogDescription>
              </DialogHeader>
              <div className="dt-drawer-body">
                {shown && mobileDetailTop?.(shown)}
                <dl className="dt-drawer-list">
                  {shown && drawerCols.map(rr => (
                    <div className="dt-drawer-row" key={rr.col.header || rr.col.sortKey || String(rr.role)}>
                      <dt>{rr.col.header || " "}</dt>
                      <dd>{renderCell(rr.col, shown, activeIdx)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="dt-drawer-foot dt-detail-actions">
                  {shown && actionCols.map(rr => <div className="dt-drawer-action" key={rr.col.header || "action"}>{renderCell(rr.col, shown, activeIdx)}</div>)}
                  {shown && renderDrawerAction ? (
                    renderDrawerAction(shown, activeIdx, () => setActiveRow(null))
                  ) : (
                    onRowActivate && shown && tapAction !== "activate" && !hideOpenAction && (
                      <Button onClick={() => { const row = shown; pending.current = () => onRowActivate(row); setActiveRow(null); }}>{openLabel ?? "Open"}</Button>
                    )
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Drawer open={!!activeRow} onOpenChange={(open) => !open && setActiveRow(null)} shouldScaleBackground={false}
            onAnimationEnd={() => { if (!activeRow && pending.current) { const f = pending.current; pending.current = null; f(); } }}>
            <DrawerContent className="dt-drawer">
              <DrawerHeader>
                <DrawerTitle>{(shown && mobileTitle?.(shown)) || (shown && title ? String(renderCell(title.col, shown, activeIdx) as any) : "Details")}</DrawerTitle>
                <DrawerDescription>{shown ? mobileSubtitle?.(shown) : undefined}</DrawerDescription>
              </DrawerHeader>
              <div className="dt-drawer-body">
                {shown && mobileDetailTop?.(shown)}
                <dl className="dt-drawer-list">
                  {shown && drawerCols.map(rr => (
                    <div className="dt-drawer-row" key={rr.col.header || rr.col.sortKey || String(rr.role)}>
                      <dt>{rr.col.header || " "}</dt>
                      <dd>{renderCell(rr.col, shown, activeIdx)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <DrawerFooter className="dt-drawer-foot">
                {shown && actionCols.map(rr => <div className="dt-drawer-action" key={rr.col.header || "action"}>{renderCell(rr.col, shown, activeIdx)}</div>)}
                {shown && renderDrawerAction ? (
                  renderDrawerAction(shown, activeIdx, () => setActiveRow(null))
                ) : (
                  onRowActivate && shown && tapAction !== "activate" && !hideOpenAction && (
                    <Button onClick={() => { const row = shown; pending.current = () => onRowActivate(row); setActiveRow(null); }}>{openLabel ?? "Open"}</Button>
                  )
                )}
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        )}
      </div>
    );
  }

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
                  {renderCell(col, row, i)}
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
