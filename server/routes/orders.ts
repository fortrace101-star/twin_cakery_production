import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { flush } from "../database/index.new.js";
import { pool } from "../database/db.js";
import { RbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { businessService } from "../services/business.service.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { paginate } from "../utils/paginate.js";
import type { OrderStation } from "../database/types.js";
import type { Order, OrderItem, OrderRevision, OrderRevisionChange } from "../database/types.js";

function resolveOrderRef(idOrNumber: string) {
  const key = String(idOrNumber || "");
  return store.orders().find((o) => o.id === key || o.orderNumber === key) || store.findOrder?.(key);
}

async function resolveOrderIdPg(idOrNumber: string): Promise<string | null> {
  const key = String(idOrNumber || "");
  const byId = await pool.query<{ id: string }>(`SELECT id FROM orders WHERE id = $1 LIMIT 1`, [key]);
  if (byId.rowCount) return byId.rows[0].id;
  const byNum = await pool.query<{ id: string }>(`SELECT id FROM orders WHERE order_number = $1 LIMIT 1`, [key]);
  if (byNum.rowCount) return byNum.rows[0].id;
  const mem = resolveOrderRef(key);
  return mem?.id ?? null;
}

async function persistOrderStatusPg(orderIdOrNumber: string, newStatus: string, changedBy: string, reason: string) {
  const now = new Date().toISOString();
  const histId = `osh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const prev = await pool.query<{ id: string; status: string }>(
    `SELECT id, status FROM orders WHERE id = $1 OR order_number = $1 LIMIT 1`,
    [String(orderIdOrNumber || "")],
  );
  if (prev.rowCount === 0) throw new NotFoundError("Order not found");
  const orderId = prev.rows[0].id;
  const previousStatus = prev.rows[0].status;
  await pool.query(`UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3`, [newStatus, now, orderId]);
  await pool.query(
    `INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, reason, timestamp, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [histId, orderId, previousStatus, newStatus, String(changedBy ?? ""), String(reason ?? ""), now, now, now],
  );
  const history = { id: histId, orderId, previousStatus, newStatus, changedBy: String(changedBy ?? ""), reason: String(reason ?? ""), timestamp: now, createdAt: now, updatedAt: now };
  // Keep in-memory cache aligned so the DB mirror (saveCache) cannot clobber
  // direct-PG writes, and so reads in this process reflect the transition.
  try { store.updateOrder(orderId, { status: newStatus, station: newStatus === "CONFIRMED" ? "confirmed" : undefined } as any); } catch {}
  try {
    const o = store.db.orders.find((x) => x.id === orderId || (x as any).orderNumber === orderId);
    if (o) { (o as any).status = newStatus; (o as any).station = newStatus === "CONFIRMED" ? "confirmed" : (o as any).station; (o as any).updatedAt = now; }
  } catch {}
  try {
    if (!Array.isArray((store.db as any).orderStatusHistory)) (store.db as any).orderStatusHistory = [];
    (store.db as any).orderStatusHistory.push(history);
  } catch {}
  return { orderId, previousStatus, newStatus, history };
}

