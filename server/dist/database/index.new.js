import { query, withTransaction } from "./db.js";
import { logger } from "../utils/logger.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// In-process set of resource keys whose cache rows have been touched since the
// last flush(). Routes that mutate data mark the relevant keys here; the live
// layer reads this set when deciding what to broadcast.
export const resourceDirty = new Set();
export const RESOURCE_KEYS = {
    orders: "orders",
    orderItems: "orderItems",
    orderStatusHistory: "orderStatusHistory",
    orderSnapshots: "orderSnapshots",
    payments: "payments",
    deliveries: "deliveries",
    invoices: "invoices",
    productionJobs: "productionJobs",
    qualityChecks: "qualityChecks",
    productionWastage: "productionWastage",
    productionConsumption: "productionConsumption",
    productionCosts: "productionCosts",
    inventoryItems: "inventoryItems",
    inventoryTransactions: "inventoryTransactions",
    stockReservations: "stockReservations",
    suppliers: "suppliers",
    purchaseOrders: "purchaseOrders",
    purchaseOrderItems: "purchaseOrderItems",
    purchaseRequirements: "purchaseRequirements",
    goodsReceipts: "goodsReceipts",
    goodsReceiptItems: "goodsReceiptItems",
    supplierPriceHistory: "supplierPriceHistory",
    customers: "customers",
    customerInteractions: "customerInteractions",
    inquiries: "inquiries",
    quotations: "quotations",
    quotationItems: "quotationItems",
    notifications: "notifications",
    notificationRecipients: "notificationRecipients",
    notificationPreferences: "notificationPreferences",
    notificationTemplates: "notificationTemplates",
    auditLogs: "auditLogs",
    users: "users",
    roles: "roles",
    permissions: "permissions",
    userRoles: "userRoles",
    rolePermissions: "rolePermissions",
    customerFeedback: "customerFeedback",
    orderProposals: "orderProposals",
    orderProposalItems: "orderProposalItems",
    staff: "staff",
    staffAttendance: "staffAttendance",
    salaryProfiles: "salaryProfiles",
    remunerationPeriods: "remunerationPeriods",
    remunerationItems: "remunerationItems",
    staffAdvances: "staffAdvances",
    remunerationPayments: "remunerationPayments",
    payslips: "payslips",
    customerEvents: "customerEvents",
    customerEventReminders: "customerEventReminders",
    expenses: "expenses",
    expenseCategories: "expenseCategories",
    catalogue: "catalogue",
    blogCategories: "blogCategories",
    blogPosts: "blogPosts",
    websiteUsers: "websiteUsers",
    followups: "followups",
};
// ---------------------------------------------------------------------------
// helpers (semantics identical to the legacy JSON store)
// ---------------------------------------------------------------------------
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
function mapBool(value) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string")
        return ["true", "1", "yes", "on"].includes(value.toLowerCase());
    return Boolean(value);
}
/** snake_case -> camelCase (Postgres returns snake_case keys). */
function camelize(key) {
    return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
/** DDL columns that are not the plain snake_case of the DTO field. */
const CAMEL_OVERRIDES = {
    inventory_transactions: { tx_user: "user" },
};
let columnMap = null;
async function fetchColumnMap() {
    const rows = await query(`SELECT table_name, column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> '_migrations'
      ORDER BY table_name, ordinal_position`);
    const map = new Map();
    for (const row of rows) {
        const overrides = CAMEL_OVERRIDES[row.table_name] ?? {};
        const camel = overrides[row.column_name] ?? camelize(row.column_name);
        const list = map.get(row.table_name) ?? [];
        list.push({ table: row.table_name, column: row.column_name, camel, type: row.data_type });
        map.set(row.table_name, list);
    }
    return map;
}
// Serialises write-backs so concurrent persist() calls cannot interleave.
// Postgres is mandatory: failures are recorded and flush()/awaited persist()
// reject so callers in critical paths can return hard errors (503).
let saveChain = Promise.resolve();
let pendingPersistError = null;
let authoritativeLoad = false; // true only when loaded from Postgres schema/data
const ALLOW_FILE_SNAPSHOT = process.env.ERP_ALLOW_FILE_SNAPSHOT === "1";
const maxChangeLogEntries = 1000;
let _changeLog = [];
function recordChange(key) {
    if (_changeLog.length >= maxChangeLogEntries) {
        _changeLog.shift();
    }
    _changeLog.push({ resource: key, at: Date.now() });
}
/** Return the recent change log consumed since `last` (or all if omitted).
 *  The log is snapshotted and truncated on each call so repeated reads of the
 *  same cursor do not re-emit the same entries. */
export function consumeChangeLogSince(last) {
    let entries;
    if (last === undefined) {
        entries = _changeLog.slice();
        _changeLog.length = 0;
    }
    else {
        const cutoff = _changeLog.findIndex((e) => e.at > last);
        if (cutoff < 0) {
            entries = [];
        }
        else {
            entries = _changeLog.splice(cutoff);
        }
    }
    return entries;
}
/** Await every queued write-back; throw if one failed while waiting. */
export async function flush() {
    await saveChain;
    if (pendingPersistError) {
        const err = pendingPersistError;
        pendingPersistError = null;
        throw err;
    }
}
export function createCache() {
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
                if (ALLOW_FILE_SNAPSHOT) {
                    try {
                        saveToFile(currentDb);
                    }
                    catch { }
                }
                pendingPersistError = null;
            })
                .catch((err) => {
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
        _touchResource: (key) => {
            resourceDirty.add(key);
            recordChange(key);
        },
        _clearDirtyResource: (key) => {
            resourceDirty.delete(key);
        },
    };
}
// ---------------------------------------------------------------------------
// loader - populates the cache from Postgres at boot
// ---------------------------------------------------------------------------
/** Tables whose load succeeded (mirrored + stale-deleted on write-back). */
const loadedTables = new Set();
function parseJsonArray(value) {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function coerceRow(cols, raw) {
    const out = {};
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
export async function loadCache() {
    const cache = createCache();
    // Postgres is the mandatory source of truth. Do NOT load server/data/store.json
    // as authoritative state (it is stale/debug-only and previously caused mirror
    // deletes that wiped DB rows). Boot fails hard if Postgres is unavailable.
    try {
        columnMap = await fetchColumnMap();
        const cm = columnMap;
        const load = async (table) => {
            const cols = cm.get(table);
            if (!cols || cols.length === 0) {
                throw new Error(`Table ${table} not found in schema`);
            }
            const rows = await query(`SELECT * FROM ${table}`);
            loadedTables.add(table);
            return rows.map((r) => coerceRow(cols, r));
        };
        // customers + nested addresses/feedback
        cache.customers = (await load("customers")) ?? [];
        const addresses = (await load("customer_addresses")) ?? [];
        for (const c of cache.customers) {
            if (!Array.isArray(c.addresses))
                c.addresses = [];
        }
        for (const a of addresses) {
            const cust = cache.customers.find((c) => c.id === a.customerId);
            if (cust)
                cust.addresses.push(a);
        }
        for (const c of cache.customers) {
            if (typeof c.feedbackSummary === "string") {
                c.feedbackSummary = parseJsonArray(c.feedbackSummary);
            }
            else if (!Array.isArray(c.feedbackSummary)) {
                c.feedbackSummary = [];
            }
        }
        // One-shot status rename mapping (2026-10): rows persisted with the
        // retired order/delivery status names are translated at load time.
        const LEGACY_ORDER_STATUS = {
            OUT_FOR_DELIVERY: "IN_TRANSIT",
            AWAITING_PICKUP: "AWAITING_COLLECTION",
            COMPLETED: "COMPLETED_DELIVERED",
        };
        const LEGACY_DELIVERY_STATUS = {
            OUT_FOR_DELIVERY: "IN_TRANSIT",
            AWAITING_PICKUP: "AWAITING_COLLECTION",
            DELIVERED: "COMPLETED_DELIVERED",
        };
        // sales: orders + items, quotations + items
        cache.orders = (await load("orders")) ?? [];
        cache.orderItems = (await load("order_items")) ?? [];
        for (const o of cache.orders) {
            o.items = cache.orderItems.filter((i) => i.orderId === o.id);
            o.status = (LEGACY_ORDER_STATUS[o.status] ?? o.status);
            o.deliveryStatus = (LEGACY_DELIVERY_STATUS[o.deliveryStatus] ?? o.deliveryStatus);
        }
        cache.quotations = (await load("quotations")) ?? [];
        cache.quotationItems = (await load("quotation_items")) ?? [];
        for (const qte of cache.quotations) {
            qte.items = cache.quotationItems.filter((i) => i.quotationId === qte.id);
        }
        // inventory + derived physicalStock
        cache.inventoryItems = (await load("inventory_items")) ?? [];
        cache.inventoryTransactions = (await load("inventory_transactions")) ?? [];
        for (const item of cache.inventoryItems) {
            let total = 0;
            for (const t of cache.inventoryTransactions) {
                if (t.itemId === item.id)
                    total += mapNum(t.quantity);
            }
            item.physicalStock = total;
        }
        cache.stockReservations = (await load("stock_reservations")) ?? [];
        // catalogue (keyed by DTO field names via indexed access types)
        cache.catalogue.categories = (await load("catalogue_categories")) ?? [];
        cache.catalogue.types = (await load("product_types")) ?? [];
        cache.catalogue.products = (await load("products")) ?? [];
        for (const p of cache.catalogue.products) {
            if (!p.productId)
                p.productId = p.id;
            if (!p.categoryId)
                p.categoryId = "";
        }
        cache.catalogue.variants = (await load("product_variants")) ?? [];
        cache.catalogue.optionDefinitions = (await load("option_definitions")) ?? [];
        cache.catalogue.optionValues = (await load("option_values")) ?? [];
        // website content (blog + website users) — E2
        cache.blogCategories = (await load("blog_categories")) ?? [];
        cache.blogPosts = (await load("blog_posts")) ?? [];
        cache.websiteUsers = (await load("website_users")) ?? [];
        // purchasing
        cache.suppliers = (await load("suppliers")) ?? [];
        cache.productionFixedCostCategories = (await load("production_fixed_cost_categories")) ?? [];
        cache.productionFixedCostEntries = (await load("production_fixed_cost_entries")) ?? [];
        cache.purchaseOrders = (await load("purchase_orders")) ?? [];
        cache.poItems = (await load("purchase_order_items")) ?? [];
        for (const po of cache.purchaseOrders) {
            po.items = cache.poItems.filter((i) => i.purchaseOrderId === po.id);
        }
        cache.purchaseRequirements = (await load("purchase_requirements")) ?? [];
        cache.goodsReceipts = (await load("goods_receipts")) ?? [];
        cache.goodsReceiptItems = (await load("goods_receipt_items")) ?? [];
        for (const r of cache.goodsReceipts) {
            r.items = cache.goodsReceiptItems.filter((i) => i.goodsReceiptId === r.id);
        }
        cache.supplierPriceHistory = (await load("supplier_price_history")) ?? [];
        // production
        cache.productionJobs = (await load("production_jobs")) ?? [];
        cache.qualityChecks = (await load("quality_checks")) ?? [];
        cache.productionWastage = (await load("production_wastage")) ?? [];
        cache.productionConsumption = (await load("production_consumption")) ?? [];
        cache.productionCosts = (await load("production_costs")) ?? [];
        // comms / identity / finance / misc
        cache.customerInteractions = (await load("customer_interactions")) ?? [];
        cache.inquiries = (await load("inquiries")) ?? [];
        cache.payments = (await load("payments")) ?? [];
        cache.deliveries = (await load("deliveries")) ?? [];
        for (const d of cache.deliveries) {
            d.status = (LEGACY_DELIVERY_STATUS[d.status] ?? d.status);
        }
        cache.notifications = (await load("notifications")) ?? [];
        cache.notificationRecipients = (await load("notification_recipients")) ?? [];
        cache.notificationPreferences = (await load("notification_preferences")) ?? [];
        cache.notificationTemplates = (await load("notification_templates")) ?? [];
        cache.auditLogs = (await load("audit_logs")) ?? [];
        cache.users = (await load("users")) ?? [];
        cache.roles = (await load("roles")) ?? [];
        cache.permissions = (await load("permissions")) ?? [];
        cache.userRoles = (await load("user_roles")) ?? [];
        cache.rolePermissions = (await load("role_permissions")) ?? [];
        cache.orderStatusHistory = (await load("order_status_history")) ?? [];
        for (const h of cache.orderStatusHistory) {
            h.previousStatus = (LEGACY_ORDER_STATUS[h.previousStatus] ?? h.previousStatus);
            h.newStatus = (LEGACY_ORDER_STATUS[h.newStatus] ?? h.newStatus);
        }
        cache.customerFeedback = (await load("customer_feedback")) ?? [];
        cache.orderSnapshots = (await load("order_customer_snapshots")) ?? [];
        cache.customerEvents = (await load("customer_events")) ?? [];
        cache.customerEventReminders = (await load("customer_event_reminders")) ?? [];
        cache.expenses = (await load("expenses")) ?? [];
        cache.expenseCategories = (await load("expense_categories")) ?? [];
        // public order proposals (E6 §§29-30) — website order form submissions
        cache.orderProposals = (await load("order_proposals")) ?? [];
        cache.orderProposalItems = (await load("order_proposal_items")) ?? [];
        for (const p of cache.orderProposals) {
            p.items = cache.orderProposalItems.filter((i) => i.proposalId === p.id);
        }
        // E7 — staff & remuneration (governing doc §18): parents first, then
        // children keyed onto them. JSONB repayment_log stays a parsed array via
        // coerceRow's default branch.
        cache.staff = (await load("staff")) ?? [];
        cache.staffAttendance = (await load("staff_attendance")) ?? [];
        cache.salaryProfiles = (await load("salary_profiles")) ?? [];
        cache.remunerationPeriods = (await load("remuneration_periods")) ?? [];
        cache.remunerationItems = (await load("remuneration_items")) ?? [];
        cache.staffAdvances = (await load("staff_advances")) ?? [];
        for (const a of cache.staffAdvances) {
            if (!Array.isArray(a.repaymentLog))
                a.repaymentLog = [];
        }
        cache.remunerationPayments = (await load("remuneration_payments")) ?? [];
        cache.payslips = (await load("payslips")) ?? [];
        authoritativeLoad = true;
        currentDb = cache;
        logger.boot(`cache loaded from Postgres: ${cache.users.length} users, ${cache.customers.length} customers, ` +
            `${cache.orders.length} orders, ${cache.quotations.length} quotations, ` +
            `${cache.inventoryItems.length} inventory items, ${cache.catalogue.products.length} catalogue products, ` +
            `${cache.blogPosts.length} blog posts`);
    }
    catch (err) {
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
function serializeValue(value, type) {
    if (value === undefined || value === null)
        return value;
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
            if (typeof value === "object")
                return JSON.stringify(value);
            return value;
    }
}
async function persistTable(tx, table, cols, rows) {
    if (rows.length === 0)
        return;
    const byKey = new Map();
    for (const col of cols)
        byKey.set(col.camel, col);
    for (const row of rows) {
        const record = row;
        const entries = [];
        const values = [];
        const sets = [];
        let hasId = false;
        for (const [key, raw] of Object.entries(record)) {
            if (raw === undefined)
                continue;
            const col = byKey.get(key);
            if (!col)
                continue; // DTO-only/nested key (items, addresses, feedbackSummary, notify, currency)
            if (key === "id")
                hasId = true;
            entries.push(col.column);
            values.push(serializeValue(raw, col.type));
            if (key !== "id")
                sets.push(`${col.column} = EXCLUDED.${col.column}`);
        }
        if (!hasId || entries.length === 0)
            continue;
        const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
        const conflict = sets.length > 0
            ? `DO UPDATE SET ${sets.join(", ")}`
            : "DO NOTHING";
        await tx.query(`INSERT INTO ${table} (${entries.join(", ")}) VALUES (${placeholders}) ON CONFLICT (id) ${conflict}`, values);
    }
}
async function deleteStale(tx, table, rows) {
    const ids = rows
        .map((r) => r.id)
        .filter((id) => typeof id === "string" && id !== "");
    await tx.query(`DELETE FROM ${table} WHERE NOT (id = ANY($1))`, [ids]);
}
const MIRRORS = [
    { table: "catalogue_categories", rows: (c) => c.catalogue.categories },
    { table: "product_types", rows: (c) => c.catalogue.types },
    { table: "products", rows: (c) => c.catalogue.products },
    { table: "product_variants", rows: (c) => c.catalogue.variants },
    { table: "option_definitions", rows: (c) => c.catalogue.optionDefinitions },
    { table: "option_values", rows: (c) => c.catalogue.optionValues },
    { table: "customers", rows: (c) => c.customers },
    { table: "customer_addresses", rows: (c) => c.customers.flatMap((cu) => (Array.isArray(cu.addresses) ? cu.addresses : [])) },
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
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
    }
    catch { }
}
function saveToFile(cache) {
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
                if (!fs.existsSync(dir))
                    fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(p, JSON.stringify(data, null, 2));
            }
            catch { }
        }
    }
    catch (e) {
        logger.failure('store', 'file persist failed');
    }
}
function loadFromFile(cache) {
    try {
        if (!fs.existsSync(PERSIST_FILE))
            return false;
        const raw = fs.readFileSync(PERSIST_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (!data)
            return false;
        Object.keys(data).forEach(k => {
            if (cache[k] !== undefined && data[k] !== undefined) {
                cache[k] = data[k];
            }
        });
        // Rebuild nested refs
        for (const o of cache.orders) {
            o.items = cache.orderItems.filter((i) => i.orderId === o.id);
        }
        for (const q of cache.quotations) {
            q.items = cache.quotationItems.filter((i) => i.quotationId === q.id);
        }
        for (const po of cache.purchaseOrders) {
            po.items = cache.poItems.filter((i) => i.purchaseOrderId === po.id);
        }
        for (const r of cache.goodsReceipts) {
            r.items = cache.goodsReceiptItems.filter((i) => i.goodsReceiptId === r.id);
        }
        for (const p of cache.orderProposals) {
            p.items = cache.orderProposalItems.filter((i) => i.proposalId === p.id);
        }
        // Mark all tables as loaded for file fallback
        const allTables = ['customers', 'customer_interactions', 'inquiries', 'quotations', 'quotation_items', 'orders', 'order_items', 'order_status_history', 'payments', 'production_jobs', 'quality_checks', 'production_wastage', 'production_consumption', 'production_costs', 'inventory_items', 'inventory_transactions', 'stock_reservations', 'suppliers', 'production_fixed_cost_categories', 'production_fixed_cost_entries', 'purchase_orders', 'purchase_order_items', 'purchase_requirements', 'goods_receipts', 'goods_receipt_items', 'supplier_price_history', 'deliveries', 'expense_categories', 'expenses', 'notifications', 'notification_recipients', 'notification_preferences', 'notification_templates', 'audit_logs', 'users', 'roles', 'permissions', 'user_roles', 'role_permissions', 'customer_feedback', 'order_customer_snapshots', 'customer_events', 'customer_event_reminders', 'order_proposals', 'order_proposal_items', 'staff', 'staff_attendance', 'salary_profiles', 'remuneration_periods', 'remuneration_items', 'staff_advances', 'remuneration_payments', 'payslips', 'blog_categories', 'blog_posts', 'website_users', 'catalogue_categories', 'product_types', 'products', 'product_variants', 'option_definitions', 'option_values', 'customer_addresses'];
        allTables.forEach(t => loadedTables.add(t));
        loadedTables.add('catalogue_categories');
        loadedTables.add('products');
        return true;
    }
    catch (e) {
        return false;
    }
}
async function saveCache() {
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
            if (!loadedTables.has(m.table))
                continue;
            const cols = cm.get(m.table);
            if (!cols)
                continue;
            await persistTable(tx, m.table, cols, m.rows(currentDb));
        }
        for (let i = MIRRORS.length - 1; i >= 0; i--) {
            const m = MIRRORS[i];
            if (!loadedTables.has(m.table))
                continue;
            await deleteStale(tx, m.table, m.rows(currentDb));
        }
    });
}
// ---------------------------------------------------------------------------
// module state + exports
// ---------------------------------------------------------------------------
let currentDb = createCache();
export function getDb() {
    return currentDb;
}
export function resetStore() {
    currentDb = createCache();
    loadedTables.clear();
    resourceDirty.clear();
    _changeLog.length = 0;
}
export function dirtyKeys() {
    return resourceDirty;
}
export function clearDirtyResource(key) {
    resourceDirty.delete(key);
}
export function dirtyKeysSnapshot() {
    return new Set(resourceDirty);
}
export function markResourceDirty(...keys) {
    for (const k of keys) {
        resourceDirty.add(k);
        recordChange(k);
    }
}
export const ready = loadCache();
//# sourceMappingURL=index.new.js.map