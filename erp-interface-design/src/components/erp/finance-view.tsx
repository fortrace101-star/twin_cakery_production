import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useWorkspace } from "./store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "./data";
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

export function FinanceView({ onNotice }: { onNotice: (s: string) => void }) {
  const { user } = useWorkspace();
  const [tab, setTab] = useState("Payments");
  const [payments, setPayments] = useState<ServerPayment[]>([]);
  const [expenses, setExpenses] = useState<ServerExpense[]>([]);
  const [categories, setCategories] = useState<ServerExpenseCategory[]>([]);
  const [reports, setReports] = useState<FinanceReport | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [headings, setHeadings] = useState<string[]>([]);

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

  const EXPENSE_HEADINGS = ["Date", "Category", "Method", "Amount", "Recorded by", "Actions"];

  const refreshExpenses = useCallback(async () => {
    const [e, c] = await Promise.all([listExpenses(), listExpenseCategories()]);
    setExpenses(e);
    setCategories(c);
    setHeadings(EXPENSE_HEADINGS);
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
          <div className="table-wrap">
            <table className="table data">
              <thead><tr><th>Order</th><th>Amount</th><th>Method</th><th>Reference</th><th>Date</th><th>Received by</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.orderId}</td>
                    <td className="num">{money(p.amount)}</td>
                    <td>{p.method}</td>
                    <td>{p.reference}</td>
                    <td><span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("en-UG")}</span></td>
                    <td>{p.receivedBy}</td>
                  </tr>
                ))}
                {payments.length === 0 && <tr><td colSpan={6} className="empty">No payments yet</td></tr>}
              </tbody>
            </table>
          </div>
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
          <div className="table-wrap">
            <table className="table data">
              <thead><tr>{headings.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.date).toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" })}</td>
                    <td>{categories.find((c) => c.id === e.categoryId)?.name || e.categoryId}</td>
                    <td>{e.paymentMethod}</td>
                    <td className="num">{money(e.amount)}</td>
                    <td>{e.recordedBy}</td>
                    <td className="actions"><Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(e)}><Pencil size={14}/></Button><Button variant="ghost" size="icon" title="Delete" onClick={() => onDeleteExpense(e.id)}><Trash2 size={14}/></Button></td>
                  </tr>
                ))}
                {expenses.length === 0 && <tr><td colSpan={6} className="empty">No expenses yet</td></tr>}
              </tbody>
            </table>
          </div>
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
            <div className="table-wrap">
              <table className="table data">
                <thead><tr><th>Line</th><th>Value (USh)</th></tr></thead>
                <tbody>
                  <tr><td>Revenue (subtotal + tax + delivery)</td><td className="num">{money(reports.revenue)}</td></tr>
                  <tr><td>Payments received</td><td className="num">{money(reports.paymentsReceived)}</td></tr>
                  <tr><td>Outstanding payments</td><td className="num">{money(reports.outstandingPayments)}</td></tr>
                  <tr><td>Direct costs (expenses)</td><td className="num">{money(reports.directCosts)}</td></tr>
                  <tr><td><strong>Gross profit</strong></td><td className="num"><strong>{money(reports.grossProfit)}</strong></td></tr>
                  <tr><td>Net operating result</td><td className="num">{money(reports.netOperatingResult)}</td></tr>
                  <tr><td>Cash movement</td><td className="num">{money(reports.cashMovement)}</td></tr>
                </tbody>
              </table>
            </div>
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