function makeServerOrderNumber(seed = "") {
  // Server-authoritative, low-collision display number. The DB has a UNIQUE
  // constraint on order_number; callers retry on 23505 if a race still occurs.
  const base = String(seed || "").trim();
  if (base && /^TC-[A-Za-z0-9-]{4,32}$/.test(base)) return base;
  return `TC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function isUniqueOrderNumberError(err: any): boolean {
  if (err?.code !== "23505") return false;
  const msg = `${err?.constraint || ""} ${err?.detail || ""} ${err?.message || ""}`.toLowerCase();
  return msg.includes("order_number") || msg.includes("order number");
}

async function persistOrderToPg(record: any, initialHistory?: any) {
  // Postgres mandatory: persist order + items (+ optional initial history). DB columns only.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO orders (id,order_number,customer_id,salesperson_id,subtotal,discount,delivery_charge,tax_amount,total,currency,required_by,required_at,notes,status,payment_status,delivery_status,quotation_id,inquiry_id,created_by,delivered_at,created_at,updated_at,follow_up_completed_at,delivery_location,location_note,event_type,reference,guest_count,delivery_type,source,contact_name,contact_phone,version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
       ON CONFLICT (id) DO NOTHING`,
      [record.id, record.orderNumber, record.customerId, record.salespersonId ?? null, Number(record.subtotal||0), Number(record.discount||0), Number(record.deliveryCharge||0), Number(record.taxAmount||0), Number(record.total||0), record.currency ?? "KES", record.requiredBy ?? null, record.requiredAt ?? null, String(record.notes ?? ""), record.status, record.paymentStatus ?? "UNPAID", record.deliveryStatus ?? "PENDING", record.quotationId ?? null, record.inquiryId ?? null, String(record.createdBy ?? ""), record.deliveredAt ?? null, record.createdAt, record.updatedAt, record.followUpCompletedAt ?? null, String(record.deliveryLocation ?? ""), String(record.locationNote ?? ""), String(record.eventType ?? ""), String(record.reference ?? ""), record.guestCount === undefined || record.guestCount === null || record.guestCount === "" ? null : Number(record.guestCount), String(record.deliveryType ?? ""), String(record.source ?? ""), String(record.contactName ?? ""), String(record.contactPhone ?? ""), Number(record.version || 1)],
    );
    for (const item of Array.isArray(record.items) ? record.items : []) {
      await client.query(
        `INSERT INTO order_items (id,order_id,product_id,variant_options,quantity,unit_price,discount,total,recipe_version,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING`,
        [item.id, record.id, item.productId, String(item.variantOptions ?? ""), Number(item.quantity||0), Number(item.unitPrice||0), Number(item.discount||0), Number(item.total||0), item.recipeVersion ?? null, item.createdAt ?? record.createdAt, item.updatedAt ?? record.updatedAt],
      );
    }
    if (initialHistory?.id) {
      await client.query(
        `INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, reason, timestamp, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [initialHistory.id, record.id, initialHistory.previousStatus, initialHistory.newStatus, String(initialHistory.changedBy ?? ""), String(initialHistory.reason ?? ""), initialHistory.timestamp ?? record.createdAt, initialHistory.createdAt ?? record.createdAt, initialHistory.updatedAt ?? record.updatedAt],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

const router = Router();
const rbacService = new RbacService()
const authService = new AuthService();

const required = (perm: string): RequestHandler => async (req, res, next) => {
  try {
    const session = await authService.requireAuth(extractToken(req.headers.authorization as string | undefined));
    await rbacService.requirePermission(session.userId, perm);
    next();
  } catch (err: any) {
    if (err instanceof Error && err.name === "UnauthorizedError") return res.status(401).json({ error: err.message });
    if (err instanceof Error && err.name === "ForbiddenError") return res.status(403).json({ error: err.message });
    next(err);
  }
};

router.get("/", required("orders.view"), (req, res) => {
  const orders = store.orders();
  const status = req.query.status as string | undefined;
  const customerId = req.query.customerId as string | undefined;
  let list = orders;
  if (customerId) list = list.filter((o) => o.customerId === customerId);
  if (status) {
    const statuses = String(status).split(",").map((s) => s.trim()).filter(Boolean);
    list = statuses.length > 1 ? list.filter((o) => statuses.includes(o.status)) : list.filter((o) => o.status === status);
  }
  // §33 — opt-in `?page=&pageSize=` envelope; no params → plain array (unchanged).
  res.json(paginate(list, req.query, {
    sortable: ["createdAt", "requiredBy", "total", "status"],
    dateField: "createdAt",
    searchFields: ["orderNumber", "notes"],
  }));
});

router.post("/", required("orders.create"), async (req, res) => {
  const { orderNumber, customerId, salespersonId, items: reqItems, subtotal: reqSubtotal, discount = 0, deliveryCharge = 0, taxAmount = 0, total: reqTotal, requiredBy, requiredAt, notes, status, paymentStatus, deliveryStatus, quotationId, inquiryId, createdBy, deliveryLocation, locationNote } = req.body || {};
  if (!customerId) return res.status(400).json({ error: "customerId is required" });
  const catalogueProducts = store.db.catalogue?.products || [];
  const items = Array.isArray(reqItems)
    ? reqItems.map((raw: any) => {
        const productId = String(raw.productId || "");
        const product = catalogueProducts.find((p: any) => p.id === productId);
        const unitPrice = product && product.basePrice !== undefined ? Number(product.basePrice) : Number(raw.unitPrice || 0);
        const quantity = Number(raw.quantity || 0);
        const lineDiscount = Number(raw.discount || 0);
        const total = unitPrice * quantity - lineDiscount;
        return {
          productId,
          variantOptions: raw.variantOptions || "",
          quantity,
          unitPrice,
          discount: lineDiscount,
          total: Math.max(0, total),
          recipeVersion: raw.recipeVersion || null,
        };
      })
    : [];
  const subtotal = items.reduce((sum: number, i: any) => sum + Number(i.total || 0) + Number(i.discount || 0), 0);
  const total = subtotal + Number(deliveryCharge || 0) + Number(taxAmount || 0) - Number(discount || 0);
  const record = store.createOrder({
    // Ignore optimistic client display numbers; order_number is UNIQUE in Postgres.
    orderNumber: makeServerOrderNumber(),
    customerId,
    salespersonId: salespersonId || null,
    items,
    subtotal,
    discount: Number(discount || 0),
    deliveryCharge: Number(deliveryCharge || 0),
    taxAmount: Number(taxAmount || 0),
    total: Math.max(0, total),
    requiredBy: requiredBy || null,
    requiredAt: requiredAt || null,
    notes: notes || "",
    status: status || "INQUIRY",
    paymentStatus: paymentStatus ?? "UNPAID",
    deliveryStatus: deliveryStatus ?? "PENDING",
    quotationId: quotationId || null,
    inquiryId: inquiryId || null,
    createdBy: createdBy || "",
    deliveryLocation: deliveryLocation || "",
    locationNote: locationNote || "",
  });
  let lastErr: any;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (attempt > 0) {
        record.orderNumber = makeServerOrderNumber();
        try { store.updateOrder(record.id, { orderNumber: record.orderNumber }); } catch {}
      }
      const initialHistory = [...store.db.orderStatusHistory].reverse().find((h: any) => h.orderId === record.id);
      await persistOrderToPg(record, initialHistory);
      lastErr = null;
      break;
    } catch (err: any) {
      lastErr = err;
      if (!isUniqueOrderNumberError(err) || attempt === 3) break;
    }
  }
  if (lastErr) {
    const msg = lastErr?.message || "Failed to persist order";
    if (/connect|ECONN|timeout|database/i.test(msg)) return res.status(503).json({ error: "Database unavailable", detail: msg });
    return res.status(500).json({ error: msg });
  }
  res.status(201).json(record);
});

router.get("/:id", required("orders.view"), (req, res) => {
  const order = resolveOrderRef(String(req.params.id));
  if (!order) throw new NotFoundError("Order not found");
  res.json(order);
});

router.get("/:id/history", required("orders.view"), (req, res) => {
  const order = resolveOrderRef(String(req.params.id));
  if (!order) throw new NotFoundError("Order not found");
  const history = store.db.orderStatusHistory as import("../database/types.js").OrderStatusHistory[];
  res.json(history.filter((h) => h.orderId === order.id));
});

router.patch("/:id", required("deliveries.update"), async (req, res) => {
  const rawId = String(req.params.id);
  let order = resolveOrderRef(rawId);
  if (!order) throw new NotFoundError("Order not found");
  const id = order.id;
  const patch = req.body || {};

  // ORD-01: whitelist financial/identity fields; status transitions are allowed
  // (validated + durably persisted) to support production/delivery flows (e.g.
  // "Mark Awaiting Pickup" → AWAITING_COLLECTION).
  const forbidden = ['total', 'paymentStatus', 'customerId', 'paidAt', 'balanceDue'] as const;
  for (const key of forbidden) {
    if (key in patch) {
      return res.status(400).json({ error: `Field '${key}' cannot be updated via this endpoint` });
    }
  }

  const wasCompleted = order.status === "COMPLETED_DELIVERED";

  // Status transition (optional): validate, then persist durably to Postgres.
  if (patch.status !== undefined) {
    let nextStatus = String(patch.status || "").trim().toUpperCase().replace(/s+/g, "_");
    if (nextStatus === "AWAITING_PICKUP") nextStatus = "AWAITING_COLLECTION"; // legacy alias
    if (nextStatus && nextStatus !== String(order.status)) {
      try {
        (businessService as any).validateOrderStatusTransition?.(order.status, nextStatus);
      } catch (err: any) {
        return res.status(409).json({ error: err?.message || "Invalid status transition" });
      }
      const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
      try {
        await persistOrderStatusPg(id, nextStatus, session?.userId ?? "system", String(patch.statusReason || patch.reason || "Status updated"));
      } catch (err: any) {
        if (err?.name === "NotFoundError" || err instanceof NotFoundError) throw err;
        const msg = err?.message || "Failed to persist status";
        if (/connect|ECONN|timeout|database/i.test(msg)) return res.status(503).json({ error: "Database unavailable", detail: msg });
        return res.status(500).json({ error: msg });
      }
      // Re-read authoritative in-memory state so the response payload reflects
      // the transition, and so the client does not see a stale label on retry.
      order = store.orders().find((o) => o.id === id) || store.findOrder?.(id);
      if (order) {
        (order as any).status = nextStatus;
        (order as any).updatedAt = new Date().toISOString();
        if (nextStatus === "CONFIRMED" || nextStatus === "COMPLETED_DELIVERED" || nextStatus === "CANCELLED")
          (order as any).station = nextStatus === "CONFIRMED" ? "confirmed" : "done";
      }
    }
  }

  // Non-status field updates (allowed subset). Reject unknown fields (spec 7.3)
  // so silently-dropped edits don't slip through; status/reason are handled above.
  const allowed = ['notes', 'deliveryType', 'deliveryLocation', 'deliveryDate', 'deliveryTime', 'dueDate', 'dueTime', 'eventType', 'reference', 'guest', 'items', 'source', 'fulfilmentType', 'followUpCompletedAt', 'status', 'statusReason', 'reason'] as const;
  for (const key of Object.keys(patch || {})) {
    if (!(allowed as readonly string[]).includes(key)) {
      return res.status(400).json({ error: `Unknown or unsupported field '${key}'` });
    }
  }
  const allowedUpdates: Record<string, unknown> = {};
  const allowedPatch = ['notes', 'deliveryType', 'deliveryLocation', 'deliveryDate', 'deliveryTime', 'dueDate', 'dueTime', 'eventType', 'reference', 'guest', 'items', 'source', 'fulfilmentType', 'followUpCompletedAt'] as const;
  for (const key of allowedPatch) {
    if (key in patch) allowedUpdates[key] = (patch as any)[key];
  }

  let updated = order;
  if (Object.keys(allowedUpdates).length > 0) {
    updated = store.updateOrder(id, { ...allowedUpdates }) || order;
  }

  if (updated && !wasCompleted && updated.status === "COMPLETED_DELIVERED") {
    updated.followUpCompletedAt = null;
    const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
    businessService.requestCustomerFollowUp(updated, session?.userId ?? "system");
    try { businessService.archiveCompletedJob(updated, session?.userId ?? "system"); } catch { /* non-fatal */ }
  }

  if (updated && ["CONFIRMED", "PRODUCTION_REVIEW", "READY_FOR_PRODUCTION", "IN_PRODUCTION"].includes(updated.status)) {
    const hasJob = store.productionJobs().some((j) => j.orderId === updated.id);
    if (!hasJob) {
      try {
        const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
        businessService.prepareOrderForProduction(updated.id, session?.userId ?? "system");
      } catch { /* Non-fatal */ }
    }
  }

  try {
    store.persist();
    await flush();
  } catch (err: any) {
    const msg = err?.message || "Failed to persist order";
    if (/connect|ECONN|timeout|database/i.test(msg)) return res.status(503).json({ error: "Database unavailable", detail: msg });
    return res.status(500).json({ error: msg });
  }
  // Re-read so the client receives the same authoritative label the server will
  // persist to Postgres; avoids stale reads when another request mutated the
  // in-memory record between the patch and the durability gate.
  const final = store.orders().find((o) => o.id === id) || store.findOrder?.(id) || updated;
  res.json(final);
});

router.post("/:id/confirm", required("orders.confirm"), async (req, res) => {
  const rawId = String(req.params.id);
  const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  try {
    // Resolve + validate against the authoritative Postgres state (accepts id or orderNumber).
    const cur = await pool.query<{ id: string; status: string }>(
      `SELECT id, status FROM orders WHERE id = $1 OR order_number = $1 LIMIT 1`,
      [rawId],
    );
    if (!cur.rowCount) throw new NotFoundError("Order not found");
    const { id: orderId, status: previousStatus } = cur.rows[0];

    if (previousStatus === "CONFIRMED") {
      const order = resolveOrderRef(orderId);
      if (order) { (order as any).status = "CONFIRMED"; (order as any).station = "confirmed"; }
      let job: any = store.productionJobs().find((j) => j.orderId === orderId) ?? null;
      if (!job) {
        try { job = businessService.prepareOrderForProduction(orderId, session.userId).job; } catch {}
      }
      return res.json({ order: order || { id: orderId, status: "CONFIRMED" }, history: null, job, previousStatus, idempotent: true });
    }

    try {
      (businessService as any).validateOrderStatusTransition?.(previousStatus, "CONFIRMED");
    } catch (err: any) {
      return res.status(409).json({ error: err?.message || "Invalid status transition" });
    }

    // Postgres mandatory for the state transition.
    const { history } = await persistOrderStatusPg(orderId, "CONFIRMED", session.userId, "Admin confirmed order");

    // Full confirm side effects (invoice, inventory reservation, notifications, audit,
    // production job) run once for the real transition; best-effort per effect.
    let job: any = null;
    if (previousStatus !== "CONFIRMED") {
      try {
        const orderForEffects = resolveOrderRef(orderId) || ({ id: orderId, status: previousStatus, orderNumber: String(rawId) } as any);
        const out = await (businessService as any).applyConfirmSideEffects?.({ ...orderForEffects, status: previousStatus }, session.userId);
        job = out?.job ?? null;
      } catch { /* non-fatal side effects */ }
    }
    if (!job) {
      try { job = businessService.prepareOrderForProduction(orderId, session.userId).job; } catch {}
      try { job = job ?? store.productionJobs().find((j) => j.orderId === orderId) ?? null; } catch {}
    }

    // Re-read authoritative in-memory state before returning.
    const order = resolveOrderRef(orderId);
    if (order) {
      (order as any).status = "CONFIRMED";
      (order as any).station = "confirmed";
      (order as any).updatedAt = new Date().toISOString();
    }
    try { store.persist(); await flush(); } catch { /* status already in PG */ }
    return res.json({ order: order || { id: orderId, status: "CONFIRMED" }, history, job, previousStatus });
  } catch (err: any) {
    if (err?.name === "NotFoundError" || err instanceof NotFoundError) throw err;
    if (err?.name === "ConflictError" || err?.statusCode === 409) return res.status(409).json({ error: err?.message || "Invalid status transition" });
    const msg = err?.message || "Confirmation failed";
    if (/connect|ECONN|timeout|database/i.test(msg)) return res.status(503).json({ error: "Database unavailable", detail: msg });
    return res.status(500).json({ error: msg });
  }
});

router.post("/:id/cancel", required("orders.cancel"), async (req, res) => {
  const rawId = String(req.params.id);
  const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const { reason = "No reason provided" } = req.body || {};
  try {
    const { orderId, previousStatus, history } = await persistOrderStatusPg(rawId, "CANCELLED", session.userId, String(reason));
    try {
      await pool.query(
        `INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, previous_status, new_status, reason, timestamp, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$9)`,
        [`al-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, session.userId, "order:cancelled", "order", orderId, previousStatus, "CANCELLED", String(reason), new Date().toISOString()],
      );
    } catch { /* audit best-effort */ }
    const order = resolveOrderRef(orderId);
    if (order) { (order as any).status = "CANCELLED"; (order as any).station = "done"; }
    try { store.persist(); await flush(); } catch { /* status already in PG */ }
    res.json({ order: order || { id: orderId, status: "CANCELLED" }, history });
  } catch (err: any) {
    if (err?.name === "NotFoundError" || err instanceof NotFoundError) throw err;
    const msg = err?.message || "Cancellation failed";
    if (/connect|ECONN|timeout|database/i.test(msg)) return res.status(503).json({ error: "Database unavailable", detail: msg });
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /:id/repeat — Repeat Order (governing spec §5 "Repeat Order", rule 28).
 * Creates a NEW draft order using the original as template: products, options,
 * customization notes, production specs (recipeVersion) and totals are copied;
 * the caller may override dates, items (quantity/size/price/options), charges
 * and instructions. The original order is never mutated — the copy gets its
 * own order number, status history and customer snapshot via store.createOrder.
 * Cancelled orders are not eligible templates (409).
 */
router.post("/:id/repeat", required("orders.create"), async (req, res) => {
  const original = store.findOrder(String(req.params.id));
  if (!original) throw new NotFoundError("Order not found");
  if (original.status === "CANCELLED") throw new ConflictError("Cancelled orders cannot be repeated");
  const body = req.body || {};
  const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  const catalogueProducts = store.db.catalogue?.products || [];
  const sourceItems = Array.isArray(body.items) ? body.items : original.items;
  const items = sourceItems.map((raw: any) => {
    const productId = String(raw.productId || "");
    const product = catalogueProducts.find((p: any) => p.id === productId);
    const unitPrice = product && product.basePrice !== undefined ? Number(product.basePrice) : Number(raw.unitPrice || 0);
    const quantity = Number(raw.quantity || 0);
    const lineDiscount = Number(raw.discount || 0);
    const total = unitPrice * quantity - lineDiscount;
    return {
      productId,
      variantOptions: raw.variantOptions || "",
      quantity,
      unitPrice,
      discount: lineDiscount,
      total: Math.max(0, total),
      recipeVersion: raw.recipeVersion || null,
    };
  });
  const subtotal = items.reduce((sum: number, i: any) => sum + Number(i.total || 0) + Number(i.discount || 0), 0);
  const deliveryCharge = Number(body.deliveryCharge ?? original.deliveryCharge);
  const discount = Number(body.discount ?? original.discount);
  const taxAmount = Number(body.taxAmount ?? original.taxAmount);
  const total = body.total !== undefined ? Number(body.total) : subtotal + deliveryCharge + taxAmount - discount;
  const record = store.createOrder({
    orderNumber: makeServerOrderNumber(),
    customerId: original.customerId,
    salespersonId: original.salespersonId,
    items,
    subtotal,
    discount,
    deliveryCharge,
    taxAmount,
    total: Math.max(0, total),
    requiredBy: body.requiredBy ?? original.requiredBy,
    requiredAt: body.requiredAt ?? original.requiredAt,
    notes: body.notes ?? original.notes,
    status: "AWAITING_CONFIRMATION",
    paymentStatus: "UNPAID",
    deliveryStatus: "PENDING",
    quotationId: null,
    inquiryId: null,
    createdBy: session?.userId ?? "",
  });
  let lastErr: any;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (attempt > 0) {
        record.orderNumber = makeServerOrderNumber();
        try { store.updateOrder(record.id, { orderNumber: record.orderNumber }); } catch {}
      }
      const initialHistory = [...store.db.orderStatusHistory].reverse().find((h: any) => h.orderId === record.id);
      await persistOrderToPg(record, initialHistory);
      lastErr = null;
      break;
    } catch (err: any) {
      lastErr = err;
      if (!isUniqueOrderNumberError(err) || attempt === 3) break;
    }
  }
  if (lastErr) {
    const msg = lastErr?.message || "Failed to persist order";
    if (/connect|ECONN|timeout|database/i.test(msg)) return res.status(503).json({ error: "Database unavailable", detail: msg });
    return res.status(500).json({ error: msg });
  }
  res.status(201).json({ order: record, repeatedFrom: original.id });
});



