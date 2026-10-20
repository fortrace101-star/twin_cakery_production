export type Status =
  | "DRAFT" | "SENT" | "NEGOTIATION" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED" | "CONVERTED"
  | "INQUIRY" | "QUOTATION" | "AWAITING_CONFIRMATION" | "CONFIRMED" | "PRODUCTION_REVIEW" | "READY_FOR_PRODUCTION"
  | "IN_PRODUCTION" | "QUALITY_CHECK" | "REWORK_REQUIRED" | "READY_FOR_DELIVERY" | "IN_TRANSIT"
  | "AWAITING_COLLECTION" | "COMPLETED_DELIVERED" | "CANCELLED" | "UNPAID" | "PARTIALLY_PAID" | "PROCESSING" | "PAID" | "REFUNDED" | "OVERPAID"
  | "PENDING" | "READY_FOR_DISPATCH" | "IN_TRANSIT" | "COMPLETED_DELIVERED" | "AWAITING_COLLECTION" | "PICKED_UP" | "FAILED"
  | "Low stock" | "In stock" | "Out of stock" | "Reorder required" | "Expiry risk" | "Unusual wastage" | "Significant price change"
  | "Active" | "Inactive" | "Archived" | "Pending" | "Open" | "Closed" | "Approved" | "Rejected" | "Sent" | "Received" | "Delivered" | "Failed";

export type Channel = "WhatsApp" | "Phone" | "Website" | "Walk-in" | "Internal" | "Email" | "SMS";
export type PaymentMethod = "Cash" | "M-Pesa" | "Card" | "Bank transfer" | "Cheque";
export type DeliveryType = "Home delivery" | "Pickup" | "Collection";
export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PROCESSING" | "PAID" | "REFUNDED" | "OVERPAID";
export type DeliveryStatus = "PENDING" | "READY_FOR_DISPATCH" | "IN_TRANSIT" | "COMPLETED_DELIVERED" | "AWAITING_COLLECTION" | "PICKED_UP" | "FAILED";
export type InquiryStatus = "NEW" | "ASSIGNED" | "IN_PROGRESS" | "QUOTATION_SENT" | "RESOLVED" | "ESCALATED" | "CLOSED";
export type QuotationStatus = "DRAFT" | "SENT" | "NEGOTIATION" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED" | "CONVERTED";
export type OrderStatus =
  | "INQUIRY" | "QUOTATION" | "AWAITING_CONFIRMATION" | "CONFIRMED" | "PRODUCTION_REVIEW" | "READY_FOR_PRODUCTION"
  | "IN_PRODUCTION" | "QUALITY_CHECK" | "REWORK_REQUIRED" | "READY_FOR_DELIVERY" | "IN_TRANSIT"
  | "AWAITING_COLLECTION" | "COMPLETED_DELIVERED" | "CANCELLED";
