export interface AuthSession {
    userId: string;
    username: string;
    displayName: string;
    role: string;
    isAdmin: boolean;
    token: string;
    createdAt: number;
}
export declare class AuthService {
    login(credentials: {
        username: string;
        password: string;
    }): AuthSession;
    logout(token: string | null): void;
    /**
     * SEC-06: DB-first session lookup. A token is valid only while:
     * 1. a sessions row exists for its hash,
     * 2. it has not been revoked (revoked_at IS NULL),
     * 3. expires_at is in the future.
     * No in-process Map, no token reuse after logout.
     */
    getCurrentSession(token: string | null): AuthSession | null;
    requireAuth(token: string | null): AuthSession;
    requireRole(token: string | null, allowedRoles: string[]): AuthSession;
    hasPermission(token: string | null, permission: string): boolean;
    static getSession(token: string | null): AuthSession | null;
    static requireAuth(token: string | null): AuthSession;
    static requireRole(token: string | null, allowedRoles: string[]): AuthSession;
}
export declare function extractToken(authorization: string | undefined): string | null;
