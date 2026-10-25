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

router.get("/dashboard", required("sales.analytics"), (_req, res) => {
  const orders = store.orders();
  const inquiries = store.inquiries();
  const quotations = store.quotations();
  const payments = store.payments();
  const expenses = store.db.expenses as import("../database/types.js").Expense[];
  const productionCosts = store.productionCosts();
  const inventoryItems = store.inventoryItems();
  const jobs = store.productionJobs();
  const deliveries = store.deliveries();
  const feedback = store.db.customerFeedback as import("../database/types.js").CustomerFeedback[];

  const isToday = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
  const ordersToday = orders.filter((o) => isToday(o.createdAt)).length;
  const ordersInProduction = orders.filter((o) => o.status === "IN_PRODUCTION").length;
  const ordersDueToday = orders.filter((o) => isToday(o.requiredAt)).length;
  const pendingInquiries = inquiries.filter((i) => ["NEW", "ASSIGNED", "IN_PROGRESS"].includes(i.status)).length;
  const pendingQuotations = quotations.filter((q) => ["DRAFT", "SENT", "NEGOTIATION"].includes(q.status)).length;
  // Outstanding balance (spec §14): order total minus payments, over open orders.
  let outstandingPayments = 0;
  for (const o of orders) {
    if (o.status === "CANCELLED" || o.paymentStatus === "PAID" || o.paymentStatus === "REFUNDED") continue;
    const paid = payments.filter((p) => p.orderId === o.id).reduce((s, p) => s + (p.amount || 0), 0);
    outstandingPayments += Math.max(0, (o.total || 0) - paid);
  }
  const lowStockItems = inventoryItems.filter((i) => (i.physicalStock || 0) <= (i.reorderLevel || 0)).length;
  const todayRevenue = orders.filter((o) => isToday(o.createdAt) && o.status !== "CANCELLED").reduce((s, o) => s + (o.total || 0), 0);
  const now = new Date();
  const monthlyRevenue = orders.filter((o) => {
    const d = new Date(o.createdAt);
    return o.status !== "CANCELLED" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, o) => s + (o.total || 0), 0);
  // Spec §13 profitability: direct costs = production costs; operating = expenses.
  const directCosts = productionCosts.reduce((s, c) => s + (c.total || 0), 0);
  const expensesTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const grossProfit = monthlyRevenue - directCosts;
  const activeDeliveries = deliveries.filter((d) => d.status !== "COMPLETED_DELIVERED" && d.status !== "FAILED");
  const deliveryStatus = activeDeliveries.length === 0
    ? "All delivered"
    : `${activeDeliveries.length} active · ${activeDeliveries.filter((d) => d.status === "IN_TRANSIT").length} in transit`;

  // Real 12-month revenue trend from the orders ledger (spec §18/§19: analytics
  // answer "how much did we make" from data, not a static array). Buckets run
  // oldest → current; each is that calendar month's won-order totals.
  const revenueTrend: number[] = [];
  const trendLabels: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const bucket = orders.filter((o) => {
      if (o.status === "CANCELLED") return false;
      const od = new Date(o.createdAt);
      return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
    }).reduce((s, o) => s + (o.total || 0), 0);
    revenueTrend.push(bucket);
    trendLabels.push(d.toLocaleString("en-UG", { month: "short", year: "2-digit" }));
  }
  // Paired expense trend so the revenue chart can render both series honestly
  // instead of the old hard-coded 42% expense bars (E4 remainder).
  const expensesTrend: number[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const bucket = expenses.filter((e) => {
      const ed = new Date(e.createdAt || "");
      return !isNaN(ed.getTime()) && ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
    }).reduce((s, e) => s + (e.amount || 0), 0);
    expensesTrend.push(bucket);
  }

  const orderStatusBreakdown: Record<string, number> = {};
  for (const o of orders) orderStatusBreakdown[o.status] = (orderStatusBreakdown[o.status] || 0) + 1;

  const reservations = store.stockReservations();
  const productionSummary = jobs.slice(0, 10).map((j) => ({
    jobId: j.id,
    orderId: j.orderId,
    customerId: j.customerId,
    productId: j.productId,
    variantOptions: j.variantOptions,
    quantity: j.quantity,
    recipeVersion: j.recipeVersion,
    requiredBy: j.requiredBy,
    requiredAt: j.requiredAt,
    status: j.status,
    stage: j.stage || "PLAN",
    progress: j.progress || 0,
    shortageItems: "",
    purchaseRequirements: "",
    estimatedCost: 0,
    actualCost: productionCosts.filter((c) => c.jobId === j.id).reduce((s, c) => s + (c.total || 0), 0),
  })) as import("../database/types.js").ProductionJobSummary[];

  const inventorySummary = inventoryItems.map((i) => {
    const reserved = reservations.filter((r) => r.itemId === i.id).reduce((s, r) => s + (r.quantity || 0), 0);
    return {
      itemId: i.id,
      name: i.name,
      sku: i.sku,
      category: i.category,
      physicalStock: i.physicalStock || 0,
      reservedStock: reserved,
      availableStock: (i.physicalStock || 0) - reserved,
      reorderLevel: i.reorderLevel || 0,
      unit: i.unit,
      supplierId: i.supplierId || "",
      lowStock: (i.physicalStock || 0) <= (i.reorderLevel || 0),
      outOfStock: (i.physicalStock || 0) <= 0,
    };
  }) as import("../database/types.js").InventorySummary[];

  res.json({
    metrics: {
      todayOrders: ordersToday,
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
      deliveryStatus,
      recentFeedback: feedback.slice(0, 5).map((f) => f.comment).join("; "),
    } as import("../database/types.js").Metrics,
    revenueTrend,
    expensesTrend,
    trendLabels,
    orderStatusBreakdown,
    productionSummary,
    inventorySummary,
  } as unknown as import("../database/types.js").DashboardData);
});

