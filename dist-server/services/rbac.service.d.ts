/**
 * RBAC is the single source of truth for authorization. Permission lookups go
 * directly to PostgreSQL (`user_roles` -> `role_permissions` -> `permissions`)
 * so DB-side grants (e.g. migration 019) are authoritative without a server
 * restart. The in-memory store cache is intentionally NOT used here.
 */
export interface PermissionResult {
    hasPermission: boolean;
    permissions: string[];
    role: string;
}
export declare class RbacService {
    /** All permission keys for a given user (live Postgres query). */
    getPermissionsForUser(userId: string): Promise<string[]>;
    /** Cached permission set with 30-second TTL. Invalidate on grant/revoke or user role change. */
    private permCache;
    permissionSet(userId: string): Promise<ReadonlySet<string>>;
    invalidatePermCache(userId?: string): void;
    getRolePermissions(roleId: string): Promise<{
        roleId: string;
        permissionId: string;
    }[]>;
    assignPermissionToRole(roleId: string, permissionId: string): Promise<void>;
    removePermissionFromRole(roleId: string, permissionId: string): Promise<void>;
    canUserDo(userId: string, action: string): Promise<boolean>;
    /** Old keys that satisfy a new action key (kept for one release, SEC-07). */
    static PERMISSION_ALIASES: Record<string, string[]>;
    hasPermission(userId: string, permission: string): Promise<boolean>;
    requirePermission(userId: string, permission: string): Promise<void>;
    requireAction(userId: string, action: string): Promise<void>;
}
