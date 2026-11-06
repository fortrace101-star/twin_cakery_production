import { Router, RequestHandler } from "express";
import { store } from "../database/store";
import { RbacService } from "../services/rbac.service";
import { AuthService, extractToken } from "../services/auth.service";
import { NotFoundError } from "../utils/errors";
import { paymentsService } from "../services/payments.service";

const router = Router();
const rbacService = new RbacService()
const authService = new AuthService();

const required = (perm: string): RequestHandler => async (req, res, next) => {
  try {
    const session = await authService.requireAuth(extractToken(req.headers.authorization as string | undefined));
    await rbacService.requirePermission(session.userId, perm);
    next();
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthorizedError") return res.status(401).json({ error: err.message });
    if (err instanceof Error && err.name === "ForbiddenError") return res.status(403).json({ error: err.message });
    next(err);
  }
};

router.get("/payments", required("payments.view"), async (req, res) => {
  const payments = store.payments();
  const orderId = req.query.orderId as string | undefined;
  let list = payments;
  if (orderId) list = list.filter((p) => p.orderId === orderId);
  res.json(list);
});

router.post("/payments", required("payments.record"), async (req, res, next) => {
  try {
    const { orderId, amount, method, reference, receivedBy, notes } = req.body || {};
    if (!orderId || amount === undefined) return res.status(400).json({ error: "orderId and amount are required" });
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt !== Math.round(amt) || amt <= 0) return res.status(400).json({ error: "amount must be a positive whole number (UGX)" });
    const key = (req.header("Idempotency-Key") as string | undefined) || (req.body?.idempotencyKey as string | undefined) || `fin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
    const actor = { userId: session?.userId || String(receivedBy || "admin") };
    const r = await paymentsService.recordPayment({
      orderId: String(orderId),
      amount: amt,
      method: (method || "Cash") as any,
      reference: reference || "",
      idempotencyKey: String(key),
      notes: notes || "",
    }, actor);
    res.status(r.replayed ? 200 : 201).json(r.payment);
  } catch (err) {
    next(err);
  }
});

// ── Profitability report (E4) ────────────────────────────────────────────
// NOTE: expense CRUD lives in routes/expenses.ts (mounted at /expenses +
// /expense-categories). This router is mounted at /finance and only serves
// the aggregated report — the frontend calls GET /finance/reports?period=…
// (see listFinanceReports in erp-interface-design/src/lib/api.ts).

router.get("/reports", required("finance.view_reports"), async (req, res) => {
  const period = (req.query.period as "day" | "week" | "month" | "year") || "month";
  const orders = store.orders();
  const payments = store.payments();
  const expenses = store.db.expenses as import("../database/types").Expense[];
  const productionCosts = store.productionCosts();
  const now = new Date();
  const inPeriod = (iso: string): boolean => {
    if (!iso) return false;
    const d = new Date(iso);
    if (period === "day") return d.toDateString() === now.toDateString();
    if (period === "week") return d.getTime() >= now.getTime() - 7 * 86400000;
    if (period === "year") return d.getFullYear() === now.getFullYear();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };
  let revenue = 0;
  let paymentsReceived = 0;
  let expenseAmount = 0;
  let directCosts = 0;
  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    // Accrual: revenue recognised at delivery/completion
    const revDate = (o as any).deliveredAt || (o.status === "COMPLETED_DELIVERED" ? o.updatedAt : undefined);
    if (revDate && inPeriod(revDate)) {
      revenue += Number((o.total ?? ((o.subtotal || 0) + (o.taxAmount || 0) + (o.deliveryCharge || 0) - (o.discount || 0))) || 0);
    } else if (!revDate && inPeriod(o.createdAt) && o.status !== "INQUIRY" && o.status !== "QUOTATION" && o.status !== "AWAITING_CONFIRMATION") {
      // Fallback for orders not yet delivered
      revenue += Number((o.total ?? ((o.subtotal || 0) + (o.taxAmount || 0) + (o.deliveryCharge || 0) - (o.discount || 0))) || 0);
    }
  }
  for (const p of payments) if (inPeriod(p.date)) paymentsReceived += p.amount || 0;
  for (const e of expenses) if (inPeriod(e.date)) expenseAmount += e.amount || 0;
  // Direct order costs (spec §13): production/ingredient cost recorded against
  // jobs. Operating expenses are the expenses ledger. Gross = revenue − direct;
  // Net = gross − operating. Previously expenses were counted twice.
  for (const c of productionCosts) if (inPeriod(c.createdAt)) directCosts += c.total || 0;
  // Outstanding balance (spec §14) is a snapshot across ALL open orders, not
  // filtered by period: order total minus everything paid against it.
  let outstandingPayments = 0;
  for (const o of orders) {
    if (o.status === "CANCELLED" || o.paymentStatus === "PAID" || o.paymentStatus === "REFUNDED") continue;
    const paid = payments.filter((p) => p.orderId === o.id).reduce((s, p) => s + (p.amount || 0), 0);
    outstandingPayments += Math.max(0, (o.total || 0) - paid);
  }
  const grossProfit = revenue - directCosts;
  const netOperatingResult = grossProfit - expenseAmount;
  res.json({ period, revenue, paymentsReceived, outstandingPayments, directCosts, expenses: expenseAmount, grossProfit, netOperatingResult, cashMovement: paymentsReceived - expenseAmount });
});

// Basic stubs for new finance features
router.get("/invoices", required("finance.manage_invoices"), async (req, res, next) => {
  try {
    const { pool } = await import("../database/db");
    const result = await pool.query("SELECT * FROM invoices ORDER BY created_at DESC");
    res.json(result.rows || []);
  } catch (e) {
    res.json([]);
  }
});

router.post("/invoices/:id/credit-note", required("finance.manage_invoices"), async (req, res, next) => {
  try {
    const { pool } = await import("../database/db");
    const { amount, reason } = req.body || {};
    if (!amount || !reason) return res.status(400).json({ error: "amount and reason required" });
    const invoiceId = req.params.id;
    const year = new Date().getFullYear();
    const cntRes = await pool.query(
      `INSERT INTO document_counters (kind, year, last_no) VALUES ('CN',$1,1)
       ON CONFLICT (kind, year) DO UPDATE SET last_no = document_counters.last_no + 1 RETURNING last_no`,
      [year],
    );
    const lastNo = (cntRes.rows || cntRes)[0]?.last_no || 1;
    const creditNo = `CN-${year}-${String(lastNo).padStart(5, "0")}`;
    const cnRes = await pool.query(
      `INSERT INTO credit_notes (id, credit_no, invoice_id, amount, reason, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
      [`cn-${Date.now()}`, creditNo, invoiceId, Number(amount), reason],
    );
    res.status(201).json((cnRes.rows || cnRes)[0]);
  } catch (e) {
    next(e);
  }
});

