import { Router } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();
const authService = new AuthService();

function parseNum(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const required = (perm: string) => async (req, res, next) => {
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

// ---- fixed cost categories (admin/management) ----

router.get("/categories", required("production.view"), (_req, res) => {
  res.json(store.productionFixedCostCategories().filter((c) => c.deletedAt === undefined));
});

router.get("/categories/:id", required("production.view"), (req, res) => {
  const category = store.findProductionFixedCostCategory(String(req.params.id));
  if (!category) throw new NotFoundError("Fixed cost category not found");
  res.json(category);
});

router.post("/categories", required("production.manage"), (req, res) => {
  const body = req.body || {};
  if (!body.name) return res.status(400).json({ error: "name is required" });
  const category = store.createProductionFixedCostCategory({
    name: body.name,
    description: body.description || "",
    costType: body.costType || "perJob",
    unit: body.unit || "",
    defaultUnitCost: parseNum(body.defaultUnitCost),
    active: body.active !== false,
  });
  res.status(201).json(category);
});

router.patch("/categories/:id", required("production.manage"), (req, res) => {
  const category = store.updateProductionFixedCostCategory(String(req.params.id), req.body || {});
  if (!category) throw new NotFoundError("Fixed cost category not found");
  res.json(category);
});

router.delete("/categories/:id", required("production.manage"), (req, res) => {
  const ok = store.deleteProductionFixedCostCategory(String(req.params.id));
  if (!ok) throw new NotFoundError("Fixed cost category not found or in use");
  res.status(204).send();
});

// ---- job-level fixed cost entries ----

router.get("/jobs/:jobId/entries", required("production.view"), (req, res) => {
  res.json(store.productionFixedCostEntriesForJob(String(req.params.jobId)));
});

router.post("/jobs/:jobId/entries", required("production.manage"), (req, res) => {
  const body = req.body || {};
  if (!body.categoryId) return res.status(400).json({ error: "categoryId is required" });
  const category = store.findProductionFixedCostCategory(body.categoryId);
  if (!category) return res.status(400).json({ error: "categoryId not found" });
  const unitCost = parseNum(body.unitCost) || parseNum(category.defaultUnitCost) || 0;
  const quantity = parseNum(body.quantity) || 1;
  const entry = store.createProductionFixedCostEntry({
    jobId: String(req.params.jobId),
    categoryId: body.categoryId,
    quantity,
    unit: body.unit || category.unit || "",
    unitCost,
    recordedBy: body.recordedBy || "",
    notes: body.notes || "",
  });
  res.status(201).json(entry);
});

router.patch("/entries/:id", required("production.manage"), (req, res) => {
  const entry = store.updateProductionFixedCostEntry(String(req.params.id), req.body || {});
  if (!entry) throw new NotFoundError("Fixed cost entry not found");
  res.json(entry);
});

router.delete("/entries/:id", required("production.manage"), (req, res) => {
  const ok = store.deleteProductionFixedCostEntry(String(req.params.id));
  if (!ok) throw new NotFoundError("Fixed cost entry not found");
  res.status(204).send();
});

export default router;
