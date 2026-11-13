import { query, withTransaction, type TxClient } from "./db.js";
import { logger } from "../utils/logger.js";
import { localDay } from "../utils/local-day.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// In-process set of resource keys whose cache rows have been touched since the
// last flush(). Routes that mutate data mark the relevant keys here; the live
// layer reads this set when deciding what to broadcast.
export const resourceDirty = new Set<string>();

/** Stable, serializable keys used in live broadcasts and client subscriptions.
 *  Kept simple (table/entity names) so both server and client can agree on them
 *  without importing nested DB shapes.
 */
export type ResourceKey = string;

export const RESOURCE_KEYS = {
  orders: "orders" as ResourceKey,
  orderItems: "orderItems" as ResourceKey,
  orderStatusHistory: "orderStatusHistory" as ResourceKey,
  orderSnapshots: "orderSnapshots" as ResourceKey,
  payments: "payments" as ResourceKey,
  deliveries: "deliveries" as ResourceKey,
  invoices: "invoices" as ResourceKey,
  productionJobs: "productionJobs" as ResourceKey,
  qualityChecks: "qualityChecks" as ResourceKey,
  productionWastage: "productionWastage" as ResourceKey,
  productionConsumption: "productionConsumption" as ResourceKey,
  productionCosts: "productionCosts" as ResourceKey,
  inventoryItems: "inventoryItems" as ResourceKey,
  inventoryTransactions: "inventoryTransactions" as ResourceKey,
  stockReservations: "stockReservations" as ResourceKey,
  suppliers: "suppliers" as ResourceKey,
  purchaseOrders: "purchaseOrders" as ResourceKey,
  purchaseOrderItems: "purchaseOrderItems" as ResourceKey,
  purchaseRequirements: "purchaseRequirements" as ResourceKey,
  goodsReceipts: "goodsReceipts" as ResourceKey,
  goodsReceiptItems: "goodsReceiptItems" as ResourceKey,
  supplierPriceHistory: "supplierPriceHistory" as ResourceKey,
  customers: "customers" as ResourceKey,
  customerInteractions: "customerInteractions" as ResourceKey,
  inquiries: "inquiries" as ResourceKey,
  quotations: "quotations" as ResourceKey,
  quotationItems: "quotationItems" as ResourceKey,
  notifications: "notifications" as ResourceKey,
  notificationRecipients: "notificationRecipients" as ResourceKey,
  notificationPreferences: "notificationPreferences" as ResourceKey,
  notificationTemplates: "notificationTemplates" as ResourceKey,
  auditLogs: "auditLogs" as ResourceKey,
  users: "users" as ResourceKey,
  roles: "roles" as ResourceKey,
  permissions: "permissions" as ResourceKey,
  userRoles: "userRoles" as ResourceKey,
  rolePermissions: "rolePermissions" as ResourceKey,
  customerFeedback: "customerFeedback" as ResourceKey,
  orderProposals: "orderProposals" as ResourceKey,
  orderProposalItems: "orderProposalItems" as ResourceKey,
  staff: "staff" as ResourceKey,
  staffAttendance: "staffAttendance" as ResourceKey,
  salaryProfiles: "salaryProfiles" as ResourceKey,
  remunerationPeriods: "remunerationPeriods" as ResourceKey,
  remunerationItems: "remunerationItems" as ResourceKey,
  staffAdvances: "staffAdvances" as ResourceKey,
  remunerationPayments: "remunerationPayments" as ResourceKey,
  payslips: "payslips" as ResourceKey,
  customerEvents: "customerEvents" as ResourceKey,
  customerEventReminders: "customerEventReminders" as ResourceKey,
  expenses: "expenses" as ResourceKey,
  expenseCategories: "expenseCategories" as ResourceKey,
  catalogue: "catalogue" as ResourceKey,
  blogCategories: "blogCategories" as ResourceKey,
  blogPosts: "blogPosts" as ResourceKey,
  websiteUsers: "websiteUsers" as ResourceKey,
  followups: "followups" as ResourceKey,
} as const;
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
  OrderProposal,
  OrderProposalItem,
  OrderStatusHistory,
  Payment,
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
  ProductionFixedCostCategory,
  ProductionFixedCostEntry,
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
  productionFixedCostCategories: ProductionFixedCostCategory[];
  productionFixedCostEntries: ProductionFixedCostEntry[];
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
  orderProposals: OrderProposal[];
  orderProposalItems: OrderProposalItem[];
  // E7 — staff & remuneration (governing doc §18): FK parents before children.
  staff: Staff[];
  staffAttendance: StaffAttendance[];
  salaryProfiles: SalaryProfile[];
  remunerationPeriods: RemunerationPeriod[];
  remunerationItems: RemunerationItem[];
  staffAdvances: StaffAdvance[];
  remunerationPayments: RemunerationPayment[];
  payslips: Payslip[];
  catalogue: Catalogue;
  blogCategories: BlogCategory[];
  blogPosts: BlogPost[];
  websiteUsers: WebsiteUser[];
  persist: () => Promise<void>;
  _dirtyKeys: () => string[];
  _touchResource: (key: string) => void;
  _clearDirtyResource: (key: string) => void;
}

