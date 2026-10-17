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
  OrderStatusHistory,
  Payment,
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
  Role,
  RolePermission,
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
      "deliveryStatus", "quotationId", "inquiryId", "createdBy", "deliveredAt",
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
    if (order.paymentStatus === "UNPAID") order.paymentStatus = "PARTIALLY_PAID";
    order.updatedAt = now;
    this.db.persist();
    return payment;
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
}

// ---------------------------------------------------------------------------
// Singleton (routes import { store } from "../database/store.js")
// ---------------------------------------------------------------------------

export const store = new MemoryStore();

