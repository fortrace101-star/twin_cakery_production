import { ForbiddenError } from "../utils/errors.js";
import { store } from "../database/store.js";
import type { User, Permission, Role } from "../database/types.js";

export interface PermissionResult {
  hasPermission: boolean;
  permissions: string[];
  role: string;
}

export class RbacService {
  getPermissionsForUser(userId: string): string[] {
    const roleAssignments = store.userRolesForUser(userId);
    const permissionIds = new Set<string>();
    for (const ra of roleAssignments) {
      const rps = store.rolePermissionsForRole(ra.roleId);
      for (const rp of rps) {
        permissionIds.add(rp.permissionId);
      }
    }
    return Array.from(permissionIds).map((id) => {
      const perm = store.permissions().find((p) => p.id === id);
      return perm?.key || "";
    }).filter(Boolean);
  }

  hasPermission(userId: string, permission: string): boolean {
    const perms = this.getPermissionsForUser(userId);
    return perms.includes(permission);
  }

  canUserDo(userId: string, action: string): boolean {
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
    const perms = this.getPermissionsForUser(userId);
    const actions = actionMap[action] || [action];
    return actions.some((a) => perms.includes(a));
  }

  requirePermission(userId: string, permission: string): void {
    if (!this.hasPermission(userId, permission)) {
      throw new ForbiddenError(`Permission required: ${permission}`);
    }
  }

  requireAction(userId: string, action: string): void {
    if (!this.canUserDo(userId, action)) {
      throw new ForbiddenError(`Action not permitted: ${action}`);
    }
  }

  getRolePermissions(role: Role): string[] {
    const rolePermissions = store.rolePermissionsForRole(role.id);
    const permissionIds = rolePermissions.map((rp) => rp.permissionId);
    return store.permissions().filter((p) => permissionIds.includes(p.id)).map((p) => p.key);
  }

  getPermissionsForRole(roleId: string): string[] {
    const rolePermissions = store.rolePermissionsForRole(roleId);
    const permissionIds = rolePermissions.map((rp) => rp.permissionId);
    return store.permissions().filter((p) => permissionIds.includes(p.id)).map((p) => p.key);
  }

  assignPermissionToRole(roleId: string, permissionId: string): void {
    store.rolePermissions().push({
      id: `rp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      roleId,
      permissionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  removePermissionFromRole(roleId: string, permissionId: string): void {
    const rps = store.rolePermissions();
    const idx = rps.findIndex((rp) => rp.roleId === roleId && rp.permissionId === permissionId);
    if (idx !== -1) rps.splice(idx, 1);
  }
}

export const rbacService = new RbacService();
