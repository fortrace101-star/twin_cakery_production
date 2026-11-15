import webpush from "web-push";
import { store } from "../database/store.js";

let configured = false;
let vapidPublicKey = "";

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

export function getVapidPublicKey(): string {
  if (!vapidPublicKey) vapidPublicKey = String(process.env.VAPID_PUBLIC_KEY || "");
  return vapidPublicKey;
}

function ensureConfigured(): boolean {
  if (configured) return true;
  if (!isPushConfigured()) return false;
  vapidPublicKey = String(process.env.VAPID_PUBLIC_KEY || "");
  webpush.setVapidDetails(
    String(process.env.VAPID_SUBJECT || "mailto:admin@example.com"),
    vapidPublicKey,
    String(process.env.VAPID_PRIVATE_KEY || ""),
  );
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body?: string;
  actionUrl?: string | null;
  deepLink?: string | null;
  tag?: string;
  notificationId?: string;
  entityType?: string;
  entityId?: string;
  eventTypeId?: string;
}

/**
 * Best-effort: send a push notification to all subscriptions for a user.
 * Never throws into callers; prunes gone subscriptions (404/410).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    const subs = store.pushSubscriptionsForUser(userId);
    if (!subs.length) return;
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
            { TTL: 60 },
          );
        } catch (err: any) {
          const status = err?.statusCode || err?.status;
          if (status === 404 || status === 410) {
            try { store.deletePushSubscriptionByEndpoint(sub.endpoint); } catch {}
          } else {
            console.warn("[push] send failed", userId, status, err?.message || err);
          }
        }
      }),
    );
  } catch (err) {
    console.warn("[push] fanout failed", err);
  }
}
