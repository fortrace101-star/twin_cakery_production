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

router.get("/", required("feedback.view"), (req, res) => {
  const feedback = store.db.customerFeedback as import("../database/types.js").CustomerFeedback[];
  const customerId = req.query.customerId as string | undefined;
  const orderId = req.query.orderId as string | undefined;
  let list = feedback;
  if (customerId) list = list.filter((f) => f.customerId === customerId);
  if (orderId) list = list.filter((f) => f.orderId === orderId);
  res.json(list);
});

router.get("/by-order/:orderId", required("feedback.view"), (req, res) => {
  const orderId = String(req.params.orderId);
  const list = store.db.customerFeedback.filter((f) => f.orderId === orderId);
  res.json(list);
});

router.post("/", required("feedback.create"), (req, res) => {
  const { customerId, orderId, productIds, rating, type, comment, resolution, followUpRequired, followUpCompleted, recordedBy } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId is required" });
  if (rating === undefined) return res.status(400).json({ error: "rating is required" });
  const record = store.createCustomerFeedback({
    customerId: customerId || "",
    orderId: orderId || null,
    productIds: productIds || "",
    rating: rating || 0,
    type: type || "GENERAL",
    comment: comment || "",
    resolution: resolution || null,
    followUpRequired: followUpRequired || false,
    followUpCompleted: followUpCompleted || false,
    recordedBy: recordedBy || "admin",
  });
  store.persist();
  res.status(201).json(record);
});

router.patch("/:id", required("feedback.update"), (req, res) => {
  const id = String(req.params.id);
  const feedback = store.db.customerFeedback as import("../database/types.js").CustomerFeedback[];
  const target = feedback.find((f) => f.id === id);
  if (!target) throw new NotFoundError("Feedback not found");
  const patch = req.body || {};
  const updated = { ...target, ...patch, updatedAt: new Date().toISOString() };
  store.persist();
  res.json(updated);
});

export default router;
