import { useEffect, useState } from "react";
import { useLiveRefresh } from "@/lib/live";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "../data-table/DataTable";
import { listRbacRoles, listRbacPermissions, getRolePermissionKeys } from "@/lib/api";
import type { ServerRole, ServerPermission } from "@/lib/api";




export function RolesView({ onNotice }: { onNotice: (s: string) => void }) {
  const [roles, setRoles] = useState<ServerRole[]>([]);
  const [permMap, setPermMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await listRbacRoles().catch(() => []);
      setRoles(Array.isArray(r) ? r : []);
      const m: Record<string, string[]> = {};
      for (const role of Array.isArray(r) ? r : []) {
        const keys = await getRolePermissionKeys(role.id).catch(() => []);
        m[role.id] = Array.isArray(keys) ? keys : [];
      }
      setPermMap(m);
    } catch {
      /* keep existing rows */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); return; }, []);
  useLiveRefresh(reload);

  const columns: Column<ServerRole>[] = [
    { header: "Role", accessorKey: "name", accessorFn: (r: ServerRole) => r.name, render: (r: ServerRole) => r.name || "—", cell: (r: ServerRole) => r.name || "—" },
    { header: "Permissions", accessorKey: "permissions", accessorFn: (r: ServerRole) => (permMap[r.id]?.length ?? 0).toString(), render: (r: ServerRole) => (permMap[r.id]?.length ?? 0).toString(), cell: (r: ServerRole) => (permMap[r.id]?.length ?? 0).toString() },
  ];

  return (
    <section className="panel module-table">
      <header className="panel-header">
        <div>
          <h2>Roles & Permissions</h2>
          <p className="panel-subtitle">Role-permission matrix</p>
        </div>
        <div className="panel-actions">
          <Button variant="outline" onClick={reload} disabled={loading}>Refresh</Button>
        </div>
      </header>
      <DataTable columns={columns} rows={roles} rowKey={(r) => r.id || r.name} stickyHeader empty={<div className="empty-state"><h3>No roles</h3></div>} />
      <div className="table-foot"><span>{roles.length} roles</span><span>{Object.values(permMap).reduce((a, b) => a + b.length, 0)} permissions</span></div>
    </section>
  );
}
