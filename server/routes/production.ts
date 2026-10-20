import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { businessService } from "../services/business.service.js";

import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";
import { publishLowStockAlert } from "../services/stock-alerts.js";
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

router.get("/jobs", required("production.view"), (req, res) => {
  // Self-healing board: any pipeline order without a job gets one right here,
  // so an order already reading "Confirmed" / "In production" can never sit on
  // an empty board (backstop for data stranded by pre-fix writes).
  businessService.reconcileProductionJobs("system");
  const jobs = store.productionJobs();
  const status = req.query.status as string | undefined;
  let list = jobs;
  if (status) list = list.filter((j) => j.status === status);
  // §33 — opt-in pagination envelope (plain array without ?page=).
  res.json(paginate(list, req.query, {
    sortable: ["requiredBy", "progress", "status", "createdAt"],
    dateField: "createdAt",
    searchFields: ["orderId", "variantOptions", "notes"],
  }));
});

router.get("/jobs/:id", required("production.view"), (req, res) => {
  const job = store.productionJobs().find((j) => j.id === String(req.params.id));
  if (!job) throw new NotFoundError("Production job not found");
  res.json(job);
});

router.post("/jobs/:id/start", required("production.start"), (req, res) => {
  const id = String(req.params.id);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const job = store.updateProductionJob(id, { status: "IN_PRODUCTION", stage: "PRODUCE", progress: 20, updatedAt: new Date().toISOString() });
  if (!job) throw new NotFoundError("Production job not found");
  store.persist();
  res.json(job);
});

router.post("/jobs", required("production.schedule"), (req, res) => {
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId is required" });
  const order = store.orders().find((o) => o.id === String(orderId));
  if (!order) throw new NotFoundError("Order not found");
  if (order.status !== "READY_FOR_PRODUCTION" && order.status !== "CONFIRMED" && order.status !== "PRODUCTION_REVIEW" && order.status !== "IN_PRODUCTION") {
    return res.status(409).json({ error: "Order must be in READY_FOR_PRODUCTION, CONFIRMED, PRODUCTION_REVIEW, or IN_PRODUCTION" });
  }
  const { job } = businessService.prepareOrderForProduction(String(orderId), session.userId);
  store.persist();
  res.status(201).json(job);
});

router.post("/jobs/:id/complete", required("production.complete"), (req, res) => {
  const id = String(req.params.id);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const job = store.updateProductionJob(id, { status: "READY_FOR_QUALITY", stage: "QUALITY", progress: 80, updatedAt: new Date().toISOString() });
  if (!job) throw new NotFoundError("Production job not found");
  store.createAuditLog({
    actor: session.userId, action: "production:completed",
    entityType: "production_job", entityId: job.id, orderId: job.orderId,
    newStatus: "READY_FOR_QUALITY", reason: `Job ${id} marked complete`,
  });
  store.persist();
  res.json(job);
});

router.post("/jobs/:id/quality-check", required("production.quality_check"), (req, res) => {
  const id = String(req.params.id);
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
  if (result === "PASS") {
    // Orders must follow Production: job Ready for delivery ⇒ the order
    // switches to Ready (walks the legal status graph, writes history rows).
    // Non-fatal — the quality check + job write above already persisted.
    try {
      businessService.advanceOrderToReadyForDelivery(job, session.userId);
    } catch {
      /* Non-fatal: the quality check write above already succeeded. */
    }
  }
  store.createAuditLog({
    actor: session.userId, action: "production:quality_check",
    entityType: "production_job", entityId: id, orderId: job.orderId,
    newStatus: result === "PASS" ? "PASS" : "REWORK_REQUIRED",
    reason: issues ? String(issues) : `QC ${result || "checked"} for job ${id}`,
  });
  store.persist();
  res.json({ job: updated, check });
});

router.post("/jobs/:id/wastage", required("production.record_wastage"), (req, res) => {
  const id = String(req.params.id);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const { itemId, quantity, unit, reason, cost } = req.body || {};
  if (!itemId || quantity === undefined) return res.status(400).json({ error: "itemId and quantity are required" });
  const job = store.productionJobs().find((j) => j.id === id);
  if (!job) throw new NotFoundError("Production job not found");
  const previousStock = store.inventoryItems().find((i) => i.id === itemId)?.physicalStock ?? 0;
  store.adjustInventory(itemId, -quantity, unit || "unit", "WASTAGE", `Wastage for ${job.orderId}`, session.userId, cost || 0, `Wastage: ${reason}`);
  publishLowStockAlert(itemId, previousStock, { userId: session.userId, role: session.userId, isAdmin: true });
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

/**
 * Manual material usage entry — deducts used ingredients from inventory,
 * writes production_consumption rows + an ACTUAL cost roll-up (service does
 * all validation: item exists, qty > 0 and <= physical stock, job in
 * IN_PRODUCTION/REWORK_REQUIRED; errors map to 400/404/409).
 */
router.post("/jobs/:id/materials", required("production.record_consumption"), (req, res) => {
  const id = String(req.params.id);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items must be a non-empty array" });
  const consumption = businessService.recordMaterialsUsed(
    id,
    session.userId,
    items.map((it: { itemId?: string; quantity?: number; notes?: string }) => ({
      itemId: String(it?.itemId ?? ""),
      quantity: Number(it?.quantity ?? 0),
      notes: it?.notes ? String(it.notes) : "",
    })),
  );
  res.status(201).json({ consumption });
});

router.get("/jobs/:id/costs", required("production.view"), (req, res) => {
  const job = store.productionJobs().find((j) => j.id === String(req.params.id));
  if (!job) throw new NotFoundError("Production job not found");
  const costs = store.productionCosts().filter((c) => c.jobId === job.id);
  res.json({ jobId: job.id, costs });
});

router.get("/jobs/:id/consumption", required("production.view"), (req, res) => {
  const job = store.productionJobs().find((j) => j.id === String(req.params.id));
  if (!job) throw new NotFoundError("Production job not found");
  const consumption = store.productionConsumption().filter((c) => c.jobId === job.id);
  res.json({ jobId: job.id, consumption });
});

router.get("/jobs/:id/wastage", required("production.view"), (req, res) => {
  const job = store.productionJobs().find((j) => j.id === String(req.params.id));
  if (!job) throw new NotFoundError("Production job not found");
  const wastage = store.productionWastage().filter((w) => w.jobId === job.id);
  res.json({ jobId: job.id, wastage });
});

export default router;
