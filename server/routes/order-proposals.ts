import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";

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

function currentUser(req: { headers: { authorization?: string } }): string {
  try {
    const session = authService.requireAuth(extractToken(req.headers.authorization));
    return session.userId;
  } catch {
    return "";
  }
}

/**
 * Staff review queue for website order proposals (E6 §§29–30).
 *
 * The public form never creates orders directly (spec: "does not bypass Admin
 * confirmation"). Staff list PENDING_REVIEW proposals here, then confirm —
 * which mints the INQUIRY-status order draft that enters the normal
 * confirm → produce → deliver pipeline — or cancel with a reason.
 */

router.get("/", required("orders.view"), (req, res) => {
  const status = req.query.status as string | undefined;
  let list = store.orderProposals().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (status) list = list.filter((p) => p.status === status);
  res.json(list);
});

router.get("/:id", required("orders.view"), (req, res) => {
  const proposal = store.findOrderProposal(String(req.params.id));
  if (!proposal) throw new NotFoundError("Order proposal not found");
  res.json(proposal);
});

router.post("/:id/confirm", required("orders.confirm"), (req, res) => {
  const proposal = store.findOrderProposal(String(req.params.id));
  if (!proposal) throw new NotFoundError("Order proposal not found");
  if (proposal.status !== "PENDING_REVIEW") {
    throw new ValidationError(`Proposal is already ${proposal.status}`);
  }
  const me = currentUser(req);
  // Resolve-or-create the canonical customer (exact email/phone match only).
  const email = proposal.email.trim().toLowerCase();
  const phone = proposal.phone.trim();
  const existing = store
    .customers()
    .find((c) => (email && c.email.trim().toLowerCase() === email) || (phone && c.phone.trim() === phone));
  const customer =
    existing ??
    store.createCustomer({
      name: proposal.customerName,
      phone: proposal.phone,
      email: proposal.email,
      source: "Website",
      notes: `Confirmed from online proposal ${proposal.proposalNumber}.`,
    });
  const items = proposal.items.map((i) => ({
    productId: i.productId,
    variantOptions: i.variantOptions,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discount: 0,
    total: i.total,
  }));
  const subtotal = items.reduce((n, i) => n + i.total, 0);
  const order = store.createOrder({
    orderNumber: `TC-${Date.now().toString().slice(-6)}`,
    customerId: customer.id,
    salespersonId: null,
    items,
    subtotal,
    discount: 0,
    deliveryCharge: 0,
    taxAmount: 0,
    total: subtotal,
    requiredBy: proposal.preferredDate,
    requiredAt: null,
    notes: [
      `Online proposal ${proposal.proposalNumber}`,
      proposal.deliveryType !== "PICKUP" && `Delivery: ${proposal.deliveryType}${proposal.deliveryLocation ? ` — ${proposal.deliveryLocation}` : ""}`,
      proposal.customerNotes && `Customer notes: ${proposal.customerNotes}`,
    ]
      .filter(Boolean)
      .join("\n"),
    status: "INQUIRY",
    paymentStatus: "UNPAID",
    deliveryStatus: "PENDING",
    quotationId: null,
    inquiryId: proposal.inquiryId,
    createdBy: me,
  });
  store.createOrderCustomerSnapshot(order);
  if (proposal.inquiryId) {
    const inquiry = store.findInquiry(proposal.inquiryId);
    if (inquiry) {
      store.updateInquiry(inquiry.id, {
        status: "IN_PROGRESS",
        relatedOrderId: order.id,
        nextAction: `Review confirmed online order ${order.orderNumber}`,
      });
    }
  }
  store.updateOrderProposal(proposal.id, {
    status: "CONFIRMED",
    customerId: customer.id,
    orderId: order.id,
    reviewedBy: me || null,
    reviewedAt: new Date().toISOString(),
    reviewNotes: String((req.body || {}).reviewNotes ?? "").slice(0, 500),
  });
  store.persist();
  res.status(201).json({ proposal: store.findOrderProposal(proposal.id), order });
});

router.post("/:id/cancel", required("orders.confirm"), (req, res) => {
  const proposal = store.findOrderProposal(String(req.params.id));
  if (!proposal) throw new NotFoundError("Order proposal not found");
  if (proposal.status !== "PENDING_REVIEW") {
    throw new ValidationError(`Proposal is already ${proposal.status}`);
  }
  const me = currentUser(req);
  store.updateOrderProposal(proposal.id, {
    status: "CANCELLED",
    reviewedBy: me || null,
    reviewedAt: new Date().toISOString(),
    reviewNotes: String((req.body || {}).reviewNotes ?? "").slice(0, 500),
  });
  store.persist();
  res.json(store.findOrderProposal(proposal.id));
});

export default router;