export type PaymentTransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
export type GoodsReceiptStatus = "PENDING" | "COMPLETED" | "PARTIALLY_RECEIVED" | "CANCELLED";
export type PurchaseOrderStatus = "DRAFT" | "SENT" | "ACCEPTED" | "PARTIALLY_RECEIVED" | "COMPLETED" | "CANCELLED";
export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type NotificationChannel = "IN_APP" | "WHATSAPP" | "EMAIL" | "SMS";
export type DeliveryType_ = "HOME_DELIVERY" | "PICKUP" | "COLLECTION";
export type RoleKey = "Admin / Proprietor" | "Production Manager" | "Sales Manager" | "Customer Service Representative";
export type UserRoleKey = "Admin / Proprietor" | "Production Manager" | "Sales Manager" | "Customer Service Representative";
export type AuditAction =
  | "order:status_changed" | "order:confirmed" | "order:cancelled" | "order:payment_received"
  | "quotation:created" | "quotation:accepted" | "quotation:sent"
  | "inquiry:created" | "inquiry:resolved"
  | "customer:updated" | "customer:interaction" | "customer:feedback"
  | "product:created" | "product:updated" | "product:archived"
  | "inventory:adjusted" | "inventory:reserved" | "inventory:consumed" | "inventory:received"
  | "purchase:created" | "purchase:approved" | "purchase:received"
  | "production:started" | "production:completed" | "production:quality_check" | "production:wastage"
  | "delivery:dispatched" | "delivery:completed"
  | "payment:created" | "expense:created" | "expense:updated"
  | "user:updated" | "role:updated" | "role:permission_changed"
  | "settings:updated" | "catalogue:created" | "catalogue:updated" | "catalogue:archived"
  | "notification:read" | "feedback:created" | "feedback:resolved"
  // E7 — Staff & Salary (§34: every salary-relevant mutation is auditable)
  | "staff:created" | "staff:updated" | "staff:archived"
  | "remuneration:profile_updated" | "remuneration:period_created" | "remuneration:calculated"
  | "remuneration:approved" | "remuneration:closed" | "remuneration:adjustment_added"
  | "remuneration:payment_recorded" | "remuneration:payment_paid" | "remuneration:payslips_issued"
  | "remuneration:advance_created" | "remuneration:advance_repaid";

export type Currency = "UGX" | "USD" | "TZS";

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer extends BaseEntity {
  name: string;
  phone: string;
  email: string;
  addresses: CustomerAddress[];
  preferredContactMethod: "email" | "phone" | "whatsapp";
  source: string;
  notes: string;
  status: "Active" | "Inactive" | "Blocked";
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  totalOrders: number;
  totalSpend: number;
  feedbackSummary: CustomerFeedback[];
}

