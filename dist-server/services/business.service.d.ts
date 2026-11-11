import type { Order, OrderStatus, Payment, ProductionJob, ProductionConsumption, OrderStatusHistory } from "../database/types.js";
export declare class BusinessService {
    validateOrderStatusTransition(current: OrderStatus, next: OrderStatus): void;
    confirmOrder(order: Order, changedBy: string): Promise<{
        order: Order;
        history: OrderStatusHistory;
        job?: ProductionJob | null;
    }>;
    /**
     * Post-delivery customer follow-up (CRM). Raised the moment an order reaches
     * Completed / Delivered: an in-app notification asks the admin to follow up,
     * and the Customers & CRM module shows a sidebar badge until the follow-up is
     * documented (orders.followUpCompletedAt stamped via PATCH /orders/:id).
     */
    requestCustomerFollowUp(order: Order, changedBy: string): void;
    cancelOrder(order: Order, changedBy: string, reason: string): {
        order: Order;
        history: OrderStatusHistory;
    };
    submitOrder(order: Order, changedBy: string): {
        order: Order;
        history: OrderStatusHistory;
    };
    reserveStock(jobId: string, userId: string): void;
    markProductionStarted(jobId: string, userId: string): ProductionJob;
    /** Create a production job from an order when it reaches the confirmed station. */
    createProductionJob(order: Order, createdBy: string): ProductionJob;
    /** Propagate the baking station status to the global order status. */
    propagateBakingStatus(order: Order): void;
    completeProduction(jobId: string, userId: string): ProductionJob;
    recordQualityCheck(jobId: string, result: "PASS" | "FAIL", checkedBy: string, issues: string, notes: string, reworkRequired: boolean, reworkCost: number, wastageCaused: number): {
        job: ProductionJob;
        check: import("../database/types.js").QualityCheck;
    };
    /**
     * Production → Orders sync: the moment a job is marked Ready for delivery
     * (quality check passed), its order must switch to Ready for delivery too —
     * otherwise Orders keeps reading "In production" while Production says the
     * job is ready. The order walks FORWARD through the legal status graph
     * (CONFIRMED → PRODUCTION_REVIEW → READY_FOR_PRODUCTION → IN_PRODUCTION →
     * QUALITY_CHECK → READY_FOR_DELIVERY; a rework order re-enters at
     * QUALITY_CHECK), writing one history row per hop so every jump is one
     * validateOrderStatusTransition would accept, plus a single audit row for
     * the final move. Idempotent and non-fatal: orders already at/past Ready,
     * cancelled, or not yet in the production leg are left untouched, and a
     * missing order never fails the quality check that triggered this.
     */
    advanceOrderToReadyForDelivery(job: ProductionJob, changedBy: string): Order | undefined;
    /**
     * Cash-on-Delivery settlement (spec §14 — "Outstanding balance must be
     * calculated server-side"). Called from the delivery-completion flow: the
     * moment a delivery is marked COMPLETED_DELIVERED we credit the outstanding
     * balance and let the ledger derive the new payment status
     * (UNPAID → PARTIALLY_PAID → PAID / OVERPAID).
     *
     * PROCESSING (money in flight on an M-Pesa STK push) is deliberately left
     * untouched — that status is flipped by the Safaricom callback, not by a
     * delivery — and REFUNDED is never auto-overwritten (manual correction only).
     * Idempotent: a second call on an already-PAID order is a no-op. Mirrors the
     * `PaymentReceived` notification fired by the M-Pesa callback in
     * routes/payments.ts.
     */
    /**
     * Production → Orders sync: starting a job moves its order into
     * IN_PRODUCTION, walking forward through the legal chain and writing
     * one status history row per hop plus one audit row for the final
     * transition. Non-fatal and idempotent: an order that is already at or
     * past In production, already cancelled, or not in the production leg
     * is left untouched, and a missing order never stops a job start.
     */
    advanceOrderToInProduction(job: ProductionJob, changedBy: string): Order | undefined;
    /**
     * Deliveries → Jobs sync: when an order reaches COMPLETED_DELIVERED
     * (a delivery is marked complete), its production job is archived so the
     * board can move it off the live "Active" lane into History.
     *
     * This is the order-side mirror of the QualityCheck-pass write in
     * recordQualityCheck(): it drives the job to its terminal `COMPLETED`
     * state instead of READY_FOR_DELIVERY, then writes one audit row and
     * raises a `JobCompleted` notification. Idempotent — a job already
     * COMPLETED (or CANCELLED) is left untouched — and non-fatal so the
     * delivery-completion transaction never rolls back (callers wrap it).
     */
    archiveCompletedJob(order: Order, changedBy: string): ProductionJob | undefined;
    markOrderPaid(orderId: string, changedBy: string): {
        order: Order;
        payment: Payment | null;
    };
    recordWastage(jobId: string, itemId: string, quantity: number, unit: string, reason: string, cost: number, recordedBy: string): void;
    /**
     * Manually record materials (ingredients) used for a production job — the
     * "used materials" entry the job dialog submits. Each accepted entry
     * deducts stock (PRODUCTION_CONSUMPTION transaction), releases matching
     * reservations, writes a production_consumption row (recipe snapshot +
     * actual cost) and fires low-stock alerts; one ACTUAL cost row rolls up
     * the submission. Every entry is validated before the first write, so a
     * 409 never leaves stock half-deducted.
     * (The older recordConsumption below stays unwired — it derives entries
     * from order items and force-advances the job; this is the manual path.)
     */
    recordMaterialsUsed(jobId: string, userId: string, entries: Array<{
        itemId: string;
        quantity: number;
        notes?: string;
    }>): ProductionConsumption[];
    recordConsumption(jobId: string, userId: string): void;
    prepareOrderForProduction(orderId: string, userId: string): {
        job: ProductionJob;
    };
    startProductionForOrder(orderId: string, userId: string): {
        job: ProductionJob;
        order: Order;
    };
    /**
     * Backfill pass — every order in the production pipeline must own a
     * Production Job, or the Jobs board reads empty while the order already
     * says "Confirmed" / "In production". Covers orders stranded by the old
     * status-only PATCH (which never created jobs); runs on boot and on every
     * GET /production/jobs so the board self-heals no matter which write path
     * missed. Idempotent: orders that already carry a job are skipped.
     */
    reconcileProductionJobs(changedBy?: string): number;
}
export declare const businessService: BusinessService;