router.get("/approvals", required("finance.view_reports"), async (req, res) => {
  res.json([]);
});

router.post("/periods/:period/close", required("finance.close_period"), async (req, res, next) => {
  try {
    const { pool } = await import("../database/db");
    const period = req.params.period;
    await pool.query(`INSERT INTO accounting_periods (period, status) VALUES ($1,'CLOSED') ON CONFLICT (period) DO UPDATE SET status='CLOSED', closed_at=NOW()`, [period]);
    res.json({ ok: true, period, status: "CLOSED" });
  } catch (e) {
    next(e);
  }
});

router.get("/periods", required("finance.view_reports"), async (req, res) => {
  try {
    const { pool } = await import("../database/db");
    const result = await pool.query("SELECT * FROM accounting_periods ORDER BY period DESC");
    res.json(result.rows || []);
  } catch (e) {
    res.json([]);
  }
});

router.get("/cash-handovers", required("finance.confirm_handover"), async (req, res) => {
  try {
    const { pool } = await import("../database/db");
    const result = await pool.query("SELECT * FROM cash_handovers ORDER BY confirmed_at DESC");
    res.json(result.rows || []);
  } catch (e) {
    res.json([]);
  }
});

router.post("/cash-handovers", required("finance.confirm_handover"), async (req, res, next) => {
  try {
    const { pool } = await import("../database/db");
    const { driver_id, expected, counted, note } = req.body || {};
    const { AuthService, extractToken } = await import("../services/auth.service");
    const authService = new AuthService();
    const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
    const res2 = await pool.query(
      `INSERT INTO cash_handovers (id, driver_id, expected, counted, confirmed_by, note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [`ch-${Date.now()}`, driver_id, Number(expected||0), Number(counted||0), session?.userId || 'admin', note || ''],
    );
    res.status(201).json((res2.rows || res2)[0]);
  } catch (e) {
    next(e);
  }
});

router.get("/reconciliation", required("finance.reconcile"), async (req, res) => {
  try {
    const { pool } = await import("../database/db");
    const result = await pool.query("SELECT * FROM provider_statement_lines ORDER BY occurred_at DESC");
    res.json(result.rows || []);
  } catch (e) {
    res.json([]);
  }
});

router.get("/margin/:orderId", required("finance.view_margins"), async (req, res, next) => {
  try {
    const { costingService } = await import("../services/costing.service");
    const { store } = await import("../database/store");
    const order = store.orders().find((o: any) => o.id === req.params.orderId);
    const job = store.productionJobs().find((j: any) => j.orderId === req.params.orderId);
    const cost = job ? costingService.getJobCost(job.id) : { actualCost: 0 };
    const revenue = Number(order?.total || 0);
    const margin = revenue - Number(cost.actualCost || 0);
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    res.json({ orderId: req.params.orderId, revenue, actualCost: cost.actualCost, margin, marginPct });
  } catch (e) {
    next(e);
  }
});

router.get("/bills", required("purchasing.pay_bill"), async (req, res) => {
  try {
    const { pool } = await import("../database/db");
    const result = await pool.query("SELECT * FROM bills ORDER BY created_at DESC");
    res.json(result.rows || []);
  } catch (e) {
    res.json([]);
  }
});

router.get("/reports/pnl", required("finance.view_reports"), async (req, res) => {
  try {
    const { pool } = await import("../database/db");
    const { from, to } = req.query as any;
    const f = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
    const t = to || new Date().toISOString().slice(0,10);
    const result = await pool.query(
      `SELECT a.type, a.code, a.name,
              SUM(l.credit - l.debit) FILTER (WHERE a.type='REVENUE') AS revenue,
              SUM(l.debit - l.credit) FILTER (WHERE a.type IN ('COGS','EXPENSE')) AS cost
       FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id JOIN accounts a ON a.code=l.account_code
       WHERE e.entry_date >= $1 AND e.entry_date <= $2
       GROUP BY a.type, a.code, a.name ORDER BY a.code`,
      [f, t],
    );
    res.json({ range: { from: f, to: t }, rows: result.rows || [] });
  } catch (e) {
    res.json({ rows: [] });
  }
});

export default router;
