import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { businessService } from "../services/business.service.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { paginate } from "../utils/paginate.js";

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

router.get("/", required("orders.view"), (req, res) => {
  const orders = store.orders();
  const status = req.query.status as string | undefined;
  const customerId = req.query.customerId as string | undefined;
  let list = orders;
  if (customerId) list = list.filter((o) => o.customerId === customerId);
  if (status) list = list.filter((o) => o.status === status);
  // §33 — opt-in `?page=&pageSize=` envelope; no params → plain array (unchanged).
  res.json(paginate(list, req.query, {
    sortable: ["createdAt", "requiredBy", "total", "status"],
    dateField: "createdAt",
    searchFields: ["orderNumber", "notes"],
  }));
});

router.post("/", required("orders.create"), (req, res) => {
  const { orderNumber, customerId, salespersonId, items, subtotal, discount, deliveryCharge, taxAmount, total, requiredBy, requiredAt, notes, status, paymentStatus, deliveryStatus, quotationId, inquiryId, createdBy } = req.body || {};
  if (!customerId) return res.status(400).json({ error: "customerId is required" });
  const record = store.createOrder({
    orderNumber: orderNumber || `TC-${Date.now().toString().slice(-6)}`,
    customerId,
    salespersonId: salespersonId || null,
    items: items || [],
    subtotal: subtotal || 0,
    discount: discount || 0,
    deliveryCharge: deliveryCharge || 0,
    taxAmount: taxAmount || 0,
    total: total || 0,
    requiredBy: requiredBy || null,
    requiredAt: requiredAt || null,
    notes: notes || "",
    status: status || "INQUIRY",
    paymentStatus: paymentStatus ?? "UNPAID",
    deliveryStatus: deliveryStatus ?? "PENDING",
    quotationId: quotationId || null,
    inquiryId: inquiryId || null,
    createdBy: createdBy || "",
  });
  store.persist();
  res.status(201).json(record);
});

router.get("/:id", required("orders.view"), (req, res) => {
  const order = store.orders().find((o) => o.id === String(req.params.id));
  if (!order) throw new NotFoundError("Order not found");
  res.json(order);
});

router.get("/:id/history", required("orders.view"), (req, res) => {
  const order = store.orders().find((o) => o.id === String(req.params.id));
  if (!order) throw new NotFoundError("Order not found");
  const history = store.db.orderStatusHistory as import("../database/types.js").OrderStatusHistory[];
  res.json(history.filter((h) => h.orderId === order.id));
});

router.patch("/:id", required("orders.confirm"), (req, res) => {
  const id = String(req.params.id);
  const order = store.orders().find((o) => o.id === id);
  if (!order) throw new NotFoundError("Order not found");
  const patch = req.body || {};
  const wasCompleted = order.status === "COMPLETED_DELIVERED";
  const updated = store.updateOrder(id, patch);
  if (updated && !wasCompleted && updated.status === "COMPLETED_DELIVERED") {
    // Fresh completion: any stale flag is cleared and the admin is asked to
    // follow up (badge on Customers & CRM until documented).
    updated.followUpCompletedAt = null;
    const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
    businessService.requestCustomerFollowUp(updated, session?.userId ?? "system");
  }
  if (updated && ["CONFIRMED", "PRODUCTION_REVIEW", "READY_FOR_PRODUCTION", "IN_PRODUCTION"].includes(updated.status)) {
    // Moving an order into the production pipeline must leave a Production Job
    // behind — otherwise the Jobs board stays empty. Idempotent: skip when a
    // job already exists for this order.
    const hasJob = store.productionJobs().some((j) => j.orderId === updated.id);
    if (!hasJob) {
      try {
        const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
        businessService.prepareOrderForProduction(updated.id, session?.userId ?? "system");
      } catch {
        /* Non-fatal: invalid transition or missing items must not block the status write. */
      }
    }
  }
  store.persist();
  res.json(updated);
});