function asNum(v: any, d = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
}
function asStr(v: any, d = ""): string { return v === undefined || v === null ? d : String(v); }

const EDITABLE_EARLY = new Set(["INQUIRY","QUOTATION","AWAITING_CONFIRMATION"]);
const EDITABLE_CONFIRMED = new Set(["CONFIRMED","PRODUCTION_REVIEW","READY_FOR_PRODUCTION"]);
const EDITABLE_PROD = new Set(["IN_PRODUCTION","QUALITY_CHECK","REWORK_REQUIRED"]);
const EDITABLE_LATE = new Set(["READY_FOR_DELIVERY","AWAITING_COLLECTION","IN_TRANSIT"]);
const EDITABLE_DONE = new Set(["COMPLETED_DELIVERED","CANCELLED"]);

function normalizeDeliveryType(v: any): string {
  const s = asStr(v, "").trim().toUpperCase().replace(/\s+/g, "_");
  if (!s) return "";
  if (s === "HOME_DELIVERY" || s === "DELIVERY") return "HOME_DELIVERY";
  if (s === "PICKUP" || s === "COLLECTION") return s === "COLLECTION" ? "COLLECTION" : "PICKUP";
  return asStr(v, "").trim();
}

function diffField(changes: any[], field: string, label: string, before: any, after: any) {
  const b = before ?? "";
  const a = after ?? "";
  if (JSON.stringify(b) === JSON.stringify(a)) return;
  changes.push({ field, label, from: before ?? null, to: after ?? null });
}

