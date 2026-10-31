// Live sync (SSE) — every server mutation broadcasts a change event; every
// mounted view re-runs its refresh() so state updates without a page reload.
//
// Transport notes:
//  - EventSource auto-reconnects when the stream drops (server restart etc.).
//  - The server also sends a heartbeat every 3s, so a kept-alive stream is
//    re-established quickly after sleep/network blips.
//  - A 401 (expired session) just means "not signed in": stop and let the
//    next sign-in start a new stream.

import { useEffect, useCallback, type ReactNode } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let started = false;

function open(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    source = new EventSource("/api/v1/events");
    source.onmessage = () => {
      for (const fn of listeners) {
        try {
          fn();
        } catch {
          // A broken listener must not kill the stream.
        }
      }
    };
    source.onerror = () => {
      // EventSource reconnects on its own; stop cleanly on auth failures.
      if (source && source.readyState === EventSource.CLOSED) {
        source = null;
        started = false;
      }
    };
  } catch {
    started = false;
  }
}

/** Subscribe to "something changed on the server". Returns an unsubscribe fn. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  open();
  return () => listeners.delete(listener);
}

/** Auto-refresh a view's data whenever the server broadcasts a change. */
export function useLiveRefresh(refresh: () => void): void {
  useEffect(() => {
    const unsubscribe = subscribe(refresh);
    return unsubscribe;
  }, [refresh]);
}
