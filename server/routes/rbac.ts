import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError } from "../utils/errors.js";

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

router.get("/users", required("users.manage"), (req, res) => {
  const users = store.users();
  const role = req.query.role as string | undefined;
  let list = users;
  if (role) list = list.filter((u) => u.role === role);
  // Safe projection only — passwordHash / notify internals never leave the API.
  res.json(list.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isAdmin: u.isAdmin,
    status: u.status,
    createdAt: u.createdAt,
  })));
});

router.get("/roles", required("roles.manage"), (req, res) => {
  const roles = store.roles();
  const active = req.query.active;
  let list = roles;
  if (active !== undefined) list = list.filter((r) => r.active === (active !== "false"));
  res.json(list);
});

router.get("/permissions", required("roles.manage"), (req, res) => {
  res.json(store.permissions());
});

router.get("/:id/permissions", required("roles.manage"), async (req, res) => {
  const role = store.roles().find((r) => r.id === String(req.params.id));
  if (!role) throw new NotFoundError("Role not found");
  res.json({ role, permissions: await rbacService.getRolePermissions(role.id) });
});

router.post("/:id/permissions/:permissionId", required("roles.manage"), async (req, res) => {
  const id = String(req.params.id); const permissionId = String(req.params.permissionId);
  const role = store.roles().find((r) => r.id === id);
  if (!role) throw new NotFoundError("Role not found");
  const perm = store.permissions().find((p) => p.id === permissionId);
  if (!perm) throw new NotFoundError("Permission not found");
  await rbacService.assignPermissionToRole(role.id, perm.id);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  store.createAuditLog({
    actor: session?.userId ?? "", action: "role:permission_changed",
    entityType: "role", entityId: role.id,
    newStatus: "GRANTED", reason: `${role.name}: ${perm.key}`,
  });
  store.persist();
  res.json({ ok: true });
});

// Revoke — the roles editor needs the inverse of the grant above (E5).
router.delete("/:id/permissions/:permissionId", required("roles.manage"), async (req, res) => {
  const id = String(req.params.id); const permissionId = String(req.params.permissionId);
  const role = store.roles().find((r) => r.id === id);
  if (!role) throw new NotFoundError("Role not found");
  const perm = store.permissions().find((p) => p.id === permissionId);
  if (!perm) throw new NotFoundError("Permission not found");
  await rbacService.removePermissionFromRole(role.id, perm.id);
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  store.createAuditLog({
    actor: session?.userId ?? "", action: "role:permission_changed",
    entityType: "role", entityId: role.id,
    newStatus: "REVOKED", reason: `${role.name}: ${perm.key}`,
  });
  store.persist();
  res.json({ ok: true });
});

router.get("/audit", required("audit.view"), (req, res) => {
  const logs = store.auditLogs();
  const limit = parseInt(req.query.limit as string) || 100;
  const start = logs.length - Math.min(limit, logs.length);
  res.json(logs.slice(start));
});

export default router;
