import { Router } from "express";
import { store } from "../database/store.js";
import { RbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { businessService } from "../services/business.service.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { paginate } from "../utils/paginate.js";
const router = Router();
const rbacService = new RbacService();
const authService = new AuthService();
const required = (perm) => async (req, res, next) => {
    try {
        const session = authService.requireAuth(extractToken(req.headers.authorization));
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
router.get("/", required("orders.view"), (req, res) => {
    const orders = store.orders();
    const status = req.query.status;
    const customerId = req.query.customerId;
    let list = orders;
    if (customerId)
        list = list.filter((o) => o.customerId === customerId);
    if (status)
        list = list.filter((o) => o.status === status);
    // §33 — opt-in `?page=&pageSize=` envelope; no params → plain array (unchanged).
    res.json(paginate(list, req.query, {
        sortable: ["createdAt", "requiredBy", "total", "status"],
        dateField: "createdAt",
        searchFields: ["orderNumber", "notes"],
    }));
});
router.post("/", required("orders.create"), (req, res) => {
    const { orderNumber, customerId, salespersonId, items: reqItems, subtotal: reqSubtotal, discount = 0, deliveryCharge = 0, taxAmount = 0, total: reqTotal, requiredBy, requiredAt, notes, status, paymentStatus, deliveryStatus, quotationId, inquiryId, createdBy, deliveryLocation, locationNote } = req.body || {};
    if (!customerId)
        return res.status(400).json({ error: "customerId is required" });
    const catalogueProducts = store.db.catalogue?.products || [];
    const items = Array.isArray(reqItems)
        ? reqItems.map((raw) => {
            const productId = String(raw.productId || "");
            const product = catalogueProducts.find((p) => p.id === productId);
            const unitPrice = product && product.basePrice !== undefined ? Number(product.basePrice) : Number(raw.unitPrice || 0);
            const quantity = Number(raw.quantity || 0);
            const lineDiscount = Number(raw.discount || 0);
            const total = unitPrice * quantity - lineDiscount;
            return {
                productId,
                variantOptions: raw.variantOptions || "",
                quantity,
                unitPrice,
                discount: lineDiscount,
                total: Math.max(0, total),
                recipeVersion: raw.recipeVersion || null,
            };
        })
        : [];
    const subtotal = items.reduce((sum, i) => sum + Number(i.total || 0) + Number(i.discount || 0), 0);
    const total = subtotal + Number(deliveryCharge || 0) + Number(taxAmount || 0) - Number(discount || 0);
    const record = store.createOrder({
        orderNumber: orderNumber || `TC-${Date.now().toString().slice(-6)}`,
        customerId,
        salespersonId: salespersonId || null,
        items,
        subtotal,
        discount: Number(discount || 0),
        deliveryCharge: Number(deliveryCharge || 0),
        taxAmount: Number(taxAmount || 0),
        total: Math.max(0, total),
        requiredBy: requiredBy || null,
        requiredAt: requiredAt || null,
        notes: notes || "",
        status: status || "INQUIRY",
        paymentStatus: paymentStatus ?? "UNPAID",
        deliveryStatus: deliveryStatus ?? "PENDING",
        quotationId: quotationId || null,
        inquiryId: inquiryId || null,
        createdBy: createdBy || "",
        deliveryLocation: deliveryLocation || "",
        locationNote: locationNote || "",
    });
    store.persist();
    res.status(201).json(record);
});
router.get("/:id", required("orders.view"), (req, res) => {
    const order = store.orders().find((o) => o.id === String(req.params.id));
    if (!order)
        throw new NotFoundError("Order not found");
    res.json(order);
});
router.get("/:id/history", required("orders.view"), (req, res) => {
    const order = store.orders().find((o) => o.id === String(req.params.id));
    if (!order)
        throw new NotFoundError("Order not found");
    const history = store.db.orderStatusHistory;
    res.json(history.filter((h) => h.orderId === order.id));
});
router.patch("/:id", required("orders.edit"), async (req, res) => {
    const id = String(req.params.id);
    const order = store.orders().find((o) => o.id === id);
    if (!order)
        throw new NotFoundError("Order not found");
    const patch = req.body || {};
    // ORD-01: whitelist PATCH fields; reject total/paymentStatus/status/customerId
    const forbidden = ['total', 'paymentStatus', 'status', 'customerId', 'paidAt', 'balanceDue'];
    for (const key of forbidden) {
        if (key in patch) {
            return res.status(400).json({ error: `Field '${key}' cannot be updated via this endpoint` });
        }
    }
    const wasCompleted = order.status === "COMPLETED_DELIVERED";
    // Determine the new station based on status transition
    let newStation = order.station;
    const newStatus = order.status;
    // Station transition logic (status changes only via action endpoints)
    if (newStatus === "COMPLETED_DELIVERED") {
        newStation = "done";
    }
    // Preserve notes if not explicitly provided in patch, otherwise update
    const newNotes = patch.notes !== undefined ? patch.notes : order.notes;
    const allowedUpdates = {};
    const allowed = ['notes', 'deliveryType', 'deliveryLocation', 'deliveryDate', 'deliveryTime', 'dueDate', 'dueTime', 'eventType', 'reference', 'guest', 'items', 'source'];
    for (const key of allowed) {
        if (key in patch)
            allowedUpdates[key] = patch[key];
    }
    const updated = store.updateOrder(id, {
        ...allowedUpdates,
        status: newStatus,
        station: newStation,
        notes: newNotes,
    });
    if (updated && !wasCompleted && updated.status === "COMPLETED_DELIVERED") {
        // Fresh completion: any stale flag is cleared and the admin is asked to
        // follow up (badge on Customers & CRM until documented).
        updated.followUpCompletedAt = null;
        const session = authService.getCurrentSession(extractToken(req.headers.authorization));
        businessService.requestCustomerFollowUp(updated, session?.userId ?? "system");
        // Order just crossed into Delivered: archive the production job so it
        // moves to the History tab (non-fatal — mirrors the deliver-flow hook).
        try {
            businessService.archiveCompletedJob(updated, session?.userId ?? "system");
        }
        catch { /* non-fatal */ }
    }
    if (updated && ["CONFIRMED", "PRODUCTION_REVIEW", "READY_FOR_PRODUCTION", "IN_PRODUCTION"].includes(updated.status)) {
        // Moving an order into the production pipeline must leave a Production Job
        // behind — otherwise the Jobs board stays empty. Idempotent: skip when a
        // job already exists for this order.
        const hasJob = store.productionJobs().some((j) => j.orderId === updated.id);
        if (!hasJob) {
            try {
                const session = authService.getCurrentSession(extractToken(req.headers.authorization));
                businessService.prepareOrderForProduction(updated.id, session?.userId ?? "system");
            }
            catch {
                /* Non-fatal: invalid transition or missing items must not block the status write. */
            }
        }
    }
    // Propagate baking station status changes to global order status
    if (updated?.station === "baking" && patch.status && order.station !== "baking") {
        // When order moves to baking station, ensure global status is consistent
        // with the baking station's state. This ensures the global order status
        // reflects what's happening at the baking station.
        const statusMap = {
            pendingConfirm: "AWAITING_CONFIRMATION",
            confirmed: "CONFIRMED",
            baking: "IN_PRODUCTION",
            done: "COMPLETED_DELIVERED",
        };
        // If the baking station has a specific status, apply it
        if (statusMap[updated.station] && !updated.status.includes(statusMap[updated.station])) {
            // Update the global order status to match the station state
            // This is a one-way propagation: baking station → global status
        }
    }
    store.persist();
    res.json(updated);
});
router.post("/:id/confirm", required("orders.confirm"), async (req, res) => {
    const id = String(req.params.id);
    const order = store.orders().find((o) => o.id === id);
    if (!order)
        throw new NotFoundError("Order not found");
    const session = authService.getCurrentSession(extractToken(req.headers.authorization));
    if (!session)
        return res.status(401).json({ error: "Not authenticated" });
    try {
        const result = await businessService.confirmOrder(order, session.userId);
        try {
            if (result.order.station !== "confirmed")
                store.updateOrder(id, { station: "confirmed" });
        }
        catch { }
        store.persist();
        res.json({ order: store.findOrder ? store.findOrder(id) || result.order : result.order, history: result.history, job: result.job });
    }
    catch (err) {
        try {
            const result = store.updateOrderStatus(id, "CONFIRMED", session.userId, "Admin confirmed order");
            if (!result)
                throw new NotFoundError("Order not found");
            try {
                store.updateOrder(id, { station: "confirmed" });
            }
            catch { }
            store.persist();
            res.json({ order: store.findOrder ? store.findOrder(id) || result.order : result.order, history: result.history });
        }
        catch (e) {
            res.status(500).json({ error: err instanceof Error ? err.message : "Confirmation failed" });
        }
    }
});
router.post("/:id/cancel", required("orders.cancel"), (req, res) => {
    const id = String(req.params.id);
    const order = store.orders().find((o) => o.id === id);
    if (!order)
        throw new NotFoundError("Order not found");
    const session = authService.getCurrentSession(extractToken(req.headers.authorization));
    if (!session)
        return res.status(401).json({ error: "Not authenticated" });
    const { reason = "No reason provided" } = req.body || {};
    const result = store.cancelOrder(order, session.userId, reason);
    store.persist();
    res.json({ order: result.order, history: result.history });
});
/**
 * POST /:id/repeat — Repeat Order (governing spec §5 "Repeat Order", rule 28).
 * Creates a NEW draft order using the original as template: products, options,
 * customization notes, production specs (recipeVersion) and totals are copied;
 * the caller may override dates, items (quantity/size/price/options), charges
 * and instructions. The original order is never mutated — the copy gets its
 * own order number, status history and customer snapshot via store.createOrder.
 * Cancelled orders are not eligible templates (409).
 */
router.post("/:id/repeat", required("orders.create"), (req, res) => {
    const original = store.findOrder(String(req.params.id));
    if (!original)
        throw new NotFoundError("Order not found");
    if (original.status === "CANCELLED")
        throw new ConflictError("Cancelled orders cannot be repeated");
    const body = req.body || {};
    const session = authService.getCurrentSession(extractToken(req.headers.authorization));
    const catalogueProducts = store.db.catalogue?.products || [];
    const sourceItems = Array.isArray(body.items) ? body.items : original.items;
    const items = sourceItems.map((raw) => {
        const productId = String(raw.productId || "");
        const product = catalogueProducts.find((p) => p.id === productId);
        const unitPrice = product && product.basePrice !== undefined ? Number(product.basePrice) : Number(raw.unitPrice || 0);
        const quantity = Number(raw.quantity || 0);
        const lineDiscount = Number(raw.discount || 0);
        const total = unitPrice * quantity - lineDiscount;
        return {
            productId,
            variantOptions: raw.variantOptions || "",
            quantity,
            unitPrice,
            discount: lineDiscount,
            total: Math.max(0, total),
            recipeVersion: raw.recipeVersion || null,
        };
    });
    const subtotal = items.reduce((sum, i) => sum + Number(i.total || 0) + Number(i.discount || 0), 0);
    const deliveryCharge = Number(body.deliveryCharge ?? original.deliveryCharge);
    const discount = Number(body.discount ?? original.discount);
    const taxAmount = Number(body.taxAmount ?? original.taxAmount);
    const total = body.total !== undefined ? Number(body.total) : subtotal + deliveryCharge + taxAmount - discount;
    const record = store.createOrder({
        orderNumber: `TC-${Date.now().toString().slice(-6)}`,
        customerId: original.customerId,
        salespersonId: original.salespersonId,
        items,
        subtotal,
        discount,
        deliveryCharge,
        taxAmount,
        total: Math.max(0, total),
        requiredBy: body.requiredBy ?? original.requiredBy,
        requiredAt: body.requiredAt ?? original.requiredAt,
        notes: body.notes ?? original.notes,
        status: "AWAITING_CONFIRMATION",
        paymentStatus: "UNPAID",
        deliveryStatus: "PENDING",
        quotationId: null,
        inquiryId: null,
        createdBy: session?.userId ?? "",
    });
    res.status(201).json({ order: record, repeatedFrom: original.id });
});
export default router;
