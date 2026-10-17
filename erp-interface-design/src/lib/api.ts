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
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "REFUNDED" | "OVERPAID";
  deliveryStatus: string;
  createdBy: string;
  deliveredAt: string | null;
}

export interface ServerDelivery {
  id: string;
  orderId: string;
  type: string;
  destination: string;
  status: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  actualDeliveryDate: string | null;
  deliveryPerson: string | null;
  deliveryFee: number;
  notes: string;
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
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Completed",
  INVOICED: "Invoiced",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partial",
  PAID: "Paid",
  REFUNDED: "Refunded",
  OVERPAID: "Overpaid",
};

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  READY_FOR_DISPATCH: "Ready for dispatch",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  AWAITING_PICKUP: "Awaiting pickup",
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
  "Out for delivery": "OUT_FOR_DELIVERY",
  Completed: "DELIVERED",
  Invoiced: "INVOICED",
  Closed: "CLOSED",
  Cancelled: "CANCELLED",
};

export function orderStatusEnum(label: string): string {
  return ORDER_STATUS_ENUMS[label] ?? "AWAITING_CONFIRMATION";
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
): UiOrder {
  const customer = customersById[order.customerId]?.name ?? order.customerId;
  const item = order.items?.[0];
  const product = (item && productsById[item.productId]?.name) || "Custom order";
  const { date, time } = splitDateTime(order.requiredAt);
  const channel = (order.notes?.split(" · ").pop() || "Direct").trim();
  return {
    id: order.orderNumber || order.id,
    customer,
    initials: initialsOf(customer),
    product,
    options: item?.variantOptions ?? "",
    date,
    time,
    amount: order.total,
    status: orderStatusLabel(order.status),
    payment: paymentStatusLabel(order.paymentStatus),
    delivery: deliveryStatusLabel(order.deliveryStatus),
    channel,
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
}

export async function register(payload: RegisterInput): Promise<LoginResult> {
  return request<LoginResult>("/auth/register", { method: "POST", body: payload });
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
export async function listDeliveries(): Promise<ServerDelivery[]> {
  return safe(() => request<ServerDelivery[]>("/deliveries"), []);
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
export async function createCustomerApi(name: string): Promise<ServerCustomer | null> {
  return safe(() => request<ServerCustomer>("/customers", { method: "POST", body: { name } }), null);
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

