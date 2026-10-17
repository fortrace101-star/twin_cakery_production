import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
import { store } from "../database/store.js";
import type { User, NotificationChannel, NotificationPriority } from "../database/types.js";

// server/ lives outside the frontend package, so resolve bcryptjs
// from the frontend's node_modules explicitly (same pattern as db.ts).
const requireFromFrontend = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "erp-interface-design", "package.json"),
);
const bcryptModule = requireFromFrontend("bcryptjs") as typeof import("bcryptjs");

export interface AuthSession {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  isAdmin: boolean;
  token: string;
  createdAt: number;
}

const SESSIONS = new Map<string, AuthSession>();
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

let tokenSeq = 0;

function generateToken(): string {
  tokenSeq += 1;
  return `tc_${Date.now().toString(36)}_${tokenSeq}_${Math.random().toString(36).slice(2, 8)}`;
}

function isSessionValid(session: AuthSession): boolean {
  const now = Date.now();
  if (now - session.createdAt > SESSION_TTL) return false;
  return true;
}

export class AuthService {
  login(credentials: { username: string; password: string }): AuthSession {
    const user = store.findUserByUsername(credentials.username);
    if (!user || user.status !== "Active") {
      throw new UnauthorizedError("Invalid credentials");
    }
    const hash = user.passwordHash || "";
    let ok = false;
    try {
      ok = hash.startsWith("$2") && bcryptModule.compareSync(credentials.password, hash);
    } catch {
      ok = false;
    }
    // Dev fallback: legacy/placeholder hashes that were never bcrypt-hashed.
    if (!ok && (hash === "" || hash === "$2b$10$placeholder")) {
      ok = credentials.password === "placeholder" || credentials.password === "TwinCakery123!";
    }
    if (!ok) {
      throw new UnauthorizedError("Invalid credentials");
    }
    const session: AuthSession = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      isAdmin: user.isAdmin,
      token: generateToken(),
      createdAt: Date.now(),
    };
    SESSIONS.set(session.token, session);
    return session;
  }

  logout(token: string | null): void {
    if (token) SESSIONS.delete(token);
  }

  getCurrentSession(token: string | null): AuthSession | null {
    if (!token) return null;
    const session = SESSIONS.get(token);
    if (!session || !isSessionValid(session)) return null;
    return session;
  }

  requireAuth(token: string | null): AuthSession {
    const session = this.getCurrentSession(token);
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }
    return session;
  }

  requireRole(token: string | null, allowedRoles: string[]): AuthSession {
    const session = this.requireAuth(token);
    if (!allowedRoles.includes(session.role)) {
      throw new ForbiddenError("Insufficient permissions for this action");
    }
    return session;
  }

  hasPermission(token: string | null, permission: string): boolean {
    const session = this.getCurrentSession(token);
    if (!session) return false;
    const rolePermissions = store.rolePermissionsForRole(session.role);
    const permissionIds = rolePermissions.map((rp) => rp.permissionId);
    const permissionRecord = store.permissions().find((p) => permissionIds.includes(p.id));
    return Boolean(permissionRecord);
  }

  static getSession(token: string | null): AuthSession | null {
    return new AuthService().getCurrentSession(token);
  }

  static requireAuth(token: string | null): AuthSession {
    return new AuthService().requireAuth(token);
  }

  static requireRole(token: string | null, allowedRoles: string[]): AuthSession {
    return new AuthService().requireRole(token, allowedRoles);
  }
}

// Attach a helper to read token from Authorization header
export function extractToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  if (authorization.startsWith("Bearer ")) return authorization.slice(7);
  return null;
}
