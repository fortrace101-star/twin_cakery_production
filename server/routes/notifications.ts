import { Router, RequestHandler } from "express";
import { AuthService, extractToken } from "../services/auth.service.js";
import { rbacService } from "../services/rbac.service.js";
import { store } from "../database/store.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();
const authService = new AuthService();

router.use((req, res, next) => {
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  rbacService.requirePermission(session.userId, "audit.view");
  (req as unknown as { auth: { session: typeof session } }).auth = { session };
  next();
});

router.get("/", (req, res) => {
  const { userId } = req.query;
  const id = typeof userId === "string" ? userId : ((req as unknown as { auth?: { session?: { userId?: string } } }).auth?.session?.userId || "");
  const notifications = store.getUserNotifications(id, 50);
  res.json(notifications);
});

router.get("/unread-count", (req, res) => {
  const { userId } = req.query;
  const id = typeof userId === "string" ? userId : ((req as unknown as { auth?: { session?: { userId?: string } } }).auth?.session?.userId || "");
  res.json({ count: store.getUnreadCount(id) });
});

router.patch("/:id/read", (req, res) => {
  const id = String(req.params.id);
  const { userId } = req.query;
  const targetUserId = typeof userId === "string" ? userId : ((req as unknown as { auth?: { session?: { userId?: string } } }).auth?.session?.userId || "");
  if (!targetUserId) return res.status(400).json({ error: "userId required" });
  const success = store.markAsRead(id, targetUserId);
  if (!success) throw new NotFoundError("Notification not found or access denied");
  res.json({ ok: true });
});

router.post("/mark-all-read", (req, res) => {
  const { userId } = req.query;
  const id = typeof userId === "string" ? userId : ((req as unknown as { auth?: { session?: { userId?: string } } }).auth?.session?.userId || "");
  if (!id) return res.status(400).json({ error: "userId required" });
  const count = store.markAllAsRead(id);
  res.json({ ok: true, count });
});

router.get("/preferences", (req, res) => {
  const { userId } = req.query;
  const id = typeof userId === "string" ? userId : ((req as unknown as { auth?: { session?: { userId?: string } } }).auth?.session?.userId || "");
  res.json(store.getNotificationPreferences(id));
});

router.patch("/preferences", (req, res) => {
  const { userId, eventTypeId, channel } = req.body || {};
  const { enabled } = req.query;
  if (!userId || !eventTypeId || !channel) return res.status(400).json({ error: "userId, eventTypeId, and channel are required" });
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
