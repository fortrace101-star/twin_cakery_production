import { Router, RequestHandler } from "express";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AuthService, extractToken } from "../services/auth.service.js";
import { rbacService } from "../services/rbac.service.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { store } from "../database/store.js";

const router = Router();
const authService = new AuthService();

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  try {
    const session = authService.login({ username, password });
    return res.json({
      token: session.token,
      user: {
        id: session.userId,
        username: session.username,
        displayName: session.displayName,
        role: session.role,
        isAdmin: session.isAdmin,
      },
      permissions: await rbacService.getPermissionsForUser(session.userId),
    });
  } catch (err) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
});

const claimRateLimit = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });

router.post("/claim-admin", claimRateLimit, async (req, res) => {
  const { code, username, displayName, email, phone, password, confirmPassword } = req.body || {};

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Admin code is required" });
  }
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "Username is required" });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Password and confirmation do not match" });
  }
  if (store.findUserByUsername(username)) {
    return res.status(409).json({ error: "Username is already taken" });
  }

  // Hash the code and look it up
  const crypto = await import("node:crypto");
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");

  const rows = await (async () => {
    const { pool } = await import("../database/db.js");
    const result = await pool.query(
      `SELECT id, used_at, expires_at FROM activation_codes WHERE code = $1 AND type = 'admin'`,
      [codeHash],
    );
    return result.rows as { id: string; used_at: string | null; expires_at: string }[];
  })();

  if (rows.length === 0) {
    return res.status(400).json({ error: "Invalid admin code" });
  }
  const record = rows[0];
  if (record.used_at) {
    return res.status(400).json({ error: "Admin code already used" });
  }
  if (new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ error: "Admin code expired" });
  }

  // Resolve bcryptjs
  const requireFromFrontend = createRequire(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "erp-interface-design", "package.json"),
  );
  const bcryptModule = requireFromFrontend("bcryptjs") as typeof import("bcryptjs");
  const passwordHash = bcryptModule.hashSync(password, 10);

  // Create user
  const user = store.createUser({
    username: String(username),
    displayName: String(displayName ?? username),
    email: String(email ?? ""),
    phone: String(phone ?? ""),
    role: "Admin / Proprietor",
    isAdmin: true,
    status: "Active",
    passwordHash,
  });

  // Assign role-admin (keep in-memory cache + DB in sync)
  const { flush: flushDb } = await import("../database/index.new.js");
  const now = new Date().toISOString();
  store.userRoles().push({ id: `ur-${user.id}`, userId: user.id, roleId: "role-admin", createdAt: now, updatedAt: now } as any);
  await flushDb();

  // Mark code as used
  const { pool } = await import("../database/db.js");
  await pool.query(
    `UPDATE activation_codes SET used_at = now(), used_by = $1 WHERE id = $2`,
    [user.id, record.id],
  );

  // Auto sign-in
  const session = authService.login({ username: String(username), password });
  res.status(201).json({
    token: session.token,
    user: {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      role: session.role,
      isAdmin: session.isAdmin,
    },
    permissions: await rbacService.getPermissionsForUser(session.userId),
  });
});


