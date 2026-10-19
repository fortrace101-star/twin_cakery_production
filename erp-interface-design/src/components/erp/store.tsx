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
import { initialOrders, type Order } from "./data";

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
  updateOrder: (id: string, status: string, payment?: string, paidDelta?: number, payMeta?: { method?: string; receivedBy?: string; reference?: string; notes?: string }) => void;
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
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
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
    } else {
      setOrders(initialOrders);
    }
    setAudit((logs as ServerAuditLog[]).map(formatAudit));
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      // Restore a previously stored session (token survives refresh via
      // api.ts setToken). If none is present we stay on sample data.
      const session = await me();
      if (!aliveRef.current) return;
      if (session) {
        setUser(session.user);
        setPermissions(session.permissions ?? []);
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
        setPermissions(session?.permissions ?? []);
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
    setOrders(initialOrders);
    setAudit([]);
  }, []);

  const addOrder = useCallback((order: Order, phone?: string) => {
    // Optimistic insert so the newly-opened detail dialog resolves immediately.
    setOrders((prev) => [order, ...prev]);
    void (async () => {
      try {
        let customer = await findCustomerByName(order.customer);
        // Customers outside the CRM list are registered right here — with the
        // phone number captured on the new-order form.
        if (!customer) customer = await createCustomerApi(order.customer, phone);
        if (!customer) return;
        const product = await findProductByName(order.product);
        const requiredAt = order.date ? `${order.date}T10:00:00` : null;
        await createOrderApi({
          orderNumber: order.id,
          customerId: customer.id,
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
          createdBy: "",
        });
      } catch {
        /* Leave the optimistic entry in place; it persists for this session. */
      }
    })();
  }, []);

  const updateOrder = useCallback((id: string, status: string, payment?: string, paidDelta?: number, payMeta?: { method?: string; receivedBy?: string; reference?: string; notes?: string }) => {
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
    void (async () => {
      try {
        const server = serverOrdersRef.current.find((o) => (o.orderNumber || o.id) === id);
        if (!server) return;
        if (paidDelta && paidDelta > 0) {
          // Land the payment in the server ledger (POST /payments) so it
          // survives refreshes; the server derives PARTIALLY_PAID/PAID from
          // the ledger (spec §14), which refresh() then re-reads.
          await recordPayment({ orderId: server.id, amount: paidDelta, method: payMeta?.method || "Cash", receivedBy: payMeta?.receivedBy || user?.id || "", ...(payMeta?.reference ? { reference: payMeta.reference } : {}), ...(payMeta?.notes ? { notes: payMeta.notes } : {}) });
        }
        await updateOrderApi(server.id, {
          status: orderStatusEnum(status),
          ...(payment ? { paymentStatus: paymentStatusEnum(payment) } : {}),
          ...(delivered ? { deliveryStatus: "COMPLETED_DELIVERED" } : {}),
        });
      } catch {
        /* Non-fatal: the optimistic change stays for this session. */
      }
    })();
  }, [user]);

  const completeFollowUp = useCallback((id: string) => {
    // Documenting the follow-up stamps the order; the CRM sidebar badge and the
    // bell notifications disappear the moment every completed order is stamped.
    const now = new Date().toISOString();
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, followUpCompletedAt: now } : o)),
    );
    void (async () => {
      try {
        const server = serverOrdersRef.current.find((o) => (o.orderNumber || o.id) === id);
        if (!server) return;
        await updateOrderApi(server.id, { followUpCompletedAt: now });
      } catch {
        /* Non-fatal: the optimistic change stays for this session. */
      }
    })();
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
