import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { Bell, BarChart3, BookMarked, CalendarDays, Check, CheckCheck, ChefHat, ChevronRight, CircleAlert, Cylinder, Globe, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Scale, ShoppingBag, ShoppingCart, Sun, Truck, Users, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "./ui";
import { getUnreadCount, listNotifications, markAllAsRead, markAsRead, deleteNotification, type ServerNotification, type ServerUser } from "@/lib/api";

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
export function Topbar({collapsed,setCollapsed,module,config,search,setSearch,connected,user,setLoginOpen,notification,setNotification,setNotice,theme,setTheme,followUps=[],onMenu,menuOpen,isMobile=false}: {collapsed:boolean;setCollapsed:(v:boolean)=>void;module:string;config:{label:string}|undefined;search:string;setSearch:(v:string)=>void;connected:boolean;user:ServerUser|null;setLoginOpen:(v:boolean)=>void;notification:boolean;setNotification:(v:boolean)=>void;setNotice:(s:string)=>void;theme:'light'|'dark'|null;setTheme:(t:'light'|'dark')=>void;followUps?:{id:string;customer:string}[];onMenu?:()=>void;menuOpen?:boolean;isMobile?:boolean}) {
  const [dsOpen, setDsOpen] = useState(false);
  const dsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (!isMobile) setDsOpen(false); }, [isMobile]);
  useEffect(() => { if (typeof menuOpen === 'boolean') setDsOpen(menuOpen); }, [menuOpen]);
  const breadcrumbMenu = isMobile && dsOpen;
  const menuItem = (Icon: ComponentType<{ size?: number }>, label: string, active?: boolean, href?: string) => (
    <a key={label} className={`nav-item${active?' active':''}`} href={href ?? '#'} style={href ? undefined : { cursor: 'pointer' }} onClick={() => {    if (!href) { onMenu?.(); } setDsOpen(false); }}>
      <Icon size={16} />
      <span>{label}</span>
      {active && <span className='nav-count'> now</span>}
    </a>
  );
  const dsMenu = (
    <div className="ds breadcrumb-menu" role="navigation" aria-label="Workspace menu">
      <div className="ds breadcrumb-menu-title">{module==='dashboard'?'Overview':config?.label}</div>
      <div className="ds breadcrumb-menu-items">
        {menuItem(CheckCheck, 'Dashboard', module==='dashboard', '/workspace/dashboard')}
        {menuItem(ShoppingBag, 'Sales', module==='sales', '/workspace/sales')}
        {menuItem(ChefHat, 'Production', module==='production', '/workspace/production')}
        {menuItem(Cylinder, 'Inventory', module==='inventory', '/workspace/inventory')}
        {menuItem(ShoppingCart, 'Purchasing', module==='purchasing', '/workspace/purchasing')}
        {menuItem(Wallet, 'Finance', module==='finance', '/workspace/finance')}
        {menuItem(Users, 'Staff', module==='staff', '/workspace/staff')}
        {menuItem(Users, 'CRM', module==='crm', '/workspace/crm')}
        {menuItem(Globe, 'Web app', module==='webapp', '/workspace/webapp')}
        {menuItem(BookMarked, 'Catalogue', module==='catalogue', '/workspace/catalogue')}
        {menuItem(BarChart3, 'Analytics', module==='analytics', '/workspace/analytics')}
        {menuItem(Scale, 'Administration', module==='administration', '/workspace/administration')}
      </div>
    </div>
  );
  const [notifs, setNotifs] = useState<ServerNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const load = useCallback(async () => {
    const [rows, count] = await Promise.all([listNotifications(20), getUnreadCount()]);
    setNotifs(rows);
    setUnread(count);
  }, []);
  const badgeCount = notifs.length + followUps.length;
  const openPanel = useCallback(() => { setNotification(true); void load(); }, [load]);
  const closePanel = useCallback(() => { if (notifs.length === 0 && badgeCount > 0) { void markAllAsRead(user?.id); } setNotification(false); }, [notifs, badgeCount, user?.id]);
  useEffect(() => { if (connected) void load(); }, [connected, load]);
  useEffect(() => { if (!isMobile) setSearchOpen(false); }, [isMobile]);
  const togglePanel = () => { if (notification) { closePanel(); } else { openPanel(); } };
  const todayLabel = new Date().toLocaleDateString("en-UG", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const showSearch = !isMobile || searchOpen;
  return (
    <header className="topbar">
      <div className={"breadcrumb" + (breadcrumbMenu ? " is-ds-open" : "")}>
        {breadcrumbMenu
          ? <div className="breadcrumb-menu-wrap">{dsMenu}</div>
          : isMobile
            ? <IconButton icon={Menu} label="Open workspace menu" onClick={() => { setDsOpen(true); onMenu?.(); }} className="menu-stack"/>
            : <IconButton icon={collapsed?PanelLeftOpen:PanelLeftClose} label={collapsed?'Expand sidebar':'Collapse sidebar'} onClick={()=>setCollapsed(!collapsed)}/>}
        <span>Workspace</span><ChevronRight size={14}/><strong>{module==='dashboard'?'Overview':config?.label}</strong>
      </div>
      {!breadcrumbMenu && (!isMobile || searchOpen)
        ? <label className={'topbar-search' + (isMobile ? ' is-open' : '')}>
            <Search size={15}/>
            <input autoFocus={isMobile && searchOpen} aria-label="Search workspace" placeholder="Search orders, customers..." value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setSearchOpen(false); }}/>
            {isMobile && <IconButton icon={X} label="Close search" onClick={() => setSearchOpen(false)} />}
          </label>
        : null}
      <div className="topbar-actions">
        {connected ? <span className="sample-tag"><span className="presence-dot"/>Live · {user?.displayName||user?.username}</span> : (!isMobile && <Button variant="outline" size="sm" onClick={()=>setLoginOpen(true)}>Sign in</Button>)}
        {!isMobile && <span className="today"><CalendarDays size={14}/> {todayLabel}</span>}
        <Button variant="ghost" size="icon" className="theme-toggle" aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'} title={theme==='dark'?'Switch to light mode':'Switch to dark mode'} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun/>:<Moon/>}</Button>
        <div className="notification-wrap">
          <Button variant="ghost" size="icon" aria-label={badgeCount>0?`Notifications (${badgeCount})`:"Notifications"} title="Notifications" onClick={togglePanel}><Bell/>{badgeCount>0&&<span className="notif-badge-count" aria-hidden="true">{badgeCount>99?'99+':badgeCount}</span>}</Button>
          {notification && <div className="notification-panel"><div className="panel-heading"><strong>Notifications</strong><IconButton icon={CheckCheck} label="Mark all read" onClick={()=>{        setNotice('Clearing notifications…');
        setNotifs([]);setUnread(0);setNotification(false);
        void markAllAsRead(user?.id).then((n)=>setNotice(n>0?`${n} notification${n===1?"":"s"} marked as read`:"All notifications marked as read")).catch(()=>setNotice("All notifications marked as read"));
        }}/></div>{followUps.map(o=><Link key={o.id} to="/workspace/crm" onClick={()=>setNotification(false)} className="notification-followup"><Users/><div><strong>Follow up with {o.customer}</strong><span>{o.id} is Completed / Delivered - document the follow-up in CRM.</span></div></Link>)}{notifs.map(n=>{const Icon=notificationIcon(n);return <Link key={n.id} to={notificationTarget(n)}        onClick={()=>{setNotification(false);if(!n.readAt){void markAsRead(n.id);setUnread(u=>Math.max(0,u-1));}        setNotifs(prev=>prev.filter(x=>x.id!==n.id));        setUnread(u=>u>0?u-1:0);        void deleteNotification(n.id, user?.id);        }} className={`notif-item${n.readAt?"":" notif-unread"}`}><Icon/><div><strong>{n.title}</strong><span>{n.message}</span></div></Link>;})}{notifs.length===0&&followUps.length===0&&<p className="notif-empty">You are all caught up.</p>}</div>}
        </div>
      </div>
    </header>
  );
}
