-- Twin Cakery ERP — 009 website content: blog + website users
-- E2 (governing architecture doc §4 catalogue principle + "Web App Management").
-- Purely additive and idempotent (IF NOT EXISTS) so the runner is safe to re-run.
--
-- Data flow: ERP "Web App Management" page writes here -> Postgres -> the public
-- website (sweet-moments-cakery) reads via GET /api/v1/public/*. One backend,
-- one database; the website never keeps its own copy.

-- ---------------------------------------------------------------------------
-- Blog categories (e.g. "Studio notes", "Recipes & ideas"). Admin-defined,
-- reorderable, archive-able — never hard-coded on the website.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_categories_order ON blog_categories(display_order);

-- ---------------------------------------------------------------------------
-- Blog posts. status: DRAFT | PUBLISHED | ARCHIVED. Only PUBLISHED posts are
-- exposed on GET /public/blog. slug is the public URL segment (unique).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES blog_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  published_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug) WHERE slug <> '';
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published_at);

-- ---------------------------------------------------------------------------
-- Website users: accounts for the public site (customers / site admins),
-- managed from the ERP "Web App Management" page. Distinct from ERP staff
-- `users` (internal RBAC). password_hash is bcrypt; status ACTIVE|SUSPENDED.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS website_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'CUSTOMER',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_website_users_email ON website_users(lower(email));
CREATE INDEX IF NOT EXISTS idx_website_users_status ON website_users(status);
