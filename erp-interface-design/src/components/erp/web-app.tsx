import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen, FileText, Globe, Pencil, Plus, Trash2, UserCog, Users, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge as Status } from "../data-table/StatusBadge";
import { money } from "./data";
import { useWorkspace } from "./store";
import {
  listBlogCategories, createBlogCategory,
  listBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost,
  listWebsiteUsers, createWebsiteUser, updateWebsiteUser, deleteWebsiteUser,
  type ServerBlogCategory, type ServerBlogPost, type ServerWebsiteUser,
} from "@/lib/api";

/**
 * ERP "Web App Management" page (E2).
 *
 * The single entry point for authoring the public website's content. Everything
 * written here flows through the ERP API → Postgres, and the website
 * (sweet-moments-cakery) reads the published subset via GET /api/v1/public/*.
 * Two panes — Blog (categories + posts) and Product catalogue — plus website
 * user accounts. Each pane opens a modal for entry.
 */

const BLOG_STATUS_TONE: Record<string, string> = {
  PUBLISHED: "green",
  DRAFT: "gray",
  ARCHIVED: "amber",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" });
}

export function WebAppManagement({ tab, onNotice }: { tab: string; onNotice: (s: string) => void }) {
  const { connected } = useWorkspace();

  const [categories, setCategories] = useState<ServerBlogCategory[]>([]);
  const [posts, setPosts] = useState<ServerBlogPost[]>([]);
  const [siteUsers, setSiteUsers] = useState<ServerWebsiteUser[]>([]);
  const [loading, setLoading] = useState(true);

  // New-entry modals
  const [postOpen, setPostOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [c, p, u] = await Promise.all([listBlogCategories(), listBlogPosts(), listWebsiteUsers()]);
    setCategories(c);
    setPosts(p);
    setSiteUsers(u);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const published = useMemo(() => posts.filter((p) => p.status === "PUBLISHED").length, [posts]);
  const drafts = useMemo(() => posts.filter((p) => p.status === "DRAFT").length, [posts]);
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorised";
  return (
    <div className="webapp">
      <div className="webapp-banner">
        <div>
          <h2><Globe size={18}/> Web App Management</h2>
          <p className="text-muted-foreground text-xs">
            Author the Twin Cakery website from here. Content flows through the ERP to the database, and the
            website reflects it automatically.
          </p>
        </div>
        <Status value={connected ? "Connected" : "Preview"} />
      </div>

      {tab === "Website users" ? (
        <WebsiteUsersPane
          users={siteUsers} loading={loading}
          onAdd={() => setUserOpen(true)}
          onToggleStatus={async (u) => {
            await updateWebsiteUser(u.id, { status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" });
            onNotice(`${u.name} ${u.status === "ACTIVE" ? "suspended" : "reactivated"}`);
            void refresh();
          }}
          onDelete={async (u) => {
            await deleteWebsiteUser(u.id);
            onNotice(`${u.name} removed`);
            void refresh();
          }}
        />
      ) : (
        <div className="webapp-grid">
          <BlogPane
            categories={categories} posts={posts} loading={loading}
            published={published} drafts={drafts} catName={catName}
            onNewPost={() => setPostOpen(true)}
            onNewCategory={() => setCatOpen(true)}
            onTogglePublish={async (p) => {
              const next = p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
              await updateBlogPost(p.id, { status: next });
              onNotice(`“${p.title}” ${next === "PUBLISHED" ? "published to the website" : "moved to draft"}`);
              void refresh();
            }}
            onDelete={async (p) => {
              await deleteBlogPost(p.id);
              onNotice(`“${p.title}” deleted`);
              void refresh();
            }}
          />
          <ProductCataloguePane />
        </div>
      )}

      <NewPostDialog
        open={postOpen} onOpenChange={setPostOpen} categories={categories}
        onCreated={async (payload) => {
          await createBlogPost(payload);
          onNotice("Blog post created");
          void refresh();
        }}
      />
      <NewCategoryDialog
        open={catOpen} onOpenChange={setCatOpen}
        onCreated={async (name) => {
          await createBlogCategory({ name });
          onNotice("Category added");
          void refresh();
        }}
      />
      <NewWebsiteUserDialog
        open={userOpen} onOpenChange={setUserOpen}
        onCreated={async (payload) => {
          await createWebsiteUser(payload);
          onNotice("Website user created");
          void refresh();
        }}
      />
    </div>
  );
}

/* ── Blog pane: categories + posts ───────────────────────────────────────── */

function BlogPane({
  categories, posts, loading, published, drafts, catName,
  onNewPost, onNewCategory, onTogglePublish, onDelete,
}: {
  categories: ServerBlogCategory[];
  posts: ServerBlogPost[];
  loading: boolean;
  published: number;
  drafts: number;
  catName: (id: string | null) => string;
  onNewPost: () => void;
  onNewCategory: () => void;
  onTogglePublish: (p: ServerBlogPost) => void;
  onDelete: (p: ServerBlogPost) => void;
}) {
  return (
    <section className="panel webapp-pane">
      <div className="panel-heading">
        <div className="title-with-count">
          <h2><BookOpen size={16}/> Blog</h2>
          <span>{posts.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onNewCategory}><Plus size={14}/> Category</Button>
          <Button size="sm" onClick={onNewPost}><Plus size={14}/> New post</Button>
        </div>
      </div>

      <div className="webapp-stats">
        <span><FileText size={14}/> {published} published</span>
        <span><Pencil size={14}/> {drafts} drafts</span>
        <span><BookOpen size={14}/> {categories.length} categories</span>
      </div>

      <div className="webapp-cats">
        {categories.map((c) => (
          <span key={c.id} className="webapp-chip">{c.name}</span>
        ))}
        {categories.length === 0 && <span className="text-muted-foreground text-xs">No categories yet.</span>}
      </div>

      <div className="webapp-list">
        {loading && <p className="text-muted-foreground text-xs">Loading posts…</p>}
        {!loading && posts.length === 0 && (
          <p className="text-muted-foreground text-xs">No blog posts yet. Use “New post” to write one.</p>
        )}
        {posts.map((p) => (
          <div className="webapp-item" key={p.id}>
            <div className="webapp-item-main">
              <strong>{p.title}</strong>
              <small>{catName(p.categoryId)} · {fmtDate(p.publishedAt ?? p.createdAt)}</small>
              {p.excerpt && <p>{p.excerpt}</p>}
            </div>
            <div className="webapp-item-actions">
              <Status value={p.status === "PUBLISHED" ? "Published" : p.status === "DRAFT" ? "Draft" : "Archived"} />
              <Button variant="ghost" size="icon" title={p.status === "PUBLISHED" ? "Unpublish" : "Publish to website"} aria-label={p.status === "PUBLISHED" ? "Unpublish" : "Publish"} onClick={() => onTogglePublish(p)}>
                {p.status === "PUBLISHED" ? <EyeOff size={15}/> : <Eye size={15}/>}
              </Button>
              <Button variant="ghost" size="icon" title="Delete post" aria-label="Delete post" onClick={() => onDelete(p)}><Trash2 size={15}/></Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Product catalogue pane (entry into the website "Our Cakes") ─────────── */

function ProductCataloguePane() {
  return (
    <section className="panel webapp-pane">
      <div className="panel-heading">
        <div className="title-with-count">
          <h2><Globe size={16}/> Product catalogue</h2>
        </div>
      </div>
      <p className="text-muted-foreground text-xs webapp-note">
        Products you enter in <strong>Product catalogue</strong> (SKU, category, price, visibility) appear on the
        website’s <strong>“Our Cakes”</strong> page automatically — same database, no separate entry.
      </p>
      <div className="webapp-cta">
        <Button asChild><a href="/workspace/catalogue">Open Product catalogue <Globe size={14}/></a></Button>
      </div>
      <div className="webapp-callout">
        <strong>How it flows</strong>
        <ol>
          <li>Enter products &amp; blog posts here in the ERP.</li>
          <li>The backend writes them to the shared database.</li>
          <li>The website reads the live data and updates instantly.</li>
        </ol>
      </div>
    </section>
  );
}

/* ── Website users pane ──────────────────────────────────────────────────── */

function WebsiteUsersPane({
  users, loading, onAdd, onToggleStatus, onDelete,
}: {
  users: ServerWebsiteUser[];
  loading: boolean;
  onAdd: () => void;
  onToggleStatus: (u: ServerWebsiteUser) => void;
  onDelete: (u: ServerWebsiteUser) => void;
}) {
  return (
    <section className="panel webapp-pane">
      <div className="panel-heading">
        <div className="title-with-count">
          <h2><UserCog size={16}/> Website users</h2>
          <span>{users.length}</span>
        </div>
        <Button size="sm" onClick={onAdd}><Plus size={14}/> New user</Button>
      </div>
      <p className="text-muted-foreground text-xs webapp-note">
        Accounts for the public website (customers &amp; site admins), managed here — separate from ERP staff logins.
      </p>
      <div className="webapp-list">
        {loading && <p className="text-muted-foreground text-xs">Loading users…</p>}
        {!loading && users.length === 0 && <p className="text-muted-foreground text-xs">No website users yet.</p>}
        {users.map((u) => (
          <div className="webapp-item" key={u.id}>
            <div className="webapp-item-main">
              <strong>{u.name}</strong>
              <small>{u.email}{u.phone ? ` · ${u.phone}` : ""}</small>
            </div>
            <div className="webapp-item-actions">
              <Status value={u.role === "SITE_ADMIN" ? "Site admin" : "Customer"} />
              <Status value={u.status === "ACTIVE" ? "Active" : "Suspended"} />
              <Button variant="ghost" size="sm" onClick={() => onToggleStatus(u)}>
                {u.status === "ACTIVE" ? "Suspend" : "Reactivate"}
              </Button>
              <Button variant="ghost" size="icon" title="Remove user" aria-label="Remove user" onClick={() => onDelete(u)}><Trash2 size={15}/></Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Dialogs ─────────────────────────────────────────────────────────────── */

function NewPostDialog({
  open, onOpenChange, categories, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: ServerBlogCategory[];
  onCreated: (payload: Partial<ServerBlogPost>) => void;
}) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [author, setAuthor] = useState("");
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setTitle(""); setExcerpt(""); setBody(""); setCategoryId(categories[0]?.id ?? ""); setAuthor(""); setPublish(true); }
  }, [open, categories]);

  async function submit() {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    await onCreated({
      title: title.trim(),
      excerpt: excerpt.trim(),
      body: body.trim(),
      categoryId: categoryId || null,
      author: author.trim(),
      status: publish ? "PUBLISHED" : "DRAFT",
    });
    setBusy(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>New blog post</DialogTitle>
        <DialogDescription>Write a post here; it flows to the website’s Blog page when published.</DialogDescription>
        <div className="form-grid">
          <div className="form-field span-2">
            <Label htmlFor="wp-title">Title</Label>
            <Input id="wp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Behind the scenes of a wedding cake" />
          </div>
          <div className="form-field">
            <Label htmlFor="wp-cat">Category</Label>
            <select id="wp-cat" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <Label htmlFor="wp-author">Author</Label>
            <Input id="wp-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Twin Cakery" />
          </div>
          <div className="form-field span-2">
            <Label htmlFor="wp-excerpt">Excerpt</Label>
            <Input id="wp-excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="A short summary shown on the blog list" />
          </div>
          <div className="form-field span-2">
            <Label htmlFor="wp-body">Body</Label>
            <Textarea id="wp-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the full post…" />
          </div>
          <label className="form-check span-2">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            Publish to the website immediately
          </label>
        </div>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !title.trim() || !body.trim()}>{publish ? "Publish" : "Save draft"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewCategoryDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setName(""); }, [open]);
  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    await onCreated(name.trim());
    setBusy(false);
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>New blog category</DialogTitle>
        <DialogDescription>Group posts by topic (e.g. Studio notes, Recipes &amp; ideas).</DialogDescription>
        <div className="form-grid">
          <div className="form-field span-2">
            <Label htmlFor="wc-name">Category name</Label>
            <Input id="wc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Recipes & ideas" />
          </div>
        </div>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>Add category</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewWebsiteUserDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (payload: { name: string; email: string; password?: string; role?: string; phone?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("CUSTOMER");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setName(""); setEmail(""); setPhone(""); setPassword(""); setRole("CUSTOMER"); } }, [open]);
  async function submit() {
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    await onCreated({ name: name.trim(), email: email.trim(), phone: phone.trim(), password, role });
    setBusy(false);
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>New website user</DialogTitle>
        <DialogDescription>An account for the public website. Passwords are stored hashed.</DialogDescription>
        <div className="form-grid">
          <div className="form-field">
            <Label htmlFor="wu-name">Full name</Label>
            <Input id="wu-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <Label htmlFor="wu-email">Email</Label>
            <Input id="wu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-field">
            <Label htmlFor="wu-phone">Phone</Label>
            <Input id="wu-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="form-field">
            <Label htmlFor="wu-role">Role</Label>
            <select id="wu-role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="CUSTOMER">Customer</option>
              <option value="SITE_ADMIN">Site admin</option>
            </select>
          </div>
          <div className="form-field span-2">
            <Label htmlFor="wu-pass">Password</Label>
            <Input id="wu-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set an initial password" />
          </div>
        </div>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !name.trim() || !email.trim()}>Create user</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
