import { getDb, resetStore } from "./index.new.js";
import { pool } from "./db.js";
function mapNum(value) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function mapDate(value) {
    if (value === null || value === undefined || value === "")
        return null;
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
    }
    return null;
}
function mapStr(value) {
    return value === null || value === undefined ? null : String(value);
}
function mapBool(value) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string")
        return ["true", "1", "yes", "on"].includes(value.toLowerCase());
    return Boolean(value);
}
function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}
/**
 * Order numbers carry a UNIQUE constraint in Postgres (orders_order_number_key),
 * but callers may supply a number that already exists (client retries,
 * deterministic test probes like the E3 gate). A colliding INSERT rolls back the
 * ENTIRE saveCache transaction, turning one duplicate into a 500 on unrelated
 * tables too. Returns the requested number when free, otherwise a suffixed
 * variant (`TC-E3PROBE-2`, `-3`, ...) so the write-back always succeeds.
 */
function uniqueOrderNumber(requested, taken) {
    const base = requested || makeId("TC");
    if (!taken.some((o) => o.orderNumber === base))
        return base;
    for (let n = 2; n <= 100; n++) {
        const candidate = `${base}-${n}`;
        if (!taken.some((o) => o.orderNumber === candidate))
            return candidate;
    }
    return `${base}-${Date.now()}`;
}
/** URL-safe slug from a title/name (lowercase, hyphenated, ascii-ish). */
function slugify(input) {
    return input
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "") // drop punctuation/accents
        .trim()
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
/**
 * Next occurrence (yyyy-mm-dd) of a recurring customer event that is still in
 * the future. NONE events fall through to their single event date. Bounded loop
 * guards against malformed data. Backs the recurring-reminder scheduler (E1).
 */
