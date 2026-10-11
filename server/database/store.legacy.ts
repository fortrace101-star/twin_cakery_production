import { getDb, DbCache } from "./index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function mapDate(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date(v as string).toISOString();
}

function mapBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v !== "";
  return Boolean(v);
}

export class Store {
  /** Backing data (Postgres-backed cache supplied by index.ts). */
  get db(): DbCache {
    return getDb();
  }

  // ---- customers ----

  customers(): Customer[] {
    return (this.db.customers ?? []) as Customer[];
  }

  findCustomer(id: string): Customer | undefined {
    return this.customers().find((c) => c.id === id);
  }

  createCustomer(input: Partial<Record<string, unknown>>): Customer {
    const now = new Date().toISOString();
    const record: Customer = {
      id: `cust-${now}-${Math.random().toString(36).slice(2, 8)}`,
      name: String(input.name ?? ""),
      phone: String(input.phone ?? ""),
      email: String(input.email ?? ""),
      addresses: [],
      preferredContactMethod: String(input.preferredContactMethod ?? "phone"),
      source: String(input.source ?? "In-house"),
      notes: String(input.notes ?? ""),
      status: String(input.status ?? "Active"),
      firstOrderDate: mapDate(input.firstOrderDate) ?? null,
      lastOrderDate: mapDate(input.lastOrderDate) ?? null,
      totalOrders: mapNum(input.totalOrders),
      totalSpend: mapNum(input.totalSpend),
      feedbackSummary: [],
      createdAt: now,
      updatedAt: now,
    };
    this.db.customers.push(record);
    this.db.persist();
    return record;
  }

  updateCustomer(id: string, patch: Partial<Record<string, unknown>>): Customer | undefined {
    const customers = this.customers();
    const idx = customers.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    const customer = customers[idx];
    const updated: Customer = { ...customer, ...patch, updatedAt: new Date().toISOString() } as Customer;
    customers[idx] = updated;
    this.db.persist();
    return updated;
  }

  deleteCustomer(id: string): boolean {
    const customers = this.customers();
    const idx = customers.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    customers.splice(idx, 1);
    this.db.persist();
    return true;
  }

  // ---- interactions ----

  interactionsByCustomer(customerId: string): CustomerInteraction[] {
    return (this.db.customerInteractions ?? []) as CustomerInteraction[];
  }

  createInteraction(interaction: Partial<Record<string, unknown>>): CustomerInteraction {
    const now = new Date().toISOString();
    const record: CustomerInteraction = {
      id: `int-${now}-${Math.random().toString(36).slice(2, 8)}`,
      customerId: String(interaction.customerId ?? ""),
      channel: String(interaction.channel ?? ""),
      staffMember: String(interaction.staffMember ?? ""),
      dateTime: mapDate(interaction.dateTime) ?? now,
      subject: String(interaction.subject ?? ""),
      summary: String(interaction.summary ?? ""),
      outcome: String(interaction.outcome ?? ""),
      followUpRequired: mapBool(interaction.followUpRequired),
      relatedInquiryId: mapDate(interaction.relatedInquiryId) ?? null,
      relatedOrderId: mapDate(interaction.relatedOrderId) ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.customerInteractions.push(record);
    this.db.persist();
    return record;
  }
}

  // ---- inquiries ----

  inquiries(): Inquiry[] {
    return (this.db.inquiries ?? []) as Inquiry[];
  }

