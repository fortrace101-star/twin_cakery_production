import { Router } from "express";
import { store } from "../database/store.js";
import { flush } from "../database/index.new.js";
import { RbacService } from "../services/rbac.service.js";
import { businessService } from "../services/business.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";
import { publishLowStockAlert } from "../services/stock-alerts.js";
import { paginate } from "../utils/paginate.js";
const router = Router();
const rbacService = new RbacService();
const authService = new AuthService();
const required = (perm) => async (req, res, next) => {
    try {
        const session = await authService.requireAuth(extractToken(req.headers.authorization));
        await rbacService.requirePermission(session.userId, perm);
        next();
    }
    catch (err) {
        if (err instanceof Error && err.name === "UnauthorizedError")
            return res.status(401).json({ error: err.message });
        if (err instanceof Error && err.name === "ForbiddenError")
            return res.status(403).json({ error: err.message });
        next(err);
    }
};
router.get("/jobs", required("production.view"), async (req, res) => {
    // Self-healing board: any pipeline order without a job gets one right here,
    // so an order already reading "Confirmed" / "In production" can never sit on
    // an empty board (backstop for data stranded by pre-fix writes).
    const created = businessService.reconcileProductionJobs("system");
    try {
        // Order advancement is handled at mutation time (start/complete/quality). Avoid
        // scanning all jobs on every board read/poll to keep response times fast.
        // Avoid a full DB write-back+flush on every read; persist when reconcile
        // actually created jobs (it also persists internally), not on each poll.
        if (created > 0) {
            try {
                store.persist();
                await flush();
            }
            catch (err) {
                return res.status(503).json({ error: "Database unavailable: " + (err?.message || "persist failed") });
            }
        }
    }
    catch { }
    const jobs = store.productionJobs();
    const status = req.query.status;
    let list = jobs;
    if (status)
        list = list.filter((j) => j.status === status);
    // §33 — opt-in pagination envelope (plain array without ?page=).
    res.json(paginate(list, req.query, {
        sortable: ["requiredBy", "progress", "status", "createdAt"],
        dateField: "createdAt",
        searchFields: ["orderId", "variantOptions", "notes"],
    }));
});
router.get("/jobs/:id", required("production.view"), async (req, res) => {
    const job = store.productionJobs().find((j) => j.id === String(req.params.id));
    if (!job)
        throw new NotFoundError("Production job not found");
    res.json(job);
});
router.post("/jobs/:id/start", required("production.start"), async (req, res) => {
    const id = String(req.params.id);
    const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
    if (!session)
        return res.status(401).json({ error: "Not authenticated" });
    const existing = store.productionJobs().find((j) => j.id === id);
    if (!existing)
        throw new NotFoundError("Production job not found");
    const allowed = ["PENDING", "SCHEDULED", "READY_FOR_PRODUCTION"];
    if (!allowed.includes(String(existing.status))) {
        return res.status(409).json({ error: "Cannot start job in current state" });
    }
    const job = store.updateProductionJob(id, { status: "IN_PRODUCTION", stage: "PRODUCE", progress: 20, updatedAt: new Date().toISOString() });
    if (!job)
        throw new NotFoundError("Production job not found");
    try {
        store.persist();
        await flush();
    }
    catch (err) {
        return res.status(503).json({ error: "Database unavailable: " + (err?.message || "persist failed") });
    }
    // Orders must follow Production: starting the job moves the linked
    // order into IN_PRODUCTION (walks the legal status graph, writes history
    // rows + audit log; non-fatal if the order is already at/past In
    // production or not linked to the production leg).
    businessService.advanceOrderToInProduction(job, session.userId);
    res.json(job);
});
router.post("/jobs", required("production.schedule"), async (req, res) => {
    const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
    if (!session)
        return res.status(401).json({ error: "Not authenticated" });
    const { orderId } = req.body || {};
    if (!orderId)
        return res.status(400).json({ error: "orderId is required" });
    const order = store.orders().find((o) => o.id === String(orderId));
    if (!order)
        throw new NotFoundError("Order not found");
    if (order.status !== "READY_FOR_PRODUCTION" && order.status !== "CONFIRMED" && order.status !== "PRODUCTION_REVIEW" && order.status !== "IN_PRODUCTION") {
        return res.status(409).json({ error: "Order must be in READY_FOR_PRODUCTION, CONFIRMED, PRODUCTION_REVIEW, or IN_PRODUCTION" });
    }
    const { job } = businessService.prepareOrderForProduction(String(orderId), session.userId);
    try {
        store.persist();
        await flush();
    }
    catch (err) {
        return res.status(503).json({ error: "Database unavailable: " + (err?.message || "persist failed") });
    }
    res.status(201).json(job);
});
router.post("/orders/:orderId/start", required("production.start"), async (req, res) => {
    const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
    if (!session)
        return res.status(401).json({ error: "Not authenticated" });
    let orderId = String(req.params.orderId);
    try {
        // Try to find by id or orderNumber
        let order = store.orders().find((o) => o.id === orderId);
        if (!order) {
            order = store.orders().find((o) => o.orderNumber === orderId);
            if (order)
                orderId = order.id;
        }
        const result = businessService.startProductionForOrder(orderId, session.userId);
        res.json(result);
    }
    catch (err) {
        if (err?.name === "NotFoundError")
            return res.status(404).json({ error: err.message });
        if (err?.name === "ConflictError")
            return res.status(409).json({ error: err.message });
        throw err;
    }
});
router.post("/jobs/:id/complete", required("production.complete"), async (req, res) => {
    const id = String(req.params.id);
    const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
    if (!session)
        return res.status(401).json({ error: "Not authenticated" });
    const existing = store.productionJobs().find((j) => j.id === id);
    if (!existing)
        throw new NotFoundError("Production job not found");
    if (String(existing.status) !== "IN_PRODUCTION") {
        return res.status(409).json({ error: "Job must be IN_PRODUCTION to complete" });
    }
    const job = store.updateProductionJob(id, { status: "READY_FOR_QUALITY", stage: "QUALITY", progress: 80, updatedAt: new Date().toISOString() });
    if (!job)
        throw new NotFoundError("Production job not found");
    try {
        const order = store.orders().find((o) => o.id === job.orderId);
        if (order) {
            store.updateOrder(order.id, { station: "decorating" });
        }
    }
    catch { }
    store.createAuditLog({
        actor: session.userId, action: "production:completed",
        entityType: "production_job", entityId: job.id, orderId: job.orderId,
        newStatus: "READY_FOR_QUALITY", reason: `Job ${id} marked complete`,
    });
    try {
        businessService.advanceOrderToReadyForDelivery({ ...job, status: "READY_FOR_DELIVERY" }, session.userId);
    }
    catch { }
    try {
        store.persist();
        await flush();
    }
    catch (err) {
        return res.status(503).json({ error: "Database unavailable: " + (err?.message || "persist failed") });
    }
    res.json(job);
});
router.post("/jobs/:id/quality-check", required("production.quality_check"), async (req, res) => {
    const id = String(req.params.id);
    const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
    if (!session)
        return res.status(401).json({ error: "Not authenticated" });
    const { result, issues, notes, reworkRequired, reworkCost, wastageCaused } = req.body || {};
    const job = store.productionJobs().find((j) => j.id === id);
    if (!job)
        throw new NotFoundError("Production job not found");
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
    }
    else {
        updated = { ...job, status: "PENDING", stage: "PLAN", progress: 10, updatedAt: new Date().toISOString(), notes: (job.notes ? job.notes + ' | ' : '') + 'REWORK_REQUIRED' };
        try {
            const order = store.orders().find((o) => o.id === job.orderId);
            if (order) {
                store.updateOrder(order.id, { station: "baking" });
                try {
                    businessService.advanceOrderToInProduction({ ...updated, orderId: order.id }, session.userId);
                }
                catch { }
            }
        }
        catch { }
    }
    store.updateProductionJob(id, updated);
    if (result === "PASS") {
        // Orders must follow Production: job Ready for delivery ⇒ the order
        // switches to Ready (walks the legal status graph, writes history rows).
        // Non-fatal — the quality check + job write above already persisted.
        try {
            businessService.advanceOrderToReadyForDelivery(job, session.userId);
        }
        catch {
            /* Non-fatal: the quality check write above already succeeded. */
        }
    }
    store.createAuditLog({
        actor: session.userId, action: "production:quality_check",
        entityType: "production_job", entityId: id, orderId: job.orderId,
        newStatus: result === "PASS" ? "PASS" : "REWORK_REQUIRED",
        reason: issues ? String(issues) : `QC ${result || "checked"} for job ${id}`,
    });
    try {
        store.persist();
        await flush();
    }
    catch (err) {
        return res.status(503).json({ error: "Database unavailable: " + (err?.message || "persist failed") });
    }
    res.json({ job: updated, check });
});
router.post("/jobs/:id/wastage", required("production.record_wastage"), async (req, res) => {
    const id = String(req.params.id);
    const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
    if (!session)
        return res.status(401).json({ error: "Not authenticated" });
    const { itemId, quantity, unit, reason, cost } = req.body || {};
    if (!itemId || quantity === undefined)
        return res.status(400).json({ error: "itemId and quantity are required" });
    const job = store.productionJobs().find((j) => j.id === id);
    if (!job)
        throw new NotFoundError("Production job not found");
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
    try {
        store.persist();
        await flush();
    }
    catch (err) {
        return res.status(503).json({ error: "Database unavailable: " + (err?.message || "persist failed") });
    }
    res.json({ ok: true });
});
/**
 * Manual material usage entry — deducts used ingredients from inventory,
 * writes production_consumption rows + an ACTUAL cost roll-up (service does
 * all validation: item exists, qty > 0 and <= physical stock, job in
 * IN_PRODUCTION/REWORK_REQUIRED; errors map to 400/404/409).
 */
