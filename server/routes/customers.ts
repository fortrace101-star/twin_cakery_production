import { Router, Request, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";
import { paginate } from "../utils/paginate.js";

const router = Router();
const authService = new AuthService();

const required = (perm: string): RequestHandler => async (req, res, next) => {
  try {
    const session = authService.requireAuth(extractToken(req.headers.authorization as string | undefined));
    await rbacService.requirePermission(session.userId, perm);
    next();
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthorizedError") return res.status(401).json({ error: err.message });
    if (err instanceof Error && err.name === "ForbiddenError") return res.status(403).json({ error: err.message });
    next(err);
  }
};

router.get("/", required("customers.view"), (req, res) => {
  const customers = store.customers();
  const name = req.query.name as string | undefined;
  const status = req.query.status as string | undefined;
  let list = customers;
  if (name) list = list.filter((c) => c.name.toLowerCase().includes(name.toLowerCase()));
  if (status) list = list.filter((c) => c.status === status);
  // §33 — opt-in pagination envelope (plain array without ?page=).
  res.json(paginate(list, req.query, {
    sortable: ["name", "createdAt", "totalOrders", "totalSpend"],
    dateField: "createdAt",
    searchFields: ["name", "email", "phone"],
  }));
});

router.post("/", required("customers.create"), (req, res) => {
  const { name, phone, email, addresses, preferredContactMethod, source, notes, status } = req.body || {};
  if (!name) return res.status(400).json({ error: "Name is required" });
  const record = store.createCustomer({
    name,
    phone: phone || "",
    email: email || "",
    addresses: addresses || [],
    preferredContactMethod: (preferredContactMethod as "email" | "phone" | "whatsapp") || "email",
    source: source || "In-house",
    notes: notes || "",
    status: status || "Active",
  });
  store.persist();
  res.status(201).json(record);
});

router.get("/:id", required("customers.view"), (req, res) => {
  const customer = store.findCustomer(String(req.params.id));
  if (!customer) throw new NotFoundError("Customer not found");
  const interactions = store.interactionsByCustomer(customer.id);
  res.json({ ...customer, interactions });
});

router.patch("/:id", required("customers.edit"), (req, res) => {
  const id = String(req.params.id);
  const customer = store.findCustomer(id);
  if (!customer) throw new NotFoundError("Customer not found");
  const patch = req.body || {};
  const updated = store.updateCustomer(id, patch);
  store.persist();
  res.json(updated);
});

// ---------------------------------------------------------------------------
// E1 — Customer order history, occasions & recurring event reminders
// (governing spec §5). Order history + events are customer sub-resources and
// reuse customers.view (read) / customers.interact (write). The system NEVER
// auto-contacts a customer — only staff act on a reminder (markReminderContacted
// is the sole path that advances one, and it always requires a human).
// ---------------------------------------------------------------------------

/** Authenticated staff id (userId) for auditing createdBy / contactedBy. */
function actor(req: Request): string {
  const session = authService.getCurrentSession(
    extractToken(req.headers.authorization as string | undefined),
  );
  return session?.userId ?? "";
}

/** GET /customers/:id/orders — order history, most recent first, each with its immutable contact snapshot (rule 27). */
router.get("/:id/orders", required("customers.view"), (req, res) => {
  const customer = store.customer(String(req.params.id));
  if (!customer) throw new NotFoundError("Customer not found");
  const history = store.ordersForCustomer(customer.id).map((order) => ({
    ...order,
    snapshot: store.orderCustomerSnapshot(order.id) ?? null,
  }));
  res.json(history);
});

/** GET /customers/:id/order-history/print — printable order-history list (spec §5). */
router.get("/:id/order-history/print", required("customers.view"), (req, res) => {
  const customer = store.customer(String(req.params.id));
  if (!customer) throw new NotFoundError("Customer not found");
  const history = store.ordersForCustomer(customer.id).map((order) => ({
    orderId: order.id,
    orderNumber: order.orderNumber,
    date: order.createdAt,
    status: order.status,
    total: order.total,
    snapshotName: store.orderCustomerSnapshot(order.id)?.snapshotName ?? customer.name,
  }));
  res.json({ customer: { id: customer.id, name: customer.name }, printedAt: new Date().toISOString(), orders: history });
});

/** GET /customers/:id/events — occasions (with recurrence), soonest event date first. */
router.get("/:id/events", required("customers.view"), (req, res) => {
  const customer = store.customer(String(req.params.id));
  if (!customer) throw new NotFoundError("Customer not found");
  res.json(store.eventsByCustomer(customer.id));
});

/** POST /customers/:id/events — add an occasion; its recurring reminder is scheduled automatically. */
router.post("/:id/events", required("customers.interact"), (req, res) => {
  const customer = store.customer(String(req.params.id));
  if (!customer) throw new NotFoundError("Customer not found");
  const { eventType, eventDate, recurrenceRule, orderId, notes } = req.body || {};
  if (!eventType) return res.status(400).json({ error: "eventType is required" });
  const record = store.createCustomerEvent({
    customerId: customer.id,
    eventType,
    eventDate,
    recurrenceRule,
    orderId: orderId || undefined,
    notes: notes || "",
    createdBy: actor(req),
  });
  res.status(201).json(record);
});

/** PATCH /customers/:id/events/:eventId — edit an occasion (re-schedules its reminder). */
router.patch("/:id/events/:eventId", required("customers.interact"), (req, res) => {
  const event = store.customerEvent(String(req.params.eventId));
  if (!event || event.customerId !== String(req.params.id)) throw new NotFoundError("Event not found");
  const updated = store.updateCustomerEvent(event.id, req.body || {});
  res.json(updated);
});

/** DELETE /customers/:id/events/:eventId — remove an occasion and its pending reminder. */
router.delete("/:id/events/:eventId", required("customers.interact"), (req, res) => {
  const event = store.customerEvent(String(req.params.eventId));
  if (!event || event.customerId !== String(req.params.id)) throw new NotFoundError("Event not found");
  store.deleteCustomerEvent(event.id);
  res.status(204).end();
});

export default router;