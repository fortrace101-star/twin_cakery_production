import { Router, RequestHandler } from "express";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AuthService, extractToken } from "../services/auth.service.js";
import { rbacService } from "../services/rbac.service.js";
import { store } from "../database/store.js";

const router = Router();
const authService = new AuthService();

router.post("/login", (req, res) => {
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
      permissions: rbacService.getPermissionsForUser(session.userId),
    });
  } catch (err) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
});

router.post("/register", (req, res) => {
  const { username, displayName, email, phone, password, confirmPassword, role, isAdmin } = req.body || {};

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

  // Resolve bcryptjs from the frontend's node_modules (server lives outside
  // the frontend package; same pattern auth.service.ts uses).
  const requireFromFrontend = createRequire(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "erp-interface-design", "package.json"),
  );
  const bcryptModule = requireFromFrontend("bcryptjs") as typeof import("bcryptjs");

  const passwordHash = bcryptModule.hashSync(password, 10);
  store.createUser({
    username: String(username),
    displayName: String(displayName ?? username),
    email: String(email ?? ""),
    phone: String(phone ?? ""),
    role: String(role ?? "Staff"),
    isAdmin: Boolean(isAdmin),
    status: "Active",
    passwordHash,
  });

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
    permissions: rbacService.getPermissionsForUser(session.userId),
  });
});

router.post("/logout", (req, res) => {
  const token = extractToken(req.headers.authorization as string | undefined);
  if (token) authService.logout(token);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
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
    permissions: rbacService.getPermissionsForUser(session.userId),
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
