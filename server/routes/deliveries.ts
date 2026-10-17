import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { businessService } from "../services/business.service.js";
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
  store.persist();
  res.json(delivery);
});

router.post("/:id/complete", required("deliveries.complete"), (req, res) => {
  const id = String(req.params.id);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const delivery = store.updateDelivery(id, { status: "COMPLETED_DELIVERED", actualDeliveryDate: new Date().toISOString(), updatedAt: new Date().toISOString() });
  if (!delivery) throw new NotFoundError("Delivery not found");
  // Delivered means delivered: close the order out and raise the CRM follow-up
  // (badge + admin notification) unless it is already completed.
  const order = store.orders().find((o) => o.id === delivery.orderId);
  if (order && order.status !== "COMPLETED_DELIVERED") {
    const updated = store.updateOrder(order.id, { status: "COMPLETED_DELIVERED", deliveryStatus: "DELIVERED", followUpCompletedAt: null });
    if (updated) businessService.requestCustomerFollowUp(updated, session.userId);
  }
  store.persist();
  res.json(delivery);
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
  const delivery = store.updateDelivery(id, { status: "FAILED", notes: existing.notes ? `Cancelled: ${existing.notes}` : "Cancelled by staff", updatedAt: new Date().toISOString() });
  if (!delivery) throw new NotFoundError("Delivery not found");
  store.persist();
  res.json(delivery);
});

router.patch("/:id", required("deliveries.view"), (req, res) => {
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
