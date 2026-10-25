import { Router, Request, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError, ValidationError, ConflictError } from "../utils/errors.js";

// ---------------------------------------------------------------------------
// E7 — Salary & remuneration workflow (governing spec §§18.2–18.8).
//
// CREATE PERIOD (OPEN) → SELECT + CALCULATE (PROCESSING) → REVIEW/ADJUST →
// APPROVE (APPROVED) → RECORD PAYMENT → MARK PAID (PARTIALLY_PAID / PAID) →
// CLOSE (CLOSED). CLOSED is terminal: store mutators throw, this router maps
// that to 409 — corrections become NEW records, never rewrites (§18.7).
// Every route here needs a remuneration.* or payslip.print permission
// (Admin-only by default, §18.2). Base path: /api/v1/remuneration.
// ---------------------------------------------------------------------------

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

/** Authenticated staff id (userId) for auditing createdBy / recordedBy. */
function actor(req: Request): string {
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  return session?.userId ?? "";
}

/** Store business-rule errors → 409 for sequencing guards, 422 otherwise. */
function workflowError(err: unknown): never {
  const message = err instanceof Error ? err.message : "Operation failed";
  if (/CLOSED|frozen|already approved/i.test(message)) throw new ConflictError(message);
  throw new ValidationError(message);
}

const PERIOD_TYPES = ["weekly", "biweekly", "monthly", "quarterly", "custom"];
const PERIOD_STATUSES = ["OPEN", "PROCESSING", "APPROVED", "PARTIALLY_PAID", "PAID", "CLOSED"];

function withStaffName<T extends { staffId: string }>(item: T) {
  const staff = store.findStaff(item.staffId);
  return { ...item, staffName: staff?.name ?? "", staffNumber: staff?.staffNumber ?? "" };
}

// ---------------------------------------------------------------------------
// Salary profiles — confidential baselines (§18.2). Reads AND writes need
// remuneration permissions; staff.view is deliberately NOT enough.
// ---------------------------------------------------------------------------

/** PUT /remuneration/profiles/:staffId — create-or-update salary baseline. */
router.put("/profiles/:staffId", required("remuneration.edit"), (req, res) => {
  const staff = store.findStaff(String(req.params.staffId));
  if (!staff) throw new NotFoundError("Staff member not found");
  const body = (req.body || {}) as Record<string, unknown>;
  if (body.paymentFrequency && !PERIOD_TYPES.includes(String(body.paymentFrequency))) {
    throw new ValidationError(`paymentFrequency must be one of ${PERIOD_TYPES.join(", ")}`);
  }
  for (const field of ["basicSalary", "allowanceAmount", "deductionAmount"] as const) {
    if (body[field] !== undefined && body[field] !== null && Number.isNaN(Number(body[field]))) {
      throw new ValidationError(`${field} must be a number`);
    }
  }
  const saved = store.upsertSalaryProfile(staff.id, { ...body });
  // §34 — the profile change is auditable, but the salary FIGURES never go
  // into the audit reason (audit rows feed the activity feed; keep pay private).
  store.createAuditLog({
    actor: actor(req), action: "remuneration:profile_updated",
    entityType: "salary_profile", entityId: saved?.id ?? staff.id,
    reason: `Salary profile · ${staff.name}`,
  });
  res.json(saved);
});

// ---------------------------------------------------------------------------
// Payment periods (§18.3): admin-defined ranges that own the §18.4 workflow.
// ---------------------------------------------------------------------------

/** GET /remuneration/periods — newest first, optional ?status= filter. */
router.get("/periods", required("remuneration.view"), (req, res) => {
  const status = req.query.status as string | undefined;
  if (status && !PERIOD_STATUSES.includes(status)) {
    throw new ValidationError(`status must be one of ${PERIOD_STATUSES.join(", ")}`);
  }
  const list = store.remunerationPeriods();
  res.json(status ? list.filter((p) => p.status === status) : list);
});