async function getUserPerms(userId: string) {
  try { return new Set(await rbacService.getPermissionsForUser(userId)); } catch { return new Set<string>(); }
}

function computeEditedItems(order: any, incomingItems: any[] | undefined, canPrice: boolean, catalogue: any[]) {
  const errors: string[] = [];
  const now = new Date().toISOString();
  const source = Array.isArray(incomingItems) ? incomingItems : (order.items || []);
  if (!source.length) { errors.push("At least one item must remain"); return { items: [], subtotal: 0, errors }; }
  const items = source.map((raw: any, idx: number) => {
    const existing = (order.items || []).find((it: any) => it.id && raw.id && it.id === raw.id) || (order.items || [])[idx];
    const productId = asStr(raw.productId ?? existing?.productId, "");
    const qtyRaw = asNum(raw.quantity ?? existing?.quantity, 0);
    const qty = Math.round(qtyRaw);
    if (productId === "" && !existing?.productId) {
      // allow legacy/custom items with no catalogue product
    } else if (!productId && existing?.productId) {
      // keep existing
    }
    if (!productId && !asStr(existing?.productId, "")) {
      // custom/legacy line item without a catalogue product is allowed
    } else if (!productId) {
      // should not happen, but be lenient
    }
    if (!Number.isFinite(qtyRaw) || qty < 1) errors.push(`Item ${idx + 1}: quantity must be a whole number >= 1`);
    const product = catalogue.find((p: any) => p.id === productId);
    const cataloguePrice = product && product.basePrice !== undefined ? Number(product.basePrice) : asNum(existing?.unitPrice ?? raw.unitPrice, 0);
    let unitPrice = cataloguePrice;
    let unitPriceOverride = null;
    let priceOverridden = false;
    const rawOverride = raw.unitPriceOverride ?? (raw.unitPrice !== undefined ? raw.unitPrice : undefined);
    if (canPrice && rawOverride !== undefined && rawOverride !== null && rawOverride !== "") {
      const ov = asNum(rawOverride, cataloguePrice);
      unitPrice = ov;
      if (product ? ov !== Number(product.basePrice ?? ov) : ov !== asNum(existing?.unitPrice, ov)) { unitPriceOverride = ov; priceOverridden = true; }
    } else if (!canPrice) {
      unitPrice = asNum(existing?.unitPrice ?? raw.unitPrice, 0);
    }
    if (unitPrice < 0) errors.push(`Item ${idx + 1}: unit price cannot be negative`);
    const discount = asNum(raw.discount ?? existing?.discount, 0);
    const lineTotal = unitPrice * Math.max(0, qty) - discount;
    if (discount < 0) errors.push(`Item ${idx + 1}: discount cannot be negative`);
    if (discount > unitPrice * Math.max(0, qty)) errors.push(`Item ${idx + 1}: discount cannot exceed line total`);
    if (lineTotal < 0) errors.push(`Item ${idx + 1}: line total cannot be negative`);
    return {
      id: asStr(raw.id || existing?.id || "", "") || `oi-${Date.now()}-${Math.random().toString(16).slice(2,6)}`,
      orderId: order.id,
      productId,
      variantOptions: asStr(raw.variantOptions ?? existing?.variantOptions, ""),
      quantity: Math.max(0, qty),
      unitPrice,
      discount,
      total: Math.max(0, lineTotal),
      recipeVersion: raw.recipeVersion ?? existing?.recipeVersion ?? null,
      unit: raw.unit ?? existing?.unit,
      unitPriceOverride,
      priceOverridden,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
  });
  const subtotalByLines = items.reduce((s: number, it: any) => s + asNum(it.total), 0);
  return { items, subtotal: Math.max(0, subtotalByLines), errors };
}

async function buildEditPreview(order: any, changes: any, perms: Set<string>) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const canPrice = perms.has("orders.update_price");
  const canLocked = perms.has("orders.update_locked");
  const status = String(order.status);
  const c = changes || {};

  const catalogue = (store.db && store.db.catalogue && store.db.catalogue.products) || [];
  const wantsItems = c.items !== undefined;
  const wantsPriceFields = c.discount !== undefined || c.deliveryCharge !== undefined || c.taxAmount !== undefined || (Array.isArray(c.items) && c.items.some((it: any) => it.unitPrice !== undefined || it.unitPriceOverride !== undefined || it.discount !== undefined));
  const wantsSchedule = c.requiredBy !== undefined || c.requiredAt !== undefined || c.dueDate !== undefined || c.dueTime !== undefined;
  const wantsDelivery = c.deliveryLocation !== undefined || c.locationNote !== undefined || c.deliveryType !== undefined || c.deliveryDate !== undefined || c.deliveryTime !== undefined;

  if (EDITABLE_DONE.has(status)) {
    if (wantsItems || wantsPriceFields || wantsSchedule || wantsDelivery || c.eventType !== undefined || c.reference !== undefined || c.guestCount !== undefined || c.guest !== undefined || c.contactName !== undefined || c.contactPhone !== undefined || c.source !== undefined) {
      errors.push(status === "CANCELLED" ? "Cancelled orders cannot be edited (notes only)." : "Completed orders cannot be edited (notes only).");
    }
  }
  if (EDITABLE_LATE.has(status)) {
    if ((wantsPriceFields || wantsSchedule) && !canLocked) errors.push("Only Admin/Proprietor can change price or schedule at this stage.");
    if (wantsItems && !canLocked) errors.push("Items cannot be edited at this stage.");
  }
  if (EDITABLE_PROD.has(status)) {
    if (wantsItems && !canLocked) warnings.push("Production has started; item changes are restricted and may require manager approval.");
  }
  if (wantsPriceFields && !canPrice) errors.push("Permission required: orders.update_price");

  let items = Array.isArray(order.items) ? [...order.items] : [];
  let subtotal = asNum(order.subtotal, 0);
  if (wantsItems || (canPrice && Array.isArray(c.items))) {
    const computed = computeEditedItems(order, c.items, canPrice, catalogue);
    errors.push(...computed.errors);
    items = computed.items;
    subtotal = computed.subtotal;
  } else {
    subtotal = items.reduce((s: number, it: any) => s + asNum(it.total), 0);
  }

  const discount = c.discount !== undefined ? asNum(c.discount, 0) : asNum(order.discount, 0);
  const deliveryCharge = c.deliveryCharge !== undefined ? asNum(c.deliveryCharge, 0) : asNum(order.deliveryCharge, 0);
  const taxAmount = c.taxAmount !== undefined ? asNum(c.taxAmount, 0) : asNum(order.taxAmount, 0);
  if (discount < 0 || deliveryCharge < 0 || taxAmount < 0) errors.push("Prices, discounts, charges, and tax must be 0 or more");
  const total = subtotal + deliveryCharge + taxAmount - discount;
  if (total < 0) errors.push("Total cannot go below 0");

  const paid = (store.payments() || []).filter((p: any) => p.orderId === order.id).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const balanceDue = total - paid;
  if (total < paid) warnings.push(`Customer has overpaid by ${Math.round(paid - total)}. Record a refund or credit.`);
  if (paid > 0 && total > asNum(order.total, 0)) warnings.push(`Customer now owes ${Math.round(total - asNum(order.total, 0))} more.`);

  const requiredBy = c.requiredBy ?? c.dueDate ?? order.requiredBy;
  const requiredAt = c.requiredAt ?? c.dueTime ?? order.requiredAt;
  if (requiredBy) {
    const dt = new Date(`${String(requiredBy).slice(0,10)}T${String(requiredAt || "23:59").slice(0,5)}:00`);
    if (!Number.isNaN(dt.getTime()) && dt.getTime() < Date.now() && !canLocked) {
      errors.push("Due date/time cannot be in the past without orders.update_locked and a reason");
    } else if (!Number.isNaN(dt.getTime()) && dt.getTime() - Date.now() < 24*60*60*1000) {
      warnings.push("Due date/time is very soon.");
    }
  }

  const deliveryType = normalizeDeliveryType(c.deliveryType ?? order.deliveryType);
  const deliveryLocation = asStr(c.deliveryLocation ?? order.deliveryLocation, "");
  if (deliveryType === "HOME_DELIVERY" && !deliveryLocation.trim()) errors.push("Delivery type HOME_DELIVERY requires a delivery location");

  if (EDITABLE_CONFIRMED.has(status) || EDITABLE_PROD.has(status)) warnings.push("This order is in/after production; dependent records may be updated.");

  const computedPaymentStatus = (() => {
    if (order.paymentStatus === "REFUNDED") return "REFUNDED";
    if (paid <= 0) return "UNPAID";
    if (total <= 0) return "PAID";
    if (paid < total) return "PARTIALLY_PAID";
    if (paid > total) return "OVERPAID";
    return "PAID";
  })();

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    computed: {
      items,
      subtotal,
      discount,
      deliveryCharge,
      taxAmount,
      total: Math.max(0, total),
      paid,
      balanceDue,
      paymentStatus: computedPaymentStatus,
      requiredBy: requiredBy ?? null,
      requiredAt: requiredAt ?? null,
      deliveryType,
      deliveryLocation: (deliveryType === "PICKUP" || deliveryType === "COLLECTION") ? "" : deliveryLocation,
      locationNote: (deliveryType === "PICKUP" || deliveryType === "COLLECTION") ? "" : asStr(c.locationNote ?? order.locationNote, ""),
      notes: c.notes !== undefined ? asStr(c.notes, "") : order.notes,
      eventType: c.eventType !== undefined ? asStr(c.eventType, "") : (order.eventType || ""),
      reference: c.reference !== undefined ? asStr(c.reference, "") : (order.reference || ""),
      guestCount: c.guestCount !== undefined || c.guest !== undefined ? (asStr(c.guestCount ?? c.guest, "") === "" ? null : asNum(c.guestCount ?? c.guest, 0)) : (order.guestCount ?? null),
      source: c.source !== undefined ? asStr(c.source, "") : (order.source || ""),
      contactName: c.contactName !== undefined ? asStr(c.contactName, "") : (order.contactName || ""),
      contactPhone: c.contactPhone !== undefined ? asStr(c.contactPhone, "") : (order.contactPhone || ""),
    },
  };
}

