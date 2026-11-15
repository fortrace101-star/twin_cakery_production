import { useCallback, useEffect, useRef, useState } from "react";
import { getToken, getVapidPublicKey, subscribePush } from "@/lib/api";

export type PushPermissionState = NotificationPermission | "unsupported";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches || (navigator as any).standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
}

export function usePush(opts: {
  enabled: boolean;
  onPush?: (payload: any) => void;
  onNavigate?: (url: string) => void;
  showNotice?: (msg: string) => void;
}) {
  const { enabled, onPush, onNavigate, showNotice } = opts;
  const [permission, setPermission] = useState<PushPermissionState>(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const [subscribed, setSubscribed] = useState(false);
  const audioArmedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const triedAutoRef = useRef(false);

  const armAudio = useCallback(() => {
    if (audioArmedRef.current) return;
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return;
      const ctx = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();
      audioArmedRef.current = true;
    } catch {
      /* ignore */
    }
  }, []);

  const chime = useCallback(() => {
    try {
      if (!audioArmedRef.current) return;
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.03;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.12);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFirstGesture = () => armAudio();
    window.addEventListener("pointerdown", onFirstGesture, { once: true, passive: true });
    window.addEventListener("keydown", onFirstGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
  }, [armAudio]);

  const ensureSubscription = useCallback(async (opts?: { interactive?: boolean }) => {
    try {
      if (!enabled || !getToken()) return false;
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPermission("unsupported");
        return false;
      }
      if (typeof Notification === "undefined") {
        setPermission("unsupported");
        return false;
      }

      // iOS web push requires installed/standalone web app in most cases.
      if (isIOS() && !isStandaloneDisplay() && opts?.interactive) {
        showNotice?.("On iPhone/iPad, install the app to Home Screen to enable push notifications.");
      }

      let perm: NotificationPermission = Notification.permission;
      if (perm === "default") {
        if (opts?.interactive) {
          try { perm = await Notification.requestPermission(); } catch { perm = Notification.permission; }
        } else {
          // Avoid surprising prompt without gesture on browsers that are strict; caller can retry interactively.
          setPermission(perm);
          return false;
        }
      }
      setPermission(perm);
      if (perm !== "granted") {
        if (perm === "denied" && opts?.interactive) {
          showNotice?.("Notifications are blocked. Enable them in your browser/site settings.");
        }
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      const vapid = await getVapidPublicKey();
      if (!vapid) return false; // not configured server-side

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid) as unknown as BufferSource,
        });
      }
      const json = sub.toJSON();
      const ok = await subscribePush({ ...(json as any), userAgent: navigator.userAgent });
      setSubscribed(ok);
      return ok;
    } catch (err) {
      // WebKit/Safari can require a user gesture; surface hint only when interactive.
      if (opts?.interactive) showNotice?.("Could not enable push notifications on this device/browser.");
      return false;
    }
  }, [enabled, showNotice]);

  // Auto-subscribe attempt once when enabled and already granted (no prompt).
  useEffect(() => {
    if (!enabled) return;
    if (triedAutoRef.current) return;
    triedAutoRef.current = true;
    void ensureSubscription({ interactive: false });
  }, [enabled, ensureSubscription]);

  // Listen for SW messages (push delivered to open client, notification click nav).
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      const msg = event.data || {};
      if (msg.type === "PUSH_NOTIFICATION") {
        chime();
        onPush?.(msg.payload);
      } else if (msg.type === "NOTIFICATION_NAVIGATE" && typeof msg.url === "string") {
        onNavigate?.(msg.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [chime, onNavigate, onPush]);

  return {
    permission,
    subscribed,
    isIOS: isIOS(),
    isStandalone: isStandaloneDisplay(),
    requestEnable: () => ensureSubscription({ interactive: true }),
    ensureSubscription,
  };
}
