import { withTransaction } from "../database/db.js";
import { store } from "../database/store.js";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors.js";
import { ledgerService } from "./ledger.service.js";
import { notificationService } from "./notification.service.js";
function assertWholeUgx(amount) {
    if (!Number.isFinite(amount))
        throw new ValidationError("Amount must be a valid number");
    if (amount !== Math.round(amount))
        throw new ValidationError("Amount must be in whole shillings (UGX)");
}
function isMobileMoney(method) {
    return method === "MTN MoMo" || method === "Airtel Money" || method === "M-Pesa";
}
async function orderBalance(tx, orderId) {
    const orderRes = await tx.query("SELECT total FROM orders WHERE id=$1", [orderId]);
    const order = orderRes.rows?.[0] || orderRes[0];
    if (!order)
        throw new NotFoundError("Order not found");
    const total = Number(order.total || 0);
    const paidRes = await tx.query("SELECT COALESCE(SUM(amount),0) as paid FROM payments WHERE order_id=$1 AND status='CONFIRMED'", [orderId]);
    const paid = Number((paidRes.rows?.[0] || paidRes[0])?.paid || 0);
    return Math.max(0, total - paid);
}
export const paymentsService = {
    async recordPayment(input, actor) {
        return withTransaction(async (tx) => {
            const orderRes = await tx.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [input.orderId]);
            const order = orderRes.rows?.[0] || orderRes[0];
            if (!order)
                throw new NotFoundError("Order not found");
            if (order.status === "CANCELLED")
                throw new ConflictError("Order is cancelled");
            assertWholeUgx(input.amount);
            if (input.amount <= 0)
                throw new ValidationError("Amount must be positive");
            if (input.method !== "Cash" && !input.reference?.trim()) {
                throw new ValidationError("Reference required for non-cash payments");
            }
            const balance = await orderBalance(tx, input.orderId);
            if (input.amount > balance && !input.isOverpaymentOk) {
                throw new ConflictError(`Amount exceeds balance ${balance}. Record it as a deposit/overpayment explicitly.`);
            }
            const existingRes = await tx.query("SELECT * FROM payments WHERE idempotency_key=$1", [input.idempotencyKey]);
            const existing = existingRes.rows?.[0] || existingRes[0];
            if (existing) {
                return { payment: existing, replayed: true };
            }
            const status = isMobileMoney(input.method) && !input.confirmedByProvider ? "PENDING" : "CONFIRMED";
            const receivedBy = actor.userId;
            const payRes = await tx.query(`INSERT INTO payments (id, order_id, amount, method, reference, received_by, notes, kind, status, idempotency_key, delivery_id, invoice_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'PAYMENT',$8,$9,$10,$11)
         RETURNING *`, [
                `pay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                input.orderId,
                input.amount,
                input.method,
                input.reference || "",
                receivedBy,
                input.notes || "",
                status,
                input.idempotencyKey,
                input.deliveryId || null,
                input.invoiceId || null,
            ]);
            const payment = payRes.rows?.[0] || payRes[0];
            if (status === "CONFIRMED") {
                try {
                    await ledgerService.postPayment(tx, payment);
                }
                catch (e) {
                    // best effort
                }
            }
            await tx.query(`UPDATE orders SET payment_status = (
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
        ), updated_at = NOW() WHERE id=$1`, [input.orderId]);
            try {
                // Persisted notifications: publish an append-only event after the payment row is committed.
                if (notificationService) {
                    notificationService.publishEvent({
                        eventTypeId: "PaymentReceived",
                        title: "Payment recorded",
                        message: `UGX ${payment.amount.toLocaleString()} received for ${input.method}${input.reference ? ` (${input.reference})` : ""} on order #${order.orderNumber}.`,
                        priority: "LOW",
                        entityType: "payment",
                        entityId: payment.id,
                        actionUrl: `/workspace/payments/${payment.id}`,
                        deepLink: `/workspace/payments/${payment.id}`,
                        createdBy: actor.userId,
                    }, {
                        userId: actor.userId,
                        role: actor.role || "admin",
                        isAdmin: true,
                    });
                }
            }
            catch (e) {
                // non-fatal: payment is already committed; just log
            }
            // Also update in-memory store for compatibility. Map snake_case DB row
            // to the camelCase cache shape so the legacy write-back (index.new.ts)
            // does not drop order_id and violate NOT NULL / corrupt finance state.
            try {
                const p = payment;
                const cachePayment = {
                    id: p.id,
                    orderId: p.orderId ?? p.order_id,
                    amount: Number(p.amount),
                    method: p.method,
                    date: p.date ?? p.received_at ?? p.created_at ?? new Date().toISOString(),
                    reference: p.reference ?? "",
                    receivedBy: p.receivedBy ?? p.received_by ?? "",
                    notes: p.notes ?? "",
                    kind: p.kind,
                    status: p.status,
                    idempotencyKey: p.idempotencyKey ?? p.idempotency_key ?? null,
                    deliveryId: p.deliveryId ?? p.delivery_id ?? null,
                    invoiceId: p.invoiceId ?? p.invoice_id ?? null,
                    reversesPaymentId: p.reversesPaymentId ?? p.reverses_payment_id ?? null,
                    reason: p.reason ?? "",
                    createdAt: p.createdAt ?? p.created_at,
                    updatedAt: p.updatedAt ?? p.updated_at,
                };
                store.db.payments = (store.db.payments || []).filter((x) => x?.id !== cachePayment.id);
                store.db.payments.push(cachePayment);
                store.recomputePaymentStatus(input.orderId);
                store.persist();
            }
            catch (e) {
                // best effort
            }
            return { payment, replayed: false };
        });
    },
};
//# sourceMappingURL=payments.service.js.map