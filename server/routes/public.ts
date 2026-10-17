import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();

router.get("/catalogue", (req, res) => {
  const categories = store.db.catalogue?.categories || [];
  const products = store.db.catalogue?.products || [];
  const visible = products.filter((p) => p.catalogueVisible && p.active === true);
  const catalogue = {
    categories,
    products: visible,
    featured: visible.slice(0, 6),
  };
  res.json(catalogue);
});

router.get("/products/:id", (req, res) => {
  const product = store.db.catalogue?.products?.find((p) => p.id === String(req.params.id));
  if (!product) throw new NotFoundError("Product not found");
  const categories = store.db.catalogue?.categories || [];
  const category = categories.find((c) => c.id === product.categoryId);
  res.json({ ...product, category: category?.name || "" });
});

// ---- Blog (public, read-only; published posts only) ----

router.get("/blog", (req, res) => {
  const posts = store.publishedBlogPosts();
  const categories = store.blogCategories().filter((c) => c.active);
  const catById = new Map(categories.map((c) => [c.id, c.name]));
  const items = posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    coverImage: p.coverImage,
    author: p.author,
    category: p.categoryId ? catById.get(p.categoryId) ?? "" : "",
    publishedAt: p.publishedAt ?? p.createdAt,
  }));
  res.json({ posts: items, categories });
});

router.get("/blog/:slug", (req, res) => {
  const post = store.blogPostBySlug(String(req.params.slug));
  if (!post) throw new NotFoundError("Post not found");
  const category = post.categoryId ? store.blogCategory(post.categoryId) : undefined;
  res.json({ ...post, category: category?.name ?? "" });
});

router.post("/inquiries", (req, res) => {
  const { name, phone, email, source, channel, subject, summary, details } = req.body || {};
  if (!name || !subject) return res.status(400).json({ error: "name and subject are required" });
  const inquiry = store.createInquiry({
    customerId: "public-" + Date.now().toString(36),
    channel: channel || "Website",
    subject,
    summary: summary || "",
    details: details || "",
    status: "NEW",
    priority: "MEDIUM",
    followUpRequired: false,
    source: source || "WEBSITE",
  });
  store.persist();
  res.status(201).json({ id: inquiry.id, status: "NEW", message: "Inquiry received. We will follow up shortly." });
});

router.post("/order-proposals", (req, res) => {
  const { customerName, products, quantities, notes } = req.body || {};
  if (!customerName || !products) return res.status(400).json({ error: "customerName and products are required" });
  const proposal = {
    id: "PROP-" + Date.now().toString(36).toUpperCase(),
    customerName,
    products: products.map((p: { name: string; quantity: number; options: string }) => ({
      ...p,
      totalQuantity: p.quantity,
      total: 0,
    })),
    notes: notes || "",
    status: "PENDING_REVIEW",
    createdAt: new Date().toISOString(),
  };
  store.persist();
  res.status(201).json(proposal);
});

export default router;
