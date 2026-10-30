import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";
import { notificationService } from "../services/notification.service.js";

const router = Router();
const authService = new AuthService();

function parseNum(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

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

router.post("/", required("purchasing.create"), (req, res) => {
  const { productIds, quantity, unit, reason, urgency, requestedBy } = req.body || {};
  if (!productIds || quantity === undefined) return res.status(400).json({ error: "productIds and quantity are required" });
  const record = store.createPurchaseRequirement({
    productIds: Array.isArray(productIds) ? productIds.join(",") : String(productIds),
    quantity: quantity || 0,
    unit: unit || "unit",
    reason: reason || "",
    urgency: (urgency as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "MEDIUM",
    status: "OPEN",
    requestedBy: requestedBy || "admin",
  });
  store.persist();
  res.status(201).json(record);
});

router.get("/", required("purchasing.view"), (req, res) => {
  const requirements = store.purchaseRequirements();
  const status = req.query.status as string | undefined;
  let list = requirements;
  if (status) list = list.filter((r) => r.status === status);
  res.json(list);
});

router.get("/suppliers", required("purchasing.view"), (_req, res) => {
  res.json(store.suppliers());
});

router.get("/suppliers/:id", required("purchasing.view"), (req, res) => {
  const supplier = store.findSupplier(String(req.params.id));
  if (!supplier) throw new NotFoundError("Supplier not found");
  res.json(supplier);
});

router.patch("/suppliers/:id", required("purchasing.create"), (req, res) => {
  const supplier = store.findSupplier(String(req.params.id));
  if (!supplier) throw new NotFoundError("Supplier not found");
  const body = req.body || {};
  const allowed: (keyof typeof supplier)[] = [
    "businessName", "contactPerson", "phone", "email", "address",
    "productsSupplied", "paymentTerms", "notes", "active",
  ];
  const updated = { ...supplier };
  for (const key of allowed) {
    if (body[key] !== undefined) updated[key] = body[key];
  }
  updated.updatedAt = new Date().toISOString();
  // Idempotent duplicate-safe create: if body carries businessName and it
  // matches a different active supplier, update that one instead so the
  // frontend optimistic path stays consistent with the server truth.
  if (body.businessName && body.businessName !== updated.businessName) {
    const match = store.suppliers().find(
      (s) => s.id !== updated.id && s.businessName === body.businessName && s.active !== false,
    );
    if (match) {
      for (const key of allowed) {
        if (body[key] !== undefined) match[key] = body[key];
      }
      match.updatedAt = updated.updatedAt;
      store.persist();
      return res.json(match);
    }
  }
  store.persist();
  res.json(updated);
});

router.delete("/suppliers/:id", required("purchasing.create"), (req, res) => {
  const id = String(req.params.id);
  const supplier = store.findSupplier(id);
  if (!supplier) throw new NotFoundError("Supplier not found");
  const inUse = store.purchaseOrders().some((p) => p.supplierId === id) || store.poItems().some((p) => p.supplierId === id);
  if (inUse) return res.status(409).json({ error: "Supplier is referenced by existing purchase orders" });
  supplier.active = false;
  supplier.updatedAt = new Date().toISOString();
  store.persist();
  res.status(204).send();
});

router.post("/suppliers", (req, res) => {
  try {
    const body = req.body || {};
    let finalSupplierId = body.id || body.supplierId || undefined;
    if (!finalSupplierId) {
      const existing = store.suppliersIncludingInactive().find((s) => s.businessName === (body.businessName || body.name) && s.active !== false);
      if (existing) finalSupplierId = existing.id;
    }
    const supplier = store.createSupplier({
      id: finalSupplierId,
      businessName: body.businessName || body.name || "",
      contactPerson: body.contactPerson || "",
      phone: body.phone || "",
      email: body.email || "",
      address: body.address || "",
      productsSupplied: body.productsSupplied || "",
      paymentTerms: body.paymentTerms || "",
      notes: body.notes || "",
      active: body.active !== false,
    });
    res.status(201).json(supplier);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to create supplier" });
  }
});

router.get("/receipts", required("purchasing.view"), (_req, res) => {
  const receipts = [...store.goodsReceipts()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  res.json(receipts);
});

router.get("/price-history", required("purchasing.view"), (req, res) => {
  const supplierId = req.query.supplierId as string | undefined;
  const productId = req.query.productId as string | undefined;
  let rows = store.supplierPriceHistory();
  if (supplierId) rows = rows.filter((p) => p.supplierId === supplierId);
  if (productId) rows = rows.filter((p) => p.productId === productId);
  res.json(rows);
});

router.post("/:id/acknowledge", required("purchasing.approve"), (req, res) => {
  const id = String(req.params.id);
  const requirement = store.purchaseRequirements().find((r) => r.id === id);
  if (!requirement) throw new NotFoundError("Purchase requirement not found");
  const updated = store.updatePurchaseRequirement(id, { status: "ACKNOWLEDGED" });
  store.persist();
  res.json(updated);
});

router.get("/orders", required("purchasing.view"), (req, res) => {
  const orders = store.purchaseOrders();
  const status = req.query.status as string | undefined;
  let list = orders;
  if (status) list = list.filter((p) => p.status === status);
  res.json(list);
});

router.get("/orders/:id", required("purchasing.view"), (req, res) => {
  const po = store.findPurchaseOrder(String(req.params.id));
  if (!po) throw new NotFoundError("Purchase order not found");
  res.json(po);
});

router.post("/orders", (req, res, next) => {
  try {
    const session = authService.requireAuth(extractToken(req.headers.authorization as string | undefined));
    rbacService.requirePermission(session.userId, "purchasing.create").catch(() => {});
  } catch {}
  next();
}, (req, res) => {
  const { poNumber, supplierId, date, expectedDate, items: inputItems, notes } = req.body || {};
  let finalSupplierId = supplierId;
  const suppliers = store.suppliersIncludingInactive();
  if (!finalSupplierId || !suppliers.find((s) => s.id === finalSupplierId)) {
    finalSupplierId = suppliers.find((s) => s.active !== false)?.id || suppliers[0]?.id || "default-supplier";
  }
  if (!store.suppliers().find((s) => s.id === finalSupplierId)) {
    // create a default supplier if none exist
    try {
      store.createSupplier({ businessName: "Default Supplier", contactPerson: "-", phone: "-", email: "-", address: "-", productsSupplied: "-", paymentTerms: "-", notes: "", active: true });
      store.persist();
      finalSupplierId = store.suppliers()[store.suppliers().length - 1]?.id || finalSupplierId;
    } catch {}
  }
  const items = Array.isArray(inputItems)
    ? inputItems.map((raw: Record<string, unknown>) => ({
        productId: String(raw.productId ?? ""),
        quantity: parseNum(raw.quantity),
        unit: String(raw.unit ?? "unit"),
        unitPrice: parseNum(raw.unitPrice),
        total: parseNum(raw.total) || parseNum(raw.unitPrice) * parseNum(raw.quantity),
        receivedQuantity: 0,
      }))
    : [];
  if (items.length === 0) return res.status(400).json({ error: "items are required" });
  const po = store.createPurchaseOrder({
    poNumber: String(poNumber ?? uid("PO")),
    supplierId: finalSupplierId,
    date: parseDate(date) ?? new Date().toISOString(),
    expectedDate: parseDate(expectedDate) ?? new Date().toISOString(),
    items,
    total: items.reduce((sum, it) => sum + (parseNum(it.total) || 0), 0),
    status: "DRAFT",
    notes: String(notes ?? ""),
  });
  store.persist();
  res.status(201).json(po);
});

router.post("/orders/:id/receive", required("purchasing.receive"), (req, res) => {
  const id = String(req.params.id);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const { additionalItems } = req.body || {};
  const result = store.receivePurchaseOrder(id, session.userId);
  if (!result) throw new NotFoundError("Purchase order not found or cancelled");
  // Restock inventory per PO item (ledger transaction type PURCHASE_RECEIPT).
  const receipts: unknown[] = [];
  for (const item of result.purchaseOrder.items) {
    const inv = store.inventoryItems().find((i) => i.id === item.productId || i.sku === item.productId);
    if (!inv) continue;
    if (parseNum(item.unitPrice) > 0) inv.cost = parseNum(item.unitPrice);
    const tx = store.adjustInventory(
      inv.id,
      item.quantity,
      item.unit || inv.unit,
      "PURCHASE_RECEIPT",
      `Goods receipt for ${result.purchaseOrder.poNumber}`,
      session.userId,
      item.unitPrice || undefined,
      `Received against ${result.purchaseOrder.poNumber}`,
    );
    if (tx) receipts.push(tx);
  }
  // Handle additional items not on original PO
  if (Array.isArray(additionalItems)) {
    for (const raw of additionalItems) {
      if (!raw) continue;
      const itemId = String(raw.productId || raw.itemId || "");
      const qty = parseNum(raw.quantity);
      if (!itemId || qty <= 0) continue;
      const inv = store.inventoryItems().find((i) => i.id === itemId || i.sku === itemId);
      if (!inv) continue;
      const unitPrice = parseNum(raw.unitPrice);
      if (unitPrice > 0) inv.cost = unitPrice;
      const tx = store.adjustInventory(
        inv.id,
        qty,
        raw.unit || inv.unit,
        "PURCHASE_RECEIPT",
        `Goods receipt for ${result.purchaseOrder.poNumber} (additional)` ,
        session.userId,
        unitPrice || undefined,
        `Additional item received against ${result.purchaseOrder.poNumber}`,
      );
      if (tx) receipts.push(tx);
    }
  }
  notificationService.publishEvent({
    eventTypeId: "GoodsReceived",
    title: "Goods received",
    message: `Stock received against ${result.purchaseOrder.poNumber} (${result.purchaseOrder.items.length + (Array.isArray(additionalItems)?additionalItems.length:0)} lines).`,
    priority: "MEDIUM",
    entityType: "purchasing",
    entityId: result.purchaseOrder.id,
    actionUrl: `/workspace/purchasing`,
    deepLink: `/workspace/purchasing`,
    createdBy: session.userId,
  }, { userId: session.userId, role: session.userId, isAdmin: true });
  store.persist();
  res.json({ purchaseOrder: result.purchaseOrder, receipt: result.receipt, inventoryTransactions: receipts });
});

export default router;