router.post("/jobs/:id/materials", required("production.record_consumption"), async (req, res) => {
    const id = String(req.params.id);
    const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
    if (!session)
        return res.status(401).json({ error: "Not authenticated" });
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: "items must be a non-empty array" });
    const consumption = businessService.recordMaterialsUsed(id, session.userId, items.map((it) => ({
        itemId: String(it?.itemId ?? ""),
        quantity: Number(it?.quantity ?? 0),
        notes: it?.notes ? String(it.notes) : "",
    })));
    res.status(201).json({ consumption });
});
router.get("/jobs/:id/costs", required("production.view"), async (req, res) => {
    const job = store.productionJobs().find((j) => j.id === String(req.params.id));
    if (!job)
        throw new NotFoundError("Production job not found");
    const costs = store.productionCosts().filter((c) => c.jobId === job.id);
    res.json({ jobId: job.id, costs });
});
router.get("/jobs/:id/consumption", required("production.view"), async (req, res) => {
    const job = store.productionJobs().find((j) => j.id === String(req.params.id));
    if (!job)
        throw new NotFoundError("Production job not found");
    const consumption = store.productionConsumption().filter((c) => c.jobId === job.id);
    res.json({ jobId: job.id, consumption });
});
router.get("/jobs/:id/wastage", required("production.view"), async (req, res) => {
    const job = store.productionJobs().find((j) => j.id === String(req.params.id));
    if (!job)
        throw new NotFoundError("Production job not found");
    const wastage = store.productionWastage().filter((w) => w.jobId === job.id);
    res.json({ jobId: job.id, wastage });
});
export default router;
//# sourceMappingURL=production.js.map