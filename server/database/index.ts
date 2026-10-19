import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
// import type { CustomerMeta } from "./types.js";
import { v4 as uuidv4 } from "uuid";
import type {
  Customer,
  CustomerAddress,
  CustomerInteraction,
  CustomerMeta,
  Inquiry,
  Quotation,
  QuotationItem,
  Order,
  OrderItem,
  OrderStatusHistory,
  ProductionJob,
  ProductionStep,
  ProductionConsumption,
  ProductionCost,
  ProductionWastage,
  QualityCheck,
  InventoryItem,
  InventoryTransaction,
  StockLocation,
  StockReservation,
  Supplier,
  PurchaseRequirement,
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
  SupplierPriceHistory,
  Payment,
  Expense,
  ExpenseCategory,
  Delivery,
  CustomerFeedback,
  Notification,
  NotificationRecipient,
  NotificationPreference,
  NotificationTemplate,
  AuditLog,
  Role,
  Permission,
  User,
  UserRole,
  RolePermission,
} from "./types.js";

const DATA_DIR = path.resolve(process.cwd(), "server", "data");
const DATA_FILE = path.resolve(DATA_DIR, "store.json");

const DEFAULT_STORE = {
  customers: [] as Customer[],
  customerAddresses: [] as CustomerAddress[],
  customerInteractions: [] as CustomerInteraction[],
  customersMeta: [] as CustomerMeta[],
  inquiries: [] as Inquiry[],
  quotations: [] as Quotation[],
  quotationItems: [] as QuotationItem[],
  orders: [] as Order[],
  orderItems: [] as OrderItem[],
  orderStatusHistory: [] as OrderStatusHistory[],
  productionJobs: [] as ProductionJob[],
  productionSteps: [] as ProductionStep[],
  productionConsumption: [] as ProductionConsumption[],
  productionCosts: [] as ProductionCost[],
  productionWastage: [] as ProductionWastage[],
  qualityChecks: [] as QualityCheck[],
  inventoryItems: [] as InventoryItem[],
  inventoryTransactions: [] as InventoryTransaction[],
  stockLocations: [] as StockLocation[],
  stockReservations: [] as StockReservation[],
  suppliers: [] as Supplier[],
  purchaseRequirements: [] as PurchaseRequirement[],
  purchaseOrders: [] as PurchaseOrder[],
  purchaseOrderItems: [] as PurchaseOrderItem[],
  goodsReceipts: [] as GoodsReceipt[],
  goodsReceiptItems: [] as GoodsReceiptItem[],
  supplierPriceHistory: [] as SupplierPriceHistory[],
  payments: [] as Payment[],
  expenses: [] as Expense[],
  expenseCategories: [] as ExpenseCategory[],
  deliveries: [] as Delivery[],
  customerFeedback: [] as CustomerFeedback[],
  notifications: [] as Notification[],
  notificationRecipients: [] as NotificationRecipient[],
  notificationPreferences: [] as NotificationPreference[],
  notificationTemplates: [] as NotificationTemplate[],
  auditLogs: [] as AuditLog[],

  roles: [] as Role[],
  permissions: [] as Permission[],
  users: [] as User[],
  userRoles: [] as UserRole[],
  rolePermissions: [] as RolePermission[],
  catalogue: {} as Record<string, unknown>,
  costs: { ingredientDefaults: [] as ProductionCost[] },
  sequence: {
    customerId: 1,
    addressId: 1,
    interactionId: 1,
    customerMetaId: 1,
    inquiryId: 1,
    quotationId: 1,
    quotationItemId: 1,
    orderId: 1,
    orderItemId: 1,
    orderStatusHistoryId: 1,
    productionJobId: 1,
    productionStepId: 1,
    productionConsumptionId: 1,
    productionCostId: 1,
    productionWastageId: 1,
    qualityCheckId: 1,
    inventoryItemId: 1,
    inventoryTransactionId: 1,
    stockLocationId: 1,
    stockReservationId: 1,
    supplierId: 1,
    purchaseRequirementId: 1,
    purchaseOrderId: 1,
    purchaseOrderItemId: 1,
    goodsReceiptId: 1,
    goodsReceiptItemId: 1,
    supplierPriceHistoryId: 1,
    paymentId: 1,
    expenseId: 1,
    expenseCategoryId: 1,
    deliveryId: 1,
    customerFeedbackId: 1,
    notificationId: 1,
    notificationRecipientId: 1,
    notificationPreferenceId: 1,
    notificationTemplateId: 1,
    auditLogId: 1,
    roleId: 1,
    permissionId: 1,
    userId: 1,
    userRoleId: 1,
    rolePermissionId: 1,
  },
};

