import { Router, RequestHandler } from "express";
import { store } from "../database/store";
import { flush } from "../database/index.new";
import { RbacService } from "../services/rbac.service";
import { AuthService, extractToken } from "../services/auth.service";
import { NotFoundError } from "../utils/errors";

const router = Router();
const rbacService = new RbacService()
const authService = new AuthService();

const required = (perm: string): RequestHandler => async (req, res, next) => {
  try {
    const session = await authService.requireAuth(extractToken(req.headers.authorization as string | undefined));
    await rbacService.requirePermission(session.userId, perm);
    next();
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthorizedError") return res.status(401).json({ error: err.message });
    if (err instanceof Error && err.name === "ForbiddenError") return res.status(403).json({ error: err.message });
    next(err);
  }
};

router.get("/", required("quotations.view"), async (req, res) => {
  const quotations = store.quotations();
  const status = req.query.status as string | undefined;
  let list = quotations;
  if (status) list = list.filter((q) => q.status === status);
  res.json(list);
});

router.post("/", required("quotations.create"), async (req, res) => {
  const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
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
    createdBy: session?.userId || store.users().find((u) => u.isAdmin === true)?.id || "",
  });
  try { store.persist(); await flush(); } catch (err: any) { return res.status(503).json({ error: "Database unavailable: " + (err?.message || "persist failed") }); }
  res.status(201).json(record);
});

router.get("/:id", required("quotations.view"), async (req, res) => {
  const quotation = store.quotations().find((q) => q.id === String(req.params.id));
  if (!quotation) throw new NotFoundError("Quotation not found");
  res.json(quotation);
});

router.patch("/:id", required("quotations.edit"), async (req, res) => {
  const id = String(req.params.id);
  const quotation = store.quotations().find((q) => q.id === id);
  if (!quotation) throw new NotFoundError("Quotation not found");
  const patch = req.body || {};
  const forbidden = ["id", "quotationNumber", "createdAt", "createdBy", "acceptedAt", "submittedAt"];
  for (const k of forbidden) if (k in patch) delete (patch as any)[k];
  const allowed = ["customerId", "salespersonId", "items", "notes", "validityExpiry", "status", "taxAmount", "total", "unitTotal"];
  const allowedPatch: any = {};
  for (const k of allowed) if (k in patch) allowedPatch[k] = (patch as any)[k];
  const updated = store.updateQuotation ? store.updateQuotation(id, allowedPatch) : { ...quotation, ...allowedPatch, updatedAt: new Date().toISOString() };
  if (!updated) throw new NotFoundError("Quotation not found");
  try { store.persist(); await flush(); } catch (err: any) { return res.status(503).json({ error: "Database unavailable: " + (err?.message || "persist failed") }); }
  res.json(updated);
});

router.post("/:id/send", required("quotations.accept"), async (req, res) => {
  const id = String(req.params.id);
  const quotation = store.quotations().find((q) => q.id === id);
  if (!quotation) throw new NotFoundError("Quotation not found");
  const updated = store.sendQuotation(id);
  if (!updated) throw new NotFoundError("Quotation not found");
  try { store.persist(); await flush(); } catch (err: any) { return res.status(503).json({ error: "Database unavailable: " + (err?.message || "persist failed") }); }
  res.json(updated);
});

router.post("/:id/accept", required("quotations.accept"), async (req, res) => {
  const id = String(req.params.id);
  const quotation = store.quotations().find((q) => q.id === id);
  if (!quotation) throw new NotFoundError("Quotation not found");
  const updated = store.acceptQuotation(id);
  if (!updated) throw new NotFoundError("Quotation not found");
  try { store.persist(); await flush(); } catch (err: any) { return res.status(503).json({ error: "Database unavailable: " + (err?.message || "persist failed") }); }
  res.json(updated);
});

export default router;