  createInquiry(inquiry: Partial<Record<string, unknown>>): Inquiry {
    const now = new Date().toISOString();
    const record: Inquiry = {
      id: `inq-${now}-${Math.random().toString(36).slice(2, 8)}`,
      customerId: String(inquiry.customerId ?? ""),
      channel: String(inquiry.channel ?? ""),
      staffMember: mapDate(inquiry.staffMember) ?? null,
      subject: String(inquiry.subject ?? ""),
      summary: String(inquiry.summary ?? ""),
      details: String(inquiry.details ?? ""),
      status: String(inquiry.status ?? "NEW"),
      priority: String(inquiry.priority ?? "MEDIUM"),
      relatedQuoteId: mapDate(inquiry.relatedQuoteId) ?? null,
      relatedOrderId: mapDate(inquiry.relatedOrderId) ?? null,
      followUpRequired: mapBool(inquiry.followUpRequired),
      nextAction: mapDate(inquiry.nextAction) ?? null,
      resolvedAt: mapDate(inquiry.resolvedAt) ?? null,
      source: String(inquiry.source ?? "PHONE"),
      createdAt: now,
      updatedAt: now,
    };
    this.db.inquiries.push(record);
    this.db.persist();
    return record;
  }

  updateInquiry(id: string, patch: Partial<Record<string, unknown>>): Inquiry | undefined {
    const inquiries = this.inquiries();
    const idx = inquiries.findIndex((i) => i.id === id);
    if (idx === -1) return undefined;
    const inquiry = inquiries[idx];
    const updated: Inquiry = { ...inquiry, ...patch, updatedAt: new Date().toISOString() } as Inquiry;
    inquiries[idx] = updated;
    this.db.persist();
    return updated;
  }

  // ---- quotations ----

  quotations(): Quotation[] {
    return (this.db.quotations ?? []) as Quotation[];
  }

