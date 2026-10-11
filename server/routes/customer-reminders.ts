import { Router } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";
import type { CustomerEventReminder } from "../database/types.js";

// ---------------------------------------------------------------------------
// E1 — Recurring event reminders (governing spec §5).
//
// The system NEVER auto-contacts a customer. A reminder only advances when a
// human acts on it via markReminderContacted (which stamps contactedBy); there
// is deliberately no auto-advance path. Permissions reuse customers.view (read)
// / customers.interact (act). Base path: /api/v1/customer-reminders.
// ---------------------------------------------------------------------------

const router = Router();
const authService = new AuthService();

const required = (perm: string) => (req, res, next) => {
  try {
    const session = authService.requireAuth(extractToken(req.headers.authorization as string | undefined));
    rbacService.requirePermission(session.userId, perm);
    next();
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthorizedError") return res.status(401).json({ error: err.message });
    if (err instanceof Error && err.name === "ForbiddenError") return res.status(403).json({ error: err.message });
    next(err);
  }
};

/** Authenticated staff id (userId) for auditing contactedBy. */
function actor(req): string {
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  return session?.userId ?? "";
}

/** Enrich a reminder with the customer name so the list is usable without a second lookup. */
function withCustomer(reminder: CustomerEventReminder) {
  const customer = store.customer(reminder.customerId);
  return {
    ...reminder,
    customerName: customer?.name ?? "",
    customerPhone: customer?.phone ?? "",
  };
}

/** GET /customer-reminders — reminders due within `days` (default 30, max 365), most urgent first. */
router.get("/", required("customers.view"), (req, res) => {
  const raw = Number(req.query.days);
  const days = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 365) : 30;
  res.json(store.dueReminders(days).map(withCustomer));
});

/** PATCH /customer-reminders/:id/contacted — staff acted; records outcome and rolls to the next occurrence. */
router.patch("/:id/contacted", required("customers.interact"), (req, res) => {
  const { outcome, followUpNotes } = req.body || {};
  const updated = store.markReminderContacted(req.params.id, {
    contactedBy: actor(req),
    outcome: outcome ?? "",
    followUpNotes: followUpNotes ?? "",
  });
  if (!updated) throw new NotFoundError("Reminder not found");
  res.json(withCustomer(updated));
});

/** PATCH /customer-reminders/:id/dismiss — close this occurrence with no follow-up. */
router.patch("/:id/dismiss", required("customers.interact"), (req, res) => {
  const updated = store.dismissReminder(req.params.id);
  if (!updated) throw new NotFoundError("Reminder not found");
  res.json(withCustomer(updated));
});

export default router;
