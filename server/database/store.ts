import { getDb, resetStore, type DbCache } from "./index.new.js";
import type {
  AuditLog,
  BlogCategory,
  BlogPost,
  Customer,
  CustomerEvent,
  CustomerEventReminder,
  CustomerFeedback,
  CustomerInteraction,
  Delivery,
  EventRecurrence,
  Expense,
  GoodsReceipt,
  GoodsReceiptItem,
  Inquiry,
  InventoryItem,
  InventoryTransaction,
  Notification,
  NotificationPreference,
  NotificationRecipient,
  NotificationTemplate,
  Order,
  OrderCustomerSnapshot,
  OrderItem,
  OrderProposal,
  OrderProposalItem,
  OrderStatusHistory,
  Payment,
  PaymentStatus,
  Payslip,
  Permission,
  ProductionConsumption,
  ProductionCost,
  ProductionJob,
  ProductionWastage,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseRequirement,
  QualityCheck,
  Quotation,
  QuotationItem,
  RemunerationItem,
  RemunerationPayment,
  RemunerationPeriod,
  Role,
  RolePermission,
  SalaryProfile,
  Staff,
  StaffAdvance,
  StaffAttendance,
  StockReservation,
  Supplier,
  SupplierPriceHistory,
  User,
  UserRole,
  WebsiteUser,
  WebsiteUserRole,
  WebsiteUserStatus,
} from "./types.js";

function mapNum(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return null;
}

function mapStr(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function mapBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  return Boolean(value);
}