export interface DbCacheWithDirtyKeys extends DbCache {
  _dirtyKeys: () => string[];
  _touchResource: (key: string) => void;
  _clearDirtyResource: (key: string) => void;
}

export type DbCacheForLive = DbCacheWithDirtyKeys;

// Serialises write-backs so concurrent persist() calls cannot interleave.
// Postgres is mandatory: failures are recorded and flush()/awaited persist()
// reject so callers in critical paths can return hard errors (503).
let saveChain: Promise<void> = Promise.resolve();
let pendingPersistError: Error | null = null;
let authoritativeLoad = false; // true only when loaded from Postgres schema/data
const ALLOW_FILE_SNAPSHOT = process.env.ERP_ALLOW_FILE_SNAPSHOT === "1";

/** In-process change log that the write-back layer can replay after a crash
 * boot so clients can be told which logical resources changed even if the
 * in-memory cache still needs to be re-loaded from Postgres. This is dev-only:
 * production servers do not replay this log, and the buffer is bounded/rotated
 * so unbounded growth does not happen (and it is not advertised to clients).
 *
 * Each entry is small (resource key + when), never serialized/DTO payloads, so
 * the overhead is negligible compared with the current full-cache persisted
 * write-back path.
 */
export interface CacheChange {
  resource: string;
  at: number;
}

const maxChangeLogEntries = 1000;
let _changeLog: CacheChange[] = [];

function recordChange(key: string): void {
  if (_changeLog.length >= maxChangeLogEntries) {
    _changeLog.shift();
  }
  _changeLog.push({ resource: key, at: Date.now() });
}

/** Return the recent change log consumed since `last` (or all if omitted).
 *  The log is snapshotted and truncated on each call so repeated reads of the
 *  same cursor do not re-emit the same entries. */
export function consumeChangeLogSince(last?: number): CacheChange[] {
  let entries: CacheChange[];
  if (last === undefined) {
    entries = _changeLog.slice();
    _changeLog.length = 0;
  } else {
    const cutoff = _changeLog.findIndex((e) => e.at > last);
    if (cutoff < 0) {
      entries = [];
    } else {
      entries = _changeLog.splice(cutoff);
    }
  }
  return entries;
}

