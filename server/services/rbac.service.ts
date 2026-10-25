import { ForbiddenError } from "../utils/errors.js";
import { query, withTransaction } from "../database/db.js";

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

export class RbacService {
  /** All permission keys for a given user (live Postgres query). */
  async getPermissionsForUser(userId: string): Promise<string[]> {
    const rows = await query<{ key: string }>(`SELECT DISTINCT p.key
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = $1`, [userId]);
    return rows.map((r) => r.key);
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const perms = await this.getPermissionsForUser(userId);
    return perms.includes(permission);
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
      "finance.view": ["finance.view"],
      "finance.record_payment": ["finance.record_payment"],
      "finance.record_expense": ["finance.record_expense"],
      "finance.view_reports": ["finance.view_reports"],
      "payments.view": ["payments.view"],
      "payments.record": ["payments.record"],
      "deliveries.view": ["deliveries.view"],
      "deliveries.create": ["deliveries.create"],
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

  async requirePermission(userId: string, permission: string): Promise<void> {
    const ok = await this.hasPermission(userId, permission);
    if (!ok) {
      throw new ForbiddenError(`Permission required: ${permission}`);
    }
  }

  async requireAction(userId: string, action: string): Promise<void> {
    const ok = await this.canUserDo(userId, action);
    if (!ok) {
      throw new ForbiddenError(`Action not permitted: ${action}`);
    }
  }

  /** Permission keys granted to a role (live Postgres query). */
  async getRolePermissions(roleId: string): Promise<string[]> {
    const rows = await query<{ key: string }>(`SELECT DISTINCT p.key
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = $1`, [roleId]);
    return rows.map((r) => r.key);
  }

  /** Alias of {@link getRolePermissions} by role id (DB-backed). */
  async getPermissionsForRole(roleId: string): Promise<string[]> {
    return this.getRolePermissions(roleId);
  }

  /** Grant a permission to a role in Postgres (single source of truth). */
  async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    const id = `rp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    await withTransaction(async (tx) => {
      await tx.query(`INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`, [id, roleId, permissionId, now, now]);
    });
  }

  /** Revoke a permission from a role in Postgres. */
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await withTransaction(async (tx) => {
      await tx.query(`DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`, [roleId, permissionId]);
    });
  }
}

export const rbacService = new RbacService();
