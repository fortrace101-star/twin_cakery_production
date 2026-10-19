import { Router, RequestHandler } from "express";
import { AuthService, extractToken } from "../services/auth.service.js";
import { store } from "../database/store.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();
const authService = new AuthService();

// Notifications are strictly per-user (every store call scopes by recipient),
// so authentication alone gates these endpoints. The previous blanket
// audit.view requirement was Admin-only and locked every non-admin out of
// their own bell. The recipient is ALWAYS the signed-in session — any
// ?userId= override is ignored so one user can never read another's inbox.
router.use((req, res, next) => {
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  (req as unknown as { auth: { session: typeof session } }).auth = { session };
  next();
});

const sessionUserId = (req: unknown): string =>
  ((req as { auth?: { session?: { userId?: string } } }).auth?.session?.userId) || "";

router.get("/", (req, res) => {
  const notifications = store.getUserNotifications(sessionUserId(req), 50);
  res.json(notifications);
});

router.get("/unread-count", (req, res) => {
  res.json({ count: store.getUnreadCount(sessionUserId(req)) });
});

router.patch("/:id/read", (req, res) => {
  const id = String(req.params.id);
  const targetUserId = sessionUserId(req);
  if (!targetUserId) return res.status(400).json({ error: "userId required" });
  const success = store.markAsRead(id, targetUserId);
  if (!success) throw new NotFoundError("Notification not found or access denied");
  res.json({ ok: true });
});

router.post("/mark-all-read", (req, res) => {
  const id = sessionUserId(req);
  if (!id) return res.status(400).json({ error: "userId required" });
  const count = store.markAllAsRead(id);
  res.json({ ok: true, count });
});

router.get("/preferences", (req, res) => {
  res.json(store.getNotificationPreferences(sessionUserId(req)));
});

router.patch("/preferences", (req, res) => {
  const userId = sessionUserId(req);
  const { eventTypeId, channel } = req.body || {};
  const { enabled } = req.query;
  if (!userId || !eventTypeId || !channel) return res.status(400).json({ error: "eventTypeId and channel are required" });
  const prefs = store.getNotificationPreferences(userId);
  const existing = prefs.find((p) => p.userId === userId && p.eventTypeId === eventTypeId && p.channel === channel);
  if (existing) {
    store.updateNotificationPreference(existing.id, { enabled: enabled === "true" });
  } else {
    store.createNotificationPreference({
      userId,
      eventTypeId,
      channel,
      enabled: enabled === "true",
    });
  }
  store.persist();
  res.json({ ok: true });
});

export default router;