let store: Record<string, unknown> = loadOrCreate();

function loadOrCreate(): Record<string, unknown> {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STORE, ...parsed };
    }
  } catch (err) {
    console.warn("[database] Could not read store, starting fresh:", err);
  }
  return { ...DEFAULT_STORE };
}

function save(): void {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("[database] Failed to persist store:", err);
  }
}

function seed(): void {
  const now = new Date().toISOString();
  const ids: string[] = [];
  const next = (): string => {
    const id = uuidv4();
    ids.push(id);
    return id;
  };

  const co = (name: string, phone: string, email: string): Customer => ({
    id: next(),
    name,
    phone,
    email,
    addresses: [] as CustomerAddress[],
    preferredContactMethod: "email",
    source: "In-house",
    notes: "",
    status: "Active",
    firstOrderDate: null,
    lastOrderDate: null,
    totalOrders: 0,
    totalSpend: 0,
    feedbackSummary: [] as CustomerFeedback[],
    createdAt: now,
    updatedAt: now,
  });

  const u = (name: string, role: string, email: string, phone: string, isAdmin: boolean) => ({
    id: next(),
    username: name.toLowerCase().replace(/\s+/g, "_"),
    displayName: name,
    email,
    phone,
    role: role as User["role"],
    isAdmin,
    status: "Active",
    passwordHash: "$2b$10$placeholder",
    notify: {
      OrderConfirmed: { IN_APP: true, EMAIL: true, WHATSAPP: false, SMS: false },
      OrderCompleted: { IN_APP: true, EMAIL: true, WHATSAPP: false, SMS: false },
      PaymentReceived: { IN_APP: true, EMAIL: true, WHATSAPP: false, SMS: false },
      CustomerComplaint: { IN_APP: true, EMAIL: true, WHATSAPP: true, SMS: false },
      FeedbackRecorded: { IN_APP: true, EMAIL: true, WHATSAPP: false, SMS: false },
      StockShortageDetected: { IN_APP: true, EMAIL: true, WHATSAPP: false, SMS: false },
      ProductionCompleted: { IN_APP: true, EMAIL: true, WHATSAPP: false, SMS: false },
      DeliveryDue: { IN_APP: true, EMAIL: true, WHATSAPP: false, SMS: false },
    },
    createdAt: now,
    updatedAt: now,
  });

  store.users = [
    u(
      "Manager",
      "Admin / Proprietor",
      "manager@twincakery.com",
      "0700 000 001",
      true
    ),
    u(
      "Alex",
      "Production Manager",
      "alex@twincakery.com",
      "0700 000 002",
      true
    ),
    u(
      "Jordan",
      "Sales Manager",
      "jordan@twincakery.com",
      "0700 000 003",
      false
    ),
    u(
      "Priya",
      "Customer Service Representative",
      "priya@twincakery.com",
      "0700 000 004",
      false
    ),
  ];

  store.customers = [
    co("Sarah Mwangi", "07XX XXX XXX", "sarah@example.com"),
    co("David Ochieng", "07YY YYY YYY", "david@example.com"),
    co("Grace Wanjiku", "07ZZ ZZZ ZZZ", "grace@example.com"),
    co("James Kamau", "07AA AAA AAA", "james@example.com"),
    co("Faith Akinyi", "07BB BBB BBB", "faith@example.com"),
    co("Peter Njoroge", "07CC CCC CCC", "peter@example.com"),
    co("Twin Cakery Wholesale", "07DD DDD DDD", "wholesale@example.com"),
  ];

  store.roles = [
    { id: next(), name: "Admin / Proprietor", label: "Full business control", active: true, grantedAt: now },
    { id: next(), name: "Production Manager", label: "Operational fulfillment", active: true, grantedAt: now },
    { id: next(), name: "Sales Manager", label: "Sales growth & commercial analytics", active: true, grantedAt: now },
    { id: next(), name: "Customer Service Representative", label: "Inbound support", active: true, grantedAt: now },
  ];

  store.permissions = [
    { id: next(), key: "orders.view" },
    { id: next(), key: "orders.create" },
    { id: next(), key: "orders.confirm" },
    { id: next(), key: "orders.cancel" },
    { id: next(), key: "customers.view" },
    { id: next(), key: "customers.create" },
    { id: next(), key: "customers.edit" },
    { id: next(), key: "customers.interact" },
    { id: next(), key: "products.view" },
    { id: next(), key: "products.create" },
    { id: next(), key: "products.edit" },
    { id: next(), key: "products.archive" },
    { id: next(), key: "production.view" },
    { id: next(), key: "production.schedule" },
    { id: next(), key: "production.start" },
    { id: next(), key: "production.complete" },
    { id: next(), key: "production.quality_check" },
    { id: next(), key: "production.record_wastage" },
    { id: next(), key: "production.record_consumption" },
    { id: next(), key: "inventory.view" },
    { id: next(), key: "inventory.adjust" },
    { id: next(), key: "inventory.reserve" },
    { id: next(), key: "inventory.consume" },
    { id: next(), key: "purchasing.view" },
    { id: next(), key: "purchasing.create" },
    { id: next(), key: "purchasing.approve" },
    { id: next(), key: "purchasing.receive" },
    { id: next(), key: "finance.view" },
    { id: next(), key: "finance.record_payment" },
    { id: next(), key: "finance.record_expense" },
    { id: next(), key: "payments.view" },
    { id: next(), key: "payments.record" },
    { id: next(), key: "deliveries.view" },
    { id: next(), key: "deliveries.create" },
    { id: next(), key: "deliveries.dispatch" },
    { id: next(), key: "deliveries.complete" },
    { id: next(), key: "feedback.view" },
    { id: next(), key: "feedback.create" },
    { id: next(), key: "feedback.resolve" },
    { id: next(), key: "users.manage" },
    { id: next(), key: "roles.manage" },
    { id: next(), key: "settings.manage" },
    { id: next(), key: "audit.view" },
    { id: next(), key: "catalogue.view" },
    { id: next(), key: "catalogue.create" },
    { id: next(), key: "catalogue.edit" },
    { id: next(), key: "catalogue.archive" },
    { id: next(), key: "quotations.view" },
    { id: next(), key: "quotations.create" },
    { id: next(), key: "quotations.accept" },
    { id: next(), key: "inquiries.view" },
    { id: next(), key: "inquiries.create" },
    { id: next(), key: "sales.analytics" },
  ];

  store.userRoles = [
    { id: next(), userId: ids[0], roleId: ids[0] },
    { id: next(), userId: ids[1], roleId: ids[1] },
    { id: next(), userId: ids[2], roleId: ids[2] },
    { id: next(), userId: ids[3], roleId: ids[3] },
  ];

  const idx = (key: string): string =>
    (store.permissions as Permission[]).find((p) => p.key === key)?.id ?? ids[0];

  store.rolePermissions = [
    { id: next(), roleId: ids[0], permissionId: ids[0] },
    { id: next(), roleId: ids[0], permissionId: ids[1] },
    { id: next(), roleId: ids[0], permissionId: ids[2] },
    { id: next(), roleId: ids[0], permissionId: ids[3] },
    { id: next(), roleId: ids[1], permissionId: ids[4] },
    { id: next(), roleId: ids[1], permissionId: ids[5] },
    { id: next(), roleId: ids[1], permissionId: idx("production.view") },
    { id: next(), roleId: ids[1], permissionId: idx("production.schedule") },
    { id: next(), roleId: ids[1], permissionId: idx("production.start") },
    { id: next(), roleId: ids[1], permissionId: idx("production.complete") },
    { id: next(), roleId: ids[1], permissionId: idx("production.quality_check") },
    { id: next(), roleId: ids[1], permissionId: idx("production.record_wastage") },
    { id: next(), roleId: ids[1], permissionId: idx("production.record_consumption") },
    { id: next(), roleId: ids[1], permissionId: idx("inventory.view") },
    { id: next(), roleId: ids[1], permissionId: idx("inventory.reserve") },
    { id: next(), roleId: ids[1], permissionId: idx("inventory.consume") },
    { id: next(), roleId: ids[1], permissionId: idx("purchasing.view") },
    { id: next(), roleId: ids[1], permissionId: idx("purchasing.create") },
    { id: next(), roleId: ids[1], permissionId: idx("deliveries.view") },
    { id: next(), roleId: ids[1], permissionId: idx("deliveries.complete") },
    { id: next(), roleId: ids[2], permissionId: idx("orders.view") },
    { id: next(), roleId: ids[2], permissionId: idx("orders.create") },
    { id: next(), roleId: ids[2], permissionId: idx("orders.cancel") },
    { id: next(), roleId: ids[2], permissionId: idx("sales.analytics") },
    { id: next(), roleId: ids[2], permissionId: idx("quotations.view") },
    { id: next(), roleId: ids[2], permissionId: idx("quotations.create") },
    { id: next(), roleId: ids[2], permissionId: idx("inquiries.view") },
    { id: next(), roleId: ids[2], permissionId: idx("inquiries.create") },
    { id: next(), roleId: ids[2], permissionId: idx("customers.view") },
    { id: next(), roleId: ids[2], permissionId: idx("customers.create") },
    { id: next(), roleId: ids[2], permissionId: idx("feedback.view") },
    { id: next(), roleId: ids[2], permissionId: idx("feedback.create") },
    { id: next(), roleId: ids[3], permissionId: idx("orders.view") },
    { id: next(), roleId: ids[3], permissionId: idx("inquiries.view") },
    { id: next(), roleId: ids[3], permissionId: idx("inquiries.create") },
    { id: next(), roleId: ids[3], permissionId: idx("customers.view") },
    { id: next(), roleId: ids[3], permissionId: idx("customers.interact") },
    { id: next(), roleId: ids[3], permissionId: idx("feedback.view") },
    { id: next(), roleId: ids[3], permissionId: idx("feedback.create") },
  ];

  store.catalogue = {
    categories: [
      { id: next(), name: "Celebration cakes", code: "CAT-001", description: "Tiered celebration cakes", image: "cake.jpg", displayOrder: 1, active: true, catalogueVisible: true },
      { id: next(), name: "Signature cakes", code: "CAT-002", description: "Signature flavour cakes", image: "", displayOrder: 2, active: true, catalogueVisible: true },
      { id: next(), name: "Cupcakes", code: "CAT-003", description: "Individual cupcakes", image: "", displayOrder: 3, active: true, catalogueVisible: true },
      { id: next(), name: "Wedding cakes", code: "CAT-004", description: "Wedding services", image: "wedding.jpg", displayOrder: 4, active: true, catalogueVisible: true },
      { id: next(), name: "Bread & buns", code: "CAT-005", description: "Daily baked breads", image: "", displayOrder: 5, active: true, catalogueVisible: true },
      { id: next(), name: "Pastries", code: "CAT-006", description: "Pastries & breakfast", image: "", displayOrder: 6, active: true, catalogueVisible: true },
      { id: next(), name: "Packaging", code: "CAT-007", description: "Packaging & supplies", image: "", displayOrder: 7, active: true, catalogueVisible: true },
    ],
    types: [] as never[],
    products: [
      { id: next(), sku: "TC-CB-001", categoryId: ids[0], productId: next(), name: "Chocolate celebration cake", description: "Rich chocolate sponge, raspberry ripple, fudge ganache", basePrice: 4500, costReference: "Recipe TC-CHOC-V2", catalogueVisible: true, productionEnabled: true, image: "chocolate-cake.jpg", active: true, archived: false, notes: "Standard 2kg tier", createdAt: now, updatedAt: now },
      { id: next(), sku: "TC-CB-002", categoryId: ids[0], productId: next(), name: "Red velvet cake", description: "Classic red velvet with cream cheese frosting", basePrice: 3800, costReference: "Recipe TC-RED-V1", catalogueVisible: true, productionEnabled: true, image: "", active: true, archived: false, notes: "", createdAt: now, updatedAt: now },
      { id: next(), sku: "TC-CB-003", categoryId: ids[2], productId: next(), name: "Vanilla cupcakes", description: "Vanilla cupcakes, personal size", basePrice: 2400, costReference: "Recipe TC-VAN-V1", catalogueVisible: true, productionEnabled: true, image: "", active: true, archived: false, notes: "", createdAt: now, updatedAt: now },
      { id: next(), sku: "TC-CB-004", categoryId: ids[3], productId: next(), name: "Wedding cake", description: "Custom wedding tier, to order", basePrice: 18000, costReference: "Recipe TC-WED-V1", catalogueVisible: true, productionEnabled: true, image: "wedding.jpg", active: true, archived: false, notes: "Requires enquiry", createdAt: now, updatedAt: now },
      { id: next(), sku: "TC-CB-005", categoryId: ids[1], productId: next(), name: "Carrot cake", description: "Spiced carrot cake with cream cheese", basePrice: 3200, costReference: "Recipe TC-CARR-V1", catalogueVisible: true, productionEnabled: true, image: "", active: true, archived: false, notes: "", createdAt: now, updatedAt: now },
      { id: next(), sku: "TC-CB-006", categoryId: ids[2], productId: next(), name: "Chocolate cupcakes", description: "Rich chocolate cupcakes", basePrice: 1800, costReference: "Recipe TC-CHOC-V1", catalogueVisible: true, productionEnabled: true, image: "", active: true, archived: false, notes: "", createdAt: now, updatedAt: now },
    ],
    variants: [] as never[],
    optionDefinitions: [
      { id: next(), entityType: "product", entityId: "TC-CB-001", name: "Size", isMandatory: true, displayOrder: 1 },
      { id: next(), entityType: "product", entityId: "TC-CB-001", name: "Flavour", isMandatory: true, displayOrder: 2 },
      { id: next(), entityType: "product", entityId: "TC-CB-001", name: "Occasion", isMandatory: false, displayOrder: 3 },
      { id: next(), entityType: "product", entityId: "TC-CB-003", name: "Quantity", isMandatory: true, displayOrder: 1 },
      { id: next(), entityType: "product", entityId: "TC-CB-004", name: "Tiers", isMandatory: true, displayOrder: 1 },
    ],
    optionValues: [
      { id: next(), optionDefId: "OD-1-1", label: "2 kg" },
      { id: next(), optionDefId: "OD-1-2", label: "1.5 kg" },
      { id: next(), optionDefId: "OD-1-3", label: "Birthday" },
      { id: next(), optionDefId: "OD-1-4", label: "Anniversary" },
      { id: next(), optionDefId: "OD-1-5", label: "12 pcs" },
      { id: next(), optionDefId: "OD-1-6", label: "24 pcs" },
      { id: next(), optionDefId: "OD-1-7", label: "3 tiers" },
    ],
  };

  store.inventoryItems = [
    { id: next(), name: "All-purpose flour", category: "Dry ingredients", physicalStock: 8, unit: "kg", reorderLevel: 15, supplierId: ids[0], lastUpdated: now },
    { id: next(), name: "Unsalted butter", sku: "ING-002", category: "Dairy", physicalStock: 2.5, unit: "kg", reorderLevel: 5, supplierId: ids[1], lastUpdated: now },
    { id: next(), name: "Cocoa powder", sku: "ING-003", category: "Dry ingredients", physicalStock: 1.2, unit: "kg", reorderLevel: 3, supplierId: ids[0], lastUpdated: now },
    { id: next(), name: "Granulated sugar", sku: "ING-004", category: "Dry ingredients", physicalStock: 24, unit: "kg", reorderLevel: 10, supplierId: ids[0], lastUpdated: now },
    { id: next(), name: "Fresh eggs", sku: "ING-005", category: "Fresh ingredients", physicalStock: 90, unit: "pcs", reorderLevel: 30, supplierId: ids[1], lastUpdated: now },
    { id: next(), name: "Whipping cream", sku: "ING-006", category: "Dairy", physicalStock: 8, unit: "L", reorderLevel: 4, supplierId: ids[1], lastUpdated: now },
    { id: next(), name: "Buttercream mix", sku: "ING-007", category: "Misc", physicalStock: 12, unit: "batch", reorderLevel: 3, supplierId: ids[2], lastUpdated: now },
  ];

  store.inventoryTransactions = [
    { id: next(), itemId: "INV-001", quantity: 10, unit: "kg", type: "OPENING_BALANCE", reference: "Opening", user: "admin", timestamp: now, unitCost: 120, notes: "Opening position" },
    { id: next(), itemId: "INV-002", quantity: 5, unit: "kg", type: "OPENING_BALANCE", reference: "Opening", user: "admin", timestamp: now, unitCost: 850, notes: "Opening position" },
  ];

  store.stockReservations = [
    { id: next(), itemId: "INV-001", quantity: 2, unit: "kg", orderId: "TC-1048", reference: "TC-1048", reservedAt: now },
    { id: next(), itemId: "INV-002", quantity: 0.5, unit: "kg", orderId: "TC-1047", reference: "TC-1047", reservedAt: now },
  ];

  store.supplierPriceHistory = [
    { id: next(), supplierId: ids[0], productId: "ING-001", unit: "kg", price: 120, effectiveDate: new Date(Date.now() - 30 * 86400000).toISOString(), note: "Base price" },
    { id: next(), supplierId: ids[0], productId: "ING-003", unit: "kg", price: 950, effectiveDate: new Date(Date.now() - 30 * 86400000).toISOString(), note: "Base price" },
    { id: next(), supplierId: ids[1], productId: "ING-002", unit: "kg", price: 850, effectiveDate: new Date(Date.now() - 30 * 86400000).toISOString(), note: "Base price" },
    { id: next(), supplierId: ids[1], productId: "ING-006", unit: "L", price: 650, effectiveDate: new Date(Date.now() - 30 * 86400000).toISOString(), note: "Base price" },
    { id: next(), supplierId: ids[1], productId: "ING-005", unit: "pcs", price: 18, effectiveDate: new Date(Date.now() - 30 * 86400000).toISOString(), note: "Base price" },
    { id: next(), supplierId: ids[1], productId: "ING-006", unit: "L", price: 680, effectiveDate: new Date(Date.now() - 15 * 86400000).toISOString(), note: "15% price adjustment" },
    { id: next(), supplierId: ids[2], productId: "PACK-001", unit: "box", price: 25, effectiveDate: new Date(Date.now() - 30 * 86400000).toISOString(), note: "Base price" },
  ];

  store.persist = save;
}

export const db = store;
export function resetStore(): void {
  loadOrCreate();
  store.persist = save;
  seed();
}

seed();
