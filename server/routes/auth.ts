import { Router, RequestHandler } from "express";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AuthService, extractToken } from "../services/auth.service.js";
import { RbacService } from "../services/rbac.service.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { store } from "../database/store.js";

const router = Router();
const rbacService = new RbacService()
const authService = new AuthService();

const claimRateLimit = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });
const authRateLimit = rateLimit({ max: 10, windowMs: 15 * 60 * 1000 });
const loginRateLimit = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });
const registerRateLimit = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });

router.post("/login", loginRateLimit, async (req, res) => {
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

  // SEC-08: claim-admin is rate limited (claimRateLimit).

  // Hash the code and look it up
  const crypto = await import("node:crypto");
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");

  const { pool } = await import("../database/db.js");
  let bootstrapNoUsers = false;
  try {
    const u = await pool.query(`SELECT count(*)::int AS c FROM users`);
    bootstrapNoUsers = Number(u.rows?.[0]?.c ?? 0) === 0;
  } catch {
    bootstrapNoUsers = false;
  }

  // Postgres is mandatory: enforce conflicts against DB (source of truth).
  // In empty-DB bootstrap, stale file-store rows are ignored.
  if (!bootstrapNoUsers) {
    const conflict = await pool.query(
      `SELECT 1 FROM users WHERE lower(username)=lower($1) OR ($2 <> '' AND lower(email)=lower($2)) LIMIT 1`,
      [String(username), String(email ?? "")],
    );
    if (conflict.rows.length > 0) {
      return res.status(409).json({ error: "Username or email is already taken" });
    }
  }

  const rows = await (async () => {
    const result = await pool.query(
      `SELECT id, used_at, expires_at FROM activation_codes WHERE code = $1 AND type = 'admin'`,
      [codeHash],
    );
    return result.rows as { id: string; used_at: string | null; expires_at: string }[];
  })();

  const validRecord = rows.find((r) => !r.used_at && new Date(r.expires_at) >= new Date());
  if (!validRecord) {
    // Post-wipe/bootstrap recovery: if the DB has no users, allow first-admin
    // claim without a pre-minted activation code (the wipe may not have minted
    // one). This is safe only in the empty-users state.
    if (!bootstrapNoUsers) {
      if (rows.length === 0) return res.status(400).json({ error: "Invalid admin code" });
      const record = rows[0];
      if (record.used_at) return res.status(400).json({ error: "Admin code already used" });
      return res.status(400).json({ error: "Admin code expired" });
    }
  }
  const record = validRecord ?? { id: null as string | null, used_at: null, expires_at: new Date().toISOString() };

  // Resolve bcryptjs
  const requireFromFrontend = createRequire(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "erp-interface-design", "package.json"),
  );
  const bcryptModule = requireFromFrontend("bcryptjs") as typeof import("bcryptjs");
  const passwordHash = bcryptModule.hashSync(password, 10);

  // Create user: persist to Postgres (mandatory), keep store cache in sync.
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

  const now = new Date().toISOString();
  try {
    await pool.query(
      `INSERT INTO users (id, username, display_name, email, phone, role, is_admin, status, password_hash, notify, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         username=EXCLUDED.username, display_name=EXCLUDED.display_name, email=EXCLUDED.email, phone=EXCLUDED.phone,
         role=EXCLUDED.role, is_admin=EXCLUDED.is_admin, status=EXCLUDED.status, password_hash=EXCLUDED.password_hash,
         updated_at=EXCLUDED.updated_at`,
      [
        user.id,
        user.username,
        user.displayName,
        (user as any).email || null,
        (user as any).phone || null,
        user.role,
        !!(user as any).isAdmin,
        (user as any).status || "Active",
        (user as any).passwordHash || null,
        JSON.stringify((user as any).notify ?? null),
        (user as any).createdAt || now,
        (user as any).updatedAt || now,
      ],
    );
    await pool.query(
      `INSERT INTO user_roles (id, user_id, role_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING`,
      [`ur-${user.id}`, user.id, "role-admin", now, now],
    );
    store.userRoles().push({ id: `ur-${user.id}`, userId: user.id, roleId: "role-admin", createdAt: now, updatedAt: now } as any);
  } catch (err) {
    console.error("CLAIM-ADMIN DB PERSIST ERROR:", err);
    return res.status(503).json({ error: "Failed to persist admin account to database" });
  }

  // Mark code as used (skip when bootstrap had no activation code record)
  if (record.id) {
    try {
      await pool.query(
        `UPDATE activation_codes SET used_at = now(), used_by = $1 WHERE id = $2`,
        [user.id, record.id],
      );
    } catch {
      /* non-fatal: user/admin was created */
    }
  }

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


router.post("/register", registerRateLimit, async (req, res) => {
  const { username, displayName, email, phone, password, confirmPassword, registerCode } = req.body || {};

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

  // SEC-07: validate staff register code then resolve role from the code, not from the body.
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
    role: "Staff",
    isAdmin: false,
    status: "Active",
    passwordHash,
  });

  // SEC-07: staff signups always land on the least-privileged role from the validated code.
  const roleId = "role-csr";
  const { flush: flushDb } = await import("../database/index.new.js");
  const assignedAt = new Date().toISOString();
  store.userRoles().push({ id: `ur-${user.id}`, userId: user.id, roleId, createdAt: assignedAt, updatedAt: assignedAt });
  await flushDb();

  // Mark code used

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

router.post("/reset-credentials", authRateLimit, async (req, res) => {
  const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
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
  const session = await authService.getCurrentSession(token);
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

router.get("/user-count", async (_req, res) => {
  // Postgres is mandatory. "History" = whether the workspace has accounts.
  try {
    const { pool } = await import("../database/db.js");
    const r = await pool.query(`SELECT count(*)::int AS c FROM users`);
    const pgUsers = Number(r.rows?.[0]?.c ?? 0);
    return res.json({ hasHistory: pgUsers > 0 });
  } catch (err: any) {
    return res.status(503).json({ error: "Database unavailable", detail: err?.message });
  }
});

const requireAuthPerm = (perm: string): RequestHandler => async (req, res, next) => {
  const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  try { await rbacService.requirePermission(session.userId, perm); } catch { return res.status(403).json({ error: "Forbidden" }); }
  (req as any).session = session;
  next();
};

router.get("/users", requireAuthPerm("users.manage"), async (_req, res) => {
  try {
    const users = store.users().map((u: any) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      isAdmin: u.isAdmin,
      status: u.status,
      email: u.email,
      createdAt: u.createdAt,
    }));
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sessions", requireAuthPerm("users.manage"), async (_req, res) => {
  res.json([]);
});

router.post("/sessions/revoke", requireAuthPerm("users.manage"), async (_req, res) => {
  res.json({ ok: true });
});

export default router;

