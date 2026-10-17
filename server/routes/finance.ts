import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();
const authService = new AuthService();

const required = (perm: string): RequestHandler => (req, res, next) => {
  try {
    const session = authService.requireAuth(extractToken(req.headers.authorization as string | undefined));
    rbacService.requirePermission(session.userId, perm);
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

router.get("/expenses", required("finance.view"), (req, res) => {
  const expenses = store.db.expenses as import("../database/types.js").Expense[];
  const category = req.query.category as string | undefined;
  let list = expenses;
  if (category) list = list.filter((e) => e.categoryId === category);
  res.json(list);
});

router.post("/expenses", required("finance.record_expense"), (req, res) => {
  const { categoryId, amount, date, paymentMethod, reference, description, attachment, recordedBy } = req.body || {};
  if (!categoryId || amount === undefined) return res.status(400).json({ error: "categoryId and amount are required" });
  const expense = store.createExpense({ categoryId, amount, date: date || new Date().toISOString(), paymentMethod: paymentMethod || "Cash", reference: reference || "", description: description || "", attachment: attachment || null, recordedBy: recordedBy || "admin" });
  store.persist();
  res.status(201).json(expense);
});

router.get("/expense-categories", required("finance.view"), (req, res) => {
  res.json(store.db.expenseCategories as import("../database/types.js").ExpenseCategory[]);
});

router.get("/reports", required("finance.view_reports"), (req, res) => {
  const period = (req.query.period as "day" | "week" | "month" | "year") || "month";
  const orders = store.orders();
  const payments = store.payments();
  const expenses = store.db.expenses as import("../database/types.js").Expense[];
  const now = new Date();
  let revenue = 0;
  let paymentsReceived = 0;
  let directCosts = 0;
  let expenseAmount = 0;
  for (const o of orders) {
    const orderDate = new Date(o.createdAt);
    if (period === "day" && orderDate.getDate() !== now.getDate()) continue;
    if (period === "week" && orderDate.getTime() < now.getTime() - 7 * 86400000) continue;
    if (period === "year" && orderDate.getFullYear() !== now.getFullYear()) continue;
    const subtotal = o.subtotal || 0;
    const tax = o.taxAmount || 0;
    const deliveryCharge = o.deliveryCharge || 0;
    revenue += subtotal + tax + deliveryCharge;
    const paid = payments.filter((p) => p.orderId === o.id).reduce((s, p) => s + p.amount, 0);
    paymentsReceived += paid;
  }
  for (const e of expenses) {
    const expenseDate = new Date(e.date);
    if (period === "day" && expenseDate.getDate() !== now.getDate()) continue;
    if (period === "week" && expenseDate.getTime() < now.getTime() - 7 * 86400000) continue;
    if (period === "year" && expenseDate.getFullYear() !== now.getFullYear()) continue;
    expenseAmount += e.amount;
  }
  directCosts = expenseAmount;
  const grossProfit = revenue - directCosts;
  const netOperatingResult = grossProfit - expenseAmount;
  const outstandingPayments = payments.filter((p) => p.orderId && store.orders().find((o) => o.id === p.orderId)?.paymentStatus !== "PAID").reduce((s, p) => s + p.amount, 0);
  res.json({ period, revenue, paymentsReceived, outstandingPayments, directCosts, expenses: expenseAmount, grossProfit, netOperatingResult, cashMovement: paymentsReceived - expenseAmount });
});

export default router;
