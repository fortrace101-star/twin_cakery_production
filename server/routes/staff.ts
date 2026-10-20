import { Router, Request, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { paginate } from "../utils/paginate.js";

// ---------------------------------------------------------------------------
// E7 — Staff profiles + attendance (governing spec §§18.1–18.2).
//
// Salary FIGURES never appear here: the salary profile endpoints sit behind
// remuneration.* permissions, and staff rows carry identity only (staff.view
// may see scheduling data, never pay).
// Base path: /api/v1/staff.
// ---------------------------------------------------------------------------

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

/** Authenticated staff id (userId) for auditing recordedBy / createdBy. */
function actor(req: Request): string {
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  return session?.userId ?? "";
}

const EMPLOYMENT_STATUSES = ["ACTIVE", "PROBATION", "ON_LEAVE", "INACTIVE", "TERMINATED"];
const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "SICK", "LATE"];

/** GET /staff — directory, staff.view sees identity only (no salary). */
router.get("/", required("staff.view"), (req, res) => {
  const status = req.query.status as string | undefined;
  const q = String(req.query.q ?? "").trim().toLowerCase();
  let list = store.staffList();
  if (status) list = list.filter((s) => s.employmentStatus === status);
  if (q) list = list.filter((s) => `${s.name} ${s.staffNumber} ${s.jobTitle}`.toLowerCase().includes(q));
  // §33 — opt-in pagination envelope (plain array without ?page=).
  res.json(paginate(list, req.query, {
    sortable: ["staffNumber", "name", "startDate", "employmentStatus"],
    dateField: "createdAt",
    searchFields: ["staffNumber", "name", "jobTitle", "email"],
  }));
});

/** GET /staff/attendance — BEFORE /:id, or "attendance" matches as an id. */
router.get("/attendance", required("staff.view"), (req, res) => {
  const rows = store.attendance(
    (req.query.staffId as string | undefined) || undefined,
    (req.query.from as string | undefined) || undefined,
    (req.query.to as string | undefined) || undefined,
  );
  const staffById = new Map(store.staffList().map((s) => [s.id, s.name] as const));
  res.json(rows.map((r) => ({ ...r, staffName: staffById.get(r.staffId) ?? "" })));
});

/** POST /staff/attendance — record one day for one person (upsert). */
router.post("/attendance", required("staff.attendance"), (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const staffId = String(body.staffId ?? "");
  if (!store.findStaff(staffId)) throw new ValidationError("Unknown staffId");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? ""))) throw new ValidationError("date must be YYYY-MM-DD");
  if (body.status && !ATTENDANCE_STATUSES.includes(String(body.status))) {
    throw new ValidationError(`status must be one of ${ATTENDANCE_STATUSES.join(", ")}`);
  }
  res.status(201).json(store.recordAttendance({ ...body, recordedBy: body.recordedBy ?? actor(req) }));
});

router.get("/:id", required("staff.view"), (req, res) => {
  const staff = store.findStaff(String(req.params.id));
  if (!staff) throw new NotFoundError("Staff member not found");
  res.json(staff);
});

/** POST /staff — new team member (identity only; salary goes in a profile). */
router.post("/", required("staff.manage"), (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  if (!String(body.name ?? "").trim()) throw new ValidationError("Staff name is required");
  if (body.employmentStatus && !EMPLOYMENT_STATUSES.includes(String(body.employmentStatus))) {
    throw new ValidationError(`employmentStatus must be one of ${EMPLOYMENT_STATUSES.join(", ")}`);
  }
  const created = store.createStaff({ ...body });
  store.createAuditLog({
    actor: actor(req), action: "staff:created", entityType: "staff", entityId: created.id,
    newStatus: created.employmentStatus, reason: `${created.name} (${created.staffNumber})`,
  });
  res.status(201).json(created);
});

/** PATCH /staff/:id — identity/schedule/status edits (never salary). */
router.patch("/:id", required("staff.manage"), (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  if (body.employmentStatus && !EMPLOYMENT_STATUSES.includes(String(body.employmentStatus))) {
    throw new ValidationError(`employmentStatus must be one of ${EMPLOYMENT_STATUSES.join(", ")}`);
  }
  if (body.basicSalary !== undefined || body.allowanceAmount !== undefined || body.deductionAmount !== undefined) {
    throw new ValidationError("Salary figures belong in the salary profile (PUT /staff/:id/profile)");
  }
  const before = store.findStaff(String(req.params.id));
  const updated = store.updateStaff(String(req.params.id), { ...body });
  if (!updated) throw new NotFoundError("Staff member not found");
  if (before) {
    store.createAuditLog({
      actor: actor(req), action: "staff:updated", entityType: "staff", entityId: updated.id,
      previousStatus: before.employmentStatus, newStatus: updated.employmentStatus, reason: updated.name,
    });
  }
  res.json(updated);
});

/** POST /staff/:id/archive — end employment; history stays intact (§18.7). */
router.post("/:id/archive", required("staff.manage"), (req, res) => {
  const before = store.findStaff(String(req.params.id));
  const archived = store.archiveStaff(String(req.params.id));
  if (!archived) throw new NotFoundError("Staff member not found");
  store.createAuditLog({
    actor: actor(req), action: "staff:archived", entityType: "staff", entityId: archived.id,
    previousStatus: before?.employmentStatus ?? "", newStatus: archived.employmentStatus,
    reason: archived.name,
  });
  res.json(archived);
});

export default router;
