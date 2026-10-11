import { Router } from "express";
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

export default router;
