import { ForbiddenError } from "../utils/errors";
import { query } from "../database/db";
import { store } from "../database/store";

/**
 * RBAC is the single source of truth for authorization. Permission lookups go
 * directly to PostgreSQL (`user_roles` -> `role_permissions` -> `permissions`)
 * so DB-side grants (e.g. migration 019) are authoritative without a server
 * restart. When Postgres is unavailable (e.g. file-store/dev environments with
 * broken DB credentials), fall back to the in-memory/file store so admin access
 * and basic RBAC still work; non-admin grants remain best-effort from store data.
 */
export interface PermissionResult {
  hasPermission: boolean;
  permissions: string[];
  role: string;
}

const PERMISSION_ALIASES: Record<string, string> = {
  'quotations.send': 'quotations.accept',
  'analytics.operations': 'sales.analytics',
  'analytics.finance': 'finance.view_reports',
  'analytics.customers': 'sales.analytics',
  'analytics.staff': 'sales.analytics',
  'payments.refund': 'payments.record',
  'payments.confirm_remittance': 'payments.record',
  'expenses.approve': 'expenses.approve',
  'orders.override_price': 'orders.create',
  'inventory.approve_writeoff': 'inventory.adjust',
  'inventory.view_costs': 'inventory.view',
  'finance.view_margins': 'finance.view_reports',
  'orders.view_all': 'orders.view',
  'deliveries.view_all': 'deliveries.view',
  'customers.view_all': 'customers.view',
  'production.view_all': 'production.view',
};

export class RbacService {
  /** All permission keys for a given user (Postgres is mandatory). */
  async getPermissionsForUser(userId: string): Promise<string[]> {
    // Admins get full access to all permissions
    const userRows = await query<{ is_admin: any; role: string }>(`SELECT is_admin, role FROM users WHERE id = $1`, [userId]);
    const user = userRows[0];
    const isAdmin = user?.is_admin === true || user?.is_admin === 1 || String(user?.is_admin).toLowerCase() === "true" || user?.role === "Admin / Proprietor";
    let hasAdminRole = false;
    if (!isAdmin) {
      const roleAdmin = await query(`SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = 'role-admin' LIMIT 1`, [userId]);
      hasAdminRole = roleAdmin.length > 0;
    }
    if (isAdmin || hasAdminRole) {
      const allPerms = await query<{ key: string }>(`SELECT key FROM permissions ORDER BY key`);
      if (allPerms.length > 0) return allPerms.map((r) => r.key);
      // Catalog fallback only if permissions table is empty (e.g. post-wipe pre-seed).
      const all = store.permissions().map((p: any) => p.key ?? p.id).filter(Boolean);
      return Array.from(new Set(all));
    }
    const rows = await query<{ key: string }>(`SELECT DISTINCT p.key
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = $1`, [userId]);
    return rows.map((r) => r.key);
  }

  /** Cached permission set with 30-second TTL. Invalidate on grant/revoke or user role change. */
  private permCache = new Map<string, { exp: number; perms: Set<string> }>();
  async permissionSet(userId: string): Promise<ReadonlySet<string>> {
    const hit = this.permCache.get(userId);
    if (hit && hit.exp > Date.now()) return hit.perms;
    const perms = new Set(await this.getPermissionsForUser(userId));
    this.permCache.set(userId, { exp: Date.now() + 30_000, perms });
    return perms;
  }
  invalidatePermCache(userId?: string) { userId ? this.permCache.delete(userId) : this.permCache.clear(); }

  async getRolePermissions(roleId: string): Promise<{ roleId: string; permissionId: string }[]> {
    const rows = await query<{ role_id: string; permission_id: string }>(
      `SELECT rp.role_id, rp.permission_id
         FROM role_permissions rpn        WHERE rp.role_id = $1`, [roleId],
    );
    return rows.map((r) => ({ roleId: r.role_id, permissionId: r.permission_id }));
  }

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    await query(
      `INSERT INTO role_permissions (role_id, permission_id, granted_at) VALUES ($1, $2, now())`,
      [roleId, permissionId],
    );
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await query(
      `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
      [roleId, permissionId],
    );
  }

  async canUserDo(userId: string, action: string): Promise<boolean> {
    const actionMap: Record<string, string[]> = {
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
  static PERMISSION_ALIASES: Record<string, string[]> = {
    "quotations.send": ["quotations.accept"],
    "analytics.operations": ["sales.analytics"],
    "analytics.customers": ["sales.analytics"],
    "deliveries.update": ["deliveries.create", "deliveries.dispatch", "deliveries.complete", "deliveries.cancel"],
  };

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const perms = await this.getPermissionsForUser(userId);
    if (perms.includes(permission)) return true;
    const aliases = RbacService.PERMISSION_ALIASES[permission] ?? [];
    return aliases.some((a) => perms.includes(a));
  }

  async requirePermission(userId: string, permission: string): Promise<void> {
    const ok = await this.hasPermission(userId, permission);
    if (!ok) {
      // Try alias lookup (SEC-07): old keys satisfy new action keys
      const aliases = RbacService.PERMISSION_ALIASES[permission];
      if (aliases) {
        for (const a of aliases) {
          if (await this.hasPermission(userId, a)) return;
        }
      }
      throw new ForbiddenError(`Permission required: ${permission}`);
    }
  }

  async requireAction(userId: string, action: string): Promise<void> {
    const ok = await this.canUserDo(userId, action);
    if (!ok) {
      throw new ForbiddenError(`Action not permitted: ${action}`);
    }
  }
}
