import { extractToken, AuthService } from "../services/auth.service.js";
import { RbacService } from "../services/rbac.service.js";
const rbacService = new RbacService();
export function attachAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = extractToken(authHeader);
    const session = token ? AuthService.getSession(token) : null;
    req.auth = {
        token: token ?? null,
        session,
    };
    next();
}
export function requireAuth(req, res, next) {
    const auth = req.auth;
    if (!auth || !auth.session) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }
    req.auth = auth;
    next();
}
/** Authenticated, returning a live Postgres session so routes stay on real data. */
export function requireSession(req, res, next) {
    const auth = req.auth;
    if (!auth || !auth.session) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }
    const session = auth.session;
    if (!session) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }
    req.session = session;
    next();
}
/** Every listed permission is required. Use requireAny() for "one of". */
export function requirePermission(...needed) {
    return async (req, res, next) => {
        const auth = req.auth;
        const session = auth?.session;
        if (!session)
            return res.status(401).json({ error: "Authentication required" });
        try {
            const granted = await rbacService.permissionSet(session.userId);
            const missing = needed.filter((p) => !granted.has(p));
            if (missing.length)
                return res.status(403).json({ error: "Forbidden", missing });
            req.perms = granted;
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
export function requireAny(...needed) {
    return async (req, res, next) => {
        const auth = req.auth;
        const session = auth?.session;
        if (!session)
            return res.status(401).json({ error: "Authentication required" });
        const granted = await rbacService.permissionSet(session.userId);
        if (!needed.some((p) => granted.has(p)))
            return res.status(403).json({ error: "Forbidden" });
        req.perms = granted;
        next();
    };
}
/** The actor for audit/money rows. Never read an actor from req.body. */
export const actorOf = (req) => {
    const id = req.auth?.session?.userId;
    if (!id)
        throw new Error("actorOf() called on an unauthenticated request");
    return id;
};
export function requireRole(roles) {
    return (req, res, next) => {
        const session = req.auth?.session;
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
