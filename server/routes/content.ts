import { Router, RequestHandler } from "express";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { extractToken, AuthService } from "../services/auth.service";

// Resolve bcryptjs from the frontend node_modules (reached via the server
// junction), matching the pattern used by auth.service.ts and seeds/seed.ts.
const requireFromFrontend = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "erp-interface-design", "package.json"),
);
const bcrypt = requireFromFrontend("bcryptjs") as typeof import("bcryptjs");

/**
 * ERP "Site Management" content router (E2).
 *
 * Backs the ERP page that authors the public website's content — blog posts +
 * categories and website user accounts. Everything written here flows straight
 * to Postgres; the public website reads the published subset via
 * GET /api/v1/public/* (see routes/public.ts). One backend, one database.
 *
 * Writes are RBAC-guarded (content.* permissions, granted to Admin).
 */

const router = Router();
const authService = new AuthService();

const required = (perm: string) => async (req: any, res: any, next: any) => {
  try {
    const session = authService.requireAuth(extractToken(req.headers.authorization as string | undefined));
    await rbacService.requirePermission(session.userId, perm);
    next();
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthorizedError") return res.status(401).json({ error: err.message });
    if (err instanceof Error && err.name === "ForbiddenError") return res.status(403).json({ error: err.message });
    next(err);
  }
};

function currentUser(req: any): string {
  try {
    const session = authService.requireAuth(extractToken(req.headers.authorization as string | undefined));
    return session.userId;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Blog categories
// ---------------------------------------------------------------------------

router.get("/blog/categories", required("content.view"), (_req, res) => {
  res.json(store.blogCategories());
});

router.post("/blog/categories", required("content.create"), (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const category = store.createBlogCategory(req.body || {});
  res.status(201).json(category);
});

router.patch("/blog/categories/:id", required("content.edit"), (req, res) => {
  const updated = store.updateBlogCategory(String(req.params.id), req.body || {});
  if (!updated) throw new NotFoundError("Category not found");
  res.json(updated);
});

router.delete("/blog/categories/:id", required("content.edit"), (req, res) => {
  if (!store.deleteBlogCategory(String(req.params.id))) throw new NotFoundError("Category not found");
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Blog posts
// ---------------------------------------------------------------------------

router.get("/blog/posts", required("content.view"), (_req, res) => {
  res.json(store.blogPosts());
});

router.get("/blog/posts/:id", required("content.view"), (req, res) => {
  const post = store.blogPost(String(req.params.id));
  if (!post) throw new NotFoundError("Post not found");
  res.json(post);
});

router.post("/blog/posts", required("content.create"), (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: "title and body are required" });
  const post = store.createBlogPost({ ...req.body, createdBy: currentUser(req) });
  res.status(201).json(post);
});

router.patch("/blog/posts/:id", required("content.edit"), (req, res) => {
  const updated = store.updateBlogPost(String(req.params.id), req.body || {});
  if (!updated) throw new NotFoundError("Post not found");
  res.json(updated);
});

router.delete("/blog/posts/:id", required("content.edit"), (req, res) => {
  if (!store.deleteBlogPost(String(req.params.id))) throw new NotFoundError("Post not found");
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Website users (public-site accounts, distinct from ERP staff `users`)
// ---------------------------------------------------------------------------

router.get("/website-users", required("content.view"), (_req, res) => {
  // Never expose password hashes to the client.
  res.json(store.websiteUsers().map(({ passwordHash: _omit, ...u }) => u));
});

router.post("/website-users", required("content.create"), async (req, res) => {
  const { name, email, password, role, phone, customerId } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: "name and email are required" });
  if (store.websiteUserByEmail(email)) throw new ValidationError("A website user with that email already exists");
  const passwordHash = password ? await bcrypt.hash(String(password), 10) : "";
  const user = store.createWebsiteUser({ name, email, phone, role, customerId, passwordHash });
  const { passwordHash: _omit, ...safe } = user;
  res.status(201).json(safe);
});

router.patch("/website-users/:id", required("content.edit"), async (req, res) => {
  const patch: Record<string, unknown> = { ...req.body };
  // Re-hash only when a new password is supplied.
  if (typeof patch.password === "string" && patch.password) {
    patch.passwordHash = await bcrypt.hash(patch.password, 10);
  }
  delete patch.password;
  const updated = store.updateWebsiteUser(String(req.params.id), patch);
  if (!updated) throw new NotFoundError("Website user not found");
  const { passwordHash: _omit, ...safe } = updated;
  res.json(safe);
});

router.delete("/website-users/:id", required("content.edit"), (req, res) => {
  if (!store.deleteWebsiteUser(String(req.params.id))) throw new NotFoundError("Website user not found");
  res.json({ ok: true });
});

export default router;
