import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  BarChart3,
  BookMarked,
  CalendarDays,
  CheckCheck,
  ChefHat,
  ChevronRight,
  CircleAlert,
  Cylinder,
  Globe,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Scale,
  ShoppingBag,
  ShoppingCart,
  Sun,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "./ui";
import {
  API_BASE,
  clearNotifications,
  deleteNotification,
  getToken,
  getUnreadCount,
  listNotifications,
  type ServerNotification,
  type ServerUser,
} from "@/lib/api";
import { usePush } from "@/hooks/usePush";

/** First /workspace/<module> pair of a notification's deep link — the router
 * only knows /workspace/:module, so deeper targets would 404. */
function notificationTarget(n: ServerNotification): string {
  const raw = n.deepLink || n.actionUrl || "";
  try {
    const u = raw.startsWith("http") ? new URL(raw) : new URL(raw || "/", window.location.origin);
    if (u.origin === window.location.origin && u.pathname.startsWith("/workspace/")) {
      return "/" + u.pathname.split("/").filter(Boolean).slice(0, 2).join("/");
    }
  } catch {
    if (raw.startsWith("/workspace/")) return "/" + raw.split("/").filter(Boolean).slice(0, 2).join("/");
  }
  return "/workspace/dashboard";
}

function notificationIcon(n: ServerNotification) {
  if (n.priority === "HIGH" || n.priority === "CRITICAL") return CircleAlert;
  if (/deliver|dispatch/i.test(n.title)) return Truck;
  if (/order|quot|inquir|payment/i.test(n.title)) return ShoppingBag;
  return Bell;
}

