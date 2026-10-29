/**
 * Typed client for the Twin Cakery ERP API (Express, server/index.ts).
 *
 * - `VITE_API_URL` (default `/api/v1`) is the base; the Vite dev server proxies
 *   `/api` to `http://localhost:4000` (see vite.config.ts).
 * - The token is persisted in localStorage and attached as a Bearer token.
 * - Read helpers degrade to `[]` on failure so the UI can fall back to bundled
 *   sample data instead of crashing.
 */

export const API_BASE = (import.meta.env?.["VITE_API_URL"] as string | undefined) ?? "/api/v1";
const TOKEN_KEY = "twin_cakery_token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/* ── Token storage ──────────────────────────────────────────────────────── */

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode / SSR) — non-fatal */
  }
}

/* ── Core request helper ────────────────────────────────────────────────── */

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  // Build the init object with only defined keys — required under
  // `exactOptionalPropertyTypes`, which forbids explicit `undefined` optionals.
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (signal !== undefined) init.signal = signal;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError("Network request failed", 0);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!res.ok) {
    const message =
      (payload as { error?: string; message?: string } | null)?.error ??
      (payload as { error?: string; message?: string } | null)?.message ??
      `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return payload as T;
}

/** Thin wrapper retained for backward compatibility with prior call sites. */
export function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = init?.headers as Record<string, string> | undefined;
  // Skip auto-attaching the Bearer token when the caller supplied its own
  // Authorization header.
  const auth = !(headers && "Authorization" in headers);
  const opts: RequestOptions = { auth };
  if (init?.method !== undefined) opts.method = init.method;
  if (init?.body !== undefined) opts.body = init.body;
  if (init?.signal != null) opts.signal = init.signal;
  return request<T>(path, opts);
}

/** Non-throwing wrapper: returns `fallback` when the request fails. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return fallback;
  }
}

/* ── Raw server shapes (server/database/types.ts) ───────────────────────── */

export interface ServerCustomer {
  id: string;
  name: string;
  phone: string;
  email: string;
  addresses: { label?: string; line1?: string; city?: string }[];
  preferredContactMethod: "email" | "phone" | "whatsapp";
  source: string;
  notes: string;
  status: "Active" | "Inactive" | "Blocked";
  totalOrders?: number;
  totalSpend?: number;
}

export interface ServerOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  items: { productId: string; variantOptions: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  taxAmount: number;
  total: number;
  requiredBy: string | null;
  requiredAt: string | null;
  notes: string;
  status: string;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PROCESSING" | "PAID" | "REFUNDED" | "OVERPAID";  deliveryStatus: string;
  createdBy: string;
  deliveredAt: string | null;
  /** Stamped when the post-delivery CRM follow-up has been done & documented. */
  followUpCompletedAt?: string | null;
  /** Bakery station workflow (plan: pendingConfirm → confirmed → baking → done). 
   *  Present once the backend writes station on orders; unknown order rows drop
   *  back to `undefined` so station-aware filtering degrades safely. */
  station?: "pendingConfirm" | "confirmed" | "baking" | "done" | undefined;
}
export interface ServerDelivery {
  id: string;
  orderId: string;
  type: string;
  destination: string;
  status: string;
  scheduledAt: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  actualDispatchTime: string | null;
  actualDeliveryDate: string | null;
  deliveryPerson: string | null;
  deliveryFee: number;
  notes: string;
  customerConfirmation: string | null;
}

export interface ServerProduct {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
}

export interface ServerAuditLog {
  id: string;
  orderId: string | null;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  previousStatus: string | null;
  newStatus: string | null;
  reason: string;
  timestamp: string;
}

export interface ServerUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  phone?: string;
  role: string;
  isAdmin: boolean;
  status: string;
}

export interface LoginResult {
  token: string;
  user: ServerUser;
}

/* ── Label maps: server enum → UI label ─────────────────────────────────── */

const ORDER_STATUS_LABELS: Record<string, string> = {
  INQUIRY: "Inquiry",
  QUOTATION: "Quotation",
  AWAITING_CONFIRMATION: "Pending confirmation",
  CONFIRMED: "Confirmed",
  PRODUCTION_REVIEW: "Production review",
  READY_FOR_PRODUCTION: "Ready for production",
  IN_PRODUCTION: "In production",
  QUALITY_CHECK: "Quality check",
  REWORK_REQUIRED: "Rework required",
  READY_FOR_DELIVERY: "Ready",
  AWAITING_COLLECTION: "Awaiting Collection",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Completed / Delivered",
  COMPLETED_DELIVERED: "Completed / Delivered",
  // Legacy enum values persisted before the 2026-10 status rename — rendered
  // with the new labels so old rows never surface the retired wording.
  OUT_FOR_DELIVERY: "In Transit",
  AWAITING_PICKUP: "Awaiting Collection",
  COMPLETED: "Completed / Delivered",
  INVOICED: "Invoiced",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partial",
  PROCESSING: "Processing",
  PAID: "Paid",
  REFUNDED: "Refunded",
  OVERPAID: "Overpaid",
};

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  READY_FOR_DISPATCH: "Ready for dispatch",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Completed / Delivered",
  // Current DeliveryStatus enum on the server (server/database/types.ts) —
  // same meaning as the legacy DELIVERED value the deliveries route writes.
  COMPLETED_DELIVERED: "Completed / Delivered",
  AWAITING_COLLECTION: "Awaiting Collection",
  PICKED_UP: "Picked up",
  FAILED: "Failed",
};

export function orderStatusLabel(v: string): string {
  return ORDER_STATUS_LABELS[v] ?? v;
}
export function paymentStatusLabel(v: string): string {
  return PAYMENT_STATUS_LABELS[v] ?? v;
}
export function deliveryStatusLabel(v: string): string {
  return DELIVERY_STATUS_LABELS[v] ?? v;
}

/* ── Reverse label → server enum (for status writes) ───────────────────── */

const ORDER_STATUS_ENUMS: Record<string, string> = {
  Inquiry: "INQUIRY",
  Quotation: "QUOTATION",
  "Pending confirmation": "AWAITING_CONFIRMATION",
  Confirmed: "CONFIRMED",
  "Production review": "PRODUCTION_REVIEW",
  "Ready for production": "READY_FOR_PRODUCTION",
  "In production": "IN_PRODUCTION",
  "Quality check": "QUALITY_CHECK",
  "Rework required": "REWORK_REQUIRED",
  Ready: "READY_FOR_DELIVERY",
  "Awaiting Collection": "AWAITING_COLLECTION",
  "In Transit": "IN_TRANSIT",
  "Completed / Delivered": "COMPLETED_DELIVERED",
  Invoiced: "INVOICED",
  Closed: "CLOSED",
  Cancelled: "CANCELLED",
};

export function orderStatusEnum(label: string): string {
  return ORDER_STATUS_ENUMS[label] ?? "AWAITING_CONFIRMATION";
}

const PAYMENT_STATUS_ENUMS: Record<string, string> = {
  Unpaid: "UNPAID",
  "Partially paid": "PARTIALLY_PAID",
  Partial: "PARTIALLY_PAID",
  Processing: "PROCESSING",
  Paid: "PAID",
  Refunded: "REFUNDED",
  Overpaid: "OVERPAID",
};

/** Reverse UI payment label → server enum (payment writes from the order modal). */
export function paymentStatusEnum(label: string): string {
  return PAYMENT_STATUS_ENUMS[label] ?? "UNPAID";
}

/* ── Server → UI order mapping ─────────────────────────────────────────── */

export interface UiOrder {
  id: string;
  customer: string;
  initials: string;
  product: string;
  options: string;
  date: string;
  time: string;
  amount: number;
  status: string;
  payment: string;
  delivery: string;
  channel: string;
  /** Post-delivery CRM follow-up: null/undefined = still pending on completed orders. */
  followUpCompletedAt?: string | null;
  /** Amount paid so far, summed from the server payment ledger — drives the
      resolved payment status and the outstanding balance. */
  paidAmount?: number;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return (first + second).toUpperCase() || "TC";
}

function splitDateTime(value: string | null | undefined): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
      time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
    };
  }
  const [date = "", time = ""] = String(value).split(/[ T]/);
  return { date, time };
}

export function toUiOrder(
  order: ServerOrder,
  customersById: Record<string, ServerCustomer>,
  productsById: Record<string, ServerProduct>,
  /** Sum of the server payment ledger for this order (bracketed "amount paid"). */
  paidAmount?: number,
): UiOrder {
  const customer = customersById[order.customerId]?.name ?? order.customerId;
  const item = order.items?.[0];
  const product = (item && productsById[item.productId]?.name) || "Custom order";
  const { date, time } = splitDateTime(order.requiredAt);
  const channel = (order.notes?.split(" · ").pop() || "Direct").trim();
  const statusLabel = orderStatusLabel(order.status);
  // Completed orders always read as delivered, even when the delivery record
  // still lags behind (the stage was moved from Sales, not the Deliveries
  // module). In-flight and Cancelled orders fall through to the delivery row.
  const delivery =
    statusLabel === "Completed / Delivered"
      ? "Completed / Delivered"
      : deliveryStatusLabel(order.deliveryStatus);
  const cappedPaid = paidAmount != null && paidAmount > 0 ? Math.min(order.total, paidAmount) : 0;
  return {
    id: order.orderNumber || order.id,
    customer,
    initials: initialsOf(customer),
    product,
    options: item?.variantOptions ?? "",
    date,
    time,
    amount: order.total,
    status: statusLabel,
    payment: paymentStatusLabel(order.paymentStatus),
    delivery,
    channel,
    followUpCompletedAt: order.followUpCompletedAt ?? null,
    ...(cappedPaid > 0 ? { paidAmount: cappedPaid } : {}),
  };
}

/* ── Endpoint helpers ──────────────────────────────────────────────────── */


export interface RegisterInput {
  username: string;
  displayName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role?: string;
  isAdmin?: boolean;
  registerCode: string;
}

export interface ClaimAdminInput {
  code: string;
  username: string;
  displayName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export async function register(payload: RegisterInput): Promise<LoginResult> {
  return request<LoginResult>("/auth/register", { method: "POST", body: payload });
}

export async function claimAdmin(payload: ClaimAdminInput): Promise<LoginResult> {
  const result = await request<LoginResult>("/auth/claim-admin", { method: "POST", body: payload });
  if (result.token) setToken(result.token);
  return result;
}

export async function resetCredentials(userId: string): Promise<{ userId: string; username: string; tempPassword: string }> {
  return request<{ userId: string; username: string; tempPassword: string }>("/auth/reset-credentials", {
    method: "POST",
    body: { userId },
  });
}


export async function login(username: string, password: string): Promise<LoginResult> {
  const result = await request<LoginResult & { permissions?: string[] }>("/auth/login", {
    method: "POST",
    body: { username, password },
    auth: false,
  });
  setToken(result.token);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await request("/auth/logout", { method: "POST" });
  } catch {
    /* network failure — still clear the local token */
  }
  setToken(null);
}

export async function me(): Promise<{ user: ServerUser; permissions: string[] } | null> {
  return safe<{ user: ServerUser; permissions: string[] } | null>(() => request("/auth/me"), null);
}

/** Whether the workspace already has registered staff accounts ("history").
 *  Used by the guest landing (App.tsx) to decide /login vs /signup.
 *
 *  Interim: GET /auth/user-count backfill is not in place yet, so a failed or
 *  unknown answer falls back to "history exists" (seeded admin). Once the
 *  user-count route is live, set hasHistory from its `hasHistory` field. */
export async function hasExistingUser(): Promise<boolean> {
  const res = await safe(() => request<{ hasHistory: boolean }>("/auth/user-count"), null);
  if (res === null) return true;
  return res.hasHistory === true;
}

export async function listCustomers(): Promise<ServerCustomer[]> {
  return safe(() => request<ServerCustomer[]>("/customers"), []);
}
export async function listProducts(): Promise<ServerProduct[]> {
  return safe(() => request<ServerProduct[]>("/catalogue/products"), []);
}
export async function listOrders(): Promise<ServerOrder[]> {
  return safe(() => request<ServerOrder[]>("/orders"), []);
}
export async function listAudit(limit = 100): Promise<ServerAuditLog[]> {
  return safe(() => request<ServerAuditLog[]>(`/rbac/audit?limit=${limit}`), []);
}

export async function createOrderApi(payload: Record<string, unknown>): Promise<ServerOrder | null> {
  return safe(() => request<ServerOrder>("/orders", { method: "POST", body: payload }), null);
}
export async function updateOrderApi(id: string, patch: Record<string, unknown>): Promise<ServerOrder | null> {
  return safe(() => request<ServerOrder>(`/orders/${id}`, { method: "PATCH", body: patch }), null);
}
export async function findCustomerByName(name: string): Promise<ServerCustomer | null> {
  const list = await safe(() => request<ServerCustomer[]>(`/customers?name=${encodeURIComponent(name)}`), []);
  return list[0] ?? null;
}
export async function createCustomerApi(name: string, phone?: string): Promise<ServerCustomer | null> {
  // Phone is optional here so callers that only know a name still work; the
  // new-order dialog always passes it for customers outside the CRM list.
  return safe(() => request<ServerCustomer>("/customers", { method: "POST", body: { name, ...(phone ? { phone } : {}) } }), null);
}
export async function findProductByName(name: string): Promise<ServerProduct | null> {
  const list = await safe(() => request<ServerProduct[]>(`/catalogue/products?name=${encodeURIComponent(name)}`), []);
  return list[0] ?? null;
}

/* ── E1: Customer order history, occasions & recurring event reminders ── */

/** Immutable contact snapshot frozen onto an order at creation (rule 27 — never rewritten). */
export interface OrderSnapshot {
  snapshotName: string;
  snapshotPhone?: string | null;
  snapshotEmail?: string | null;
  snapshotAddress?: string | null;
  [key: string]: unknown;
}

/** Order history row: a full order plus its immutable contact snapshot. */
export type ServerCustomerOrder = ServerOrder & { snapshot: OrderSnapshot | null };

/** Single row of the printable order-history list (spec §5). */
export interface ServerOrderPrintRow {
  orderId: string;
  orderNumber: string;
  date: string;
  status: string;
  total: number;
  snapshotName: string;
}

/** Response of `GET /customers/:id/order-history/print`. */
export interface CustomerOrderHistoryPrint {
  customer: { id: string; name: string };
  printedAt: string;
  orders: ServerOrderPrintRow[];
}

/** A customer occasion (birthday, anniversary, …) with its recurrence rule. */
export interface ServerCustomerEvent {
  id: string;
  customerId: string;
  eventType: string;
  eventDate: string;
  recurrenceRule: "NONE" | "ANNUAL" | "MONTHLY" | "YEARLY";
  orderId?: string | null;
  notes?: string;
  status: "ACTIVE" | "ARCHIVED";
  createdBy?: string;
  [key: string]: unknown;
}

/** An internal reminder for a future occurrence. The system NEVER auto-contacts —
 *  only a human advancing it via `contactEventReminder` / `dismissEventReminder` moves its status. */
export interface ServerEventReminder {
  id: string;
  customerId: string;
  eventId: string;
  eventType: string;
  nextReminderAt: string;
  status: "PENDING" | "REMINDED" | "CONTACTED" | "DISMISSED";
  contactedBy?: string;
  outcome?: string;
  followUpNotes?: string;
  customerName?: string;
  customerPhone?: string;
  [key: string]: unknown;
}

/** GET /customers/:id/orders — order history, most recent first, each with its immutable contact snapshot. */
export function listCustomerOrders(customerId: string): Promise<ServerCustomerOrder[]> {
  return safe(() => request<ServerCustomerOrder[]>(`/customers/${customerId}/orders`), []);
}

/** GET /customers/:id/order-history/print — printable order-history list (spec §5). */
export function printCustomerOrders(customerId: string): Promise<CustomerOrderHistoryPrint | null> {
  return safe(() => request<CustomerOrderHistoryPrint>(`/customers/${customerId}/order-history/print`), null);
}

/** GET /customers/:id/events — occasions (with recurrence), soonest event date first. */
export function listCustomerEvents(customerId: string): Promise<ServerCustomerEvent[]> {
  return safe(() => request<ServerCustomerEvent[]>(`/customers/${customerId}/events`), []);
}

/** POST /customers/:id/events — add an occasion; its recurring reminder is scheduled automatically. */
export function createCustomerEvent(
  customerId: string,
  payload: {
    eventType: string;
    eventDate: string;
    recurrenceRule?: string;
    orderId?: string | null;
    notes?: string;
  },
): Promise<ServerCustomerEvent | null> {
  return safe(() => request<ServerCustomerEvent>(`/customers/${customerId}/events`, { method: "POST", body: payload }), null);
}

/** PATCH /customers/:id/events/:eventId — edit an occasion (re-schedules its reminder). */
export function updateCustomerEvent(
  customerId: string,
  eventId: string,
  patch: Partial<{ eventType: string; eventDate: string; recurrenceRule: string; orderId: string | null; notes: string }>,
): Promise<ServerCustomerEvent | null> {
  return safe(() => request<ServerCustomerEvent>(`/customers/${customerId}/events/${eventId}`, { method: "PATCH", body: patch }), null);
}

/** DELETE /customers/:id/events/:eventId — remove an occasion and its pending reminder. */
export async function deleteCustomerEvent(customerId: string, eventId: string): Promise<boolean> {
  return safe(() => request<void>(`/customers/${customerId}/events/${eventId}`, { method: "DELETE" }).then(() => true), false);
}

/** GET /customer-reminders — reminders due within `days` (default 30, max 365), most urgent first. */
export function listEventReminders(days = 30): Promise<ServerEventReminder[]> {
  return safe(() => request<ServerEventReminder[]>(`/customer-reminders?days=${days}`), []);
}

/** PATCH /customer-reminders/:id/contacted — staff acted; records outcome and rolls to the next occurrence. */
export function contactEventReminder(
  id: string,
  payload: { outcome?: string; followUpNotes?: string },
): Promise<ServerEventReminder | null> {
  return safe(() => request<ServerEventReminder>(`/customer-reminders/${id}/contacted`, { method: "PATCH", body: payload }), null);
}

/** PATCH /customer-reminders/:id/dismiss — close this occurrence with no follow-up. */
export function dismissEventReminder(id: string): Promise<ServerEventReminder | null> {
  return safe(() => request<ServerEventReminder>(`/customer-reminders/${id}/dismiss`, { method: "PATCH" }), null);
}

/* ── E2: Site Management — blog + website users ──────────────────────────── */

export interface ServerBlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServerBlogPost {
  id: string;
  categoryId: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImage: string;
  author: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Website account (never carries a password hash — the API strips it). */
export interface ServerWebsiteUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "CUSTOMER" | "SITE_ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  customerId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- blog categories ----
export function listBlogCategories(): Promise<ServerBlogCategory[]> {
  return safe(() => request<ServerBlogCategory[]>("/content/blog/categories"), []);
}
export function createBlogCategory(payload: { name: string; description?: string; displayOrder?: number }): Promise<ServerBlogCategory | null> {
  return safe(() => request<ServerBlogCategory>("/content/blog/categories", { method: "POST", body: payload }), null);
}
export function updateBlogCategory(id: string, patch: Partial<ServerBlogCategory>): Promise<ServerBlogCategory | null> {
  return safe(() => request<ServerBlogCategory>(`/content/blog/categories/${id}`, { method: "PATCH", body: patch }), null);
}
export function deleteBlogCategory(id: string): Promise<boolean> {
  return safe(() => request<void>(`/content/blog/categories/${id}`, { method: "DELETE" }).then(() => true), false);
}

// ---- blog posts ----
export function listBlogPosts(): Promise<ServerBlogPost[]> {
  return safe(() => request<ServerBlogPost[]>("/content/blog/posts"), []);
}
export function createBlogPost(payload: Partial<ServerBlogPost>): Promise<ServerBlogPost | null> {
  return safe(() => request<ServerBlogPost>("/content/blog/posts", { method: "POST", body: payload }), null);
}
export function updateBlogPost(id: string, patch: Partial<ServerBlogPost>): Promise<ServerBlogPost | null> {
  return safe(() => request<ServerBlogPost>(`/content/blog/posts/${id}`, { method: "PATCH", body: patch }), null);
}
export function deleteBlogPost(id: string): Promise<boolean> {
  return safe(() => request<void>(`/content/blog/posts/${id}`, { method: "DELETE" }).then(() => true), false);
}

// ---- website users ----
export function listWebsiteUsers(): Promise<ServerWebsiteUser[]> {
  return safe(() => request<ServerWebsiteUser[]>("/content/website-users"), []);
}
export function createWebsiteUser(payload: { name: string; email: string; password?: string; role?: string; phone?: string }): Promise<ServerWebsiteUser | null> {
  return safe(() => request<ServerWebsiteUser>("/content/website-users", { method: "POST", body: payload }), null);
}
export function updateWebsiteUser(id: string, patch: Partial<ServerWebsiteUser> & { password?: string }): Promise<ServerWebsiteUser | null> {
  return safe(() => request<ServerWebsiteUser>(`/content/website-users/${id}`, { method: "PATCH", body: patch }), null);
}
export function deleteWebsiteUser(id: string): Promise<boolean> {
  return safe(() => request<void>(`/content/website-users/${id}`, { method: "DELETE" }).then(() => true), false);
}

/* ── Catalogue (E2: source of the website's "Our Cakes" page) ─────────────── */
// Live product/category management. Writes here hit the RBAC-guarded
// /catalogue routes (catalogue.create/edit/archive); the public website reads
// the published subset via GET /api/v1/public/catalogue on its next sync.

export interface ServerCatalogueCategory {
  id: string;
  name: string;
  code: string;
  description: string;
  displayOrder: number;
  active: boolean;
  catalogueVisible: boolean;
}

export interface ServerCatalogueType {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  displayOrder: number;
  active: boolean;
  catalogueVisible: boolean;
}

export interface ServerCatalogueProduct {
  id: string;
  sku: string;
  categoryId: string;
  name: string;
  description: string;
  basePrice: number;
  costReference: string;
  catalogueVisible: boolean;
  productionEnabled: boolean;
  image: string;
  active: boolean;
  archived: boolean;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CatalogueProductInput {
  sku: string;
  categoryId: string;
  name: string;
  description?: string;
  basePrice?: number;
  image?: string;
  catalogueVisible?: boolean;
  productionEnabled?: boolean;
  notes?: string;
}

export async function listCatalogueCategories(): Promise<ServerCatalogueCategory[]> {
  return safe(() => request<ServerCatalogueCategory[]>("/catalogue/categories"), []);
}
export async function listCatalogueTypes(): Promise<ServerCatalogueType[]> {
  return safe(() => request<ServerCatalogueType[]>("/catalogue/types"), []);
}
/** Full catalogue rows (all visibility states) — richer than `listProducts`. */
export async function listCatalogueProducts(): Promise<ServerCatalogueProduct[]> {
  return safe(() => request<ServerCatalogueProduct[]>("/catalogue/products"), []);
}

export function createProductApi(payload: CatalogueProductInput): Promise<ServerCatalogueProduct | null> {
  return safe(() => request<ServerCatalogueProduct>("/catalogue/products", { method: "POST", body: payload }), null);
}
export function updateProductApi(
  id: string,
  patch: Partial<Omit<CatalogueProductInput, "sku">> & { active?: boolean; archived?: boolean },
): Promise<ServerCatalogueProduct | null> {
  return safe(() => request<ServerCatalogueProduct>(`/catalogue/products/${id}`, { method: "PATCH", body: patch }), null);
}
export function archiveProductApi(id: string): Promise<ServerCatalogueProduct | null> {
  return safe(() => request<ServerCatalogueProduct>(`/catalogue/products/${id}/archive`, { method: "POST" }), null);
}

/* ── E3: Production — jobs, QC, wastage, costs, consumption ─────────────── */
// Live production board. Reads hit the RBAC-guarded /production routes
// (production.view); the action buttons require production.start / .complete /
// .quality_check / .record_wastage. Every mutation persists to Postgres and is
// reflected on the next refresh.

export interface ServerProductionJob {
  id: string;
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
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerQualityCheck {
  id: string;
  jobId: string;
  checkedBy: string;
  checkedAt: string;
  issues: string;
  notes: string;
  reworkRequired: boolean;
  reworkCost: number;
  wastageCaused: number;
  createdAt: string;
  updatedAt: string;
}

export async function confirmOrderApi(id: string): Promise<{ order: ServerOrder; history: unknown; job?: ServerProductionJob } | null> {
  return safe(() => request<{ order: ServerOrder; history: unknown; job?: ServerProductionJob }>(`/orders/${id}/confirm`, { method: "POST" }), null);
}

/** POST /production/jobs — create a job for an order (requires production.schedule). */
export function createProductionJob(orderId: string): Promise<ServerProductionJob | null> {
  return safe(() => request<ServerProductionJob>(`/production/jobs`, { method: "POST", body: { orderId } }), null);
}

/** Bakery station workflow endpoints (plan Phase 1). 
 *  Today the backend for these routes is not present in this repo, so each
 *  degrades to `null` / no-op and the UI stays on bundled sample data. */
export function updateOrderStation(orderId: string, station: "pendingConfirm" | "confirmed" | "baking" | "done"): Promise<ServerOrder | null> {
  return safe(() => request<ServerOrder>(`/orders/${orderId}/station`, { method: "PATCH", body: { station } }), null);
}

export function createProductionJobForOrder(orderId: string): Promise<ServerProductionJob | null> {
  return safe(() => request<ServerProductionJob>(`/orders/${orderId}/production-job`, { method: "POST", body: { orderId } }), null);
}

/** After a baking-station transition, sync the order's global status. */
export function propagateBakingStatus(orderId: string): Promise<ServerOrder | null> {
  return safe(() => request<ServerOrder>(`/orders/${orderId}/propagate-baking`, { method: "POST" }), null);
}

export function listProductionJobs(): Promise<ServerProductionJob[]> {
  return safe(() => request<ServerProductionJob[]>("/production/jobs"), []);
}

export function getProductionJob(id: string): Promise<ServerProductionJob | null> {
  return safe(() => request<ServerProductionJob>(`/production/jobs/${id}`), null);
}

export function startProductionJob(id: string): Promise<ServerProductionJob | null> {
  return safe(() => request<ServerProductionJob>(`/production/jobs/${id}/start`, { method: "POST" }), null);
}

export function completeProductionJob(id: string): Promise<ServerProductionJob | null> {
  return safe(() => request<ServerProductionJob>(`/production/jobs/${id}/complete`, { method: "POST" }), null);
}

export function recordQualityCheck(
  id: string,
  payload: { result: "PASS" | "FAIL"; issues?: string; notes?: string; reworkRequired?: boolean; reworkCost?: number; wastageCaused?: number },
): Promise<{ job: ServerProductionJob; check: ServerQualityCheck } | null> {
  return safe(() => request<{ job: ServerProductionJob; check: ServerQualityCheck }>(`/production/jobs/${id}/quality-check`, { method: "POST", body: payload }), null);
}

export function recordProductionWastage(
  id: string,
  payload: { itemId: string; quantity: number; unit?: string; reason?: string; cost?: number },
): Promise<boolean> {
  return safe(() => request<{ ok: boolean }>(`/production/jobs/${id}/wastage`, { method: "POST", body: payload }).then((r) => Boolean(r?.ok)), false);
}

export function getProductionCosts(id: string): Promise<ServerProductionCost[]> {
  return safe(() => request<{ costs: ServerProductionCost[] }>(`/production/jobs/${id}/costs`).then((r) => r?.costs ?? []), []);
}

export function getProductionConsumption(id: string): Promise<ServerProductionConsumption[]> {
  return safe(() => request<{ consumption: ServerProductionConsumption[] }>(`/production/jobs/${id}/consumption`).then((r) => r?.consumption ?? []), []);
}

export interface ServerDeliveryCompletion {
  delivery: ServerDelivery;
  /** The order after delivery completion — carries the derived paymentStatus. */
  order: ServerOrder | null;
}

/** POST /deliveries/:id/complete — mark a delivery delivered. The server also
 * settles the order's outstanding Cash-on-Delivery balance (spec §14) so the
 * returned `order.paymentStatus` reads "PAID" once the balance is covered. */
export function completeDelivery(id: string): Promise<ServerDeliveryCompletion | null> {
  return safe(() => request<ServerDeliveryCompletion>(`/deliveries/${id}/complete`, { method: "POST" }), null);
}

export interface ServerMaterialInput {
  itemId: string;
  quantity: number;
  notes?: string | undefined;
}

/** POST /production/jobs/:id/materials — deduct used materials from inventory. */
export function recordJobMaterials(id: string, items: ServerMaterialInput[]): Promise<ServerProductionConsumption[] | null> {
  return safe(
    () => request<{ consumption: ServerProductionConsumption[] }>(`/production/jobs/${id}/materials`, { method: "POST", body: { items } }).then((r) => r?.consumption ?? []),
    null,
  );
}

export interface ServerProductionCost {
  id: string;
  jobId: string;
  ingredientCost: number;
  packagingCost: number;
  labourCost: number;
  overheadCost: number;
  total: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerProductionConsumption {
  id: string;
  jobId: string;
  itemId: string;
  quantity: number;
  unit: string;
  recipeVersion: string;
  unitCost: number;
  actualCost: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/* ── E3: Inventory ledger + purchasing receive ───────────────────────────── */

export interface ServerInventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  physicalStock: number;
  reorderLevel: number;
  cost: number;
  availableStock?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServerInventoryTransaction {
  id: string;
  itemId: string;
  quantity: number;
  unit: string;
  type: string;
  reference: string;
  unitCost: number;
  notes: string;
  recordedBy: string;
  createdAt: string;
}

export function listInventoryItems(): Promise<ServerInventoryItem[]> {
  return safe(() => request<ServerInventoryItem[]>("/inventory"), []);
}

export function createInventoryItem(input: Partial<ServerInventoryItem> & { name: string }): Promise<ServerInventoryItem | null> {
  return safe(() => request<ServerInventoryItem>("/inventory", { method: "POST", body: input }), null);
}

export function getInventoryLedger(itemId?: string, limit?: number): Promise<ServerInventoryTransaction[]> {
  const qs = new URLSearchParams();
  if (itemId) qs.set("itemId", itemId);
  if (limit) qs.set("limit", String(limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return safe(() => request<{ count: number; transactions: ServerInventoryTransaction[] }>(`/inventory/ledger${suffix}`).then((r) => r?.transactions ?? []), []);
}

export interface ServerInventoryAlert extends ServerInventoryItem {
  status: "Low stock" | "Out of stock";
  shortfall: number;
}

export function listInventoryAlerts(): Promise<ServerInventoryAlert[]> {
  return safe(() => request<{ count: number; alerts: ServerInventoryAlert[] }>("/inventory/alerts").then((r) => r?.alerts ?? []), []);
}




export interface ServerInventoryAdjustmentInput {
  itemId: string;
  quantity: number;
  unit?: string;
  type?: string;
  reference?: string;
  unitCost?: number;
  notes?: string;
}

export function adjustInventory(input: ServerInventoryAdjustmentInput): Promise<ServerInventoryTransaction | null> {
  return safe(() => request<ServerInventoryTransaction>("/inventory/adjustments", { method: "POST", body: input }), null);
}

export interface ServerPurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  receivedQuantity: number;
}

export interface ServerPurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  date: string;
  expectedDate: string;
  items: ServerPurchaseOrderItem[];
  total: number;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "PARTIALLY_RECEIVED" | "COMPLETED" | "CANCELLED";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export function listPurchaseOrders(status?: string): Promise<ServerPurchaseOrder[]> {
  return safe(() => request<ServerPurchaseOrder[]>(`/purchasing/orders${status ? `?status=${encodeURIComponent(status)}` : ""}`), []);
}

export interface ServerGoodsReceiptItem {
  id: string;
  goodsReceiptId: string;
  poItemId: string;
  quantity: number;
  unit: string;
  unitCost: number;
  status: string;
  createdAt: string;
}

export interface ServerGoodsReceipt {
  id: string;
  purchaseOrderId: string;
  receivedBy: string;
  date: string;
  total: number;
  status: string;
  items?: ServerGoodsReceiptItem[];
}

export function receivePurchaseOrder(poId: string): Promise<{ purchaseOrder: ServerPurchaseOrder; receipt: ServerGoodsReceipt } | null> {
  return safe(() => request<{ purchaseOrder: ServerPurchaseOrder; receipt: ServerGoodsReceipt }>(`/purchasing/orders/${encodeURIComponent(poId)}/receive`, { method: "POST" }), null);
}

export function listGoodsReceipts(): Promise<ServerGoodsReceipt[]> {
  return safe(() => request<ServerGoodsReceipt[]>("/purchasing/receipts"), []);
}

export interface ServerSupplier {
  id: string;
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

export function listSuppliers(): Promise<ServerSupplier[]> {
  return safe(() => request<ServerSupplier[]>("/purchasing/suppliers"), []);
}

export interface ServerSupplierPriceRow {
  id: string;
  supplierId: string;
  productId: string;
  unit: string;
  price: number;
  effectiveDate: string;
  note: string;
}

export function listSupplierPriceHistory(filter?: { supplierId?: string; productId?: string }): Promise<ServerSupplierPriceRow[]> {
  const qs = new URLSearchParams();
  if (filter?.supplierId) qs.set("supplierId", filter.supplierId);
  if (filter?.productId) qs.set("productId", filter.productId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return safe(() => request<ServerSupplierPriceRow[]>(`/purchasing/price-history${suffix}`), []);
}

/* ── E3: shortage → purchase requirement → PO loop ───────────────────────── */

export interface ServerPurchaseRequirement {
  id: string;
  productIds: string;
  quantity: number;
  unit: string;
  reason: string;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "ACKNOWLEDGED" | "ORDERED" | "RECEIVED" | "RESOLVED";
  requestedBy: string;
  requestedAt: string;
  createdAt: string;
  updatedAt: string;
}

export function listPurchaseRequirements(status?: string): Promise<ServerPurchaseRequirement[]> {
  return safe(() => request<ServerPurchaseRequirement[]>(`/purchasing${status ? `?status=${encodeURIComponent(status)}` : ""}`), []);
}

export interface ServerPurchaseRequirementInput {
  productIds: string[];
  quantity: number;
  unit?: string;
  reason?: string;
  urgency?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  requestedBy?: string;
}

export function createPurchaseRequirement(input: ServerPurchaseRequirementInput): Promise<ServerPurchaseRequirement | null> {
  return safe(() => request<ServerPurchaseRequirement>("/purchasing", { method: "POST", body: input }), null);
}

export function acknowledgePurchaseRequirement(id: string): Promise<ServerPurchaseRequirement | null> {
  return safe(() => request<ServerPurchaseRequirement>(`/purchasing/${encodeURIComponent(id)}/acknowledge`, { method: "POST" }), null);
}

export interface ServerPurchaseOrderInput {
  supplierId: string;
  expectedDate?: string;
  notes?: string;
  items: { productId: string; quantity: number; unit?: string; unitPrice: number }[];
}

export function createPurchaseOrder(input: ServerPurchaseOrderInput): Promise<ServerPurchaseOrder | null> {
  return safe(() => request<ServerPurchaseOrder>("/purchasing/orders", { method: "POST", body: input }), null);
}


/* -- E4: finance / payments / expenses / deliveries / notifications (client) --

The store's MemoryStore is the source of truth for these records; these hooks
are the typed front door to the Express routes. All mutating calls degrade to
null/falsy fallbacks so the UI can fall back to sample data when offline.
*/

export type PaymentMethod = "Cash" | "M-Pesa" | "Card" | "Bank transfer" | "Cheque";
export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type NotificationChannel_ = "IN_APP" | "WHATSAPP" | "EMAIL" | "SMS";

export interface ServerPayment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  reference: string;
  receivedBy: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerExpenseCategory {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerExpense {
  id: string;
  categoryId: string;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  reference: string;
  description: string;
  attachment: string | null;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerNotification {
  id: string;
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

export interface ServerNotificationPreference {
  id: string;
  userId: string;
  eventTypeId: string;
  channel: NotificationChannel_;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/* -- E4: payments ---------------------------------------------------------- */

export async function listPayments(orderId?: string): Promise<ServerPayment[]> {
  const q = orderId ? `?orderId=${encodeURIComponent(orderId)}` : "";
  return safe(() => request<ServerPayment[]>(`/payments${q}`), []);
}

export async function recordPayment(payload: {
  orderId: string;
  amount: number;
  method?: string;
  reference?: string;
  receivedBy?: string;
  notes?: string;
}): Promise<ServerPayment & { stagedPush: Record<string, unknown> | null } | null> {
  return safe(() =>
    request<ServerPayment & { stagedPush: Record<string, unknown> | null }>("/payments", { method: "POST", body: payload }),
    null,
  );
}

export async function recordPaymentCallback(paymentId: string, payload: {
  resultCode: number;
  resultDesc?: string;
  merchantRequestID?: string;
  checkoutRequestID?: string;
  amount?: number;
  orderId?: string;
  billRefNumber?: string;
}): Promise<{ ok: boolean; payment: ServerPayment & { status: string } } | null> {
  return safe(() =>
    request<{ ok: boolean; payment: ServerPayment & { status: string } }>(`/payments/${paymentId}/callback`, { method: "POST", body: payload }),
    null,
  );
}

/* -- E4: expenses + categories ---------------------------------------------- */

export async function listExpenses(category?: string): Promise<ServerExpense[]> {
  const q = category ? `?category=${encodeURIComponent(category)}` : "";
  return safe(() => request<ServerExpense[]>(`/expenses${q}`), []);
}

export async function listExpenseCategories(q?: string): Promise<ServerExpenseCategory[]> {
  const query = q ? `?name=${encodeURIComponent(q)}` : "";
  return safe(() => request<ServerExpenseCategory[]>(`/expense-categories${query}`), []);
}

export async function getExpense(id: string): Promise<ServerExpense | null> {
  return safe(() => request<ServerExpense>(`/expenses/${id}`), null);
}

export async function createExpense(payload: {
  categoryId: string;
  amount: number;
  date?: string;
  paymentMethod?: string;
  reference?: string;
  description?: string;
  attachment?: string | null;
  recordedBy?: string;
}): Promise<ServerExpense | null> {
  return safe(() => request<ServerExpense>("/expenses", { method: "POST", body: payload }), null);
}

export async function updateExpense(
  id: string,
  payload: Partial<Pick<ServerExpense, "amount" | "date" | "paymentMethod" | "reference" | "description" | "attachment" | "recordedBy">>,
): Promise<ServerExpense | null> {
  return safe(() => request<ServerExpense>(`/expenses/${id}`, { method: "PATCH", body: payload }), null);
}

export async function deleteExpense(id: string): Promise<{ ok: boolean } | null> {
  return safe(() => request<{ ok: boolean }>(`/expenses/${id}`, { method: "DELETE" }), null);
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

export async function listFinanceReports(period = "month"): Promise<FinanceReport | null> {
  const q = period ? `?period=${encodeURIComponent(period)}` : "";
  return safe(() => request<FinanceReport>(`/finance/reports${q}`), null);
}

export async function createExpenseCategory(name: string): Promise<ServerExpenseCategory | null> {
  return safe(() => request<ServerExpenseCategory>("/expense-categories", { method: "POST", body: { name } }), null);
}


/* -- E4: deliveries --------------------------------------------------------- */

export async function listDeliveries(status?: string): Promise<ServerDelivery[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return safe(() => request<ServerDelivery[]>(`/deliveries${q}`), []);
}

export async function getDelivery(id: string): Promise<ServerDelivery | null> {
  return safe(() => request<ServerDelivery>(`/deliveries/${id}`), null);
}

export async function createDelivery(payload: {
  orderId: string;
  type?: string;
  destination: string;
  scheduledAt?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  actualDispatchTime?: string | null;
  actualDeliveryDate?: string | null;
  deliveryPerson?: string | null;
  deliveryFee?: number;
  status?: string;
  notes?: string;
  customerConfirmation?: string | null;
}): Promise<ServerDelivery | null> {
  return safe(() => request<ServerDelivery>("/deliveries", { method: "POST", body: payload }), null);
}

export async function updateDelivery(
  id: string,
  payload: Partial<Pick<ServerDelivery, "status" | "notes" | "scheduledAt" | "scheduledDate" | "scheduledTime" | "actualDispatchTime" | "actualDeliveryDate" | "deliveryPerson" | "deliveryFee" | "customerConfirmation" | "type">>,
): Promise<ServerDelivery | null> {
  return safe(() => request<ServerDelivery>(`/deliveries/${id}`, { method: "PATCH", body: payload }), null);
}


import type { OrderProposal, OrderProposalStatus } from "./types";

/* -- E6: public order proposals (staff review) ------------------------------ */

/** GET /order-proposals (public, staff review) */
export async function listOrderProposals(): Promise<OrderProposal[]> {
  return safe(() => request<OrderProposal[]>('/order-proposals'), []);
}

/** GET /order-proposals/:id */
export async function getOrderProposal(id: string): Promise<OrderProposal | null> {
  return safe(() => request<OrderProposal>(`/order-proposals/${encodeURIComponent(id)}`), null);
}

/** POST /order-proposals/:id/confirm (staff review action) — responds { proposal, order }. */
export async function confirmOrderProposal(
  id: string,
  reviewNotes?: string,
): Promise<{ proposal: OrderProposal; order: unknown } | null> {
  const body = reviewNotes !== undefined ? { reviewNotes } : undefined;
  return safe(
    () => request<{ proposal: OrderProposal; order: unknown }>(`/order-proposals/${encodeURIComponent(id)}/confirm`, { method: 'POST', body }),
    null,
  );
}

/** POST /order-proposals/:id/cancel (staff review action) */
export async function cancelOrderProposal(id: string, reviewNotes?: string): Promise<OrderProposal | null> {
  const body = reviewNotes !== undefined ? { reviewNotes } : undefined;
  return safe(() => request<OrderProposal>(`/order-proposals/${encodeURIComponent(id)}/cancel`, { method: 'POST', body }), null);
}



export async function dispatchDelivery(id: string): Promise<ServerDelivery | null> {
  return safe(() => request<ServerDelivery>(`/deliveries/${id}/dispatch`, { method: "POST" }), null);
}

export async function cancelDelivery(id: string): Promise<ServerDelivery | null> {
  return safe(() => request<ServerDelivery>(`/deliveries/${id}/cancel`, { method: "POST" }), null);
}

/* -- E4: notifications ------------------------------------------------------ */

export async function listNotifications(limit = 50): Promise<ServerNotification[]> {
  return safe(() => request<ServerNotification[]>(`/notifications?limit=${limit}`), []);
}

export async function markAsRead(notificationId: string, userId?: string): Promise<boolean> {
  const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  // Server route is PATCH /notifications/:id/read → { ok: true }.
  return safe(async () => {
    const r = await request<{ ok: boolean }>(`/notifications/${notificationId}/read${q}`, { method: "PATCH" });
    return r?.ok === true;
  }, false);
}

export async function markAllAsRead(userId?: string): Promise<number> {
  const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  // Server route is POST /notifications/mark-all-read → { ok, count }.
  return safe(async () => {
    const r = await request<{ ok: boolean; count: number }>(`/notifications/mark-all-read${q}`, { method: "POST" });
    return r?.count ?? 0;
  }, 0);
}

export async function getUnreadCount(userId?: string): Promise<number> {
  const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  // Server responds { count } — unwrap it (a raw object would break `> 0`).
  return safe(async () => {
    const r = await request<number | { count: number }>(`/notifications/unread-count${q}`);
    return typeof r === "number" ? r : (r?.count ?? 0);
  }, 0);
}

export async function getNotificationPreferences(userId?: string): Promise<ServerNotificationPreference[]> {
  const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  return safe(() => request<ServerNotificationPreference[]>(`/notifications/preferences${q}`), []);
}

export async function updateNotificationPreferences(
  userId: string,
  payload: { eventTypeId: string; channel: string; enabled: boolean },
): Promise<ServerNotificationPreference | null> {
  return safe(() =>
    request<ServerNotificationPreference>("/notifications/preferences", { method: "PATCH", body: { userId, eventTypeId: payload.eventTypeId, channel: payload.channel } }),
    null,
  );
}

/* -- E4/E5: live analytics dashboards ------------------------------------ */

export interface ServerDashboardAnalytics {
  metrics: {
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
  };
  revenueTrend: number[];
  expensesTrend: number[];
  trendLabels: string[];
  orderStatusBreakdown: Record<string, number>;
  productionSummary: Array<{ jobId: string; status: string; stage: string; progress: number; quantity: number }>;
  inventorySummary: Array<{ itemId: string; name: string; availableStock: number; lowStock: boolean }>;
}

export interface ServerSalesAnalytics {
  inquiries: number;
  lostInquiries: number;
  quotations: number;
  acceptedQuotations: number;
  confirmedOrders: number;
  conversionRate: number;
  revenue: number;
  averageOrderValue: number;
  repeatCustomerRate: number;
  customerLifetimeValue: number;
  totalCustomers: number;
  bestProducts: Array<{ productId: string; name: string; revenue: number; orders: number }>;
  bestCategories: Array<{ name: string; revenue: number }>;
}

/** GET /analytics/dashboard — RBAC: sales.analytics; null when unavailable. */
export async function getDashboardAnalytics(): Promise<ServerDashboardAnalytics | null> {
  return safe(() => request<ServerDashboardAnalytics>("/analytics/dashboard"), null);
}

/** GET /analytics/sales — commercial funnel/AOV/repeat metrics. */
export async function getSalesAnalytics(): Promise<ServerSalesAnalytics | null> {
  return safe(() => request<ServerSalesAnalytics>("/analytics/sales"), null);
}

/* -- E5: RBAC administration (users / roles / permissions) --------------- */

export interface ServerRbacUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  phone: string;
  role: string;
  isAdmin: boolean;
  status: string;
  createdAt: string;
}

export interface ServerRole {
  id: string;
  name: string;
  label: string;
  active: boolean;
}

export interface ServerPermission {
  id: string;
  key: string;
}

export async function listRbacUsers(): Promise<ServerRbacUser[]> {
  return safe(() => request<ServerRbacUser[]>("/rbac/users"), []);
}

export async function listRbacRoles(): Promise<ServerRole[]> {
  return safe(() => request<ServerRole[]>("/rbac/roles"), []);
}

export async function listRbacPermissions(): Promise<ServerPermission[]> {
  return safe(() => request<ServerPermission[]>("/rbac/permissions"), []);
}

/** Permission keys currently granted to a role (RBAC: roles.manage). */
export async function getRolePermissionKeys(roleId: string): Promise<string[]> {
  return safe(async () => {
    const r = await request<{ role: ServerRole; permissions: string[] }>(`/rbac/${roleId}/permissions`);
    return r?.permissions ?? [];
  }, []);
}

export async function grantRolePermission(roleId: string, permissionId: string): Promise<boolean> {
  return safe(async () => {
    const r = await request<{ ok: boolean }>(`/rbac/${roleId}/permissions/${permissionId}`, { method: "POST" });
    return r?.ok === true;
  }, false);
}

export async function revokeRolePermission(roleId: string, permissionId: string): Promise<boolean> {
  return safe(async () => {
    const r = await request<{ ok: boolean }>(`/rbac/${roleId}/permissions/${permissionId}`, { method: "DELETE" });
    return r?.ok === true;
  }, false);
}

/* ── E7: Staff & Salary (§18) ─────────────────────────────────────────────
 * Reads degrade via `safe()` like the rest of the client; mutations THROW so
 * the workflow UI can surface the exact server message (409 CLOSED guards,
 * 422 validation, 403 permission) in a toast instead of failing silently.
 * Salary figures only ever arrive via /remuneration/* (remuneration.* perms) —
 * /staff rows are identity-only by design.
 */

export type EmploymentStatus = "ACTIVE" | "PROBATION" | "ON_LEAVE" | "INACTIVE" | "TERMINATED";

export interface ServerStaff {
  id: string;
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
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "SICK" | "LATE";

export interface ServerAttendance {
  id: string;
  staffId: string;
  /** Joined by the route for display. */
  staffName?: string;
  date: string;
  status: AttendanceStatus;
  hours: number;
  notes: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentFrequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "custom";

export interface ServerSalaryProfile {
  id: string;
  staffId: string;
  basicSalary: number;
  paymentFrequency: PaymentFrequency;
  allowanceAmount: number;
  deductionAmount: number;
  effectiveFrom: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PeriodType = PaymentFrequency;
export type PeriodStatus = "OPEN" | "PROCESSING" | "APPROVED" | "PARTIALLY_PAID" | "PAID" | "CLOSED";

export interface ServerPeriod {
  id: string;
  label: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  intendedPaymentDate: string | null;
  status: PeriodStatus;
  totalAmount: number;
  paidAmount: number;
  notes: string;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PeriodItemStatus = "PENDING" | "APPROVED" | "PAID" | "PARTIALLY_PAID" | "ADJUSTED";

export interface ServerPeriodItem {
  id: string;
  periodId: string;
  staffId: string;
  staffName?: string;
  staffNumber?: string;
  basicSalary: number;
  allowances: number;
  bonuses: number;
  deductions: number;
  advanceAmount: number;
  otherPayments: number;
  netAmount: number;
  paidAmount: number;
  status: PeriodItemStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type RemunerationPaymentMethod = "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER" | "OTHER";
export type PeriodPaymentStatus = "RECORDED" | "PENDING" | "PAID" | "CANCELLED";

export interface ServerPeriodPayment {
  id: string;
  periodId: string;
  staffId: string;
  staffName?: string;
  itemId: string | null;
  amount: number;
  paymentDate: string;
  method: RemunerationPaymentMethod;
  reference: string;
  paymentStatus: PeriodPaymentStatus;
  notes: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /remuneration/periods/:id — period + lines + payments (§18.5 drill). */
export interface ServerPeriodDetail extends ServerPeriod {
  items: ServerPeriodItem[];
  payments: ServerPeriodPayment[];
}

export interface AdvanceRepaymentEntry {
  date: string;
  amount: number;
  method?: string;
  reference?: string;
  recordedBy?: string;
}

export interface ServerAdvance {
  id: string;
  staffId: string;
  staffName?: string;
  /** Immutable original grant — recoveries append to repaymentLog (§18.6). */
  amount: number;
  repaidAmount: number;
  /** Remaining balance, computed on the wire. */
  outstanding: number;
  reason: string;
  advanceDate: string | null;
  status: "OUTSTANDING" | "SETTLED";
  repaymentLog: AdvanceRepaymentEntry[];
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerPayslip {
  id: string;
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

export interface ServerRemunerationDashboard {
  period: ServerPeriod | null;
  items: ServerPeriodItem[];
  totals: {
    due: number;
    paid: number;
    pending: number;
    allowances: number;
    bonuses: number;
    deductions: number;
    outstandingAdvances: number;
  };
  upcomingPaymentDates: { id: string; label: string; date: string; status: PeriodStatus; total: number }[];
  periodStatus: PeriodStatus | null;
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

/* -- Staff directory + attendance (staff.* permissions) ------------------- */

export function listStaff(params?: { status?: string; q?: string }): Promise<ServerStaff[]> {
  return safe(() => request<ServerStaff[]>(`/staff${qs({ status: params?.status, q: params?.q })}`), []);
}

export function getStaff(id: string): Promise<ServerStaff | null> {
  return safe(() => request<ServerStaff>(`/staff/${id}`), null);
}

/** Mutations throw ApiError (message shown by the caller). */
export function createStaff(payload: Partial<ServerStaff>): Promise<ServerStaff> {
  return request<ServerStaff>("/staff", { method: "POST", body: payload });
}

export function updateStaff(id: string, patch: Partial<ServerStaff>): Promise<ServerStaff> {
  return request<ServerStaff>(`/staff/${id}`, { method: "PATCH", body: patch });
}

/** End employment — history stays intact, never a hard delete (§18.7). */
export function archiveStaff(id: string): Promise<ServerStaff> {
  return request<ServerStaff>(`/staff/${id}/archive`, { method: "POST", body: {} });
}

export function listAttendance(params?: { staffId?: string; from?: string; to?: string }): Promise<ServerAttendance[]> {
  return safe(
    () => request<ServerAttendance[]>(`/staff/attendance${qs({ staffId: params?.staffId, from: params?.from, to: params?.to })}`),
    [],
  );
}

/** Record one day for one person (upsert — same day overwrites). */
export function recordAttendance(payload: {
  staffId: string;
  date: string;
  status: AttendanceStatus;
  hours?: number;
  notes?: string;
}): Promise<ServerAttendance> {
  return request<ServerAttendance>("/staff/attendance", { method: "POST", body: payload });
}

/* -- Salary profiles (remuneration.view / remuneration.edit) ------------- */

export function getSalaryProfile(staffId: string): Promise<ServerSalaryProfile | null> {
  return safe(() => request<ServerSalaryProfile | null>(`/remuneration/profiles/${staffId}`), null);
}

/** PUT = create-or-update the confidential baseline (§18.2). */
export function saveSalaryProfile(
  staffId: string,
  payload: {
    basicSalary?: number;
    paymentFrequency?: PaymentFrequency;
    allowanceAmount?: number;
    deductionAmount?: number;
    effectiveFrom?: string;
    notes?: string;
  },
): Promise<ServerSalaryProfile | null> {
  return request<ServerSalaryProfile | null>(`/remuneration/profiles/${staffId}`, { method: "PUT", body: payload });
}

/* -- Period workflow (remuneration.* permissions) ------------------------ */

export function listPeriods(status?: PeriodStatus): Promise<ServerPeriod[]> {
  return safe(() => request<ServerPeriod[]>(`/remuneration/periods${qs({ status })}`), []);
}

export function createPeriod(payload: {
  label: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  intendedPaymentDate?: string;
  notes?: string;
}): Promise<ServerPeriod> {
  return request<ServerPeriod>("/remuneration/periods", { method: "POST", body: payload });
}

export function getPeriod(id: string): Promise<ServerPeriodDetail | null> {
  return safe(() => request<ServerPeriodDetail>(`/remuneration/periods/${id}`), null);
}

/** SELECT STAFF + CALCULATE; empty list = all ACTIVE/PROBATION staff. Re-runnable while OPEN/PROCESSING. */
export function calculatePeriod(id: string, staffIds?: string[]): Promise<ServerPeriodItem[]> {
  return request<ServerPeriodItem[]>(`/remuneration/periods/${id}/calculate`, {
    method: "POST",
    body: { staffIds: staffIds ?? [] },
  });
}

/** Review/adjust a line before approval (server recomputes net). */
export function updatePeriodItem(id: string, patch: Partial<ServerPeriodItem>): Promise<ServerPeriodItem> {
  return request<ServerPeriodItem>(`/remuneration/items/${id}`, { method: "PATCH", body: patch });
}

/** Additive correction line — the sanctioned path once lines are frozen (§18.7). */
export function addAdjustment(
  periodId: string,
  payload: { staffId: string; allowances?: number; bonuses?: number; deductions?: number; otherPayments?: number; notes?: string },
): Promise<ServerPeriodItem> {
  return request<ServerPeriodItem>(`/remuneration/periods/${periodId}/adjustments`, { method: "POST", body: payload });
}

export function approvePeriod(id: string): Promise<ServerPeriod> {
  return request<ServerPeriod>(`/remuneration/periods/${id}/approve`, { method: "POST", body: {} });
}

/** Terminal — the server answers 409 for anything that mutates a CLOSED period. */
export function closePeriod(id: string): Promise<ServerPeriod> {
  return request<ServerPeriod>(`/remuneration/periods/${id}/close`, { method: "POST", body: {} });
}

export function listPeriodPayments(periodId: string): Promise<ServerPeriodPayment[]> {
  return safe(() => request<ServerPeriodPayment[]>(`/remuneration/periods/${periodId}/payments`), []);
}

export function recordPeriodPayment(
  periodId: string,
  payload: {
    staffId: string;
    amount: number;
    paymentDate: string;
    method?: RemunerationPaymentMethod;
    reference?: string;
    notes?: string;
  },
): Promise<ServerPeriodPayment> {
  return request<ServerPeriodPayment>(`/remuneration/periods/${periodId}/payments`, { method: "POST", body: payload });
}

export function markPaymentPaid(paymentId: string): Promise<ServerPeriodPayment> {
  return request<ServerPeriodPayment>(`/remuneration/payments/${paymentId}/mark-paid`, { method: "POST", body: {} });
}

/* -- Advances (remuneration.* permissions) ------------------------------- */

export function listAdvances(staffId?: string): Promise<ServerAdvance[]> {
  return safe(() => request<ServerAdvance[]>(`/remuneration/advances${qs({ staffId })}`), []);
}

export function createAdvance(payload: { staffId: string; amount: number; reason: string; advanceDate?: string }): Promise<ServerAdvance> {
  return request<ServerAdvance>("/remuneration/advances", { method: "POST", body: payload });
}

/** Append a recovery — the original amount never changes (§18.6). */
export function recordAdvanceRepayment(
  id: string,
  payload: { amount: number; date: string; method?: string; reference?: string },
): Promise<ServerAdvance> {
  return request<ServerAdvance>(`/remuneration/advances/${id}/repayments`, { method: "POST", body: payload });
}

/* -- Payslips (remuneration.process to issue, payslip.print to open) ----- */

/** Idempotent: existing snapshots are returned, never cloned (§18.8). */
export function issuePayslips(periodId: string): Promise<ServerPayslip[]> {
  return request<ServerPayslip[]>(`/remuneration/periods/${periodId}/payslips`, { method: "POST", body: {} });
}

export function listPayslips(params?: { periodId?: string; staffId?: string }): Promise<ServerPayslip[]> {
  return safe(() => request<ServerPayslip[]>(`/remuneration/payslips${qs(params ?? {})}`), []);
}

/** Single printable document — gated by payslip.print, not remuneration.view. */
export function getPayslip(id: string): Promise<ServerPayslip | null> {
  return safe(() => request<ServerPayslip>(`/remuneration/payslips/${id}`), null);
}

/* -- Dashboard + printable reports (remuneration.view / view_reports) ---- */

export function getRemunerationDashboard(periodId?: string): Promise<ServerRemunerationDashboard | null> {
  return safe(() => request<ServerRemunerationDashboard>(`/remuneration/dashboard${qs({ periodId })}`), null);
}

export function getRemunerationReport(type: "advances" | "outstanding", periodId?: string): Promise<unknown[]> {
  return safe(() => request<unknown[]>(`/remuneration/reports${qs({ type, periodId })}`), []);
}