/** POST /remuneration/periods — create an OPEN period (§18.3). */
router.post("/periods", required("remuneration.create"), (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  if (body.periodType && !PERIOD_TYPES.includes(String(body.periodType))) {
    throw new ValidationError(`periodType must be one of ${PERIOD_TYPES.join(", ")}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.startDate ?? ""))) throw new ValidationError("startDate must be YYYY-MM-DD");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.endDate ?? ""))) throw new ValidationError("endDate must be YYYY-MM-DD");
  if (String(body.endDate) < String(body.startDate)) throw new ValidationError("endDate must not precede startDate");
  const created = store.createPeriod({ ...body, createdBy: body.createdBy ?? actor(req) });
  store.createAuditLog({
    actor: actor(req), action: "remuneration:period_created",
    entityType: "remuneration_period", entityId: created.id,
    newStatus: created.status, reason: created.label || `${created.startDate} → ${created.endDate}`,
  });
  res.status(201).json(created);
});

/** GET /remuneration/periods/:id — period + items + payments (§18.5 drill). */
router.get("/periods/:id", required("remuneration.view"), (req, res) => {
  const period = store.findPeriod(String(req.params.id));
  if (!period) throw new NotFoundError("Remuneration period not found");
  res.json({
    ...period,
    items: store.periodItems(period.id).map(withStaffName),
    payments: store.periodPayments(period.id).map(withStaffName),
  });
});

/**
 * POST /remuneration/periods/:id/calculate — SELECT STAFF + CALCULATE.
 * Body { staffIds?: string[] }; empty/missing = all ACTIVE+PROBATION staff.
 * Re-runnable while OPEN/PROCESSING; approved lines are never regenerated.
 */
router.post("/periods/:id/calculate", required("remuneration.process"), (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const staffIds = Array.isArray(body.staffIds) ? (body.staffIds as unknown[]).map(String) : [];
  try {
    const items = store.calculatePeriod(String(req.params.id), staffIds, actor(req));
    store.createAuditLog({
      actor: actor(req), action: "remuneration:calculated",
      entityType: "remuneration_period", entityId: String(req.params.id),
      reason: `${items.length} salary line(s) calculated`,
    });
    res.status(201).json(items.map(withStaffName));
  } catch (err) {
    workflowError(err);
  }
});

/**
 * PATCH /remuneration/items/:id — REVIEW/ADJUST a line before approval,
 * or a still-PENDING line after (recompute net server-side).
 */
router.patch("/items/:id", required("remuneration.edit"), (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  for (const field of ["basicSalary", "allowances", "bonuses", "deductions", "advanceAmount", "otherPayments"] as const) {
    if (body[field] !== undefined && body[field] !== null && Number.isNaN(Number(body[field]))) {
      throw new ValidationError(`${field} must be a number`);
    }
  }
  try {
    const updated = store.updatePeriodItem(String(req.params.id), { ...body });
    if (!updated) throw new NotFoundError("Remuneration item not found");
    res.json(withStaffName(updated));
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    workflowError(err);
  }
});

/**
 * POST /remuneration/periods/:id/adjustments — additive correction line for
 * APPROVED (or CLOSED) periods: the sanctioned path once lines are frozen
 * (§18.7 — originals stay reconstructable; CLOSED still accepts new lines).
 */
router.post("/periods/:id/adjustments", required("remuneration.edit"), (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  if (!store.findStaff(String(body.staffId ?? ""))) throw new ValidationError("Unknown staffId");
  try {
    const item = store.addAdjustmentItem(String(req.params.id), { ...body });
    store.createAuditLog({
      actor: actor(req), action: "remuneration:adjustment_added",
      entityType: "remuneration_period", entityId: String(req.params.id),
      reason: `Adjustment line for ${withStaffName(item).staffName || item.staffId}${body.notes ? ` · ${String(body.notes)}` : ""}`,
    });
    res.status(201).json(withStaffName(item));
  } catch (err) {
    workflowError(err);
  }
});

/** POST /remuneration/periods/:id/approve — REVIEW/ADJUST → APPROVE. */
router.post("/periods/:id/approve", required("remuneration.approve"), (req, res) => {
  try {
    const before = store.findPeriod(String(req.params.id));
    const period = store.approvePeriod(String(req.params.id), actor(req));
    if (!period) throw new NotFoundError("Remuneration period not found");
    store.createAuditLog({
      actor: actor(req), action: "remuneration:approved",
      entityType: "remuneration_period", entityId: period.id,
      previousStatus: before?.status ?? "", newStatus: period.status, reason: period.label,
    });
    res.json(period);
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    workflowError(err);
  }
});

/** POST /remuneration/periods/:id/close — terminal (§18.7 frozen history). */
router.post("/periods/:id/close", required("remuneration.close_period"), (req, res) => {
  try {
    const before = store.findPeriod(String(req.params.id));
    const period = store.closePeriod(String(req.params.id), actor(req));
    if (!period) throw new NotFoundError("Remuneration period not found");
    store.createAuditLog({
      actor: actor(req), action: "remuneration:closed",
      entityType: "remuneration_period", entityId: period.id,
      previousStatus: before?.status ?? "", newStatus: period.status, reason: period.label,
    });
    res.json(period);
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    workflowError(err);
  }
});



/** GET /remuneration/profiles/:staffId — one staff member's salary baseline. */
router.get("/profiles/:staffId", required("remuneration.view"), (req, res) => {
  const staff = store.findStaff(String(req.params.staffId));
  if (!staff) throw new NotFoundError("Staff member not found");
  res.json(store.salaryProfileFor(staff.id) ?? null);
});

/** GET /remuneration/periods/:id/payments — money recorded for this period. */
router.get("/periods/:id/payments", required("remuneration.view"), (req, res) => {
  const period = store.findPeriod(String(req.params.id));
  if (!period) throw new NotFoundError("Remuneration period not found");
  res.json(store.periodPayments(period.id).map(withStaffName));
});

/**
 * POST /remuneration/periods/:id/payments — RECORD PAYMENT (RECORDED row).
 * Period must be approved and open; net/paid rollups follow on MARK PAID.
 */
router.post("/periods/:id/payments", required("remuneration.record_payment"), (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  if (!store.findStaff(String(body.staffId ?? ""))) throw new ValidationError("Unknown staffId");
  if (Number.isNaN(Number(body.amount)) || Number(body.amount) <= 0) throw new ValidationError("amount must be a positive number");
  try {
    const payment = store.recordPayment({
      ...body,
      periodId: String(req.params.id),
      recordedBy: body.recordedBy ?? actor(req),
    });
    store.createAuditLog({
      actor: actor(req), action: "remuneration:payment_recorded",
      entityType: "remuneration_payment", entityId: payment.id,
      newStatus: payment.paymentStatus, reason: `Period payment · ${String(req.params.id)}`,
    });
    res.status(201).json(withStaffName(payment));
  } catch (err) {
    workflowError(err);
  }
});

/** POST /remuneration/payments/:id/mark-paid — MARK PAID + rollups forward. */
router.post("/payments/:id/mark-paid", required("remuneration.record_payment"), (req, res) => {
  try {
    const payment = store.markPaymentPaid(String(req.params.id), actor(req));
    if (!payment) throw new NotFoundError("Payment not found");
    store.createAuditLog({
      actor: actor(req), action: "remuneration:payment_paid",
      entityType: "remuneration_payment", entityId: payment.id,
      newStatus: payment.paymentStatus, reason: `Marked paid · ${payment.periodId}`,
    });
    res.json(withStaffName(payment));
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    workflowError(err);
  }
});

// ---------------------------------------------------------------------------
// Advances (§18.6): original amounts immutable; recoveries append. The
// outstanding balance lives on the wire for every row so the UI never has
// to keep it in sync.
// ---------------------------------------------------------------------------

function withOutstanding<T extends { amount: number; repaidAmount: number }>(a: T) {
  return { ...a, outstanding: Math.round((a.amount - a.repaidAmount) * 100) / 100 };
}

/** GET /remuneration/advances — optional ?staffId=, outstanding on the wire. */
router.get("/advances", required("remuneration.view"), (req, res) => {
  const staffId = (req.query.staffId as string | undefined) || undefined;
  const staffById = new Map(store.staffList().map((s) => [s.id, s.name] as const));
  res.json(
    store.staffAdvances(staffId).map((a) => ({ ...withOutstanding(a), staffName: staffById.get(a.staffId) ?? "" })),
  );
});

/** POST /remuneration/advances — record a new advance (OUTSTANDING). */
router.post("/advances", required("remuneration.create"), (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  if (!store.findStaff(String(body.staffId ?? ""))) throw new ValidationError("Unknown staffId");
  if (Number.isNaN(Number(body.amount)) || Number(body.amount) <= 0) throw new ValidationError("amount must be a positive number");
  if (body.advanceDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.advanceDate))) {
    throw new ValidationError("advanceDate must be YYYY-MM-DD");
  }
  const advance = store.createAdvance({ ...body, recordedBy: body.recordedBy ?? actor(req) });
  store.createAuditLog({
    actor: actor(req), action: "remuneration:advance_created",
    entityType: "staff_advance", entityId: advance.id,
    reason: `${advance.reason} · staff ${advance.staffId}`,
  });
  res.status(201).json(withOutstanding(advance));
});

/**
 * POST /remuneration/advances/:id/repayments — append a recovery. Rejects
 * overpayment; SETTLED flips automatically at zero outstanding.
 */
router.post("/advances/:id/repayments", required("remuneration.record_payment"), (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  try {
    const advance = store.recordAdvanceRepayment(String(req.params.id), {
      ...body,
      recordedBy: body.recordedBy ?? actor(req),
    });
    if (!advance) throw new NotFoundError("Advance not found");
    const withOut = withOutstanding(advance);
    store.createAuditLog({
      actor: actor(req), action: "remuneration:advance_repaid",
      entityType: "staff_advance", entityId: advance.id,
      newStatus: advance.status, reason: `Repayment · outstanding ${withOut.outstanding}`,
    });
    res.status(201).json(withOut);
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    workflowError(err);
  }
});

/**
 * POST /remuneration/periods/:id/payslips — generate printable snapshots for
 * every line (§18.8). Idempotent: existing snapshots are returned, not cloned.
 */
router.post("/periods/:id/payslips", required("remuneration.process"), (req, res) => {
  try {
    const issued = store.issuePayslips(String(req.params.id), actor(req));
    store.createAuditLog({
      actor: actor(req), action: "remuneration:payslips_issued",
      entityType: "remuneration_period", entityId: String(req.params.id),
      reason: `${issued.length} payslip(s) issued`,
    });
    res.status(201).json(issued);
  } catch (err) {
    workflowError(err);
  }
});

/** GET /remuneration/payslips — optional ?periodId= / ?staffId=. */
router.get("/payslips", required("remuneration.view"), (req, res) => {
  res.json(
    store.payslips(
      (req.query.periodId as string | undefined) || undefined,
      (req.query.staffId as string | undefined) || undefined,
    ),
  );
});

/**
 * GET /remuneration/payslips/:id — a single printable document. The only
 * endpoint gated by payslip.print (the print/download affordance), so the
 * permission can be delegated without exposing the whole salary module.
 */
router.get("/payslips/:id", required("payslip.print"), (req, res) => {
  const slip = store.payslips().find((p) => p.id === String(req.params.id));
  if (!slip) throw new NotFoundError("Payslip not found");
  res.json(slip);
});

/**
 * GET /remuneration/dashboard — §18.5 admin interface: totals due/paid/
 * pending, allowances, deductions, outstanding advances, period status,
 * upcoming payment dates, with drill-down ids. Optional ?periodId=.
 */
router.get("/dashboard", required("remuneration.view"), (req, res) => {
  res.json(store.remunerationDashboard((req.query.periodId as string | undefined) || undefined));
});

/**
 * GET /remuneration/reports — printable Admin-only rollups (§18.8 + plan §6.1):
 * `?type=period&periodId=` period salary summary · `?type=advances` advance
 * report (originals + recoveries + outstanding) · `?type=outstanding`
 * staff remuneration still due. Fronted by view_reports.
 */
router.get("/reports", required("remuneration.view_reports"), (req, res) => {
  const type = String(req.query.type ?? "period");
  const periodId = (req.query.periodId as string | undefined) || undefined;
  const staffById = new Map(store.staffList().map((s) => [s.id, s] as const));
  if (type === "advances") {
    return res.json(
      store.staffAdvances().map((a) => ({
        ...a,
        outstanding: Math.round((a.amount - a.repaidAmount) * 100) / 100,
        staffName: staffById.get(a.staffId)?.name ?? "",
      })),
    );
  }
  if (type === "outstanding") {
    const periods = periodId ? [store.findPeriod(periodId)].filter((p): p is NonNullable<typeof p> => Boolean(p)) : store.remunerationPeriods().filter((p) => p.status !== "CLOSED");
    const rows = periods.flatMap((p) =>
      store.periodItems(p.id).map((i) => ({
        periodId: p.id,
        periodLabel: p.label || `${p.startDate} → ${p.endDate}`,
        periodStatus: p.status,
        staffId: i.staffId,
        staffName: staffById.get(i.staffId)?.name ?? "",
        net: i.netAmount,
        paid: i.paidAmount,
        outstanding: Math.round((i.netAmount - i.paidAmount) * 100) / 100,
      })),
    );
    return res.json(rows.filter((r) => r.outstanding > 0));
  }
  // Default: period salary summary.
  const rawPeriod = periodId ? store.findPeriod(periodId) : store.remunerationDashboard().period;
  if (!rawPeriod || typeof rawPeriod !== "object" || !("id" in rawPeriod)) {
    throw new NotFoundError("Remuneration period not found");
  }
  const period = rawPeriod as import("../database/types.js").RemunerationPeriod;
  const items = store.periodItems(period.id).map((i) => ({
    ...i,
    staffName: staffById.get(i.staffId)?.name ?? "",
  }));
  const sum = (pick: (i: { netAmount: number; allowances: number; deductions: number }) => number) =>
    Math.round(items.reduce((n, i) => n + pick(i), 0) * 100) / 100;
  return res.json({
    period,
    items,
    totals: {
      net: period.totalAmount,
      paid: period.paidAmount,
      pending: Math.round((period.totalAmount - period.paidAmount) * 100) / 100,
      allowances: sum((i) => i.allowances),
      deductions: sum((i) => i.deductions),
      lines: items.length,
    },
  });
});


export default router;
