import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";
import { makeId } from "../utils/make-id.js";
import { paginate } from "../utils/paginate.js";
import { businessService } from "../services/business.service.js";

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

router.get("/", required("payments.view"), (req, res) => {
  const payments = store.payments();
  const orderId = req.query.orderId as string | undefined;
  let list = payments;
  if (orderId) list = list.filter((p) => p.orderId === orderId);
  // §33 — opt-in pagination envelope (plain array without ?page=).
  res.json(paginate(list, req.query, {
    sortable: ["createdAt", "amount", "method"],
    dateField: "createdAt",
    searchFields: ["reference", "notes", "method"],
  }));
});

// ── M-Pesa STK push simulator (E4) ─────────────────────────────────────────
// The store is the source of truth for recorded payments; Safaricom is never
// reached. The frontend presses "Pay with M-Pesa" and we hand back the same
// shape the sandbox STK push returns (the mock "Pasa" simulator).
// 1. POST /payments { orderId, amount, method: "M-Pesa", receivedBy, notes }
//    -> 201 { ...payment, stagedPush: { ...mock STK push ... } }
//    `reference` is the simulation ticket (MCA-YYYYMMDD-XXXXXX) - the
//    simulator stamps one when the caller omits it. stagedPush.CheckoutRequestID
//    is the payment id, so the frontend confirms with
//    POST /payments/:id/callback.
// 2. POST /payments/:id/callback { resultCode, resultDesc, ... }
//    -> simulates the customer confirming (0) or aborting (!=0). 0 => order
//    marked PAID and an in-app notification is fired.

function buildStkPushResponse(paymentId: string, orderId: string, amount: number, receivedBy: string | null): Record<string, unknown> {
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!appBaseUrl) {
    throw new Error("APP_BASE_URL is not set — copy server/.env.example to server/.env and set it");
  }
  const phone =
    receivedBy && store.db.users.find((u) => u.id === receivedBy)?.phone
      ? store.db.users.find((u) => u.id === receivedBy)!.phone
      : "256700000000";
  void orderId;
  return {
    MerchantRequestID: makeId("REQ"),
    CheckoutRequestID: paymentId,
    ResponseDescription: "Success. Continue to checkout",
    CustomerMessage: "Success. Continue to checkout",
    CallBackURL: `${appBaseUrl}/api/v1/payments/${paymentId}/callback`,
    ResultCode: 0,
    ResultDesc: "Success",
    MerchantRequestTime: new Date().toISOString(),
    Amount: amount,
    Phone: phone,
    BillRefNumber: "",
  };
}

router.post("/", required("payments.record"), (req, res) => {
  const { orderId, amount, method, reference, receivedBy, notes } = req.body || {};
  if (!orderId || amount === undefined) return res.status(400).json({ error: "orderId and amount are required" });

  let ref = String(reference || "");
  if (method === "M-Pesa" && !ref) {
    ref = `MCA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  const payment = store.createPayment({
    orderId,
    amount: Number(amount),
    method: method || "Cash",
    reference: ref,
    receivedBy: receivedBy || "admin",
    notes: notes || "",
  });

  // Spec §14: outstanding balance is derived server-side from the payment
  // ledger. An M-Pesa push is only *staged* here — the money has not landed
  // yet — so the order goes PROCESSING (the stub state) until the customer
  // confirms in the Pasa simulator; every other method is credited at once.
  if (method === "M-Pesa") {
    const order = store.db.orders.find((o) => o.id === orderId);
    if (order) {
      order.paymentStatus = "PROCESSING";
      order.updatedAt = new Date().toISOString();
    }
  } else {
    store.recomputePaymentStatus(orderId);
    // Ensure a production job exists when a paid order is already in the
    // production pipeline. Mirrors markOrderPaid — every paid pipeline order
    // surfaces on the Jobs board.
    try {
      businessService.prepareOrderForProduction(String(orderId), String(receivedBy || "admin"));
    } catch {
      /* Non-fatal — order may not be in a production-ready status yet. */
    }
  }
  store.createAuditLog({
    actor: String(receivedBy || "admin"), action: "payment:created",
    entityType: "payment", entityId: payment.id, orderId: String(orderId),
    reason: `${method || "Cash"}${ref ? ` · ${ref}` : ""} · order ${orderId}`,
  });
  store.persist();

  res.status(201).json({
    ...payment,
    stagedPush: method === "M-Pesa" ? buildStkPushResponse(payment.id, orderId, Number(amount), receivedBy) : null,
  });
});

router.post("/:id/callback", required("payments.record"), (req, res) => {
  const id = String(req.params.id);
  const payment = store.db.payments.find((p) => p.id === id);
  if (!payment) throw new NotFoundError("Payment not found");

  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  const actor = session?.userId ?? "admin";
  const body = req.body || {};
  const resultCode = Number(body.resultCode);
  const order = store.db.orders.find((o) => o.id === payment.orderId);

  if (resultCode === 0) {
    // Money landed: the staged payment was already in the ledger at POST, so
    // the derived status now recomputes to PAID (or OVERPAID when covered).
    store.recomputePaymentStatus(payment.orderId);
    // Ensure a production job exists when a paid order is already in the
    // production pipeline — mirrors the markOrderPaid flow so every paid
    // pipeline order surfaces on the Jobs board.
    try {
      businessService.prepareOrderForProduction(payment.orderId, actor);
    } catch {
      /* Non-fatal — order may not be in a production-ready status yet. */
    }
    store.createNotification({
      eventTypeId: "PaymentReceived",
      title: "Payment received",
      message: `M-Pesa payment of USh ${Number(payment.amount).toLocaleString("en-UG")} recorded against order ${payment.orderId} (reference ${payment.reference}).`,
      priority: "HIGH",
      entityType: "payment",
      entityId: id,
      actionUrl: "/workspace/finance#payments",
      deepLink: null,
      createdBy: actor,
    });
  } else {
    // Customer aborted / the push failed: the money never landed, so the
    // staged payment leaves the ledger and the order drops back to whatever
    // the remaining payments justify (usually UNPAID).
    const idx = store.db.payments.findIndex((p) => p.id === id);
    if (idx !== -1) store.db.payments.splice(idx, 1);
    store.recomputePaymentStatus(payment.orderId);
    store.createNotification({
      eventTypeId: "PaymentReceived",
      title: "M-Pesa payment failed",
      message: `Stub callback for payment ${id} returned resultCode ${resultCode}: ${body.resultDesc || "unknown reason"}. Check the reference and retry.`,
      priority: "MEDIUM",
      entityType: "payment",
      entityId: id,
      actionUrl: "/workspace/finance#payments",
      deepLink: null,
      createdBy: actor,
    });
  }
  store.persist();

  res.json({ ok: true, payment: { ...payment, status: resultCode === 0 ? "COMPLETED" : "FAILED" }, orderPaymentStatus: order?.paymentStatus ?? null });
});

export default router;