router.post("/:id/edit/preview", required("orders.update"), async (req, res) => {
  const rawId = String(req.params.id);
  const order = resolveOrderRef(rawId);
  if (!order) throw new NotFoundError("Order not found");
  const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const perms = await getUserPerms(session.userId);
  const preview = await buildEditPreview(order, req.body?.changes || req.body || {}, perms);
  if (!preview.ok) return res.status(400).json({ errors: preview.errors, warnings: preview.warnings, preview: preview.computed });
  res.json({ ok: true, warnings: preview.warnings, preview: preview.computed, balanceDue: preview.computed.balanceDue, paid: preview.computed.paid, total: preview.computed.total });
});

router.get("/:id/revisions", required("orders.view"), async (req, res) => {
  const rawId = String(req.params.id);
  const order = resolveOrderRef(rawId);
  if (!order) throw new NotFoundError("Order not found");
  try {
    const r = await pool.query(
      `SELECT id, order_id as "orderId", version, changed_by as "changedBy", changed_at as "changedAt", reason, changes, null::numeric as "totalBefore", null::numeric as "totalAfter", changed_at as "createdAt", changed_at as "updatedAt"
       FROM order_revisions WHERE order_id = $1 ORDER BY changed_at DESC, version DESC`,
      [order.id],
    );
    const statusHistory = (store.db.orderStatusHistory || []).filter((h) => h.orderId === order.id);
    res.json({ revisions: r.rows || [], statusHistory });
  } catch (err: any) {
    const msg = err?.message || "";
    if (/order_revisions|relation .* does not exist/i.test(msg)) return res.json({ revisions: [], statusHistory: (store.db.orderStatusHistory || []).filter((h: any) => h.orderId === order.id) });
    throw err;
  }
});

