import { NavLink } from "react-router-dom";
import { useState } from "react";
import { ArrowUpRight, Menu, X, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const links = [
  ["/", "Home"],
  ["/cakes", "Our cakes"],
  ["/about", "Our story"],
  ["/courses", "Courses"],
  ["/events", "Events"],
  ["/offers", "Offers"],
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <NavLink to="/" end className="brand">
          <img src="/favicon.png" alt="Twin Cakery logo" width={55} height={55} />
          <span>Twin Cakery</span>
        </NavLink>
        <nav aria-label="Main navigation" className={`nav-links ${open ? "open" : ""}`}>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)}>
              {label}
            </NavLink>
          ))}
          {/* The blog is not live yet: the nav opens a "Coming soon" modal
              instead of routing to /blog. The route still exists for direct
              access once the blog launches. */}
          <button
            type="button"
            className="nav-coming-soon"
            onClick={() => {
              setOpen(false);
              setComingSoonOpen(true);
            }}
          >
            Blog
          </button>
        </nav>
        <Button asChild className="round-cta nav-order">
          <NavLink to="/order">
            <ShoppingBag />
            Order a cake
          </NavLink>
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      <Dialog open={comingSoonOpen} onOpenChange={setComingSoonOpen}>
        <DialogContent className="coming-soon-dialog">
          <DialogHeader>
            <DialogTitle className="text-2xl">Coming soon</DialogTitle>
            <DialogDescription className="text-base">
              Our blog is still in the oven. New posts from the Twin Cakery kitchen — recipes,
              behind-the-counter stories and sweet inspiration — will appear here soon.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            In the meantime, explore our cakes or send us an order request.
          </p>
        </DialogContent>
      </Dialog>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="section">
        <div className="footer-top">
          <div>
            <span className="eyebrow text-primary">A LITTLE SOMETHING SWEET</span>
            <h2>
              GOOD MOMENTS DESERVE
              <br />
              GREAT CAKE.
            </h2>
          </div>
          <Button asChild className="round-cta">
            <NavLink to="/order">
              Let's bake your next memory
              <ArrowUpRight />
            </NavLink>
          </Button>
        </div>
        <div className="footer-bottom">
          <NavLink className="brand" to="/">
            Twin Cakery
          </NavLink>
          <div className="footer-links">
            <NavLink to="/cakes">Our cakes</NavLink>
            <NavLink to="/courses">Courses</NavLink>
            <NavLink to="/about">Our story</NavLink>
            <NavLink to="/contact">Contact us</NavLink>
            <NavLink to="/blog">Blog</NavLink>
          </div>
          <span>© {new Date().getFullYear()} Twin Cakery. Baked with love.</span>
        </div>
      </div>
    </footer>
  );
}

export function PageBanner({
  title,
  description,
  tag = "TWIN CAKERY",
}: {
  title: string;
  description: string;
  tag?: string;
}) {
  return (
    <section className="page-banner">
      <span className="eyebrow text-primary">{tag}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}
