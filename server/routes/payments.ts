import { Router } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";

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

router.get("/", required("payments.view"), (req, res) => {
  res.json(store.payments());
});

router.post("/", required("payments.record"), (req, res) => {
  const { orderId, amount, method, reference, receivedBy, notes } = req.body || {};
  if (!orderId || amount === undefined) return res.status(400).json({ error: "orderId and amount are required" });
  const payment = store.paymentsReceived(orderId, amount, method || "Cash", reference || "", receivedBy || "admin");
  if (!payment) throw new NotFoundError("Order not found");
  store.persist();
  res.status(201).json(payment);
});

export default router;
