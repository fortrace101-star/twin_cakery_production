import type { Response } from "express";

/**
 * Server-Sent Events change stream — the server half of live sync
 * ("HMR for data"): every successful mutating API response broadcasts one
 * event naming the resources it touched, and connected clients refetch only
 * the views registered for those keys (erp-interface-design/src/lib/live.ts).
 *
 * A heartbeat comment is written every 3 seconds so proxies and browsers keep
 * the connection open (and a dead stream is noticed quickly).
 */

const HEARTBEAT_MS = 3000;

const clients = new Set<Response>();
let heartbeat: ReturnType<typeof setInterval> | null = null;
let rev = 0;

/**
 * Route prefix (first path segment after /api/v1) → resource keys that client
 * listeners subscribe to. Unknown prefixes fall back to the prefix itself, so
 * a new route is live by default without touching this map.
 */
const RESOURCE_MAP: Record<string, string[]> = {
  orders: ["orders"],
  production: ["jobs", "orders"],
  payments: ["payments", "orders"],
  deliveries: ["deliveries", "orders"],
  inventory: ["inventory"],
  purchasing: ["purchasing", "inventory"],
  customers: ["customers"],
  "customer-reminders": ["customers"],
  feedback: ["customers"],
  catalogue: ["catalogue"],
  quotations: ["orders"],
  inquiries: ["orders"],
  "order-proposals": ["orders", "proposals"],
  expenses: ["expenses"],
  "expense-categories": ["expenses"],
  finance: ["expenses", "payments"],
  rbac: ["rbac", "audit"],
  staff: ["staff"],
  remuneration: ["staff"],
  content: ["content"],
  notifications: ["notifications"],
  public: [],
};

/** Resource keys a mutation on `url` affects ([] = nothing to announce). */
export function resourcesFor(method: string, url: string): string[] {
  if (method === "GET" || method === "HEAD") return [];
  const path = url.split("?")[0] ?? "";
  const withoutBase = path.replace(/^\/api\/v1\/?/, "");
  const segment = withoutBase.split("/")[0] ?? "";
  // Session traffic (login/logout/register) changes no business data.
  if (!segment || segment === "auth") return [];
  return RESOURCE_MAP[segment] ?? [segment];
}

/** Register an open SSE response; starts the heartbeat while anyone listens. */
export function addSseClient(res: Response): void {
  clients.add(res);
  if (!heartbeat) {
    heartbeat = setInterval(() => {
      for (const client of clients) {
        try {
          client.write(": hb\n\n");
        } catch {
          clients.delete(client);
        }
      }
    }, HEARTBEAT_MS);
    // Never hold the process open just for heartbeats.
    (heartbeat as unknown as { unref?: () => void }).unref?.();
  }
}

export function removeSseClient(res: Response): void {
  clients.delete(res);
  if (clients.size === 0 && heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

/** Broadcast one change event to every connected client. */
export function broadcastChange(method: string, url: string): void {
  const resources = resourcesFor(method, url);
  if (resources.length === 0 || clients.size === 0) return;
  rev += 1;
  const payload = `data: ${JSON.stringify({ method, path: url.split("?")[0], resources, rev, at: Date.now() })}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}
