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

router.get("/jobs", required("production.view"), (req, res) => {
  const jobs = store.productionJobs();
  const status = req.query.status as string | undefined;
  let list = jobs;
  if (status) list = list.filter((j) => j.status === status);
  res.json(list);
});

router.get("/jobs/:id", required("production.view"), (req, res) => {
  const job = store.productionJobs().find((j) => j.id === req.params.id);
  if (!job) throw new NotFoundError("Production job not found");
  res.json(job);
});

router.post("/jobs/:id/start", required("production.start"), (req, res) => {
  const { id } = req.params;
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const job = store.updateProductionJob(id, { status: "IN_PRODUCTION", stage: "PRODUCE", progress: 20, updatedAt: new Date().toISOString() });
  if (!job) throw new NotFoundError("Production job not found");
  store.persist();
  res.json(job);
});

router.post("/jobs/:id/complete", required("production.complete"), (req, res) => {
  const { id } = req.params;
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const job = store.updateProductionJob(id, { status: "READY_FOR_QUALITY", stage: "QUALITY", progress: 80, updatedAt: new Date().toISOString() });
  if (!job) throw new NotFoundError("Production job not found");
  store.persist();
  res.json(job);
});

router.post("/jobs/:id/quality-check", required("production.quality_check"), (req, res) => {
  const { id } = req.params;
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const { result, issues, notes, reworkRequired, reworkCost, wastageCaused } = req.body || {};
  const job = store.productionJobs().find((j) => j.id === id);
  if (!job) throw new NotFoundError("Production job not found");
  const check = store.createQualityCheck({
    jobId: job.id,
    checkedBy: session.userId,
    checkedAt: new Date().toISOString(),
    issues: issues || "",
    notes: notes || "",
    reworkRequired: reworkRequired || false,
    reworkCost: reworkCost || 0,
    wastageCaused: wastageCaused || 0,
  });
  let updated = { ...job };
  if (result === "PASS") {
    updated = { ...job, status: "READY_FOR_DELIVERY", stage: "DELIVER", progress: 100, updatedAt: new Date().toISOString() };
  } else {
    updated = { ...job, status: "REWORK_REQUIRED", stage: "QUALITY", progress: 50, updatedAt: new Date().toISOString() };
  }
  store.updateProductionJob(id, updated);
  store.persist();
  res.json({ job: updated, check });
});

router.post("/jobs/:id/wastage", required("production.record_wastage"), (req, res) => {
  const { id } = req.params;
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const { itemId, quantity, unit, reason, cost } = req.body || {};
  if (!itemId || quantity === undefined) return res.status(400).json({ error: "itemId and quantity are required" });
  const job = store.productionJobs().find((j) => j.id === id);
  if (!job) throw new NotFoundError("Production job not found");
  store.adjustInventory(itemId, -quantity, unit || "unit", "WASTAGE", `Wastage for ${job.orderId}`, session.userId, cost || 0, `Wastage: ${reason}`);
  store.createProductionWastage({
    jobId: job.id,
    itemId,
    quantity,
    unit: unit || "unit",
    reason: reason || "",
    cost: cost || 0,
    recordedBy: session.userId,
  });
  store.persist();
  res.json({ ok: true });
});

export default router;
