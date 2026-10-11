import { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../utils/errors.js";
import { extractToken, AuthService } from "../services/auth.service.js";

export function attachAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization as string | undefined;
  const token = extractToken(authHeader);
  const session = token ? AuthService.getSession(token) : null;
  (req as unknown as { auth?: { token: string | null; session: unknown } }).auth = {
    token: token ?? null,
    session,
  };
  next();
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

export function requireRole(roles: string[]): Response | void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = (req as unknown as { auth?: { session: unknown } }).auth?.session;
    if (!session) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    next();
  };
}
