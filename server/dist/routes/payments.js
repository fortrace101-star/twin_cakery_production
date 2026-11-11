import { Router } from "express";
import { store } from "../database/store.js";
import { pool } from "../database/db.js";
import { RbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";
import { makeId } from "../utils/make-id.js";
import { paginate } from "../utils/paginate.js";
import { businessService } from "../services/business.service.js";
async function recomputePaymentStatusPg(orderId) {
    await pool.query(`UPDATE orders SET payment_status = (
      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM payments WHERE order_id=$1 AND status='PENDING') THEN 'PROCESSING'
        WHEN paid <= 0 AND refunds < 0 THEN 'REFUNDED'
        WHEN paid <= 0 THEN 'UNPAID'
        WHEN paid < total THEN 'PARTIALLY_PAID'
        WHEN paid = total THEN 'PAID'
        ELSE 'OVERPAID' END
      FROM (SELECT o.total,
              COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=o.id AND status='CONFIRMED'),0) AS paid,
              COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=o.id AND status='CONFIRMED' AND kind='REFUND'),0) AS refunds
            FROM orders o WHERE o.id=$1) x
    ), updated_at = NOW() WHERE id=$1`, [orderId]);
    const r = await pool.query(`SELECT payment_status FROM orders WHERE id=$1`, [orderId]);
    return r.rows[0]?.payment_status ?? null;
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
router.get("/", required("payments.view"), (req, res) => {
    const payments = store.payments();
    const orderId = req.query.orderId;
    let list = payments;
    if (orderId)
        list = list.filter((p) => p.orderId === orderId);
    // §33 — opt-in pagination envelope (plain array without ?page=).
    res.json(paginate(list, req.query, {
        sortable: ["createdAt", "amount", "method"],
        dateField: "createdAt",
        searchFields: ["reference", "notes", "method"],
    }));
});
// ── M-Pesa STK push simulator (E4) ─────────────────────────────────────────
// The store is the source of truth for recorded payments; Safaricom is never
// reached. The frontend presses "Pay with M-Pesa" and we hand back the same
// shape the sandbox STK push returns (the mock "Pasa" simulator).
// 1. POST /payments { orderId, amount, method: "M-Pesa", receivedBy, notes }
//    -> 201 { ...payment, stagedPush: { ...mock STK push ... } }
//    `reference` is the simulation ticket (MCA-YYYYMMDD-XXXXXX) - the
//    simulator stamps one when the caller omits it. stagedPush.CheckoutRequestID
//    is the payment id, so the frontend confirms with
//    POST /payments/:id/callback.
// 2. POST /payments/:id/callback { resultCode, resultDesc, ... }
//    -> simulates the customer confirming (0) or aborting (!=0). 0 => order
//    marked PAID and an in-app notification is fired.
function buildStkPushResponse(paymentId, orderId, amount, receivedBy) {
    const appBaseUrl = process.env.APP_BASE_URL;
    if (!appBaseUrl) {
        throw new Error("APP_BASE_URL is not set — copy server/.env.example to server/.env and set it");
    }
    const phone = receivedBy && store.db.users.find((u) => u.id === receivedBy)?.phone
        ? store.db.users.find((u) => u.id === receivedBy).phone
        : "256700000000";
    void orderId;
    return {
        MerchantRequestID: makeId("REQ"),
        CheckoutRequestID: paymentId,
        ResponseDescription: "Success. Continue to checkout",
        CustomerMessage: "Success. Continue to checkout",
        CallBackURL: `${appBaseUrl}/api/v1/payments/${paymentId}/callback`,
        ResultCode: 0,
        ResultDesc: "Success",
        MerchantRequestTime: new Date().toISOString(),
        Amount: amount,
        Phone: phone,
        BillRefNumber: "",
    };
}
import { paymentsService } from "../services/payments.service.js";
router.post("/webhooks/:provider", async (req, res, next) => {
    try {
        const body = req.body || {};
        const paymentId = body.paymentId || body.CheckoutRequestID;
        if (paymentId) {
            // Postgres mandatory for payment state.
            const r = await pool.query(`SELECT order_id, status FROM payments WHERE id=$1`, [paymentId]);
            const p = r.rows[0];
            if (p && p.status === "PENDING") {
                await pool.query(`UPDATE payments SET status='CONFIRMED', updated_at=NOW() WHERE id=$1 AND status='PENDING'`, [paymentId]);
                await recomputePaymentStatusPg(p.order_id);
            }
        }
        res.json({ ok: true });
    }
    catch (err) {
        if (/connect|ECONN|timeout|database/i.test(err?.message || ""))
            return res.status(503).json({ error: "Database unavailable" });
        next(err);
    }
});
router.post("/", required("payments.record"), async (req, res, next) => {
    try {
        const { orderId, amount, method, reference, receivedBy, notes, deliveryId, invoiceId, isOverpaymentOk } = req.body || {};
        if (!orderId || amount === undefined)
            return res.status(400).json({ error: "orderId and amount are required" });
        const amt = Number(amount);
        if (!Number.isFinite(amt))
            return res.status(400).json({ error: "amount must be a valid number" });
        if (amt !== Math.round(amt))
            return res.status(400).json({ error: "amount must be a whole number (UGX)" });
        if (amt <= 0)
            return res.status(400).json({ error: "amount must be positive" });
        const key = req.header("Idempotency-Key") || req.body?.idempotencyKey;
        if (!key)
            return res.status(400).json({ error: "Idempotency-Key header required" });
        const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
        const actor = { userId: session?.userId || String(receivedBy || "admin") };
        const r = await paymentsService.recordPayment({
            orderId: String(orderId),
            amount: amt,
            method: (method || "Cash"),
            reference: reference || "",
            idempotencyKey: String(key),
            deliveryId: deliveryId || undefined,
            notes: notes || "",
            invoiceId: invoiceId || undefined,
            isOverpaymentOk: Boolean(isOverpaymentOk),
        }, actor);
        // Post-commit side effects: payment is already persisted by paymentsService.
        // Never fail the HTTP response after commit — that would look like "payment
        // failed" and cause duplicate retries with new idempotency keys.
        if ((method || "Cash") === "M-Pesa") {
            try {
                const order = store.db.orders.find((o) => o.id === orderId);
                if (order && r.payment.status !== "CONFIRMED") {
                    order.paymentStatus = "PROCESSING";
                    order.updatedAt = new Date().toISOString();
                }
            }
            catch { }
        }
        else {
            try {
                businessService.prepareOrderForProduction(String(orderId), actor.userId);
            }
            catch { }
        }
        try {
            store.createAuditLog({
                actor: actor.userId, action: "payment:created",
                entityType: "payment", entityId: r.payment.id, orderId: String(orderId),
                reason: `${method || "Cash"}${reference ? ` · ${reference}` : ""} · order ${orderId}`,
            });
        }
        catch (e) {
            console.warn("[payments] audit log failed (payment recorded):", e);
        }
        try {
            store.persist();
        }
        catch (e) {
            console.warn("[payments] store.persist failed (payment recorded):", e);
        }
        let stagedPush = null;
        if ((method || "Cash") === "M-Pesa") {
            try {
                stagedPush = buildStkPushResponse(r.payment.id, orderId, amt, actor.userId);
            }
            catch (e) {
                console.warn("[payments] staged push build failed (payment recorded):", e);
            }
        }
        res.status(r.replayed ? 200 : 201).json({ ...r.payment, stagedPush });
    }
    catch (err) {
        const statusCode = Number(err?.statusCode || err?.status);
        if (Number.isFinite(statusCode) && statusCode >= 400 && statusCode < 600) {
            return res.status(statusCode).json({ error: err.message || "Payment request failed" });
        }
        if (err?.code === "23505") {
            const msg = `${err?.constraint || ""} ${err?.detail || ""} ${err?.message || ""}`.toLowerCase();
            if (msg.includes("idempotency") || msg.includes("uq_payments_idem")) {
                return res.status(409).json({ error: "Duplicate payment request (idempotency key already used)" });
            }
            if (msg.includes("reference") || msg.includes("uq_payments_ref")) {
                return res.status(409).json({ error: "A payment with this method and reference already exists" });
            }
            return res.status(409).json({ error: "Duplicate payment record" });
        }
        if (/connect|ECONN|timeout|database/i.test(err?.message || "")) {
            return res.status(503).json({ error: "Database unavailable", detail: err?.message });
        }
        console.error("[payments] POST / failed:", err);
        return res.status(500).json({ error: err?.message || "Failed to record payment" });
    }
});
router.post("/:id/callback", required("payments.record"), async (req, res, next) => {
    try {
        const id = String(req.params.id);
        const pr = await pool.query(`SELECT * FROM payments WHERE id=$1`, [id]);
        const payment = pr.rows[0];
        if (!payment)
            throw new NotFoundError("Payment not found");
        const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
        const actor = session?.userId ?? "admin";
        const body = req.body || {};
        const resultCode = Number(body.resultCode);
        if (resultCode === 0) {
            if (payment.status === "PENDING") {
                await pool.query(`UPDATE payments SET status='CONFIRMED', updated_at=NOW() WHERE id=$1`, [id]);
                payment.status = "CONFIRMED";
            }
            const orderPaymentStatus = await recomputePaymentStatusPg(payment.order_id);
            try {
                businessService.prepareOrderForProduction(payment.order_id, actor);
            }
            catch { }
            try {
                store.createNotification({
                    eventTypeId: "PaymentReceived", title: "Payment received",
                    message: `M-Pesa payment of USh ${Number(payment.amount).toLocaleString("en-UG")} recorded against order ${payment.order_id} (reference ${payment.reference || ""}).`,
                    priority: "HIGH", entityType: "payment", entityId: id, actionUrl: "/workspace/finance#payments", deepLink: null, createdBy: actor,
                });
            }
            catch { }
            return res.json({ ok: true, payment: { ...payment, status: payment.status }, orderPaymentStatus });
        }
        else {
            if (payment.status === "PENDING") {
                await pool.query(`UPDATE payments SET status='FAILED', updated_at=NOW() WHERE id=$1`, [id]);
                payment.status = "FAILED";
            }
            const orderPaymentStatus = await recomputePaymentStatusPg(payment.order_id);
            try {
                store.createNotification({
                    eventTypeId: "PaymentReceived", title: "M-Pesa payment failed",
                    message: `Stub callback for payment ${id} returned resultCode ${resultCode}: ${body.resultDesc || "unknown reason"}. Check the reference and retry.`,
                    priority: "MEDIUM", entityType: "payment", entityId: id, actionUrl: "/workspace/finance#payments", deepLink: null, createdBy: actor,
                });
            }
            catch { }
            return res.json({ ok: true, payment: { ...payment, status: payment.status }, orderPaymentStatus });
        }
    }
    catch (err) {
        if (/connect|ECONN|timeout|database/i.test(err?.message || ""))
            return res.status(503).json({ error: "Database unavailable" });
        next(err);
    }
});
router.post("/:id/reverse", required("payments.reverse"), async (req, res, next) => {
    try {
        const id = String(req.params.id);
        const { reason, kind = "REVERSAL" } = req.body || {};
        if (!reason?.trim())
            return res.status(400).json({ error: "Reason required" });
        const session = await authService.getCurrentSession(extractToken(req.headers.authorization));
        const actor = { userId: session?.userId ?? "admin" };
        const pr = await pool.query(`SELECT * FROM payments WHERE id=$1`, [id]);
        const payment = pr.rows[0];
        if (!payment)
            throw new NotFoundError("Payment not found");
        if (payment.kind && payment.kind !== "PAYMENT")
            throw new ConflictError("Only confirmed payments can be reversed");
        if (payment.status && payment.status !== "CONFIRMED")
            throw new ConflictError("Only confirmed payments can be reversed");
        const existing = await pool.query(`SELECT 1 FROM payments WHERE reverses_payment_id=$1 LIMIT 1`, [id]);
        if ((existing.rowCount ?? 0) > 0)
            throw new ConflictError("Already reversed");
        const revId = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();
        await pool.query(`INSERT INTO payments (id,order_id,amount,method,reference,received_by,notes,kind,status,reverses_payment_id,reason,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`, [revId, payment.order_id, -Number(payment.amount || 0), payment.method, `REV-${id}`, actor.userId, String(reason), kind === "REFUND" ? "REFUND" : "REVERSAL", "CONFIRMED", id, String(reason), now]);
        const orderPaymentStatus = await recomputePaymentStatusPg(payment.order_id);
        try {
            store.createAuditLog({ actor: actor.userId, action: "payment:reversed", entityType: "payment", entityId: revId, orderId: payment.order_id, reason });
        }
        catch { }
        res.status(201).json({ id: revId, orderId: payment.order_id, amount: -Number(payment.amount || 0), method: payment.method, reference: `REV-${id}`, receivedBy: actor.userId, notes: reason, kind: kind === "REFUND" ? "REFUND" : "REVERSAL", status: "CONFIRMED", reverses_payment_id: id, reason, createdAt: now, orderPaymentStatus });
    }
    catch (err) {
        if (/connect|ECONN|timeout|database/i.test(err?.message || ""))
            return res.status(503).json({ error: "Database unavailable" });
        next(err);
    }
});
export default router;
//# sourceMappingURL=payments.js.map