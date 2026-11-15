import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { RbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";

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

router.get("/", required("feedback.view"), async (req, res) => {
  const feedback = store.db.customerFeedback as import("../database/types.js").CustomerFeedback[];
  const customerId = req.query.customerId as string | undefined;
  const orderId = req.query.orderId as string | undefined;
  let list = feedback;
  if (customerId) list = list.filter((f) => f.customerId === customerId);
  if (orderId) list = list.filter((f) => f.orderId === orderId);
  res.json(list);
});

router.get("/by-order/:orderId", required("feedback.view"), async (req, res) => {
  const orderId = String(req.params.orderId);
  const list = store.db.customerFeedback.filter((f) => f.orderId === orderId);
  res.json(list);
});

router.post("/", required("feedback.create"), async (req, res) => {
  const { customerId, orderId, productIds, rating, type, comment, resolution, followUpRequired, followUpCompleted } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId is required" });
  const stars = Number(rating);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: "rating must be between 1 and 5" });
  if (!String(comment || "").trim()) return res.status(400).json({ error: "the customer's feedback text is required" });
  // Take the customer from the order so a record can never be saved with an empty customer_id.
  const order = store.orders().find((o) => o.id === orderId || o.orderNumber === orderId);
  const resolvedCustomerId = String(customerId || order?.customerId || "");
  if (!resolvedCustomerId) return res.status(400).json({ error: "customer could not be determined for this order" });
  const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  const record = store.createCustomerFeedback({
    customerId: resolvedCustomerId,
    orderId: order?.id ?? orderId,
    productIds: productIds || "",
    rating: stars,
    type: type || "GENERAL",
    comment: String(comment).trim(),
    resolution: resolution || null,
    followUpRequired: followUpRequired || false,
    followUpCompleted: followUpCompleted || false,
    recordedBy: session?.userId ?? "system",
  });
  store.persist();
  res.status(201).json(record);
});

router.patch("/:id", required("feedback.update"), async (req, res) => {
  const id = String(req.params.id);
  const feedback = store.db.customerFeedback as import("../database/types.js").CustomerFeedback[];
  const target = feedback.find((f) => f.id === id);
  if (!target) throw new NotFoundError("Feedback not found");
  const patch = req.body || {};
  for (const key of ["rating", "type", "comment", "resolution", "followUpRequired", "followUpCompleted"] as const) {
    if (key in patch) (target as any)[key] = patch[key];
  }
  target.updatedAt = new Date().toISOString();
  store.persist();
  res.json(target);
});

export default router;
