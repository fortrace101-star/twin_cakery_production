import { query, withTransaction, type TxClient } from "./db.js";
import { logger } from "../utils/logger.js";
import type {
  AuditLog,
  BlogCategory,
  BlogPost,
  Catalogue,
  Customer,
  CustomerAddress,
  CustomerEvent,
  CustomerEventReminder,
  CustomerFeedback,
  CustomerInteraction,
  Delivery,
  Expense,
  ExpenseCategory,
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
} from "./types.js";

// ---------------------------------------------------------------------------
// helpers (semantics identical to the legacy JSON store)
// ---------------------------------------------------------------------------

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

function mapBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  return Boolean(value);
}

/** snake_case -> camelCase (Postgres returns snake_case keys). */
function camelize(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

// ---------------------------------------------------------------------------
// schema introspection - single source of truth for loader AND save maps
// ---------------------------------------------------------------------------

export interface Column {
  table: string;
  column: string;
  camel: string;
  type: string;
}

/** DDL columns that are not the plain snake_case of the DTO field. */
const CAMEL_OVERRIDES: Record<string, Record<string, string>> = {
  inventory_transactions: { tx_user: "user" },
};

let columnMap: Map<string, Column[]> | null = null;

async function fetchColumnMap(): Promise<Map<string, Column[]>> {
  const rows = await query<{ table_name: string; column_name: string; data_type: string }>(
    `SELECT table_name, column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> '_migrations'
      ORDER BY table_name, ordinal_position`,
  );
  const map = new Map<string, Column[]>();
  for (const row of rows) {
    const overrides = CAMEL_OVERRIDES[row.table_name] ?? {};
    const camel = overrides[row.column_name] ?? camelize(row.column_name);
    const list = map.get(row.table_name) ?? [];
    list.push({ table: row.table_name, column: row.column_name, camel, type: row.data_type });
    map.set(row.table_name, list);
  }
  return map;
}

// ---------------------------------------------------------------------------
// DbCache - in-memory snapshot of the database, mutated synchronously by routes
// ---------------------------------------------------------------------------

export interface DbCache {
  customers: Customer[];
  customerInteractions: CustomerInteraction[];
  inquiries: Inquiry[];
  quotations: Quotation[];
  quotationItems: QuotationItem[];
  orders: Order[];
  orderItems: OrderItem[];
  orderSnapshots: OrderCustomerSnapshot[];
  payments: Payment[];
  productionJobs: ProductionJob[];
  qualityChecks: QualityCheck[];
  productionWastage: ProductionWastage[];
  productionConsumption: ProductionConsumption[];
  productionCosts: ProductionCost[];
  inventoryItems: InventoryItem[];
  inventoryTransactions: InventoryTransaction[];
  stockReservations: StockReservation[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  poItems: PurchaseOrderItem[];
  purchaseRequirements: PurchaseRequirement[];
  goodsReceipts: GoodsReceipt[];
  goodsReceiptItems: GoodsReceiptItem[];
  supplierPriceHistory: SupplierPriceHistory[];
  deliveries: Delivery[];
  notifications: Notification[];
  notificationRecipients: NotificationRecipient[];
  notificationPreferences: NotificationPreference[];
  notificationTemplates: NotificationTemplate[];
  auditLogs: AuditLog[];
  users: User[];
  roles: Role[];
  permissions: Permission[];
  userRoles: UserRole[];
  rolePermissions: RolePermission[];
  orderStatusHistory: OrderStatusHistory[];
  customerFeedback: CustomerFeedback[];
  customerEvents: CustomerEvent[];
  customerEventReminders: CustomerEventReminder[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  catalogue: Catalogue;
  blogCategories: BlogCategory[];
  blogPosts: BlogPost[];
  websiteUsers: WebsiteUser[];
  persist: () => Promise<void>;
}

// serialises write-backs so concurrent persist() calls cannot interleave.
// The chain itself never rejects (callers may fire-and-forget safely); failures
// are recorded so flush() can surface them to the request that caused them.
let saveChain: Promise<void> = Promise.resolve();
let pendingPersistError: Error | null = null;

/** Await every queued write-back; throw if one failed while waiting. */
export async function flush(): Promise<void> {
  const seen = pendingPersistError;
  await saveChain;
  if (pendingPersistError && pendingPersistError !== seen) {
    const err = pendingPersistError;
    pendingPersistError = null;
    throw err;
  }
}

export function createCache(): DbCache {
  return {
    customers: [],
    customerInteractions: [],
    inquiries: [],
    quotations: [],
    quotationItems: [],
    orders: [],
    orderItems: [],
    orderSnapshots: [],
    payments: [],
    productionJobs: [],
    qualityChecks: [],
    productionWastage: [],
    productionConsumption: [],
    productionCosts: [],
    inventoryItems: [],
    inventoryTransactions: [],
    stockReservations: [],
    suppliers: [],
    purchaseOrders: [],
    poItems: [],
    purchaseRequirements: [],
    goodsReceipts: [],
    goodsReceiptItems: [],
    supplierPriceHistory: [],
    deliveries: [],
    notifications: [],
    notificationRecipients: [],
    notificationPreferences: [],
    notificationTemplates: [],
    auditLogs: [],
    users: [],
    roles: [],
    permissions: [],
    userRoles: [],
    rolePermissions: [],
    orderStatusHistory: [],
    customerFeedback: [],
    customerEvents: [],
    customerEventReminders: [],
    expenses: [],
    expenseCategories: [],
    catalogue: { categories: [], types: [], products: [], variants: [], optionDefinitions: [], optionValues: [] },
    blogCategories: [],
    blogPosts: [],
    websiteUsers: [],
    persist: () => {
      saveChain = saveChain
        .then(() => saveCache())
        .then(() => {})
        .catch((err: unknown) => {
          pendingPersistError = err instanceof Error ? err : new Error(String(err));
          logger.failure("store", `persist failed: ${pendingPersistError.message}`);
        });
      return saveChain;
    },
  };
}

// ---------------------------------------------------------------------------
// loader - populates the cache from Postgres at boot
// ---------------------------------------------------------------------------

/** Tables whose load succeeded (mirrored + stale-deleted on write-back). */
const loadedTables = new Set<string>();

function parseJsonArray(value: string): Customer["feedbackSummary"] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as Customer["feedbackSummary"]) : [];
  } catch {
    return [];
  }
}

