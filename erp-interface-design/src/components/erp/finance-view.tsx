import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useWorkspace } from "./store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "./data";
import { StatusBadge as Status } from "../data-table/StatusBadge";
import { orderStageTone } from "@/lib/theme-tokens";
import { DataTable, type SortState } from "@/components/data-table/DataTable";
import {
  listPayments,
  recordPayment,
  recordPaymentCallback,
  listExpenses,
  listExpenseCategories,
  createExpense,
  updateExpense,
  deleteExpense,
  listFinanceReports,
} from "@/lib/api";
import type { ServerExpense, ServerExpenseCategory, ServerPayment, FinanceReport } from "@/lib/api";

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

export function FinanceView({ onNotice }: { onNotice: (s: string) => void }) {
  const { user, orders } = useWorkspace();
  // Order payments recorded as "Processing" on the order modal are surfaced here;
  // every unsettled order is also listed with its payment status below.
  const processingOrders = orders.filter((o) => o.payment === "Processing");
  const outstandingOrders = orders.filter((o) => o.payment !== "Paid");
  const [tab, setTab] = useState("Payments");
  // One sort state per table so the Finance tables sort independently.
  const [paySort, setPaySort] = useState<SortState>(null);
  const [statusSort, setStatusSort] = useState<SortState>(null);
  const [expSort, setExpSort] = useState<SortState>(null);
  const [payments, setPayments] = useState<ServerPayment[]>([]);
  const [expenses, setExpenses] = useState<ServerExpense[]>([]);
  const [categories, setCategories] = useState<ServerExpenseCategory[]>([]);
  const [reports, setReports] = useState<FinanceReport | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  // ---- payments -----------------------------------------------------------
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"Cash" | "M-Pesa">("Cash");
  const [receivedBy, setReceivedBy] = useState(user?.displayName || user?.username || "admin");
  const [reference, setReference] = useState("");
  const [recording, setRecording] = useState(false);
  const [pasa, setPasa] = useState<{ checkoutRequestID: string; reference: string } | null>(null);

  const refreshPayments = useCallback(async () => {
    const list = await listPayments();
    setPayments(list);
  }, []);

  useEffect(() => { void refreshPayments(); }, [refreshPayments]);

  async function onRecordPayment() {
    if (!orderId || !amount) return onNotice("Enter an order and an amount");
    setRecording(true);
    const res = await recordPayment({
      orderId,
      amount: Number(amount),
      method,
      ...(reference ? { reference } : {}),
      ...(receivedBy ? { receivedBy } : {}),
    });
    setRecording(false);
    if (!res) return onNotice("Could not record the payment — check your connection");
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
  }

  async function onConfirmPasa() {
    if (!pasa || !pasa.checkoutRequestID) return;
    const res = await recordPaymentCallback(pasa.checkoutRequestID, { resultCode: 0 });
    if (!res) return onNotice("Pasa confirmation failed");
    onNotice("Payment credited — order is PAID");
    void refreshPayments();
    setPasa(null);
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
    setCategories(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void refreshExpenses(); }, [refreshExpenses]);

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

  const kpis = reports ? [
    { label: "Revenue", value: money(reports.revenue) },
    { label: "Payments received", value: money(reports.paymentsReceived) },
    { label: "Outstanding payments", value: money(reports.outstandingPayments) },
    { label: "Direct costs (expenses)", value: money(reports.directCosts) },
    { label: "Gross profit", value: money(reports.grossProfit) },
    { label: "Net operating result", value: money(reports.netOperatingResult) },
    { label: "Cash movement", value: money(reports.cashMovement) },
  ] : [];

  // ---- table rows (sorted via the shared DataTable contract) ---------------
  const sortedPayments = applySort(payments, paySort, {
    order: (p) => p.orderId,
    amount: (p) => p.amount,
    method: (p) => p.method,
    reference: (p) => p.reference,
    date: (p) => new Date(p.createdAt).getTime(),
  });
  const sortedOutstanding = applySort(outstandingOrders, statusSort, {
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
  const reportLines: { label: string; value: string; bold: boolean }[] = reports
    ? [
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
    <div className="workspace">
      <div className="module-tabs">
        {["Payments", "Expenses", "Profitability", "Reports"].map((t) => (
          <Button key={t} variant={tab === t ? "default" : "secondary"} onClick={() => setTab(t)}>{t}</Button>
        ))}
      </div>

      {tab === "Payments" && (
        <section className="panel">
          <div className="panel-heading"><h2>Payments</h2><p>Record and review payments against orders.</p></div>
          {processingOrders.length > 0 && (
            <div className="payments-processing tone-violet" role="status">
              <Clock3 size={16} />
              <div>
                <strong>{processingOrders.length} order payment{processingOrders.length === 1 ? "" : "s"} processing</strong>
                <span>{processingOrders.map((o) => o.id).join(", ")} — funds are being confirmed; they clear to Paid once received.</span>
              </div>
            </div>
          )}
          <div className="form-grid">
            <div className="form-field"><Label htmlFor="pay-order">Order</Label><Input id="pay-order" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="TC-1044" /></div>
            <div className="form-field"><Label htmlFor="pay-amount">Amount (USh)</Label><Input id="pay-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" /></div>
            <div className="form-field"><Label htmlFor="pay-method">Method</Label><select id="pay-method" className="input" value={method} onChange={(e) => setMethod(e.target.value as "Cash" | "M-Pesa")}><option>Cash</option><option>M-Pesa</option></select></div>
            <div className="form-field"><Label htmlFor="pay-ref">Reference (optional)</Label><Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onRecordPayment} disabled={recording || !orderId || !amount}>{recording ? "Recording…" : "Record payment"}</Button></div>
          {pasa && (
            <div className="form-note-wrap" style={{ marginTop: 16 }}>
              <div className="panel-heading"><h2>M-Pesa — confirm payment</h2><p className="text-muted-foreground text-xs">Staged by Safaricom. Confirm to credit the order.</p></div>
              <div className="form-field"><Label htmlFor="pasa-ref">Reference</Label><Input id="pasa-ref" value={pasa.reference} readOnly /></div>
              <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setPasa(null)}>Cancel</Button><Button onClick={() => onConfirmPasa()}><Check size={16}/>Confirm</Button></div>
            </div>
          )}
          <DataTable
            columns={[
              { header: "Order", sortKey: "order", cell: (p) => <strong className="product-name">{p.orderId}</strong> },
              { header: "Amount", align: "right", sortKey: "amount", cell: (p) => <span className="amount-cell">{money(p.amount)}</span> },
              { header: "Method", sortKey: "method", cell: (p) => p.method },
              { header: "Reference", sortKey: "reference", cell: (p) => p.reference },
              { header: "Date", sortKey: "date", cell: (p) => <span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("en-UG")}</span> },
              { header: "Received by", cell: (p) => p.receivedBy },
            ]}
            rows={sortedPayments}
            rowKey={(p) => p.id}
            sort={paySort}
            onSortChange={setPaySort}
            stickyHeader
            empty={<div className="empty-state"><Search /><h3>No payments yet</h3><p>Record a payment against an order above.</p></div>}
            footer={<span>{payments.length} payment{payments.length === 1 ? "" : "s"}</span>}
          />

          <h3 className="text-sm font-semibold" style={{ marginTop: 20 }}>Order payment status</h3>
          <DataTable
            columns={[
              { header: "Order", sortKey: "order", cell: (o) => <strong className="product-name">#{o.id}</strong> },
              { header: "Customer", sortKey: "customer", cell: (o) => o.customer },
              { header: "Product", cell: (o) => o.product },
              { header: "Total", align: "right", sortKey: "amount", cell: (o) => <span className="amount-cell">{money(o.amount)}</span> },
              { header: "Payment status", cell: (o) => <Status value={o.payment} /> },
            ]}
            rows={sortedOutstanding}
            rowKey={(o) => o.id}
            rowClassName={(o) => `order-row-tint tone-${orderStageTone(o.payment)}`}
            sort={statusSort}
            onSortChange={setStatusSort}
            stickyHeader
            empty={<div className="empty-state"><Check /><h3>All order payments are settled</h3><p>Every order in the workspace is fully paid.</p></div>}
            footer={<span>{outstandingOrders.length} order{outstandingOrders.length === 1 ? "" : "s"} awaiting settlement</span>}
          />
        </section>
      )}


      {tab === "Expenses" && (
        <section className="panel">
          <div className="panel-heading"><h2>Expenses</h2><p>Record business expenses with categories.</p></div>
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
          <DataTable
            columns={[
              { header: "Date", sortKey: "date", cell: (e) => new Date(e.date).toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" }) },
              { header: "Category", sortKey: "category", cell: (e) => categories.find((c) => c.id === e.categoryId)?.name || e.categoryId },
              { header: "Method", sortKey: "method", cell: (e) => e.paymentMethod },
              { header: "Amount", align: "right", sortKey: "amount", cell: (e) => <span className="amount-cell">{money(e.amount)}</span> },
              { header: "Recorded by", cell: (e) => e.recordedBy },
              { header: "", cell: (e) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" title={`Edit expense ${e.id}`} aria-label={`Edit expense ${e.id}`} onClick={() => openEdit(e)}><Pencil size={14}/></Button>
                  <Button variant="ghost" size="icon" title={`Delete expense ${e.id}`} aria-label={`Delete expense ${e.id}`} onClick={() => onDeleteExpense(e.id)}><Trash2 size={14}/></Button>
                </div>
              ) },
            ]}
            rows={sortedExpenses}
            rowKey={(e) => e.id}
            sort={expSort}
            onSortChange={setExpSort}
            stickyHeader
            empty={<div className="empty-state"><Plus /><h3>No expenses yet</h3><p>Record an expense above to track direct costs.</p></div>}
            footer={<span>{expenses.length} expense{expenses.length === 1 ? "" : "s"}</span>}
          />
        </section>
      )}


      {tab === "Profitability" && (
        <section className="panel">
          <div className="panel-heading"><h2>Profitability</h2><p>Revenue, costs and profit for the selected period.</p></div>
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
          {reports && (
            <DataTable
              columns={[
                { header: "Line", cell: (r) => (r.bold ? <strong>{r.label}</strong> : r.label) },
                { header: "Value (USh)", align: "right", cell: (r) => (r.bold ? <strong>{r.value}</strong> : r.value) },
              ]}
              rows={reportLines}
              rowKey={(r) => r.label}
              footer={<span>Report period: {period}</span>}
            />
          )}
        </section>
      )}

      {tab === "Reports" && (
        <section className="panel">
          <div className="panel-heading"><h2>Financial reports</h2><p>Downloaded statements for the selected period.</p></div>
          <div className="form-grid">
            <div className="form-field"><Label htmlFor="rperiod">Period</Label><select id="rperiod" className="input" value={period} onChange={(e) => setPeriod(e.target.value)}><option>day</option><option>week</option><option>month</option><option>year</option></select></div>
          </div>
          <div className="table-foot"><span>{reportsLoading ? "…loading" : `${reports ? "Report ready" : ""}`}</span><span>October 2026</span></div>
        </section>
      )}
    </div>
  );
}

