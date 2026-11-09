import { Router } from "express";
import { store } from "../database/store.js";
import { flush } from "../database/index.new.js";
import { pool } from "../database/db.js";
import { RbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { businessService } from "../services/business.service.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { paginate } from "../utils/paginate.js";
function resolveOrderRef(idOrNumber) {
    const key = String(idOrNumber || "");
    return store.orders().find((o) => o.id === key || o.orderNumber === key) || store.findOrder?.(key);
}
async function resolveOrderIdPg(idOrNumber) {
    const key = String(idOrNumber || "");
    const byId = await pool.query(`SELECT id FROM orders WHERE id = $1 LIMIT 1`, [key]);
    if (byId.rowCount)
        return byId.rows[0].id;
    const byNum = await pool.query(`SELECT id FROM orders WHERE order_number = $1 LIMIT 1`, [key]);
    if (byNum.rowCount)
        return byNum.rows[0].id;
    const mem = resolveOrderRef(key);
    return mem?.id ?? null;
}
async function persistOrderStatusPg(orderIdOrNumber, newStatus, changedBy, reason) {
    const now = new Date().toISOString();
    const histId = `osh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const prev = await pool.query(`SELECT id, status FROM orders WHERE id = $1 OR order_number = $1 LIMIT 1`, [String(orderIdOrNumber || "")]);
    if (prev.rowCount === 0)
        throw new NotFoundError("Order not found");
    const orderId = prev.rows[0].id;
    const previousStatus = prev.rows[0].status;
    await pool.query(`UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3`, [newStatus, now, orderId]);
    await pool.query(`INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, reason, timestamp, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [histId, orderId, previousStatus, newStatus, String(changedBy ?? ""), String(reason ?? ""), now, now, now]);
    const history = { id: histId, orderId, previousStatus, newStatus, changedBy: String(changedBy ?? ""), reason: String(reason ?? ""), timestamp: now, createdAt: now, updatedAt: now };
    // Keep in-memory cache aligned so the DB mirror (saveCache) cannot clobber
    // direct-PG writes, and so reads in this process reflect the transition.
    try {
        store.updateOrder(orderId, { status: newStatus, station: newStatus === "CONFIRMED" ? "confirmed" : undefined });
    }
    catch { }
    try {
        const o = store.db.orders.find((x) => x.id === orderId || x.orderNumber === orderId);
        if (o) {
            o.status = newStatus;
            o.station = newStatus === "CONFIRMED" ? "confirmed" : o.station;
            o.updatedAt = now;
        }
    }
    catch { }
    try {
        if (!Array.isArray(store.db.orderStatusHistory))
            store.db.orderStatusHistory = [];
        store.db.orderStatusHistory.push(history);
    }
    catch { }
    return { orderId, previousStatus, newStatus, history };
}
function makeServerOrderNumber(seed = "") {
    // Server-authoritative, low-collision display number. The DB has a UNIQUE
    // constraint on order_number; callers retry on 23505 if a race still occurs.
    const base = String(seed || "").trim();
    if (base && /^TC-[A-Za-z0-9-]{4,32}$/.test(base))
        return base;
    return `TC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
function isUniqueOrderNumberError(err) {
    if (err?.code !== "23505")
        return false;
    const msg = `${err?.constraint || ""} ${err?.detail || ""} ${err?.message || ""}`.toLowerCase();
    return msg.includes("order_number") || msg.includes("order number");
}
async function persistOrderToPg(record, initialHistory) {
    // Postgres mandatory: persist order + items (+ optional initial history). DB columns only.
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(`INSERT INTO orders (id,order_number,customer_id,salesperson_id,subtotal,discount,delivery_charge,tax_amount,total,currency,required_by,required_at,notes,status,payment_status,delivery_status,quotation_id,inquiry_id,created_by,delivered_at,created_at,updated_at,follow_up_completed_at,delivery_location,location_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       ON CONFLICT (id) DO NOTHING`, [record.id, record.orderNumber, record.customerId, record.salespersonId ?? null, Number(record.subtotal || 0), Number(record.discount || 0), Number(record.deliveryCharge || 0), Number(record.taxAmount || 0), Number(record.total || 0), record.currency ?? "KES", record.requiredBy ?? null, record.requiredAt ?? null, String(record.notes ?? ""), record.status, record.paymentStatus ?? "UNPAID", record.deliveryStatus ?? "PENDING", record.quotationId ?? null, record.inquiryId ?? null, String(record.createdBy ?? ""), record.deliveredAt ?? null, record.createdAt, record.updatedAt, record.followUpCompletedAt ?? null, String(record.deliveryLocation ?? ""), String(record.locationNote ?? "")]);
        for (const item of Array.isArray(record.items) ? record.items : []) {
            await client.query(`INSERT INTO order_items (id,order_id,product_id,variant_options,quantity,unit_price,discount,total,recipe_version,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING`, [item.id, record.id, item.productId, String(item.variantOptions ?? ""), Number(item.quantity || 0), Number(item.unitPrice || 0), Number(item.discount || 0), Number(item.total || 0), item.recipeVersion ?? null, item.createdAt ?? record.createdAt, item.updatedAt ?? record.updatedAt]);
        }
        if (initialHistory?.id) {
            await client.query(`INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, reason, timestamp, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`, [initialHistory.id, record.id, initialHistory.previousStatus, initialHistory.newStatus, String(initialHistory.changedBy ?? ""), String(initialHistory.reason ?? ""), initialHistory.timestamp ?? record.createdAt, initialHistory.createdAt ?? record.createdAt, initialHistory.updatedAt ?? record.updatedAt]);
        }
        await client.query("COMMIT");
    }
    catch (e) {
        try {
            await client.query("ROLLBACK");
        }
        catch { }
        throw e;
    }
    finally {
        client.release();
    }
}
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
router.get("/", required("orders.view"), (req, res) => {
    const orders = store.orders();
    const status = req.query.status;
    const customerId = req.query.customerId;
    let list = orders;
    if (customerId)
        list = list.filter((o) => o.customerId === customerId);
    if (status) {
        const statuses = String(status).split(",").map((s) => s.trim()).filter(Boolean);
        list = statuses.length > 1 ? list.filter((o) => statuses.includes(o.status)) : list.filter((o) => o.status === status);
    }
    // §33 — opt-in `?page=&pageSize=` envelope; no params → plain array (unchanged).
    res.json(paginate(list, req.query, {
        sortable: ["createdAt", "requiredBy", "total", "status"],
        dateField: "createdAt",
        searchFields: ["orderNumber", "notes"],
    }));
});
router.post("/", required("orders.create"), async (req, res) => {
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
        // Ignore optimistic client display numbers; order_number is UNIQUE in Postgres.
        orderNumber: makeServerOrderNumber(),
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
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            if (attempt > 0) {
                record.orderNumber = makeServerOrderNumber();
                try {
                    store.updateOrder(record.id, { orderNumber: record.orderNumber });
                }
                catch { }
            }
            const initialHistory = [...store.db.orderStatusHistory].reverse().find((h) => h.orderId === record.id);
            await persistOrderToPg(record, initialHistory);
            lastErr = null;
            break;
        }
        catch (err) {
            lastErr = err;
            if (!isUniqueOrderNumberError(err) || attempt === 3)
                break;
        }
    }
    if (lastErr) {
        const msg = lastErr?.message || "Failed to persist order";
        if (/connect|ECONN|timeout|database/i.test(msg))
            return res.status(503).json({ error: "Database unavailable", detail: msg });
        return res.status(500).json({ error: msg });
    }
    res.status(201).json(record);
});
router.get("/:id", required("orders.view"), (req, res) => {
    const order = resolveOrderRef(String(req.params.id));
    if (!order)
        throw new NotFoundError("Order not found");
    res.json(order);
});
router.get("/:id/history", required("orders.view"), (req, res) => {
    const order = resolveOrderRef(String(req.params.id));
    if (!order)
        throw new NotFoundError("Order not found");
    const history = store.db.orderStatusHistory;
    res.json(history.filter((h) => h.orderId === order.id));
});
router.patch("/:id", required("deliveries.update"), async (req, res) => {
    const rawId = String(req.params.id);
    let order = resolveOrderRef(rawId);
    if (!order)
        throw new NotFoundError("Order not found");
    const id = order.id;
    const patch = req.body || {};
    // ORD-01: whitelist financial/identity fields; status transitions are allowed
    // (validated + durably persisted) to support production/delivery flows (e.g.
    // "Mark Awaiting Pickup" → AWAITING_COLLECTION).
    const forbidden = ['total', 'paymentStatus', 'customerId', 'paidAt', 'balanceDue'];
    for (const key of forbidden) {
        if (key in patch) {
            return res.status(400).json({ error: `Field '${key}' cannot be updated via this endpoint` });
        }
    }
    const wasCompleted = order.status === "COMPLETED_DELIVERED";
    // Status transition (optional): validate, then persist durably to Postgres.
    if (patch.status !== undefined) {
        let nextStatus = String(patch.status || "").trim().toUpperCase().replace(/s+/g, "_");
        if (nextStatus === "AWAITING_PICKUP")
            nextStatus = "AWAITING_COLLECTION"; // legacy alias
        if (nextStatus && nextStatus !== String(order.status)) {
            try {
                businessService.validateOrderStatusTransition?.(order.status, nextStatus);
            }
            catch (err) {
                return res.status(409).json({ error: err?.message || "Invalid status transition" });
            }
            const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
            try {
                await persistOrderStatusPg(id, nextStatus, session?.userId ?? "system", String(patch.statusReason || patch.reason || "Status updated"));
            }
            catch (err) {
                if (err?.name === "NotFoundError" || err instanceof NotFoundError)
                    throw err;
                const msg = err?.message || "Failed to persist status";
                if (/connect|ECONN|timeout|database/i.test(msg))
                    return res.status(503).json({ error: "Database unavailable", detail: msg });
                return res.status(500).json({ error: msg });
            }
            // Re-read authoritative in-memory state so the response payload reflects
            // the transition, and so the client does not see a stale label on retry.
            order = store.orders().find((o) => o.id === id) || store.findOrder?.(id);
            if (order) {
                order.status = nextStatus;
                order.updatedAt = new Date().toISOString();
                if (nextStatus === "CONFIRMED" || nextStatus === "COMPLETED_DELIVERED" || nextStatus === "CANCELLED")
                    order.station = nextStatus === "CONFIRMED" ? "confirmed" : "done";
            }
        }
    }
    // Non-status field updates (allowed subset).
    const allowedUpdates = {};
    const allowed = ['notes', 'deliveryType', 'deliveryLocation', 'deliveryDate', 'deliveryTime', 'dueDate', 'dueTime', 'eventType', 'reference', 'guest', 'items', 'source', 'fulfilmentType'];
    for (const key of allowed) {
        if (key in patch)
            allowedUpdates[key] = patch[key];
    }
    let updated = order;
    if (Object.keys(allowedUpdates).length > 0) {
        updated = store.updateOrder(id, { ...allowedUpdates }) || order;
    }
    if (updated && !wasCompleted && updated.status === "COMPLETED_DELIVERED") {
        updated.followUpCompletedAt = null;
        const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
        businessService.requestCustomerFollowUp(updated, session?.userId ?? "system");
        try {
            businessService.archiveCompletedJob(updated, session?.userId ?? "system");
        }
        catch { /* non-fatal */ }
    }
    if (updated && ["CONFIRMED", "PRODUCTION_REVIEW", "READY_FOR_PRODUCTION", "IN_PRODUCTION"].includes(updated.status)) {
        const hasJob = store.productionJobs().some((j) => j.orderId === updated.id);
        if (!hasJob) {
            try {
                const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
                businessService.prepareOrderForProduction(updated.id, session?.userId ?? "system");
            }
            catch { /* Non-fatal */ }
        }
    }
    try {
        store.persist();
        await flush();
    }
    catch (err) {
        const msg = err?.message || "Failed to persist order";
        if (/connect|ECONN|timeout|database/i.test(msg))
            return res.status(503).json({ error: "Database unavailable", detail: msg });
        return res.status(500).json({ error: msg });
    }
    // Re-read so the client receives the same authoritative label the server will
    // persist to Postgres; avoids stale reads when another request mutated the
    // in-memory record between the patch and the durability gate.
    const final = store.orders().find((o) => o.id === id) || store.findOrder?.(id) || updated;
    res.json(final);
});
router.post("/:id/confirm", required("orders.confirm"), async (req, res) => {
    const rawId = String(req.params.id);
    const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
    if (!session)
        return res.status(401).json({ error: "Not authenticated" });
    try {
        // Resolve + validate against the authoritative Postgres state (accepts id or orderNumber).
        const cur = await pool.query(`SELECT id, status FROM orders WHERE id = $1 OR order_number = $1 LIMIT 1`, [rawId]);
        if (!cur.rowCount)
            throw new NotFoundError("Order not found");
        const { id: orderId, status: previousStatus } = cur.rows[0];
        if (previousStatus === "CONFIRMED") {
            const order = resolveOrderRef(orderId);
            if (order) {
                order.status = "CONFIRMED";
                order.station = "confirmed";
            }
            let job = store.productionJobs().find((j) => j.orderId === orderId) ?? null;
            if (!job) {
                try {
                    job = businessService.prepareOrderForProduction(orderId, session.userId).job;
                }
                catch { }
            }
            return res.json({ order: order || { id: orderId, status: "CONFIRMED" }, history: null, job, previousStatus, idempotent: true });
        }
        try {
            businessService.validateOrderStatusTransition?.(previousStatus, "CONFIRMED");
        }
        catch (err) {
            return res.status(409).json({ error: err?.message || "Invalid status transition" });
        }
        // Postgres mandatory for the state transition.
        const { history } = await persistOrderStatusPg(orderId, "CONFIRMED", session.userId, "Admin confirmed order");
        // Full confirm side effects (invoice, inventory reservation, notifications, audit,
        // production job) run once for the real transition; best-effort per effect.
        let job = null;
        if (previousStatus !== "CONFIRMED") {
            try {
                const orderForEffects = resolveOrderRef(orderId) || { id: orderId, status: previousStatus, orderNumber: String(rawId) };
                const out = await businessService.applyConfirmSideEffects?.({ ...orderForEffects, status: previousStatus }, session.userId);
                job = out?.job ?? null;
            }
            catch { /* non-fatal side effects */ }
        }
        if (!job) {
            try {
                job = businessService.prepareOrderForProduction(orderId, session.userId).job;
            }
            catch { }
            try {
                job = job ?? store.productionJobs().find((j) => j.orderId === orderId) ?? null;
            }
            catch { }
        }
        // Re-read authoritative in-memory state before returning.
        const order = resolveOrderRef(orderId);
        if (order) {
            order.status = "CONFIRMED";
            order.station = "confirmed";
            order.updatedAt = new Date().toISOString();
        }
        try {
            store.persist();
            await flush();
        }
        catch { /* status already in PG */ }
        return res.json({ order: order || { id: orderId, status: "CONFIRMED" }, history, job, previousStatus });
    }
    catch (err) {
        if (err?.name === "NotFoundError" || err instanceof NotFoundError)
            throw err;
        if (err?.name === "ConflictError" || err?.statusCode === 409)
            return res.status(409).json({ error: err?.message || "Invalid status transition" });
        const msg = err?.message || "Confirmation failed";
        if (/connect|ECONN|timeout|database/i.test(msg))
            return res.status(503).json({ error: "Database unavailable", detail: msg });
        return res.status(500).json({ error: msg });
    }
});
router.post("/:id/cancel", required("orders.cancel"), async (req, res) => {
    const rawId = String(req.params.id);
    const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
    if (!session)
        return res.status(401).json({ error: "Not authenticated" });
    const { reason = "No reason provided" } = req.body || {};
    try {
        const { orderId, previousStatus, history } = await persistOrderStatusPg(rawId, "CANCELLED", session.userId, String(reason));
        try {
            await pool.query(`INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, previous_status, new_status, reason, timestamp, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$9)`, [`al-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, session.userId, "order:cancelled", "order", orderId, previousStatus, "CANCELLED", String(reason), new Date().toISOString()]);
        }
        catch { /* audit best-effort */ }
        const order = resolveOrderRef(orderId);
        if (order) {
            order.status = "CANCELLED";
            order.station = "done";
        }
        try {
            store.persist();
            await flush();
        }
        catch { /* status already in PG */ }
        res.json({ order: order || { id: orderId, status: "CANCELLED" }, history });
    }
    catch (err) {
        if (err?.name === "NotFoundError" || err instanceof NotFoundError)
            throw err;
        const msg = err?.message || "Cancellation failed";
        if (/connect|ECONN|timeout|database/i.test(msg))
            return res.status(503).json({ error: "Database unavailable", detail: msg });
        return res.status(500).json({ error: msg });
    }
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
router.post("/:id/repeat", required("orders.create"), async (req, res) => {
    const original = store.findOrder(String(req.params.id));
    if (!original)
        throw new NotFoundError("Order not found");
    if (original.status === "CANCELLED")
        throw new ConflictError("Cancelled orders cannot be repeated");
    const body = req.body || {};
    const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
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
        orderNumber: makeServerOrderNumber(),
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
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            if (attempt > 0) {
                record.orderNumber = makeServerOrderNumber();
                try {
                    store.updateOrder(record.id, { orderNumber: record.orderNumber });
                }
                catch { }
            }
            const initialHistory = [...store.db.orderStatusHistory].reverse().find((h) => h.orderId === record.id);
            await persistOrderToPg(record, initialHistory);
            lastErr = null;
            break;
        }
        catch (err) {
            lastErr = err;
            if (!isUniqueOrderNumberError(err) || attempt === 3)
                break;
        }
    }
    if (lastErr) {
        const msg = lastErr?.message || "Failed to persist order";
        if (/connect|ECONN|timeout|database/i.test(msg))
            return res.status(503).json({ error: "Database unavailable", detail: msg });
        return res.status(500).json({ error: msg });
    }
    res.status(201).json({ order: record, repeatedFrom: original.id });
});
export default router;
//# sourceMappingURL=orders.js.map