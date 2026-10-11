import { Link } from "react-router-dom";
import { Boxes, CakeSlice, ChartNoAxesCombined, ChevronDown, ChefHat, CircleHelp, Globe, LayoutDashboard, MapPin, Settings, ShoppingBag, Truck, Users, Wallet, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/twin-cakery-logo.png";
import { modules } from "./data";
const icons: Record<string, LucideIcon> = { Users, ShoppingBag, CakeSlice, Globe, ChefHat, Boxes, Truck, MapPin, Wallet, ChartNoAxesCombined, Settings };

export function Sidebar({module,setTab,setSearch,setStatusFilter,setHelp}: {module:string;setTab:(v:string)=>void;setSearch:(v:string)=>void;setStatusFilter:(v:string)=>void;setHelp:(v:boolean)=>void}) {
  return (
  <aside className="sidebar">
   <Link to="/" className="brand"><img src={logo} alt="Twin Cakery Bakery" width="48" height="48"/><div><strong>Twin Cakery Bakery<span className="brand-dot">.</span></strong><span>Taste the Cakes</span></div></Link>
   <div className="workspace-switch"><span className="workspace-avatar">TC</span><div><strong>Business workspace</strong><small>Proprietor</small></div><ChevronDown size={14}/></div>
   <nav aria-label="Main navigation">
    <Button variant="ghost" asChild className={`nav-item ${module==='dashboard'?'nav-active':''}`} title="Dashboard"><Link to="/"><LayoutDashboard/><span>Dashboard</span></Link></Button>
    {['WORKSPACE','OPERATIONS','BUSINESS'].map(group=><div className="nav-group" key={group}><p>{group}</p>{modules.filter(m=>m.group===group).map(m=>{const Icon=icons[m.icon]||LayoutDashboard;return <Button variant="ghost" asChild key={m.id} title={m.label} className={`nav-item ${module===m.id?'nav-active':''}`}><Link to={`/workspace/${m.id}`} onClick={()=>{setTab('');setSearch('');setStatusFilter('All statuses');}}><Icon/><span>{m.label}</span>{m.id==='sales'&&<small className="nav-count">24</small>}</Link></Button>})}</div>)}
   </nav>
   <div className="sidebar-bottom"><Button variant="ghost" className="nav-item" onClick={()=>setHelp(true)} title="Help & support"><CircleHelp/><span>Help & support</span></Button><div className="team-presence"><span className="presence-dot"/><span>Let’s bake something great.</span></div><div className="profile"><span className="profile-avatar">AM</span><div><strong>Alex Morgan</strong><small>Admin / Proprietor</small></div><ChevronDown size={14}/></div></div>
  </aside>
  );
}