/** Await every queued write-back; throw if one failed while waiting. */
export async function flush(): Promise<void> {
  await saveChain;
  if (pendingPersistError) {
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
    productionFixedCostCategories: [],
    productionFixedCostEntries: [],
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
    orderProposals: [],
    orderProposalItems: [],
    // E7 — staff & remuneration tables (order = FK-safe for insert/delete).
    staff: [],
    staffAttendance: [],
    salaryProfiles: [],
    remunerationPeriods: [],
    remunerationItems: [],
    staffAdvances: [],
    remunerationPayments: [],
    payslips: [],
    catalogue: { categories: [], types: [], products: [], variants: [], optionDefinitions: [], optionValues: [] },
    blogCategories: [],
    blogPosts: [],
    websiteUsers: [],
    persist: () => {
      saveChain = saveChain
        .then(() => saveCache())
        .then(() => {
          if (ALLOW_FILE_SNAPSHOT) { try { saveToFile(currentDb); } catch {} }
          pendingPersistError = null;
        })
        .catch((err: unknown) => {
          pendingPersistError = err instanceof Error ? err : new Error(String(err));
          logger.failure("store", `persist failed: ${pendingPersistError.message}`);
        });
      return saveChain;
    },
    /** Resource keys touched by mutations in this process since boot.
     *  Used by the live-events layer to advertise which caches are dirty
     *  so clients can refresh only the views that matter.
     */
    _dirtyKeys: () => Array.from(dirtyKeysSnapshot()),
    _touchResource: (key: string) => {
      resourceDirty.add(key);
      recordChange(key);
    },
    _clearDirtyResource: (key: string) => {
      resourceDirty.delete(key);
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
      case "date": {
        // A DATE has no time zone: read its Y/M/D as parsed (local midnight),
        // never through toISOString(), which would shift it back a day east of
        // UTC and let the cache write-back persist the wrong calendar day.
        if (v instanceof Date) {
          const pad = (n: number) => String(n).padStart(2, "0");
          out[col.camel] = `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
        } else {
          out[col.camel] = String(v).slice(0, 10);
        }
        break;
      }
      default:
        out[col.camel] = v;
    }
  }
  return out;
}

export async function loadCache(): Promise<void> {
  const cache = createCache();
  // Postgres is the mandatory source of truth. Do NOT load server/data/store.json
  // as authoritative state (it is stale/debug-only and previously caused mirror
  // deletes that wiped DB rows). Boot fails hard if Postgres is unavailable.
  try {
    columnMap = await fetchColumnMap();
    const cm = columnMap as Map<string, Column[]>;

    const load = async <T>(table: string): Promise<T[]> => {
      const cols = cm.get(table);
      if (!cols || cols.length === 0) {
        throw new Error(`Table ${table} not found in schema`);
      }
      const rows = await query<Record<string, unknown>>(`SELECT * FROM ${table}`);
      loadedTables.add(table);
      return rows.map((r) => coerceRow(cols, r) as unknown as T);
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

    // One-shot status rename mapping (2026-10): rows persisted with the
    // retired order/delivery status names are translated at load time.
    const LEGACY_ORDER_STATUS: Record<string, string> = {
      OUT_FOR_DELIVERY: "IN_TRANSIT",
      AWAITING_PICKUP: "AWAITING_COLLECTION",
      COMPLETED: "COMPLETED_DELIVERED",
    };
    const LEGACY_DELIVERY_STATUS: Record<string, string> = {
      OUT_FOR_DELIVERY: "IN_TRANSIT",
      AWAITING_PICKUP: "AWAITING_COLLECTION",
      DELIVERED: "COMPLETED_DELIVERED",
    };

    // sales: orders + items, quotations + items
    cache.orders = (await load<Order>("orders")) ?? [];
    cache.orderItems = (await load<OrderItem>("order_items")) ?? [];
    for (const o of cache.orders) {
      o.items = cache.orderItems.filter((i) => i.orderId === o.id);
      o.status = (LEGACY_ORDER_STATUS[o.status] ?? o.status) as Order["status"];
      o.deliveryStatus = (LEGACY_DELIVERY_STATUS[o.deliveryStatus] ?? o.deliveryStatus) as Order["deliveryStatus"];
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
    cache.productionFixedCostCategories = (await load<ProductionFixedCostCategory>("production_fixed_cost_categories")) ?? [];
    cache.productionFixedCostEntries = (await load<ProductionFixedCostEntry>("production_fixed_cost_entries")) ?? [];
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
    for (const d of cache.deliveries) {
      d.status = (LEGACY_DELIVERY_STATUS[d.status] ?? d.status) as Delivery["status"];
    }
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
    for (const h of cache.orderStatusHistory) {
      h.previousStatus = (LEGACY_ORDER_STATUS[h.previousStatus] ?? h.previousStatus) as OrderStatusHistory["previousStatus"];
      h.newStatus = (LEGACY_ORDER_STATUS[h.newStatus] ?? h.newStatus) as OrderStatusHistory["newStatus"];
    }
    cache.customerFeedback = (await load<CustomerFeedback>("customer_feedback")) ?? [];
    cache.orderSnapshots = (await load<OrderCustomerSnapshot>("order_customer_snapshots")) ?? [];
    cache.customerEvents = (await load<CustomerEvent>("customer_events")) ?? [];
    cache.customerEventReminders = (await load<CustomerEventReminder>("customer_event_reminders")) ?? [];
    cache.expenses = (await load<Expense>("expenses")) ?? [];
    cache.expenseCategories = (await load<ExpenseCategory>("expense_categories")) ?? [];

    // public order proposals (E6 §§29-30) — website order form submissions
    cache.orderProposals = (await load<OrderProposal>("order_proposals")) ?? [];
    cache.orderProposalItems = (await load<OrderProposalItem>("order_proposal_items")) ?? [];
    for (const p of cache.orderProposals) {
      p.items = cache.orderProposalItems.filter((i) => i.proposalId === p.id);
    }

    // E7 — staff & remuneration (governing doc §18): parents first, then
    // children keyed onto them. JSONB repayment_log stays a parsed array via
    // coerceRow's default branch.
    cache.staff = (await load<Staff>("staff")) ?? [];
    cache.staffAttendance = (await load<StaffAttendance>("staff_attendance")) ?? [];
    cache.salaryProfiles = (await load<SalaryProfile>("salary_profiles")) ?? [];
    cache.remunerationPeriods = (await load<RemunerationPeriod>("remuneration_periods")) ?? [];
    cache.remunerationItems = (await load<RemunerationItem>("remuneration_items")) ?? [];
    cache.staffAdvances = (await load<StaffAdvance>("staff_advances")) ?? [];
    for (const a of cache.staffAdvances) {
      if (!Array.isArray(a.repaymentLog)) a.repaymentLog = [];
    }
    cache.remunerationPayments = (await load<RemunerationPayment>("remuneration_payments")) ?? [];
    cache.payslips = (await load<Payslip>("payslips")) ?? [];

    authoritativeLoad = true;
    currentDb = cache;
    logger.boot(`cache loaded from Postgres: ${cache.users.length} users, ${cache.customers.length} customers, ` +
      `${cache.orders.length} orders, ${cache.quotations.length} quotations, ` +
      `${cache.inventoryItems.length} inventory items, ${cache.catalogue.products.length} catalogue products, ` +
      `${cache.blogPosts.length} blog posts`);
  } catch (err) {
    authoritativeLoad = false;
    loadedTables.clear();
    columnMap = null;
    const msg = err instanceof Error ? err.message : String(err);
    logger.failure("store", `Postgres load failed (mandatory): ${msg}`);
    throw new Error(`Postgres is required but load failed: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// write-back - mirrors the cache to Postgres (upsert + stale-delete)
// ---------------------------------------------------------------------------

function serializeValue(value: unknown, type: string): unknown {
  if (value === undefined || value === null) return value;
  switch (type) {
    case "date":
      // A DATE has no time zone: write back the day it already represents
      // instead of shifting it to UTC (which is a day earlier in East Africa).
      if (value instanceof Date) return localDay(value);
      return String(value).slice(0, 10);
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
  { table: "production_fixed_cost_categories", rows: (c) => c.productionFixedCostCategories },
  { table: "production_fixed_cost_entries", rows: (c) => c.productionFixedCostEntries },
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
  // FK-safe order: proposals before items; customers/inquiries/orders load via
  // their own mirrors (proposals only hold OPTIONAL links to them).
  { table: "order_proposals", rows: (c) => c.orderProposals },
  { table: "order_proposal_items", rows: (c) => c.orderProposalItems },
  // E7 — staff & remuneration: staff before its children; periods before
  // items/payments/payslips; advances after staff. Deletion runs reversed.
  { table: "staff", rows: (c) => c.staff },
  { table: "staff_attendance", rows: (c) => c.staffAttendance },
  { table: "salary_profiles", rows: (c) => c.salaryProfiles },
  { table: "remuneration_periods", rows: (c) => c.remunerationPeriods },
  { table: "remuneration_items", rows: (c) => c.remunerationItems },
  { table: "staff_advances", rows: (c) => c.staffAdvances },
  { table: "remuneration_payments", rows: (c) => c.remunerationPayments },
  { table: "payslips", rows: (c) => c.payslips },
  { table: "blog_categories", rows: (c) => c.blogCategories },
  { table: "blog_posts", rows: (c) => c.blogPosts },
  { table: "website_users", rows: (c) => c.websiteUsers },
];


// File-based persistence fallback
const __filename_fp = fileURLToPath(import.meta.url);
const __dirname_fp = path.dirname(__filename_fp);
const PERSIST_FILE = path.resolve(__dirname_fp, '..', 'data', 'store.json');
console.log('[store] PERSIST_FILE:', PERSIST_FILE);

function ensurePersistDir() {
  try {
    const dir = path.dirname(PERSIST_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
}

function saveToFile(cache: DbCache) {
  try {
    ensurePersistDir();
    const data = {
      customers: cache.customers,
      customerInteractions: cache.customerInteractions,
      inquiries: cache.inquiries,
      quotations: cache.quotations,
      quotationItems: cache.quotationItems,
      orders: cache.orders,
      orderItems: cache.orderItems,
      orderSnapshots: cache.orderSnapshots,
      payments: cache.payments,
      productionJobs: cache.productionJobs,
      qualityChecks: cache.qualityChecks,
      productionWastage: cache.productionWastage,
      productionConsumption: cache.productionConsumption,
      productionCosts: cache.productionCosts,
      inventoryItems: cache.inventoryItems,
      inventoryTransactions: cache.inventoryTransactions,
      stockReservations: cache.stockReservations,
      suppliers: cache.suppliers,
      productionFixedCostCategories: cache.productionFixedCostCategories,
      productionFixedCostEntries: cache.productionFixedCostEntries,
      purchaseOrders: cache.purchaseOrders,
      poItems: cache.poItems,
      purchaseRequirements: cache.purchaseRequirements,
      goodsReceipts: cache.goodsReceipts,
      goodsReceiptItems: cache.goodsReceiptItems,
      supplierPriceHistory: cache.supplierPriceHistory,
      deliveries: cache.deliveries,
      notifications: cache.notifications,
      notificationRecipients: cache.notificationRecipients,
      notificationPreferences: cache.notificationPreferences,
      notificationTemplates: cache.notificationTemplates,
      auditLogs: cache.auditLogs,
      users: cache.users,
      roles: cache.roles,
      permissions: cache.permissions,
      userRoles: cache.userRoles,
      rolePermissions: cache.rolePermissions,
      orderStatusHistory: cache.orderStatusHistory,
      customerFeedback: cache.customerFeedback,
      customerEvents: cache.customerEvents,
      customerEventReminders: cache.customerEventReminders,
      expenses: cache.expenses,
      expenseCategories: cache.expenseCategories,
      orderProposals: cache.orderProposals,
      orderProposalItems: cache.orderProposalItems,
      staff: cache.staff,
      staffAttendance: cache.staffAttendance,
      salaryProfiles: cache.salaryProfiles,
      remunerationPeriods: cache.remunerationPeriods,
      remunerationItems: cache.remunerationItems,
      staffAdvances: cache.staffAdvances,
      remunerationPayments: cache.remunerationPayments,
      payslips: cache.payslips,
      catalogue: cache.catalogue,
      blogCategories: cache.blogCategories,
      blogPosts: cache.blogPosts,
      websiteUsers: cache.websiteUsers,
    };
    const pathsToWrite = [
      PERSIST_FILE,
      path.resolve(process.cwd(), 'server', 'data', 'store.json'),
      path.resolve(process.cwd(), 'data', 'store.json'),
    ];
    for (const p of pathsToWrite) {
      try {
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(p, JSON.stringify(data, null, 2));
      } catch {}
    }
  } catch (e) {
    logger.failure('store', 'file persist failed');
  }
}

function loadFromFile(cache: DbCache): boolean {
  try {
    if (!fs.existsSync(PERSIST_FILE)) return false;
    const raw = fs.readFileSync(PERSIST_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data) return false;
    Object.keys(data).forEach(k => {
      if ((cache as any)[k] !== undefined && data[k] !== undefined) {
        (cache as any)[k] = data[k];
      }
    });
    // Rebuild nested refs
    for (const o of cache.orders) {
      o.items = cache.orderItems.filter((i: any) => i.orderId === o.id);
    }
    for (const q of cache.quotations) {
      q.items = cache.quotationItems.filter((i: any) => i.quotationId === q.id);
    }
    for (const po of cache.purchaseOrders) {
      po.items = cache.poItems.filter((i: any) => i.purchaseOrderId === po.id);
    }
    for (const r of cache.goodsReceipts) {
      r.items = cache.goodsReceiptItems.filter((i: any) => i.goodsReceiptId === r.id);
    }
    for (const p of cache.orderProposals) {
      p.items = cache.orderProposalItems.filter((i: any) => i.proposalId === p.id);
    }
    // Mark all tables as loaded for file fallback
    const allTables = ['customers','customer_interactions','inquiries','quotations','quotation_items','orders','order_items','order_status_history','payments','production_jobs','quality_checks','production_wastage','production_consumption','production_costs','inventory_items','inventory_transactions','stock_reservations','suppliers','production_fixed_cost_categories','production_fixed_cost_entries','purchase_orders','purchase_order_items','purchase_requirements','goods_receipts','goods_receipt_items','supplier_price_history','deliveries','expense_categories','expenses','notifications','notification_recipients','notification_preferences','notification_templates','audit_logs','users','roles','permissions','user_roles','role_permissions','customer_feedback','order_customer_snapshots','customer_events','customer_event_reminders','order_proposals','order_proposal_items','staff','staff_attendance','salary_profiles','remuneration_periods','remuneration_items','staff_advances','remuneration_payments','payslips','blog_categories','blog_posts','website_users','catalogue_categories','product_types','products','product_variants','option_definitions','option_values','customer_addresses'];
    allTables.forEach(t => loadedTables.add(t));
    loadedTables.add('catalogue_categories');
    loadedTables.add('products');
    return true;
  } catch (e) {
    return false;
  }
}

async function saveCache(): Promise<void> {
  if (!columnMap) {
    logger.boot("saveCache skipped (schema not loaded)");
    return;
  }
  if (!authoritativeLoad || loadedTables.size === 0) {
    // Pre-ready/race: don't throw (boot-order code may persist before `ready`).
    // Post-load DB write failures still throw below.
    logger.boot("saveCache skipped (cache not authoritatively loaded yet)");
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
  resourceDirty.clear();
  _changeLog.length = 0;
}

export function dirtyKeys(): ReadonlySet<string> {
  return resourceDirty;
}

export function clearDirtyResource(key: string): void {
  resourceDirty.delete(key);
}

export function dirtyKeysSnapshot(): ReadonlySet<string> {
  return new Set(resourceDirty);
}
export function markResourceDirty(...keys: string[]): void {
  for (const k of keys) {
    resourceDirty.add(k);
    recordChange(k);
  }
}
export const ready: Promise<void> = loadCache();