export interface CustomerAddress extends BaseEntity {
  customerId: string;
  label: "Home" | "Work" | "Delivery" | "Other";
  line1: string;
  line2: string;
  city: string;
  county: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface CustomerInteraction extends BaseEntity {
  customerId: string;
  channel: Channel;
  staffMember: string;
  dateTime: string;
  subject: string;
  summary: string;
  outcome: string;
  followUpRequired: boolean;
  relatedInquiryId: string | null;
  relatedOrderId: string | null;
}

export interface CustomerMeta extends BaseEntity {
  customerId: string;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  totalOrders: number;
  totalSpend: number;
  feedbackSummary: string;
}

export interface Inquiry extends BaseEntity {
  customerId: string;
  channel: Channel;
  staffMember: string | null;
  subject: string;
  summary: string;
  details: string;
  status: InquiryStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  relatedQuoteId: string | null;
  relatedOrderId: string | null;
  followUpRequired: boolean;
  nextAction: string | null;
  resolvedAt: string | null;
  source: "WHATSAPP" | "PHONE" | "WEBSITE" | "WALK_IN" | "ORDER_FORM";
}

export interface QuotationItem extends BaseEntity {
  quotationId: string;
  productId: string;
  variantOptions: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface Quotation extends BaseEntity {
  quotationNumber: string;
  customerId: string;
  salespersonId: string | null;
  items: QuotationItem[];
  notes: string;
  validityExpiry: string | null;
  status: QuotationStatus;
  taxAmount: number;
  total: number;
  unitTotal: number;
  submittedAt: string | null;
  acceptedAt: string | null;
  createdBy: string;
}

export interface OrderItem extends BaseEntity {
  orderId: string;
  productId: string;
  variantOptions: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  recipeVersion: string | null;
  unit?: string;
}

export interface OrderStatusHistory extends BaseEntity {
  orderId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  changedBy: string;
  reason: string;
  timestamp: string;
}

export interface Order extends BaseEntity {
  orderNumber: string;
  customerId: string;
  salespersonId: string | null;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  taxAmount: number;
  total: number;
  requiredBy: string | null;
  requiredAt: string | null;
  notes: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
  quotationId: string | null;
  inquiryId: string | null;
  createdBy: string;
  deliveredAt: string | null;
  /** Stamped when the post-delivery CRM follow-up has been done & documented. */
  followUpCompletedAt: string | null;
}

export type OrderProposalStatus = "PENDING_REVIEW" | "CONFIRMED" | "CANCELLED";

export interface OrderProposalItem extends BaseEntity {
  proposalId: string;
  productId: string;
  productName: string;
  variantOptions: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/**
 * Website order-form submission (E6, §§29–30). One row per public form POST.
 * Contact fields are stored raw (name/phone/email) — the canonical customers
 * row is only linked via the OPTIONAL customerId once staff match/create it,
 * so public submissions can never violate the customers FK. Confirming a
 * proposal creates the linked inquiry (+ order draft); the proposal itself is
 * never mutated into an order.
 */
export interface OrderProposal extends BaseEntity {
  proposalNumber: string;
  customerName: string;
  phone: string;
  email: string;
  productSummary: string;
  quantity: number;
  preferredDate: string | null;
  preferredTime: string;
  deliveryType: string;
  deliveryLocation: string;
  customerNotes: string;
  referenceImage: string;
  status: OrderProposalStatus;
  items: OrderProposalItem[];
  customerId: string | null;
  inquiryId: string | null;
  orderId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string;
}

export interface ProductionJob extends BaseEntity {
  orderId: string;
  customerId: string;
  productId: string;
  variantOptions: string;
  quantity: number;
  recipeVersion: string;
  requiredBy: string | null;
  requiredAt: string | null;
  status: "PENDING" | "SCHEDULED" | "READY_FOR_PRODUCTION" | "IN_PRODUCTION" | "READY_FOR_QUALITY" | "QUALITY_CHECK" | "READY_FOR_DELIVERY" | "REWORK_REQUIRED" | "COMPLETED" | "CANCELLED";
  stage: "PLAN" | "REVIEW" | "CHECK_RECIPE" | "CHECK_INVENTORY" | "RESERVE" | "SHORTAGE" | "PURCHASE" | "PRODUCE" | "QUALITY" | "DELIVER" | "DONE";
  progress: number;
  notes: string;
}

export interface ProductionStep extends BaseEntity {
  jobId: string;
  name: string;
  order: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  startedAt: string | null;
  completedAt: string | null;
}

export interface ProductionConsumption extends BaseEntity {
  jobId: string;
  itemId: string;
  quantity: number;
  unit: string;
  recipeVersion: string;
  unitCost: number;
  actualCost: number;
  notes: string;
}

export interface ProductionCost extends BaseEntity {
  jobId: string;
  ingredientCost: number;
  packagingCost: number;
  labourCost: number;
  overheadCost: number;
  total: number;
  status: "PLANNED" | "ACTUAL";
}

export interface ProductionWastage extends BaseEntity {
  jobId: string;
  itemId: string;
  quantity: number;
  unit: string;
  reason: string;
  cost: number;
  recordedBy: string;
}

export interface QualityCheck extends BaseEntity {
  jobId: string;
  result: "PASS" | "FAIL";
  checkedBy: string;
  checkedAt: string;
  issues: string;
  notes: string;
  reworkRequired: boolean;
  reworkCost: number;
  wastageCaused: number;
}

export interface InventoryItem extends BaseEntity {
  name: string;
  sku: string;
  category: string;
  physicalStock: number;
  unit: string;
  reorderLevel: number;
  supplierId: string;
  cost: number;
  lastUpdated: string;
}

export interface InventoryTransaction extends BaseEntity {
  itemId: string;
  quantity: number;
  unit: string;
  type: "OPENING_BALANCE" | "PURCHASE_RECEIPT" | "PRODUCTION_CONSUMPTION" | "WASTAGE" | "DAMAGE" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "TRANSFER_IN" | "TRANSFER_OUT" | "RETURN";
  reference: string;
  user: string;
  timestamp: string;
  unitCost: number | null;
  notes: string;
}

export interface StockLocation extends BaseEntity {
  name: string;
  location: string;
  unit: string;
  reorderLevel: number;
}

export interface StockReservation extends BaseEntity {
  itemId: string;
  quantity: number;
  unit: string;
  orderId: string | null;
  reference: string | null;
  reservedAt: string;
}

export interface Supplier extends BaseEntity {
  businessName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  productsSupplied: string;
  paymentTerms: string;
  notes: string;
  active: boolean;
}

export interface PurchaseRequirement extends BaseEntity {
  productIds: string;
  quantity: number;
  unit: string;
  reason: string;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "ACKNOWLEDGED" | "ORDERED" | "RECEIVED" | "RESOLVED";
  requestedBy: string;
  requestedAt: string;
}

export interface PurchaseOrderItem extends BaseEntity {
  purchaseOrderId: string;
  productId: string;
  supplierId: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  receivedQuantity: number;
}

export interface PurchaseOrder extends BaseEntity {
  poNumber: string;
  supplierId: string;
  date: string;
  expectedDate: string;
  items: PurchaseOrderItem[];
  total: number;
  status: PurchaseOrderStatus;
  notes: string;
}

export interface GoodsReceiptItem extends BaseEntity {
  goodsReceiptId: string;
  poItemId: string;
  quantity: number;
  unit: string;
  unitCost: number;
  status: "PENDING" | "COMPLETED";
}

export interface GoodsReceipt extends BaseEntity {
  purchaseOrderId: string;
  receivedBy: string;
  date: string;
  items: GoodsReceiptItem[];
  total: number;
  status: GoodsReceiptStatus;
}

export interface SupplierPriceHistory extends BaseEntity {
  supplierId: string;
  productId: string;
  unit: string;
  price: number;
  effectiveDate: string;
  note: string;
}

export interface Payment extends BaseEntity {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  reference: string;
  receivedBy: string;
  notes: string;
}

export interface ExpenseCategory extends BaseEntity {
  name: string;
}

export interface Expense extends BaseEntity {
  categoryId: string;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  reference: string;
  description: string;
  attachment: string | null;
  recordedBy: string;
}

export interface Delivery extends BaseEntity {
  orderId: string;
  type: DeliveryType_;
  destination: string;
  scheduledAt: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  actualDispatchTime: string | null;
  actualDeliveryDate: string | null;
  deliveryPerson: string | null;
  deliveryFee: number;
  status: DeliveryStatus;
  notes: string;
  customerConfirmation: string | null;
}

export interface CustomerFeedback extends BaseEntity {
  customerId: string;
  orderId: string | null;
  productIds: string;
  rating: number;
  type: "RATING" | "COMPLAINT" | "COMPLIMENT" | "PRODUCT_FEEDBACK" | "DELIVERY_FEEDBACK" | "SERVICE_FEEDBACK" | "GENERAL";
  comment: string;
  resolution: string | null;
  followUpRequired: boolean;
  followUpCompleted: boolean;
  recordedBy: string;
}

/* ---------- E1: Customer order history, occasions & recurring reminders ---------- */

/** Recurrence rule for a customer occasion/event (birthdays, anniversaries, …). */
export type EventRecurrence = "NONE" | "ANNUAL" | "MONTHLY" | "YEARLY";
/** Lifecycle of a customer occasion/event. */
export type CustomerEventStatus = "ACTIVE" | "ARCHIVED";
/** Lifecycle of an internal reminder for a future event occurrence. */
export type CustomerEventReminderStatus = "PENDING" | "REMINDED" | "CONTACTED" | "DISMISSED";

/**
 * Immutable snapshot of the customer's contact details captured at order time.
 * Rule 27: never rewritten after the customer profile changes — orders keep the
 * canonical customers.id FK, this only preserves what the contact looked like
 * when the order was placed. Exactly one snapshot per order (UNIQUE order_id).
 */
export interface OrderCustomerSnapshot extends BaseEntity {
  orderId: string;
  customerId: string;
  snapshotName: string;
  snapshotPhone: string;
  snapshotEmail: string;
  snapshotAddress: string;
  snapshotPreferredContact: string;
  capturedBy: string;
}

/**
 * A customer occasion (birthday, wedding anniversary, graduation, …) optionally
 * tied to the order that originated it. Backs GET|POST /customers/:id/events.
 */
export interface CustomerEvent extends BaseEntity {
  customerId: string;
  orderId: string | null;
  eventType: string;
  eventDate: string;
  recurrenceRule: EventRecurrence;
  notes: string;
  status: CustomerEventStatus;
  createdBy: string;
}

/**
 * Internal reminder for a future occurrence of a {@link CustomerEvent}. The
 * system must NEVER auto-contact the customer — staff mark the reminder
 * Reminded/Contacted and record the outcome. Backs GET /customer-reminders
 * and PATCH /customer-reminders/:id/contacted.
 */
export interface CustomerEventReminder extends BaseEntity {
  eventId: string;
  customerId: string;
  orderId: string | null;
  eventType: string;
  reminderForDate: string;
  nextReminderAt: string;
  status: CustomerEventReminderStatus;
  lastContactedAt: string | null;
  contactedBy: string;
  outcome: string;
  followUpNotes: string;
}

export interface Notification extends BaseEntity {
  eventTypeId: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  entityType: string;
  entityId: string;
  actionUrl: string | null;
  deepLink: string | null;
  createdAt: string;
  createdBy: string | null;
  readAt: string | null;
  deliveryStatus: "PENDING" | "DELIVERED" | "FAILED" | "SKIPPED";
  failureReason: string | null;
}

export interface NotificationRecipient extends BaseEntity {
  notificationId: string;
  userId: string;
  deliveryChannel: NotificationChannel;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
}

export interface NotificationPreference extends BaseEntity {
  userId: string;
  eventTypeId: string;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface NotificationTemplate extends BaseEntity {
  eventTypeId: string;
  channel: NotificationChannel;
  titleTemplate: string;
  messageTemplate: string;
  active: boolean;
}

export interface AuditLog extends BaseEntity {
  orderId: string;
  actor: string;
  action: AuditAction;
  /** Non-order entities (staff, remuneration periods…) — E7 + §34 coverage. */
  entityType: string;
  entityId: string;
  previousStatus: string;
  newStatus: string;
  reason: string;
  timestamp: string;
}

export interface Role extends BaseEntity {
  name: string;
  label: string;
  active: boolean;
  grantedAt: string;
}

export interface Permission extends BaseEntity {
  key: string;
}

export interface User extends BaseEntity {
  username: string;
  displayName: string;
  email: string;
  phone: string;
  role: UserRoleKey;
  isAdmin: boolean;
  status: "Active" | "Inactive" | "Suspended";
  passwordHash: string;
  notify: Record<string, Record<NotificationChannel, boolean>>;
}

export interface UserRole extends BaseEntity {
  userId: string;
  roleId: string;
}

export interface RolePermission extends BaseEntity {
  roleId: string;
  permissionId: string;
}

export interface Catalogue {
  categories: { id: string; name: string; code: string; description: string; image: string; displayOrder: number; active: boolean; catalogueVisible: boolean; createdAt: string; updatedAt: string }[];
  types: { id: string; categoryId: string; name: string; code: string; description: string; displayOrder: number; active: boolean; catalogueVisible: boolean; createdAt: string; updatedAt: string }[];
  products: { id: string; sku: string; categoryId: string; productId: string; name: string; description: string; basePrice: number; costReference: string; catalogueVisible: boolean; productionEnabled: boolean; image: string; active: boolean; archived: boolean; notes: string; createdAt: string; updatedAt: string }[];
  variants: { id: string; productId: string; name: string; type: string; defaultValue: string }[];
  optionDefinitions: { id: string; entityType: "product" | "variant"; entityId: string; name: string; isMandatory: boolean; displayOrder: number }[];
  optionValues: { id: string; optionDefId: string; label: string }[];
}

// ---- E2: website content (blog + website users) ----

export type BlogPostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPost {
  id: string;
  categoryId: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImage: string;
  author: string;
  status: BlogPostStatus;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type WebsiteUserRole = "CUSTOMER" | "SITE_ADMIN";
export type WebsiteUserStatus = "ACTIVE" | "SUSPENDED";

export interface WebsiteUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: WebsiteUserRole;
  status: WebsiteUserStatus;
  customerId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IngredientDefault {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  defaultUnitCost: number;
  minStock: number;
}

export interface Recipe {
  id: string;
  productId: string;
  name: string;
  isActive: boolean;
  versions: RecipeVersion[];
}

export interface RecipeVersion {
  id: string;
  version: string;
  notes: string;
  effectiveDate: string;
  items: RecipeItem[];
  totalEstimatedCost: number;
  wastagePercent: number;
}

export interface RecipeItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  expectedWaste: number;
  notes: string;
  order: number;
}

export interface InventorySnapshot {
  itemId: string;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  timestamp: string;
}

export interface ProductionJobSummary {
  jobId: string;
  orderId: string;
  customerId: string;
  productId: string;
  variantOptions: string;
  quantity: number;
  recipeVersion: string;
  requiredBy: string | null;
  requiredAt: string | null;
  status: string;
  stage: string;
  progress: number;
  shortageItems: string;
  purchaseRequirements: string;
  estimatedCost: number;
  actualCost: number;
}

// ---------------------------------------------------------------------------
// E7 — Staff management & salary/remuneration (governing doc §§18.1–18.8).
// Salary figures are CONFIDENTIAL: every route exposing them sits behind a
// remuneration.* permission (§18.2 Admin/Proprietor-only by default).
// ---------------------------------------------------------------------------

export type EmploymentStatus = "ACTIVE" | "PROBATION" | "ON_LEAVE" | "INACTIVE" | "TERMINATED";

export interface Staff extends BaseEntity {
  staffNumber: string;
  name: string;
  phone: string;
  email: string;
  jobTitle: string;
  employmentStatus: EmploymentStatus;
  startDate: string | null;
  /** Work pattern / schedule, free text (§18.1). */
  schedule: string;
  notes: string;
  /** Optional link to an ERP login — most staff never get one. */
  userId: string | null;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "SICK" | "LATE";

export interface StaffAttendance extends BaseEntity {
  staffId: string;
  /** ISO date (YYYY-MM-DD) — one row per staff per day. */
  date: string;
  status: AttendanceStatus;
  hours: number;
  notes: string;
  recordedBy: string;
}

export type PaymentFrequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "custom";

/** Confidential recurring baseline behind "calculate salary" (§18.2). */
export interface SalaryProfile extends BaseEntity {
  staffId: string;
  basicSalary: number;
  /** Advisory only — each concrete period is admin-defined (§18.3). */
  paymentFrequency: PaymentFrequency;
  allowanceAmount: number;
  deductionAmount: number;
  effectiveFrom: string | null;
  notes: string;
}

export type PeriodType = "weekly" | "biweekly" | "monthly" | "quarterly" | "custom";

/** §18.7 workflow statuses. CLOSED is terminal — never silently rewritten. */
export type RemunerationPeriodStatus =
  | "OPEN"
  | "PROCESSING"
  | "APPROVED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CLOSED";

export interface RemunerationPeriod extends BaseEntity {
  label: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  intendedPaymentDate: string | null;
  status: RemunerationPeriodStatus;
  totalAmount: number;
  paidAmount: number;
  notes: string;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  closedAt: string | null;
}

export type RemunerationItemStatus = "PENDING" | "APPROVED" | "PAID" | "PARTIALLY_PAID" | "ADJUSTED";

/** One selected staff line in a period — the §18.4 calculation breakdown. */
export interface RemunerationItem extends BaseEntity {
  periodId: string;
  staffId: string;
  basicSalary: number;
  allowances: number;
  bonuses: number;
  deductions: number;
  advanceAmount: number;
  otherPayments: number;
  netAmount: number;
  paidAmount: number;
  status: RemunerationItemStatus;
  notes: string;
}

export type AdvanceStatus = "OUTSTANDING" | "SETTLED";

/** Append-only repayment entry — the original `amount` never changes (§18.6). */
export interface AdvanceRepayment {
  date: string;
  amount: number;
  method?: string;
  reference?: string;
  recordedBy?: string;
}

export interface StaffAdvance extends BaseEntity {
  staffId: string;
  /** Immutable original grant — recoveries append to repaymentLog instead. */
  amount: number;
  repaidAmount: number;
  reason: string;
  advanceDate: string | null;
  status: AdvanceStatus;
  repaymentLog: AdvanceRepayment[];
  recordedBy: string;
}

export type RemunerationPaymentMethod = "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER" | "OTHER";

export type RemunerationPaymentStatus = "RECORDED" | "PENDING" | "PAID" | "CANCELLED";

/** §18.7 payment record — staff, period, amount, date, method, reference. */
export interface RemunerationPayment extends BaseEntity {
  periodId: string;
  staffId: string;
  itemId: string | null;
  amount: number;
  paymentDate: string;
  method: RemunerationPaymentMethod;
  reference: string;
  paymentStatus: RemunerationPaymentStatus;
  notes: string;
  recordedBy: string;
}

/**
 * §18.8 printable snapshot — figures frozen at generation so a later salary
 * profile change can never rewrite an issued payslip.
 */
export interface Payslip extends BaseEntity {
  periodId: string;
  staffId: string;
  itemId: string | null;
  periodLabel: string;
  staffName: string;
  basicSalary: number;
  allowances: number;
  bonuses: number;
  deductions: number;
  advanceAmount: number;
  otherPayments: number;
  netAmount: number;
  paidAmount: number;
  issuedAt: string | null;
  issuedBy: string;
}

export interface InventorySummary {
  itemId: string;
  name: string;
  sku: string;
  category: string;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  reorderLevel: number;
  unit: string;
  supplierId: string;
  lowStock: boolean;
  outOfStock: boolean;
}

export interface FinanceReport {
  period: "day" | "week" | "month" | "year";
  revenue: number;
  paymentsReceived: number;
  outstandingPayments: number;
  directCosts: number;
  expenses: number;
  grossProfit: number;
  netOperatingResult: number;
  cashMovement: number;
}

export interface Metrics {
  todayOrders: number;
  ordersInProduction: number;
  ordersDueToday: number;
  pendingInquiries: number;
  pendingQuotations: number;
  outstandingPayments: number;
  lowStockItems: number;
  todayRevenue: number;
  monthlyRevenue: number;
  directCosts: number;
  grossProfit: number;
  expenses: number;
  deliveryStatus: string;
  recentFeedback: string;
}

export interface RolePermissions {
  roleId: string;
  roleName: string;
  permissions: string[];
}

export interface RBACSummary {
  users: { userId: string; displayName: string; email: string; role: string; active: boolean }[];
  roles: { roleId: string; name: string; label: string; active: boolean }[];
  permissions: { permissionId: string; key: string }[];
  userRoles: { userId: string; roleId: string }[];
  rolePermissions: { roleId: string; permissionId: string }[];
}

export interface DashboardData {
  metrics: Metrics;
  revenueTrend: number[];
  orderStatusBreakdown: Record<string, number>;
  productionSummary: ProductionJobSummary[];
  inventorySummary: InventorySummary[];
  financeReport: FinanceReport;
}