router.post("/register", async (req, res) => {
  const { username, displayName, email, phone, password, confirmPassword, role, isAdmin, registerCode } = req.body || {};

  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "Username is required" });
  }
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Password and confirmation do not match" });
  }
  if (store.findUserByUsername(username)) {
    return res.status(409).json({ error: "Username is already taken" });
  }
  if (!registerCode || typeof registerCode !== "string") {
    return res.status(400).json({ error: "Staff register code is required" });
  }

  // Validate staff register code
  const crypto = await import("node:crypto");
  const codeHash = crypto.createHash("sha256").update(registerCode).digest("hex");
  const { pool } = await import("../database/db.js");
  const codeResult = await pool.query(
    `SELECT id, used_at, expires_at FROM activation_codes WHERE code = $1 AND type = 'staff'`,
    [codeHash],
  );
  const codeRows = codeResult.rows as { id: string; used_at: string | null; expires_at: string }[];
  if (codeRows.length === 0) {
    return res.status(400).json({ error: "Invalid staff register code" });
  }
  const codeRecord = codeRows[0];
  if (codeRecord.used_at) {
    return res.status(400).json({ error: "Staff register code already used" });
  }
  if (new Date(codeRecord.expires_at) < new Date()) {
    return res.status(400).json({ error: "Staff register code expired" });
  }

  // Resolve bcryptjs
  const requireFromFrontend = createRequire(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "erp-interface-design", "package.json"),
  );
  const bcryptModule = requireFromFrontend("bcryptjs") as typeof import("bcryptjs");

  const passwordHash = bcryptModule.hashSync(password, 10);
  const user = store.createUser({
    username: String(username),
    displayName: String(displayName ?? username),
    email: String(email ?? ""),
    phone: String(phone ?? ""),
    role: String(role ?? "Staff"),
    isAdmin: Boolean(isAdmin),
    status: "Active",
    passwordHash,
  });

  // Staff signups must land on a seeded RBAC role: without a user_roles row
  // getPermissionsForUser() resolves to [] — an empty sidebar (E5 visibleModules)
  // and a 403 on every required() route check. The submitted label maps onto a
  // seeded role; unknown labels fall back to the least-privileged one
  // (role-csr). Admin stays unreachable here: admin bootstrap only goes through
  // /claim-admin with an admin code.
  const roleIdByLabel: Record<string, string> = {
    "sales manager": "role-sales",
    "production manager": "role-production",
    "customer service representative": "role-csr",
  };
  const roleId = roleIdByLabel[String(role ?? "").trim().toLowerCase()] ?? "role-csr";
  const { flush: flushDb } = await import("../database/index.new.js");
  const assignedAt = new Date().toISOString();
  store.userRoles().push({ id: `ur-${user.id}`, userId: user.id, roleId, createdAt: assignedAt, updatedAt: assignedAt });
  await flushDb();

  // Mark code used
  await pool.query(
    `UPDATE activation_codes SET used_at = now(), used_by = $1 WHERE id = $2`,
    [user.id, codeRecord.id],
  );

  const session = authService.login({ username: String(username), password });
  res.status(201).json({
    token: session.token,
    user: {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      role: session.role,
      isAdmin: session.isAdmin,
    },
    permissions: await rbacService.getPermissionsForUser(session.userId),
  });
});

router.post("/reset-credentials", async (req, res) => {
  const session = authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  try { await rbacService.requirePermission(session.userId, "users.manage"); } catch { return res.status(403).json({ error: "Forbidden" }); }

  const { userId } = req.body || {};
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId is required" });
  }
  const user = store.findUser(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
  const requireFromFrontend = createRequire(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "erp-interface-design", "package.json"),
  );
  const bcryptModule = requireFromFrontend("bcryptjs") as typeof import("bcryptjs");
  const hash = bcryptModule.hashSync(tempPassword, 10);
  store.updateUser(user.id, { passwordHash: hash });

  res.json({ userId: user.id, username: user.username, tempPassword });
});
router.post("/logout", (req, res) => {
  const token = extractToken(req.headers.authorization as string | undefined);
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  const token = extractToken(req.headers.authorization as string | undefined);
  const session = authService.getCurrentSession(token);
  if (!session) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({
    user: {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      role: session.role,
      isAdmin: session.isAdmin,
    },
    permissions: await rbacService.getPermissionsForUser(session.userId),
  });
});

router.get("/user-count", (req, res) => {
  // "History" = whether the workspace already has active staff accounts.
  // Used by the guest landing to route first-time visitors to /signup
  // (no accounts yet) or /login (accounts exist).
  const hasHistory = store.users().some((u) => u.status === "Active");
  res.json({ hasHistory });
});

export default router;
