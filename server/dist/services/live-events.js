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
const clients = new Map();
let heartbeat = null;
let rev = 0;
/**
 * Route prefix (first path segment after /api/v1) → resource keys that client
 * listeners subscribe to. Unknown prefixes fall back to the prefix itself, so
 * a new route is live by default without touching this map.
 */
const RESOURCE_MAP = {
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
export function resourcesFor(method, url) {
    if (method === "GET" || method === "HEAD")
        return [];
    const path = url.split("?")[0] ?? "";
    const withoutBase = path.replace(/^\/api\/v1\/?/, "");
    const segment = withoutBase.split("/")[0] ?? "";
    // Session traffic (login/logout/register) changes no business data.
    if (!segment || segment === "auth")
        return [];
    return RESOURCE_MAP[segment] ?? [segment];
}
/** Register an open SSE response; starts the heartbeat while anyone listens.
 *  `resources` is optional; omitting it subscribes to the route-prefix hint for
 *  the request that opened the stream (best-effort).
 */
export function addSseClient(res, resources) {
    const initialResources = resources ?? [];
    // If nothing was explicitly subscribed, fall back to the route-prefix hint.
    if (initialResources.length === 0) {
        const hinted = resourcesFor("GET", res.req?.originalUrl ?? "");
        for (const h of hinted)
            initialResources.push(h);
    }
    clients.set(res, new Set(initialResources));
    if (clients.size === 1 && !heartbeat) {
        heartbeat = setInterval(() => {
            for (const client of clients.keys()) {
                try {
                    client.write(": hb\n\n");
                }
                catch {
                    clients.delete(client);
                }
            }
        }, HEARTBEAT_MS);
        heartbeat.unref?.();
    }
}
/** Add extra resource keys to an already-open SSE client (used for per-view tuning). */
export function addSseClientResources(res, extra) {
    const set = clients.get(res);
    if (!set)
        return;
    if (Array.isArray(extra))
        extra.forEach((k) => set.add(k));
    else
        set.add(extra);
}
export function removeSseClient(res) {
    clients.delete(res);
    if (clients.size === 0 && heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
    }
}
/** Broadcast one change event to every connected client that cares about key.
 *  - If `key` is supplied, only clients that subscribed to that resource key
 *    receive the event (default, fine-grained).
 *  - If `key` is omitted, all connected clients receive the event (legacy
 *    behaviour used by routes that still publish via the old path).
 */
export function broadcastChange(method, url, key) {
    // Gather every client whose subscribed resources include the affected key.
    const matching = new Set();
    const needle = key ?? "";
    for (const [res, keys] of clients) {
        if (needle === "") {
            // Unscoped broadcast: send to everyone (legacy behaviour).
            matching.add(res);
        }
        else if (keys.has(needle)) {
            matching.add(res);
        }
    }
    if (matching.size === 0)
        return;
    rev += 1;
    const payload = `data: ${JSON.stringify({ method, path: url.split("?")[0], resource: key ?? "*", rev, at: Date.now() })}\n\n`;
    for (const client of matching) {
        try {
            client.write(payload);
        }
        catch {
            clients.delete(client);
        }
    }
}
export function sseClientCount() {
    return clients.size;
}
export function sseClientFor(res) {
    return clients.get(res);
}
//# sourceMappingURL=live-events.js.map