// ── Sales-manager commercial dashboard (spec §18) ────────────────────────────
// The metrics a Sales Manager runs the business by: funnel, conversion, AOV,
// repeat rate, best products/categories — derived from the live ledgers.
router.get("/sales", required("sales.analytics"), (_req, res) => {
  const orders = store.orders();
  const customers = store.customers();
  const inquiries = store.inquiries();
  const quotations = store.quotations();
  const catalogueProducts = store.db.catalogue?.products ?? [];
  const catalogueCategories = store.db.catalogue?.categories ?? [];

  const won = orders.filter((o) => o.status !== "CANCELLED");
  const lostInquiries = inquiries.filter((i) => i.status === "CLOSED" || i.status === "RESOLVED").length;
  const acceptedQuotations = quotations.filter((q) => q.status === "ACCEPTED" || q.status === "CONVERTED").length;
  const conversionRate = inquiries.length > 0 ? Math.round((won.length / inquiries.length) * 1000) / 10 : 0;
  const revenue = won.reduce((s, o) => s + (o.total || 0), 0);
  const averageOrderValue = won.length > 0 ? Math.round(revenue / won.length) : 0;

  // Repeat-customer rate: share of ordering customers with >1 won order.
  const perCustomer = new Map<string, number>();
  for (const o of won) perCustomer.set(o.customerId, (perCustomer.get(o.customerId) || 0) + 1);
  const repeatCustomers = [...perCustomer.values()].filter((n) => n > 1).length;
  const repeatCustomerRate = perCustomer.size > 0 ? Math.round((repeatCustomers / perCustomer.size) * 1000) / 10 : 0;
  const customerLifetimeValue = perCustomer.size > 0 ? Math.round(revenue / perCustomer.size) : 0;

  // Best-performing products by won-order line revenue, joined through the
  // catalogue so display names (not just ids) reach the dashboard.
  const byProduct = new Map<string, { revenue: number; orders: number }>();
  for (const o of won) {
    for (const item of o.items || []) {
      const key = item.productId || "unknown";
      const cur = byProduct.get(key) || { revenue: 0, orders: 0 };
      cur.revenue += (item.unitPrice || 0) * (item.quantity || 0);
      cur.orders += 1;
      byProduct.set(key, cur);
    }
  }
  const bestProducts = [...byProduct.entries()]
    .map(([id, v]) => ({
      productId: id,
      name: catalogueProducts.find((p) => p.id === id)?.name ?? id,
      revenue: v.revenue,
      orders: v.orders,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const byCategory = new Map<string, number>();
  for (const o of won) {
    for (const item of o.items || []) {
      const catId = catalogueProducts.find((p) => p.id === item.productId)?.categoryId ?? "";
      const catName = catalogueCategories.find((c) => c.id === catId)?.name ?? "Uncategorised";
      byCategory.set(catName, (byCategory.get(catName) || 0) + (item.unitPrice || 0) * (item.quantity || 0));
    }
  }
  const bestCategories = [...byCategory.entries()]
    .map(([name, catRevenue]) => ({ name, revenue: catRevenue }))
    .sort((a, b) => b.revenue - a.revenue);

  res.json({
    inquiries: inquiries.length,
    lostInquiries,
    quotations: quotations.length,
    acceptedQuotations,
    confirmedOrders: won.length,
    conversionRate,
    revenue,
    averageOrderValue,
    repeatCustomerRate,
    customerLifetimeValue,
    totalCustomers: customers.length,
    bestProducts,
    bestCategories,
  });
});

export default router;
