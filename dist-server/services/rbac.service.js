import { ForbiddenError } from "../utils/errors.js";
import { query } from "../database/db.js";
export class RbacService {
    /** All permission keys for a given user (live Postgres query). */
    async getPermissionsForUser(userId) {
        const rows = await query(`SELECT DISTINCT p.key
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = $1`, [userId]);
        return rows.map((r) => r.key);
    }
    /** Cached permission set with 30-second TTL. Invalidate on grant/revoke or user role change. */
    permCache = new Map();
    async permissionSet(userId) {
        const hit = this.permCache.get(userId);
        if (hit && hit.exp > Date.now())
            return hit.perms;
        const perms = new Set(await this.getPermissionsForUser(userId));
        this.permCache.set(userId, { exp: Date.now() + 30_000, perms });
        return perms;
    }
    invalidatePermCache(userId) { userId ? this.permCache.delete(userId) : this.permCache.clear(); }
    async getRolePermissions(roleId) {
        const rows = await query(`SELECT rp.role_id, rp.permission_id
         FROM role_permissions rpn        WHERE rp.role_id = $1`, [roleId]);
        return rows.map((r) => ({ roleId: r.role_id, permissionId: r.permission_id }));
    }
    async assignPermissionToRole(roleId, permissionId) {
        await query(`INSERT INTO role_permissions (role_id, permission_id, granted_at) VALUES ($1, $2, now())`, [roleId, permissionId]);
    }
    async removePermissionFromRole(roleId, permissionId) {
        await query(`DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`, [roleId, permissionId]);
    }
    async canUserDo(userId, action) {
        const actionMap = {
            "orders.view": ["orders.view"],
            "orders.create": ["orders.create"],
            "orders.confirm": ["orders.confirm"],
            "orders.cancel": ["orders.cancel"],
            "customers.view": ["customers.view"],
            "customers.create": ["customers.create"],
            "customers.edit": ["customers.edit"],
            "customers.interact": ["customers.interact"],
            "products.view": ["products.view"],
            "products.create": ["products.create"],
            "products.edit": ["products.edit"],
            "products.archive": ["products.archive"],
            "production.view": ["production.view"],
            "production.schedule": ["production.schedule"],
            "production.start": ["production.start"],
            "production.complete": ["production.complete"],
            "production.quality_check": ["production.quality_check"],
            "production.record_wastage": ["production.record_wastage"],
            "production.record_consumption": ["production.record_consumption"],
            "inventory.view": ["inventory.view"],
            "inventory.adjust": ["inventory.adjust"],
            "inventory.reserve": ["inventory.reserve"],
            "inventory.consume": ["inventory.consume"],
            "purchasing.view": ["purchasing.view"],
            "purchasing.create": ["purchasing.create"],
            "purchasing.approve": ["purchasing.approve"],
            "purchasing.receive": ["purchasing.receive"],
            "suppliers.create": ["suppliers.create"],
            "suppliers.edit": ["suppliers.edit"],
            "suppliers.archive": ["suppliers.archive"],
            "finance.view": ["finance.view"],
            "finance.record_payment": ["finance.record_payment"],
            "finance.record_expense": ["finance.record_expense"],
            "finance.view_reports": ["finance.view_reports"],
            "payments.view": ["payments.view"],
            "payments.record": ["payments.record"],
            "deliveries.view": ["deliveries.view"],
            "deliveries.create": ["deliveries.create"],
            "deliveries.update": ["deliveries.update"],
            "deliveries.dispatch": ["deliveries.dispatch"],
            "deliveries.complete": ["deliveries.complete"],
            "deliveries.cancel": ["deliveries.cancel"],
            "feedback.view": ["feedback.view"],
            "feedback.create": ["feedback.create"],
            "feedback.resolve": ["feedback.resolve"],
            "users.manage": ["users.manage"],
            "roles.manage": ["roles.manage"],
            "settings.manage": ["settings.manage"],
            "audit.view": ["audit.view"],
            "catalogue.view": ["catalogue.view"],
            "catalogue.create": ["catalogue.create"],
            "catalogue.edit": ["catalogue.edit"],
            "catalogue.archive": ["catalogue.archive"],
            "quotations.view": ["quotations.view"],
            "quotations.create": ["quotations.create"],
            "quotations.accept": ["quotations.accept"],
            "inquiries.view": ["inquiries.view"],
            "inquiries.create": ["inquiries.create"],
            "sales.analytics": ["sales.analytics"],
        };
        const perms = await this.getPermissionsForUser(userId);
        const actions = actionMap[action] || [action];
        return actions.some((a) => perms.includes(a));
    }
    /** Old keys that satisfy a new action key (kept for one release, SEC-07). */
    static PERMISSION_ALIASES = {
        "quotations.send": ["quotations.accept"],
        "analytics.operations": ["sales.analytics"],
        "analytics.customers": ["sales.analytics"],
        "deliveries.update": ["deliveries.create", "deliveries.dispatch", "deliveries.complete", "deliveries.cancel"],
    };
    async hasPermission(userId, permission) {
        const perms = await this.getPermissionsForUser(userId);
        if (perms.includes(permission))
            return true;
        const aliases = RbacService.PERMISSION_ALIASES[permission] ?? [];
        return aliases.some((a) => perms.includes(a));
    }
    async requirePermission(userId, permission) {
        const ok = await this.hasPermission(userId, permission);
        if (!ok) {
            throw new ForbiddenError(`Permission required: ${permission}`);
        }
    }
    async requireAction(userId, action) {
        const ok = await this.canUserDo(userId, action);
        if (!ok) {
            throw new ForbiddenError(`Action not permitted: ${action}`);
        }
    }
}
