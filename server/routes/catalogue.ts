import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { NotFoundError } from "../utils/errors.js";
import { extractToken, AuthService } from "../services/auth.service.js";
import { paginate } from "../utils/paginate.js";

const router = Router();
const authService = new AuthService();
const required = (perm: string): RequestHandler => async (req, res, next) => {
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

router.get("/", required("catalogue.view"), (req, res) => {
  const categories = store.db.catalogue?.categories || [];
  const products = store.db.catalogue?.products || [];
  const visible = products.filter((p) => p.catalogueVisible);
  // §33 — with `?page=`/`?pageSize=` the product list paginates (categories stay
  // whole); without them the historical `{ categories, products }` shape returns.
  const paged = paginate(visible, req.query, {
    sortable: ["name", "displayOrder", "createdAt"],
    dateField: "createdAt",
    searchFields: ["name", "sku"],
  });
  if (Array.isArray(paged)) return res.json({ categories, products: paged });
  return res.json({ categories, ...paged });
});

router.get("/categories", required("catalogue.view"), (req, res) => {
  const cats = store.db.catalogue?.categories || [];
  res.json(cats);
});

router.post("/categories", required("catalogue.create"), (req, res) => {
  const { name, code, description, image, displayOrder, active, catalogueVisible } = req.body || {};
  if (!name || !code) return res.status(400).json({ error: "Name and code are required" });
  const now = new Date().toISOString();
  const category = {
    id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    code,
    description: description || "",
    image: image || "",
    displayOrder: typeof displayOrder === "number" ? displayOrder : 0,
    active: active !== false,
    catalogueVisible: catalogueVisible !== false,
    createdAt: now,
    updatedAt: now,
  };
  store.db.catalogue.categories.push(category);
  store.db.persist();
  res.status(201).json(category);
});

router.patch("/categories/:id", required("catalogue.edit"), (req, res) => {
  const id = String(req.params.id);
  const cats = store.db.catalogue?.categories || [];
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) throw new NotFoundError("Category not found");
  const update = req.body || {};
  cats[idx] = { ...cats[idx], ...update, updatedAt: new Date().toISOString() };
  store.db.persist();
  res.json(cats[idx]);
});

router.post("/types", required("catalogue.create"), (req, res) => {
  const { categoryId, name, code, description, displayOrder, active, catalogueVisible } = req.body || {};
  if (!categoryId || !name) return res.status(400).json({ error: "categoryId and name are required" });
  const now = new Date().toISOString();
  const type = {
    id: `typ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    categoryId,
    name,
    code: code || "",
    description: description || "",
    displayOrder: typeof displayOrder === "number" ? displayOrder : 0,
    active: active !== false,
    catalogueVisible: catalogueVisible !== false,
    createdAt: now,
    updatedAt: now,
  };
  store.db.catalogue.types.push(type);
  store.db.persist();
  res.status(201).json(type);
});

router.get("/types", required("catalogue.view"), (req, res) => {
  const types = store.db.catalogue?.types || [];
  res.json(types);
});

router.get("/products", required("catalogue.view"), (req, res) => {
  const products = store.db.catalogue?.products || [];
  const name = req.query.name as string | undefined;
  const active = req.query.active;
  const catalogueVisible = req.query.catalogueVisible;
  let list = products;
  if (name) list = list.filter((p) => p.name.toLowerCase().includes(name.toLowerCase()));
  if (active !== undefined) list = list.filter((p) => p.active === (active !== "false"));
  if (catalogueVisible !== undefined) list = list.filter((p) => p.catalogueVisible === (catalogueVisible !== "false"));
  res.json(list);
});

router.post("/products", required("catalogue.create"), (req, res) => {
  const { sku, categoryId, productId, name, description, basePrice, costReference, catalogueVisible, productionEnabled, image, active, notes } = req.body || {};
  if (!sku || !categoryId || !name) return res.status(400).json({ error: "sku, categoryId, and name are required" });
  const now = new Date().toISOString();
  const product = {
    id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sku,
    categoryId,
    productId: productId || `prod-${Date.now()}`,
    name,
    description: description || "",
    basePrice: basePrice || 0,
    costReference: costReference || "",
    catalogueVisible: catalogueVisible !== false,
    productionEnabled: productionEnabled !== false,
    image: image || "",
    active: active !== false,
    archived: false,
    notes: notes || "",
    createdAt: now,
    updatedAt: now,
  };
  store.db.catalogue.products.push(product);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  store.createAuditLog({
    actor: session?.userId ?? "", action: "product:created",
    entityType: "product", entityId: product.id, reason: `${product.sku} · ${product.name}`,
  });
  store.db.persist();
  res.status(201).json(product);
});

router.get("/products/:id", required("catalogue.view"), (req, res) => {
  const product = store.db.catalogue?.products?.find((p) => p.id === String(req.params.id));
  if (!product) throw new NotFoundError("Product not found");
  res.json(product);
});

router.patch("/products/:id", required("catalogue.edit"), (req, res) => {
  const id = String(req.params.id);
  const products = store.db.catalogue?.products || [];
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) throw new NotFoundError("Product not found");
  const update = req.body || {};
  const before = products[idx];
  products[idx] = { ...before, ...update, updatedAt: new Date().toISOString() };
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  // §34 "price changes" — the reason flags a basePrice change explicitly.
  store.createAuditLog({
    actor: session?.userId ?? "", action: "product:updated",
    entityType: "product", entityId: id,
    reason: before.basePrice !== products[idx].basePrice
      ? `${products[idx].name}: price ${before.basePrice} → ${products[idx].basePrice}`
      : String(products[idx].name),
  });
  store.db.persist();
  res.json(products[idx]);
});

router.post("/products/:id/archive", required("catalogue.archive"), (req, res) => {
  const id = String(req.params.id);
  const products = store.db.catalogue?.products || [];
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) throw new NotFoundError("Product not found");
  products[idx] = { ...products[idx], archived: true, active: false, updatedAt: new Date().toISOString() };
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  store.createAuditLog({
    actor: session?.userId ?? "", action: "product:archived",
    entityType: "product", entityId: id, reason: String(products[idx].name),
  });
  store.db.persist();
  res.json(products[idx]);
});

export default router;
