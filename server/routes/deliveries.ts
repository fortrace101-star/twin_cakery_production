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
  const delivery = store.updateDelivery(id, { status: "OUT_FOR_DELIVERY", actualDispatchTime: new Date().toISOString(), updatedAt: new Date().toISOString() });
  if (!delivery) throw new NotFoundError("Delivery not found");
  store.persist();
  res.json(delivery);
});

router.post("/:id/complete", required("deliveries.complete"), (req, res) => {
  const id = String(req.params.id);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const delivery = store.updateDelivery(id, { status: "DELIVERED", actualDeliveryDate: new Date().toISOString(), updatedAt: new Date().toISOString() });
  if (!delivery) throw new NotFoundError("Delivery not found");
  store.persist();
  res.json(delivery);
});

export default router;
