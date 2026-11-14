import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveRefresh } from "@/lib/live";
import { Check, Clock3, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";

import { useWorkspace } from "./store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { money } from "./data";
import { StatusBadge as Status } from "../data-table/StatusBadge";
import { orderStageTone } from "@/lib/theme-tokens";
import { DataTable, type SortState } from "@/components/data-table/DataTable";
import { useDensity } from "@/lib/density";
import {
  request,
  listPayments,
  recordPayment,
  recordPaymentCallback,
  listExpenses,
  listExpenseCategories,
  createExpense,
  updateExpense,
  deleteExpense,
  listFinanceReports,
  listProductionJobs,
  getProductionCosts,
  createExpenseCategory,
  listInvoices,
  listFinanceApprovals,} from "@/lib/api";
import type { ServerExpense, ServerExpenseCategory, ServerPayment, FinanceReport } from "@/lib/api";
import { usePaymentFilters } from "./data-table/filters";
import type { DateRange } from "./data-table/filters";

/**
 * Sort helper for the Finance tables (erp_design.md §7): numeric accessors
 * compare as numbers, everything else as locale strings; null sort = as-is.
 */
function applySort<T>(rows: T[], sort: SortState, accessors: Record<string, (row: T) => number | string>): T[] {
  const get = sort ? accessors[sort.key] : undefined;
  if (!sort || !get) return rows;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
    return sort.dir === "asc" ? d : -d;
  });
}

const PAY_METHODS = ["Cash", "M-Pesa"] as const;

type PayMethod = (typeof PAY_METHODS)[number];

const RANGE_LABELS: Record<DateRange, string> = {
  allTime: "All time",
  today: "Today",
  thisWeek: "This week",
  thisMonth: "This month",
};

type PaymentFilters = ReturnType<typeof usePaymentFilters>[0];

