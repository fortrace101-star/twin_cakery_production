import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { notificationService } from "../services/notification.service.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();

router.get("/catalogue", (req, res) => {
  const categories = store.db.catalogue?.categories || [];
  const products = store.db.catalogue?.products || [];
  const visible = products.filter((p) => p.catalogueVisible && p.active === true);
  // Never leak internal costing to the public site (spec §23 Public API):
  // strip cost_reference and keep only the fields the storefront renders.
  const pub = (p: (typeof visible)[number]) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    image: p.image,
    basePrice: p.basePrice,
    currency: (p as { currency?: string }).currency ?? "UGX",
    active: p.active,
    archived: p.archived,
    catalogueVisible: p.catalogueVisible,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });
  const catalogue = {
    categories,
    products: visible.map(pub),
    featured: visible.slice(0, 6).map(pub),
  };
  res.json(catalogue);
});

router.get("/products/:id", (req, res) => {
  const product = store.db.catalogue?.products?.find((p) => p.id === String(req.params.id));
  if (!product || !product.catalogueVisible || product.active !== true) {
    throw new NotFoundError("Product not found");
  }
  const categories = store.db.catalogue?.categories || [];
  const category = categories.find((c) => c.id === product.categoryId);
  const { cost_reference: _cost, ...safe } = product as typeof product & { cost_reference?: unknown };
  res.json({ ...safe, category: category?.name || "" });
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

/** Find an existing customer by exact email/phone match (no fuzzy matching — rule 26). */
function matchCustomer(email?: unknown, phone?: unknown) {
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  const ph = typeof phone === "string" ? phone.trim() : "";
  if (!e && !ph) return undefined;
  return store
    .customers()
    .find((c) => (e && c.email.trim().toLowerCase() === e) || (ph && c.phone.trim() === ph));
}

function notifyNewInquiry(inquiryId: string, subject: string): void {
  try {
    notificationService.publishEvent(
      {
        eventTypeId: "InquiryCreated",
        entityType: "inquiry",
        entityId: inquiryId,
        actionUrl: `/crm?inquiry=${inquiryId}`,
        metadata: { subject },
      } as never,
      { userId: "public-website", role: "public", isAdmin: false } as never,
    );
  } catch {
    /* Non-fatal: the inquiry is already persisted; a dead notifier must not 500 the form. */
  }
}

router.post("/inquiries", (req, res) => {
  const { name, phone, email, source, channel, subject, summary, details } = req.body || {};
  if (!name || !subject) return res.status(400).json({ error: "name and subject are required" });
  // FK-safe: inquiries.customer_id is NOT NULL, so resolve-or-create a REAL
  // customer row first. The old code wrote customerId "public-<ts>", which has
  // no customers row and 500'd the Postgres write-back on flush.
  const existing = matchCustomer(email, phone);
  const customer =
    existing ??
    store.createCustomer({
      name: String(name),
      phone: phone ? String(phone) : "",
      email: email ? String(email) : "",
      source: "Website",
      notes: "Auto-created from the public website contact form.",
    });
  const inquiry = store.createInquiry({
    customerId: customer.id,
    channel: channel || "Website",
    subject: String(subject).slice(0, 200),
    summary: summary ? String(summary).slice(0, 500) : "",
    details: [name && `Name: ${name}`, phone && `Phone: ${phone}`, email && `Email: ${email}`, details]
      .filter(Boolean)
      .join("\n"),
    status: "NEW",
    priority: "MEDIUM",
    followUpRequired: true,
    source: source || "WEBSITE",
  });
  store.persist();
  notifyNewInquiry(inquiry.id, inquiry.subject);
  res
    .status(201)
    .json({ id: inquiry.id, status: "NEW", message: "Inquiry received. We will follow up shortly." });
});

const DELIVERY_TYPES = ["PICKUP", "HOME_DELIVERY", "COLLECTION", "DELIVERY"];

router.post("/order-proposals", (req, res) => {
  const {
    customerName,
    name,
    phone,
    email,
    products,
    items,
    product,
    productId,
    quantity,
    preferredDate,
    preferredTime,
    deliveryType,
    deliveryLocation,
    notes,
    customerNotes,
    referenceImage,
  } = req.body || {};

  // --- server-side validation (spec §30: mandatory) ---
  const contactName = String(customerName ?? name ?? "").trim();
  if (!contactName) return res.status(400).json({ error: "customerName is required" });
  const contactPhone = String(phone ?? "").trim();
  const contactEmail = String(email ?? "").trim();
  if (!contactPhone && !contactEmail) {
    return res.status(400).json({ error: "phone or email is required" });
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return res.status(400).json({ error: "email is not valid" });
  }
  // Accept items[] | products[] | single product/productId line.
  const rawLines: Array<Record<string, unknown>> = Array.isArray(items)
    ? (items as Array<Record<string, unknown>>)
    : Array.isArray(products)
      ? (products as Array<Record<string, unknown>>)
      : product ?? productId
        ? [{ product: product, productId: productId, quantity: quantity ?? 1 }]
        : [];
  if (rawLines.length === 0) {
    return res.status(400).json({ error: "at least one product is required" });
  }
  // Validate every line against the LIVE catalogue.
  const live = new Map((store.db.catalogue?.products ?? []).map((p) => [p.id, p]));
  const liveByName = new Map(
    (store.db.catalogue?.products ?? []).map((p) => [p.name.trim().toLowerCase(), p]),
  );
  const validated: Array<{
    productId: string; productName: string; variantOptions: string;
    quantity: number; unitPrice: number; total: number;
  }> = [];
  for (const [idx, raw] of rawLines.entries()) {
    const ref = String(raw.productId ?? raw.product ?? raw.name ?? "").trim();
    const found = live.get(ref) ?? liveByName.get(ref.toLowerCase());
    if (!found) return res.status(400).json({ error: `line ${idx + 1}: "${ref}" is not available` });
    const hidden = found.catalogueVisible !== true || found.active !== true || found.archived === true;
    if (hidden) return res.status(400).json({ error: `line ${idx + 1}: "${found.name}" is unavailable` });
    const qty = Math.floor(Number(raw.quantity ?? 1));
    if (!Number.isFinite(qty) || qty < 1 || qty > 100) {
      return res.status(400).json({ error: `line ${idx + 1}: quantity must be 1-100` });
    }
    const unit = Number((found as { basePrice?: unknown }).basePrice ?? 0);
    const price = Number.isFinite(unit) ? unit : 0;
    const optRaw = raw.variantOptions ?? raw.options;
    validated.push({
      productId: found.id, productName: found.name,
      variantOptions: optRaw ? String(optRaw).slice(0, 300) : "",
      quantity: qty, unitPrice: price, total: price * qty,
    });
  }
  let prefDate: string | null = null;
  if (preferredDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(preferredDate))) {
      return res.status(400).json({ error: "preferredDate must be YYYY-MM-DD" });
    }
    const day = new Date(`${preferredDate}T00:00:00Z`);
    if (Number.isNaN(day.getTime())) return res.status(400).json({ error: "preferredDate is not valid" });
    if (day.getTime() < Date.now() - 86_400_000) {
      return res.status(400).json({ error: "preferredDate must be today or later" });
    }
    prefDate = String(preferredDate);
  }
  const delivery = String(deliveryType ?? "PICKUP").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!DELIVERY_TYPES.includes(delivery)) {
    return res.status(400).json({ error: `deliveryType must be one of: ${DELIVERY_TYPES.join(", ")}` });
  }
  // --- persist (FK-safe) ---
  const customer = matchCustomer(contactEmail, contactPhone);
  const summary = validated.map((v) => `${v.quantity}x ${v.productName}`).join(", ");
  const proposal = store.createOrderProposal({
    customerName: contactName.slice(0, 150),
    phone: contactPhone.slice(0, 30),
    email: contactEmail.slice(0, 255),
    productSummary: summary.slice(0, 500),
    quantity: validated.reduce((n, v) => n + v.quantity, 0),
    preferredDate: prefDate,
    preferredTime: String(preferredTime ?? "").slice(0, 20),
    deliveryType: delivery,
    deliveryLocation: String(deliveryLocation ?? "").slice(0, 300),
    customerNotes: String(customerNotes ?? notes ?? "").slice(0, 2000),
    referenceImage: String(referenceImage ?? "").slice(0, 500),
    customerId: customer?.id ?? null,
    items: validated,
  });
  // Every proposal opens a linked inquiry (source ORDER_FORM) for the CSR queue.
  const owner =
    customer ??
    store.createCustomer({
      name: contactName.slice(0, 150),
      phone: contactPhone.slice(0, 30),
      email: contactEmail.slice(0, 255),
      source: "Website",
      notes: "Auto-created from the public order form.",
    });
  const noteText = String(customerNotes ?? notes ?? "");
  const inquiry = store.createInquiry({
    customerId: owner.id,
    channel: "Website",
    subject: `Online order ${proposal.proposalNumber}: ${summary}`.slice(0, 200),
    summary: `Proposal ${proposal.proposalNumber} - ${summary}`.slice(0, 500),
    details: [
      `Name: ${contactName}`,
      contactPhone && `Phone: ${contactPhone}`,
      contactEmail && `Email: ${contactEmail}`,
      prefDate && `Preferred date: ${prefDate}`,
      noteText && `Notes: ${noteText}`,
    ]
      .filter(Boolean)
      .join("\n"),
    status: "NEW",
    priority: "MEDIUM",
    followUpRequired: true,
    source: "ORDER_FORM",
  });
  store.updateOrderProposal(proposal.id, { customerId: owner.id, inquiryId: inquiry.id });
  store.persist();
  notifyNewInquiry(inquiry.id, inquiry.subject);
  const stored = store.findOrderProposal(proposal.id) ?? proposal;
  const total = stored.items.reduce((n, i) => n + i.total, 0);
  res.status(201).json({
    id: stored.id,
    proposalNumber: stored.proposalNumber,
    status: stored.status,
    items: stored.items,
    total,
    inquiryId: inquiry.id,
    message: "Order request received. We will confirm availability and pricing shortly.",
  });
});

export default router;
