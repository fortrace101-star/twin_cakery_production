import { Router } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";
import type { Metrics } from "../database/types.js";

const router = Router();
const authService = new AuthService();

const required = (perm: string) => (req, res, next) => {
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

router.get("/dashboard", required("sales.analytics"), (req, res) => {
  const orders = store.orders();
  const customers = store.customers();
  const inquiries = store.inquiries();
  const quotations = store.quotations();
  const payments = store.payments();
  const expenses = store.db.expenses as import("../database/types.js").Expense[];
  const inventoryItems = store.inventoryItems();
  const jobs = store.productionJobs();
  const qualityChecks = store.qualityChecks();
  const feedback = store.db.customerFeedback as import("../database/types.js").CustomerFeedback[];

  const ordersToday = orders.filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString()).length;
  const ordersInProduction = orders.filter((o) => o.status === "IN_PRODUCTION").length;
  const ordersDueToday = orders.filter((o) => o.requiredAt && new Date(o.requiredAt).toDateString() === new Date().toDateString()).length;
  const pendingInquiries = inquiries.filter((i) => ["NEW", "ASSIGNED", "IN_PROGRESS"].includes(i.status)).length;
  const pendingQuotations = quotations.filter((q) => ["DRAFT", "SENT", "NEGOTIATION"].includes(q.status)).length;
  const outstandingPayments = payments.filter((p) => store.orders().find((o) => o.id === p.orderId)?.paymentStatus !== "PAID").reduce((s, p) => s + p.amount, 0);
  const lowStockItems = inventoryItems.filter((i) => (i.physicalStock || 0) <= (i.reorderLevel || 0)).length;
  const todayRevenue = orders.filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString()).reduce((s, o) => s + (o.total || 0), 0);
  const monthlyRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const directCosts = expenses.reduce((s, e) => s + e.amount, 0);
  const grossProfit = monthlyRevenue - directCosts;
  const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const netOperatingResult = grossProfit - expensesTotal;

  const revenueTrend = [12000, 18000, 15000, 22000, 20000, 28000, 25000, 30000, 27000, 35000, 32000, 40000];

  res.json({
    metrics: {
      todayOrders,
      ordersInProduction,
      ordersDueToday,
      pendingInquiries,
      pendingQuotations,
      outstandingPayments,
      lowStockItems,
      todayRevenue,
      monthlyRevenue,
      directCosts,
      grossProfit,
      expenses: expensesTotal,
      deliveryStatus: "Pending",
      recentFeedback: feedback.slice(0, 5).map((f) => f.comment).join("; "),
    } as Metrics,
    revenueTrend,
  } as unknown as import("../database/types.js").DashboardData);
});

export default router;