router.post("/:id/confirm", required("orders.confirm"), async (req, res) => {
  const id = String(req.params.id);
  const order = store.orders().find((o) => o.id === id);
  if (!order) throw new NotFoundError("Order not found");
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  // Route through the service so confirming an order also creates its
  // Production Job (the Jobs board stays empty otherwise). Falls back to a
  // plain status write when the transition is invalid (e.g. re-confirm).
  try {
    const result = await businessService.confirmOrder(order, session.userId);
    store.persist();
    res.json({ order: result.order, history: result.history, job: result.job });
  } catch {
    // Fallback for invalid transitions (e.g. re-confirm) — the job must still
    // exist, otherwise confirming an order can leave the board empty when
    // confirmOrder failed past job creation (e.g. inventory reservation).
    const result = store.updateOrderStatus(id, "CONFIRMED", session.userId, "Admin confirmed order");
    if (!result) throw new NotFoundError("Order not found");
    if (!store.productionJobs().some((j) => j.orderId === id)) {
      try {
        businessService.prepareOrderForProduction(id, session.userId);
      } catch {
        /* Non-fatal: the status write above already succeeded. */
      }
    }
    store.persist();
    res.json({ order: result.order, history: result.history });
  }
});

router.post("/:id/cancel", required("orders.cancel"), (req, res) => {
  const id = String(req.params.id);
  const order = store.orders().find((o) => o.id === id);
  if (!order) throw new NotFoundError("Order not found");
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const { reason = "No reason provided" } = req.body || {};
  const result = store.cancelOrder(order, session.userId, reason);
  store.persist();
  res.json({ order: result.order, history: result.history });
});

/**
 * POST /:id/repeat — Repeat Order (governing spec §5 "Repeat Order", rule 28).
 * Creates a NEW draft order using the original as template: products, options,
 * customization notes, production specs (recipeVersion) and totals are copied;
 * the caller may override dates, items (quantity/size/price/options), charges
 * and instructions. The original order is never mutated — the copy gets its
 * own order number, status history and customer snapshot via store.createOrder.
 * Cancelled orders are not eligible templates (409).
 */
router.post("/:id/repeat", required("orders.create"), (req, res) => {
  const original = store.findOrder(String(req.params.id));
  if (!original) throw new NotFoundError("Order not found");
  if (original.status === "CANCELLED") throw new ConflictError("Cancelled orders cannot be repeated");
  const body = req.body || {};
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  const items = Array.isArray(body.items)
    ? body.items
    : original.items.map((item) => ({
        productId: item.productId,
        variantOptions: item.variantOptions,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        total: item.total,
        recipeVersion: item.recipeVersion,
      }));
  const subtotal = body.subtotal !== undefined ? Number(body.subtotal)
    : items.reduce((sum: number, i: { total?: number | string | null }) => sum + Number(i.total ?? 0), 0);
  const deliveryCharge = Number(body.deliveryCharge ?? original.deliveryCharge);
  const discount = Number(body.discount ?? original.discount);
  const taxAmount = Number(body.taxAmount ?? original.taxAmount);
  const total = body.total !== undefined ? Number(body.total) : subtotal + deliveryCharge + taxAmount - discount;
  const record = store.createOrder({
    orderNumber: `TC-${Date.now().toString().slice(-6)}`,
    customerId: original.customerId,
    salespersonId: original.salespersonId,
    items,
    subtotal,
    discount,
    deliveryCharge,
    taxAmount,
    total,
    requiredBy: body.requiredBy ?? original.requiredBy,
    requiredAt: body.requiredAt ?? original.requiredAt,
    notes: body.notes ?? original.notes,
    status: "AWAITING_CONFIRMATION",
    paymentStatus: "UNPAID",
    deliveryStatus: "PENDING",
    quotationId: null,
    inquiryId: null,
    createdBy: session?.userId ?? "",
  });
  res.status(201).json({ order: record, repeatedFrom: original.id });
});

export default router;
