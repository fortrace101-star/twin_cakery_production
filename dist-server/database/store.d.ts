import { type DbCache } from "./index.new.js";
import type { AuditLog, BlogCategory, BlogPost, Customer, CustomerEvent, CustomerEventReminder, CustomerFeedback, CustomerInteraction, Delivery, Expense, GoodsReceipt, Inquiry, InventoryItem, InventoryTransaction, Notification, NotificationPreference, NotificationRecipient, NotificationTemplate, Order, OrderCustomerSnapshot, OrderProposal, OrderStatusHistory, Payment, PaymentStatus, Payslip, Permission, ProductionConsumption, ProductionCost, ProductionFixedCostCategory, ProductionFixedCostEntry, ProductionJob, ProductionWastage, PurchaseOrder, PurchaseRequirement, QualityCheck, Quotation, RemunerationItem, RemunerationPayment, RemunerationPeriod, Role, RolePermission, SalaryProfile, Staff, StaffAdvance, StaffAttendance, StockReservation, Supplier, User, UserRole, WebsiteUser } from "./types.js";
export type Patch = Record<string, unknown>;
export declare class MemoryStore {
    get db(): DbCache;
    /** Queue a write-back of the cache to Postgres; resolves when committed. */
    persist(): Promise<void>;
    reset(): void;
    customers(): Customer[];
    customer(customerId: string): Customer | undefined;
    findCustomer(idOrPhone: string): Customer | undefined;
    createCustomer(input: Patch): Customer;
    updateCustomer(customerId: string, input: Patch): Customer | undefined;
    deleteCustomer(customerId: string): boolean;
    customerInteractions(): CustomerInteraction[];
    interactionsByCustomer(customerId: string): CustomerInteraction[];
    createInteraction(input: Patch): CustomerInteraction;
    inquiries(): Inquiry[];
    findInquiry(inquiryId: string): Inquiry | undefined;
    createInquiry(input: Patch): Inquiry;
    updateInquiry(inquiryId: string, patch: Patch): Inquiry | undefined;
    orderProposals(): OrderProposal[];
    findOrderProposal(id: string): OrderProposal | undefined;
    createOrderProposal(input: Patch): OrderProposal;
    updateOrderProposal(id: string, patch: Patch): OrderProposal | undefined;
    quotations(): Quotation[];
    findQuotation(quotationId: string): Quotation | undefined;
    createQuotation(input: Patch): Quotation;
    updateQuotation(id: string, patch: Patch): Quotation | undefined;
    sendQuotation(id: string): Quotation | undefined;
    acceptQuotation(id: string): Quotation | undefined;
    orders(): Order[];
    findOrder(id: string): Order | undefined;
    orderWithItems(orderId: string): Order | undefined;
    createOrder(input: Patch): Order;
    updateOrder(orderId: string, patch: Patch): Order | undefined;
    orderStatusHistory(): OrderStatusHistory[];
    updateOrderStatus(orderId: string, newStatus: string, changedBy: string, reason: string): {
        order: Order;
        history: OrderStatusHistory;
    } | undefined;
    cancelOrder(order: Order, changedBy: string, reason: string): {
        order: Order;
        history: OrderStatusHistory;
    };
    payments(): Payment[];
    createPayment(input: Patch): Payment;
    paymentsReceived(orderId: string, amount: number, method: string, reference: string, receivedBy: string): Payment | undefined;
    /**
     * Recompute an order's payment status from the actual payment ledger
     * (spec Â§14: "Outstanding balance must be calculated server-side").
     * UNPAID â†’ PARTIALLY_PAID â†’ PAID â†’ OVERPAID derives from sum(payments)
     * vs order.total; REFUNDED is manual and never overwritten.
     */
    recomputePaymentStatus(orderId: string): PaymentStatus | undefined;
    productionJobs(): ProductionJob[];
    createProductionJob(input: Patch): ProductionJob;
    updateProductionJob(id: string, patch: Patch): ProductionJob | undefined;
    qualityChecks(): QualityCheck[];
    createQualityCheck(input: Patch): QualityCheck;
    productionWastage(): ProductionWastage[];
    createProductionWastage(input: Patch): ProductionWastage;
    productionConsumption(): ProductionConsumption[];
    createProductionConsumption(input: Patch): ProductionConsumption;
    productionCosts(): ProductionCost[];
    createProductionCost(input: Patch): ProductionCost;
    inventoryItems(): InventoryItem[];
    createInventoryItem(input: Patch): InventoryItem;
    inventoryTransactions(): InventoryTransaction[];
    adjustInventory(itemId: string, quantity: number, unit: string, type: string, reference: string, user: string, unitCost?: number, notes?: string): InventoryTransaction | undefined;
    stockReservations(): StockReservation[];
    suppliers(): Supplier[];
    suppliersIncludingInactive(): Supplier[];
    findSupplier(id: string): Supplier | undefined;
    updateSupplier(id: string, patch: Patch): Supplier | undefined;
    deleteSupplier(id: string): boolean;
    createSupplier(input: Patch): Supplier;
    purchaseOrders(): PurchaseOrder[];
    findPurchaseOrder(poId: string): PurchaseOrder | undefined;
    createPurchaseOrder(input: Patch): PurchaseOrder;
    receivePurchaseOrder(poId: string, receivedBy: string): {
        purchaseOrder: PurchaseOrder;
        receipt: GoodsReceipt;
    } | undefined;
    purchaseRequirements(): PurchaseRequirement[];
    goodsReceipts(): GoodsReceipt[];
    productionFixedCostCategories(): ProductionFixedCostCategory[];
    findProductionFixedCostCategory(id: string): ProductionFixedCostCategory | undefined;
    createProductionFixedCostCategory(input: Patch): ProductionFixedCostCategory;
    updateProductionFixedCostCategory(id: string, patch: Patch): ProductionFixedCostCategory | undefined;
    deleteProductionFixedCostCategory(id: string): boolean;
    productionFixedCostEntries(): ProductionFixedCostEntry[];
    createProductionFixedCostEntry(input: Patch): ProductionFixedCostEntry;
    productionFixedCostEntriesForJob(jobId: string): ProductionFixedCostEntry[];
    updateProductionFixedCostEntry(id: string, patch: Patch): ProductionFixedCostEntry | undefined;
    deleteProductionFixedCostEntry(id: string): boolean;
    createPurchaseRequirement(input: Patch): PurchaseRequirement;
    updatePurchaseRequirement(id: string, patch: Patch): PurchaseRequirement | undefined;
    deliveries(): Delivery[];
    findDelivery(id: string): Delivery | undefined;
    createDelivery(input: Patch): Delivery;
    updateDelivery(id: string, patch: Patch): Delivery | undefined;
    createExpense(input: Patch): Expense;
    createCustomerFeedback(input: Patch): CustomerFeedback;
    notifications(): Notification[];
    createNotification(input: Patch): Notification;
    notificationRecipients(): NotificationRecipient[];
    createNotificationRecipient(input: Patch): NotificationRecipient;
    createNotificationTemplate(input: Patch): NotificationTemplate;
    getUserNotifications(userId: string, limit?: number): Notification[];
    getUnreadCount(userId: string): number;
    markAsRead(id: string, userId: string): boolean;
    markAllAsRead(userId: string): number;
    getNotificationPreferences(userId: string): NotificationPreference[];
    getNotificationPreference(userId: string, eventType: string): NotificationPreference | undefined;
    createNotificationPreference(input: Patch): NotificationPreference;
    updateNotificationPreference(id: string, patch: Patch): NotificationPreference | undefined;
    auditLogs(): AuditLog[];
    createAuditLog(input: Patch): AuditLog;
    users(): User[];
    findUser(id: string): User | undefined;
    findUserByUsername(username: string): User | undefined;
    findUserByEmail(email: string): User | undefined;
    updateUser(id: string, input: Patch): User | undefined;
    createUser(input: Patch): User;
    userRoles(): UserRole[];
    userRolesForUser(userId: string): UserRole[];
    rolePermissions(): RolePermission[];
    rolePermissionsForRole(roleId: string): RolePermission[];
    roles(): Role[];
    permissions(): Permission[];
    /** Orders placed by a customer, most recent first. Backs GET /customers/:id/orders. */
    ordersForCustomer(customerId: string): Order[];
    /** The immutable contact snapshot captured when an order was placed. */
    orderCustomerSnapshot(orderId: string): OrderCustomerSnapshot | undefined;
    /**
     * Build (never return a reference into the cache) the immutable contact
     * snapshot for an order (rule 27). Uses the customer profile as it stands at
     * order time; returns null if there is no customer or a snapshot already
     * exists for the order (UNIQUE order_id). Caller pushes + persists.
     */
    private buildOrderSnapshot;
    /**
     * Create an immutable customer contact snapshot for an order
     * (rule 27). Skips if a snapshot already exists (UNIQUE order_id).
     * Caller pushes + persists. Returns the snapshot or null if skipped.
     */
    createOrderCustomerSnapshot(order: Order): OrderCustomerSnapshot | null;
    eventsByCustomer(customerId: string): CustomerEvent[];
    customerEvent(eventId: string): CustomerEvent | undefined;
    createCustomerEvent(input: Patch): CustomerEvent;
    updateCustomerEvent(eventId: string, input: Patch): CustomerEvent | undefined;
    deleteCustomerEvent(eventId: string): boolean;
    /**
     * Recurring-reminder scheduler (E1): keep exactly one live (PENDING/REMINDED)
     * reminder pointing at the event's next future occurrence. The system NEVER
     * auto-contacts the customer â€” staff act on a reminder and mark it Contacted.
     * Idempotent, safe to call on create/update.
     */
    private syncEventReminder;
    /** All reminders for a customer, soonest occurrence first. */
    remindersForCustomer(customerId: string): CustomerEventReminder[];
    customerEventReminder(reminderId: string): CustomerEventReminder | undefined;
    /**
     * Reminders still awaiting action, whose occurrence falls within the next
     * `days` days (default 30) â€” backs GET /customer-reminders and the printable
     * next-7/30-day list. CONTACTED/DISMISSED reminders are excluded. Sorted by
     * next fire time so the most urgent surfaces first.
     */
    dueReminders(days?: number): CustomerEventReminder[];
    /**
     * Staff act on a reminder: record the contact + outcome and roll the reminder
     * forward to the event's next future occurrence (annual â†’ next year, monthly â†’
     * next month). One-off events produce no further reminder. The system itself
     * never contacts the customer â€” this is the only path that advances a
     * reminder, and it always requires a human (`contactedBy`). Backs
     * PATCH /customer-reminders/:id/contacted.
     */
    markReminderContacted(reminderId: string, input: Patch): CustomerEventReminder | undefined;
    /** Dismiss a reminder (no further follow-up on this occurrence). */
    dismissReminder(reminderId: string): CustomerEventReminder | undefined;
    blogCategories(): BlogCategory[];
    blogCategory(id: string): BlogCategory | undefined;
    createBlogCategory(input: Patch): BlogCategory;
    updateBlogCategory(id: string, input: Patch): BlogCategory | undefined;
    deleteBlogCategory(id: string): boolean;
    /** All posts (any status), newest first. Backs the ERP management table. */
    blogPosts(): BlogPost[];
    /** Published posts only, newest published first. Backs GET /public/blog. */
    publishedBlogPosts(): BlogPost[];
    blogPost(id: string): BlogPost | undefined;
    blogPostBySlug(slug: string): BlogPost | undefined;
    createBlogPost(input: Patch): BlogPost;
    updateBlogPost(id: string, input: Patch): BlogPost | undefined;
    deleteBlogPost(id: string): boolean;
    websiteUsers(): WebsiteUser[];
    websiteUser(id: string): WebsiteUser | undefined;
    websiteUserByEmail(email: string): WebsiteUser | undefined;
    createWebsiteUser(input: Patch): WebsiteUser;
    updateWebsiteUser(id: string, input: Patch): WebsiteUser | undefined;
    deleteWebsiteUser(id: string): boolean;
    staffList(): Staff[];
    findStaff(id: string): Staff | undefined;
    createStaff(input: Patch): Staff;
    updateStaff(id: string, patch: Patch): Staff | undefined;
    /** No hard delete â€” salary history must stay reconstructable (Â§18.7). */
    archiveStaff(id: string): Staff | undefined;
    attendance(staffId?: string, fromDate?: string, toDate?: string): StaffAttendance[];
    recordAttendance(input: Patch): StaffAttendance;
    salaryProfileFor(staffId: string): SalaryProfile | undefined;
    /** One profile per staff: create on first save, update thereafter. */
    upsertSalaryProfile(staffId: string, input: Patch): SalaryProfile;
    remunerationPeriods(): RemunerationPeriod[];
    findPeriod(id: string): RemunerationPeriod | undefined;
    createPeriod(input: Patch): RemunerationPeriod;
    /** Throws when the period is CLOSED â€” the invariant every mutator shares. */
    private assertPeriodOpen;
    periodItems(periodId: string): RemunerationItem[];
    periodPayments(periodId: string): RemunerationPayment[];
    /** net = basic + allowances + bonuses âˆ’ deductions âˆ’ advance + other (Â§18.4). */
    private computeNet;
    private recomputePeriodTotals;
    /**
     * SELECT STAFF + CALCULATE (Â§18.4): materialise one item per selected staff
     * from their salary profile. Re-runnable while OPEN/PROCESSING â€” approved
     * lines are frozen. Advances are NEVER auto-deducted: the Admin opts in per
     * line so outstanding balances stay visible (Â§18.6).
     */
    calculatePeriod(periodId: string, staffIds: string[], _actor: string): RemunerationItem[];
    updatePeriodItem(itemId: string, patch: Patch): RemunerationItem | undefined;
    /** Additive correction line for APPROVED/CLOSED periods (Â§18.7 history). */
    addAdjustmentItem(periodId: string, input: Patch): RemunerationItem;
    /** REVIEW/ADJUST â†’ APPROVE: freeze every line (Â§18.4/Â§18.7). */
    approvePeriod(periodId: string, actor: string): RemunerationPeriod | undefined;
    recordPayment(input: Patch): RemunerationPayment;
    /** MARK PAID: credit the line, roll the period forward, never touch CLOSED. */
    markPaymentPaid(paymentId: string, actor: string): RemunerationPayment | undefined;
    /** CLOSE PERIOD: terminal. Totals + rows are frozen from here on (Â§18.7). */
    closePeriod(periodId: string, actor: string): RemunerationPeriod | undefined;
    staffAdvances(staffId?: string): StaffAdvance[];
    outstandingAdvances(staffId: string): number;
    createAdvance(input: Patch): StaffAdvance;
    /**
     * Recovery/repayment: appends to repaymentLog and bumps repaidAmount â€”
     * `amount` is NEVER reduced, so the original grant stays reconstructable
     * (Â§18.6 "must not be silently overwritten"). Settles at zero outstanding.
     */
    recordAdvanceRepayment(advanceId: string, input: Patch): StaffAdvance | undefined;
    /**
     * Issue payslips for every approved line of a period. Figures are COPIED at
     * issue time â€” later profile/line edits never rewrite an issued document.
     * Reissuing an already-issued staff line is a no-op (idempotent).
     */
    issuePayslips(periodId: string, actor: string): Payslip[];
    payslips(periodId?: string, staffId?: string): Payslip[];
    /**
     * Â§18.5 â€” the Admin's period dashboard: totals due/paid/pending, allowances,
     * deductions, outstanding advances, status and upcoming payment dates, with
     * drill-down ids. Everything derives from live rows, never cached figures.
     */
    remunerationDashboard(periodId?: string): Record<string, unknown>;
}
export declare const store: MemoryStore;
