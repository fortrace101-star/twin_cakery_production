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

router.post("/", required("purchasing.create"), (req, res) => {
  const { productIds, quantity, unit, reason, urgency, requestedBy } = req.body || {};
  if (!productIds || quantity === undefined) return res.status(400).json({ error: "productIds and quantity are required" });
  const record = store.createPurchaseRequirement({
    productIds: Array.isArray(productIds) ? productIds.join(",") : String(productIds),
    quantity: quantity || 0,
    unit: unit || "unit",
    reason: reason || "",
    urgency: (urgency as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "MEDIUM",
    status: "OPEN",
    requestedBy: requestedBy || "admin",
  });
  store.persist();
  res.status(201).json(record);
});

router.get("/", required("purchasing.view"), (req, res) => {
  const requirements = store.purchaseRequirements();
  const status = req.query.status as string | undefined;
  let list = requirements;
  if (status) list = list.filter((r) => r.status === status);
  res.json(list);
});

router.post("/:id/acknowledge", required("purchasing.approve"), (req, res) => {
  const { id } = req.params;
  const requirement = store.purchaseRequirements().find((r) => r.id === id);
  if (!requirement) throw new NotFoundError("Purchase requirement not found");
  const updated = store.updatePurchaseRequirement(id, { status: "ACKNOWLEDGED" });
  store.persist();
  res.json(updated);
});

export default router;
