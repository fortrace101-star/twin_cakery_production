import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/lib/live";
import {
  ArrowRight, Globe, Plus, Trash2, UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge as Status } from "../data-table/StatusBadge";
import { money } from "./data";
import { ProductDialog } from "./module-table";
import { useWorkspace } from "./store";
import {
  listWebsiteUsers, createWebsiteUser, updateWebsiteUser, deleteWebsiteUser,
  listCatalogueCategories, listCatalogueProducts,
  type ServerWebsiteUser,
  type ServerCatalogueCategory, type ServerCatalogueProduct,
} from "@/lib/api";

/**
 * ERP "Site Management" page (E2).
 *
 * The single entry point for authoring the public website's content. Everything
 * written here flows through the ERP API → Postgres, and the website
 * (sweet-moments-cakery) reads the published subset via GET /api/v1/public/*.
 * Two panes — the live Product catalogue (drives the website’s “Our Cakes”
 * page) and website user accounts. Each opens a modal for entry.
 */

export function WebAppManagement({ tab, onNotice, onSignIn }: { tab: string; onNotice: (s: string) => void; onSignIn: () => void }) {
  const { connected } = useWorkspace();

  const [siteUsers, setSiteUsers] = useState<ServerWebsiteUser[]>([]);
  const [loading, setLoading] = useState(true);

  // New-entry modal
  const [userOpen, setUserOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setSiteUsers(await listWebsiteUsers());
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useLiveRefresh(refresh);
  return (
    <div className="webapp">
      <div className="webapp-banner">
        <div>
          <h2><Globe size={18}/> Site Management</h2>
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
        <ProductCataloguePane onNotice={onNotice} onSignIn={onSignIn} />
      )}

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

/* ── Product catalogue pane (entry into the website "Our Cakes") ─────────── */

function ProductCataloguePane({ onNotice, onSignIn }: { onNotice: (s: string) => void; onSignIn: () => void }) {
  const { connected } = useWorkspace();
  const [products, setProducts] = useState<ServerCatalogueProduct[]>([]);
  const [categories, setCategories] = useState<ServerCatalogueCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [p, c] = await Promise.all([listCatalogueProducts(), listCatalogueCategories()]);
    setProducts(p);
    setCategories(c);
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useLiveRefresh(refresh);

  const onWebsite = products.filter((p) => p.archived === false && p.active && p.catalogueVisible).length;
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Uncategorised";
  const statusLabel = (p: ServerCatalogueProduct) =>
    p.archived ? "Archived" : !p.active ? "Inactive" : p.catalogueVisible ? "Active" : "Hidden";

  return (
    <section className="panel webapp-pane">
      <div className="panel-heading">
        <div className="title-with-count">
          <h2><Globe size={16}/> Product catalogue</h2>
          <span className="inline-count">{products.length}</span>
        </div>
        <Button size="sm" onClick={() => (connected ? setCreating(true) : onSignIn())} title={connected ? "Add a product to the website" : "Sign in to add products"}>
          <Plus size={14}/> New product
        </Button>
      </div>
      <p className="text-muted-foreground text-xs webapp-note">
        {loading ? "Loading catalogue…" : !connected
          ? "Sign in to add products — this preview is read-only. The website’s “Our Cakes” page syncs from this catalogue."
          : `${onWebsite} of ${products.length} product${products.length === 1 ? "" : "s"} showing on the website’s “Our Cakes” page. Add a product here and it publishes to the website automatically — same database, no separate entry.`}
      </p>
      {!loading && products.length === 0 && (
        <div className="webapp-callout">
          <strong>No products yet</strong>
          <p className="text-muted-foreground text-xs">Use <em>New product</em> above to add the first cake to the website.</p>
        </div>
      )}
      <div className="webapp-list">
        {products.slice(0, 5).map((p) => (
          <div className="webapp-item" key={p.id}>
            <div className="webapp-item-main">
              <strong>{p.name}</strong>
              <small>{catName(p.categoryId)} · {p.sku}</small>
            </div>
            <Status value={statusLabel(p)} />
            <span className="amount-cell">{money(p.basePrice)}</span>
          </div>
        ))}
      </div>
      <div className="webapp-cta">
        <Button asChild variant="outline">
          <a href="/workspace/catalogue">Manage full catalogue <ArrowRight size={14}/></a>
        </Button>
      </div>
      <ProductDialog
        open={creating}
        product={null}
        categories={categories}
        onOpenChange={setCreating}
        onSaved={(msg) => { onNotice(msg); void refresh(); }}
      />
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
