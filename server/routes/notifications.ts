import { Router } from "express";
import { AuthService, extractToken } from "../services/auth.service.js";
import { store } from "../database/store.js";
import { addNotificationClient, removeNotificationClient } from "../services/notification-events.js";

const router = Router();
const authService = new AuthService();

// Notifications are strictly per-user (every store call scopes by recipient).
// Authentication gates these endpoints. The recipient is ALWAYS the signed-in
// session — any ?userId= override is ignored so one user can never read another's inbox.
// Accept token from Authorization header or ?token=... (needed for EventSource streams).
router.use(async (req, res, next) => {
  try {
    const headerToken = extractToken(req.headers.authorization as string | undefined);
    const q = req.query?.token;
    const queryToken = !headerToken && typeof q === "string" && q.trim() ? q.trim() : null;
    const session = await authService.getCurrentSession(headerToken ?? queryToken);
    if (!session) return res.status(401).json({ error: "Not authenticated" });
    (req as unknown as { auth: { session: typeof session } }).auth = { session };
    next();
  } catch (err) {
    next(err);
  }
});

const sessionUserId = (req: unknown): string =>
  ((req as { auth?: { session?: { userId?: string } } }).auth?.session?.userId) || "";

/** Unread inbox for the signed-in user (newest-first). */
router.get("/", async (req, res) => {
  const notifications = store.getUserNotifications(sessionUserId(req), 50);
  res.json(notifications);
});

router.get("/unread-count", async (req, res) => {
  res.json({ count: store.getUnreadCount(sessionUserId(req)) });
});

// Per-user SSE stream for live notification updates (EventSource cannot send headers).
router.get("/stream", async (req, res) => {
  const userId = sessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  (res as any).flushHeaders?.();

  addNotificationClient(userId, res);
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true, at: Date.now() })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: hb ${Date.now()}\n\n`);
    } catch {
      /* cleanup on close */
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeNotificationClient(userId, res);
    try {
      res.end();
    } catch {
      /* ignore */
    }
  });
});

/** Acknowledge/remove a single inbox item (Spiro-style click). */
router.delete("/:id", async (req, res) => {
  const id = String(req.params.id);
  const userId = sessionUserId(req);
  const ok = store.deleteNotificationForUser(id, userId);
  // Idempotent: already removed/absent is fine for optimistic UI.
  res.json({ ok, removed: ok });
});

/** Clear all inbox items for the signed-in user. */
router.delete("/", async (req, res) => {
  const removed = store.clearNotificationsForUser(sessionUserId(req));
  res.json({ ok: true, removed });
});

/** Compatibility: mark a single item read (kept for older clients/callers). */
router.patch("/:id/read", async (req, res) => {
  const id = String(req.params.id);
  const targetUserId = sessionUserId(req);
  if (!targetUserId) return res.status(400).json({ error: "userId required" });
  const ok = store.markAsRead(id, targetUserId);
  res.json({ ok });
});

/** Compatibility: mark all read (kept for older clients/callers). */
router.post("/mark-all-read", async (req, res) => {
  const targetUserId = sessionUserId(req);
  if (!targetUserId) return res.status(400).json({ error: "userId required" });
  const updated = store.markAllAsRead(targetUserId);
  res.json({ ok: true, updated });
});

router.get("/preferences", async (req, res) => {
  const userId = sessionUserId(req);
  if (!userId) return res.status(400).json({ error: "userId required" });
  res.json(store.getNotificationPreferences(userId));
});

router.put("/preferences/:eventType", async (req, res) => {
  const userId = sessionUserId(req);
  if (!userId) return res.status(400).json({ error: "userId required" });
  const eventTypeId = String(req.params.eventType);
  const existing = store.getNotificationPreference(userId, eventTypeId);
  const pref = existing
    ? store.updateNotificationPreference(existing.id, { enabled: req.body?.enabled })
    : store.createNotificationPreference({ userId, eventTypeId, channel: "IN_APP", enabled: req.body?.enabled });
  res.json(pref);
});

export default router;
