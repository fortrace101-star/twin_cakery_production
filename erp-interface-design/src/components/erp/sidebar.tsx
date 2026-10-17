import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Boxes, CakeSlice, ChartNoAxesCombined, ChevronDown, ChevronUp, ChefHat, CircleHelp, Globe, LayoutDashboard, LogOut, MapPin, Settings, ShoppingBag, Truck, Users, Wallet, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/twin-cakery-logo.png";
import { modules } from "./data";
import type { ServerUser } from "@/lib/api";
const icons: Record<string, LucideIcon> = { Users, ShoppingBag, CakeSlice, Globe, ChefHat, Boxes, Truck, MapPin, Wallet, ChartNoAxesCombined, Settings };

function initialsOf(name?: string | null): string {
  if (!name) return "TC";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TC";
  const letters = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase());
  return letters.join("") || "TC";
}

export function Sidebar({module,setTab,setSearch,setStatusFilter,setHelp,user,connected,signOut,setLoginOpen,activeOrders=0}: {module:string;setTab:(v:string)=>void;setSearch:(v:string)=>void;setStatusFilter:(v:string)=>void;setHelp:(v:boolean)=>void;user:ServerUser|null;connected:boolean;signOut:()=>void;setLoginOpen:(v:boolean)=>void;activeOrders?:number}) {
  const navRef = useRef<HTMLElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const updateArrows = () => {
    const el = navRef.current;
    if (!el) return;
    setCanUp(el.scrollTop > 2);
    setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };
  useEffect(() => { updateArrows(); }, []);
  useEffect(() => {
    const onResize = () => updateArrows();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // Close the profile menu when clicking anywhere outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const scrollBy = (delta: number) => navRef.current?.scrollBy({ top: delta, behavior: "smooth" });

  const displayName = connected && user ? (user.displayName || user.username) : "Alex Morgan";
  const subtitle = connected && user ? user.role : "Admin / Proprietor";

  return (
  <aside className="sidebar">

   <Link to="/" className="brand"><img src={logo} alt="Twin Cakery" width="48" height="48"/><div><strong>Twin Cakery<span className="brand-dot">.</span></strong><span>Taste the secret</span></div></Link>

   <div className="workspace-switch"><span className="workspace-avatar">TC</span><div><strong>Business workspace</strong><small>Proprietor</small></div><ChevronDown size={14}/></div>

   <div className="sidebar-nav-area">
    <nav aria-label="Main navigation" ref={navRef} onScroll={updateArrows}>

     <Button variant="ghost" asChild className={`nav-item ${module==='dashboard'?'nav-active':''}`} title="Dashboard"><Link to="/"><LayoutDashboard/><span>Dashboard</span></Link></Button>

     {['WORKSPACE','OPERATIONS','BUSINESS'].map(group=><div className="nav-group" key={group}><p>{group}</p>{modules.filter(m=>m.group===group).map(m=>{const Icon=icons[m.icon]||LayoutDashboard;return <Button variant="ghost" asChild key={m.id} title={m.label} className={`nav-item ${module===m.id?'nav-active':''}`}><Link to={`/workspace/${m.id}`} onClick={()=>{setTab('');setSearch('');setStatusFilter('All statuses');}}><Icon/><span>{m.label}</span>{m.id==='sales'&&activeOrders>0&&<small className="nav-count">{activeOrders}</small>}</Link></Button>})}</div>)}

    </nav>
    {canUp && <button type="button" className="scroll-arrow scroll-up" aria-label="Scroll navigation up" title="Scroll up" onClick={()=>scrollBy(-180)}><ChevronUp size={16}/></button>}
    {canDown && <button type="button" className="scroll-arrow scroll-down" aria-label="Scroll navigation down" title="Scroll down" onClick={()=>scrollBy(180)}><ChevronDown size={16}/></button>}
   </div>

   <div className="sidebar-bottom"><Button variant="ghost" className="nav-item" onClick={()=>setHelp(true)} title="Help & support"><CircleHelp/><span>Help & support</span></Button><div className="team-presence"><span className="presence-dot"/><span>Let’s bake something great.</span></div><div className="profile-wrap" ref={profileRef}><button type="button" className={`profile ${menuOpen?'profile-open':''}`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><span className="profile-avatar">{initialsOf(user?.displayName || user?.username)}</span><div><strong>{displayName}</strong><small>{subtitle}</small></div><ChevronDown size={14}/></button>{menuOpen&&<div className="profile-menu" role="menu"><div className="profile-menu-head"><strong>{displayName}</strong><small>{connected && user ? (user.email || subtitle) : 'Interface preview'}</small></div>{connected ? <button type="button" className="profile-menu-item" role="menuitem" onClick={()=>{setMenuOpen(false);signOut();}}><LogOut size={15}/>Sign out</button> : <button type="button" className="profile-menu-item" role="menuitem" onClick={()=>{setMenuOpen(false);setLoginOpen(true);}}><LogOut size={15}/>Sign in</button>}</div>}</div></div>

  </aside>

  );
}
