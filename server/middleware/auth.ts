import type { Request, Response, NextFunction, RequestHandler } from "express";
import { extractToken, AuthService } from "../services/auth.service.js";
import { RbacService } from "../services/rbac.service.js";

declare global {
  namespace Express {
    interface Request {
      auth?: { token: string | null; session: unknown };
      perms?: ReadonlySet<string>;
      session?: unknown;
    }
  }
}

const rbacService = new RbacService();

export async function attachAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    const token = extractToken(authHeader);
    const session = token ? await AuthService.getSession(token) : null;
    (req as unknown as { auth?: { token: string | null; session: unknown } }).auth = {
      token: token ?? null,
      session,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = (req as unknown as { auth?: { session: unknown } }).auth;
  if (!auth || !auth.session) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  (req as unknown as { auth: { session: unknown } }).auth = auth;
  next();
}

/** Authenticated, returning a live Postgres session so routes stay on real data. */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const auth = (req as unknown as { auth?: { session: unknown } }).auth;
  if (!auth || !auth.session) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const session = auth.session as any;
  if (!session) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  (req as any).session = session;
  next();
}

/** Every listed permission is required. Use requireAny() for "one of". */
export function requirePermission(...needed: string[]): RequestHandler {
  return async (req, res, next) => {
    const auth = (req as unknown as { auth?: { session: any } }).auth;
    const session = auth?.session as any;
    if (!session) return res.status(401).json({ error: "Authentication required" });
    try {
      const granted = await rbacService.permissionSet(session.userId);
      const missing = needed.filter((p) => !granted.has(p));
      if (missing.length) return res.status(403).json({ error: "Forbidden", missing });
      req.perms = granted;
      next();
    } catch (err) { next(err); }
  };
}

export function requireAny(...needed: string[]): RequestHandler {
  return async (req, res, next) => {
    const auth = (req as unknown as { auth?: { session: any } }).auth;
    const session = auth?.session as any;
    if (!session) return res.status(401).json({ error: "Authentication required" });
    const granted = await rbacService.permissionSet(session.userId);
    if (!needed.some((p) => granted.has(p))) return res.status(403).json({ error: "Forbidden" });
    req.perms = granted;
    next();
  };
}

/** The actor for audit/money rows. Never read an actor from req.body. */
export const actorOf = (req: Request): string => {
  const id = (req as unknown as { auth?: { session?: { userId?: string } } }).auth?.session?.userId;
  if (!id) throw new Error("actorOf() called on an unauthenticated request");
  return id;
};

export function requireRole(roles: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = (req as unknown as { auth?: { session: { role?: string } } }).auth?.session as any;
    if (!session) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(session.role)) {
      res.status(403).json({ error: "Forbidden", missing: roles });
      return;
    }
    next();
  };
}

// Export a reference used by route modules that import `../middleware/auth.js`
// and call auth.requirePermission/requireAny directly (index.ts owns its own
// singleton to avoid circular startup dependency on rbac.service.js).
export { rbacService };

