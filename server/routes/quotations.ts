import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";

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

router.get("/", required("quotations.view"), (req, res) => {
  const quotations = store.quotations();
  const status = req.query.status as string | undefined;
  let list = quotations;
  if (status) list = list.filter((q) => q.status === status);
  res.json(list);
});

router.post("/", required("quotations.create"), (req, res) => {
  const { quotationNumber, customerId, salespersonId, items, notes, validityExpiry, status, taxAmount, total, unitTotal } = req.body || {};
  if (!customerId) return res.status(400).json({ error: "customerId is required" });
  const record = store.createQuotation({
    quotationNumber: quotationNumber || `QT-${Date.now().toString().slice(-6)}`,
    customerId,
    salespersonId: salespersonId || null,
    items: items || [],
    notes: notes || "",
    validityExpiry: validityExpiry || null,
    status: status || "DRAFT",
    taxAmount: taxAmount || 0,
    total: total || 0,
    unitTotal: unitTotal || 0,
    submittedAt: null,
    acceptedAt: null,
    createdBy: store.users().find((u) => u.isAdmin === true)?.id || "",
  });
  store.persist();
  res.status(201).json(record);
});

router.get("/:id", required("quotations.view"), (req, res) => {
  const quotation = store.quotations().find((q) => q.id === String(req.params.id));
  if (!quotation) throw new NotFoundError("Quotation not found");
  res.json(quotation);
});

router.patch("/:id", required("quotations.edit"), (req, res) => {
  const id = String(req.params.id);
  const quotation = store.quotations().find((q) => q.id === id);
  if (!quotation) throw new NotFoundError("Quotation not found");
  const patch = req.body || {};
  const updated = { ...quotation, ...patch, updatedAt: new Date().toISOString() };
  store.persist();
  res.json(updated);
});

router.post("/:id/send", required("quotations.accept"), (req, res) => {
  const id = String(req.params.id);
  const quotation = store.quotations().find((q) => q.id === id);
  if (!quotation) throw new NotFoundError("Quotation not found");
  const updated = store.sendQuotation(id);
  if (!updated) throw new NotFoundError("Quotation not found");
  store.persist();
  res.json(updated);
});

router.post("/:id/accept", required("quotations.accept"), (req, res) => {
  const id = String(req.params.id);
  const quotation = store.quotations().find((q) => q.id === id);
  if (!quotation) throw new NotFoundError("Quotation not found");
  const updated = store.acceptQuotation(id);
  if (!updated) throw new NotFoundError("Quotation not found");
  store.persist();
  res.json(updated);
});

export default router;