router.put("/:id/edit", required("orders.update"), async (req, res) => {
  const rawId = String(req.params.id);
  const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const perms = await getUserPerms(session.userId);
  if (!perms.has("orders.update")) return res.status(403).json({ error: "Permission required: orders.update" });

  const order = resolveOrderRef(rawId);
  if (!order) throw new NotFoundError("Order not found");
  const body = req.body || {};
  const expectedVersion = body.expectedVersion;
  const currentVersion = Number(order.version || 1);
  if (expectedVersion !== undefined && Number(expectedVersion) !== currentVersion) {
    return res.status(409).json({ error: "This order was changed by someone else", code: "VERSION_CONFLICT", currentVersion });
  }

  const reason = asStr(body.reason, "").trim();
  const changesInput = body.changes || {};
  const preview = await buildEditPreview(order, changesInput, perms);
  if (!preview.ok) return res.status(400).json({ errors: preview.errors, warnings: preview.warnings });

  const status = String(order.status);
  const sensitive = ["CONFIRMED","PRODUCTION_REVIEW","READY_FOR_PRODUCTION","IN_PRODUCTION","QUALITY_CHECK","REWORK_REQUIRED","READY_FOR_DELIVERY","AWAITING_COLLECTION","IN_TRANSIT"].includes(status);
  if (sensitive) {
    const needsReason = changesInput.items !== undefined || changesInput.discount !== undefined || changesInput.deliveryCharge !== undefined || changesInput.taxAmount !== undefined || changesInput.requiredBy !== undefined || changesInput.requiredAt !== undefined || changesInput.dueDate !== undefined || changesInput.dueTime !== undefined || changesInput.deliveryLocation !== undefined;
    if (needsReason && !reason) return res.status(400).json({ error: "Reason is required for this change" });
  }

  const now = new Date().toISOString();
  const computed = preview.computed;
  const before = JSON.parse(JSON.stringify(order));
  const changeLog: any[] = [];
  diffField(changeLog, "items", "Items", (before.items || []).map((i: any) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, options: i.variantOptions })), (computed.items || []).map((i: any) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, options: i.variantOptions })));
  diffField(changeLog, "subtotal", "Subtotal", before.subtotal, computed.subtotal);
  diffField(changeLog, "discount", "Discount", before.discount, computed.discount);
  diffField(changeLog, "deliveryCharge", "Delivery charge", before.deliveryCharge, computed.deliveryCharge);
  diffField(changeLog, "taxAmount", "Tax", before.taxAmount, computed.taxAmount);
  diffField(changeLog, "total", "Total", before.total, computed.total);
  diffField(changeLog, "requiredBy", "Due date", before.requiredBy, computed.requiredBy);
  diffField(changeLog, "requiredAt", "Due time", before.requiredAt, computed.requiredAt);
  diffField(changeLog, "deliveryType", "Delivery type", before.deliveryType, computed.deliveryType);
  diffField(changeLog, "deliveryLocation", "Delivery location", before.deliveryLocation, computed.deliveryLocation);
  diffField(changeLog, "locationNote", "Location note", before.locationNote, computed.locationNote);
  diffField(changeLog, "notes", "Notes", before.notes, computed.notes);
  diffField(changeLog, "eventType", "Event type", before.eventType, computed.eventType);
  diffField(changeLog, "reference", "Reference", before.reference, computed.reference);
  diffField(changeLog, "guestCount", "Guest count", before.guestCount, computed.guestCount);
  diffField(changeLog, "source", "Source", before.source, computed.source);
  diffField(changeLog, "contactName", "Contact name", before.contactName, computed.contactName);
  diffField(changeLog, "contactPhone", "Contact phone", before.contactPhone, computed.contactPhone);
  if (changeLog.length === 0) return res.json({ order, changes: [], warnings: preview.warnings, message: "No changes" });

  const newVersion = currentVersion + 1;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lock = await client.query(`SELECT version FROM orders WHERE id = $1 FOR UPDATE`, [order.id]);
    if (!lock.rowCount) throw new NotFoundError("Order not found");
    const dbVersion = Number(lock.rows[0].version || 1);
    if (dbVersion !== currentVersion) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This order was changed by someone else", code: "VERSION_CONFLICT", currentVersion: dbVersion });
    }

    await client.query(`DELETE FROM order_items WHERE order_id = $1`, [order.id]);
    for (const item of computed.items) {
      await client.query(
        `INSERT INTO order_items (id,order_id,product_id,variant_options,quantity,unit_price,discount,total,recipe_version,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [item.id, order.id, asStr(item.productId, ""), asStr(item.variantOptions, ""), Number(item.quantity||0), Number(item.unitPrice||0), Number(item.discount||0), Number(item.total||0), item.recipeVersion ?? null, item.createdAt || now, now],
      );
    }

    await client.query(
      `UPDATE orders SET subtotal=$1, discount=$2, delivery_charge=$3, tax_amount=$4, total=$5, required_by=$6, required_at=$7, notes=$8,
        delivery_location=$9, location_note=$10, event_type=$11, reference=$12, guest_count=$13, delivery_type=$14, source=$15,
        contact_name=$16, contact_phone=$17, version=$18, updated_at=$19, payment_status=$20
       WHERE id=$21`,
      [
        Number(computed.subtotal||0), Number(computed.discount||0), Number(computed.deliveryCharge||0), Number(computed.taxAmount||0), Number(computed.total||0),
        computed.requiredBy ?? null, computed.requiredAt ?? null, String(computed.notes || ""),
        String(computed.deliveryLocation || ""), String(computed.locationNote || ""), String(computed.eventType || ""), String(computed.reference || ""),
        computed.guestCount === null || computed.guestCount === undefined ? null : Number(computed.guestCount),
        String(computed.deliveryType || ""), String(computed.source || ""), String(computed.contactName || ""), String(computed.contactPhone || ""),
        newVersion, now, String(computed.paymentStatus || order.paymentStatus), order.id,
      ],
    );

    try {
      const jobRes = await client.query(`SELECT id FROM production_jobs WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`, [order.id]);
      if (jobRes.rowCount) {
        const first = computed.items[0];
        await client.query(
          `UPDATE production_jobs SET product_id=$1, variant_options=$2, quantity=$3, required_by=$4, required_at=$5, notes=$6, updated_at=$7 WHERE id=$8`,
          [first?.productId || "", asStr(first?.variantOptions, ""), Number(first?.quantity || computed.items.reduce((s: number,i: any)=>s+Number(i.quantity||0),0) || 0), computed.requiredBy ?? null, computed.requiredAt ?? null, String(computed.notes || ""), now, (jobRes.rows[0] as any).id],
        );
      }
    } catch {}
    try { await client.query(`UPDATE deliveries SET destination=$1, updated_at=$2 WHERE order_id=$3`, [String(computed.deliveryLocation || ""), now, order.id]); } catch {}

    const revId = `orev-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    await client.query(
      `INSERT INTO order_revisions (id, order_id, version, changed_by, changed_at, reason, changes)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [revId, order.id, newVersion, String(session.userId || ""), now, reason, JSON.stringify(changeLog)],
    );
    const auditId = `aud-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    await client.query(
      `INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, reason, timestamp, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$7)`,
      [auditId, String(session.userId || ""), "order:edited", "order", order.id, reason, now],
    );

    await client.query("COMMIT");

    order.items = computed.items;
    order.subtotal = computed.subtotal;
    order.discount = computed.discount;
    order.deliveryCharge = computed.deliveryCharge;
    order.taxAmount = computed.taxAmount;
    order.total = computed.total;
    order.requiredBy = computed.requiredBy;
    order.requiredAt = computed.requiredAt;
    order.notes = computed.notes;
    order.deliveryLocation = computed.deliveryLocation;
    order.locationNote = computed.locationNote;
    order.eventType = computed.eventType;
    order.reference = computed.reference;
    order.guestCount = computed.guestCount;
    order.deliveryType = computed.deliveryType;
    order.source = computed.source;
    order.contactName = computed.contactName;
    order.contactPhone = computed.contactPhone;
    (order as any).paymentStatus = computed.paymentStatus;
    order.version = newVersion;
    order.updatedAt = now;
    store.db.orderItems = (store.db.orderItems || []).filter((it) => it.orderId !== order.id).concat(computed.items);
    try { store.persist(); } catch {}

    const updated = resolveOrderRef(order.id) || order;
    res.json({ order: updated, changes: changeLog, warnings: preview.warnings, revision: { id: revId, orderId: order.id, version: newVersion, changedBy: session.userId, changedAt: now, reason, changes: changeLog, totalBefore: before.total, totalAfter: computed.total } });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("[orders.edit] failed", err?.stack || err);
    if (err?.name === "NotFoundError" || err instanceof NotFoundError) throw err;
    const msg = err?.message || "Failed to edit order";
    if (/connect|ECONN|timeout|database/i.test(msg)) return res.status(503).json({ error: "Database unavailable", detail: msg });
    return res.status(500).json({ error: msg });
  } finally {
    client.release();
  }
});

export default router;