export function Topbar({
  collapsed,
  setCollapsed,
  module,
  config,
  search,
  setSearch,
  connected,
  user,
  setLoginOpen,
  notification,
  setNotification,
  setNotice,
  theme,
  setTheme,
  followUps = [],
  onMenu,
  menuOpen,
  isMobile = false,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  module: string;
  config: { label: string } | undefined;
  search: string;
  setSearch: (v: string) => void;
  connected: boolean;
  user: ServerUser | null;
  setLoginOpen: (v: boolean) => void;
  notification: boolean;
  setNotification: (v: boolean) => void;
  setNotice: (s: string) => void;
  theme: "light" | "dark" | null;
  setTheme: (t: "light" | "dark") => void;
  followUps?: { id: string; customer: string }[];
  onMenu?: () => void;
  menuOpen?: boolean;
  isMobile?: boolean;
}) {
  const navigate = useNavigate();
  const [dsOpen, setDsOpen] = useState(false);
  const [notifs, setNotifs] = useState<ServerNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMobile) setDsOpen(false);
  }, [isMobile]);
  useEffect(() => {
    if (typeof menuOpen === "boolean") setDsOpen(menuOpen);
  }, [menuOpen]);

  const breadcrumbMenu = isMobile && dsOpen;

  const menuItem = (Icon: ComponentType<{ size?: number }>, label: string, active?: boolean, href?: string) => (
    <a
      key={label}
      className={`nav-item${active ? " active" : ""}`}
      href={href ?? "#"}
      style={href ? undefined : { cursor: "pointer" }}
      onClick={() => {
        if (!href) {
          onMenu?.();
        }
        setDsOpen(false);
      }}
    >
      <Icon size={16} />
      <span>{label}</span>
      {active && <span className="nav-count"> now</span>}
    </a>
  );

  const dsMenu = (
    <div className="ds breadcrumb-menu" role="navigation" aria-label="Workspace menu">
      <div className="ds breadcrumb-menu-title">{module === "dashboard" ? "Overview" : config?.label}</div>
      <div className="ds breadcrumb-menu-items">
        {menuItem(CheckCheck, "Dashboard", module === "dashboard", "/workspace/dashboard")}
        {menuItem(ShoppingBag, "Sales", module === "sales", "/workspace/sales")}
        {menuItem(ChefHat, "Production", module === "production", "/workspace/production")}
        {menuItem(Cylinder, "Inventory", module === "inventory", "/workspace/inventory")}
        {menuItem(ShoppingCart, "Purchasing", module === "purchasing", "/workspace/purchasing")}
        {menuItem(Wallet, "Finance", module === "finance", "/workspace/finance")}
        {menuItem(Users, "Staff", module === "staff", "/workspace/staff")}
        {menuItem(Users, "CRM", module === "crm", "/workspace/crm")}
        {menuItem(Globe, "Web app", module === "webapp", "/workspace/webapp")}
        {menuItem(BookMarked, "Catalogue", module === "catalogue", "/workspace/catalogue")}
        {menuItem(BarChart3, "Analytics", module === "analytics", "/workspace/analytics")}
        {menuItem(Scale, "Administration", module === "administration", "/workspace/administration")}
      </div>
    </div>
  );

  const load = useCallback(async () => {
    if (!connected) return;
    setLoadingNotifs(true);
    try {
      const [rows, count] = await Promise.all([listNotifications(50), getUnreadCount()]);
      setNotifs(rows);
      setUnread(typeof count === "number" ? count : rows.length);
    } finally {
      setLoadingNotifs(false);
    }
  }, [connected]);

  const { requestEnable } = usePush({
    enabled: Boolean(connected && user),
    onPush: () => {
      void load();
    },
    onNavigate: (url) => {
      try {
        const u = url.startsWith("http") ? new URL(url) : new URL(url || "/", window.location.origin);
        if (u.origin === window.location.origin) navigate(u.pathname + u.search + u.hash);
      } catch {
        if (url.startsWith("/")) navigate(url);
      }
    },
    showNotice: setNotice,
  });

  // Initial load and periodic refresh while connected (lightweight polling fallback).
  useEffect(() => {
    if (!connected) return;
    void load();
    const t = window.setInterval(() => {
      void getUnreadCount().then((c) => setUnread(typeof c === "number" ? c : 0)).catch(() => {});
    }, 30000);
    return () => window.clearInterval(t);
  }, [connected, load]);

  // Live per-user notification stream (SSE) as an instant-update path alongside push/polling.
  useEffect(() => {
    if (!connected) return;
    const token = getToken();
    if (!token || typeof window === "undefined" || typeof EventSource === "undefined") return;
    const base = (API_BASE || "/api/v1").replace(/\/$/, "");
    const url = `${base}/notifications/stream?token=${encodeURIComponent(token)}`;
    let es: EventSource | null = null;
    try {
      es = new EventSource(url);
    } catch {
      return;
    }
    const onCreated = () => {
      void load();
    };
    es.addEventListener("notification.created", onCreated as EventListener);
    es.onmessage = onCreated;
    es.onerror = () => {
      // EventSource will auto-reconnect; polling remains as fallback.
    };
    return () => {
      es?.removeEventListener("notification.created", onCreated as EventListener);
      es?.close();
    };
  }, [connected, load]);

  // Refresh when panel opens.
  useEffect(() => {
    if (notification && connected) void load();
  }, [notification, connected, load]);

  useEffect(() => {
    if (!isMobile) setSearchOpen(false);
  }, [isMobile]);

  // Close drawer on outside click (desktop) / escape.
  useEffect(() => {
    if (!notification) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (panelRef.current && t && !panelRef.current.contains(t)) setNotification(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotification(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [notification, setNotification]);

  const badgeCount = Math.max(unread, notifs.length) + followUps.length;
  const badgeLabel = badgeCount > 99 ? "99+" : String(badgeCount);

  const openPanel = useCallback(() => {
    setNotification(true);
    void requestEnable(); // interactive-friendly attempt when user engages bell
    void load();
  }, [load, requestEnable, setNotification]);

  const closePanel = useCallback(() => {
    setNotification(false);
  }, [setNotification]);

  const togglePanel = () => {
    if (notification) closePanel();
    else openPanel();
  };

  const ackOne = useCallback(
    async (n: ServerNotification) => {
      const target = notificationTarget(n);
      setNotifs((prev) => prev.filter((x) => x.id !== n.id && x.recipientId !== n.recipientId));
      setUnread((u) => Math.max(0, u - 1));
      setNotification(false);
      navigate(target);
      try {
        await deleteNotification(n.recipientId || n.id);
      } catch {
        /* best effort; will reconcile on next refresh */
      } finally {
        void getUnreadCount().then((c) => setUnread(typeof c === "number" ? c : 0)).catch(() => {});
      }
    },
    [navigate, setNotification],
  );

  const clearAll = useCallback(async () => {
    const had = notifs.length;
    setNotice(had > 0 ? "Clearing notifications…" : "No notifications to clear");
    setNotifs([]);
    setUnread(0);
    try {
      const removed = await clearNotifications();
      setNotice(removed > 0 ? `${removed} notification${removed === 1 ? "" : "s"} cleared` : "All caught up");
    } catch {
      setNotice("Could not clear notifications");
      void load();
    }
  }, [load, notifs.length, setNotice]);

  const todayLabel = new Date().toLocaleDateString("en-UG", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <header className="topbar">
      <div className={"breadcrumb" + (breadcrumbMenu ? " is-ds-open" : "")}
      >
        {breadcrumbMenu ? (
          <div className="breadcrumb-menu-wrap">{dsMenu}</div>
        ) : isMobile ? (
          <IconButton
            icon={Menu}
            label="Open workspace menu"
            onClick={() => {
              setDsOpen(true);
              onMenu?.();
            }}
            className="menu-stack"
          />
        ) : (
          <IconButton
            icon={collapsed ? PanelLeftOpen : PanelLeftClose}
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          />
        )}
        <span>Workspace</span>
        <ChevronRight size={14} />
        <strong>{module === "dashboard" ? "Overview" : config?.label}</strong>
      </div>
      {!breadcrumbMenu && (!isMobile || searchOpen) ? (
        <label className={"topbar-search" + (isMobile ? " is-open" : "")}
        >
          <Search size={15} />
          <input
            autoFocus={isMobile && searchOpen}
            aria-label="Search workspace"
            placeholder="Search orders, customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchOpen(false);
            }}
          />
          {isMobile && <IconButton icon={X} label="Close search" onClick={() => setSearchOpen(false)} />}
        </label>
      ) : null}
      <div className="topbar-actions">
        {connected ? (
          <span className="sample-tag">
            <span className="presence-dot" />
            Live · {user?.displayName || user?.username}
          </span>
        ) : (
          !isMobile && (
            <Button variant="outline" size="sm" onClick={() => setLoginOpen(true)}>
              Sign in
            </Button>
          )
        )}
        {!isMobile && (
          <span className="today">
            <CalendarDays size={14} /> {todayLabel}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="theme-toggle"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
        <div className="notification-wrap" ref={panelRef}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={badgeCount > 0 ? `Notifications (${badgeCount})` : "Notifications"}
            title="Notifications"
            onClick={togglePanel}
          >
            <Bell />
            {badgeCount > 0 && (
              <span className="notif-badge-count" aria-hidden="true">
                {badgeLabel}
              </span>
            )}
          </Button>
          {notification && (
            <div className="notification-panel" role="dialog" aria-label="Notifications">
              <div className="panel-heading">
                <strong>Notifications</strong>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <IconButton icon={CheckCheck} label="Clear all" onClick={() => void clearAll()} />
                  <IconButton icon={X} label="Close" onClick={closePanel} />
                </div>
              </div>

              {followUps.map((o) => (
                <Link
                  key={o.id}
                  to="/workspace/crm"
                  onClick={() => setNotification(false)}
                  className="notification-followup"
                >
                  <Users />
                  <div>
                    <strong>Follow up with {o.customer}</strong>
                    <span>{o.id} is Completed / Delivered - document the follow-up in CRM.</span>
                  </div>
                </Link>
              ))}

              {loadingNotifs && notifs.length === 0 ? (
                <p className="notif-empty">Loading notifications…</p>
              ) : notifs.length === 0 && followUps.length === 0 ? (
                <p className="notif-empty">You are all caught up.</p>
              ) : (
                notifs.map((n) => {
                  const Icon = notificationIcon(n);
                  return (
                    <Link
                      key={n.recipientId || n.id}
                      to={notificationTarget(n)}
                      onClick={(e) => {
                        e.preventDefault();
                        void ackOne(n);
                      }}
                      className={`notif-item${n.readAt ? "" : " notif-unread"}`}
                    >
                      <Icon />
                      <div>
                        <strong>{n.title}</strong>
                        <span>{n.message}</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