/** Filter panel shared by the desktop bar and the mobile Filters sheet. */
function PaymentFilterBar({
  filters, setFilters, methods, summary, onClear,
}: {
  filters: PaymentFilters;
  setFilters: (next: Partial<PaymentFilters>) => void;
  methods: string[];
  summary: { count: number; total: string };
  onClear: () => void;
}) {
  const primary = methods.slice(0, 2);
  const extra = methods.slice(2);

  return (
    <div className="filter-bar">
      <div className="filter-bar-row">
        <div className="filter-search">
          <Search size={16} />
          <input
            aria-label="Search payments"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="Search order #, reference, method…"
          />
          {filters.search && (
            <button type="button" aria-label="Clear search" className="filter-search-clear" onClick={() => setFilters({ search: "" })}>×</button>
          )}
        </div>
        <label className="filter-range">
          <span>Date</span>
          <select aria-label="Filter payments by date" value={filters.range} onChange={(e) => setFilters({ range: e.target.value as DateRange })}>
            {(Object.keys(RANGE_LABELS) as DateRange[]).map((key) => (
              <option key={key} value={key}>{RANGE_LABELS[key]}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="filter-bar-row filter-bar-row--chips">
        <div className="filter-chips" role="group" aria-label="Payment method">
          <button type="button" className={`filter-chip${filters.method === "All methods" ? " filter-chip--active" : ""}`} aria-pressed={filters.method === "All methods"} onClick={() => setFilters({ method: "All methods" })}>All</button>
          {primary.map((m) => (
            <button key={m} type="button" className={`filter-chip${filters.method === m ? " filter-chip--active" : ""}`} aria-pressed={filters.method === m} onClick={() => setFilters({ method: m })}>{m}</button>
          ))}
          {extra.length > 0 && (
            <details className="filter-more">
              <summary>More ▾</summary>
              <div className="filter-more-list">
                {extra.map((m) => (
                  <button key={m} type="button" className={`filter-chip${filters.method === m ? " filter-chip--active" : ""}`} aria-pressed={filters.method === m} onClick={() => setFilters({ method: m })}>{m}</button>
                ))}
              </div>
            </details>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
      </div>
      <p className="filter-summary" aria-live="polite">
        Showing {summary.count} payment{summary.count === 1 ? "" : "s"} · {summary.total} collected
        {filters.range !== "allTime" ? ` · ${RANGE_LABELS[filters.range]}` : ""}
      </p>
      {(filters.method !== "All methods" || filters.range !== "thisMonth") && (
        <div className="filter-active">
          {filters.method !== "All methods" && (
            <button type="button" className="filter-chip filter-chip--active" onClick={() => setFilters({ method: "All methods" })}>{filters.method} ×</button>
          )}
          {filters.range !== "thisMonth" && (
            <button type="button" className="filter-chip filter-chip--active" onClick={() => setFilters({ range: "thisMonth" })}>{RANGE_LABELS[filters.range]} ×</button>
          )}
        </div>
      )}
    </div>
  );
}

export function FinanceView({ tab = "Payments", onNotice }: { tab?: string; onNotice: (s: string) => void }) {
  const { user, orders } = useWorkspace();
  // Orders for the Order payment status sub-tab. "Paid" here is derived from
  // the payments the user has recorded; the order form's own paidAmount is not
  // used for this view. Unset orders are still shown on the Payments tab.
  const statusOrders = orders.filter((o) => o.payment !== "Paid");
  const processingOrders = orders.filter((o) => o.payment === "Processing");
  const activeTab = tab || "Payments";
  // One sort state per table so the Finance tables sort independently.
  const [paySort, setPaySort] = useState<SortState>(null);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [statusSort, setStatusSort] = useState<SortState>(null);
  const [expSort, setExpSort] = useState<SortState>(null);
  // Shared record search + density — the stock-table standard (table-controls
  // search box above the table, density preference respected). The filter-select
  // mirrors the Sales & Orders tables' layout: search left, filter right.
  const { density } = useDensity();
  const [filters, setFilters] = usePaymentFilters();
  const [expCategory, setExpCategory] = useState("All categories");
  const [expSearch, setExpSearch] = useState("");
  const [reversalOpen, setReversalOpen] = useState(false);
  const [reversalRow, setReversalRow] = useState<ServerPayment | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [payments, setPayments] = useState<ServerPayment[]>([]);
  const [expenses, setExpenses] = useState<ServerExpense[]>([]);
  const [categories, setCategories] = useState<ServerExpenseCategory[]>([]);
  const [reports, setReports] = useState<FinanceReport | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);

  // ---- payments -----------------------------------------------------------
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"Cash" | "M-Pesa">("Cash");

  const [reference, setReference] = useState("");
  const [recording, setRecording] = useState(false);
  const [pasa, setPasa] = useState<{ checkoutRequestID: string; reference: string } | null>(null);
  const isMobile = useIsMobile();
  const [payFormOpen, setPayFormOpen] = useState(false);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [expFormOpen, setExpFormOpen] = useState(false);

  const refreshPayments = useCallback(async () => {
    const list = await listPayments();
    setPayments(list);
  }, []);

  useEffect(() => { void refreshPayments(); }, [refreshPayments]);
  useLiveRefresh(refreshPayments);

  // ---- production costs for profitability KPI ----
  // Jobs themselves carry no cost fields; the ledger lives per job behind
  // GET /production/jobs/:id/costs (docs: finance_production.md task 2.1).
  const [productionCosts, setProductionCosts] = useState<number>(0);
  const refreshProductionCosts = useCallback(async () => {
    try {
      const jobs = await listProductionJobs();
      const costLists = await Promise.all((jobs ?? []).map((job) => getProductionCosts(job.id)));
      const totalCost = costLists.flat().reduce((sum, cost) => sum + (cost.total || 0), 0);
      setProductionCosts(totalCost);
    } catch {
      // silently fail - production costs are optional
    }
  }, []);
  useEffect(() => { void refreshProductionCosts(); }, [refreshProductionCosts]);
  useLiveRefresh(refreshProductionCosts);

  async function onRecordPayment() {
    if (!orderId || !amount) return onNotice("Enter an order and an amount");
    setRecording(true);
    try {
      const res = await recordPayment({
        orderId,
        amount: Number(amount),
        method,
        ...(reference ? { reference } : {}),
      });
      setPayments((p) => [...p, res]);
      if (res.stagedPush && method === "M-Pesa") {
        setPasa({ checkoutRequestID: String(res.stagedPush["CheckoutRequestID"] || ""), reference: res.reference });
        onNotice(`"${res.reference}" staged for M-Pesa — confirm in the Pasa simulator`);
      } else {
        onNotice(`Payment of ${money(res.amount)} recorded`);
      }
      setAmount("");
      setReference("");
      void refreshPayments();
    } catch (err) {
      onNotice(err instanceof Error && err.message ? err.message : "Could not record the payment");
    } finally {
      setRecording(false);
    }
  }

  async function onConfirmPasa() {
    if (!pasa || !pasa.checkoutRequestID) return;
    try {
      const res = await recordPaymentCallback(pasa.checkoutRequestID, { resultCode: 0 });
      if (!res) return onNotice("Pasa confirmation failed");
      onNotice("Payment credited — order is PAID");
      void refreshPayments();
      setPasa(null);
    } catch (err) {
      onNotice(err instanceof Error && err.message ? err.message : "Pasa confirmation failed");
    }
  }

  // ---- expenses -----------------------------------------------------------
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseMethod, setExpenseMethod] = useState<string>("Cash");
  const [expenseReference, setExpenseReference] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseRecordedBy, setExpenseRecordedBy] = useState(user?.displayName || user?.username || "admin");
  const [expenseId, setExpenseId] = useState("");
  const [editing, setEditing] = useState<ServerExpense | null>(null);
  const [saving, setSaving] = useState(false);

  const refreshExpenses = useCallback(async () => {
    const [e, c] = await Promise.all([listExpenses(), listExpenseCategories()]);
    setExpenses(e);
    // Ensure "Production costs" is always available as a category. It must
    // exist server-side: expense rows FK-reference expense_categories, so a
    // locally invented id would fail the insert (created once, then stable).
    let list = c;
    if (!list.some((cat) => cat.name === "Production costs")) {
      const created = await createExpenseCategory("Production costs");
      if (created) list = [...list, created];
    }
    setCategories(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void refreshExpenses(); }, [refreshExpenses]);
  useLiveRefresh(refreshExpenses);

  useEffect(() => {
    if (activeTab === "Invoices") {
      void listInvoices().then(setInvoices);
    }
    if (activeTab === "Approvals") {
      void listFinanceApprovals().then(setApprovals);
    }
  }, [activeTab]);

  function resetExpenseForm() {
    setEditing(null);
    setExpenseId("");
    setExpenseAmount("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setExpenseMethod("Cash");
    setExpenseReference("");
    setExpenseDescription("");
    setExpenseCategory("");
    setExpenseRecordedBy(user?.displayName || user?.username || "admin");
    setSaving(false);
  }

  function openCreate() {
    setEditing(null);
    setExpenseId("");
    setExpenseAmount("");
    setExpenseCategory(categories[0]?.id ?? "");
    onNotice("Recording a new expense");
    setExpFormOpen(true);
  }

  function openEdit(expense: ServerExpense) {
    setEditing(expense);
    setExpenseId(expense.id);
    setExpenseAmount(String(expense.amount));
    setExpenseDate(new Date(expense.date).toISOString().slice(0, 10));
    setExpenseMethod(expense.paymentMethod);
    setExpenseReference(expense.reference);
    setExpenseDescription(expense.description || "");
    setExpenseCategory(expense.categoryId);
    setExpenseRecordedBy(expense.recordedBy || user?.displayName || user?.username || "admin");
    setExpFormOpen(true);
  }

  async function onSave() {
    if (!expenseAmount || !expenseCategory) return onNotice("Enter an amount and a category");
    setSaving(true);
    const payload = {
      categoryId: expenseCategory,
      amount: Number(expenseAmount),
      date: expenseDate,
      paymentMethod: expenseMethod as ServerExpense["paymentMethod"],
      ...(expenseReference ? { reference: expenseReference } : {}),
      ...(expenseDescription ? { description: expenseDescription } : {}),
      ...(expenseRecordedBy ? { recordedBy: expenseRecordedBy } : {}),
    };
    const isUpdate = Boolean(expenseId);
    const res = isUpdate ? await updateExpense(expenseId, payload) : await createExpense(payload);
    if (!res) return onNotice("Could not record the expense");
    setExpenses((p) => (isUpdate ? p.map((x) => (x.id === res.id ? res : x)) : [res, ...p]));
    onNotice(isUpdate ? "Expense updated" : "Expense recorded");
    resetExpenseForm();
    setExpFormOpen(false);
    void refreshExpenses();
  }

  async function onDeleteExpense(id: string) {
    if (!window.confirm("Delete this expense?")) return;
    const res = await deleteExpense(id);
    if (!res) return onNotice("Could not delete the expense");
    setExpenses((p) => p.filter((x) => x.id !== id));
    onNotice("Expense deleted");
  }

  // ---- reports ------------------------------------------------------------
  const [period, setPeriod] = useState("month");

  // Fresh search/filter on every tab switch so a hidden filter never "eats" rows.
  useEffect(() => {
    setFilters({ search: "", method: "All methods", range: "thisMonth", from: null, to: null });
    setExpCategory("All categories");
  }, [activeTab]);

  useEffect(() => {
    let keep = true;
    async function load() {
      setReportsLoading(true);
      const data = await listFinanceReports(period);
      if (keep) setReports(data);
      setReportsLoading(false);
    }
    load();
    return () => { keep = false; };
  }, [period]);

  const clearFilters = useCallback(() => {
    setFilters({ search: "", method: "All methods", range: "thisMonth", from: null, to: null });
  }, [setFilters]);
  const kpis = reports ? [
    { label: "Cash at period end", value: money(reports.cashMovement) },
    { label: "Outstanding payments", value: money(reports.outstandingPayments) },
    { label: "Gross profit", value: money(reports.grossProfit) },
    { label: "Net operating result", value: money(reports.netOperatingResult) },
  ] : [];


  // ---- table rows (sorted via the shared DataTable contract) ---------------
  const sortedPayments = applySort(payments, paySort, {
    order: (p) => p.orderId,
    amount: (p) => p.amount,
    method: (p) => p.method,
    reference: (p) => p.reference,
    date: (p) => new Date(p.createdAt).getTime(),
  });
  const sortedStatusOrders = applySort(statusOrders, statusSort, {
    order: (o) => o.id,
    customer: (o) => o.customer,
    amount: (o) => o.amount,
  });
  const sortedExpenses = applySort(expenses, expSort, {
    date: (e) => new Date(e.date).getTime(),
    category: (e) => categories.find((c) => c.id === e.categoryId)?.name ?? e.categoryId,
    method: (e) => e.paymentMethod,
    amount: (e) => e.amount,
  });
  // Record searches/filters (Sales & Orders layout: search box + filter select).
  // No "Received by" anywhere: the payments table and its search no longer
  // expose who made or saw a payment.
  const q = filters.search.trim().toLowerCase();
  const eq = expSearch.trim().toLowerCase();
  const filteredPayments = useMemo(() => {
    return sortedPayments.filter((p) => {
      if (filters.method !== "All methods" && p.method !== filters.method) return false;
      const d = new Date(p.createdAt);
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      if (filters.range === "today" && !(d.getFullYear() === y && d.getMonth() === m && d.getDate() === now.getDate())) return false;
      if (filters.range === "thisWeek") {
        const day = now.getDay();
        const diff = (day + 6) % 7; // Monday start
        const start = new Date(y, m, now.getDate() - diff);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        if (d < start || d >= end) return false;
      }
      if (filters.range === "thisMonth") {
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 1);
        if (d < start || d >= end) return false;
      }
      if (q && !`${p.orderId} ${p.reference} ${p.method}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sortedPayments, filters, q]);
  const filteredTotal = useMemo(() => filteredPayments.reduce((sum, p) => sum + p.amount, 0), [filteredPayments]);

  const filteredStatusOrders = showAllOrders
    ? sortedStatusOrders
    : sortedStatusOrders.filter((o) => o.payment !== "Paid");
  // Methods offered as chips: the two primary ones first, then anything else
  // actually present in the data (Card, Bank transfer, …) behind "More".
  const paymentMethodOptions = useMemo(() => {
    const present = [...new Set(payments.map((p) => p.method).filter(Boolean))];
    const primary = PAY_METHODS.filter((m) => present.includes(m));
    const rest = present.filter((m) => !primary.includes(m as PayMethod)).sort();
    return [...primary, ...rest];
  }, [payments]);
  const activeFilterCount = [
    filters.search.trim() !== "",
    filters.method !== "All methods",
    filters.range !== "thisMonth",
  ].filter(Boolean).length;
  const paymentsEmpty = payments.length > 0 && filteredPayments.length === 0;
  const filteredExpenses = sortedExpenses
    .filter((e) => expCategory === "All categories" || (categories.find((c) => c.id === e.categoryId)?.name ?? e.categoryId) === expCategory)
    .filter((e) => !eq || `${categories.find((c) => c.id === e.categoryId)?.name ?? ""} ${e.description} ${e.reference} ${e.recordedBy} ${e.paymentMethod}`.toLowerCase().includes(eq));
  const reportLines: { label: string; value: string; bold: boolean }[] = reports ? [
        { label: "Revenue (subtotal + tax + delivery)", value: money(reports.revenue), bold: false },
        { label: "Payments received", value: money(reports.paymentsReceived), bold: false },
        { label: "Outstanding payments", value: money(reports.outstandingPayments), bold: false },
        { label: "Direct costs (expenses)", value: money(reports.directCosts), bold: false },
        { label: "Gross profit", value: money(reports.grossProfit), bold: true },
        { label: "Net operating result", value: money(reports.netOperatingResult), bold: false },
        { label: "Cash movement", value: money(reports.cashMovement), bold: false },
      ]
    : [];

  return (
    <div className="finance-view">
      {activeTab === "Payments" && (
        <section className="panel module-table">
          <div className="panel-heading"><div><h2>Payments <span className="inline-count">{payments.length}</span></h2><p>Record and review payments against orders.</p></div></div>
          {processingOrders.length > 0 && (
            <div className="payments-processing tone-violet" role="status">
              <Clock3 size={16} />
              <div>
                <strong>{processingOrders.length} order payment{processingOrders.length === 1 ? "" : "s"} processing</strong>
                <span>{processingOrders.map((o) => o.id).join(", ")} — funds are being confirmed; they clear to Paid once received.</span>
              </div>
            </div>
          )}
          {isMobile ? (
            <div className="filter-bar filter-bar--mobile">
              <div className="filter-search">
                <Search size={16} />
                <input
                  aria-label="Search payments"
                  value={filters.search}
                  onChange={(e) => setFilters({ search: e.target.value })}
                  placeholder="Search payments…"
                />
                {filters.search && (
                  <button type="button" aria-label="Clear search" className="filter-search-clear" onClick={() => setFilters({ search: "" })}>×</button>
                )}
              </div>
              <Button variant="secondary" size="sm" className="pay-filter-trigger" onClick={() => setFiltersSheetOpen(true)}>
                <SlidersHorizontal size={16} /> Filters
                {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
              </Button>
              <p className="filter-summary" aria-live="polite">
                {filteredPayments.length} payment{filteredPayments.length === 1 ? "" : "s"} · {money(filteredTotal)} collected
              </p>
            </div>
          ) : (
            <PaymentFilterBar
              filters={filters}
              setFilters={setFilters}
              methods={paymentMethodOptions}
              summary={{ count: filteredPayments.length, total: money(filteredTotal) }}
              onClear={clearFilters}
            />
          )}
          <Dialog open={filtersSheetOpen} onOpenChange={setFiltersSheetOpen}>
            <DialogContent className="filters-sheet">
              <DialogTitle>Filter payments</DialogTitle>
              <DialogDescription>Narrow the payments table by date and method.</DialogDescription>
              <div className="filters-sheet-body">
                <fieldset className="filters-sheet-group">
                  <legend>Date</legend>
                  <div className="filter-chips">
                    {(Object.keys(RANGE_LABELS) as DateRange[]).map((key) => (
                      <button key={key} type="button" className={`filter-chip${filters.range === key ? " filter-chip--active" : ""}`} aria-pressed={filters.range === key} onClick={() => setFilters({ range: key })}>{RANGE_LABELS[key]}</button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="filters-sheet-group">
                  <legend>Method</legend>
                  <div className="filter-chips">
                    <button type="button" className={`filter-chip${filters.method === "All methods" ? " filter-chip--active" : ""}`} aria-pressed={filters.method === "All methods"} onClick={() => setFilters({ method: "All methods" })}>All</button>
                    {paymentMethodOptions.map((m) => (
                      <button key={m} type="button" className={`filter-chip${filters.method === m ? " filter-chip--active" : ""}`} aria-pressed={filters.method === m} onClick={() => setFilters({ method: m })}>{m}</button>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div className="dialog-actions">
                <Button variant="ghost" onClick={clearFilters}>Clear all</Button>
                <Button variant="secondary" onClick={() => setFiltersSheetOpen(false)}>Show {filteredPayments.length} payment{filteredPayments.length === 1 ? "" : "s"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <div className="pay-card pay-record">
            <div className="pay-card-head">
              <h3>New payment</h3>
              <Button className="pay-record-cta" variant="secondary" onClick={() => setPayFormOpen(true)}><Plus size={16}/> Record payment</Button>
            </div>
            {!isMobile && (
              <div className="pay-record-form">
                <div className="form-field"><Label htmlFor="pay-order">Order</Label><select id="pay-order" className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)}><option value="">Select order…</option>{orders.map((o) => (o.payment === "Paid" ? <option key={o.id} value={o.id} disabled>{o.id} · {o.customer} · {o.product} · PAID</option> : <option key={o.id} value={o.id}>{o.id} · {o.customer} · {o.product} · Balance {money(o.amount)}</option>))}</select></div>
                <div className="form-field"><Label htmlFor="pay-amount">Amount (USh)</Label><Input id="pay-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Balance" /></div>
                <div className="form-field"><Label htmlFor="pay-method">Method</Label><select id="pay-method" className="input" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
                <div className="form-field"><Label htmlFor="pay-ref">Reference (optional)</Label><Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
              </div>
            )}
          </div>
          <Dialog open={payFormOpen} onOpenChange={setPayFormOpen}>
            <DialogContent className="max-w-lg">
              <DialogTitle>Record payment</DialogTitle>
              <DialogDescription>Record a payment against an order.</DialogDescription>
              <div className="space-y-3">
                <div className="form-field"><Label htmlFor="m-pay-order">Order</Label><select id="m-pay-order" className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)}><option value="">Select order…</option>{orders.map((o) => (o.payment === "Paid" ? <option key={o.id} value={o.id} disabled>{o.id} · {o.customer} · {o.product} · PAID</option> : <option key={o.id} value={o.id}>{o.id} · {o.customer} · {o.product} · Balance {money(o.amount)}</option>))}</select></div>
                <div className="form-field"><Label htmlFor="m-pay-amount">Amount (USh)</Label><Input id="m-pay-amount" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Balance" /></div>
                <div className="form-field"><Label htmlFor="m-pay-method">Method</Label><select id="m-pay-method" className="input" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
                <div className="form-field"><Label htmlFor="m-pay-ref">Reference (optional)</Label><Input id="m-pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
              </div>
              <div className="dialog-actions">
                <Button variant="ghost" onClick={() => setPayFormOpen(false)}>Cancel</Button>
                <Button variant="secondary" onClick={async () => { await onRecordPayment(); if (method !== "M-Pesa") setPayFormOpen(false); }} disabled={recording || !orderId || !amount}>{recording ? "Recording…" : "Record payment"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          {pasa && (
            <div className="form-note-wrap" style={{ marginTop: 16 }}>
              <div className="panel-heading"><div><h2>M-Pesa — confirm payment</h2><p className="text-muted-foreground text-xs">Staged by Safaricom. Confirm to credit the order.</p></div></div>
              <div className="form-field"><Label htmlFor="pasa-ref">Reference</Label><Input id="pasa-ref" value={pasa.reference} readOnly /></div>
              <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setPasa(null)}>Cancel</Button><Button onClick={() => onConfirmPasa()}><Check size={16}/>Confirm</Button></div>
            </div>
          )}

          <DataTable
            columns={[
              { header: "Order", sortKey: "order", mobile: "title", cell: (p) => <strong className="product-name">{p.orderId}</strong> },
              { header: "Amount", align: "right", sortKey: "amount", mobile: "value", cell: (p) => <span className="amount-cell">{money(p.amount)}</span> },
              { header: "Method", sortKey: "method", mobile: "meta", cell: (p) => p.method },
              { header: "Reference", sortKey: "reference", mobile: "drawer", cell: (p) => p.reference || "—" },
              { header: "Date", sortKey: "date", mobile: "meta", cell: (p) => <span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("en-UG")}</span> },
            ]}
            rows={filteredPayments}
            rowKey={(p) => p.id}
            sort={paySort}
            onSortChange={setPaySort}
            stickyHeader
            density={density}
            mobileTitle={(p) => p.orderId} mobileSubtitle={(p) => `${p.method} · ${new Date(p.createdAt).toLocaleDateString("en-UG")}`} openLabel="View payment"
            empty={paymentsEmpty ? (
              <div className="empty-state">
                <h3>No payments match these filters</h3>
                <p>Try another date range or method.</p>
                <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
              </div>
            ) : (
              <div className="empty-state"><Search /><h3>No payments yet</h3><p>Record a payment against an order.</p></div>
            )}
          />
          <div className="table-foot"><span>{filteredPayments.length} payment{filteredPayments.length === 1 ? "" : "s"}</span><span>{payments.length} recorded in total</span></div>

          <h3 className="text-sm font-semibold" style={{ marginTop: 20 }}>Order payment status</h3>
          <DataTable
            columns={[
              { header: "Order", sortKey: "order", mobile: "title", cell: (o) => <strong className="product-name">#{o.id}</strong> },
              { header: "Customer", sortKey: "customer", mobile: "meta", cell: (o) => o.customer },
              { header: "Product", mobile: "drawer", cell: (o) => o.product },
              { header: "Total", align: "right", sortKey: "amount", mobile: "value", cell: (o) => <span className="amount-cell">{money(o.amount)}</span> },
              { header: "Payment status", mobile: "badge", cell: (o) => <Status value={o.payment} /> },
            ]}
            rows={filteredStatusOrders}
            rowKey={(o) => o.id}
            rowClassName={(o) => `order-row-tint tone-${orderStageTone(o.payment)}`}
            sort={statusSort}
            onSortChange={setStatusSort}
            stickyHeader
            density={density}
            mobileTitle={(o) => `#${o.id}`} mobileSubtitle={(o) => o.customer} openLabel="View order"
            empty={<div className="empty-state"><Check /><h3>All order payments are settled</h3><p>Every order in the workspace is fully paid.</p></div>}
          />
          <div className="table-foot"><span>{filteredStatusOrders.length} order{filteredStatusOrders.length === 1 ? "" : "s"} awaiting settlement</span></div>
        </section>
      )}


      {activeTab === "Expenses" && (
        <section className="panel module-table">
          <div className="panel-heading"><div><h2>Expenses <span className="inline-count">{expenses.length}</span></h2><p>Record business expenses with categories.</p></div></div>
          {isMobile ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={openCreate}><Plus size={16}/>New expense</Button>
            </div>
          ) : (
            <>
              <div className="form-grid">
                <div className="form-field"><Label htmlFor="exp-amount">Amount (USh)</Label><Input id="exp-amount" type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="25000" /></div>
                <div className="form-field"><Label htmlFor="exp-category">Category</Label><select id="exp-category" className="input" value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="form-field"><Label htmlFor="exp-date">Date</Label><Input id="exp-date" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} /></div>
                <div className="form-field"><Label htmlFor="exp-method">Payment method</Label><select id="exp-method" className="input" value={expenseMethod} onChange={(e) => setExpenseMethod(e.target.value)}><option>Cash</option><option>M-Pesa</option><option>Card</option><option>Bank transfer</option></select></div>
                <div className="form-field"><Label htmlFor="exp-ref">Reference</Label><Input id="exp-ref" value={expenseReference} onChange={(e) => setExpenseReference(e.target.value)} /></div>
                <div className="form-field"><Label htmlFor="exp-desc">Description</Label><Input id="exp-desc" value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} /></div>
              </div>
              <div className="flex justify-end gap-2">
                {editing
                  ? <Button variant="secondary" onClick={onSave} disabled={saving}><Check size={16}/>{saving ? "Saving…" : "Save"}</Button>
                  : <Button variant="secondary" onClick={openCreate}><Plus size={16}/>New expense</Button>}
              </div>
            </>
          )}
          <Dialog open={expFormOpen} onOpenChange={(v) => { setExpFormOpen(v); if (!v) { setEditing(null); resetExpenseForm(); } }}>
            <DialogContent className="max-w-lg">
              <DialogTitle>{editing ? "Edit expense" : "New expense"}</DialogTitle>              <DialogDescription>Record business expenses with categories.</DialogDescription>
              <div className="space-y-3">
                <div className="form-field"><Label htmlFor="m-exp-amount">Amount (USh)</Label><Input id="m-exp-amount" type="number" inputMode="numeric" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="25000" /></div>
                <div className="form-field"><Label htmlFor="m-exp-category">Category</Label><select id="m-exp-category" className="input" value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="form-field"><Label htmlFor="m-exp-date">Date</Label><Input id="m-exp-date" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} /></div>
                <div className="form-field"><Label htmlFor="m-exp-method">Payment method</Label><select id="m-exp-method" className="input" value={expenseMethod} onChange={(e) => setExpenseMethod(e.target.value)}><option>Cash</option><option>M-Pesa</option><option>Card</option><option>Bank transfer</option></select></div>
                <div className="form-field"><Label htmlFor="m-exp-ref">Reference</Label><Input id="m-exp-ref" value={expenseReference} onChange={(e) => setExpenseReference(e.target.value)} /></div>
                <div className="form-field"><Label htmlFor="m-exp-desc">Description</Label><Input id="m-exp-desc" value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} /></div>
              </div>
              <div className="dialog-actions">
                <Button variant="ghost" onClick={() => { setExpFormOpen(false); setEditing(null); resetExpenseForm(); }}>Cancel</Button>
                <Button variant="secondary" onClick={onSave} disabled={saving}><Check size={16}/>{saving ? "Saving…" : (editing ? "Save" : "Create expense")}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label="Search expenses" value={expSearch} onChange={(e) => setExpSearch(e.target.value)} placeholder="Search expenses, categories…"/></label><label className="filter-select"><SlidersHorizontal size={14}/><select aria-label="Filter expenses by category" value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>{["All categories", ...categories.map((c) => c.name)].map((c) => <option key={c}>{c}</option>)}</select></label></div>
          <DataTable
            columns={[
              { header: "Date", sortKey: "date", mobile: "meta", cell: (e) => new Date(e.date).toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" }) },
              { header: "Category", sortKey: "category", mobile: "title", cell: (e) => categories.find((c) => c.id === e.categoryId)?.name || e.categoryId },
              { header: "Method", sortKey: "method", mobile: "drawer", cell: (e) => e.paymentMethod },
              { header: "Amount", align: "right", sortKey: "amount", mobile: "value", cell: (e) => <span className="amount-cell">{money(e.amount)}</span> },
              { header: "", mobile: "action", cell: (e) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" title={`Edit expense ${e.id}`} aria-label={`Edit expense ${e.id}`} onClick={() => openEdit(e)}><Pencil size={14}/></Button>
                  <Button variant="ghost" size="sm" title={`Delete expense ${e.id}`} aria-label={`Delete expense ${e.id}`} onClick={() => onDeleteExpense(e.id)}><Trash2 size={14}/></Button>
                </div>
              ) },
            ]}
            rows={filteredExpenses}
            rowKey={(e) => e.id}
            sort={expSort}
            onSortChange={setExpSort}
            stickyHeader
            density={density}
            mobileTitle={(e) => categories.find((c) => c.id === e.categoryId)?.name || e.categoryId} mobileSubtitle={(e) => new Date(e.date).toLocaleDateString("en-UG")} openLabel="View expense"
            empty={<div className="empty-state"><Plus /><h3>No expenses yet</h3><p>Record an expense to track direct costs.</p></div>}
          />
          <div className="table-foot"><span>{filteredExpenses.length} expense{filteredExpenses.length === 1 ? "" : "s"}</span><span>{expenses.length} recorded in total</span></div>
        </section>
      )}


      {activeTab === "Profitability" && (
        <section className="panel module-table">
          <div className="panel-heading"><div><h2>Profitability</h2><p>Revenue, costs and profit for the selected period.</p></div></div>
          <div className="form-grid">
            <div className="form-field"><Label htmlFor="period">Period</Label><select id="period" className="input" value={period} onChange={(e) => setPeriod(e.target.value)}><option>day</option><option>week</option><option>month</option><option>year</option></select></div>
          </div>
          {reportsLoading ? <p className="text-muted-foreground">Loading…</p> : kpis.length ? (
            <div className="kpi-grid">
              {kpis.map((k) => (
                <div key={k.label} className="kpi"><span className="kpi-label">{k.label}</span><strong className="kpi-value">{k.value}</strong></div>
              ))}
            </div>
          ) : null}
          {productionCosts > 0 && (
            <div className="kpi">
              <span className="kpi-label">Production costs</span>
              <strong className="kpi-value">{money(productionCosts)}</strong>
            </div>
          )}
          {reports && (
            <DataTable
              columns={[
                { header: "Line", mobile: "title", cell: (r) => (r.bold ? <strong>{r.label}</strong> : r.label) },
                { header: "Value (USh)", align: "right", mobile: "value", cell: (r) => (r.bold ? <strong>{r.value}</strong> : r.value) },
              ]}
              rows={reportLines}
              rowKey={(r) => r.label}
              stickyHeader
              density={density}
              mobileTitle={(r) => r.label} mobileSubtitle={() => "Report line"} openLabel="View line"
            />
          )}
          {reports && <div className="table-foot"><span>Report period: {period}</span></div>}
        </section>
      )}

      {activeTab === "Invoices" && (
        <section className="panel module-table">
          <div className="panel-heading"><div><h2>Invoices <span className="inline-count">{invoices.length}</span></h2><p>Issued invoices and credit notes.</p></div></div>
          <DataTable
            columns={[
              { header: "Invoice #", mobile: "title", cell: (i) => <strong className="product-name">{i.invoice_no || i.id}</strong> },
              { header: "Order", mobile: "meta", cell: (i) => i.order_id },
              { header: "Customer", mobile: "drawer", cell: (i) => i.customer_id },
              { header: "Status", mobile: "badge", cell: (i) => i.status },
              { header: "Total", align: "right", mobile: "value", cell: (i) => <span className="amount-cell">{money(i.total || 0)}</span> },
              { header: "Issue date", mobile: "meta", cell: (i) => i.issue_date || (i.created_at ? new Date(i.created_at).toLocaleDateString("en-UG") : "-") },
            ]}
            rows={invoices}
            rowKey={(i) => i.id}
            stickyHeader
            density={density}
            mobileTitle={(i) => i.invoice_no || i.id} mobileSubtitle={(i) => String(i.order_id || "")} openLabel="View invoice"
            empty={<div className="empty-state"><Plus /><h3>No invoices yet</h3><p>Invoices are created when orders are confirmed.</p></div>}
          />
        </section>
      )}

      {activeTab === "Approvals" && (
        <section className="panel module-table">
          <div className="panel-heading"><div><h2>Approvals <span className="inline-count">{approvals.length}</span></h2><p>Pending approvals for reversals, refunds and overrides.</p></div></div>
          <DataTable
            columns={[
              { header: "Kind", mobile: "title", cell: (a) => a.kind },
              { header: "Requested by", mobile: "meta", cell: (a) => a.requested_by },
              { header: "Status", mobile: "badge", cell: (a) => a.status },
              { header: "Created", mobile: "meta", cell: (a) => a.created_at ? new Date(a.created_at).toLocaleString("en-UG") : "-" },
            ]}
            rows={approvals}
            rowKey={(a) => a.id}
            stickyHeader
            density={density}
            mobileTitle={(a) => String(a.kind || "Approval")} mobileSubtitle={(a) => String(a.requested_by || "")} openLabel="View approval"
            empty={<div className="empty-state"><Check /><h3>No pending approvals</h3><p>All approval requests are up to date.</p></div>}
          />
        </section>
      )}

      {activeTab === "Cash-up" && (
        <section className="panel module-table">
          <div className="panel-heading"><div><h2>Cash-up</h2><p>Driver cash handovers and reconciliation.</p></div></div>
          <div className="form-grid">
            <div className="form-field"><Label>Driver ID</Label><Input placeholder="driver-1" id="cu-driver" /></div>
            <div className="form-field"><Label>Expected (USh)</Label><Input type="number" placeholder="0" id="cu-expected" /></div>
            <div className="form-field"><Label>Counted (USh)</Label><Input type="number" placeholder="0" id="cu-counted" /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={async () => {
            try {
              const driver_id = (document.getElementById('cu-driver') as HTMLInputElement)?.value;
              const expected = (document.getElementById('cu-expected') as HTMLInputElement)?.value;
              const counted = (document.getElementById('cu-counted') as HTMLInputElement)?.value;
              await request('/finance/cash-handovers', { method: 'POST', body: JSON.stringify({ driver_id, expected, counted }) });
              onNotice('Cash handover recorded');
            } catch { onNotice('Failed to record handover'); }
          }}>Confirm handover</Button></div>
        </section>
      )}

      {activeTab === "Period close" && (
        <section className="panel module-table">
          <div className="panel-heading"><div><h2>Period close</h2><p>Close accounting periods.</p></div></div>
          <div className="form-grid">
            <div className="form-field"><Label>Period (YYYY-MM)</Label><Input placeholder="2026-11" id="pc-period" /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={async () => {
            try {
              const period = (document.getElementById('pc-period') as HTMLInputElement)?.value;
              await request(`/finance/periods/${period}/close`, { method: 'POST' });
              onNotice('Period closed');
            } catch { onNotice('Failed to close period'); }
          }}>Close period</Button></div>
        </section>
      )}

      <Dialog open={reversalOpen} onOpenChange={(v) => { if (!v) setReversalOpen(false); }}>
        <DialogContent className="order-detail-dialog">
          <DialogTitle>Reverse / refund payment</DialogTitle>
          <DialogDescription>Record a reversal with reason and approval status.</DialogDescription>
          <div className="form-grid">
            <div style={{ gridColumn: "1 / -1" }}>
              <Label>Reason</Label>
              <Input value={reversalReason} onChange={(e) => setReversalReason(e.target.value)} placeholder="Reason for reversal" />
            </div>
          </div>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setReversalOpen(false)}>Cancel</Button>
            <Button onClick={() => { onNotice(reversalReason ? `Reversal requested: ${reversalReason}` : "Reversal requested"); setReversalOpen(false); setReversalReason(""); }}>Request reversal</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

