import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";
import { publishLowStockAlert } from "../services/stock-alerts.js";

const router = Router();
const authService = new AuthService();

const required = (perm: string): RequestHandler => (req, res, next) => {
  try {
    const session = authService.requireAuth(extractToken(req.headers.authorization as string | undefined));
    rbacService.requirePermission(session.userId, perm);
    next();
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthorizedError") return res.status(401).json({ error: err.message });
    if (err instanceof Error && err.name === "ForbiddenError") return res.status(403).json({ error: err.message });
    next(err);
  }
};

router.get("/", required("inventory.view"), (req, res) => {
  const items = store.inventoryItems();
  const name = req.query.name as string | undefined;
  const outOfStock = req.query.outOfStock;
  let list = items;
  if (name) list = list.filter((i) => i.name.toLowerCase().includes(name.toLowerCase()));
  if (outOfStock) list = list.filter((i) => (i.physicalStock || 0) <= 0);
  res.json(list.map((i) => ({
    ...i,
    availableStock: (i.physicalStock || 0) - (store.stockReservations().filter((r) => r.itemId === i.id).reduce((s, r) => s + r.quantity, 0)),
  })));
});

router.get("/ledger", required("inventory.view"), (req, res) => {
  const itemId = req.query.itemId as string | undefined;
  const limitRaw = Number(req.query.limit);
  let transactions = store.inventoryTransactions();
  if (itemId) transactions = transactions.filter((t) => t.itemId === itemId);
  transactions = [...transactions].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (Number.isFinite(limitRaw) && limitRaw > 0) transactions = transactions.slice(0, limitRaw);
  res.json({ count: transactions.length, transactions });
});

// Registered above /:id — "/alerts" would otherwise be captured as an item id.
router.get("/alerts", required("inventory.view"), (req, res) => {
  const alerts = store
    .inventoryItems()
    .map((i) => {
      const reserved = store.stockReservations().filter((r) => r.itemId === i.id).reduce((s, r) => s + r.quantity, 0);
      const available = (i.physicalStock || 0) - reserved;
      const reorder = i.reorderLevel || 0;
      const status = available <= 0 ? "Out of stock" : available <= reorder ? "Low stock" : "In stock";
      return { ...i, availableStock: available, status, shortfall: Math.max(0, reorder - available) };
    })
    .filter((a) => a.status !== "In stock")
    .sort((a, b) => b.shortfall - a.shortfall);
  res.json({ count: alerts.length, alerts });
});

router.get("/:id", required("inventory.view"), (req, res) => {
  const item = store.inventoryItems().find((i) => i.id === String(req.params.id));
  if (!item) throw new NotFoundError("Inventory item not found");
  const reservations = store.stockReservations().filter((r) => r.itemId === item.id);
  res.json({ ...item, reservedStock: reservations.reduce((s, r) => s + r.quantity, 0) });
});

router.post("/adjustments", required("inventory.adjust"), (req, res) => {
  const { itemId, quantity, unit, type, reference, user, unitCost, notes } = req.body || {};
  if (!itemId || quantity === undefined) return res.status(400).json({ error: "itemId and quantity are required" });
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  const previousStock = store.inventoryItems().find((i) => i.id === itemId)?.physicalStock ?? 0;
  const transaction = store.adjustInventory(itemId, quantity, unit || "unit", type || "ADJUSTMENT_IN", reference || "", user || "admin", unitCost || null, notes || "");
  if (!transaction) throw new NotFoundError("Inventory item not found");
  store.persist();
  if (session) publishLowStockAlert(itemId, previousStock, { userId: session.userId, role: session.userId, isAdmin: true });
  res.status(201).json(transaction);
});

router.post("/reservations", required("inventory.reserve"), (req, res) => {
  const { itemId, quantity, orderId, reference } = req.body || {};
  if (!itemId || quantity === undefined) return res.status(400).json({ error: "itemId and quantity are required" });
  const item = store.inventoryItems().find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Inventory item not found");
  const available = (item.physicalStock || 0) - (store.stockReservations().filter((r) => r.itemId === item.id).reduce((s, r) => s + r.quantity, 0));
  if (quantity > available) return res.status(409).json({ error: `Only ${available} ${item.unit} available` });
  const reservation: import("../database/types.js").StockReservation = {
    id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemId,
    quantity,
    unit: item.unit,
    orderId: orderId || null,
    reference: reference || null,
    reservedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.stockReservations().push(reservation);
  store.persist();
  res.status(201).json(reservation);
});

export default router;
