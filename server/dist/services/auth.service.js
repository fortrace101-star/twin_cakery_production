import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
import { store } from "../database/store.js";
import { query } from "../database/db.js";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let tokenSeq = 0;
/**
 * SEC-06: Real sessions live only in the `sessions` table.
 * - token is random (crypto.randomBytes(32), base64url) and is NEVER stored.
 * - token_hash = sha256(token) is stored at rest; lookup is by hash only.
 * - Revoke = set revoked_at in the same row; no in-process Map.
 */
function generateToken() {
    tokenSeq += 1;
    return `${Date.now().toString(36)}-${tokenSeq}-${crypto.randomBytes(32).toString("base64url")}`;
}
function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}
export class AuthService {
    login(credentials) {
        const user = store.findUserByUsername(credentials.username);
        if (!user || user.status !== "Active") {
            throw new UnauthorizedError("Invalid credentials");
        }
        const hash = user.passwordHash || "";
        let ok = false;
        try {
            ok = hash.startsWith("$2") && bcrypt.compareSync(credentials.password, hash);
        }
        catch {
            ok = false;
        }
        if (!ok) {
            throw new UnauthorizedError("Invalid credentials");
        }
        const token = generateToken();
        const tokenHash = hashToken(token);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
        const id = `sess-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
        void query(`INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES ($1,$2,$3,$4,$5)`, [id, user.id, tokenHash, now.toISOString(), expiresAt.toISOString()]);
        const session = {
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
            isAdmin: user.isAdmin,
            token,
            createdAt: Date.now(),
        };
        return session;
    }
    logout(token) {
        if (!token)
            return;
        try {
            const tokenHash = hashToken(token);
            void query(`UPDATE sessions SET revoked_at = now() WHERE token_hash = $1`, [tokenHash]);
        }
        catch {
            /* ignore */
        }
    }
    /**
     * SEC-06: DB-first session lookup. A token is valid only while:
     * 1. a sessions row exists for its hash,
     * 2. it has not been revoked (revoked_at IS NULL),
     * 3. expires_at is in the future.
     * No in-process Map, no token reuse after logout.
     */
    async getCurrentSession(token) {
        if (!token)
            return null;
        try {
            const tokenHash = hashToken(token);
            const rows = (await query(`SELECT s.user_id, s.expires_at, s.revoked_at, u.username, u.display_name, u.role, u.is_admin
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1
           AND s.revoked_at IS NULL
         ORDER BY s.created_at DESC
         LIMIT 1`, [tokenHash]));
            const row = rows[0];
            if (!row)
                return null;
            if (new Date(row.expires_at).getTime() < Date.now())
                return null;
            return {
                userId: row.user_id,
                username: row.username,
                displayName: row.display_name,
                role: row.role,
                isAdmin: row.is_admin,
                token: "", // never exposed outside this process
                createdAt: Date.now(),
            };
        }
        catch {
            return null;
        }
    }
    async requireAuth(token) {
        const session = await this.getCurrentSession(token);
        if (!session) {
            throw new UnauthorizedError("Authentication required");
        }
        return session;
    }
    async requireRole(token, allowedRoles) {
        const session = await this.requireAuth(token);
        if (!allowedRoles.includes(session.role)) {
            throw new ForbiddenError("Insufficient permissions for this action");
        }
        return session;
    }
    async hasPermission(token, permission) {
        const session = await this.getCurrentSession(token);
        if (!session)
            return false;
        if (session.isAdmin)
            return true;
        const rolePermissions = store.rolePermissionsForRole(session.role);
        const rolePermissionIds = rolePermissions.map((rp) => rp.permissionId);
        const requested = store.permissions().find((p) => p.key === permission);
        return Boolean(requested && rolePermissionIds.includes(requested.id));
    }
    static async getSession(token) {
        return new AuthService().getCurrentSession(token);
    }
    static async requireAuth(token) {
        return new AuthService().requireAuth(token);
    }
    static async requireRole(token, allowedRoles) {
        return new AuthService().requireRole(token, allowedRoles);
    }
}
export function extractToken(authorization) {
    if (!authorization)
        return null;
    if (authorization.startsWith("Bearer "))
        return authorization.slice(7);
    return null;
}
//# sourceMappingURL=auth.service.js.map