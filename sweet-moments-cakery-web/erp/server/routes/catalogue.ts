import { Router } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { NotFoundError } from "../utils/errors.js";
import { extractToken, AuthService, type AuthSession } from "../services/auth.service.js";

const authService = new AuthService();
const required = (perm: string) => (req: any, res: any, next: any) => {
  try {
    const token = extractToken(req.headers.authorization as string | undefined);
    const session = token ? authService.requireAuth(token) : null;
    const userSession = session as AuthSession | null;
    if (!userSession) return res.status(401).json({ error: "Authentication required" });
    rbacService.requirePermission(userSession.userId, perm);
    next();
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthorizedError") return res.status(401).json({ error: err.message });
    if (err instanceof Error && err.name === "ForbiddenError") return res.status(403).json({ error: err.message });
    next(err);
  }
};

const catalogueRead = required("catalogue.view");
const catalogueCreate = required("catalogue.create");
const catalogueEdit = required("catalogue.edit");
const catalogueArchive = required("catalogue.archive");

router.get("/", catalogueRead, (req, res) => {
  const categories = store.catalogueCategories();
  const products = store.listProducts({ active: true, visible: true });
  const featured = products.slice(0, 6);
  res.json({ categories, products: featured });
});

router.get("/categories", catalogueRead, (req, res) => {
  const cats = store.catalogueCategories();
  res.json(cats);
});

router.post("/categories", catalogueCreate, (req, res) => {
  const { name, code, description, image, displayOrder, active, catalogueVisible } = req.body || {};
  if (!name || !code) return res.status(400).json({ error: "Name and code are required" });
  const category = store.createCategory({
    name,
    code,
    description: description || "",
    image: image || "",
    displayOrder: typeof displayOrder === "number" ? displayOrder : 0,
    active: active !== false,
    catalogueVisible: catalogueVisible !== false,
  });
  res.status(201).json(category);
});

router.patch("/categories/:id", catalogueEdit, (req, res) => {
  const { id } = req.params;
  const cats = store.catalogueCategories();
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) throw new NotFoundError("Category not found");
  const update = req.body || {};
  const updated = { ...cats[idx], ...update, updatedAt: new Date().toISOString() };
  store.updateCategory(updated);
  res.json(updated);
});

router.get("/types", catalogueRead, (req, res) => {
  const types = store.catalogueTypes();
  res.json(types);
});

router.post("/types", catalogueCreate, (req, res) => {
  const { categoryId, name, code, description, displayOrder, active, catalogueVisible } = req.body || {};
  if (!categoryId || !name) return res.status(400).json({ error: "categoryId and name are required" });
  const type = store.createType({
    categoryId,
    name,
    code: code || "",
    description: description || "",
    displayOrder: typeof displayOrder === "number" ? displayOrder : 0,
    active: active !== false,
    catalogueVisible: catalogueVisible !== false,
  });
  res.status(201).json(type);
});

router.get("/products", catalogueRead, (req, res) => {
  const list = store.listProducts({
    active: req.query.active !== "false",
    visible: req.query.visible !== "false",
    search: req.query.search as string | undefined,
  });
  res.json(list);
});

router.post("/products", catalogueCreate, (req, res) => {
  const { sku, categoryId, productTypeId, name, description, basePrice, costReference, catalogueVisible, productionEnabled, image, active, notes } = req.body || {};
  if (!sku || !categoryId || !name) return res.status(400).json({ error: "sku, categoryId, and name are required" });
  const product = store.createProduct({
    sku,
    categoryId,
    productTypeId,
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
  });
  res.status(201).json(product);
});

router.get("/products/:id", catalogueRead, (req, res) => {
  const product = store.getProduct(req.params.id);
  if (!product) throw new NotFoundError("Product not found");
  res.json(product);
});

router.patch("/products/:id", catalogueEdit, (req, res) => {
  const { id } = req.params;
  const product = store.getProduct(id);
  if (!product) throw new NotFoundError("Product not found");
  const update = req.body || {};
  const updated = { ...product, ...update, updatedAt: new Date().toISOString() };
  store.updateProduct(id, updated);
  res.json(updated);
});

router.post("/products/:id/archive", catalogueArchive, (req, res) => {
  const { id } = req.params;
  const product = store.getProduct(id);
  if (!product) throw new NotFoundError("Product not found");
  const archived = store.archiveProduct(id);
  res.json({ archived, ...product });
});

export default router;
