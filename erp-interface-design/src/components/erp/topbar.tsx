import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CalendarDays, CheckCheck, ChevronRight, CircleAlert, Moon, PanelLeftClose, PanelLeftOpen, Search, ShoppingBag, Sun, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "./ui";
import { getUnreadCount, listNotifications, markAllAsRead, markAsRead, type ServerNotification, type ServerUser } from "@/lib/api";

/** First /workspace/<module> pair of a notification's deep link — the router
 * only knows /workspace/:module, so deeper targets would 404. */
function notificationTarget(n: ServerNotification): string {
  const a = n.actionUrl || "";
  if (a.startsWith("/workspace/")) return "/" + a.split("/").filter(Boolean).slice(0, 2).join("/");
  return "/workspace/dashboard";
}

function notificationIcon(n: ServerNotification) {
  if (n.priority === "HIGH" || n.priority === "CRITICAL") return CircleAlert;
  if (/deliver|dispatch/i.test(n.title)) return Truck;
  if (/order|quot|inquir|payment/i.test(n.title)) return ShoppingBag;
  return Bell;
}
export function Topbar({collapsed,setCollapsed,module,config,search,setSearch,connected,user,setLoginOpen,notification,setNotification,setNotice,theme,setTheme,followUps=[]}: {collapsed:boolean;setCollapsed:(v:boolean)=>void;module:string;config:{label:string}|undefined;search:string;setSearch:(v:string)=>void;connected:boolean;user:ServerUser|null;setLoginOpen:(v:boolean)=>void;notification:boolean;setNotification:(v:boolean)=>void;setNotice:(s:string)=>void;theme:'light'|'dark'|null;setTheme:(t:'light'|'dark')=>void;followUps?:{id:string;customer:string}[]}) {
  // Live inbox (E4 remainder): real per-user notifications from
  // GET /notifications + unread badge, loaded when signed in and refreshed
  // each time the panel opens. Follow-ups (store-derived) stay on top.
  const [notifs, setNotifs] = useState<ServerNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const load = useCallback(async () => {
    const [rows, count] = await Promise.all([listNotifications(20), getUnreadCount()]);
    setNotifs(rows);
    setUnread(count);
  }, []);
  useEffect(() => { if (connected) void load(); }, [connected, load]);
  const togglePanel = () => {
    const next = !notification;
    setNotification(next);
    if (next) void load();
  };
  const badgeCount = unread + followUps.length;
  const todayLabel = new Date().toLocaleDateString("en-UG", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  return    <header className="topbar"><div className="breadcrumb"><IconButton icon={collapsed?PanelLeftOpen:PanelLeftClose} label={collapsed?'Expand sidebar':'Collapse sidebar'} onClick={()=>setCollapsed(!collapsed)}/><span>Workspace</span><ChevronRight size={14}/><strong>{module==='dashboard'?'Overview':config?.label}</strong></div><label className="topbar-search"><Search size={15}/><input aria-label="Search workspace" placeholder="Search orders, customers..." value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="topbar-actions">{connected?<span className="sample-tag"><span className="presence-dot"/>Live · {user?.displayName||user?.username}</span>:<Button variant="outline" size="sm" onClick={()=>setLoginOpen(true)}>Sign in</Button>}<span className="today"><CalendarDays size={14}/> {todayLabel}</span><div className="notification-wrap"><Button variant="ghost" size="icon" aria-label={badgeCount>0?`Notifications - ${unread} unread, ${followUps.length} follow-up${followUps.length===1?"":"s"} requested`:"Notifications"} title="Notifications" onClick={togglePanel}><Bell/>{badgeCount>0&&<i className="has-followups"/>}</Button>{notification&&<div className="notification-panel"><div className="panel-heading"><strong>Notifications</strong><IconButton icon={CheckCheck} label="Mark all read" onClick={async()=>{const n=await markAllAsRead(user?.id);setNotice(n>0?`${n} notification${n===1?"":"s"} marked as read`:"All notifications marked as read");void load();}}/></div>{followUps.map(o=><Link key={o.id} to="/workspace/crm" onClick={()=>setNotification(false)} className="notification-followup"><Users/><div><strong>Follow up with {o.customer}</strong><span>{o.id} is Completed / Delivered - document the follow-up in CRM.</span></div></Link>)}{notifs.map(n=>{const Icon=notificationIcon(n);return <Link key={n.id} to={notificationTarget(n)} onClick={()=>{setNotification(false);if(!n.readAt)void markAsRead(n.id);}} className={`notif-item${n.readAt?"":" notif-unread"}`}><Icon/><div><strong>{n.title}</strong><span>{n.message}</span></div></Link>;})}{notifs.length===0&&followUps.length===0&&<p className="notif-empty">You are all caught up.</p>}</div>}</div><Button variant="ghost" size="icon" className="theme-toggle" aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'} title={theme==='dark'?'Switch to light mode':'Switch to dark mode'} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun/>:<Moon/>}</Button></div></header>
}