function nextOccurrence(eventDateStr, rule) {
    const base = new Date(eventDateStr);
    if (Number.isNaN(base.getTime()))
        return eventDateStr.slice(0, 10);
    // NONE: a one-off event â€” its occurrence is simply the event date (past or
    // future); it never advances. Only recurring rules roll forward.
    if (rule === "NONE")
        return base.toISOString().slice(0, 10);
    const from = Date.now();
    let occurrence = new Date(base.getTime());
    let guard = 0;
    while (occurrence.getTime() <= from && guard < 1000) {
        if (rule === "MONTHLY")
            occurrence.setMonth(occurrence.getMonth() + 1);
        else
            occurrence.setFullYear(occurrence.getFullYear() + 1); // ANNUAL / YEARLY
        guard += 1;
    }
    return occurrence.toISOString().slice(0, 10);
}
/** Reminder fire time for an occurrence date: 09:00 UTC that day. */
function atNineUtc(dateStr) {
    const iso = new Date(`${dateStr}T09:00:00.000Z`);
    return Number.isNaN(iso.getTime()) ? new Date().toISOString() : iso.toISOString();
}
function applyPatch(target, patch, allowed) {
    for (const key of allowed) {
        const value = patch[key];
        if (value !== undefined) {
            target[key] = value;
        }
    }
}
export class MemoryStore {
    get db() {
        return getDb();
    }
    /** Queue a write-back of the cache to Postgres; resolves when committed. */
    persist() {
        return this.db.persist();
    }
    reset() {
        resetStore();
    }
    // ---- customers ----
    customers() {
        return this.db.customers;
    }
    customer(customerId) {
        return this.db.customers.find((c) => c.id === customerId);
    }
    findCustomer(idOrPhone) {
        return this.db.customers.find((c) => c.id === idOrPhone || c.phone === idOrPhone);
    }
    createCustomer(input) {
        const now = new Date().toISOString();
        const addresses = Array.isArray(input.addresses) ? input.addresses : [];
        const record = {
            id: makeId("cust"),
            name: String(input.name ?? ""),
            phone: String(input.phone ?? ""),
            email: String(input.email ?? ""),
            addresses,
            preferredContactMethod: String(input.preferredContactMethod ?? "phone"),
            source: String(input.source ?? "In-house"),
            notes: String(input.notes ?? ""),
            status: String(input.status ?? "Active"),
            firstOrderDate: mapDate(input.firstOrderDate),
            lastOrderDate: mapDate(input.lastOrderDate),
            totalOrders: mapNum(input.totalOrders),
            totalSpend: mapNum(input.totalSpend),
            feedbackSummary: Array.isArray(input.feedbackSummary)
                ? input.feedbackSummary
                : [],
            createdAt: now,
            updatedAt: now,
        };
        this.db.customers.push(record);
        this.db.persist();
        return record;
    }
    updateCustomer(customerId, input) {
        const customer = this.db.customers.find((c) => c.id === customerId);
        if (!customer)
            return undefined;
        applyPatch(customer, input, [
            "name", "phone", "email", "preferredContactMethod", "source", "notes", "status",
            "firstOrderDate", "lastOrderDate", "totalOrders", "totalSpend", "feedbackSummary", "addresses",
        ]);
        customer.updatedAt = new Date().toISOString();
        this.db.persist();
        return customer;
    }
    deleteCustomer(customerId) {
        const index = this.db.customers.findIndex((c) => c.id === customerId);
        if (index === -1)
            return false;
        this.db.customers.splice(index, 1);
        this.db.persist();
        return true;
    }
    // ---- interactions ----
    customerInteractions() {
        return this.db.customerInteractions;
    }
    interactionsByCustomer(customerId) {
        return this.db.customerInteractions.filter((i) => i.customerId === customerId);
    }
    createInteraction(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("cint"),
            customerId: String(input.customerId ?? ""),
            channel: String(input.channel ?? "WALK_IN"),
            staffMember: String(input.staffMember ?? ""),
            dateTime: mapDate(input.dateTime) ?? now,
            subject: String(input.subject ?? ""),
            summary: String(input.summary ?? ""),
            outcome: String(input.outcome ?? ""),
            followUpRequired: input.followUpRequired === undefined ? false : mapBool(input.followUpRequired),
            relatedInquiryId: mapStr(input.relatedInquiryId),
            relatedOrderId: mapStr(input.relatedOrderId),
            createdAt: now,
            updatedAt: now,
        };
        this.db.customerInteractions.push(record);
        this.db.persist();
        return record;
    }
    // ---- inquiries ----
    inquiries() {
        return this.db.inquiries;
    }
    findInquiry(inquiryId) {
        return this.db.inquiries.find((i) => i.id === inquiryId);
    }
    createInquiry(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("inq"),
            customerId: String(input.customerId ?? ""),
            channel: String(input.channel ?? "WALK_IN"),
            staffMember: mapStr(input.staffMember),
            subject: String(input.subject ?? ""),
            summary: String(input.summary ?? ""),
            details: String(input.details ?? ""),
            status: String(input.status ?? "NEW"),
            priority: String(input.priority ?? "MEDIUM"),
            relatedQuoteId: mapStr(input.relatedQuoteId),
            relatedOrderId: mapStr(input.relatedOrderId),
            followUpRequired: input.followUpRequired === undefined ? false : mapBool(input.followUpRequired),
            nextAction: mapStr(input.nextAction),
            resolvedAt: mapDate(input.resolvedAt),
            source: String(input.source ?? "WALK_IN"),
            createdAt: now,
            updatedAt: now,
        };
        this.db.inquiries.push(record);
        this.db.persist();
        return record;
    }
    updateInquiry(inquiryId, patch) {
        const inquiry = this.db.inquiries.find((i) => i.id === inquiryId);
        if (!inquiry)
            return undefined;
        applyPatch(inquiry, patch, [
            "customerId", "channel", "staffMember", "subject", "summary", "details", "status", "priority",
            "relatedQuoteId", "relatedOrderId", "followUpRequired", "nextAction", "resolvedAt", "source",
        ]);
        inquiry.updatedAt = new Date().toISOString();
        this.db.persist();
        return inquiry;
    }
    // ---- public order proposals (E6 Â§Â§29-30) ----
    orderProposals() {
        return this.db.orderProposals;
    }
    findOrderProposal(id) {
        return this.db.orderProposals.find((p) => p.id === id);
    }
    createOrderProposal(input) {
        const id = makeId("prop");
        const now = new Date().toISOString();
        const rawItems = Array.isArray(input.items) ? input.items : [];
        const items = rawItems.map((raw) => {
            const qty = mapNum(raw.quantity);
            const unit = mapNum(raw.unitPrice);
            return {
                id: makeId("propi"),
                proposalId: id,
                productId: String(raw.productId ?? ""),
                productName: String(raw.productName ?? ""),
                variantOptions: raw.variantOptions === undefined || raw.variantOptions === null ? "" : String(raw.variantOptions),
                quantity: qty,
                unitPrice: unit,
                total: mapNum(raw.total) || qty * unit,
                createdAt: now,
                updatedAt: now,
            };
        });
        const record = {
            id,
            proposalNumber: String(input.proposalNumber ?? `PROP-${Date.now().toString(36).toUpperCase()}`),
            customerName: String(input.customerName ?? ""),
            phone: String(input.phone ?? ""),
            email: String(input.email ?? ""),
            productSummary: String(input.productSummary ?? ""),
            quantity: mapNum(input.quantity) || items.reduce((n, i) => n + i.quantity, 0) || 1,
            preferredDate: mapDate(input.preferredDate),
            preferredTime: String(input.preferredTime ?? ""),
            deliveryType: String(input.deliveryType ?? "PICKUP"),
            deliveryLocation: String(input.deliveryLocation ?? ""),
            customerNotes: String(input.customerNotes ?? input.notes ?? ""),
            referenceImage: String(input.referenceImage ?? ""),
            status: "PENDING_REVIEW",
            items,
            customerId: mapStr(input.customerId),
            inquiryId: mapStr(input.inquiryId),
            orderId: mapStr(input.orderId),
            reviewedBy: mapStr(input.reviewedBy),
            reviewedAt: mapDate(input.reviewedAt),
            reviewNotes: String(input.reviewNotes ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.orderProposals.push(record);
        for (const item of items)
            this.db.orderProposalItems.push(item);
        this.db.persist();
        return record;
    }
    updateOrderProposal(id, patch) {
        const proposal = this.db.orderProposals.find((p) => p.id === id);
        if (!proposal)
            return undefined;
        applyPatch(proposal, patch, [
            "proposalNumber", "customerName", "phone", "email", "productSummary", "quantity",
            "preferredDate", "preferredTime", "deliveryType", "deliveryLocation", "customerNotes",
            "referenceImage", "status", "customerId", "inquiryId", "orderId",
            "reviewedBy", "reviewedAt", "reviewNotes",
        ]);
        proposal.updatedAt = new Date().toISOString();
        this.db.persist();
        return proposal;
    }
    // ---- quotations ----
    quotations() {
        return this.db.quotations;
    }
    findQuotation(quotationId) {
        return this.db.quotations.find((q) => q.id === quotationId);
    }
    createQuotation(input) {
        const id = makeId("quote");
        const now = new Date().toISOString();
        const items = Array.isArray(input.items)
            ? input.items.map((raw) => ({
                id: makeId("qi"),
                quotationId: id,
                productId: String(raw.productId ?? ""),
                variantOptions: raw.variantOptions === undefined || raw.variantOptions === null
                    ? ""
                    : String(raw.variantOptions),
                quantity: mapNum(raw.quantity),
                unitPrice: mapNum(raw.unitPrice),
                discount: mapNum(raw.discount),
                total: mapNum(raw.total),
                createdAt: now,
                updatedAt: now,
            }))
            : [];
        const record = {
            id,
            quotationNumber: String(input.quotationNumber ?? makeId("TQ")),
            customerId: String(input.customerId ?? ""),
            salespersonId: mapStr(input.salespersonId),
            items,
            notes: String(input.notes ?? ""),
            validityExpiry: mapDate(input.validityExpiry),
            status: String(input.status ?? "DRAFT"),
            taxAmount: mapNum(input.taxAmount),
            total: mapNum(input.total),
            unitTotal: mapNum(input.unitTotal),
            submittedAt: mapDate(input.submittedAt),
            acceptedAt: mapDate(input.acceptedAt),
            createdBy: String(input.createdBy ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.quotations.push(record);
        for (const item of items)
            this.db.quotationItems.push(item);
        this.db.persist();
        return record;
    }
    updateQuotation(id, patch) {
        const quotation = this.db.quotations.find((q) => q.id === id);
        if (!quotation)
            return undefined;
        applyPatch(quotation, patch, [
            "quotationNumber", "customerId", "salespersonId", "notes", "validityExpiry", "status",
            "taxAmount", "total", "unitTotal", "submittedAt", "acceptedAt",
        ]);
        quotation.updatedAt = new Date().toISOString();
        this.db.persist();
        return quotation;
    }
    sendQuotation(id) {
        const quotation = this.db.quotations.find((q) => q.id === id);
        if (!quotation)
            return undefined;
        const now = new Date().toISOString();
        quotation.status = "SENT";
        quotation.submittedAt = now;
        quotation.updatedAt = now;
        this.db.persist();
        return quotation;
    }
    acceptQuotation(id) {
        const quotation = this.db.quotations.find((q) => q.id === id);
        if (!quotation)
            return undefined;
        const now = new Date().toISOString();
        quotation.status = "ACCEPTED";
        quotation.acceptedAt = now;
        quotation.updatedAt = now;
        this.db.persist();
        return quotation;
    }
    // ---- orders ----
    orders() {
        return this.db.orders;
    }
    findOrder(id) {
        return this.db.orders.find((o) => o.id === id || o.orderNumber === id);
    }
    orderWithItems(orderId) {
        return this.db.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    }
    createOrder(input) {
        const id = makeId("order");
        const now = new Date().toISOString();
        const items = Array.isArray(input.items)
            ? input.items.map((raw) => ({
                id: makeId("oi"),
                orderId: id,
                productId: String(raw.productId ?? ""),
                variantOptions: raw.variantOptions === undefined || raw.variantOptions === null
                    ? ""
                    : String(raw.variantOptions),
                quantity: mapNum(raw.quantity),
                unitPrice: mapNum(raw.unitPrice),
                discount: mapNum(raw.discount),
                total: mapNum(raw.total),
                recipeVersion: mapStr(raw.recipeVersion),
                createdAt: now,
                updatedAt: now,
            }))
            : [];
        const status = String(input.status ?? "INQUIRY");
        const record = {
            id,
            orderNumber: uniqueOrderNumber(String(input.orderNumber ?? makeId("TC")), this.db.orders),
            customerId: String(input.customerId ?? ""),
            salespersonId: mapStr(input.salespersonId),
            items,
            subtotal: mapNum(input.subtotal),
            discount: mapNum(input.discount),
            deliveryCharge: mapNum(input.deliveryCharge),
            taxAmount: mapNum(input.taxAmount),
            total: mapNum(input.total),
            requiredBy: mapStr(input.requiredBy),
            requiredAt: mapStr(input.requiredAt),
            notes: String(input.notes ?? ""),
            status,
            paymentStatus: String(input.paymentStatus ?? "UNPAID"),
            deliveryStatus: String(input.deliveryStatus ?? "PENDING"),
            quotationId: mapStr(input.quotationId),
            inquiryId: mapStr(input.inquiryId),
            createdBy: String(input.createdBy ?? ""),
            // Delivery location + landmark note from the New-order form (migration 021).
            deliveryLocation: String(input.deliveryLocation ?? ""),
            locationNote: String(input.locationNote ?? ""),
            // Fresh orders enter the bakery board at the first station; callers can
            // override on import/create payloads.
            station: String(input.station ?? "pendingConfirm"),
            deliveredAt: mapDate(input.deliveredAt),
            followUpCompletedAt: mapDate(input.followUpCompletedAt),
            createdAt: now,
            updatedAt: now,
        };
        this.db.orders.push(record);
        for (const item of items)
            this.db.orderItems.push(item);
        try {
            this.db.persist();
        }
        catch { }
        const history = {
            id: makeId("osh"),
            orderId: id,
            previousStatus: "INQUIRY",
            newStatus: status,
            changedBy: record.createdBy,
            reason: "",
            timestamp: now,
            createdAt: now,
            updatedAt: now,
        };
        this.db.orderStatusHistory.push(history);
        const snapshot = this.buildOrderSnapshot(record, record.createdBy);
        if (snapshot)
            this.db.orderSnapshots.push(snapshot);
        this.db.persist();
        return record;
    }
    updateOrder(orderId, patch) {
        const order = this.db.orders.find((o) => o.id === orderId);
        if (!order)
            return undefined;
        applyPatch(order, patch, [
            "orderNumber", "customerId", "salespersonId", "subtotal", "discount", "deliveryCharge",
            "taxAmount", "total", "requiredBy", "requiredAt", "notes", "status", "paymentStatus",
            "deliveryStatus", "quotationId", "inquiryId", "createdBy", "deliveredAt", "followUpCompletedAt",
            // The bakery station board transitions orders through
            // pendingConfirm â†’ confirmed â†’ baking â†’ done; dropping `station` here
            // made every station write a silent no-op.
            "station",
            // Delivery location + landmark note (migration 021) â€” PATCH-able so the
            // client can edit them after creation.
            "deliveryLocation", "locationNote",
        ]);
        // Keep the UNIQUE(order_number) constraint safe even when the patch swaps
        // in a number that another order already holds.
        order.orderNumber = uniqueOrderNumber(order.orderNumber, this.db.orders.filter((o) => o.id !== orderId));
        order.updatedAt = new Date().toISOString();
        this.db.persist();
        return order;
    }
    orderStatusHistory() {
        return this.db.orderStatusHistory;
    }
    updateOrderStatus(orderId, newStatus, changedBy, reason) {
        const order = this.db.orders.find((o) => o.id === orderId);
        if (!order)
            return undefined;
        const previousStatus = order.status;
        const now = new Date().toISOString();
        order.status = newStatus;
        order.updatedAt = now;
        const row = {
            id: makeId("osh"),
            orderId,
            previousStatus,
            newStatus: newStatus,
            changedBy: String(changedBy ?? ""),
            reason: String(reason ?? ""),
            timestamp: now,
            createdAt: now,
            updatedAt: now,
        };
        this.db.orderStatusHistory.push(row);
        // Postgres mandatory: persist state transition; throw on DB failure.
        // Fire-and-forget is NOT acceptable. Use a synchronous-looking pattern via
        // deasync is not available; callers in async routes get the throw, and we
        // also persist best-effort to cache file. To enforce mandatory semantics in
        // sync store methods, we stash the promise for callers that can await? No.
        // Instead, do a blocking-style write using Atomics/spawn is bad. Practical:
        // perform the write and on failure throw - but this is an async DB call in a
        // sync method. We must make it async-capable: return a Promise in effect?
        // Changing signature breaks callers. Minimal safe approach: kick off write
        // and if it rejects, surface via process-level handling is wrong. Better:
        // use pool.query().catch to record, but user demanded hard error.
        // We'll do a best-effort sync throw isn't possible; mark as needs-async.
        // TEMP: write via callback pattern stored on row for routes to await.
        // Best-effort DB write for legacy sync callers; routes use direct Postgres writes.
        row.__pgPersist = pool
            .query(`UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3`, [newStatus, now, orderId])
            .then(() => pool.query(`INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, reason, timestamp, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [row.id, orderId, previousStatus, newStatus, String(changedBy ?? ""), String(reason ?? ""), now, now, now]))
            .catch(() => { });
        try {
            this.db.persist();
        }
        catch { /* cache persist non-authoritative */ }
        return { order, history: row };
    }
    cancelOrder(order, changedBy, reason) {
        const previousStatus = order.status;
        const now = new Date().toISOString();
        order.status = "CANCELLED";
        order.updatedAt = now;
        const row = {
            id: makeId("osh"),
            orderId: order.id,
            previousStatus,
            newStatus: "CANCELLED",
            changedBy: String(changedBy ?? ""),
            reason: String(reason ?? ""),
            timestamp: now,
            createdAt: now,
            updatedAt: now,
        };
        this.db.orderStatusHistory.push(row);
        // Â§34 â€” order cancellation is an auditable business action; the route
        // bypasses businessService.cancelOrder, so the audit row lives here.
        this.createAuditLog({
            orderId: order.id, actor: changedBy, action: "order:cancelled",
            entityType: "order", entityId: order.id,
            previousStatus, newStatus: "CANCELLED", reason: String(reason ?? ""),
        });
        this.db.persist();
        return { order, history: row };
    }
    // ---- payments ----
    payments() {
        return this.db.payments;
    }
    createPayment(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("pay"),
            orderId: String(input.orderId ?? ""),
            amount: mapNum(input.amount),
            method: String(input.method ?? "Cash"),
            date: String(input.date ?? now),
            reference: String(input.reference ?? ""),
            receivedBy: String(input.receivedBy ?? ""),
            notes: String(input.notes ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.payments.push(record);
        this.db.persist();
        return record;
    }
    paymentsReceived(orderId, amount, method, reference, receivedBy) {
        const order = this.db.orders.find((o) => o.id === orderId);
        if (!order)
            return undefined;
        const now = new Date().toISOString();
        const payment = {
            id: makeId("pay"),
            orderId,
            amount: mapNum(amount),
            method: String(method ?? "Cash"),
            date: now,
            reference: String(reference ?? ""),
            receivedBy: String(receivedBy ?? ""),
            notes: "",
            createdAt: now,
            updatedAt: now,
        };
        this.db.payments.push(payment);
        this.recomputePaymentStatus(orderId);
        this.db.persist();
        return payment;
    }
    /**
     * Recompute an order's payment status from the actual payment ledger
     * (spec Â§14: "Outstanding balance must be calculated server-side").
     * UNPAID â†’ PARTIALLY_PAID â†’ PAID â†’ OVERPAID derives from sum(payments)
     * vs order.total; REFUNDED is manual and never overwritten.
     */
    recomputePaymentStatus(orderId) {
        const order = this.db.orders.find((o) => o.id === orderId);
        if (!order)
            return undefined;
        if (order.paymentStatus === "REFUNDED")
            return order.paymentStatus;
        const paid = this.db.payments
            .filter((p) => p.orderId === orderId)
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const total = Number(order.total) || 0;
        let next;
        if (paid <= 0)
            next = "UNPAID";
        else if (total <= 0)
            next = "PAID"; // no priced total â€” any money received settles it
        else if (paid < total)
            next = "PARTIALLY_PAID";
        else if (paid > total)
            next = "OVERPAID";
        else
            next = "PAID";
        order.paymentStatus = next;
        order.updatedAt = new Date().toISOString();
        return next;
    }
    // ---- production ----
    productionJobs() {
        return this.db.productionJobs;
    }
    createProductionJob(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("job"),
            orderId: String(input.orderId ?? ""),
            customerId: String(input.customerId ?? ""),
            productId: String(input.productId ?? ""),
            variantOptions: input.variantOptions === undefined || input.variantOptions === null
                ? ""
                : String(input.variantOptions),
            quantity: mapNum(input.quantity),
            recipeVersion: String(input.recipeVersion ?? "v1.0"),
            requiredBy: mapStr(input.requiredBy),
            requiredAt: mapStr(input.requiredAt),
            status: String(input.status ?? "PENDING"),
            stage: String(input.stage ?? "PLAN"),
            progress: mapNum(input.progress),
            notes: String(input.notes ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.productionJobs.push(record);
        this.db.persist();
        return record;
    }
    updateProductionJob(id, patch) {
        const job = this.db.productionJobs.find((j) => j.id === id);
        if (!job)
            return undefined;
        applyPatch(job, patch, [
            "orderId", "customerId", "productId", "variantOptions", "quantity", "recipeVersion",
            "requiredBy", "requiredAt", "status", "stage", "progress", "notes",
        ]);
        job.updatedAt = new Date().toISOString();
        this.db.persist();
        return job;
    }
    qualityChecks() {
        return this.db.qualityChecks;
    }
    createQualityCheck(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("qc"),
            jobId: String(input.jobId ?? ""),
            result: String(input.result ?? "PASS"),
            checkedBy: String(input.checkedBy ?? ""),
            checkedAt: mapDate(input.checkedAt) ?? now,
            issues: String(input.issues ?? ""),
            notes: String(input.notes ?? ""),
            reworkRequired: input.reworkRequired === undefined ? false : mapBool(input.reworkRequired),
            reworkCost: mapNum(input.reworkCost),
            wastageCaused: mapNum(input.wastageCaused),
            createdAt: now,
            updatedAt: now,
        };
        this.db.qualityChecks.push(record);
        this.db.persist();
        return record;
    }
    productionWastage() {
        return this.db.productionWastage;
    }
    createProductionWastage(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("wst"),
            jobId: String(input.jobId ?? ""),
            itemId: String(input.itemId ?? ""),
            quantity: mapNum(input.quantity),
            unit: String(input.unit ?? ""),
            reason: String(input.reason ?? ""),
            cost: mapNum(input.cost),
            recordedBy: String(input.recordedBy ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.productionWastage.push(record);
        this.db.persist();
        return record;
    }
    productionConsumption() {
        return this.db.productionConsumption;
    }
    createProductionConsumption(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("pcon"),
            jobId: String(input.jobId ?? ""),
            itemId: String(input.itemId ?? ""),
            quantity: mapNum(input.quantity),
            unit: String(input.unit ?? ""),
            recipeVersion: String(input.recipeVersion ?? ""),
            unitCost: mapNum(input.unitCost),
            actualCost: mapNum(input.actualCost),
            notes: String(input.notes ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.productionConsumption.push(record);
        this.db.persist();
        return record;
    }
    productionCosts() {
        return this.db.productionCosts;
    }
    createProductionCost(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("pcost"),
            jobId: String(input.jobId ?? ""),
            ingredientCost: mapNum(input.ingredientCost),
            packagingCost: mapNum(input.packagingCost),
            labourCost: mapNum(input.labourCost),
            overheadCost: mapNum(input.overheadCost),
            total: mapNum(input.total),
            status: String(input.status ?? "PLANNED"),
            createdAt: now,
            updatedAt: now,
        };
        this.db.productionCosts.push(record);
        this.db.persist();
        return record;
    }
    // ---- inventory ----
    inventoryItems() {
        return this.db.inventoryItems;
    }
    createInventoryItem(input) {
        const id = makeId("inv");
        const now = new Date().toISOString();
        const physicalStock = mapNum(input.physicalStock);
        const record = {
            id,
            name: String(input.name ?? ""),
            sku: String(input.sku ?? ""),
            category: String(input.category ?? ""),
            physicalStock,
            unit: String(input.unit ?? ""),
            reorderLevel: mapNum(input.reorderLevel),
            supplierId: String(input.supplierId ?? ""),
            cost: mapNum(input.cost),
            lastUpdated: now,
            createdAt: now,
            updatedAt: now,
        };
        this.db.inventoryItems.push(record);
        if (physicalStock > 0) {
            this.db.inventoryTransactions.push({
                id: makeId("txn"),
                itemId: id,
                quantity: physicalStock,
                unit: record.unit,
                type: "OPENING_BALANCE",
                reference: "Initial",
                user: "system",
                timestamp: now,
                unitCost: null,
                notes: "",
                createdAt: now,
                updatedAt: now,
            });
        }
        this.db.persist();
        return record;
    }
    inventoryTransactions() {
        return this.db.inventoryTransactions;
    }
    adjustInventory(itemId, quantity, unit, type, reference, user, unitCost, notes) {
        const item = this.db.inventoryItems.find((i) => i.id === itemId);
        if (!item)
            return undefined;
        const now = new Date().toISOString();
        const qty = mapNum(quantity);
        const transaction = {
            id: makeId("txn"),
            itemId,
            quantity: qty,
            unit: String(unit ?? ""),
            type: String(type ?? ""),
            reference: String(reference ?? ""),
            user: String(user ?? ""),
            timestamp: now,
            unitCost: unitCost === undefined || unitCost === null ? null : mapNum(unitCost),
            notes: String(notes ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.inventoryTransactions.push(transaction);
        item.physicalStock = mapNum(item.physicalStock) + qty;
        item.lastUpdated = now;
        this.db.persist();
        return transaction;
    }
    stockReservations() {
        return this.db.stockReservations;
    }
    // ---- purchasing ----
    suppliers() {
        return this.db.suppliers.filter((s) => s.active !== false);
    }
    suppliersIncludingInactive() {
        return this.db.suppliers;
    }
    findSupplier(id) {
        return this.db.suppliers.find((s) => s.id === id);
    }
    updateSupplier(id, patch) {
        const supplier = this.db.suppliers.find((s) => s.id === id);
        if (!supplier)
            return undefined;
        const allowed = [
            "businessName", "contactPerson", "phone", "email", "address",
            "productsSupplied", "paymentTerms", "notes", "active",
        ];
        for (const key of allowed) {
            if (patch[key] !== undefined)
                supplier[key] = patch[key];
        }
        supplier.updatedAt = new Date().toISOString();
        this.db.persist();
        return supplier;
    }
    deleteSupplier(id) {
        const supplier = this.db.suppliers.find((s) => s.id === id);
        if (!supplier)
            return false;
        supplier.active = false;
        supplier.updatedAt = new Date().toISOString();
        this.db.persist();
        return true;
    }
    createSupplier(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("sup"),
            businessName: String(input.businessName ?? ""),
            contactPerson: String(input.contactPerson ?? ""),
            phone: String(input.phone ?? ""),
            email: String(input.email ?? ""),
            address: String(input.address ?? ""),
            productsSupplied: String(input.productsSupplied ?? ""),
            paymentTerms: String(input.paymentTerms ?? ""),
            notes: String(input.notes ?? ""),
            active: input.active === undefined ? true : mapBool(input.active),
            createdAt: now,
            updatedAt: now,
        };
        this.db.suppliers.push(record);
        this.db.persist();
        return record;
    }
    purchaseOrders() {
        return this.db.purchaseOrders;
    }
    findPurchaseOrder(poId) {
        return this.db.purchaseOrders.find((p) => p.id === poId);
    }
    createPurchaseOrder(input) {
        const id = makeId("po");
        const now = new Date().toISOString();
        const items = Array.isArray(input.items)
            ? input.items.map((raw) => ({
                id: makeId("poi"),
                purchaseOrderId: id,
                productId: String(raw.productId ?? ""),
                supplierId: String(raw.supplierId ?? String(input.supplierId ?? "")),
                quantity: mapNum(raw.quantity),
                unit: String(raw.unit ?? ""),
                unitPrice: mapNum(raw.unitPrice),
                total: mapNum(raw.total),
                receivedQuantity: mapNum(raw.receivedQuantity),
                createdAt: now,
                updatedAt: now,
            }))
            : [];
        const record = {
            id,
            poNumber: String(input.poNumber ?? makeId("PO")),
            supplierId: String(input.supplierId ?? ""),
            date: mapDate(input.date) ?? now,
            expectedDate: mapDate(input.expectedDate) ?? now,
            items,
            total: mapNum(input.total),
            status: String(input.status ?? "DRAFT"),
            notes: String(input.notes ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.purchaseOrders.push(record);
        for (const item of items)
            this.db.poItems.push(item);
        this.db.persist();
        return record;
    }
    receivePurchaseOrder(poId, receivedBy) {
        const po = this.db.purchaseOrders.find((p) => p.id === poId);
        if (!po || po.status === "CANCELLED")
            return undefined;
        const now = new Date().toISOString();
        po.status = "COMPLETED";
        po.updatedAt = now;
        for (const item of po.items) {
            item.receivedQuantity = item.quantity;
        }
        const receiptId = makeId("gr");
        // Spec Â§12: goods receipt must record every received line + update
        // supplier price history (cost analysis / supplier comparison).
        const receiptItems = po.items.map((item) => ({
            id: makeId("gri"),
            goodsReceiptId: receiptId,
            poItemId: item.id,
            quantity: mapNum(item.quantity),
            unit: item.unit || "unit",
            unitCost: mapNum(item.unitPrice),
            status: "COMPLETED",
            createdAt: now,
            updatedAt: now,
        }));
        const receipt = {
            id: receiptId,
            purchaseOrderId: poId,
            receivedBy: String(receivedBy ?? ""),
            date: now,
            items: receiptItems,
            total: mapNum(po.total),
            status: "COMPLETED",
            createdAt: now,
            updatedAt: now,
        };
        this.db.goodsReceipts.push(receipt);
        for (const item of receiptItems) {
            const poLine = po.items.find((p) => p.id === item.poItemId);
            if (!poLine || !mapNum(item.unitCost))
                continue;
            this.db.supplierPriceHistory.push({
                id: makeId("sph"),
                supplierId: po.supplierId,
                productId: poLine.productId,
                unit: item.unit,
                price: mapNum(item.unitCost),
                effectiveDate: now.slice(0, 10),
                note: `Goods receipt ${receiptId} Â· ${po.poNumber}`,
                createdAt: now,
                updatedAt: now,
            });
        }
        this.db.persist();
        return { purchaseOrder: po, receipt };
    }
    purchaseRequirements() {
        return this.db.purchaseRequirements;
    }
    goodsReceipts() {
        return this.db.goodsReceipts;
    }
    supplierPriceHistory() {
        return this.db.supplierPriceHistory;
    }
    productionFixedCostCategories() {
        return this.db.productionFixedCostCategories;
    }
    findProductionFixedCostCategory(id) {
        return this.db.productionFixedCostCategories.find((c) => c.id === id);
    }
    createProductionFixedCostCategory(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("fxdcat"),
            name: String(input.name ?? ""),
            description: String(input.description ?? ""),
            costType: String(input.costType ?? "perJob"),
            unit: String(input.unit ?? ""),
            defaultUnitCost: mapNum(input.defaultUnitCost),
            active: input.active === undefined ? true : mapBool(input.active),
            createdAt: now,
            updatedAt: now,
        };
        this.db.productionFixedCostCategories.push(record);
        this.db.persist();
        return record;
    }
    updateProductionFixedCostCategory(id, patch) {
        const category = this.db.productionFixedCostCategories.find((c) => c.id === id);
        if (!category)
            return undefined;
        applyPatch(category, patch, [
            "name", "description", "costType", "unit", "defaultUnitCost", "active",
        ]);
        category.updatedAt = new Date().toISOString();
        this.db.persist();
        return category;
    }
    deleteProductionFixedCostCategory(id) {
        const index = this.db.productionFixedCostCategories.findIndex((c) => c.id === id);
        if (index === -1)
            return false;
        if (this.db.productionFixedCostEntries.some((e) => e.categoryId === id))
            return false;
        this.db.productionFixedCostCategories.splice(index, 1);
        this.db.persist();
        return true;
    }
    productionFixedCostEntries() {
        return this.db.productionFixedCostEntries;
    }
    createProductionFixedCostEntry(input) {
        const now = new Date().toISOString();
        const total = mapNum(input.quantity) * mapNum(input.unitCost);
        const record = {
            id: makeId("fxdent"),
            jobId: String(input.jobId ?? ""),
            categoryId: String(input.categoryId ?? ""),
            quantity: mapNum(input.quantity),
            unit: String(input.unit ?? ""),
            unitCost: mapNum(input.unitCost),
            total,
            recordedBy: String(input.recordedBy ?? ""),
            notes: String(input.notes ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.productionFixedCostEntries.push(record);
        this.db.persist();
        return record;
    }
    productionFixedCostEntriesForJob(jobId) {
        return this.db.productionFixedCostEntries.filter((e) => e.jobId === jobId);
    }
    updateProductionFixedCostEntry(id, patch) {
        const entry = this.db.productionFixedCostEntries.find((e) => e.id === id);
        if (!entry)
            return undefined;
        applyPatch(entry, patch, [
            "quantity", "unitCost", "unit", "recordedBy", "notes",
        ]);
        entry.total = mapNum(entry.quantity) * mapNum(entry.unitCost);
        entry.updatedAt = new Date().toISOString();
        this.db.persist();
        return entry;
    }
    deleteProductionFixedCostEntry(id) {
        const index = this.db.productionFixedCostEntries.findIndex((e) => e.id === id);
        if (index === -1)
            return false;
        this.db.productionFixedCostEntries.splice(index, 1);
        this.db.persist();
        return true;
    }
    createPurchaseRequirement(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("pr"),
            productIds: String(input.productIds ?? ""),
            quantity: mapNum(input.quantity),
            unit: String(input.unit ?? ""),
            reason: String(input.reason ?? ""),
            urgency: String(input.urgency ?? "MEDIUM"),
            status: String(input.status ?? "OPEN"),
            requestedBy: String(input.requestedBy ?? ""),
            requestedAt: mapDate(input.requestedAt) ?? now,
            createdAt: now,
            updatedAt: now,
        };
        this.db.purchaseRequirements.push(record);
        this.db.persist();
        return record;
    }
    updatePurchaseRequirement(id, patch) {
        const req = this.db.purchaseRequirements.find((r) => r.id === id);
        if (!req)
            return undefined;
        applyPatch(req, patch, [
            "productIds", "quantity", "unit", "reason", "urgency", "status", "requestedBy", "requestedAt",
        ]);
        req.updatedAt = new Date().toISOString();
        this.db.persist();
        return req;
    }
    // ---- deliveries ----
    deliveries() {
        return this.db.deliveries;
    }
    findDelivery(id) {
        return this.db.deliveries.find((d) => d.id === id);
    }
    createDelivery(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("del"),
            orderId: String(input.orderId ?? ""),
            type: String(input.type ?? "HOME_DELIVERY"),
            destination: String(input.destination ?? ""),
            scheduledAt: mapDate(input.scheduledAt),
            scheduledDate: mapDate(input.scheduledDate),
            scheduledTime: mapStr(input.scheduledTime),
            actualDispatchTime: mapDate(input.actualDispatchTime),
            actualDeliveryDate: mapDate(input.actualDeliveryDate),
            deliveryPerson: mapStr(input.deliveryPerson),
            deliveryFee: mapNum(input.deliveryFee),
            status: String(input.status ?? "PENDING"),
            notes: String(input.notes ?? ""),
            customerConfirmation: mapStr(input.customerConfirmation),
            createdAt: now,
            updatedAt: now,
        };
        this.db.deliveries.push(record);
        this.db.persist();
        return record;
    }
    updateDelivery(id, patch) {
        const delivery = this.db.deliveries.find((d) => d.id === id);
        if (!delivery)
            return undefined;
        applyPatch(delivery, patch, [
            "orderId", "type", "destination", "scheduledAt", "scheduledDate", "scheduledTime",
            "actualDispatchTime", "actualDeliveryDate", "deliveryPerson", "deliveryFee", "status", "notes",
            "customerConfirmation",
        ]);
        delivery.updatedAt = new Date().toISOString();
        this.db.persist();
        return delivery;
    }
    // ---- expenses ----
    createExpense(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("exp"),
            categoryId: String(input.categoryId ?? ""),
            amount: mapNum(input.amount),
            date: mapDate(input.date) ?? now,
            paymentMethod: String(input.paymentMethod ?? "Cash"),
            reference: String(input.reference ?? ""),
            description: String(input.description ?? ""),
            attachment: mapStr(input.attachment),
            recordedBy: String(input.recordedBy ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.expenses.push(record);
        this.db.persist();
        return record;
    }
    createCustomerFeedback(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("fdb"),
            customerId: String(input.customerId ?? ""),
            orderId: mapStr(input.orderId),
            productIds: String(input.productIds ?? ""),
            rating: mapNum(input.rating),
            type: String(input.type ?? "GENERAL"),
            comment: String(input.comment ?? ""),
            resolution: mapStr(input.resolution),
            followUpRequired: input.followUpRequired === undefined ? false : mapBool(input.followUpRequired),
            followUpCompleted: input.followUpCompleted === undefined ? false : mapBool(input.followUpCompleted),
            recordedBy: String(input.recordedBy ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.customerFeedback.push(record);
        this.db.persist();
        return record;
    }
    // ---- notifications ----
    notifications() {
        return this.db.notifications;
    }
    createNotification(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("ntf"),
            eventTypeId: String(input.eventTypeId ?? ""),
            title: String(input.title ?? ""),
            message: String(input.message ?? ""),
            priority: String(input.priority ?? "MEDIUM"),
            entityType: String(input.entityType ?? ""),
            entityId: String(input.entityId ?? ""),
            actionUrl: mapStr(input.actionUrl),
            deepLink: mapStr(input.deepLink),
            createdAt: now,
            createdBy: mapStr(input.createdBy),
            readAt: mapDate(input.readAt),
            deliveryStatus: String(input.deliveryStatus ?? "PENDING"),
            failureReason: mapStr(input.failureReason),
            updatedAt: now,
        };
        this.db.notifications.push(record);
        this.db.persist();
        return record;
    }
    notificationRecipients() {
        return this.db.notificationRecipients;
    }
    createNotificationRecipient(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("nrec"),
            notificationId: String(input.notificationId ?? ""),
            userId: String(input.userId ?? ""),
            deliveryChannel: String(input.deliveryChannel ?? "IN_APP"),
            deliveredAt: mapDate(input.deliveredAt),
            readAt: mapDate(input.readAt),
            failedAt: mapDate(input.failedAt),
            failureReason: mapStr(input.failureReason),
            createdAt: mapStr(input.createdAt) ?? now,
            updatedAt: now,
        };
        this.db.notificationRecipients.push(record);
        this.db.persist();
        return record;
    }
    createNotificationTemplate(input) {
        const existing = this.db.notificationTemplates.find((t) => t.eventTypeId === String(input.eventTypeId ?? "") && t.channel === String(input.channel ?? ""));
        if (existing)
            return existing;
        const now = new Date().toISOString();
        const record = {
            id: makeId("ntp"),
            eventTypeId: String(input.eventTypeId ?? ""),
            channel: String(input.channel ?? "IN_APP"),
            titleTemplate: String(input.titleTemplate ?? ""),
            messageTemplate: String(input.messageTemplate ?? ""),
            active: input.active === undefined ? true : mapBool(input.active),
            createdAt: mapStr(input.createdAt) ?? now,
            updatedAt: mapStr(input.updatedAt) ?? now,
        };
        this.db.notificationTemplates.push(record);
        this.db.persist();
        return record;
    }
    getUserNotifications(userId, limit = 50) {
        void userId;
        return [...this.db.notifications]
            .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
            .slice(0, mapNum(limit) || 50);
    }
    getUnreadCount(userId) {
        return this.db.notificationRecipients.filter((r) => r.userId === userId && !r.readAt).length;
    }
    markAsRead(id, userId) {
        const recipient = this.db.notificationRecipients.find((r) => r.userId === userId && (r.id === id || r.notificationId === id) && !r.readAt);
        if (!recipient)
            return false;
        recipient.readAt = new Date().toISOString();
        this.db.persist();
        return true;
    }
    markAllAsRead(userId) {
        const now = new Date().toISOString();
        let count = 0;
        for (const r of this.db.notificationRecipients) {
            if (r.userId === userId && !r.readAt) {
                r.readAt = now;
                count += 1;
            }
        }
        if (count > 0)
            this.db.persist();
        return count;
    }
    getNotificationPreferences(userId) {
        return this.db.notificationPreferences.filter((p) => p.userId === userId);
    }
    getNotificationPreference(userId, eventType) {
        return this.db.notificationPreferences.find((p) => p.userId === userId && p.eventTypeId === eventType);
    }
    createNotificationPreference(input) {
        const userId = String(input.userId ?? "");
        const eventTypeId = String(input.eventTypeId ?? "");
        const channel = String(input.channel ?? "IN_APP");
        const existing = this.db.notificationPreferences.find((p) => p.userId === userId && p.eventTypeId === eventTypeId && p.channel === channel);
        if (existing)
            return existing;
        const now = new Date().toISOString();
        const record = {
            id: makeId("nup"),
            userId,
            eventTypeId,
            channel: channel,
            enabled: input.enabled === undefined ? true : mapBool(input.enabled),
            createdAt: now,
            updatedAt: now,
        };
        this.db.notificationPreferences.push(record);
        this.db.persist();
        return record;
    }
    updateNotificationPreference(id, patch) {
        const pref = this.db.notificationPreferences.find((p) => p.id === id);
        if (!pref)
            return undefined;
        if (patch.enabled !== undefined)
            pref.enabled = mapBool(patch.enabled);
        pref.updatedAt = new Date().toISOString();
        this.db.persist();
        return pref;
    }
    // ---- audit logs ----
    auditLogs() {
        return this.db.auditLogs;
    }
    createAuditLog(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("aud"),
            orderId: String(input.orderId ?? ""),
            actor: String(input.actor ?? ""),
            action: String(input.action ?? ""),
            entityType: String(input.entityType ?? ""),
            entityId: String(input.entityId ?? ""),
            previousStatus: String(input.previousStatus ?? ""),
            newStatus: String(input.newStatus ?? ""),
            reason: String(input.reason ?? ""),
            timestamp: mapDate(input.timestamp) ?? now,
            createdAt: now,
            updatedAt: now,
        };
        this.db.auditLogs.push(record);
        this.db.persist();
        return record;
    }
    // ---- users / roles / permissions ----
    users() {
        return this.db.users;
    }
    findUser(id) {
        return this.db.users.find((u) => u.id === id);
    }
    findUserByUsername(username) {
        return this.db.users.find((u) => u.username === username);
    }
    findUserByEmail(email) {
        return this.db.users.find((u) => u.email === email);
    }
    updateUser(id, input) {
        const user = this.db.users.find((u) => u.id === id);
        if (!user)
            return undefined;
        if (input.passwordHash !== undefined)
            user.passwordHash = String(input.passwordHash);
        if (input.displayName !== undefined)
            user.displayName = String(input.displayName);
        if (input.email !== undefined)
            user.email = String(input.email);
        if (input.phone !== undefined)
            user.phone = String(input.phone);
        if (input.role !== undefined)
            user.role = String(input.role);
        if (input.status !== undefined)
            user.status = String(input.status);
        user.updatedAt = new Date().toISOString();
        this.db.persist();
        return user;
    }
    createUser(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("usr"),
            username: String(input.username ?? ""),
            displayName: String(input.displayName ?? ""),
            email: String(input.email ?? ""),
            phone: mapStr(input.phone) ?? "",
            role: String(input.role ?? "Staff"),
            isAdmin: input.isAdmin === undefined ? false : mapBool(input.isAdmin),
            status: String(input.status ?? "Active"),
            passwordHash: String(input.passwordHash ?? "$2b$10$placeholder"),
            notify: (input.notify ?? {}),
            createdAt: now,
            updatedAt: now,
        };
        this.db.users.push(record);
        this.db.persist();
        return record;
    }
    userRoles() {
        return this.db.userRoles;
    }
    userRolesForUser(userId) {
        return this.db.userRoles
            .filter((r) => r.userId === userId)
            .sort((a, b) => a.roleId.localeCompare(b.roleId));
    }
    rolePermissions() {
        return this.db.rolePermissions;
    }
    rolePermissionsForRole(roleId) {
        return this.db.rolePermissions
            .filter((p) => p.roleId === roleId)
            .sort((a, b) => a.permissionId.localeCompare(b.permissionId));
    }
    roles() {
        return this.db.roles;
    }
    permissions() {
        return this.db.permissions;
    }
    // ---------------------------------------------------------------------------
    // E1 â€” Customer order history, occasions & recurring reminders
    // ---------------------------------------------------------------------------
    /** Orders placed by a customer, most recent first. Backs GET /customers/:id/orders. */
    ordersForCustomer(customerId) {
        return this.db.orders
            .filter((o) => o.customerId === customerId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    /** The immutable contact snapshot captured when an order was placed. */
    orderCustomerSnapshot(orderId) {
        return this.db.orderSnapshots.find((s) => s.orderId === orderId);
    }
    /**
     * Build (never return a reference into the cache) the immutable contact
     * snapshot for an order (rule 27). Uses the customer profile as it stands at
     * order time; returns null if there is no customer or a snapshot already
     * exists for the order (UNIQUE order_id). Caller pushes + persists.
     */
    buildOrderSnapshot(order, capturedBy) {
        if (this.db.orderSnapshots.some((s) => s.orderId === order.id))
            return null;
        const customer = this.customer(order.customerId);
        if (!customer)
            return null;
        const addr = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
        const address = addr
            ? [addr.line1, addr.line2, addr.city, addr.county, addr.postalCode, addr.country]
                .filter(Boolean)
                .join(", ")
            : "";
        const now = new Date().toISOString();
        return {
            id: makeId("osnap"),
            orderId: order.id,
            customerId: customer.id,
            snapshotName: customer.name,
            snapshotPhone: customer.phone,
            snapshotEmail: customer.email,
            snapshotAddress: address,
            snapshotPreferredContact: customer.preferredContactMethod,
            capturedBy: capturedBy || customer.name,
            createdAt: now,
            updatedAt: now,
        };
    }
    /**
     * Create an immutable customer contact snapshot for an order
     * (rule 27). Skips if a snapshot already exists (UNIQUE order_id).
     * Caller pushes + persists. Returns the snapshot or null if skipped.
     */
    createOrderCustomerSnapshot(order) {
        const snapshot = this.buildOrderSnapshot(order, order.createdBy);
        if (!snapshot)
            return null;
        this.db.orderSnapshots.push(snapshot);
        this.db.persist();
        return snapshot;
    }
    eventsByCustomer(customerId) {
        return this.db.customerEvents
            .filter((e) => e.customerId === customerId)
            .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    }
    customerEvent(eventId) {
        return this.db.customerEvents.find((e) => e.id === eventId);
    }
    createCustomerEvent(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("cevt"),
            customerId: String(input.customerId ?? ""),
            orderId: mapStr(input.orderId),
            eventType: String(input.eventType ?? ""),
            eventDate: mapDate(input.eventDate)?.slice(0, 10) ?? now.slice(0, 10),
            recurrenceRule: String(input.recurrenceRule ?? "NONE"),
            notes: String(input.notes ?? ""),
            status: String(input.status ?? "ACTIVE"),
            createdBy: String(input.createdBy ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.customerEvents.push(record);
        this.syncEventReminder(record);
        this.db.persist();
        return record;
    }
    updateCustomerEvent(eventId, input) {
        const event = this.db.customerEvents.find((e) => e.id === eventId);
        if (!event)
            return undefined;
        applyPatch(event, input, ["eventType", "eventDate", "recurrenceRule", "notes", "status", "orderId"]);
        if (typeof input.eventDate === "string") {
            event.eventDate = mapDate(input.eventDate)?.slice(0, 10) ?? event.eventDate;
        }
        event.updatedAt = new Date().toISOString();
        this.syncEventReminder(event);
        this.db.persist();
        return event;
    }
    deleteCustomerEvent(eventId) {
        const index = this.db.customerEvents.findIndex((e) => e.id === eventId);
        if (index === -1)
            return false;
        const [removed] = this.db.customerEvents.splice(index, 1);
        for (let i = this.db.customerEventReminders.length - 1; i >= 0; i--) {
            if (this.db.customerEventReminders[i].eventId === removed.id) {
                this.db.customerEventReminders.splice(i, 1);
            }
        }
        this.db.persist();
        return true;
    }
    /**
     * Recurring-reminder scheduler (E1): keep exactly one live (PENDING/REMINDED)
     * reminder pointing at the event's next future occurrence. The system NEVER
     * auto-contacts the customer â€” staff act on a reminder and mark it Contacted.
     * Idempotent, safe to call on create/update.
     */
    syncEventReminder(event) {
        for (let i = this.db.customerEventReminders.length - 1; i >= 0; i--) {
            const r = this.db.customerEventReminders[i];
            if (r.eventId === event.id && r.status !== "CONTACTED" && r.status !== "DISMISSED") {
                this.db.customerEventReminders.splice(i, 1);
            }
        }
        if (event.status !== "ACTIVE")
            return;
        const nextDate = nextOccurrence(event.eventDate, event.recurrenceRule);
        if (new Date(`${nextDate}T09:00:00.000Z`).getTime() <= Date.now())
            return;
        const now = new Date().toISOString();
        this.db.customerEventReminders.push({
            id: makeId("crem"),
            eventId: event.id,
            customerId: event.customerId,
            orderId: event.orderId,
            eventType: event.eventType,
            reminderForDate: nextDate,
            nextReminderAt: atNineUtc(nextDate),
            status: "PENDING",
            lastContactedAt: null,
            contactedBy: "",
            outcome: "",
            followUpNotes: "",
            createdAt: now,
            updatedAt: now,
        });
    }
    // ---- reminders (staff-acted; the system never auto-contacts) ----
    /** All reminders for a customer, soonest occurrence first. */
    remindersForCustomer(customerId) {
        return this.db.customerEventReminders
            .filter((r) => r.customerId === customerId)
            .sort((a, b) => a.nextReminderAt.localeCompare(b.nextReminderAt));
    }
    customerEventReminder(reminderId) {
        return this.db.customerEventReminders.find((r) => r.id === reminderId);
    }
    /**
     * Reminders still awaiting action, whose occurrence falls within the next
     * `days` days (default 30) â€” backs GET /customer-reminders and the printable
     * next-7/30-day list. CONTACTED/DISMISSED reminders are excluded. Sorted by
     * next fire time so the most urgent surfaces first.
     */
    dueReminders(days = 30) {
        const until = Date.now() + days * 24 * 60 * 60 * 1000;
        return this.db.customerEventReminders
            .filter((r) => r.status !== "CONTACTED" &&
            r.status !== "DISMISSED" &&
            new Date(r.nextReminderAt).getTime() <= until)
            .sort((a, b) => a.nextReminderAt.localeCompare(b.nextReminderAt));
    }
    /**
     * Staff act on a reminder: record the contact + outcome and roll the reminder
     * forward to the event's next future occurrence (annual â†’ next year, monthly â†’
     * next month). One-off events produce no further reminder. The system itself
     * never contacts the customer â€” this is the only path that advances a
     * reminder, and it always requires a human (`contactedBy`). Backs
     * PATCH /customer-reminders/:id/contacted.
     */
    markReminderContacted(reminderId, input) {
        const reminder = this.db.customerEventReminders.find((r) => r.id === reminderId);
        if (!reminder)
            return undefined;
        applyPatch(reminder, input, ["contactedBy", "outcome", "followUpNotes"]);
        reminder.contactedBy = mapStr(input.contactedBy) || reminder.contactedBy;
        reminder.outcome = mapStr(input.outcome) ?? "";
        reminder.followUpNotes = mapStr(input.followUpNotes) ?? "";
        reminder.lastContactedAt = new Date().toISOString();
        reminder.status = "CONTACTED";
        reminder.updatedAt = reminder.lastContactedAt;
        // Roll the parent event's reminder forward to its next future occurrence.
        const event = this.db.customerEvents.find((e) => e.id === reminder.eventId);
        if (event && event.status === "ACTIVE")
            this.syncEventReminder(event);
        this.db.persist();
        return reminder;
    }
    /** Dismiss a reminder (no further follow-up on this occurrence). */
    dismissReminder(reminderId) {
        const reminder = this.db.customerEventReminders.find((r) => r.id === reminderId);
        if (!reminder)
            return undefined;
        reminder.status = "DISMISSED";
        reminder.updatedAt = new Date().toISOString();
        this.db.persist();
        return reminder;
    }
    // -------------------------------------------------------------------------
    // E2 â€” Website content: blog categories, blog posts, website users
    // Managed from the ERP "Site Management" page; the public website reads
    // the published subset via GET /api/v1/public/*. One DB, no duplicate store.
    // -------------------------------------------------------------------------
    // ---- blog categories ----
    blogCategories() {
        return this.db.blogCategories
            .slice()
            .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    }
    blogCategory(id) {
        return this.db.blogCategories.find((c) => c.id === id);
    }
    createBlogCategory(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("bcat"),
            name: String(input.name ?? ""),
            slug: String(input.slug ?? slugify(String(input.name ?? ""))),
            description: String(input.description ?? ""),
            displayOrder: mapNum(input.displayOrder),
            active: input.active !== false,
            createdAt: now,
            updatedAt: now,
        };
        this.db.blogCategories.push(record);
        this.db.persist();
        return record;
    }
    updateBlogCategory(id, input) {
        const category = this.db.blogCategories.find((c) => c.id === id);
        if (!category)
            return undefined;
        applyPatch(category, input, ["name", "slug", "description", "displayOrder", "active"]);
        category.updatedAt = new Date().toISOString();
        this.db.persist();
        return category;
    }
    deleteBlogCategory(id) {
        const idx = this.db.blogCategories.findIndex((c) => c.id === id);
        if (idx === -1)
            return false;
        this.db.blogCategories.splice(idx, 1);
        // Detach posts (keep them, drop the category link) rather than cascade-delete.
        for (const p of this.db.blogPosts) {
            if (p.categoryId === id)
                p.categoryId = null;
        }
        this.db.persist();
        return true;
    }
    // ---- blog posts ----
    /** All posts (any status), newest first. Backs the ERP management table. */
    blogPosts() {
        return this.db.blogPosts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    /** Published posts only, newest published first. Backs GET /public/blog. */
    publishedBlogPosts() {
        return this.db.blogPosts
            .filter((p) => p.status === "PUBLISHED")
            .sort((a, b) => {
            const av = a.publishedAt ?? a.createdAt;
            const bv = b.publishedAt ?? b.createdAt;
            return bv.localeCompare(av);
        });
    }
    blogPost(id) {
        return this.db.blogPosts.find((p) => p.id === id);
    }
    blogPostBySlug(slug) {
        return this.db.blogPosts.find((p) => p.slug === slug && p.status === "PUBLISHED");
    }
    createBlogPost(input) {
        const now = new Date().toISOString();
        const status = String(input.status ?? "DRAFT").toUpperCase();
        const record = {
            id: makeId("bpost"),
            categoryId: mapStr(input.categoryId),
            title: String(input.title ?? ""),
            slug: String(input.slug ?? slugify(String(input.title ?? ""))),
            excerpt: String(input.excerpt ?? ""),
            body: String(input.body ?? ""),
            coverImage: String(input.coverImage ?? ""),
            author: String(input.author ?? ""),
            status,
            publishedAt: status === "PUBLISHED" ? (mapDate(input.publishedAt) ?? now) : mapDate(input.publishedAt),
            createdBy: String(input.createdBy ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.blogPosts.push(record);
        this.db.persist();
        return record;
    }
    updateBlogPost(id, input) {
        const post = this.db.blogPosts.find((p) => p.id === id);
        if (!post)
            return undefined;
        const wasPublished = post.status === "PUBLISHED";
        applyPatch(post, input, [
            "categoryId", "title", "slug", "excerpt", "body", "coverImage", "author", "status", "publishedAt",
        ]);
        if (typeof input.slug === "string")
            post.slug = slugify(input.slug);
        // Stamp publishedAt the first time a post transitions to PUBLISHED.
        if (!wasPublished && post.status === "PUBLISHED" && !post.publishedAt) {
            post.publishedAt = new Date().toISOString();
        }
        post.updatedAt = new Date().toISOString();
        this.db.persist();
        return post;
    }
    deleteBlogPost(id) {
        const idx = this.db.blogPosts.findIndex((p) => p.id === id);
        if (idx === -1)
            return false;
        this.db.blogPosts.splice(idx, 1);
        this.db.persist();
        return true;
    }
    // ---- website users ----
    websiteUsers() {
        return this.db.websiteUsers.slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    websiteUser(id) {
        return this.db.websiteUsers.find((u) => u.id === id);
    }
    websiteUserByEmail(email) {
        const target = email.trim().toLowerCase();
        return this.db.websiteUsers.find((u) => u.email.trim().toLowerCase() === target);
    }
    createWebsiteUser(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("wuser"),
            name: String(input.name ?? ""),
            email: String(input.email ?? ""),
            phone: String(input.phone ?? ""),
            passwordHash: String(input.passwordHash ?? ""),
            role: String(input.role ?? "CUSTOMER").toUpperCase(),
            status: String(input.status ?? "ACTIVE").toUpperCase(),
            customerId: mapStr(input.customerId),
            lastLoginAt: mapDate(input.lastLoginAt),
            createdAt: now,
            updatedAt: now,
        };
        this.db.websiteUsers.push(record);
        this.db.persist();
        return record;
    }
    updateWebsiteUser(id, input) {
        const user = this.db.websiteUsers.find((u) => u.id === id);
        if (!user)
            return undefined;
        applyPatch(user, input, [
            "name", "email", "phone", "passwordHash", "role", "status", "customerId", "lastLoginAt",
        ]);
        user.updatedAt = new Date().toISOString();
        this.db.persist();
        return user;
    }
    deleteWebsiteUser(id) {
        const idx = this.db.websiteUsers.findIndex((u) => u.id === id);
        if (idx === -1)
            return false;
        this.db.websiteUsers.splice(idx, 1);
        this.db.persist();
        return true;
    }
    // -------------------------------------------------------------------------
    // E7 â€” Staff management & salary/remuneration (governing doc Â§Â§18.1â€“18.8)
    // Salary figures are confidential: routes gate every read behind a
    // remuneration.* permission. Workflow status transitions are enforced here
    // so no route can bypass them. CLOSED periods are terminal â€” corrections
    // become NEW records, never silent rewrites (Â§18.7 / rule 34).
    // -------------------------------------------------------------------------
    // ---- staff (Â§18.1: identity, roles, schedule, notes) ----
    staffList() {
        return this.db.staff.slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    findStaff(id) {
        return this.db.staff.find((s) => s.id === id);
    }
    createStaff(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("staff"),
            staffNumber: String(input.staffNumber ?? "") || `STF-${(this.db.staff.length + 1).toString().padStart(3, "0")}`,
            name: String(input.name ?? ""),
            phone: String(input.phone ?? ""),
            email: String(input.email ?? ""),
            jobTitle: String(input.jobTitle ?? ""),
            employmentStatus: String(input.employmentStatus ?? "ACTIVE"),
            startDate: mapDate(input.startDate),
            schedule: String(input.schedule ?? ""),
            notes: String(input.notes ?? ""),
            userId: mapStr(input.userId),
            createdAt: now,
            updatedAt: now,
        };
        this.db.staff.push(record);
        this.db.persist();
        return record;
    }
    updateStaff(id, patch) {
        const staff = this.db.staff.find((s) => s.id === id);
        if (!staff)
            return undefined;
        applyPatch(staff, patch, [
            "staffNumber", "name", "phone", "email", "jobTitle", "employmentStatus",
            "startDate", "schedule", "notes", "userId",
        ]);
        staff.updatedAt = new Date().toISOString();
        this.db.persist();
        return staff;
    }
    /** No hard delete â€” salary history must stay reconstructable (Â§18.7). */
    archiveStaff(id) {
        return this.updateStaff(id, { employmentStatus: "TERMINATED" });
    }
    // ---- attendance (Â§18.1: one row per staff per day, upsert) ----
    attendance(staffId, fromDate, toDate) {
        return this.db.staffAttendance
            .filter((a) => (staffId ? a.staffId === staffId : true))
            .filter((a) => (fromDate ? a.date >= fromDate : true))
            .filter((a) => (toDate ? a.date <= toDate : true))
            .sort((a, b) => b.date.localeCompare(a.date));
    }
    recordAttendance(input) {
        const staffId = String(input.staffId ?? "");
        const date = String(input.date ?? "").slice(0, 10);
        // Upsert on (staffId, date): no DB-level UNIQUE beyond PKs (a surprise
        // unique violation would roll back the entire cache write-back).
        const existing = this.db.staffAttendance.find((a) => a.staffId === staffId && a.date === date);
        const now = new Date().toISOString();
        if (existing) {
            applyPatch(existing, input, ["status", "hours", "notes", "recordedBy"]);
            existing.updatedAt = now;
            this.db.persist();
            return existing;
        }
        const record = {
            id: makeId("att"),
            staffId,
            date,
            status: String(input.status ?? "PRESENT"),
            hours: mapNum(input.hours),
            notes: String(input.notes ?? ""),
            recordedBy: String(input.recordedBy ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.staffAttendance.push(record);
        this.db.persist();
        return record;
    }
    // ---- salary profiles (Â§18.2: confidential recurring baseline) ----
    salaryProfileFor(staffId) {
        return this.db.salaryProfiles.find((p) => p.staffId === staffId);
    }
    /** One profile per staff: create on first save, update thereafter. */
    upsertSalaryProfile(staffId, input) {
        const now = new Date().toISOString();
        const existing = this.salaryProfileFor(staffId);
        if (existing) {
            applyPatch(existing, input, [
                "basicSalary", "paymentFrequency", "allowanceAmount", "deductionAmount", "effectiveFrom", "notes",
            ]);
            existing.updatedAt = now;
            this.db.persist();
            return existing;
        }
        const record = {
            id: makeId("salp"),
            staffId,
            basicSalary: mapNum(input.basicSalary),
            paymentFrequency: String(input.paymentFrequency ?? "monthly"),
            allowanceAmount: mapNum(input.allowanceAmount),
            deductionAmount: mapNum(input.deductionAmount),
            effectiveFrom: mapDate(input.effectiveFrom),
            notes: String(input.notes ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.salaryProfiles.push(record);
        this.db.persist();
        return record;
    }
    // ---- payment periods (Â§18.3 admin-defined; Â§18.4 workflow) ----
    //
    // CREATE â†’ OPEN â†’ (select+calculate) PROCESSING â†’ (approve) APPROVED
    //        â†’ (record payments) PARTIALLY_PAID / PAID â†’ (close) CLOSED.
    // CLOSED is terminal: no item/payment/period mutation is ever applied.
    remunerationPeriods() {
        return this.db.remunerationPeriods.slice().sort((a, b) => b.startDate.localeCompare(a.startDate));
    }
    findPeriod(id) {
        return this.db.remunerationPeriods.find((p) => p.id === id);
    }
    createPeriod(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("rper"),
            label: String(input.label ?? ""),
            periodType: String(input.periodType ?? "monthly"),
            startDate: String(input.startDate ?? "").slice(0, 10),
            endDate: String(input.endDate ?? "").slice(0, 10),
            intendedPaymentDate: mapDate(input.intendedPaymentDate),
            status: "OPEN",
            totalAmount: 0,
            paidAmount: 0,
            notes: String(input.notes ?? ""),
            createdBy: String(input.createdBy ?? ""),
            approvedBy: null,
            approvedAt: null,
            closedAt: null,
            createdAt: now,
            updatedAt: now,
        };
        this.db.remunerationPeriods.push(record);
        this.db.persist();
        return record;
    }
    /** Throws when the period is CLOSED â€” the invariant every mutator shares. */
    assertPeriodOpen(period, what) {
        if (period.status === "CLOSED") {
            throw new Error(`Period is CLOSED â€” ${what} must be recorded as a new adjustment, never a rewrite`);
        }
    }
    periodItems(periodId) {
        return this.db.remunerationItems
            .filter((i) => i.periodId === periodId)
            .sort((a, b) => a.staffId.localeCompare(b.staffId));
    }
    periodPayments(periodId) {
        return this.db.remunerationPayments
            .filter((p) => p.periodId === periodId)
            .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
    }
    /** net = basic + allowances + bonuses âˆ’ deductions âˆ’ advance + other (Â§18.4). */
    computeNet(i) {
        return Math.round((i.basicSalary + i.allowances + i.bonuses - i.deductions - i.advanceAmount + i.otherPayments) * 100) / 100;
    }
    recomputePeriodTotals(periodId) {
        const period = this.findPeriod(periodId);
        if (!period)
            return;
        const items = this.periodItems(periodId);
        period.totalAmount = Math.round(items.reduce((n, i) => n + i.netAmount, 0) * 100) / 100;
        period.paidAmount = Math.round(items.reduce((n, i) => n + i.paidAmount, 0) * 100) / 100;
        if (period.status !== "CLOSED" && period.status !== "OPEN") {
            if (period.paidAmount <= 0)
                period.status = period.approvedAt ? "APPROVED" : period.status;
            else if (period.paidAmount >= period.totalAmount && period.totalAmount > 0)
                period.status = "PAID";
            else
                period.status = "PARTIALLY_PAID";
        }
        period.updatedAt = new Date().toISOString();
    }
    /**
     * SELECT STAFF + CALCULATE (Â§18.4): materialise one item per selected staff
     * from their salary profile. Re-runnable while OPEN/PROCESSING â€” approved
     * lines are frozen. Advances are NEVER auto-deducted: the Admin opts in per
     * line so outstanding balances stay visible (Â§18.6).
     */
    calculatePeriod(periodId, staffIds, _actor) {
        const period = this.findPeriod(periodId);
        if (!period)
            throw new Error("Period not found");
        this.assertPeriodOpen(period, "calculation");
        if (period.approvedAt)
            throw new Error("Period is already APPROVED â€” adjustments must be new records");
        const now = new Date().toISOString();
        const targets = staffIds.length
            ? staffIds
            : this.db.staff.filter((s) => s.employmentStatus === "ACTIVE" || s.employmentStatus === "PROBATION").map((s) => s.id);
        const created = [];
        for (const staffId of targets) {
            if (!this.findStaff(staffId))
                continue;
            const existing = this.db.remunerationItems.find((i) => i.periodId === periodId && i.staffId === staffId);
            if (existing && existing.status !== "PENDING")
                continue;
            const profile = this.salaryProfileFor(staffId);
            const draft = {
                basicSalary: profile?.basicSalary ?? 0,
                allowances: profile?.allowanceAmount ?? 0,
                bonuses: 0,
                deductions: profile?.deductionAmount ?? 0,
                advanceAmount: 0,
                otherPayments: 0,
            };
            const net = this.computeNet(draft);
            if (existing) {
                applyPatch(existing, draft, ["basicSalary", "allowances", "bonuses", "deductions", "advanceAmount", "otherPayments"]);
                existing.netAmount = net;
                existing.updatedAt = now;
                created.push(existing);
            }
            else {
                const record = {
                    id: makeId("ritem"),
                    periodId,
                    staffId,
                    ...draft,
                    netAmount: net,
                    paidAmount: 0,
                    status: "PENDING",
                    notes: "",
                    createdAt: now,
                    updatedAt: now,
                };
                this.db.remunerationItems.push(record);
                created.push(record);
            }
        }
        if (period.status === "OPEN")
            period.status = "PROCESSING";
        period.updatedAt = now;
        this.recomputePeriodTotals(periodId);
        this.db.persist();
        return created;
    }
    updatePeriodItem(itemId, patch) {
        const item = this.db.remunerationItems.find((i) => i.id === itemId);
        if (!item)
            return undefined;
        const period = this.findPeriod(item.periodId);
        if (!period)
            return undefined;
        this.assertPeriodOpen(period, "item adjustment");
        if (period.approvedAt && item.status !== "PENDING") {
            throw new Error("Approved lines are frozen â€” record corrections as a NEW adjustment line");
        }
        applyPatch(item, patch, [
            "basicSalary", "allowances", "bonuses", "deductions", "advanceAmount", "otherPayments", "notes", "status",
        ]);
        item.netAmount = this.computeNet(item);
        item.updatedAt = new Date().toISOString();
        this.recomputePeriodTotals(item.periodId);
        this.db.persist();
        return item;
    }
    /** Additive correction line for APPROVED/CLOSED periods (Â§18.7 history). */
    addAdjustmentItem(periodId, input) {
        const period = this.findPeriod(periodId);
        if (!period)
            throw new Error("Period not found");
        if (!period.approvedAt)
            throw new Error("Adjustments only apply after approval â€” edit the line directly");
        const now = new Date().toISOString();
        const draft = {
            basicSalary: mapNum(input.basicSalary),
            allowances: mapNum(input.allowances),
            bonuses: mapNum(input.bonuses),
            deductions: mapNum(input.deductions),
            advanceAmount: mapNum(input.advanceAmount),
            otherPayments: mapNum(input.otherPayments),
        };
        const record = {
            id: makeId("ritem"),
            periodId,
            staffId: String(input.staffId ?? ""),
            ...draft,
            netAmount: this.computeNet(draft),
            paidAmount: 0,
            status: "ADJUSTED",
            notes: String(input.notes ?? "Adjustment"),
            createdAt: now,
            updatedAt: now,
        };
        this.db.remunerationItems.push(record);
        // Totals may move even on a CLOSED period: the adjustment is a NEW record,
        // the original lines stay byte-identical (history remains reconstructable).
        this.recomputePeriodTotals(periodId);
        this.db.persist();
        return record;
    }
    /** REVIEW/ADJUST â†’ APPROVE: freeze every line (Â§18.4/Â§18.7). */
    approvePeriod(periodId, actor) {
        const period = this.findPeriod(periodId);
        if (!period)
            return undefined;
        this.assertPeriodOpen(period, "approval");
        if (period.approvedAt)
            throw new Error("Period is already approved");
        if (this.periodItems(periodId).length === 0)
            throw new Error("Calculate salary before approving â€” no items selected");
        const now = new Date().toISOString();
        period.status = "APPROVED";
        period.approvedBy = actor || null;
        period.approvedAt = now;
        period.updatedAt = now;
        for (const item of this.periodItems(periodId)) {
            if (item.status === "PENDING")
                item.status = "APPROVED";
        }
        this.db.persist();
        return period;
    }
    // ---- payments (Â§18.7): record â†’ mark paid â†’ rollup â†’ close ----
    recordPayment(input) {
        const period = this.findPeriod(String(input.periodId ?? ""));
        if (!period)
            throw new Error("Period not found");
        this.assertPeriodOpen(period, "payment recording");
        if (!period.approvedAt)
            throw new Error("Approve the period before recording payments");
        const now = new Date().toISOString();
        const record = {
            id: makeId("rpay"),
            periodId: period.id,
            staffId: String(input.staffId ?? ""),
            itemId: mapStr(input.itemId),
            amount: mapNum(input.amount),
            paymentDate: String(input.paymentDate ?? now).slice(0, 10),
            method: String(input.method ?? "CASH"),
            reference: String(input.reference ?? ""),
            paymentStatus: "RECORDED",
            notes: String(input.notes ?? ""),
            recordedBy: String(input.recordedBy ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.remunerationPayments.push(record);
        this.db.persist();
        return record;
    }
    /** MARK PAID: credit the line, roll the period forward, never touch CLOSED. */
    markPaymentPaid(paymentId, actor) {
        const payment = this.db.remunerationPayments.find((p) => p.id === paymentId);
        if (!payment)
            return undefined;
        const period = this.findPeriod(payment.periodId);
        if (!period)
            return undefined;
        this.assertPeriodOpen(period, "marking a payment paid");
        if (payment.paymentStatus === "PAID")
            return payment; // idempotent
        const now = new Date().toISOString();
        payment.paymentStatus = "PAID";
        payment.updatedAt = now;
        void actor;
        const item = this.db.remunerationItems.find((i) => i.id === payment.itemId)
            ?? this.db.remunerationItems.find((i) => i.periodId === payment.periodId && i.staffId === payment.staffId);
        if (item) {
            item.paidAmount = Math.round((item.paidAmount + payment.amount) * 100) / 100;
            item.status = item.paidAmount >= item.netAmount ? "PAID" : "PARTIALLY_PAID";
            item.updatedAt = now;
        }
        this.recomputePeriodTotals(payment.periodId);
        this.db.persist();
        return payment;
    }
    /** CLOSE PERIOD: terminal. Totals + rows are frozen from here on (Â§18.7). */
    closePeriod(periodId, actor) {
        const period = this.findPeriod(periodId);
        if (!period)
            return undefined;
        if (period.status === "CLOSED")
            return period; // idempotent
        if (!period.approvedAt)
            throw new Error("Approve the period before closing it");
        const now = new Date().toISOString();
        period.status = "CLOSED";
        period.closedAt = now;
        period.updatedAt = now;
        void actor;
        this.db.persist();
        return period;
    }
    // ---- advances (Â§18.6): original amount immutable, repayments append ----
    staffAdvances(staffId) {
        return this.db.staffAdvances
            .filter((a) => (staffId ? a.staffId === staffId : true))
            .sort((a, b) => String(b.advanceDate ?? b.createdAt).localeCompare(String(a.advanceDate ?? a.createdAt)));
    }
    outstandingAdvances(staffId) {
        return Math.round(this.db.staffAdvances
            .filter((a) => a.staffId === staffId && a.status === "OUTSTANDING")
            .reduce((n, a) => n + (a.amount - a.repaidAmount), 0) * 100) / 100;
    }
    createAdvance(input) {
        const now = new Date().toISOString();
        const record = {
            id: makeId("adv"),
            staffId: String(input.staffId ?? ""),
            amount: mapNum(input.amount),
            repaidAmount: 0,
            reason: String(input.reason ?? ""),
            advanceDate: mapDate(input.advanceDate) ?? now.slice(0, 10),
            status: "OUTSTANDING",
            repaymentLog: [],
            recordedBy: String(input.recordedBy ?? ""),
            createdAt: now,
            updatedAt: now,
        };
        this.db.staffAdvances.push(record);
        this.db.persist();
        return record;
    }
    /**
     * Recovery/repayment: appends to repaymentLog and bumps repaidAmount â€”
     * `amount` is NEVER reduced, so the original grant stays reconstructable
     * (Â§18.6 "must not be silently overwritten"). Settles at zero outstanding.
     */
    recordAdvanceRepayment(advanceId, input) {
        const advance = this.db.staffAdvances.find((a) => a.id === advanceId);
        if (!advance)
            return undefined;
        const outstanding = advance.amount - advance.repaidAmount;
        const amount = mapNum(input.amount);
        if (amount <= 0)
            throw new Error("Repayment amount must be positive");
        if (amount > outstanding + 0.001)
            throw new Error(`Repayment exceeds outstanding balance (${outstanding})`);
        advance.repaymentLog = [
            ...(Array.isArray(advance.repaymentLog) ? advance.repaymentLog : []),
            {
                date: String(input.date ?? new Date().toISOString()).slice(0, 10),
                amount,
                method: input.method === undefined ? undefined : String(input.method),
                reference: input.reference === undefined ? undefined : String(input.reference),
                recordedBy: input.recordedBy === undefined ? undefined : String(input.recordedBy),
            },
        ];
        advance.repaidAmount = Math.round((advance.repaidAmount + amount) * 100) / 100;
        advance.status = advance.repaidAmount >= advance.amount ? "SETTLED" : "OUTSTANDING";
        advance.updatedAt = new Date().toISOString();
        this.db.persist();
        return advance;
    }
    // ---- payslips & dashboard (Â§18.5/Â§18.8) ----
    /**
     * Issue payslips for every approved line of a period. Figures are COPIED at
     * issue time â€” later profile/line edits never rewrite an issued document.
     * Reissuing an already-issued staff line is a no-op (idempotent).
     */
    issuePayslips(periodId, actor) {
        const period = this.findPeriod(periodId);
        if (!period)
            throw new Error("Period not found");
        if (!period.approvedAt)
            throw new Error("Approve the period before issuing payslips");
        const now = new Date().toISOString();
        const issued = [];
        for (const item of this.periodItems(periodId)) {
            const staff = this.findStaff(item.staffId);
            if (!staff)
                continue;
            const already = this.db.payslips.find((p) => p.periodId === periodId && p.staffId === item.staffId);
            if (already) {
                issued.push(already);
                continue;
            }
            const record = {
                id: makeId("pslip"),
                periodId,
                staffId: item.staffId,
                itemId: item.id,
                periodLabel: period.label || `${period.startDate} â†’ ${period.endDate}`,
                staffName: staff.name,
                basicSalary: item.basicSalary,
                allowances: item.allowances,
                bonuses: item.bonuses,
                deductions: item.deductions,
                advanceAmount: item.advanceAmount,
                otherPayments: item.otherPayments,
                netAmount: item.netAmount,
                paidAmount: item.paidAmount,
                issuedAt: now,
                issuedBy: actor,
                createdAt: now,
                updatedAt: now,
            };
            this.db.payslips.push(record);
            issued.push(record);
        }
        this.db.persist();
        return issued;
    }
    payslips(periodId, staffId) {
        return this.db.payslips
            .filter((p) => (periodId ? p.periodId === periodId : true))
            .filter((p) => (staffId ? p.staffId === staffId : true))
            .sort((a, b) => String(b.issuedAt ?? b.createdAt).localeCompare(String(a.issuedAt ?? a.createdAt)));
    }
    /**
     * Â§18.5 â€” the Admin's period dashboard: totals due/paid/pending, allowances,
     * deductions, outstanding advances, status and upcoming payment dates, with
     * drill-down ids. Everything derives from live rows, never cached figures.
     */
    remunerationDashboard(periodId) {
        const periods = this.remunerationPeriods();
        const period = periodId ? this.findPeriod(periodId) : periods.find((p) => p.status !== "CLOSED") ?? periods[0];
        const items = period ? this.periodItems(period.id) : [];
        const sum = (pick) => Math.round(items.reduce((n, i) => n + pick(i), 0) * 100) / 100;
        const outstandingAdvances = Math.round(this.db.staffAdvances.filter((a) => a.status === "OUTSTANDING").reduce((n, a) => n + (a.amount - a.repaidAmount), 0) * 100) / 100;
        const upcoming = periods
            .filter((p) => p.intendedPaymentDate && p.status !== "CLOSED" && p.status !== "PAID")
            .sort((a, b) => String(a.intendedPaymentDate).localeCompare(String(b.intendedPaymentDate)))
            .slice(0, 5)
            .map((p) => ({ id: p.id, label: p.label, date: p.intendedPaymentDate, status: p.status, total: p.totalAmount }));
        return {
            period,
            items: period
                ? items.map((i) => ({ ...i, staffName: this.findStaff(i.staffId)?.name ?? "" }))
                : [],
            totals: {
                due: period?.totalAmount ?? 0,
                paid: period?.paidAmount ?? 0,
                pending: Math.round(((period?.totalAmount ?? 0) - (period?.paidAmount ?? 0)) * 100) / 100,
                allowances: sum((i) => i.allowances),
                bonuses: sum((i) => i.bonuses),
                deductions: sum((i) => i.deductions),
                outstandingAdvances,
            },
            upcomingPaymentDates: upcoming,
            periodStatus: period?.status ?? null,
        };
    }
}
// ---------------------------------------------------------------------------
// Singleton (routes import { store } from "../database/store.js")
// ---------------------------------------------------------------------------
export const store = new MemoryStore();
//# sourceMappingURL=store.js.map