function coerceRow(cols: Column[], raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of cols) {
    const v = raw[col.column];
    if (v === null || v === undefined) {
      out[col.camel] = null;
      continue;
    }
    switch (col.type) {
      case "numeric":
      case "integer":
      case "bigint":
      case "smallint":
      case "real":
      case "double precision":
        out[col.camel] = mapNum(v);
        break;
      case "boolean":
        out[col.camel] = mapBool(v);
        break;
      case "timestamp with time zone":
      case "timestamp without time zone":
        out[col.camel] = v instanceof Date ? v.toISOString() : String(v);
        break;
      case "date":
        out[col.camel] = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
        break;
      default:
        out[col.camel] = v;
    }
  }
  return out;
}

export async function loadCache(): Promise<void> {
  const cache = createCache();
  try {
    try {
      columnMap = await fetchColumnMap();
    } catch (err) {
      logger.failure("store", "schema introspection failed");
      columnMap = null;
      return;
    }
    const cm = columnMap as Map<string, Column[]>;

    const load = async <T>(table: string): Promise<T[] | null> => {
      const cols = cm.get(table);
      if (!cols || cols.length === 0) {
        logger.failure("store", `table ${table} not found in schema - skipping`);
        return null;
      }
      try {
        const rows = await query<Record<string, unknown>>(`SELECT * FROM ${table}`);
        loadedTables.add(table);
        return rows.map((r) => coerceRow(cols, r) as unknown as T);
      } catch (err) {
        logger.failure("store", `load failed for ${table}`);
        return null;
      }
    };

    // customers + nested addresses/feedback
    cache.customers = (await load<Customer>("customers")) ?? [];
    const addresses = (await load<CustomerAddress>("customer_addresses")) ?? [];
    for (const c of cache.customers) {
      if (!Array.isArray(c.addresses)) c.addresses = [];
    }
    for (const a of addresses) {
      const cust = cache.customers.find((c) => c.id === a.customerId);
      if (cust) cust.addresses.push(a);
    }
    for (const c of cache.customers) {
      if (typeof c.feedbackSummary === "string") {
        c.feedbackSummary = parseJsonArray(c.feedbackSummary);
      } else if (!Array.isArray(c.feedbackSummary)) {
        c.feedbackSummary = [];
      }
    }

    // sales: orders + items, quotations + items
    cache.orders = (await load<Order>("orders")) ?? [];
    cache.orderItems = (await load<OrderItem>("order_items")) ?? [];
    for (const o of cache.orders) {
      o.items = cache.orderItems.filter((i) => i.orderId === o.id);
    }
    cache.quotations = (await load<Quotation>("quotations")) ?? [];
    cache.quotationItems = (await load<QuotationItem>("quotation_items")) ?? [];
    for (const qte of cache.quotations) {
      qte.items = cache.quotationItems.filter((i) => i.quotationId === qte.id);
    }

    // inventory + derived physicalStock
    cache.inventoryItems = (await load<InventoryItem>("inventory_items")) ?? [];
    cache.inventoryTransactions = (await load<InventoryTransaction>("inventory_transactions")) ?? [];
    for (const item of cache.inventoryItems) {
      let total = 0;
      for (const t of cache.inventoryTransactions) {
        if (t.itemId === item.id) total += mapNum(t.quantity);
      }
      item.physicalStock = total;
    }
    cache.stockReservations = (await load<StockReservation>("stock_reservations")) ?? [];

    // catalogue (keyed by DTO field names via indexed access types)
    cache.catalogue.categories = (await load<Catalogue["categories"][number]>("catalogue_categories")) ?? [];
    cache.catalogue.types = (await load<Catalogue["types"][number]>("product_types")) ?? [];
    cache.catalogue.products = (await load<Catalogue["products"][number]>("products")) ?? [];
    for (const p of cache.catalogue.products) {
      if (!p.productId) p.productId = p.id;
      if (!p.categoryId) p.categoryId = "";
    }
    cache.catalogue.variants = (await load<Catalogue["variants"][number]>("product_variants")) ?? [];
    cache.catalogue.optionDefinitions = (await load<Catalogue["optionDefinitions"][number]>("option_definitions")) ?? [];
    cache.catalogue.optionValues = (await load<Catalogue["optionValues"][number]>("option_values")) ?? [];

    // website content (blog + website users) — E2
    cache.blogCategories = (await load<BlogCategory>("blog_categories")) ?? [];
    cache.blogPosts = (await load<BlogPost>("blog_posts")) ?? [];
    cache.websiteUsers = (await load<WebsiteUser>("website_users")) ?? [];

    // purchasing
    cache.suppliers = (await load<Supplier>("suppliers")) ?? [];
    cache.purchaseOrders = (await load<PurchaseOrder>("purchase_orders")) ?? [];
    cache.poItems = (await load<PurchaseOrderItem>("purchase_order_items")) ?? [];
    for (const po of cache.purchaseOrders) {
      po.items = cache.poItems.filter((i) => i.purchaseOrderId === po.id);
    }
    cache.purchaseRequirements = (await load<PurchaseRequirement>("purchase_requirements")) ?? [];
    cache.goodsReceipts = (await load<GoodsReceipt>("goods_receipts")) ?? [];
    cache.goodsReceiptItems = (await load<GoodsReceiptItem>("goods_receipt_items")) ?? [];
    for (const r of cache.goodsReceipts) {
      r.items = cache.goodsReceiptItems.filter((i) => i.goodsReceiptId === r.id);
    }
    cache.supplierPriceHistory = (await load<SupplierPriceHistory>("supplier_price_history")) ?? [];

    // production
    cache.productionJobs = (await load<ProductionJob>("production_jobs")) ?? [];
    cache.qualityChecks = (await load<QualityCheck>("quality_checks")) ?? [];
    cache.productionWastage = (await load<ProductionWastage>("production_wastage")) ?? [];
    cache.productionConsumption = (await load<ProductionConsumption>("production_consumption")) ?? [];
    cache.productionCosts = (await load<ProductionCost>("production_costs")) ?? [];

    // comms / identity / finance / misc
    cache.customerInteractions = (await load<CustomerInteraction>("customer_interactions")) ?? [];
    cache.inquiries = (await load<Inquiry>("inquiries")) ?? [];
    cache.payments = (await load<Payment>("payments")) ?? [];
    cache.deliveries = (await load<Delivery>("deliveries")) ?? [];
    cache.notifications = (await load<Notification>("notifications")) ?? [];
    cache.notificationRecipients = (await load<NotificationRecipient>("notification_recipients")) ?? [];
    cache.notificationPreferences = (await load<NotificationPreference>("notification_preferences")) ?? [];
    cache.notificationTemplates = (await load<NotificationTemplate>("notification_templates")) ?? [];
    cache.auditLogs = (await load<AuditLog>("audit_logs")) ?? [];
    cache.users = (await load<User>("users")) ?? [];
    cache.roles = (await load<Role>("roles")) ?? [];
    cache.permissions = (await load<Permission>("permissions")) ?? [];
    cache.userRoles = (await load<UserRole>("user_roles")) ?? [];
    cache.rolePermissions = (await load<RolePermission>("role_permissions")) ?? [];
    cache.orderStatusHistory = (await load<OrderStatusHistory>("order_status_history")) ?? [];
    cache.customerFeedback = (await load<CustomerFeedback>("customer_feedback")) ?? [];
    cache.orderSnapshots = (await load<OrderCustomerSnapshot>("order_customer_snapshots")) ?? [];
    cache.customerEvents = (await load<CustomerEvent>("customer_events")) ?? [];
    cache.customerEventReminders = (await load<CustomerEventReminder>("customer_event_reminders")) ?? [];
    cache.expenses = (await load<Expense>("expenses")) ?? [];
    cache.expenseCategories = (await load<ExpenseCategory>("expense_categories")) ?? [];

    currentDb = cache;
    logger.boot(`cache loaded: ${cache.users.length} users, ${cache.customers.length} customers, ` +
      `${cache.orders.length} orders, ${cache.quotations.length} quotations, ` +
      `${cache.inventoryItems.length} inventory items, ${cache.catalogue.products.length} catalogue products, ` +
      `${cache.blogPosts.length} blog posts`);
  } catch (err) {
    console.error("[store] loadCache failed - booting with empty/partial cache:", err);
  }
}

