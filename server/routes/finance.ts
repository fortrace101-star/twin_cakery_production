import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();
const authService = new AuthService();

const required = (perm: string): RequestHandler => async (req, res, next) => {
  try {
    const session = authService.requireAuth(extractToken(req.headers.authorization as string | undefined));
    await rbacService.requirePermission(session.userId, perm);
    next();
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthorizedError") return res.status(401).json({ error: err.message });
    if (err instanceof Error && err.name === "ForbiddenError") return res.status(403).json({ error: err.message });
    next(err);
  }
};

router.get("/payments", required("payments.view"), (req, res) => {
  const payments = store.payments();
  const orderId = req.query.orderId as string | undefined;
  let list = payments;
  if (orderId) list = list.filter((p) => p.orderId === orderId);
  res.json(list);
});

router.post("/payments", required("payments.record"), (req, res) => {
  const { orderId, amount, method, reference, receivedBy, notes } = req.body || {};
  if (!orderId || amount === undefined) return res.status(400).json({ error: "orderId and amount are required" });
  const payment = store.paymentsReceived(orderId, amount, method || "Cash", reference || "", receivedBy || "admin");
  if (!payment) throw new NotFoundError("Order not found");
  store.persist();
  res.status(201).json(payment);
});

// ── Profitability report (E4) ────────────────────────────────────────────
// NOTE: expense CRUD lives in routes/expenses.ts (mounted at /expenses +
// /expense-categories). This router is mounted at /finance and only serves
// the aggregated report — the frontend calls GET /finance/reports?period=…
// (see listFinanceReports in erp-interface-design/src/lib/api.ts).

router.get("/reports", required("finance.view_reports"), (req, res) => {
  const period = (req.query.period as "day" | "week" | "month" | "year") || "month";
  const orders = store.orders();
  const payments = store.payments();
  const expenses = store.db.expenses as import("../database/types.js").Expense[];
  const productionCosts = store.productionCosts();
  const now = new Date();
  const inPeriod = (iso: string): boolean => {
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
    if (!inPeriod(o.createdAt)) continue;
    revenue += (o.subtotal || 0) + (o.taxAmount || 0) + (o.deliveryCharge || 0) - (o.discount || 0);
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

export default router;