  createQuotation(input: Partial<Record<string, unknown>>): Quotation {
    const now = new Date().toISOString();
    const quotationId = `qt-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const record: Quotation = {
      id: quotationId,
      quotationNumber: String(input.quotationNumber ?? `QT-${now.slice(-6)}`),
      customerId: String(input.customerId ?? ""),
      salespersonId: mapDate(input.salespersonId) ?? null,
      items: [],
      notes: String(input.notes ?? ""),
      validityExpiry: mapDate(input.validityExpiry) ?? null,
      status: String(input.status ?? "DRAFT"),
      taxAmount: mapNum(input.taxAmount),
      total: mapNum(input.total),
      unitTotal: mapNum(input.unitTotal),
      submittedAt: null,
      acceptedAt: null,
      createdBy: String(input.createdBy ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    this.db.quotations.push(record);
    for (const item of input.items as { productId?: string }[] || []) {
      this.db.quotationItems.push({
        id: `qtio-${quotationId}-${Math.random().toString(36).slice(2, 8)}`,
        quotationId,
        productId: String(item.productId ?? ""),
        variantOptions: String(item.variantOptions ?? ""),
        quantity: mapNum(item.quantity),
        unitPrice: mapNum(item.unitPrice),
        discount: mapNum(item.discount),
        total: mapNum(item.total),
        createdAt: now,
        updatedAt: now,
      } as QuotationItem);
    }
    this.db.persist();
    return record;
  }

  sendQuotation(id: string): Quotation | undefined {
    const quotations = this.quotations();
    const quotation = quotations.find((q) => q.id === id);
    if (!quotation) return undefined;
    quotation.status = "SENT";
    quotation.submittedAt = new Date().toISOString();
    quotation.updatedAt = new Date().toISOString();
    this.db.persist();
    return quotation;
  }

  acceptQuotation(id: string): Quotation | undefined {
    const quotations = this.quotations();
    const quotation = quotations.find((q) => q.id === id);
    if (!quotation) return undefined;
    quotation.status = "ACCEPTED";
    quotation.acceptedAt = new Date().toISOString();
    quotation.updatedAt = new Date().toISOString();
    this.db.persist();
    return quotation;
  }

  // ---- orders ----

  orders(): Order[] {
    return (this.db.orders ?? []) as Order[];
  }

  createOrder(input: Partial<Record<string, unknown>>): Order {
    const now = new Date().toISOString();
    const orderId = `ord-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const total = Number(input.total ?? 0);
    const record: Order = {
      id: orderId,
      orderNumber: String(input.orderNumber ?? `ORD-${now.slice(-6)}`),
      customerId: String(input.customerId ?? ""),
      salespersonId: mapDate(input.salespersonId) ?? null,
      warehouseId: mapDate(input.warehouseId) ?? null,
      routeId: mapDate(input.routeId) ?? null,
      items: [],
      notes: String(input.notes ?? ""),
      subtotal: mapNum(input.subtotal),
      discount: mapNum(input.discount),
      taxAmount: mapNum(input.taxAmount),
      total,
      shippingAddress: String(input.shippingAddress ?? ""),
      source: String(input.source ?? ""),
      status: String(input.status ?? "DRAFT"),
      scheduledDate: mapDate(input.scheduledDate) ?? null,
      actualDeliveryDate: null,
      deliveredAt: null,
      deliveredBy: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.orders.push(record);
    for (const item of input.items as { productId?: string }[] || []) {
      this.db.orderItems.push({
        id: `ordio-${orderId}-${Math.random().toString(36).slice(2, 8)}`,
        orderId,
        productId: String(item.productId ?? ""),
        variantOptions: String(item.variantOptions ?? ""),
        quantity: mapNum(item.quantity),
        unitPrice: mapNum(item.unitPrice),
        discount: mapNum(item.discount),
        total: mapNum(item.total),
        createdAt: now,
        updatedAt: now,
      } as OrderItem);
    }
    this.db.persist();
    return record;
  }

  updateOrder(id: string, patch: Partial<Record<string, unknown>>): Order | undefined {
    const orders = this.orders();
    const order = orders.find((o) => o.id === id);
    if (!order) return undefined;
    const updated: Order = { ...order, ...patch, updatedAt: new Date().toISOString() } as Order;
    const idx = orders.findIndex((o) => o.id === id);
    orders[idx] = updated;
    this.db.persist();
    return updated;
  }

  updateOrderStatus(id: string, status: OrderStatus, metadata?: Record<string, unknown>): Order | undefined {
    const orders = this.orders();
    const order = orders.find((o) => o.id === id);
    if (!order) return undefined;
    const prev = order.status;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    if (metadata) {
      (order as Order & { metadata?: Record<string, unknown> }).metadata = metadata;
    }
    // Daily summary rollup: the orders array caches a pre-computed
    // summary object; refresh it after a status change by aggregating
    // the in-memory collection (routes read from this array).
    this.db.ordersSummary = [
      {
        date: new Date().toISOString().slice(0, 10),
        totalOrders: this.orders().filter((o) => o.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
        totalRevenue: this.orders().filter((o) => o.status !== "DRAFT").reduce((s, o) => s + Number(o.total ?? 0), 0) as number,
      },
    ];
    if (prev !== status) {
      const history: OrderStatusHistory = {
        id: `osh-${order.id}-${now}-${Math.random().toString(36).slice(2, 8)}`,
        orderId: order.id,
        oldStatus: prev,
        newStatus: status,
        changedBy: String(metadata?.changedBy ?? ""),
        reason: String(metadata?.reason ?? ""),
        createdAt: order.updatedAt,
      };
      this.db.orderStatusHistory.push(history);
    }
    this.db.persist();
    return order;
  }

  cancelOrder(id: string): Order | undefined {
    return this.updateOrderStatus(id, "CANCELLED", { reason: "Cancelled" });
  }

  // ---- payments ----

  payments(): Payment[] {
    return (this.db.payments ?? []) as Payment[];
  }

  createPayment(payment: Partial<Record<string, unknown>>): Payment {
    const now = new Date().toISOString();
    const record: Payment = {
      id: `pay-${now}-${Math.random().toString(36).slice(2, 8)}`,
      orderId: String(payment.orderId ?? ""),
      amount: mapNum(payment.amount),
      method: String(payment.method ?? ""),
      reference: String(payment.reference ?? ""),
      appliedAt: mapDate(payment.appliedAt) ?? now,
      notes: String(payment.notes ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    this.db.payments.push(record);
    this.db.persist();
    return record;
  }

  paymentsReceived(orderId: string): Payment[] {
    return (this.db.payments ?? [])
      .filter((p) => p.orderId === orderId)
      .sort((a, b) => a.appliedAt.localeCompare(b.appliedAt)) as Payment[];
  }

  // ---- inventory ----

  inventoryItems(): InventoryItem[] {
    return (this.db.inventoryItems ?? []) as InventoryItem[];
  }

  createInventoryItem(input: Partial<Record<string, unknown>>): InventoryItem {
    const now = new Date().toISOString();
    const record: InventoryItem = {
      id: `inv-${now}-${Math.random().toString(36).slice(2, 8)}`,
      productId: String(input.productId ?? ""),
      locationId: mapDate(input.locationId) ?? null,
      batchCode: String(input.batchCode ?? ""),
      quantity: mapNum(input.quantity),
      reorderLevel: mapNum(input.reorderLevel),
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    this.db.inventoryItems.push(record);
    this.db.persist();
    return record;
  }

  adjustInventory(itemId: string, adjustment: number, reason: string, operator?: string): InventoryItem | undefined {
    const items = this.inventoryItems();
    const item = items.find((i) => i.id === itemId);
    if (!item) return undefined;
    const previous = item.quantity;
    item.quantity = Math.round((Number(item.quantity) + Number(adjustment)) * 100) / 100;
    item.updatedAt = new Date().toISOString();
    const transaction: InventoryTransaction = {
      id: `invtx-${itemId}-${new Date().toISOString().slice(8)}-${Math.random().toString(36).slice(2, 8)}`,
      itemId,
      adjustment: Number(adjustment),
      reason,
      operator: operator ?? "System",
      note: String(reason),
      createdAt: item.updatedAt,
    };
    this.db.inventoryTransactions.push(transaction);
    this.db.persist();
    return item;
  }

  // ---- stock reservations ----

  stockReservations(): StockReservation[] {
    return (this.db.stockReservations ?? []) as StockReservation[];
  }

  createStockReservation(input: Partial<Record<string, unknown>>): StockReservation {
    const now = new Date().toISOString();
    const record: StockReservation = {
      id: `res-${now}-${Math.random().toString(36).slice(2, 8)}`,
      productId: String(input.productId ?? ""),
      quantity: mapNum(input.quantity),
      reservedBy: String(input.reservedBy ?? ""),
      expiresAt: mapDate(input.expiresAt) ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.stockReservations.push(record);
    this.db.persist();
    return record;
  }

  // ---- suppliers ----

  suppliers(): Supplier[] {
    return (this.db.suppliers ?? []) as Supplier[];
  }

  createSupplier(supplier: Partial<Record<string, unknown>>): Supplier {
    const now = new Date().toISOString();
    const record: Supplier = {
      id: `sup-${now}-${Math.random().toString(36).slice(2, 8)}`,
      businessName: String(supplier.businessName ?? ""),
      contactPerson: String(supplier.contactPerson ?? ""),
      phone: String(supplier.phone ?? ""),
      email: String(supplier.email ?? ""),
      address: String(supplier.address ?? ""),
      productsSupplied: String(supplier.productsSupplied ?? ""),
      paymentTerms: String(supplier.paymentTerms ?? ""),
      notes: String(supplier.notes ?? ""),
      active: mapBool(supplier.active),
      createdAt: now,
      updatedAt: now,
    };
    this.db.suppliers.push(record);
    this.db.persist();
    return record;
  }

  // ---- purchase orders ----

  purchaseOrders(): PurchaseOrder[] {
    return (this.db.purchaseOrders ?? []) as PurchaseOrder[];
  }

  createPurchaseOrder(input: Partial<Record<string, unknown>>): PurchaseOrder {
    const now = new Date().toISOString();
    const record: PurchaseOrder = {
      id: `po-${now}-${Math.random().toString(36).slice(2, 8)}`,
      poNumber: String(input.poNumber ?? `PO-${now.slice(-6)}`),
      supplierId: String(input.supplierId ?? ""),
      date: mapDate(input.date) ?? now,
      expectedDate: mapDate(input.expectedDate) ?? null,
      total: mapNum(input.total),
      status: String(input.status ?? "DRAFT"),
      items: [],
      notes: String(input.notes ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    this.db.purchaseOrders.push(record);
    for (const item of input.items as { productId?: string }[] || []) {
      this.db.poItems.push({
        id: `poio-${record.id}-${Math.random().toString(36).slice(2, 8)}`,
        purchaseOrderId: record.id,
        productId: String(item.productId ?? ""),
        variantOptions: String(item.variantOptions ?? ""),
        quantity: mapNum(item.quantity),
        unitPrice: mapNum(item.unitPrice),
        discount: mapNum(item.discount),
        total: mapNum(item.total),
        createdAt: now,
        updatedAt: now,
      });
    }
    this.db.persist();
    return record;
  }

  receivePurchaseOrder(poId: string, lines: { itemId: string; quantity: number }[]): PurchaseOrder | undefined {
    const orders = this.purchaseOrders();
    const purchaseOrder = orders.find((p) => p.id === poId);
    if (!purchaseOrder) return undefined;
    purchaseOrder.status = "RECEIVED";
    purchaseOrder.updatedAt = new Date().toISOString();
    for (const line of lines) {
      this.db.poReceiptItems.push({
        id: `prio-${poId}-${line.itemId}-${new Date().toISOString().slice(8)}-${Math.random().toString(36).slice(2, 8)}`,
        purchaseOrderId: poId,
        itemId: line.itemId,
        quantity: Number(line.quantity),
        receivedAt: new Date().toISOString(),
        createdAt: purchaseOrder.updatedAt,
        updatedAt: purchaseOrder.updatedAt,
      });
    }
    this.db.persist();
    return purchaseOrder;
  }

  // ---- deliveries ----

  deliveries(): Delivery[] {
    return (this.db.deliveries ?? []) as Delivery[];
  }

  createDelivery(delivery: Partial<Record<string, unknown>>): Delivery {
    const now = new Date().toISOString();
    const record: Delivery = {
      id: `del-${now}-${Math.random().toString(36).slice(2, 8)}`,
      orderId: String(delivery.orderId ?? ""),
      fromLocation: String(delivery.fromLocation ?? ""),
      toLocation: String(delivery.toLocation ?? ""),
      date: mapDate(delivery.date) ?? now,
      total: mapNum(delivery.total),
      status: String(delivery.status ?? "PENDING"),
      driver: String(delivery.driver ?? ""),
      note: String(delivery.note ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    this.db.deliveries.push(record);
    this.db.persist();
    return record;
  }

  updateDelivery(id: string, patch: Partial<Record<string, unknown>>): Delivery | undefined {
    const deliveries = this.deliveries();
    const delivery = deliveries.find((d) => d.id === id);
    if (!delivery) return undefined;
    const updated: Delivery = { ...delivery, ...patch, updatedAt: new Date().toISOString() } as Delivery;
    const idx = deliveries.findIndex((d) => d.id === id);
    deliveries[idx] = updated;
    this.db.persist();
    return updated;
  }

  // ---- notifications ----

  notifications(): Notification[] {
    return (this.db.notifications ?? []) as Notification[];
  }

  createNotification(input: Partial<Record<string, unknown>>): Notification {
    const now = new Date().toISOString();
    const record: Notification = {
      id: `ntf-${now}-${Math.random().toString(36).slice(2, 8)}`,
      eventTypeId: String(input.eventTypeId ?? ""),
      title: String(input.title ?? ""),
      message: String(input.message ?? ""),
      priority: String(input.priority ?? "NORMAL"),
      entityType: String(input.entityType ?? ""),
      entityId: String(input.entityId ?? ""),
      actionUrl: mapDate(input.actionUrl) ?? null,
      deepLink: mapDate(input.deepLink) ?? null,
      createdBy: mapDate(input.createdBy) ?? null,
      createdAt: now,
      updatedAt: now,
      deliveryStatus: String(input.deliveryStatus ?? "PENDING"),
      failureReason: mapDate(input.failureReason) ?? null,
    };
    this.db.notifications.push(record);
    this.db.persist();
    return record;
  }

  notificationRecipients(): NotificationRecipient[] {
    return (this.db.notificationRecipients ?? []) as NotificationRecipient[];
  }

  createNotificationRecipient(recipient: Partial<Record<string, unknown>>): NotificationRecipient {
    const now = new Date().toISOString();
    const record: NotificationRecipient = {
      id: `nrt-${now}-${Math.random().toString(36).slice(2, 8)}`,
      notificationId: String(recipient.notificationId ?? ""),
      userId: String(recipient.userId ?? ""),
      deliveryChannel: String(recipient.deliveryChannel ?? "EMAIL"),
      deliveredAt: mapDate(recipient.deliveredAt) ?? null,
      readAt: mapDate(recipient.readAt) ?? null,
      failedAt: mapDate(recipient.failedAt) ?? null,
      failureReason: mapDate(recipient.failureReason) ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.notificationRecipients.push(record);
    this.db.persist();
    return record;
  }

  getUserNotifications(userId: string): Notification[] {
    return (this.db.notifications ?? [])
      .filter((n) => n.createdBy === userId || n.entityId === userId)
      .reverse() as Notification[];
  }

  getUnreadCount(userId: string): number {
    return (this.db.notifications ?? []).filter((n) => n.createdBy === userId && n.deliveryStatus !== "DELIVERED").length;
  }

  markAsRead(notificationId: string): Notification | undefined {
    const notifications = this.notifications();
    const notification = notifications.find((n) => n.id === notificationId);
    if (!notification) return undefined;
    notification.deliveryStatus = "DELIVERED";
    notification.updatedAt = new Date().toISOString();
    this.db.persist();
    return notification;
  }

  markAllAsRead(userId: string): number {
    let count = 0;
    const notifications = this.notifications();
    for (let i = 0; i < notifications.length; i += 1) {
      if (notifications[i].createdBy === userId && notifications[i].deliveryStatus !== "DELIVERED") {
        notifications[i].deliveryStatus = "DELIVERED";
        notifications[i].updatedAt = new Date().toISOString();
        count += 1;
      }
    }
    this.db.persist();
    return count;
  }

  getNotificationPreferences(): NotificationPreference[] {
    return (this.db.notificationPreferences ?? []) as NotificationPreference[];
  }

  getNotificationPreference(userId: string, eventType: string): NotificationPreference | undefined {
    return this.getNotificationPreferences().find((p) => p.userId === userId && p.eventTypeId === eventType);
  }

  updateNotificationPreference(userId: string, eventType: string, patch: Partial<Record<string, unknown>>): NotificationPreference | undefined {
    const preferences = this.getNotificationPreferences();
    const preference = preferences.find((p) => p.userId === userId && p.eventTypeId === eventType);
    if (!preference) return undefined;
    const updated: NotificationPreference = { ...preference, ...patch, updatedAt: new Date().toISOString() } as NotificationPreference;
    const idx = preferences.findIndex((p) => p.id === preference.id);
    preferences[idx] = updated;
    this.db.persist();
    return updated;
  }

  createNotificationPreference(preference: Partial<Record<string, unknown>>): NotificationPreference {
    const record: NotificationPreference = {
      id: `nup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: String(preference.userId ?? ""),
      eventTypeId: String(preference.eventTypeId ?? ""),
      channel: String(preference.channel ?? "EMAIL"),
      enabled: mapBool(preference.enabled),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.db.notificationPreferences.push(record);
    this.db.persist();
    return record;
  }

  // ---- audit logs ----

  createAuditLog(entry: Partial<Record<string, unknown>>): AuditLog {
    const now = new Date().toISOString();
    const record: AuditLog = {
      id: `aud-${now}-${Math.random().toString(36).slice(2, 8)}`,
      actorId: mapDate(entry.actorId) ?? null,
      action: String(entry.action ?? ""),
      targetType: String(entry.targetType ?? ""),
      targetId: String(entry.targetId ?? ""),
      details: JSON.stringify(entry.details ?? {}),
      ipAddress: String(entry.ipAddress ?? ""),
      userAgent: String(entry.userAgent ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    this.db.auditLogs.push(record);
    this.db.persist();
    return record;
  }

  // ---- users / roles / permissions ----

  users(): User[] {
    return (this.db.users ?? []) as User[];
  }

  findUser(id: string): User | undefined {
    return this.users().find((u) => u.id === id);
  }

  findUserByUsername(username: string): User | undefined {
    return this.users().find((u) => u.username === username);
  }

  createUser(input: Partial<Record<string, unknown>>): User {
    const now = new Date().toISOString();
    const user: User = {
      id: `usr-${now}-${Math.random().toString(36).slice(2, 8)}`,
      username: String(input.username ?? ""),
      passwordHash: String(input.passwordHash ?? ""),
      firstName: String(input.firstName ?? ""),
      lastName: String(input.lastName ?? ""),
      email: String(input.email ?? ""),
      phone: String(input.phone ?? ""),
      role: String(input.role ?? "Staff"),
      notify: mapBool(input.notify),
      active: mapBool(input.active),
      createdAt: now,
      updatedAt: now,
    };
    this.db.users.push(user);
    this.db.persist();
    return user;
  }

  userRoles(): UserRole[] {
    return (this.db.userRoles ?? []) as UserRole[];
  }

  userRolesForUser(userId: string): UserRole[] {
    return (this.db.userRoles ?? [])
      .filter((r) => r.userId === userId)
      .sort((a, b) => a.roleId.localeCompare(b.roleId)) as UserRole[];
  }

  rolePermissions(): RolePermission[] {
    return (this.db.rolePermissions ?? []) as RolePermission[];
  }

  rolePermissionsForRole(roleId: string): RolePermission[] {
    return (this.db.rolePermissions ?? [])
      .filter((p) => p.roleId === roleId)
      .sort((a, b) => a.permissionId.localeCompare(b.permissionId)) as RolePermission[];
  }

  roles(): Role[] {
    return (this.db.roles ?? []) as Role[];
  }

  permissions(): Permission[] {
    return (this.db.permissions ?? []) as Permission[];
  }

  // ---- stock reservations (legacy in-memory helpers retained for services) ----

  // ---- production ----

  createProductionWastage(wastage: Partial<Record<string, unknown>>): ProductionWastage {
    const now = new Date().toISOString();
    const record: ProductionWastage = {
      id: `wst-${now}-${Math.random().toString(36).slice(2, 8)}`,
      productionJobId: String(wastage.productionJobId ?? ""),
      productId: String(wastage.productId ?? ""),
      quantity: mapNum(wastage.quantity),
      unit: String(wastage.unit ?? ""),
      reason: String(wastage.reason ?? ""),
      note: String(wastage.note ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    this.db.productionWastage.push(record);
    this.db.persist();
    return record;
  }

  createProductionConsumption(consumption: Partial<Record<string, unknown>>): ProductionConsumption {
    const now = new Date().toISOString();
    const record: ProductionConsumption = {
      id: `con-${now}-${Math.random().toString(36).slice(2, 8)}`,
      productionJobId: String(consumption.productionJobId ?? ""),
      productId: String(consumption.productId ?? ""),
      quantity: mapNum(consumption.quantity),
      unit: String(consumption.unit ?? ""),
      note: String(consumption.note ?? ""),
      usedMaterial: String(consumption.usedMaterial ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    this.db.productionConsumption.push(record);
    this.db.persist();
    return record;
  }

  // ---- production job / quality / costs / feedback / expenses ----

  createProductionCost(cost: Partial<Record<string, unknown>>): ProductionCost {
    const now = new Date().toISOString();
    const record: ProductionCost = {
      id: `pcst-${now}-${Math.random().toString(36).slice(2, 8)}`,
      productionJobId: String(cost.productionJobId ?? ""),
      laborCost: mapNum(cost.laborCost),
      materialCost: mapNum(cost.materialCost),
      overheadCost: mapNum(cost.overheadCost),
      totalCost: mapNum(cost.totalCost),
      laborHours: mapNum(cost.laborHours),
      createdAt: now,
      updatedAt: now,
    };
    this.db.productionCosts.push(record);
    this.db.persist();
    return record;
  }

  createCustomerFeedback(feedback: Partial<Record<string, unknown>>): CustomerFeedback {
    const now = new Date().toISOString();
    const record: CustomerFeedback = {
      id: `fdb-${now}-${Math.random().toString(36).slice(2, 8)}`,
      customerId: String(feedback.customerId ?? ""),
      orderId: mapDate(feedback.orderId) ?? null,
      productIds: String(feedback.productIds ?? ""),
      rating: mapNum(feedback.rating),
      type: String(feedback.type ?? "General"),
      comment: String(feedback.comment ?? ""),
      resolution: mapDate(feedback.resolution) ?? null,
      followUpRequired: mapBool(feedback.followUpRequired),
      followUpCompleted: mapBool(feedback.followUpCompleted),
      recordedBy: String(feedback.recordedBy ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    this.db.customerFeedback.push(record);
    this.db.persist();
    return record;
  }

  createExpense(expense: Partial<Record<string, unknown>>): Expense {
    const now = new Date().toISOString();
    const record: Expense = {
      id: `exp-${now}-${Math.random().toString(36).slice(2, 8)}`,
      categoryId: String(expense.categoryId ?? ""),
      amount: mapNum(expense.amount),
      date: mapDate(expense.date) ?? now,
      paymentMethod: String(expense.paymentMethod ?? ""),
      reference: String(expense.reference ?? ""),
      description: String(expense.description ?? ""),
      attachment: mapDate(expense.attachment) ?? null,
      recordedBy: String(expense.recordedBy ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    this.db.expenses.push(record);
    this.db.persist();
    return record;
  }

  createNotificationTemplate(template: Partial<Record<string, unknown>>): NotificationTemplate {
    const now = new Date().toISOString();
    const record: NotificationTemplate = {
      id: `ntp-${now}-${Math.random().toString(36).slice(2, 8)}`,
      eventTypeId: String(template.eventTypeId ?? ""),
      channel: String(template.channel ?? "EMAIL"),
      titleTemplate: String(template.titleTemplate ?? ""),
      messageTemplate: String(template.messageTemplate ?? ""),
      active: mapBool(template.active),
      createdAt: now,
      updatedAt: now,
    };
    this.db.notificationTemplates.push(record);
    this.db.persist();
    return record;
  }

  // ---- purchase requirements ----

  purchaseRequirements(): PurchaseRequirement[] {
    return (this.db.purchaseRequirements ?? []) as PurchaseRequirement[];
  }

  updatePurchaseRequirement(id: string, patch: Partial<Record<string, unknown>>): PurchaseRequirement | undefined {
    const requirements = this.purchaseRequirements();
    const requirement = requirements.find((r) => r.id === id);
    if (!requirement) return undefined;
    const updated: PurchaseRequirement = { ...requirement, ...patch, updatedAt: new Date().toISOString() } as PurchaseRequirement;
    const idx = requirements.findIndex((r) => r.id === id);
    requirements[idx] = updated;
    this.db.persist();
    return updated;
  }

  // ---- persistence ----

  persist(): void {
    this.db.persist();
  }

  reset(): void {
    resetStore();
    this.db.persist();
  }
}

// ---------------------------------------------------------------------------
// Singleton / backwards compatibility
// ---------------------------------------------------------------------------

export const store = new Store();