// ---------------------------------------------------------------------------
// write-back - mirrors the cache to Postgres (upsert + stale-delete)
// ---------------------------------------------------------------------------

function serializeValue(value: unknown, type: string): unknown {
  if (value === undefined || value === null) return value;
  switch (type) {
    case "date":
      return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    case "timestamp with time zone":
    case "timestamp without time zone":
      return value instanceof Date ? value.toISOString() : String(value);
    case "numeric":
    case "integer":
    case "bigint":
    case "smallint":
    case "real":
    case "double precision":
      return typeof value === "string" || typeof value === "number" ? value : String(value);
    case "boolean":
      return mapBool(value);
    default:
      // JSONB columns + legacy TEXT blobs (feedbackSummary/notify/addresses)
      if (typeof value === "object") return JSON.stringify(value);
      return value;
  }
}

async function persistTable(
  tx: TxClient,
  table: string,
  cols: Column[],
  rows: readonly object[],
): Promise<void> {
  if (rows.length === 0) return;
  const byKey = new Map<string, Column>();
  for (const col of cols) byKey.set(col.camel, col);
  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const entries: string[] = [];
    const values: unknown[] = [];
    const sets: string[] = [];
    let hasId = false;
    for (const [key, raw] of Object.entries(record)) {
      if (raw === undefined) continue;
      const col = byKey.get(key);
      if (!col) continue; // DTO-only/nested key (items, addresses, feedbackSummary, notify, currency)
      if (key === "id") hasId = true;
      entries.push(col.column);
      values.push(serializeValue(raw, col.type));
      if (key !== "id") sets.push(`${col.column} = EXCLUDED.${col.column}`);
    }
    if (!hasId || entries.length === 0) continue;
    const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
    const conflict = sets.length > 0
      ? `DO UPDATE SET ${sets.join(", ")}`
      : "DO NOTHING";
    await tx.query(
      `INSERT INTO ${table} (${entries.join(", ")}) VALUES (${placeholders}) ON CONFLICT (id) ${conflict}`,
      values,
    );
  }
}