function makeId(prefix: string): string {
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
function uniqueOrderNumber(requested: string, taken: readonly Order[]): string {
  const base = requested || makeId("TC");
  if (!taken.some((o) => o.orderNumber === base)) return base;
  for (let n = 2; n <= 100; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.some((o) => o.orderNumber === candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** URL-safe slug from a title/name (lowercase, hyphenated, ascii-ish). */
function slugify(input: string): string {
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
function nextOccurrence(eventDateStr: string, rule: EventRecurrence): string {
  const base = new Date(eventDateStr);
  if (Number.isNaN(base.getTime())) return eventDateStr.slice(0, 10);
  // NONE: a one-off event — its occurrence is simply the event date (past or
  // future); it never advances. Only recurring rules roll forward.
  if (rule === "NONE") return base.toISOString().slice(0, 10);
  const from = Date.now();
  let occurrence = new Date(base.getTime());
  let guard = 0;
  while (occurrence.getTime() <= from && guard < 1000) {
    if (rule === "MONTHLY") occurrence.setMonth(occurrence.getMonth() + 1);
    else occurrence.setFullYear(occurrence.getFullYear() + 1); // ANNUAL / YEARLY
    guard += 1;
  }
  return occurrence.toISOString().slice(0, 10);
}

/** Reminder fire time for an occurrence date: 09:00 UTC that day. */
function atNineUtc(dateStr: string): string {
  const iso = new Date(`${dateStr}T09:00:00.000Z`);
  return Number.isNaN(iso.getTime()) ? new Date().toISOString() : iso.toISOString();
}

export type Patch = Record<string, unknown>;

function applyPatch<T extends object>(target: T, patch: Patch, allowed: ReadonlyArray<string>): void {
  for (const key of allowed) {
    const value = patch[key];
    if (value !== undefined) {
      (target as unknown as Record<string, unknown>)[key] = value;
    }
  }
}

export class MemoryStore {
  get db(): DbCache {
    return getDb();
  }

  /** Queue a write-back of the cache to Postgres; resolves when committed. */
  persist(): Promise<void> {
    return this.db.persist();
  }

  reset(): void {
    resetStore();
  }

  // ---- customers ----
  customers(): Customer[] {
    return this.db.customers;
  }

  customer(customerId: string): Customer | undefined {
    return this.db.customers.find((c) => c.id === customerId);
  }

  findCustomer(idOrPhone: string): Customer | undefined {
    return this.db.customers.find((c) => c.id === idOrPhone || c.phone === idOrPhone);
  }

  createCustomer(input: Patch): Customer {
    const now = new Date().toISOString();
    const addresses = Array.isArray(input.addresses) ? (input.addresses as Customer["addresses"]) : [];
    const record: Customer = {
      id: makeId("cust"),
      name: String(input.name ?? ""),
      phone: String(input.phone ?? ""),
      email: String(input.email ?? ""),
      addresses,
      preferredContactMethod: String(input.preferredContactMethod ?? "phone") as Customer["preferredContactMethod"],
      source: String(input.source ?? "In-house"),
      notes: String(input.notes ?? ""),
      status: String(input.status ?? "Active") as Customer["status"],
      firstOrderDate: mapDate(input.firstOrderDate),
      lastOrderDate: mapDate(input.lastOrderDate),
      totalOrders: mapNum(input.totalOrders),
      totalSpend: mapNum(input.totalSpend),
      feedbackSummary: Array.isArray(input.feedbackSummary)
        ? (input.feedbackSummary as Customer["feedbackSummary"])
        : [],
      createdAt: now,
      updatedAt: now,
    };
    this.db.customers.push(record);
    this.db.persist();
    return record;
  }

  updateCustomer(customerId: string, input: Patch): Customer | undefined {
    const customer = this.db.customers.find((c) => c.id === customerId);
    if (!customer) return undefined;
    applyPatch(customer, input, [
      "name", "phone", "email", "preferredContactMethod", "source", "notes", "status",
      "firstOrderDate", "lastOrderDate", "totalOrders", "totalSpend", "feedbackSummary", "addresses",
    ]);
    customer.updatedAt = new Date().toISOString();
    this.db.persist();
    return customer;
  }

  deleteCustomer(customerId: string): boolean {
    const index = this.db.customers.findIndex((c) => c.id === customerId);
    if (index === -1) return false;
    this.db.customers.splice(index, 1);
    this.db.persist();
    return true;
  }

  // ---- interactions ----
  customerInteractions(): CustomerInteraction[] {
    return this.db.customerInteractions;
  }

  interactionsByCustomer(customerId: string): CustomerInteraction[] {
    return this.db.customerInteractions.filter((i) => i.customerId === customerId);
  }

  createInteraction(input: Patch): CustomerInteraction {
    const now = new Date().toISOString();
    const record: CustomerInteraction = {
      id: makeId("cint"),
      customerId: String(input.customerId ?? ""),
      channel: String(input.channel ?? "WALK_IN") as CustomerInteraction["channel"],
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
  inquiries(): Inquiry[] {
    return this.db.inquiries;
  }

  findInquiry(inquiryId: string): Inquiry | undefined {
    return this.db.inquiries.find((i) => i.id === inquiryId);
  }

  createInquiry(input: Patch): Inquiry {
    const now = new Date().toISOString();
    const record: Inquiry = {
      id: makeId("inq"),
      customerId: String(input.customerId ?? ""),
      channel: String(input.channel ?? "WALK_IN") as Inquiry["channel"],
      staffMember: mapStr(input.staffMember),
      subject: String(input.subject ?? ""),
      summary: String(input.summary ?? ""),
      details: String(input.details ?? ""),
      status: String(input.status ?? "NEW") as Inquiry["status"],
      priority: String(input.priority ?? "MEDIUM") as Inquiry["priority"],
      relatedQuoteId: mapStr(input.relatedQuoteId),
      relatedOrderId: mapStr(input.relatedOrderId),
      followUpRequired: input.followUpRequired === undefined ? false : mapBool(input.followUpRequired),
      nextAction: mapStr(input.nextAction),
      resolvedAt: mapDate(input.resolvedAt),
      source: String(input.source ?? "WALK_IN") as Inquiry["source"],
      createdAt: now,
      updatedAt: now,
    };
    this.db.inquiries.push(record);
    this.db.persist();
    return record;
  }

  updateInquiry(inquiryId: string, patch: Patch): Inquiry | undefined {
    const inquiry = this.db.inquiries.find((i) => i.id === inquiryId);
    if (!inquiry) return undefined;
    applyPatch(inquiry, patch, [
      "customerId", "channel", "staffMember", "subject", "summary", "details", "status", "priority",
      "relatedQuoteId", "relatedOrderId", "followUpRequired", "nextAction", "resolvedAt", "source",
    ]);
    inquiry.updatedAt = new Date().toISOString();
    this.db.persist();
    return inquiry;
  }

  // ---- public order proposals (E6 §§29-30) ----
  orderProposals(): OrderProposal[] {
    return this.db.orderProposals;
  }

  findOrderProposal(id: string): OrderProposal | undefined {
    return this.db.orderProposals.find((p) => p.id === id);
  }

  createOrderProposal(input: Patch): OrderProposal {
    const id = makeId("prop");
    const now = new Date().toISOString();
    const rawItems = Array.isArray(input.items) ? (input.items as Array<Record<string, unknown>>) : [];
    const items: OrderProposalItem[] = rawItems.map((raw) => {
      const qty = mapNum(raw.quantity);
      const unit = mapNum(raw.unitPrice);
      return {
        id: makeId("propi"),
        proposalId: id,
        productId: String(raw.productId ?? ""),
        productName: String(raw.productName ?? ""),
        variantOptions:
          raw.variantOptions === undefined || raw.variantOptions === null ? "" : String(raw.variantOptions),
        quantity: qty,
        unitPrice: unit,
        total: mapNum(raw.total) || qty * unit,
        createdAt: now,
        updatedAt: now,
      };
    });
    const record: OrderProposal = {
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
    for (const item of items) this.db.orderProposalItems.push(item);
    this.db.persist();
    return record;
  }

  updateOrderProposal(id: string, patch: Patch): OrderProposal | undefined {
    const proposal = this.db.orderProposals.find((p) => p.id === id);
    if (!proposal) return undefined;
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
  quotations(): Quotation[] {
    return this.db.quotations;
  }

  findQuotation(quotationId: string): Quotation | undefined {
    return this.db.quotations.find((q) => q.id === quotationId);
  }

  createQuotation(input: Patch): Quotation {
    const id = makeId("quote");
    const now = new Date().toISOString();
    const items: QuotationItem[] = Array.isArray(input.items)
      ? (input.items as Array<Record<string, unknown>>).map((raw) => ({
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
    const record: Quotation = {
      id,
      quotationNumber: String(input.quotationNumber ?? makeId("TQ")),
      customerId: String(input.customerId ?? ""),
      salespersonId: mapStr(input.salespersonId),
      items,
      notes: String(input.notes ?? ""),
      validityExpiry: mapDate(input.validityExpiry),
      status: String(input.status ?? "DRAFT") as Quotation["status"],
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
    for (const item of items) this.db.quotationItems.push(item);
    this.db.persist();
    return record;
  }

  updateQuotation(id: string, patch: Patch): Quotation | undefined {
    const quotation = this.db.quotations.find((q) => q.id === id);
    if (!quotation) return undefined;
    applyPatch(quotation, patch, [
      "quotationNumber", "customerId", "salespersonId", "notes", "validityExpiry", "status",
      "taxAmount", "total", "unitTotal", "submittedAt", "acceptedAt",
    ]);
    quotation.updatedAt = new Date().toISOString();
    this.db.persist();
    return quotation;
  }

  sendQuotation(id: string): Quotation | undefined {
    const quotation = this.db.quotations.find((q) => q.id === id);
    if (!quotation) return undefined;
    const now = new Date().toISOString();
    quotation.status = "SENT";
    quotation.submittedAt = now;
    quotation.updatedAt = now;
    this.db.persist();
    return quotation;
  }

  acceptQuotation(id: string): Quotation | undefined {
    const quotation = this.db.quotations.find((q) => q.id === id);
    if (!quotation) return undefined;
    const now = new Date().toISOString();
    quotation.status = "ACCEPTED";
    quotation.acceptedAt = now;
    quotation.updatedAt = now;
    this.db.persist();
    return quotation;
  }

  // ---- orders ----
  orders(): Order[] {
    return this.db.orders;
  }

  findOrder(id: string): Order | undefined {
    return this.db.orders.find((o) => o.id === id);
  }

  orderWithItems(orderId: string): Order | undefined {
    return this.db.orders.find((o) => o.id === orderId);
  }

  createOrder(input: Patch): Order {
    const id = makeId("order");
    const now = new Date().toISOString();
    const items: OrderItem[] = Array.isArray(input.items)
      ? (input.items as Array<Record<string, unknown>>).map((raw) => ({
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
    const status = String(input.status ?? "INQUIRY") as Order["status"];
    const record: Order = {
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
      paymentStatus: String(input.paymentStatus ?? "UNPAID") as Order["paymentStatus"],
      deliveryStatus: String(input.deliveryStatus ?? "PENDING") as Order["deliveryStatus"],
      quotationId: mapStr(input.quotationId),
      inquiryId: mapStr(input.inquiryId),
      createdBy: String(input.createdBy ?? ""),
      deliveredAt: mapDate(input.deliveredAt),
      followUpCompletedAt: mapDate(input.followUpCompletedAt),
      createdAt: now,
      updatedAt: now,
    };
    this.db.orders.push(record);
    for (const item of items) this.db.orderItems.push(item);
    const history: OrderStatusHistory = {
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
    if (snapshot) this.db.orderSnapshots.push(snapshot);
    this.db.persist();
    return record;
  }

  updateOrder(orderId: string, patch: Patch): Order | undefined {
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) return undefined;
    applyPatch(order, patch, [
      "orderNumber", "customerId", "salespersonId", "subtotal", "discount", "deliveryCharge",
      "taxAmount", "total", "requiredBy", "requiredAt", "notes", "status", "paymentStatus",
      "deliveryStatus", "quotationId", "inquiryId", "createdBy", "deliveredAt", "followUpCompletedAt",
    ]);
    // Keep the UNIQUE(order_number) constraint safe even when the patch swaps
    // in a number that another order already holds.
    order.orderNumber = uniqueOrderNumber(
      order.orderNumber,
      this.db.orders.filter((o) => o.id !== orderId),
    );
    order.updatedAt = new Date().toISOString();
    this.db.persist();
    return order;
  }

  orderStatusHistory(): OrderStatusHistory[] {
    return this.db.orderStatusHistory;
  }

  updateOrderStatus(
    orderId: string,
    newStatus: string,
    changedBy: string,
    reason: string,
  ): { order: Order; history: OrderStatusHistory } | undefined {
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) return undefined;
    const previousStatus = order.status;
    const now = new Date().toISOString();
    order.status = newStatus as Order["status"];
    order.updatedAt = now;
    const row: OrderStatusHistory = {
      id: makeId("osh"),
      orderId,
      previousStatus,
      newStatus: newStatus as Order["status"],
      changedBy: String(changedBy ?? ""),
      reason: String(reason ?? ""),
      timestamp: now,
      createdAt: now,
      updatedAt: now,
    };
    this.db.orderStatusHistory.push(row);
    this.db.persist();
    return { order, history: row };
  }

  cancelOrder(order: Order, changedBy: string, reason: string): { order: Order; history: OrderStatusHistory } {
    const previousStatus = order.status;
    const now = new Date().toISOString();
    order.status = "CANCELLED";
    order.updatedAt = now;
    const row: OrderStatusHistory = {
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
    // §34 — order cancellation is an auditable business action; the route
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
  payments(): Payment[] {
    return this.db.payments;
  }

  createPayment(input: Patch): Payment {
    const now = new Date().toISOString();
    const record: Payment = {
      id: makeId("pay"),
      orderId: String(input.orderId ?? ""),
      amount: mapNum(input.amount),
      method: String(input.method ?? "Cash") as Payment["method"],
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

  paymentsReceived(
    orderId: string,
    amount: number,
    method: string,
    reference: string,
    receivedBy: string,
  ): Payment | undefined {
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) return undefined;
    const now = new Date().toISOString();
    const payment: Payment = {
      id: makeId("pay"),
      orderId,
      amount: mapNum(amount),
      method: String(method ?? "Cash") as Payment["method"],
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
   * (spec §14: "Outstanding balance must be calculated server-side").
   * UNPAID → PARTIALLY_PAID → PAID → OVERPAID derives from sum(payments)
   * vs order.total; REFUNDED is manual and never overwritten.
   */
  recomputePaymentStatus(orderId: string): PaymentStatus | undefined {
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) return undefined;
    if (order.paymentStatus === "REFUNDED") return order.paymentStatus;
    const paid = this.db.payments
      .filter((p) => p.orderId === orderId)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const total = Number(order.total) || 0;
    let next: PaymentStatus;
    if (paid <= 0) next = "UNPAID";
    else if (total <= 0) next = "PAID"; // no priced total — any money received settles it
    else if (paid < total) next = "PARTIALLY_PAID";
    else if (paid > total) next = "OVERPAID";
    else next = "PAID";
    order.paymentStatus = next;
    order.updatedAt = new Date().toISOString();
    return next;
  }

  // ---- production ----
  productionJobs(): ProductionJob[] {
    return this.db.productionJobs;
  }

  createProductionJob(input: Patch): ProductionJob {
    const now = new Date().toISOString();
    const record: ProductionJob = {
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
      status: String(input.status ?? "PENDING") as ProductionJob["status"],
      stage: String(input.stage ?? "PLAN") as ProductionJob["stage"],
      progress: mapNum(input.progress),
      notes: String(input.notes ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    this.db.productionJobs.push(record);
    this.db.persist();
    return record;
  }

  updateProductionJob(id: string, patch: Patch): ProductionJob | undefined {
    const job = this.db.productionJobs.find((j) => j.id === id);
    if (!job) return undefined;
    applyPatch(job, patch, [
      "orderId", "customerId", "productId", "variantOptions", "quantity", "recipeVersion",
      "requiredBy", "requiredAt", "status", "stage", "progress", "notes",
    ]);
    job.updatedAt = new Date().toISOString();
    this.db.persist();
    return job;
  }

  qualityChecks(): QualityCheck[] {
    return this.db.qualityChecks;
  }

  createQualityCheck(input: Patch): QualityCheck {
    const now = new Date().toISOString();
    const record: QualityCheck = {
      id: makeId("qc"),
      jobId: String(input.jobId ?? ""),
      result: String(input.result ?? "PASS") as QualityCheck["result"],
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

  productionWastage(): ProductionWastage[] {
    return this.db.productionWastage;
  }

  createProductionWastage(input: Patch): ProductionWastage {
    const now = new Date().toISOString();
    const record: ProductionWastage = {
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

  productionConsumption(): ProductionConsumption[] {
    return this.db.productionConsumption;
  }

  createProductionConsumption(input: Patch): ProductionConsumption {
    const now = new Date().toISOString();
    const record: ProductionConsumption = {
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

  productionCosts(): ProductionCost[] {
    return this.db.productionCosts;
  }

  createProductionCost(input: Patch): ProductionCost {
    const now = new Date().toISOString();
    const record: ProductionCost = {
      id: makeId("pcost"),
      jobId: String(input.jobId ?? ""),
      ingredientCost: mapNum(input.ingredientCost),
      packagingCost: mapNum(input.packagingCost),
      labourCost: mapNum(input.labourCost),
      overheadCost: mapNum(input.overheadCost),
      total: mapNum(input.total),
      status: String(input.status ?? "PLANNED") as ProductionCost["status"],
      createdAt: now,
      updatedAt: now,
    };
    this.db.productionCosts.push(record);
    this.db.persist();
    return record;
  }

  // ---- inventory ----
  inventoryItems(): InventoryItem[] {
    return this.db.inventoryItems;
  }

  createInventoryItem(input: Patch): InventoryItem {
    const id = makeId("inv");
    const now = new Date().toISOString();
    const physicalStock = mapNum(input.physicalStock);
    const record: InventoryItem = {
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

  inventoryTransactions(): InventoryTransaction[] {
    return this.db.inventoryTransactions;
  }

  adjustInventory(
    itemId: string,
    quantity: number,
    unit: string,
    type: string,
    reference: string,
    user: string,
    unitCost?: number,
    notes?: string,
  ): InventoryTransaction | undefined {
    const item = this.db.inventoryItems.find((i) => i.id === itemId);
    if (!item) return undefined;
    const now = new Date().toISOString();
    const qty = mapNum(quantity);
    const transaction: InventoryTransaction = {
      id: makeId("txn"),
      itemId,
      quantity: qty,
      unit: String(unit ?? ""),
      type: String(type ?? "") as InventoryTransaction["type"],
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

  stockReservations(): StockReservation[] {
    return this.db.stockReservations;
  }

  // ---- purchasing ----
  suppliers(): Supplier[] {
    return this.db.suppliers;
  }

  createSupplier(input: Patch): Supplier {
    const now = new Date().toISOString();
    const record: Supplier = {
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

  purchaseOrders(): PurchaseOrder[] {
    return this.db.purchaseOrders;
  }

  findPurchaseOrder(poId: string): PurchaseOrder | undefined {
    return this.db.purchaseOrders.find((p) => p.id === poId);
  }

  createPurchaseOrder(input: Patch): PurchaseOrder {
    const id = makeId("po");
    const now = new Date().toISOString();
    const items: PurchaseOrderItem[] = Array.isArray(input.items)
      ? (input.items as Array<Record<string, unknown>>).map((raw) => ({
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
    const record: PurchaseOrder = {
      id,
      poNumber: String(input.poNumber ?? makeId("PO")),
      supplierId: String(input.supplierId ?? ""),
      date: mapDate(input.date) ?? now,
      expectedDate: mapDate(input.expectedDate) ?? now,
      items,
      total: mapNum(input.total),
      status: String(input.status ?? "DRAFT") as PurchaseOrder["status"],
      notes: String(input.notes ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    this.db.purchaseOrders.push(record);
    for (const item of items) this.db.poItems.push(item);
    this.db.persist();
    return record;
  }

  receivePurchaseOrder(
    poId: string,
    receivedBy: string,
  ): { purchaseOrder: PurchaseOrder; receipt: GoodsReceipt } | undefined {
    const po = this.db.purchaseOrders.find((p) => p.id === poId);
    if (!po || po.status === "CANCELLED") return undefined;
    const now = new Date().toISOString();
    po.status = "COMPLETED";
    po.updatedAt = now;
    for (const item of po.items) {
      item.receivedQuantity = item.quantity;
    }
    const receiptId = makeId("gr");
    // Spec §12: goods receipt must record every received line + update
    // supplier price history (cost analysis / supplier comparison).
    const receiptItems: GoodsReceiptItem[] = po.items.map((item) => ({
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
    const receipt: GoodsReceipt = {
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
      if (!poLine || !mapNum(item.unitCost)) continue;
      this.db.supplierPriceHistory.push({
        id: makeId("sph"),
        supplierId: po.supplierId,
        productId: poLine.productId,
        unit: item.unit,
        price: mapNum(item.unitCost),
        effectiveDate: now.slice(0, 10),
        note: `Goods receipt ${receiptId} · ${po.poNumber}`,
        createdAt: now,
        updatedAt: now,
      });
    }
    this.db.persist();
    return { purchaseOrder: po, receipt };
  }

  purchaseRequirements(): PurchaseRequirement[] {
    return this.db.purchaseRequirements;
  }

  goodsReceipts(): GoodsReceipt[] {
    return this.db.goodsReceipts;
  }

  supplierPriceHistory(): SupplierPriceHistory[] {
    return this.db.supplierPriceHistory;
  }

  createPurchaseRequirement(input: Patch): PurchaseRequirement {
    const now = new Date().toISOString();
    const record: PurchaseRequirement = {
      id: makeId("pr"),
      productIds: String(input.productIds ?? ""),
      quantity: mapNum(input.quantity),
      unit: String(input.unit ?? ""),
      reason: String(input.reason ?? ""),
      urgency: String(input.urgency ?? "MEDIUM") as PurchaseRequirement["urgency"],
      status: String(input.status ?? "OPEN") as PurchaseRequirement["status"],
      requestedBy: String(input.requestedBy ?? ""),
      requestedAt: mapDate(input.requestedAt) ?? now,
      createdAt: now,
      updatedAt: now,
    };
    this.db.purchaseRequirements.push(record);
    this.db.persist();
    return record;
  }

  updatePurchaseRequirement(id: string, patch: Patch): PurchaseRequirement | undefined {
    const req = this.db.purchaseRequirements.find((r) => r.id === id);
    if (!req) return undefined;
    applyPatch(req, patch, [
      "productIds", "quantity", "unit", "reason", "urgency", "status", "requestedBy", "requestedAt",
    ]);
    req.updatedAt = new Date().toISOString();
    this.db.persist();
    return req;
  }

  // ---- deliveries ----
  deliveries(): Delivery[] {
    return this.db.deliveries;
  }

  findDelivery(id: string): Delivery | undefined {
    return this.db.deliveries.find((d) => d.id === id);
  }

  createDelivery(input: Patch): Delivery {
    const now = new Date().toISOString();
    const record: Delivery = {
      id: makeId("del"),
      orderId: String(input.orderId ?? ""),
      type: String(input.type ?? "HOME_DELIVERY") as Delivery["type"],
      destination: String(input.destination ?? ""),
      scheduledAt: mapDate(input.scheduledAt),
      scheduledDate: mapDate(input.scheduledDate),
      scheduledTime: mapStr(input.scheduledTime),
      actualDispatchTime: mapDate(input.actualDispatchTime),
      actualDeliveryDate: mapDate(input.actualDeliveryDate),
      deliveryPerson: mapStr(input.deliveryPerson),
      deliveryFee: mapNum(input.deliveryFee),
      status: String(input.status ?? "PENDING") as Delivery["status"],
      notes: String(input.notes ?? ""),
      customerConfirmation: mapStr(input.customerConfirmation),
      createdAt: now,
      updatedAt: now,
    };
    this.db.deliveries.push(record);
    this.db.persist();
    return record;
  }

  updateDelivery(id: string, patch: Patch): Delivery | undefined {
    const delivery = this.db.deliveries.find((d) => d.id === id);
    if (!delivery) return undefined;
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
  createExpense(input: Patch): Expense {
    const now = new Date().toISOString();
    const record: Expense = {
      id: makeId("exp"),
      categoryId: String(input.categoryId ?? ""),
      amount: mapNum(input.amount),
      date: mapDate(input.date) ?? now,
      paymentMethod: String(input.paymentMethod ?? "Cash") as Expense["paymentMethod"],
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

  createCustomerFeedback(input: Patch): CustomerFeedback {
    const now = new Date().toISOString();
    const record: CustomerFeedback = {
      id: makeId("fdb"),
      customerId: String(input.customerId ?? ""),
      orderId: mapStr(input.orderId),
      productIds: String(input.productIds ?? ""),
      rating: mapNum(input.rating),
      type: String(input.type ?? "GENERAL") as CustomerFeedback["type"],
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
  notifications(): Notification[] {
    return this.db.notifications;
  }

  createNotification(input: Patch): Notification {
    const now = new Date().toISOString();
    const record: Notification = {
      id: makeId("ntf"),
      eventTypeId: String(input.eventTypeId ?? ""),
      title: String(input.title ?? ""),
      message: String(input.message ?? ""),
      priority: String(input.priority ?? "MEDIUM") as Notification["priority"],
      entityType: String(input.entityType ?? ""),
      entityId: String(input.entityId ?? ""),
      actionUrl: mapStr(input.actionUrl),
      deepLink: mapStr(input.deepLink),
      createdAt: now,
      createdBy: mapStr(input.createdBy),
      readAt: mapDate(input.readAt),
      deliveryStatus: String(input.deliveryStatus ?? "PENDING") as Notification["deliveryStatus"],
      failureReason: mapStr(input.failureReason),
      updatedAt: now,
    };
    this.db.notifications.push(record);
    this.db.persist();
    return record;
  }

  notificationRecipients(): NotificationRecipient[] {
    return this.db.notificationRecipients;
  }

  createNotificationRecipient(input: Patch): NotificationRecipient {
    const now = new Date().toISOString();
    const record: NotificationRecipient = {
      id: makeId("nrec"),
      notificationId: String(input.notificationId ?? ""),
      userId: String(input.userId ?? ""),
      deliveryChannel: String(input.deliveryChannel ?? "IN_APP") as NotificationRecipient["deliveryChannel"],
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

  createNotificationTemplate(input: Patch): NotificationTemplate {
    const existing = this.db.notificationTemplates.find(
      (t) => t.eventTypeId === String(input.eventTypeId ?? "") && t.channel === String(input.channel ?? ""),
    );
    if (existing) return existing;
    const now = new Date().toISOString();
    const record: NotificationTemplate = {
      id: makeId("ntp"),
      eventTypeId: String(input.eventTypeId ?? ""),
      channel: String(input.channel ?? "IN_APP") as NotificationTemplate["channel"],
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

  getUserNotifications(userId: string, limit = 50): Notification[] {
    void userId;
    return [...this.db.notifications]
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, mapNum(limit) || 50);
  }

  getUnreadCount(userId: string): number {
    return this.db.notificationRecipients.filter((r) => r.userId === userId && !r.readAt).length;
  }

  markAsRead(id: string, userId: string): boolean {
    const recipient = this.db.notificationRecipients.find(
      (r) => r.userId === userId && (r.id === id || r.notificationId === id) && !r.readAt,
    );
    if (!recipient) return false;
    recipient.readAt = new Date().toISOString();
    this.db.persist();
    return true;
  }

  markAllAsRead(userId: string): number {
    const now = new Date().toISOString();
    let count = 0;
    for (const r of this.db.notificationRecipients) {
      if (r.userId === userId && !r.readAt) {
        r.readAt = now;
        count += 1;
      }
    }
    if (count > 0) this.db.persist();
    return count;
  }

  getNotificationPreferences(userId: string): NotificationPreference[] {
    return this.db.notificationPreferences.filter((p) => p.userId === userId);
  }

  getNotificationPreference(userId: string, eventType: string): NotificationPreference | undefined {
    return this.db.notificationPreferences.find((p) => p.userId === userId && p.eventTypeId === eventType);
  }

  createNotificationPreference(input: Patch): NotificationPreference {
    const userId = String(input.userId ?? "");
    const eventTypeId = String(input.eventTypeId ?? "");
    const channel = String(input.channel ?? "IN_APP");
    const existing = this.db.notificationPreferences.find(
      (p) => p.userId === userId && p.eventTypeId === eventTypeId && p.channel === channel,
    );
    if (existing) return existing;
    const now = new Date().toISOString();
    const record: NotificationPreference = {
      id: makeId("nup"),
      userId,
      eventTypeId,
      channel: channel as NotificationPreference["channel"],
      enabled: input.enabled === undefined ? true : mapBool(input.enabled),
      createdAt: now,
      updatedAt: now,
    };
    this.db.notificationPreferences.push(record);
    this.db.persist();
    return record;
  }

  updateNotificationPreference(id: string, patch: Patch): NotificationPreference | undefined {
    const pref = this.db.notificationPreferences.find((p) => p.id === id);
    if (!pref) return undefined;
    if (patch.enabled !== undefined) pref.enabled = mapBool(patch.enabled);
    pref.updatedAt = new Date().toISOString();
    this.db.persist();
    return pref;
  }

  // ---- audit logs ----
  auditLogs(): AuditLog[] {
    return this.db.auditLogs;
  }

  createAuditLog(input: Patch): AuditLog {
    const now = new Date().toISOString();
    const record: AuditLog = {
      id: makeId("aud"),
      orderId: String(input.orderId ?? ""),
      actor: String(input.actor ?? ""),
      action: String(input.action ?? "") as AuditLog["action"],
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
  users(): User[] {
    return this.db.users;
  }

  findUser(id: string): User | undefined {
    return this.db.users.find((u) => u.id === id);
  }

  findUserByUsername(username: string): User | undefined {
    return this.db.users.find((u) => u.username === username);
  }

  updateUser(id: string, input: Patch): User | undefined {
    const user = this.db.users.find((u) => u.id === id);
    if (!user) return undefined;
    if (input.passwordHash !== undefined) user.passwordHash = String(input.passwordHash);
    if (input.displayName !== undefined) user.displayName = String(input.displayName);
    if (input.email !== undefined) user.email = String(input.email);
    if (input.phone !== undefined) user.phone = String(input.phone);
    if (input.role !== undefined) user.role = String(input.role) as User["role"];
    if (input.status !== undefined) user.status = String(input.status) as User["status"];
    user.updatedAt = new Date().toISOString();
    this.db.persist();
    return user;
  }

  createUser(input: Patch): User {
    const now = new Date().toISOString();
    const record: User = {
      id: makeId("usr"),
      username: String(input.username ?? ""),
      displayName: String(input.displayName ?? ""),
      email: String(input.email ?? ""),
      phone: mapStr(input.phone) ?? "",
      role: String(input.role ?? "Staff") as User["role"],
      isAdmin: input.isAdmin === undefined ? false : mapBool(input.isAdmin),
      status: String(input.status ?? "Active") as User["status"],
      passwordHash: String(input.passwordHash ?? "$2b$10$placeholder"),
      notify: (input.notify ?? {}) as User["notify"],
      createdAt: now,
      updatedAt: now,
    };
    this.db.users.push(record);
    this.db.persist();
    return record;
  }

  userRoles(): UserRole[] {
    return this.db.userRoles;
  }

  userRolesForUser(userId: string): UserRole[] {
    return this.db.userRoles
      .filter((r) => r.userId === userId)
      .sort((a, b) => a.roleId.localeCompare(b.roleId));
  }

  rolePermissions(): RolePermission[] {
    return this.db.rolePermissions;
  }

  rolePermissionsForRole(roleId: string): RolePermission[] {
    return this.db.rolePermissions
      .filter((p) => p.roleId === roleId)
      .sort((a, b) => a.permissionId.localeCompare(b.permissionId));
  }

  roles(): Role[] {
    return this.db.roles;
  }

  permissions(): Permission[] {
    return this.db.permissions;
  }

  // ---------------------------------------------------------------------------
  // E1 — Customer order history, occasions & recurring reminders
  // ---------------------------------------------------------------------------

  /** Orders placed by a customer, most recent first. Backs GET /customers/:id/orders. */
  ordersForCustomer(customerId: string): Order[] {
    return this.db.orders
      .filter((o) => o.customerId === customerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** The immutable contact snapshot captured when an order was placed. */
  orderCustomerSnapshot(orderId: string): OrderCustomerSnapshot | undefined {
    return this.db.orderSnapshots.find((s) => s.orderId === orderId);
  }

  /**
   * Build (never return a reference into the cache) the immutable contact
   * snapshot for an order (rule 27). Uses the customer profile as it stands at
   * order time; returns null if there is no customer or a snapshot already
   * exists for the order (UNIQUE order_id). Caller pushes + persists.
   */
  private buildOrderSnapshot(order: Order, capturedBy: string): OrderCustomerSnapshot | null {
    if (this.db.orderSnapshots.some((s) => s.orderId === order.id)) return null;
    const customer = this.customer(order.customerId);
    if (!customer) return null;
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
  createOrderCustomerSnapshot(order: Order): OrderCustomerSnapshot | null {
    const snapshot = this.buildOrderSnapshot(order, order.createdBy);
    if (!snapshot) return null;
    this.db.orderSnapshots.push(snapshot);
    this.db.persist();
    return snapshot;
  }

  eventsByCustomer(customerId: string): CustomerEvent[] {
    return this.db.customerEvents
      .filter((e) => e.customerId === customerId)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }

  customerEvent(eventId: string): CustomerEvent | undefined {
    return this.db.customerEvents.find((e) => e.id === eventId);
  }

  createCustomerEvent(input: Patch): CustomerEvent {
    const now = new Date().toISOString();
    const record: CustomerEvent = {
      id: makeId("cevt"),
      customerId: String(input.customerId ?? ""),
      orderId: mapStr(input.orderId),
      eventType: String(input.eventType ?? ""),
      eventDate: mapDate(input.eventDate)?.slice(0, 10) ?? now.slice(0, 10),
      recurrenceRule: String(input.recurrenceRule ?? "NONE") as EventRecurrence,
      notes: String(input.notes ?? ""),
      status: String(input.status ?? "ACTIVE") as CustomerEvent["status"],
      createdBy: String(input.createdBy ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    this.db.customerEvents.push(record);
    this.syncEventReminder(record);
    this.db.persist();
    return record;
  }

  updateCustomerEvent(eventId: string, input: Patch): CustomerEvent | undefined {
    const event = this.db.customerEvents.find((e) => e.id === eventId);
    if (!event) return undefined;
    applyPatch(event, input, ["eventType", "eventDate", "recurrenceRule", "notes", "status", "orderId"]);
    if (typeof input.eventDate === "string") {
      event.eventDate = mapDate(input.eventDate)?.slice(0, 10) ?? event.eventDate;
    }
    event.updatedAt = new Date().toISOString();
    this.syncEventReminder(event);
    this.db.persist();
    return event;
  }

  deleteCustomerEvent(eventId: string): boolean {
    const index = this.db.customerEvents.findIndex((e) => e.id === eventId);
    if (index === -1) return false;
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
   * auto-contacts the customer — staff act on a reminder and mark it Contacted.
   * Idempotent, safe to call on create/update.
   */
  private syncEventReminder(event: CustomerEvent): void {
    for (let i = this.db.customerEventReminders.length - 1; i >= 0; i--) {
      const r = this.db.customerEventReminders[i];
      if (r.eventId === event.id && r.status !== "CONTACTED" && r.status !== "DISMISSED") {
        this.db.customerEventReminders.splice(i, 1);
      }
    }
    if (event.status !== "ACTIVE") return;
    const nextDate = nextOccurrence(event.eventDate, event.recurrenceRule);
    if (new Date(`${nextDate}T09:00:00.000Z`).getTime() <= Date.now()) return;
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
  remindersForCustomer(customerId: string): CustomerEventReminder[] {
    return this.db.customerEventReminders
      .filter((r) => r.customerId === customerId)
      .sort((a, b) => a.nextReminderAt.localeCompare(b.nextReminderAt));
  }

  customerEventReminder(reminderId: string): CustomerEventReminder | undefined {
    return this.db.customerEventReminders.find((r) => r.id === reminderId);
  }

  /**
   * Reminders still awaiting action, whose occurrence falls within the next
   * `days` days (default 30) — backs GET /customer-reminders and the printable
   * next-7/30-day list. CONTACTED/DISMISSED reminders are excluded. Sorted by
   * next fire time so the most urgent surfaces first.
   */
  dueReminders(days = 30): CustomerEventReminder[] {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    return this.db.customerEventReminders
      .filter(
        (r) =>
          r.status !== "CONTACTED" &&
          r.status !== "DISMISSED" &&
          new Date(r.nextReminderAt).getTime() <= until,
      )
      .sort((a, b) => a.nextReminderAt.localeCompare(b.nextReminderAt));
  }

  /**
   * Staff act on a reminder: record the contact + outcome and roll the reminder
   * forward to the event's next future occurrence (annual → next year, monthly →
   * next month). One-off events produce no further reminder. The system itself
   * never contacts the customer — this is the only path that advances a
   * reminder, and it always requires a human (`contactedBy`). Backs
   * PATCH /customer-reminders/:id/contacted.
   */
  markReminderContacted(
    reminderId: string,
    input: Patch,
  ): CustomerEventReminder | undefined {
    const reminder = this.db.customerEventReminders.find((r) => r.id === reminderId);
    if (!reminder) return undefined;
    applyPatch(reminder, input, ["contactedBy", "outcome", "followUpNotes"]);
    reminder.contactedBy = mapStr(input.contactedBy) || reminder.contactedBy;
    reminder.outcome = mapStr(input.outcome) ?? "";
    reminder.followUpNotes = mapStr(input.followUpNotes) ?? "";
    reminder.lastContactedAt = new Date().toISOString();
    reminder.status = "CONTACTED";
    reminder.updatedAt = reminder.lastContactedAt;
    // Roll the parent event's reminder forward to its next future occurrence.
    const event = this.db.customerEvents.find((e) => e.id === reminder.eventId);
    if (event && event.status === "ACTIVE") this.syncEventReminder(event);
    this.db.persist();
    return reminder;
  }

  /** Dismiss a reminder (no further follow-up on this occurrence). */
  dismissReminder(reminderId: string): CustomerEventReminder | undefined {
    const reminder = this.db.customerEventReminders.find((r) => r.id === reminderId);
    if (!reminder) return undefined;
    reminder.status = "DISMISSED";
    reminder.updatedAt = new Date().toISOString();
    this.db.persist();
    return reminder;
  }

  // -------------------------------------------------------------------------
  // E2 — Website content: blog categories, blog posts, website users
  // Managed from the ERP "Site Management" page; the public website reads
  // the published subset via GET /api/v1/public/*. One DB, no duplicate store.
  // -------------------------------------------------------------------------

  // ---- blog categories ----

  blogCategories(): BlogCategory[] {
    return this.db.blogCategories
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  }

  blogCategory(id: string): BlogCategory | undefined {
    return this.db.blogCategories.find((c) => c.id === id);
  }

  createBlogCategory(input: Patch): BlogCategory {
    const now = new Date().toISOString();
    const record: BlogCategory = {
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

  updateBlogCategory(id: string, input: Patch): BlogCategory | undefined {
    const category = this.db.blogCategories.find((c) => c.id === id);
    if (!category) return undefined;
    applyPatch(category, input, ["name", "slug", "description", "displayOrder", "active"]);
    category.updatedAt = new Date().toISOString();
    this.db.persist();
    return category;
  }

  deleteBlogCategory(id: string): boolean {
    const idx = this.db.blogCategories.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.db.blogCategories.splice(idx, 1);
    // Detach posts (keep them, drop the category link) rather than cascade-delete.
    for (const p of this.db.blogPosts) {
      if (p.categoryId === id) p.categoryId = null;
    }
    this.db.persist();
    return true;
  }

  // ---- blog posts ----

  /** All posts (any status), newest first. Backs the ERP management table. */
  blogPosts(): BlogPost[] {
    return this.db.blogPosts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Published posts only, newest published first. Backs GET /public/blog. */
  publishedBlogPosts(): BlogPost[] {
    return this.db.blogPosts
      .filter((p) => p.status === "PUBLISHED")
      .sort((a, b) => {
        const av = a.publishedAt ?? a.createdAt;
        const bv = b.publishedAt ?? b.createdAt;
        return bv.localeCompare(av);
      });
  }

  blogPost(id: string): BlogPost | undefined {
    return this.db.blogPosts.find((p) => p.id === id);
  }

  blogPostBySlug(slug: string): BlogPost | undefined {
    return this.db.blogPosts.find((p) => p.slug === slug && p.status === "PUBLISHED");
  }

  createBlogPost(input: Patch): BlogPost {
    const now = new Date().toISOString();
    const status = (String(input.status ?? "DRAFT").toUpperCase() as BlogPost["status"]);
    const record: BlogPost = {
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

  updateBlogPost(id: string, input: Patch): BlogPost | undefined {
    const post = this.db.blogPosts.find((p) => p.id === id);
    if (!post) return undefined;
    const wasPublished = post.status === "PUBLISHED";
    applyPatch(post, input, [
      "categoryId", "title", "slug", "excerpt", "body", "coverImage", "author", "status", "publishedAt",
    ]);
    if (typeof input.slug === "string") post.slug = slugify(input.slug);
    // Stamp publishedAt the first time a post transitions to PUBLISHED.
    if (!wasPublished && post.status === "PUBLISHED" && !post.publishedAt) {
      post.publishedAt = new Date().toISOString();
    }
    post.updatedAt = new Date().toISOString();
    this.db.persist();
    return post;
  }

  deleteBlogPost(id: string): boolean {
    const idx = this.db.blogPosts.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.db.blogPosts.splice(idx, 1);
    this.db.persist();
    return true;
  }

  // ---- website users ----

  websiteUsers(): WebsiteUser[] {
    return this.db.websiteUsers.slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  websiteUser(id: string): WebsiteUser | undefined {
    return this.db.websiteUsers.find((u) => u.id === id);
  }

  websiteUserByEmail(email: string): WebsiteUser | undefined {
    const target = email.trim().toLowerCase();
    return this.db.websiteUsers.find((u) => u.email.trim().toLowerCase() === target);
  }

  createWebsiteUser(input: Patch): WebsiteUser {
    const now = new Date().toISOString();
    const record: WebsiteUser = {
      id: makeId("wuser"),
      name: String(input.name ?? ""),
      email: String(input.email ?? ""),
      phone: String(input.phone ?? ""),
      passwordHash: String(input.passwordHash ?? ""),
      role: (String(input.role ?? "CUSTOMER").toUpperCase() as WebsiteUserRole),
      status: (String(input.status ?? "ACTIVE").toUpperCase() as WebsiteUserStatus),
      customerId: mapStr(input.customerId),
      lastLoginAt: mapDate(input.lastLoginAt),
      createdAt: now,
      updatedAt: now,
    };
    this.db.websiteUsers.push(record);
    this.db.persist();
    return record;
  }

  updateWebsiteUser(id: string, input: Patch): WebsiteUser | undefined {
    const user = this.db.websiteUsers.find((u) => u.id === id);
    if (!user) return undefined;
    applyPatch(user, input, [
      "name", "email", "phone", "passwordHash", "role", "status", "customerId", "lastLoginAt",
    ]);
    user.updatedAt = new Date().toISOString();
    this.db.persist();
    return user;
  }

  deleteWebsiteUser(id: string): boolean {
    const idx = this.db.websiteUsers.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    this.db.websiteUsers.splice(idx, 1);
    this.db.persist();
    return true;
  }

  // -------------------------------------------------------------------------
  // E7 — Staff management & salary/remuneration (governing doc §§18.1–18.8)
  // Salary figures are confidential: routes gate every read behind a
  // remuneration.* permission. Workflow status transitions are enforced here
  // so no route can bypass them. CLOSED periods are terminal — corrections
  // become NEW records, never silent rewrites (§18.7 / rule 34).
  // -------------------------------------------------------------------------

  // ---- staff (§18.1: identity, roles, schedule, notes) ----

  staffList(): Staff[] {
    return this.db.staff.slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  findStaff(id: string): Staff | undefined {
    return this.db.staff.find((s) => s.id === id);
  }

  createStaff(input: Patch): Staff {
    const now = new Date().toISOString();
    const record: Staff = {
      id: makeId("staff"),
      staffNumber: String(input.staffNumber ?? "") || `STF-${(this.db.staff.length + 1).toString().padStart(3, "0")}`,
      name: String(input.name ?? ""),
      phone: String(input.phone ?? ""),
      email: String(input.email ?? ""),
      jobTitle: String(input.jobTitle ?? ""),
      employmentStatus: String(input.employmentStatus ?? "ACTIVE") as Staff["employmentStatus"],
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

  updateStaff(id: string, patch: Patch): Staff | undefined {
    const staff = this.db.staff.find((s) => s.id === id);
    if (!staff) return undefined;
    applyPatch(staff, patch, [
      "staffNumber", "name", "phone", "email", "jobTitle", "employmentStatus",
      "startDate", "schedule", "notes", "userId",
    ]);
    staff.updatedAt = new Date().toISOString();
    this.db.persist();
    return staff;
  }

  /** No hard delete — salary history must stay reconstructable (§18.7). */
  archiveStaff(id: string): Staff | undefined {
    return this.updateStaff(id, { employmentStatus: "TERMINATED" });
  }

  // ---- attendance (§18.1: one row per staff per day, upsert) ----

  attendance(staffId?: string, fromDate?: string, toDate?: string): StaffAttendance[] {
    return this.db.staffAttendance
      .filter((a) => (staffId ? a.staffId === staffId : true))
      .filter((a) => (fromDate ? a.date >= fromDate : true))
      .filter((a) => (toDate ? a.date <= toDate : true))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  recordAttendance(input: Patch): StaffAttendance {
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
    const record: StaffAttendance = {
      id: makeId("att"),
      staffId,
      date,
      status: String(input.status ?? "PRESENT") as StaffAttendance["status"],
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

  // ---- salary profiles (§18.2: confidential recurring baseline) ----

  salaryProfileFor(staffId: string): SalaryProfile | undefined {
    return this.db.salaryProfiles.find((p) => p.staffId === staffId);
  }

  /** One profile per staff: create on first save, update thereafter. */
  upsertSalaryProfile(staffId: string, input: Patch): SalaryProfile {
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
    const record: SalaryProfile = {
      id: makeId("salp"),
      staffId,
      basicSalary: mapNum(input.basicSalary),
      paymentFrequency: String(input.paymentFrequency ?? "monthly") as SalaryProfile["paymentFrequency"],
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
  // ---- payment periods (§18.3 admin-defined; §18.4 workflow) ----
  //
  // CREATE → OPEN → (select+calculate) PROCESSING → (approve) APPROVED
  //        → (record payments) PARTIALLY_PAID / PAID → (close) CLOSED.
  // CLOSED is terminal: no item/payment/period mutation is ever applied.

  remunerationPeriods(): RemunerationPeriod[] {
    return this.db.remunerationPeriods.slice().sort((a, b) => b.startDate.localeCompare(a.startDate));
  }

  findPeriod(id: string): RemunerationPeriod | undefined {
    return this.db.remunerationPeriods.find((p) => p.id === id);
  }

  createPeriod(input: Patch): RemunerationPeriod {
    const now = new Date().toISOString();
    const record: RemunerationPeriod = {
      id: makeId("rper"),
      label: String(input.label ?? ""),
      periodType: String(input.periodType ?? "monthly") as RemunerationPeriod["periodType"],
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

  /** Throws when the period is CLOSED — the invariant every mutator shares. */
  private assertPeriodOpen(period: RemunerationPeriod, what: string): void {
    if (period.status === "CLOSED") {
      throw new Error(`Period is CLOSED — ${what} must be recorded as a new adjustment, never a rewrite`);
    }
  }

  periodItems(periodId: string): RemunerationItem[] {
    return this.db.remunerationItems
      .filter((i) => i.periodId === periodId)
      .sort((a, b) => a.staffId.localeCompare(b.staffId));
  }

  periodPayments(periodId: string): RemunerationPayment[] {
    return this.db.remunerationPayments
      .filter((p) => p.periodId === periodId)
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }

  /** net = basic + allowances + bonuses − deductions − advance + other (§18.4). */
  private computeNet(i: { basicSalary: number; allowances: number; bonuses: number; deductions: number; advanceAmount: number; otherPayments: number }): number {
    return Math.round(
      (i.basicSalary + i.allowances + i.bonuses - i.deductions - i.advanceAmount + i.otherPayments) * 100,
    ) / 100;
  }

  private recomputePeriodTotals(periodId: string): void {
    const period = this.findPeriod(periodId);
    if (!period) return;
    const items = this.periodItems(periodId);
    period.totalAmount = Math.round(items.reduce((n, i) => n + i.netAmount, 0) * 100) / 100;
    period.paidAmount = Math.round(items.reduce((n, i) => n + i.paidAmount, 0) * 100) / 100;
    if (period.status !== "CLOSED" && period.status !== "OPEN") {
      if (period.paidAmount <= 0) period.status = period.approvedAt ? "APPROVED" : period.status;
      else if (period.paidAmount >= period.totalAmount && period.totalAmount > 0) period.status = "PAID";
      else period.status = "PARTIALLY_PAID";
    }
    period.updatedAt = new Date().toISOString();
  }
  /**
   * SELECT STAFF + CALCULATE (§18.4): materialise one item per selected staff
   * from their salary profile. Re-runnable while OPEN/PROCESSING — approved
   * lines are frozen. Advances are NEVER auto-deducted: the Admin opts in per
   * line so outstanding balances stay visible (§18.6).
   */
  calculatePeriod(periodId: string, staffIds: string[], _actor: string): RemunerationItem[] {
    const period = this.findPeriod(periodId);
    if (!period) throw new Error("Period not found");
    this.assertPeriodOpen(period, "calculation");
    if (period.approvedAt) throw new Error("Period is already APPROVED — adjustments must be new records");
    const now = new Date().toISOString();
    const targets = staffIds.length
      ? staffIds
      : this.db.staff.filter((s) => s.employmentStatus === "ACTIVE" || s.employmentStatus === "PROBATION").map((s) => s.id);
    const created: RemunerationItem[] = [];
    for (const staffId of targets) {
      if (!this.findStaff(staffId)) continue;
      const existing = this.db.remunerationItems.find((i) => i.periodId === periodId && i.staffId === staffId);
      if (existing && existing.status !== "PENDING") continue;
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
      } else {
        const record: RemunerationItem = {
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
    if (period.status === "OPEN") period.status = "PROCESSING";
    period.updatedAt = now;
    this.recomputePeriodTotals(periodId);
    this.db.persist();
    return created;
  }

  updatePeriodItem(itemId: string, patch: Patch): RemunerationItem | undefined {
    const item = this.db.remunerationItems.find((i) => i.id === itemId);
    if (!item) return undefined;
    const period = this.findPeriod(item.periodId);
    if (!period) return undefined;
    this.assertPeriodOpen(period, "item adjustment");
    if (period.approvedAt && item.status !== "PENDING") {
      throw new Error("Approved lines are frozen — record corrections as a NEW adjustment line");
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

  /** Additive correction line for APPROVED/CLOSED periods (§18.7 history). */
  addAdjustmentItem(periodId: string, input: Patch): RemunerationItem {
    const period = this.findPeriod(periodId);
    if (!period) throw new Error("Period not found");
    if (!period.approvedAt) throw new Error("Adjustments only apply after approval — edit the line directly");
    const now = new Date().toISOString();
    const draft = {
      basicSalary: mapNum(input.basicSalary),
      allowances: mapNum(input.allowances),
      bonuses: mapNum(input.bonuses),
      deductions: mapNum(input.deductions),
      advanceAmount: mapNum(input.advanceAmount),
      otherPayments: mapNum(input.otherPayments),
    };
    const record: RemunerationItem = {
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

  /** REVIEW/ADJUST → APPROVE: freeze every line (§18.4/§18.7). */
  approvePeriod(periodId: string, actor: string): RemunerationPeriod | undefined {
    const period = this.findPeriod(periodId);
    if (!period) return undefined;
    this.assertPeriodOpen(period, "approval");
    if (period.approvedAt) throw new Error("Period is already approved");
    if (this.periodItems(periodId).length === 0) throw new Error("Calculate salary before approving — no items selected");
    const now = new Date().toISOString();
    period.status = "APPROVED";
    period.approvedBy = actor || null;
    period.approvedAt = now;
    period.updatedAt = now;
    for (const item of this.periodItems(periodId)) {
      if (item.status === "PENDING") item.status = "APPROVED";
    }
    this.db.persist();
    return period;
  }
  // ---- payments (§18.7): record → mark paid → rollup → close ----

  recordPayment(input: Patch): RemunerationPayment {
    const period = this.findPeriod(String(input.periodId ?? ""));
    if (!period) throw new Error("Period not found");
    this.assertPeriodOpen(period, "payment recording");
    if (!period.approvedAt) throw new Error("Approve the period before recording payments");
    const now = new Date().toISOString();
    const record: RemunerationPayment = {
      id: makeId("rpay"),
      periodId: period.id,
      staffId: String(input.staffId ?? ""),
      itemId: mapStr(input.itemId),
      amount: mapNum(input.amount),
      paymentDate: String(input.paymentDate ?? now).slice(0, 10),
      method: String(input.method ?? "CASH") as RemunerationPayment["method"],
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
  markPaymentPaid(paymentId: string, actor: string): RemunerationPayment | undefined {
    const payment = this.db.remunerationPayments.find((p) => p.id === paymentId);
    if (!payment) return undefined;
    const period = this.findPeriod(payment.periodId);
    if (!period) return undefined;
    this.assertPeriodOpen(period, "marking a payment paid");
    if (payment.paymentStatus === "PAID") return payment; // idempotent
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

  /** CLOSE PERIOD: terminal. Totals + rows are frozen from here on (§18.7). */
  closePeriod(periodId: string, actor: string): RemunerationPeriod | undefined {
    const period = this.findPeriod(periodId);
    if (!period) return undefined;
    if (period.status === "CLOSED") return period; // idempotent
    if (!period.approvedAt) throw new Error("Approve the period before closing it");
    const now = new Date().toISOString();
    period.status = "CLOSED";
    period.closedAt = now;
    period.updatedAt = now;
    void actor;
    this.db.persist();
    return period;
  }

  // ---- advances (§18.6): original amount immutable, repayments append ----

  staffAdvances(staffId?: string): StaffAdvance[] {
    return this.db.staffAdvances
      .filter((a) => (staffId ? a.staffId === staffId : true))
      .sort((a, b) => String(b.advanceDate ?? b.createdAt).localeCompare(String(a.advanceDate ?? a.createdAt)));
  }

  outstandingAdvances(staffId: string): number {
    return Math.round(
      this.db.staffAdvances
        .filter((a) => a.staffId === staffId && a.status === "OUTSTANDING")
        .reduce((n, a) => n + (a.amount - a.repaidAmount), 0) * 100,
    ) / 100;
  }

  createAdvance(input: Patch): StaffAdvance {
    const now = new Date().toISOString();
    const record: StaffAdvance = {
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
   * Recovery/repayment: appends to repaymentLog and bumps repaidAmount —
   * `amount` is NEVER reduced, so the original grant stays reconstructable
   * (§18.6 "must not be silently overwritten"). Settles at zero outstanding.
   */
  recordAdvanceRepayment(advanceId: string, input: Patch): StaffAdvance | undefined {
    const advance = this.db.staffAdvances.find((a) => a.id === advanceId);
    if (!advance) return undefined;
    const outstanding = advance.amount - advance.repaidAmount;
    const amount = mapNum(input.amount);
    if (amount <= 0) throw new Error("Repayment amount must be positive");
    if (amount > outstanding + 0.001) throw new Error(`Repayment exceeds outstanding balance (${outstanding})`);
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
  // ---- payslips & dashboard (§18.5/§18.8) ----

  /**
   * Issue payslips for every approved line of a period. Figures are COPIED at
   * issue time — later profile/line edits never rewrite an issued document.
   * Reissuing an already-issued staff line is a no-op (idempotent).
   */
  issuePayslips(periodId: string, actor: string): Payslip[] {
    const period = this.findPeriod(periodId);
    if (!period) throw new Error("Period not found");
    if (!period.approvedAt) throw new Error("Approve the period before issuing payslips");
    const now = new Date().toISOString();
    const issued: Payslip[] = [];
    for (const item of this.periodItems(periodId)) {
      const staff = this.findStaff(item.staffId);
      if (!staff) continue;
      const already = this.db.payslips.find((p) => p.periodId === periodId && p.staffId === item.staffId);
      if (already) {
        issued.push(already);
        continue;
      }
      const record: Payslip = {
        id: makeId("pslip"),
        periodId,
        staffId: item.staffId,
        itemId: item.id,
        periodLabel: period.label || `${period.startDate} → ${period.endDate}`,
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

  payslips(periodId?: string, staffId?: string): Payslip[] {
    return this.db.payslips
      .filter((p) => (periodId ? p.periodId === periodId : true))
      .filter((p) => (staffId ? p.staffId === staffId : true))
      .sort((a, b) => String(b.issuedAt ?? b.createdAt).localeCompare(String(a.issuedAt ?? a.createdAt)));
  }

  /**
   * §18.5 — the Admin's period dashboard: totals due/paid/pending, allowances,
   * deductions, outstanding advances, status and upcoming payment dates, with
   * drill-down ids. Everything derives from live rows, never cached figures.
   */
  remunerationDashboard(periodId?: string): Record<string, unknown> {
    const periods = this.remunerationPeriods();
    const period = periodId ? this.findPeriod(periodId) : periods.find((p) => p.status !== "CLOSED") ?? periods[0];
    const items = period ? this.periodItems(period.id) : [];
    const sum = (pick: (i: RemunerationItem) => number) => Math.round(items.reduce((n, i) => n + pick(i), 0) * 100) / 100;
    const outstandingAdvances = Math.round(
      this.db.staffAdvances.filter((a) => a.status === "OUTSTANDING").reduce((n, a) => n + (a.amount - a.repaidAmount), 0) * 100,
    ) / 100;
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

