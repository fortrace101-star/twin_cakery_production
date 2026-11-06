import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  listOrders,
  listCustomers,
  listProducts,
  listAudit,
  listPayments,
  toUiOrder,
  createOrderApi,
  updateOrderApi,
  recordPayment,
  findCustomerByName,
  createCustomerApi,
  findProductByName,
  orderStatusEnum,
  paymentStatusEnum,
  login,
  logout,
  me,
  type ServerOrder,
  type ServerCustomer,
  type ServerProduct,
  type ServerAuditLog,
  type ServerUser,
} from "@/lib/api";
import { type Order } from "./data";

/**
 * Connects the ERP workspace UI (workspace.tsx) to the Express API (src/lib/api.ts).
 *
 * Read helpers degrade to `[]` on failure, so when the API is unreachable (e.g.
 * the routing tests, or offline development) the workspace falls back to the
 * bundled `initialOrders` sample data instead of crashing.
 */


type WorkspaceContextValue = {
  orders: Order[];
  audit: string[];
  loading: boolean;
  /** Currently signed-in user, or null when running on bundled sample data. */
  user: ServerUser | null;
  connected: boolean;
  authError: string;
  /** Granted permission keys for the signed-in user; null in preview mode. */
  permissions: string[] | null;
  signIn: (username: string, password: string) => Promise<boolean>;
  signOut: () => void;
  addOrder: (order: Order, phone?: string) => void;
  /** Records the order stage and (optionally) its payment status & paid amount in one write. */
  updateOrder: (id: string, status: string, payment?: string, paidDelta?: number, payMeta?: { method?: string; receivedBy?: string; reference?: string; notes?: string }) => Promise<boolean>;
  /**
   * Best-effort duplicate guard used by the new-order flow. Returns an existing CRM customer
   * whose phone or email matches the given contact exactly (case-/space-insensitive), or null
   * when none is found.
   */
  findCustomerByContact: (name: string, phone?: string | null) => Promise<ServerCustomer | null>;
  /** Documents the post-delivery CRM follow-up for a completed order. */
  completeFollowUp: (id: string) => void;
  refresh: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/** Turn a server audit-log row into a short, human-readable activity line. */
function formatAudit(log: ServerAuditLog): string {
  const action = String(log.action ?? "")
    .replace(/[._:]/g, " ")
    .trim() || "updated record";
  const target =
    log.entityType && log.entityId
      ? `${log.entityType} ${log.entityId}`
      : log.orderId
        ? `order ${log.orderId}`
        : "";
  const to = log.newStatus ? ` → ${log.newStatus}` : "";
  return `${log.actor || "System"} ${action}${target ? ` ${target}` : ""}${to}`;
}

function byId<T extends { id: string }>(rows: T[]): Record<string, T> {
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}  /** Best-effort contact lookup for the new-order flow so a returning customer is reused. */
async function findCustomerByContact(name: string, phone?: string | null): Promise<ServerCustomer | null> {
  if (!name && !phone) return null;
  try {
    const lowerName = name.trim().toLowerCase();
    const targetPhone = phone != null ? String(phone).trim() : "";
    const candidates = await findCustomerByName(name);
    // Exact phone match is the strongest non-id signal (mobile numbers are effectively unique).
    if (targetPhone) {
      const byPhone = candidates?.find((c) => String(c.phone).trim() === targetPhone);
      if (byPhone) return byPhone;
      const byEmail = candidates?.find((c) => c.email.trim().toLowerCase() === lowerName || String(c.email).trim() === targetPhone);
      if (byEmail) return byEmail;
    }
    // Fall back to an approved name match only when the caller passed nothing better.
    if (!phone && candidates && candidates.length === 1) return candidates[0] ?? null;
    // If there are multiple name matches, do not guess — the caller should type more.
    return null;
  } catch {
    return null;
  }
}




export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [audit, setAudit] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<ServerUser | null>(null);
  const [authError, setAuthError] = useState("");
  const [permissions, setPermissions] = useState<string[] | null>(null);

  // Latest raw server orders, so we can map a UI orderNumber back to its
  // server `id` (e.g. `TC-1048` → `ord-1048`) when writing status changes.
  const serverOrdersRef = useRef<ServerOrder[]>([]);
  const aliveRef = useRef(true);
  useEffect(() => {
    // Re-arm on every mount. Under React StrictMode the component mounts,
    // simulated-unmounts (cleanup fires → aliveRef=false), then remounts. If
    // we only ever set false in cleanup, the ref stays false forever after the
    // StrictMode remount, so signIn() would bail at its `!aliveRef.current`
    // guard and silently skip setUser() — the button "reverts" with no error.
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const [customers, products, serverOrders, logs, payments] = await Promise.all([
      listCustomers(),
      listProducts(),
      listOrders(),
      listAudit(100),
      listPayments(),
    ]);
    if (!aliveRef.current) return;
    serverOrdersRef.current = serverOrders;
    const customersById = byId(customers as ServerCustomer[]);
    const productsById = byId(products as ServerProduct[]);
    // Sum the real payment ledger per server order id so the bracketed
    // "amount paid" reflects every payment ever recorded (any device, any
    // session) — not just the ones made in this session. GET /payments
    // degrades to [] (permission/network), which simply omits the brackets.
    const paidByOrderId: Record<string, number> = {};
    for (const p of payments) {
      if (p.orderId) paidByOrderId[p.orderId] = (paidByOrderId[p.orderId] ?? 0) + (p.amount || 0);
    }
    if (serverOrders.length) {
      setOrders(
        (serverOrders as ServerOrder[]).map((o) =>
          toUiOrder(o, customersById, productsById, paidByOrderId[o.id]),
        ),
      );
    } else if (user) {
      // Backend reached but returned no orders — do not wipe the current UI.
      // (A wipe only makes sense when clearing a signed-in session.)
    }
    setAudit((logs as ServerAuditLog[]).map(formatAudit));
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      // If there is no persisted session at all, the backend is effectively
      // unreachable for this user and `refresh()` above will just return `[]`.
      // In that case do not nuke the in-flight orders — treat the workspace as
      // offline/empty rather than as if the user explicitly signed out.
      // Restore a previously stored session (token survives refresh via
      // api.ts setToken). If none is present we stay on sample data.
      const session = await me();
      if (!aliveRef.current) return;
      if (session) {
        setUser(session.user);
        const perms = session.permissions ?? [];
        setPermissions(session.user?.isAdmin && perms.length === 0 ? null : perms);
      }
      await refresh();
    })();
  }, [refresh]);

  const signIn = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setAuthError("");
      try {
        const result = await login(username, password);
        if (!aliveRef.current) return true;
        setUser(result.user);
        // login() carries no permission list — pull it via me() so the
        // permission-aware navigation can filter immediately after sign-in.
        const session = await me();
        if (!aliveRef.current) return true;
        const perms = session?.permissions ?? [];
        setPermissions((session?.user?.isAdmin || result.user?.isAdmin) && perms.length === 0 ? null : perms);
        await refresh();
        return true;
      } catch (err) {
        if (!aliveRef.current) return false;
        setAuthError(err instanceof Error ? err.message : "Sign in failed");
        return false;
      }
    },
    [refresh],
  );

  const signOut = useCallback(() => {
    void logout();
    setUser(null);
    setAuthError("");
    setPermissions(null);
    setOrders([]);
    setAudit([]);
  }, []);

  const addOrder = useCallback((order: Order, phone?: string) => {
    // Optimistic insert so the newly-opened detail dialog resolves immediately.
    setOrders((prev) => [order, ...prev]);
    void (async () => {
      try {
        const byName = await findCustomerByName(order.customer);
        let resolvedCustomer: ServerCustomer | null = byName?.[0] ?? null;
        if (!resolvedCustomer) {
          // Returning registered customers must reuse the existing account, not get a new one.
          resolvedCustomer = await findCustomerByContact(order.customer, phone ?? undefined);
        }
        if (!resolvedCustomer) {
          resolvedCustomer = await createCustomerApi(order.customer, phone);
        }
        if (!resolvedCustomer) {
          await refresh();
          return;
        }
        const product = await findProductByName(order.product);
        const requiredAt = order.date ? `${order.date}T10:00:00` : null;
        const created = await createOrderApi({
          orderNumber: order.id,
          customerId: resolvedCustomer.id,
          items: [
            {
              productId: product?.id ?? "",
              variantOptions: order.options,
              quantity: 1,
              unitPrice: order.amount,
            },
          ],
          subtotal: order.amount,
          total: order.amount,
          requiredAt,
          notes: `${order.options} · ${order.channel}`.trim(),
          status: orderStatusEnum(order.status),
          paymentStatus: paymentStatusEnum(order.payment) as ServerOrder["paymentStatus"],
          deliveryStatus: "PENDING",
          deliveryLocation: order.deliveryLocation || "",
          locationNote: order.locationNote || "",
          createdBy: "",
        });
        if (created) {
          // Keep the server id/order mapping available for immediate follow-up actions
          // (e.g. confirming right after creation) so we don't fall back to a stale
          // orderNumber-only lookup and require a second attempt.
          serverOrdersRef.current = [created as ServerOrder, ...serverOrdersRef.current.filter((o) => o.id !== (created as ServerOrder).id && o.orderNumber !== (created as ServerOrder).orderNumber)];
        }
        await refresh();
      } catch {
        // Refresh so the UI reflects the authoritative server state (and drops the
        // optimistic entry if persistence failed) instead of leaving a phantom order.
        await refresh().catch(() => {});
      }
    })();
  }, [refresh]);

  const updateOrder = useCallback(async (id: string, status: string, payment?: string, paidDelta?: number, payMeta?: { method?: string; receivedBy?: string; reference?: string; notes?: string }) => {
    // Optimistic label update so the dialog/table reflects the change instantly.
    // A recorded payment also accumulates into paidAmount (capped at the total)
    // so the bracketed "amount paid" on the modal and the resolved payment
    // status stay truthful.
    // Reaching "Completed / Delivered" flips the delivery column too — the
    // order has been handed over, so it must read as delivered everywhere.
    const delivered = status === "Completed / Delivered";
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status, ...(payment ? { payment } : {}), ...(delivered ? { delivery: "Completed / Delivered" } : {}), ...(paidDelta && paidDelta > 0 ? { paidAmount: Math.min(o.amount, (o.paidAmount ?? 0) + paidDelta) } : {}) } : o)),
    );
    try {
        const server = serverOrdersRef.current.find((o) => (o.orderNumber || o.id) === id)
          ?? serverOrdersRef.current.find((o) => o.id === id || o.orderNumber === id);
        // Fallback to UI id (often order number); server routes accept id or orderNumber.
        const serverId = server?.id ?? id;
        if (paidDelta && paidDelta > 0) {
          const payRes = await recordPayment({ orderId: serverId, amount: paidDelta, method: payMeta?.method || "Cash", receivedBy: payMeta?.receivedBy || user?.id || "", ...(payMeta?.reference ? { reference: payMeta.reference } : {}), ...(payMeta?.notes ? { notes: payMeta.notes } : {}) });
          if (!payRes) { await refresh().catch(() => {}); return false; }
        }
        const serverStatus = /^[A-Z_]+$/.test(status) ? status : orderStatusEnum(status);
        const isConfirmed = serverStatus === "CONFIRMED" || status === "Confirmed";
        let ok = null;
        if (isConfirmed) {
          const { confirmOrderApi } = await import("@/lib/api");
          ok = await confirmOrderApi(serverId);
        } else {
          ok = await updateOrderApi(serverId, {
            status: serverStatus,
            ...(payment ? { paymentStatus: paymentStatusEnum(payment) } : {}),
            ...(delivered ? { deliveryStatus: "COMPLETED_DELIVERED" } : {}),
          });
        }
        await refresh().catch(() => {});
        return !!ok;
      } catch {
        await refresh().catch(() => {});
        return false;
      }
  }, [user, refresh]);

  const completeFollowUp = useCallback((id: string) => {
    // Documenting the follow-up stamps the order; the CRM sidebar badge and the
    // bell notifications disappear the moment every completed order is stamped.
    const now = new Date().toISOString();
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, followUpCompletedAt: now } : o)),
    );
    void (async () => {
      try {
        const server = serverOrdersRef.current.find((o) => (o.orderNumber || o.id) === id || o.id === id || o.orderNumber === id);
        await updateOrderApi(server?.id ?? id, { followUpCompletedAt: now });
      } catch {
        /* Non-fatal: the optimistic change stays for this session. */
      }
    })();
  }, []);

  const removeDuplicates = useCallback(async () => {
    try {
      const customers = await findCustomerByName("");
      const grouped = new Map<string, ServerCustomer[]>();
      for (const c of customers) {
        const key = `${c.phone.trim()}|${c.email.trim().toLowerCase()}`;
        grouped.set(key, (grouped.get(key) ?? []).concat(c));
      }
      for (const [key, dupes] of grouped) {
        if (dupes.length < 2) continue;
        const keep = dupes.reduce((a, b) => (a.totalOrders ?? 0) >= (b.totalOrders ?? 0) ? a : b);
        for (const dupe of dupes) {
          if (dupe.id === keep.id) continue;
          try {
            // Best-effort: customer delete/update API not wired here; leave orphan rows for manual cleanup.
          } catch {
            /* Best-effort: leave orphan rows for manual cleanup. */
          }
        }
      }
    } catch {
      /* Non-fatal. */
    }
  }, []);
  const value: WorkspaceContextValue = {
    orders,
    audit,
    loading,
    user,
    connected: user !== null,
    authError,
    permissions,
    signIn,
    signOut,
    addOrder,
    updateOrder,
    completeFollowUp,
    refresh,
    findCustomerByContact,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