async function deleteStale(tx: TxClient, table: string, rows: readonly object[]): Promise<void> {
  const ids = rows
    .map((r) => (r as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string" && id !== "");
  await tx.query(`DELETE FROM ${table} WHERE NOT (id = ANY($1))`, [ids]);
}

// FK parents first, children later (inserts); deletions run the list in reverse.
interface Mirror {
  table: string;
  rows: (c: DbCache) => readonly object[];
}

const MIRRORS: Mirror[] = [
  { table: "catalogue_categories", rows: (c) => c.catalogue.categories },
  { table: "product_types", rows: (c) => c.catalogue.types },
  { table: "products", rows: (c) => c.catalogue.products },
  { table: "product_variants", rows: (c) => c.catalogue.variants },
  { table: "option_definitions", rows: (c) => c.catalogue.optionDefinitions },
  { table: "option_values", rows: (c) => c.catalogue.optionValues },
  { table: "customers", rows: (c) => c.customers },
  { table: "customer_addresses", rows: (c) =>
    c.customers.flatMap((cu) => (Array.isArray(cu.addresses) ? cu.addresses : [])) },
  { table: "customer_interactions", rows: (c) => c.customerInteractions },
  { table: "inquiries", rows: (c) => c.inquiries },
  { table: "quotations", rows: (c) => c.quotations },
  { table: "quotation_items", rows: (c) => c.quotationItems },
  { table: "orders", rows: (c) => c.orders },
  { table: "order_items", rows: (c) => c.orderItems },
  { table: "order_status_history", rows: (c) => c.orderStatusHistory },
  { table: "payments", rows: (c) => c.payments },
  { table: "production_jobs", rows: (c) => c.productionJobs },
  { table: "quality_checks", rows: (c) => c.qualityChecks },
  { table: "production_wastage", rows: (c) => c.productionWastage },
  { table: "production_consumption", rows: (c) => c.productionConsumption },
  { table: "production_costs", rows: (c) => c.productionCosts },
  { table: "inventory_items", rows: (c) => c.inventoryItems },
  { table: "inventory_transactions", rows: (c) => c.inventoryTransactions },
  { table: "stock_reservations", rows: (c) => c.stockReservations },
  { table: "suppliers", rows: (c) => c.suppliers },
  { table: "purchase_orders", rows: (c) => c.purchaseOrders },
  { table: "purchase_order_items", rows: (c) => c.poItems },
  { table: "purchase_requirements", rows: (c) => c.purchaseRequirements },
  { table: "goods_receipts", rows: (c) => c.goodsReceipts },
  { table: "goods_receipt_items", rows: (c) => c.goodsReceipts.flatMap((r) => (Array.isArray(r.items) ? r.items : [])) },
  { table: "supplier_price_history", rows: (c) => c.supplierPriceHistory },
  { table: "deliveries", rows: (c) => c.deliveries },
  { table: "expense_categories", rows: (c) => c.expenseCategories },
  { table: "expenses", rows: (c) => c.expenses },
  { table: "notifications", rows: (c) => c.notifications },
  { table: "notification_recipients", rows: (c) => c.notificationRecipients },
  { table: "notification_preferences", rows: (c) => c.notificationPreferences },
  { table: "notification_templates", rows: (c) => c.notificationTemplates },
  { table: "audit_logs", rows: (c) => c.auditLogs },
  { table: "users", rows: (c) => c.users },
  { table: "roles", rows: (c) => c.roles },
  { table: "permissions", rows: (c) => c.permissions },
  { table: "user_roles", rows: (c) => c.userRoles },
  { table: "role_permissions", rows: (c) => c.rolePermissions },
  { table: "customer_feedback", rows: (c) => c.customerFeedback },
  { table: "order_customer_snapshots", rows: (c) => c.orderSnapshots },
  { table: "customer_events", rows: (c) => c.customerEvents },
  { table: "customer_event_reminders", rows: (c) => c.customerEventReminders },
  { table: "blog_categories", rows: (c) => c.blogCategories },
  { table: "blog_posts", rows: (c) => c.blogPosts },
  { table: "website_users", rows: (c) => c.websiteUsers },
];

async function saveCache(): Promise<void> {
  if (loadedTables.size === 0 || !columnMap) {
    // Never silently drop write-backs: this means boot-time load never ran.
    logger.failure("store", "saveCache skipped - cache not loaded");
    return;
  }
  const cm = columnMap;
  await withTransaction(async (tx) => {
    for (const m of MIRRORS) {
      if (!loadedTables.has(m.table)) continue;
      const cols = cm.get(m.table);
      if (!cols) continue;
      await persistTable(tx, m.table, cols, m.rows(currentDb));
    }
    for (let i = MIRRORS.length - 1; i >= 0; i--) {
      const m = MIRRORS[i];
      if (!loadedTables.has(m.table)) continue;
      await deleteStale(tx, m.table, m.rows(currentDb));
    }
  });
}

// ---------------------------------------------------------------------------
// module state + exports
// ---------------------------------------------------------------------------

let currentDb: DbCache = createCache();

export function getDb(): DbCache {
  return currentDb;
}

export function resetStore(): void {
  currentDb = createCache();
  loadedTables.clear();
}

export const ready: Promise<void> = loadCache();
