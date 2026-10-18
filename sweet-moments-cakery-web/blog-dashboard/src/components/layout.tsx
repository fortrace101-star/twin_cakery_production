import { NavLink, Link } from "react-router-dom";
import { ArrowLeft, Plus, LogOut } from "lucide-react";
import { getToken, blogApi } from "@/lib/blog-api";

export function Header({ links }: { links: Array<[string, string]> }) {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header-inner">
        <div className="brand">
          <span className="brand-mark">TWIN</span>
          <span className="brand-name">Blog Dashboard</span>
        </div>
        <nav className="dashboard-nav">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {label}
            </NavLink>
          ))}
          {getToken() && (
            <a
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                blogApi.logout();
                window.location.assign("/login");
              }}
            >
              <LogOut size={14} /> Sign out
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

export function BlogPostLink({ slug, title }: { slug: string; title: string }) {
  return (
    <Link to={`/posts/${slug}`} className="blog-post-card">
      <div className="blog-post-card-head">
        <h3>{title}</h3>
        <span className="blog-post-card-slug">/{slug}</span>
      </div>
      <div className="blog-post-card-actions">
        <ArrowLeft size={14} /> {slug}
      </div>
    </Link>
  );
}
