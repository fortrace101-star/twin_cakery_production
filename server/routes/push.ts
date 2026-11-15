import { Router } from "express";
import { store } from "../database/store.js";
import { getVapidPublicKey, isPushConfigured } from "../services/push.service.js";

const router = Router();

const sessionUserId = (req: any): string =>
  req?.auth?.session?.userId || req?.session?.userId || "";

router.get("/vapid-public-key", (_req, res) => {
  if (!isPushConfigured()) {
    return res.status(503).json({ error: "Push notifications are not configured" });
  }
  res.json({ publicKey: getVapidPublicKey() });
});

router.post("/subscribe", async (req, res) => {
  const userId = sessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const { endpoint, keys, userAgent } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription: endpoint and keys.p256dh/auth required" });
  }

  const record = store.upsertPushSubscription({
    userId,
    endpoint: String(endpoint),
    p256dh: String(keys.p256dh),
    auth: String(keys.auth),
    userAgent: String(userAgent || req.headers["user-agent"] || ""),
  });

  res.json({ ok: true, id: record.id });
});

router.post("/unsubscribe", async (req, res) => {
  const userId = sessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const endpoint = String(req.body?.endpoint || "");
  if (!endpoint) return res.status(400).json({ error: "endpoint required" });

  const ok = store.deletePushSubscriptionByEndpoint(endpoint, userId);
  res.json({ ok });
});

export default router;
