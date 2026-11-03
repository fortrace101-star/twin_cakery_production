import { useEffect, useState } from "react";
import { useLiveRefresh } from "@/lib/live";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "../data-table/DataTable";
import { listRoles, listPermissions } from "@/lib/api";

export function RolesView({ onNotice }: { onNotice: (s: string) => void }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [perms, setPerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = () => {
    setLoading(true);
    Promise.all([listRoles().catch(() => []), listPermissions().catch(() => [])])
      .then(([r, p]) => { setRoles(r || []); setPerms(p || []); })
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);
  useLiveRefresh(reload, { intervalMs: 60000 });

  const columns: Column<any>[] = [
    { key: "name", header: "Role", render: (r) => r.name || r.roleKey || "—" },
    { key: "permissions", header: "Permissions", render: (r) => Array.isArray(r.permissions) ? r.permissions.length : (Array.isArray(r.permissionIds) ? r.permissionIds.length : "—") },
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
      <div className="table-foot"><span>{roles.length} roles</span><span>{perms.length} permissions</span></div>
    </section>
  );
}
