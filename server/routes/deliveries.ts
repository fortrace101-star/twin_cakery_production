import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { RbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { businessService } from "../services/business.service.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();
const rbacService = new RbacService()
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

router.get("/", required("deliveries.view"), (req, res) => {
  const deliveries = store.deliveries();
  const status = req.query.status as string | undefined;
  let list = deliveries;
  if (status) list = list.filter((d) => d.status === status);
  res.json(list);
});

router.post("/", required("deliveries.create"), (req, res) => {
  const { orderId, type, destination, scheduledAt, scheduledDate, scheduledTime, actualDispatchTime, deliveryPerson, deliveryFee, status, notes, customerConfirmation } = req.body || {};
  const delivery = store.createDelivery({
    orderId: orderId || "",
    type: type || "HOME_DELIVERY",
    destination: destination || "",
    scheduledAt: scheduledAt || null,
    scheduledDate: scheduledDate || null,
    scheduledTime: scheduledTime || null,
    actualDispatchTime: actualDispatchTime || null,
    deliveryPerson: deliveryPerson || null,
    deliveryFee: deliveryFee || 0,
    status: status || "PENDING",
    notes: notes || "",
    customerConfirmation: customerConfirmation || null,
  });
  store.persist();
  res.status(201).json(delivery);
});

router.post("/:id/dispatch", required("deliveries.dispatch"), (req, res) => {
  const id = String(req.params.id);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const existing = store.findDelivery(id);
  if (!existing) throw new NotFoundError("Delivery not found");
  // Pickup/collection fulfilment never goes In Transit — those orders move
  // straight from Awaiting Collection to Completed / Delivered (complete below).
  const fulfilment = String(existing.type || "").toUpperCase();
  if (fulfilment.includes("PICKUP") || fulfilment.includes("COLLECTION")) {
    return res.status(409).json({ error: "Pickup collections complete directly — no In Transit step" });
  }
  const delivery = store.updateDelivery(id, { status: "IN_TRANSIT", actualDispatchTime: new Date().toISOString(), updatedAt: new Date().toISOString() });
  if (!delivery) throw new NotFoundError("Delivery not found");
  store.createAuditLog({
    actor: session.userId, action: "delivery:dispatched",
    entityType: "delivery", entityId: delivery.id, orderId: delivery.orderId,
    newStatus: "IN_TRANSIT", reason: `Dispatched for order ${delivery.orderId}`,
  });
  store.persist();
  res.json(delivery);
});

router.post("/:id/complete", required("deliveries.complete"), (req, res) => {
  const id = String(req.params.id);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const existing = store.findDelivery(id);
  if (!existing) throw new NotFoundError("Delivery not found");
  const fulfilment = String(existing.type || "").toUpperCase();
  const isPickup = fulfilment.includes("PICKUP") || fulfilment.includes("COLLECTION");
  if (isPickup) {
    if (existing.status !== "AWAITING_COLLECTION" && existing.status !== "READY_FOR_DISPATCH" && existing.status !== "PENDING" && existing.status !== "SCHEDULED" && existing.status !== "ASSIGNED" && existing.status !== "COMPLETED_DELIVERED" && existing.status !== "PICKED_UP") {
      return res.status(409).json({ error: "Cannot complete: invalid state for pickup collection" });
    }
  } else {
    if (existing.status !== "IN_TRANSIT" && existing.status !== "DISPATCHED" && existing.status !== "COMPLETED_DELIVERED") {
      return res.status(409).json({ error: "Cannot complete: must be IN_TRANSIT/DISPATCHED" });
    }
  }

  const body = req.body || {};
  const order = store.orders().find((o) => o.id === existing.orderId);
  if (!order) throw new NotFoundError("Order not found");

  const collected = body.collected;
  const noCollection = body.noCollection;
  if (!collected && !noCollection) {
    return res.status(422).json({ error: "Either collected{amount,method,reference} or noCollection{reason} required" });
  }

  let balanceDue = Number(order.total || 0);
  if (collected) {
    const amount = Number(collected.amount || 0);
    const methodRaw = String(collected.method || "Cash");
    const reference = String(collected.reference || "");
    const methodMap: Record<string, any> = {
      "Cash": "Cash",
      "MTN MoMo": "M-Pesa",
      "Airtel Money": "M-Pesa",
      "bank": "Bank transfer",
      "Bank": "Bank transfer",
      "Bank transfer": "Bank transfer",
      "Card": "Card",
      "Cheque": "Cheque",
      "M-Pesa": "M-Pesa",
    };
    const method = methodMap[methodRaw] || methodRaw;
    if (method !== "Cash" && !reference) {
      return res.status(422).json({ error: "Reference required for non-cash payments" });
    }
    if (amount > 0) {
      // Idempotent-ish: avoid double-posting if payment already recorded for this delivery
      const existingPayments = store.payments ? store.payments() : [];
      const already = existingPayments.some((p: any) => p.orderId === order.id && p.reference && p.reference.includes(id));
      if (!already) {
        try {
          store.paymentsReceived ? store.paymentsReceived(order.id, amount, method, reference || `DEL-${id}`, session.userId) : store.createPayment({ orderId: order.id, amount, method, reference: reference || `DEL-${id}`, receivedBy: session.userId });
        } catch (e) {
          // non-fatal
        }
      }
      const paidNow = (store.payments ? store.payments() : []).filter((p: any) => p.orderId === order.id).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      balanceDue = Math.max(0, Number(order.total || 0) - paidNow);
      if (paidNow < Number(order.total || 0)) {
        try { store.updateOrder(order.id, { paymentStatus: "PARTIALLY_PAID" }); } catch {}
        try { businessService.requestCustomerFollowUp ? businessService.requestCustomerFollowUp(store.findOrder(order.id) as any, session.userId) : null; } catch {}
      } else if (paidNow > Number(order.total || 0)) {
        // flag over-collection - still proceed, paymentStatus will be OVERPAID by recompute
        try { store.recomputePaymentStatus ? store.recomputePaymentStatus(order.id) : null; } catch {}
      } else {
        try { store.recomputePaymentStatus ? store.recomputePaymentStatus(order.id) : null; } catch {}
      }
    }
  } else if (noCollection) {
    balanceDue = Number(order.total || 0) - ((store.payments ? store.payments() : []).filter((p: any) => p.orderId === order.id).reduce((s: number, p: any) => s + Number(p.amount || 0), 0));
    if (balanceDue > 0) {
      try { store.updateOrder(order.id, { paymentStatus: "PARTIALLY_PAID" }); } catch {}
      try { if (businessService.alertFinance) businessService.alertFinance({ type: "DELIVERY_UNPAID_BALANCE", orderId: order.id, amount: balanceDue }, session.userId); } catch {}
    }
  }

  const delivery = store.updateDelivery(id, { status: "COMPLETED_DELIVERED", actualDeliveryDate: new Date().toISOString(), updatedAt: new Date().toISOString() });
  if (!delivery) throw new NotFoundError("Delivery not found");
  // Delivered means delivered: close the order out and raise the CRM follow-up
  // (badge + admin notification) unless it is already completed.
  const currentOrder = store.orders().find((o) => o.id === delivery.orderId);
  if (currentOrder && currentOrder.status !== "COMPLETED_DELIVERED") {
    const updated = store.updateOrder(currentOrder.id, { status: "COMPLETED_DELIVERED", deliveryStatus: "DELIVERED", followUpCompletedAt: null });
    if (updated) try { businessService.requestCustomerFollowUp(updated, session.userId); } catch {}
    if (updated) try { businessService.archiveCompletedJob(updated, session.userId); } catch { /* Non-fatal */ }
  }
  store.createAuditLog({
    actor: session.userId, action: "delivery:completed",
    entityType: "delivery", entityId: delivery.id, orderId: delivery.orderId,
    newStatus: "COMPLETED_DELIVERED", reason: `Delivered for order ${delivery.orderId}`,
  });
  try { if (store.recomputePaymentStatus) store.recomputePaymentStatus(order.id); } catch {}
  store.persist();
  const finalOrder = store.findOrder ? store.findOrder(order.id) : (currentOrder ?? order);
  res.json({ delivery, order: finalOrder ?? null, balanceDue });
});

router.get("/:id", required("deliveries.view"), (req, res) => {
  const delivery = store.findDelivery(String(req.params.id));
  if (!delivery) throw new NotFoundError("Delivery not found");
  res.json(delivery);
});

router.post("/:id/cancel", required("deliveries.cancel"), (req, res) => {
  const id = String(req.params.id);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const existing = store.findDelivery(id);
  if (!existing) throw new NotFoundError("Delivery not found");
  const reason = req.body?.reason ? String(req.body.reason) : "CANCELLED_BY_STAFF";
  const delivery = store.updateDelivery(id, { status: "CANCELLED", notes: existing.notes ? `Cancelled [${reason}]: ${existing.notes}` : `Cancelled [${reason}]`, updatedAt: new Date().toISOString() });
  if (!delivery) throw new NotFoundError("Delivery not found");
  store.createAuditLog({
    actor: session.userId, action: "delivery:completed",
    entityType: "delivery", entityId: delivery.id, orderId: delivery.orderId,
    newStatus: "CANCELLED", reason: `Cancelled [${reason}]`,
  });
  store.persist();
  res.json(delivery);
});

router.post("/:id/fail", required("deliveries.update"), (req, res) => {
  const id = String(req.params.id);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const existing = store.findDelivery(id);
  if (!existing) throw new NotFoundError("Delivery not found");
  const reason = req.body?.reason ? String(req.body.reason) : "FAILED_ATTEMPT";
  const delivery = store.updateDelivery(id, { status: "FAILED_ATTEMPT", notes: existing.notes ? `Failed attempt [${reason}]: ${existing.notes}` : `Failed attempt [${reason}]`, updatedAt: new Date().toISOString() });
  if (!delivery) throw new NotFoundError("Delivery not found");
  store.createAuditLog({
    actor: session.userId, action: "delivery:completed",
    entityType: "delivery", entityId: delivery.id, orderId: delivery.orderId,
    newStatus: "FAILED_ATTEMPT", reason: `Failed attempt [${reason}]`,
  });
  store.persist();
  res.json(delivery);
});

router.patch("/:id", required("deliveries.update"), (req, res) => {
  const id = String(req.params.id);
  const delivery = store.findDelivery(id);
  if (!delivery) throw new NotFoundError("Delivery not found");
  const { status, notes, scheduledAt, scheduledDate, scheduledTime, actualDispatchTime, actualDeliveryDate, deliveryPerson, deliveryFee, customerConfirmation, type } = req.body || {};
  const patched = { ...(req.body || {}) };
  if (status !== undefined) delivery.status = String(status) as import("../database/types.js").DeliveryStatus;
  if (notes !== undefined) delivery.notes = String(notes);
  if (scheduledAt !== undefined) delivery.scheduledAt = scheduledAt;
  if (scheduledDate !== undefined) delivery.scheduledDate = scheduledDate;
  if (scheduledTime !== undefined) delivery.scheduledTime = scheduledTime;
  if (actualDispatchTime !== undefined) delivery.actualDispatchTime = actualDispatchTime;
  if (actualDeliveryDate !== undefined) delivery.actualDeliveryDate = actualDeliveryDate;
  if (deliveryPerson !== undefined) delivery.deliveryPerson = deliveryPerson;
  if (deliveryFee !== undefined) delivery.deliveryFee = Number(deliveryFee);
  if (customerConfirmation !== undefined) delivery.customerConfirmation = customerConfirmation;
  if (type !== undefined) delivery.type = String(type) as import("../database/types.js").DeliveryType_;
  delivery.updatedAt = new Date().toISOString();
  store.persist();
  res.json(delivery);
});

export default router;
