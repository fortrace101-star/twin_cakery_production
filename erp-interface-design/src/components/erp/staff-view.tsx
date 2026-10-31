import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/lib/live";
import { Lock, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { money } from "./data";
import { StatusBadge as Status } from "../data-table/StatusBadge";
import { DataTable, type Column } from "../data-table/DataTable";
import { useDensity } from "@/lib/density";
import { useWorkspace } from "./store";
import {
  addAdjustment, approvePeriod, archiveStaff, calculatePeriod, closePeriod, createAdvance, createPeriod, createStaff,
  getPeriod, getPayslip, getRemunerationDashboard, getSalaryProfile, issuePayslips, listAdvances, listAttendance,
  listPayslips, listPeriods, listStaff, markPaymentPaid, recordAdvanceRepayment, recordAttendance, recordPeriodPayment,
  saveSalaryProfile, updateStaff,
  type AttendanceStatus, type EmploymentStatus, type PaymentFrequency, type PeriodType, type RemunerationPaymentMethod,
  type ServerAdvance, type ServerAttendance, type ServerPayslip, type ServerPeriod, type ServerPeriodDetail,
  type ServerSalaryProfile, type ServerStaff,
} from "@/lib/api";

/* ── Staff & Salary (E7; governing spec §18) ─────────────────────────────
 * Team + Attendance read/write through /staff (identity only — never salary).
 * The Salary-periods / Advances / Payslips tabs sit behind remuneration.*
 * permissions: without remuneration.view they render a lock panel and issue
 * no salary fetches at all, so pay figures never reach an unauthorized session.
 */

const EMPLOYMENT_STATUSES: EmploymentStatus[] = ["ACTIVE", "PROBATION", "ON_LEAVE", "INACTIVE", "TERMINATED"];
const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "SICK", "LATE"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(d)} ${months[Number(m) - 1] ?? ""} ${y}`;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : "Operation failed";
}

/** Permission-hold panel (same shape as the empty-state blocks). */
function Locked({ title, note }: { title: string; note: string }) {
  return (
    <div className="empty-state">
      <Lock />
      <h3>{title}</h3>
      <p>{note}</p>
    </div>
  );
}

/* ── Team tab ─────────────────────────────────────────────────────────── */

type StaffForm = {
  name: string; jobTitle: string; phone: string; email: string;
  employmentStatus: EmploymentStatus; startDate: string; schedule: string; notes: string;
};

const emptyStaffForm: StaffForm = {
  name: "", jobTitle: "", phone: "", email: "",
  employmentStatus: "ACTIVE", startDate: "", schedule: "", notes: "",
};

function TeamTab(props: {
  search: string;
  setSearch: (v: string) => void;
  can: (perm: string) => boolean;
  connected: boolean;
  onNotice: (m: string) => void;
  onSignIn: () => void;
}) {
  const { search, setSearch, can, connected, onNotice, onSignIn } = props;
  const { density } = useDensity();
  const [rows, setRows] = useState<ServerStaff[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServerStaff | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyStaffForm);
  // Salary profile loads only when the session holds remuneration.view —
  // otherwise those fetches never happen at all (§18.2 confidentiality).
  const [profile, setProfile] = useState<ServerSalaryProfile | null>(null);
  const [payForm, setPayForm] = useState({
    basicSalary: "", allowanceAmount: "", deductionAmount: "", paymentFrequency: "monthly" as PaymentFrequency,
  });

  const reload = useCallback(() => {
    void listStaff({ status: statusFilter, q: search }).then(setRows);
  }, [statusFilter, search]);
  useEffect(reload, [reload]);

  const openCreate = () => {
    if (!connected) { onSignIn(); return; }
    setEditing(null);
    setForm(emptyStaffForm);
    setProfile(null);
    setPayForm({ basicSalary: "", allowanceAmount: "", deductionAmount: "", paymentFrequency: "monthly" });
    setFormOpen(true);
  };

  const openRow = async (s: ServerStaff) => {
    setEditing(s);
    setForm({
      name: s.name, jobTitle: s.jobTitle, phone: s.phone, email: s.email,
      employmentStatus: s.employmentStatus, startDate: s.startDate ?? "", schedule: s.schedule, notes: s.notes,
    });
    setProfile(null);
    setPayForm({ basicSalary: "", allowanceAmount: "", deductionAmount: "", paymentFrequency: "monthly" });
    setFormOpen(true);
    if (connected && can("remuneration.view")) {
      const p = await getSalaryProfile(s.id);
      setProfile(p);
      if (p) {
        setPayForm({
          basicSalary: String(p.basicSalary), allowanceAmount: String(p.allowanceAmount),
          deductionAmount: String(p.deductionAmount), paymentFrequency: p.paymentFrequency,
        });
      }
    }
  };

  const submit = async () => {
    if (!connected) { onSignIn(); return; }
    setBusy(true);
    try {
      const base = {
        name: form.name, jobTitle: form.jobTitle, phone: form.phone, email: form.email,
        employmentStatus: form.employmentStatus, startDate: form.startDate || null,
        schedule: form.schedule, notes: form.notes,
      } as Partial<ServerStaff>;
      if (editing) {
        await updateStaff(editing.id, base);
        onNotice(`${form.name} updated`);
      } else {
        const created = await createStaff(base);
        onNotice(`${created.name} added (${created.staffNumber})`);
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      onNotice(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const submitProfile = async () => {
    if (!editing || !connected) return;
    setBusy(true);
    try {
      const saved = await saveSalaryProfile(editing.id, {
        basicSalary: Number(payForm.basicSalary) || 0,
        allowanceAmount: Number(payForm.allowanceAmount) || 0,
        deductionAmount: Number(payForm.deductionAmount) || 0,
        paymentFrequency: payForm.paymentFrequency,
      });
      setProfile(saved);
      onNotice(`Salary profile saved for ${editing.name}`);
    } catch (err) {
      onNotice(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const archive = async (s: ServerStaff) => {
    if (!connected) { onSignIn(); return; }
    setBusy(true);
    try {
      await archiveStaff(s.id);
      onNotice(`${s.name} archived — employment history kept`);
      setFormOpen(false);
      reload();
    } catch (err) {
      onNotice(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<ServerStaff>[] = [
    { header: "Team member", cell: (s) => <><strong className="product-name">{s.name}</strong><small className="cell-sub">{s.staffNumber} · {s.jobTitle || "—"}</small></> },
    { header: "Contact", cell: (s) => <><span>{s.phone || "—"}</span><small className="cell-sub">{s.email}</small></> },
    { header: "Status", cell: (s) => <Status value={s.employmentStatus.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} /> },
    { header: "Started", cell: (s) => fmtDate(s.startDate) },
    { header: "Schedule", cell: (s) => <span className="cell-sub">{s.schedule || "—"}</span> },
    { header: "", cell: (s) => <Button variant="outline" size="sm" disabled={busy} onClick={(e) => { e.stopPropagation(); void openRow(s); }}>{can("staff.manage") ? "Manage" : "View"}</Button> },
  ];

  return (
    <section className="panel module-table">
      <div className="panel-heading">
        <h2>Team directory <span className="inline-count">{rows.length}</span></h2>
        <span className="text-muted-foreground text-xs">Identity &amp; schedule only — salary lives behind remuneration permissions</span>
      </div>
      <div className="table-controls">
        <label className="search-box"><Search size={16} /><input aria-label="Search team members" placeholder="Search name, staff number, job…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label className="filter-select">
          <select aria-label="Filter by employment status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </label>
        {can("staff.manage") && <Button variant="outline" onClick={openCreate}><Plus size={16} /> Add team member</Button>}
      </div>
      <DataTable
        columns={columns} rows={rows} rowKey={(s) => s.id} onRowActivate={(s) => void openRow(s)}
        stickyHeader density={density}
        empty={<div className="empty-state"><Search /><h3>No team members found</h3><p>Add your first team member to start tracking attendance and payroll.</p></div>}
      />
      <div className="table-foot"><span>{rows.length} team members</span><span>{rows.filter((r) => r.employmentStatus === "ACTIVE").length} active</span></div>

      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) setFormOpen(false); }}>
        <DialogContent className="order-detail-dialog">
          <DialogTitle>{editing ? editing.name : "Add team member"}</DialogTitle>
          <DialogDescription>{editing ? `${editing.staffNumber} · ${editing.jobTitle || "no job title"}` : "New team member — identity only; payroll figures go in the salary profile below."}</DialogDescription>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="st-name">Full name</Label><Input id="st-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label htmlFor="st-job">Job title</Label><Input id="st-job" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></div>
              <div><Label htmlFor="st-phone">Phone</Label><Input id="st-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label htmlFor="st-email">Email</Label><Input id="st-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label htmlFor="st-status">Employment status</Label>
                <select id="st-status" className="filter-select" value={form.employmentStatus} onChange={(e) => setForm({ ...form, employmentStatus: e.target.value as EmploymentStatus })}>
                  {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
              <div><Label htmlFor="st-start">Start date</Label><Input id="st-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            </div>
            <div><Label htmlFor="st-schedule">Schedule / work pattern</Label><Input id="st-schedule" placeholder="e.g. Mon–Fri · 08:00–17:00" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} /></div>
            <div><Label htmlFor="st-notes">Notes</Label><Textarea id="st-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>

          {editing && can("remuneration.view") && (
            <div className="configuration-list">
              <p><span>Salary profile</span><strong>{profile === null ? "No profile yet" : `${money(profile.basicSalary)} basic`}</strong></p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="pf-basic">Basic salary (UGX)</Label><Input id="pf-basic" inputMode="numeric" value={payForm.basicSalary} onChange={(e) => setPayForm({ ...payForm, basicSalary: e.target.value })} /></div>
                <div><Label htmlFor="pf-allow">Allowances (UGX)</Label><Input id="pf-allow" inputMode="numeric" value={payForm.allowanceAmount} onChange={(e) => setPayForm({ ...payForm, allowanceAmount: e.target.value })} /></div>
                <div><Label htmlFor="pf-deduct">Deductions (UGX)</Label><Input id="pf-deduct" inputMode="numeric" value={payForm.deductionAmount} onChange={(e) => setPayForm({ ...payForm, deductionAmount: e.target.value })} /></div>
                <div><Label htmlFor="pf-freq">Payment frequency</Label>
                  <select id="pf-freq" className="filter-select" value={payForm.paymentFrequency} onChange={(e) => setPayForm({ ...payForm, paymentFrequency: e.target.value as PaymentFrequency })}>
                    {(["weekly", "biweekly", "monthly", "quarterly", "custom"] as PaymentFrequency[]).map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              {can("remuneration.edit") && <Button variant="outline" size="sm" disabled={busy} onClick={() => void submitProfile()}>Save salary profile</Button>}
            </div>
          )}

          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
            {editing && can("staff.manage") && editing.employmentStatus !== "TERMINATED" && (
              <Button variant="outline" disabled={busy} onClick={() => void archive(editing)}>Archive</Button>
            )}
            <Button disabled={busy || !form.name.trim()} onClick={() => void submit()}>{editing ? "Save changes" : "Add member"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ── Attendance tab ───────────────────────────────────────────────────── */

function AttendanceTab(props: {
  search: string;
  can: (perm: string) => boolean;
  connected: boolean;
  onNotice: (m: string) => void;
  onSignIn: () => void;
}) {
  const { search, can, connected, onNotice, onSignIn } = props;
  const { density } = useDensity();
  const [rows, setRows] = useState<ServerAttendance[]>([]);
  const [staff, setStaff] = useState<ServerStaff[]>([]);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ staffId: "", date: new Date().toISOString().slice(0, 10), status: "PRESENT" as AttendanceStatus, hours: "8", notes: "" });

  const reload = useCallback(() => {
    void listAttendance({ from, to }).then(setRows);
    void listStaff().then(setStaff);
  }, [from, to]);
  useEffect(reload, [reload]);

  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? "";

  const submit = async () => {
    if (!connected) { onSignIn(); return; }
    if (!form.staffId) { onNotice("Choose a team member first"); return; }
    setBusy(true);
    try {
      await recordAttendance({ staffId: form.staffId, date: form.date, status: form.status, hours: Number(form.hours) || 0, notes: form.notes });
      onNotice(`Attendance saved for ${fmtDate(form.date)}`);
      setOpen(false);
      reload();
    } catch (err) {
      onNotice(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => `${r.staffName ?? ""} ${nameOf(r.staffId)} ${r.notes}`.toLowerCase().includes(q)) : rows;
  const present = filtered.filter((r) => r.status === "PRESENT" || r.status === "LATE" || r.status === "HALF_DAY").length;

  const columns: Column<ServerAttendance>[] = [
    { header: "Date", cell: (r) => fmtDate(r.date) },
    { header: "Team member", cell: (r) => <strong className="product-name">{r.staffName || nameOf(r.staffId) || "—"}</strong> },
    { header: "Status", cell: (r) => <Status value={r.status.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} /> },
    { header: "Hours", align: "right", cell: (r) => <span className="amount-cell">{r.hours}</span> },
    { header: "Notes", cell: (r) => <span className="cell-sub">{r.notes || "—"}</span> },
  ];

  return (
    <section className="panel module-table">
      <div className="panel-heading">
        <h2>Attendance <span className="inline-count">{filtered.length}</span></h2>
        <span className="text-muted-foreground text-xs">One row per person per day — re-recording the same day replaces it</span>
      </div>
      <div className="table-controls">
        <label className="filter-select">
          <span className="cell-sub">From</span>
          <input aria-label="Attendance from date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="filter-select">
          <span className="cell-sub">To</span>
          <input aria-label="Attendance to date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {can("staff.attendance") && (
          <Button variant="outline" onClick={() => { if (!connected) { onSignIn(); return; } setOpen(true); }}>
            <Plus size={16} /> Record attendance
          </Button>
        )}
      </div>
      <DataTable
        columns={columns} rows={filtered} rowKey={(r) => r.id} stickyHeader density={density}
        empty={<div className="empty-state"><Search /><h3>No attendance in this range</h3><p>Pick a wider date range or record a day for your team.</p></div>}
      />
      <div className="table-foot"><span>{filtered.length} records</span><span>{present} present</span></div>

      <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
        <DialogContent>
          <DialogTitle>Record attendance</DialogTitle>
          <DialogDescription>One day, one person — saving again on the same day updates the record.</DialogDescription>
          <div className="space-y-3">
            <div><Label htmlFor="at-staff">Team member</Label>
              <select id="at-staff" className="filter-select" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
                <option value="">Choose…</option>
                {staff.filter((s) => s.employmentStatus !== "TERMINATED").map((s) => <option key={s.id} value={s.id}>{s.name} · {s.staffNumber}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label htmlFor="at-date">Date</Label><Input id="at-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label htmlFor="at-status">Status</Label>
                <select id="at-status" className="filter-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AttendanceStatus })}>
                  {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
              <div><Label htmlFor="at-hours">Hours</Label><Input id="at-hours" inputMode="numeric" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></div>
            </div>
            <div><Label htmlFor="at-notes">Notes</Label><Input id="at-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || !form.staffId} onClick={() => void submit()}>Save record</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ── Salary periods tab (§18.3–§18.7 workflow) ───────────────────────── */

function SalaryTab(props: {
  can: (perm: string) => boolean;
  connected: boolean;
  onNotice: (m: string) => void;
  onSignIn: () => void;
}) {
  const { can, connected, onNotice, onSignIn } = props;
  const { density } = useDensity();
  const [dash, setDash] = useState<Awaited<ReturnType<typeof getRemunerationDashboard>>>(null);
  const [periods, setPeriods] = useState<ServerPeriod[]>([]);
  const [staff, setStaff] = useState<ServerStaff[]>([]);
  const [selected, setSelected] = useState<ServerPeriodDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [npForm, setNpForm] = useState({ label: "", periodType: "monthly" as PeriodType, startDate: "", endDate: "", intendedPaymentDate: "" });
  const [payForm, setPayForm] = useState({ staffId: "", amount: "", paymentDate: new Date().toISOString().slice(0, 10), method: "CASH", reference: "" });
  const [adjForm, setAdjForm] = useState({ staffId: "", otherPayments: "", notes: "" });

  const guard = () => { if (!connected) { onSignIn(); return false; } return true; };

  const reload = useCallback(() => {
    void getRemunerationDashboard().then(setDash);
    void listPeriods().then(setPeriods);
    void listStaff().then(setStaff);
  }, []);
  useEffect(reload, [reload]);
  useLiveRefresh(reload);

  const refreshSelected = async (id: string) => {
    const detail = await getPeriod(id);
    setSelected(detail);
    void getRemunerationDashboard().then(setDash);
    void listPeriods().then(setPeriods);
  };

  const openPeriod = async (id: string) => {
    setSelected(await getPeriod(id));
  };

  const run = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => {
    if (!guard()) return;
    setBusy(true);
    try {
      await fn();
      onNotice(ok);
      after?.();
    } catch (err) {
      onNotice(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const submitNewPeriod = async () => {
    await run(async () => {
      const created = await createPeriod({
        label: npForm.label, periodType: npForm.periodType,
        startDate: npForm.startDate, endDate: npForm.endDate,
        ...(npForm.intendedPaymentDate ? { intendedPaymentDate: npForm.intendedPaymentDate } : {}),
      });
      setNewOpen(false);
      setNpForm({ label: "", periodType: "monthly", startDate: "", endDate: "", intendedPaymentDate: "" });
      await openPeriod(created.id);
    }, "Salary period created (OPEN)");
  };

  const submitPayment = async () => {
    if (!selected) return;
    await run(async () => {
      await recordPeriodPayment(selected.id, {
        staffId: payForm.staffId, amount: Number(payForm.amount) || 0,
        paymentDate: payForm.paymentDate, method: payForm.method as RemunerationPaymentMethod,
        ...(payForm.reference ? { reference: payForm.reference } : {}),
      });
      setPayOpen(false);
      setPayForm({ staffId: "", amount: "", paymentDate: new Date().toISOString().slice(0, 10), method: "CASH", reference: "" });
      await refreshSelected(selected.id);
    }, "Payment recorded");
  };

  const submitAdjustment = async () => {
    if (!selected) return;
    await run(async () => {
      await addAdjustment(selected.id, {
        staffId: adjForm.staffId,
        otherPayments: Number(adjForm.otherPayments) || 0,
        ...(adjForm.notes ? { notes: adjForm.notes } : {}),
      });
      setAdjOpen(false);
      setAdjForm({ staffId: "", otherPayments: "", notes: "" });
      await refreshSelected(selected.id);
    }, "Adjustment line added — original lines untouched");
  };

  const t = dash?.totals;
  const cards: { label: string; value: string }[] = [
    { label: "Due this period", value: t ? money(t.due) : "—" },
    { label: "Paid", value: t ? money(t.paid) : "—" },
    { label: "Pending", value: t ? money(t.pending) : "—" },
    { label: "Outstanding advances", value: t ? money(t.outstandingAdvances) : "—" },
  ];

  const periodColumns: Column<ServerPeriod>[] = [
    { header: "Period", cell: (p) => <><strong className="product-name">{p.label || `${fmtDate(p.startDate)} → ${fmtDate(p.endDate)}`}</strong><small className="cell-sub">{fmtDate(p.startDate)} – {fmtDate(p.endDate)} · {p.periodType}</small></> },
    { header: "Status", cell: (p) => <Status value={p.status.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} /> },
    { header: "Total", align: "right", cell: (p) => <span className="amount-cell">{money(p.totalAmount)}</span> },
    { header: "Paid", align: "right", cell: (p) => <span className="amount-cell">{money(p.paidAmount)}</span> },
    { header: "Payment date", cell: (p) => fmtDate(p.intendedPaymentDate) },
    { header: "", cell: (p) => <Button variant="outline" size="sm" disabled={busy} onClick={(e) => { e.stopPropagation(); void openPeriod(p.id); }}>Open</Button> },
  ];

  return (
    <section className="panel module-table">
      <div className="panel-heading">
        <h2>Salary periods <span className="inline-count">{periods.length}</span></h2>
        <span className="text-muted-foreground text-xs">OPEN → PROCESSING → APPROVED → PAID → CLOSED · closed history is frozen</span>
      </div>
      <div className="configuration-list">
        {cards.map((c) => <p key={c.label}><span>{c.label}</span><strong>{c.value}</strong></p>)}
      </div>
      <div className="table-controls">
        <span className="cell-sub">{dash?.period ? `Working period: ${dash.period.label} (${dash.periodStatus ?? dash.period.status})` : "No open period yet"}</span>
        {can("remuneration.create") && <Button variant="outline" onClick={() => { if (guard()) setNewOpen(true); }}><Plus size={16} /> New period</Button>}
      </div>
      <DataTable
        columns={periodColumns} rows={periods} rowKey={(p) => p.id} onRowActivate={(p) => void openPeriod(p.id)}
        stickyHeader density={density}
        empty={<div className="empty-state"><Search /><h3>No salary periods yet</h3><p>Create an OPEN period, calculate salaries from the profiles, then approve and pay.</p></div>}
      />
      <div className="table-foot"><span>{periods.length} periods</span><span>{periods.filter((p) => p.status === "CLOSED").length} closed</span></div>

      {selected && (
        <Dialog open onOpenChange={(v) => { if (!v) setSelected(null); }}>
          <DialogContent className="order-detail-dialog">
            <DialogTitle>{selected.label || `${fmtDate(selected.startDate)} → ${fmtDate(selected.endDate)}`}</DialogTitle>
            <DialogDescription>
              {fmtDate(selected.startDate)} – {fmtDate(selected.endDate)} · {selected.periodType} ·{" "}
              <Status value={selected.status.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} />
            </DialogDescription>
            {selected.status === "CLOSED" && (
              <p className="cell-sub">Closed {fmtDate(selected.closedAt)} — history frozen. Corrections are added as new adjustment lines, never by rewriting lines.</p>
            )}
            <div className="configuration-list">
              <p><span>Total due</span><strong>{money(selected.totalAmount)}</strong></p>
              <p><span>Paid</span><strong>{money(selected.paidAmount)}</strong></p>
              <p><span>Pending</span><strong>{money(Math.round((selected.totalAmount - selected.paidAmount) * 100) / 100)}</strong></p>
            </div>

            <h3 className="text-sm font-semibold">Salary lines ({selected.items.length})</h3>
            {selected.items.length === 0 ? (
              <p className="cell-sub">Not calculated yet — run “Calculate salaries” to select staff and build the lines.</p>
            ) : (
              <div className="configuration-list">
                {selected.items.map((i) => (
                  <p key={i.id}>
                    <span>{i.staffName || i.staffId} · basic {money(i.basicSalary)} + allow {money(i.allowances)} + bonus {money(i.bonuses)} − ded {money(i.deductions)} − adv {money(i.advanceAmount)}</span>
                    <strong>{money(i.netAmount)} · {i.status} · paid {money(i.paidAmount)}</strong>
                  </p>
                ))}
              </div>
            )}

            <h3 className="text-sm font-semibold">Payments ({selected.payments.length})</h3>
            {selected.payments.length === 0 ? (
              <p className="cell-sub">No payments recorded for this period.</p>
            ) : (
              <div className="configuration-list">
                {selected.payments.map((p) => (
                  <p key={p.id}>
                    <span>{p.staffName || p.staffId} · {fmtDate(p.paymentDate)} · {p.method}{p.reference ? ` · ${p.reference}` : ""}</span>
                    <strong>
                      {money(p.amount)} · {p.paymentStatus}
                      {can("remuneration.record_payment") && p.paymentStatus !== "PAID" && (
                        <> <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => { await markPaymentPaid(p.id); }, "Marked as paid", () => selected && void refreshSelected(selected.id))}>Mark paid</Button></>
                      )}
                    </strong>
                  </p>
                ))}
              </div>
            )}

            <div className="dialog-actions">
              <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
              {can("remuneration.edit") && (
                <Button variant="outline" disabled={busy} onClick={() => { if (guard()) setAdjOpen(true); }}>Add adjustment</Button>
              )}
              {can("remuneration.process") && (selected.status === "OPEN" || selected.status === "PROCESSING") && (
                <Button variant="outline" disabled={busy} onClick={() => void run(async () => { await calculatePeriod(selected.id); }, "Salaries calculated", () => void refreshSelected(selected.id))}>Calculate salaries</Button>
              )}
              {can("remuneration.process") && ["APPROVED", "PARTIALLY_PAID", "PAID"].includes(selected.status) && (
                <Button variant="outline" disabled={busy} onClick={() => void run(async () => { const issued = await issuePayslips(selected.id); onNotice(`${issued.length} payslips issued`); }, "", () => void refreshSelected(selected.id))}>Issue payslips</Button>
              )}
              {can("remuneration.approve") && (selected.status === "OPEN" || selected.status === "PROCESSING") && (
                <Button variant="outline" disabled={busy} onClick={() => void run(async () => { await approvePeriod(selected.id); }, "Period approved", () => void refreshSelected(selected.id))}>Approve</Button>
              )}
              {can("remuneration.record_payment") && ["APPROVED", "PARTIALLY_PAID"].includes(selected.status) && (
                <Button variant="outline" disabled={busy} onClick={() => { if (guard()) setPayOpen(true); }}>Record payment</Button>
              )}
              {can("remuneration.close_period") && selected.status !== "CLOSED" && (
                <Button variant="destructive" disabled={busy} onClick={() => {
                  if (!guard()) return;
                  if (!window.confirm("Close this period? Totals and lines freeze permanently — later corrections become new adjustment lines.")) return;
                  void run(async () => { await closePeriod(selected.id); }, "Period closed", () => void refreshSelected(selected.id));
                }}>Close period</Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={newOpen} onOpenChange={(v) => setNewOpen(v)}>
        <DialogContent>
          <DialogTitle>New salary period</DialogTitle>
          <DialogDescription>Opens an OPEN period — calculate, review, approve, pay, then close.</DialogDescription>
          <div className="space-y-3">
            <div><Label htmlFor="np-label">Label</Label><Input id="np-label" placeholder="e.g. October 2026 · 1st half" value={npForm.label} onChange={(e) => setNpForm({ ...npForm, label: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label htmlFor="np-type">Type</Label>
                <select id="np-type" className="filter-select" value={npForm.periodType} onChange={(e) => setNpForm({ ...npForm, periodType: e.target.value as PeriodType })}>
                  {(["weekly", "biweekly", "monthly", "quarterly", "custom"] as PeriodType[]).map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div><Label htmlFor="np-start">Start</Label><Input id="np-start" type="date" value={npForm.startDate} onChange={(e) => setNpForm({ ...npForm, startDate: e.target.value })} /></div>
              <div><Label htmlFor="np-end">End</Label><Input id="np-end" type="date" value={npForm.endDate} onChange={(e) => setNpForm({ ...npForm, endDate: e.target.value })} /></div>
            </div>
            <div><Label htmlFor="np-pay">Intended payment date</Label><Input id="np-pay" type="date" value={npForm.intendedPaymentDate} onChange={(e) => setNpForm({ ...npForm, intendedPaymentDate: e.target.value })} /></div>
          </div>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button disabled={busy || !npForm.label.trim() || !npForm.startDate || !npForm.endDate} onClick={() => void submitNewPeriod()}>Create period</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={(v) => setPayOpen(v)}>
        <DialogContent>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>{selected ? `${selected.label || selected.id} · funds are recorded first, then marked paid` : ""}</DialogDescription>
          <div className="space-y-3">
            <div><Label htmlFor="rp-staff">Team member</Label>
              <select id="rp-staff" className="filter-select" value={payForm.staffId} onChange={(e) => setPayForm({ ...payForm, staffId: e.target.value })}>
                <option value="">Choose…</option>
                {(selected?.items ?? []).map((i) => <option key={i.staffId} value={i.staffId}>{i.staffName || i.staffId} · net {money(i.netAmount)}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="rp-amount">Amount (UGX)</Label><Input id="rp-amount" inputMode="numeric" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
              <div><Label htmlFor="rp-date">Payment date</Label><Input id="rp-date" type="date" value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })} /></div>
              <div><Label htmlFor="rp-method">Method</Label>
                <select id="rp-method" className="filter-select" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                  {(["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "OTHER"] as const).map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                </select>
              </div>
              <div><Label htmlFor="rp-ref">Reference</Label><Input id="rp-ref" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></div>
            </div>
          </div>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button disabled={busy || !payForm.staffId || !(Number(payForm.amount) > 0)} onClick={() => void submitPayment()}>Record payment</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={adjOpen} onOpenChange={(v) => setAdjOpen(v)}>
        <DialogContent>
          <DialogTitle>Add adjustment line</DialogTitle>
          <DialogDescription>Additive correction — approved and closed periods stay reconstructable (§18.7).</DialogDescription>
          <div className="space-y-3">
            <div><Label htmlFor="ad-staff">Team member</Label>
              <select id="ad-staff" className="filter-select" value={adjForm.staffId} onChange={(e) => setAdjForm({ ...adjForm, staffId: e.target.value })}>
                <option value="">Choose…</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.staffNumber}</option>)}
              </select>
            </div>
            <div><Label htmlFor="ad-amount">Other payments (UGX)</Label><Input id="ad-amount" inputMode="numeric" value={adjForm.otherPayments} onChange={(e) => setAdjForm({ ...adjForm, otherPayments: e.target.value })} /></div>
            <div><Label htmlFor="ad-notes">Reason / notes</Label><Input id="ad-notes" value={adjForm.notes} onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })} /></div>
          </div>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setAdjOpen(false)}>Cancel</Button>
            <Button disabled={busy || !adjForm.staffId || !(Number(adjForm.otherPayments) > 0)} onClick={() => void submitAdjustment()}>Add adjustment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ── Advances tab (§18.6 — original amounts immutable, recoveries append) ─ */

function AdvancesTab(props: {
  search: string;
  can: (perm: string) => boolean;
  connected: boolean;
  onNotice: (m: string) => void;
  onSignIn: () => void;
}) {
  const { search, can, connected, onNotice, onSignIn } = props;
  const { density } = useDensity();
  const [rows, setRows] = useState<ServerAdvance[]>([]);
  const [staff, setStaff] = useState<ServerStaff[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [repaying, setRepaying] = useState<ServerAdvance | null>(null);
  const [form, setForm] = useState({ staffId: "", amount: "", reason: "", advanceDate: new Date().toISOString().slice(0, 10) });
  const [repay, setRepay] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), method: "CASH" });

  const reload = useCallback(() => {
    void listAdvances().then(setRows);
    void listStaff().then(setStaff);
  }, []);
  useEffect(reload, [reload]);

  const guard = () => { if (!connected) { onSignIn(); return false; } return true; };

  const submitNew = async () => {
    if (!guard()) return;
    setBusy(true);
    try {
      await createAdvance({ staffId: form.staffId, amount: Number(form.amount) || 0, reason: form.reason, advanceDate: form.advanceDate });
      onNotice("Advance recorded");
      setOpen(false);
      setForm({ staffId: "", amount: "", reason: "", advanceDate: new Date().toISOString().slice(0, 10) });
      reload();
    } catch (err) {
      onNotice(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const submitRepay = async () => {
    if (!repaying || !guard()) return;
    setBusy(true);
    try {
      const updated = await recordAdvanceRepayment(repaying.id, { amount: Number(repay.amount) || 0, date: repay.date, method: repay.method });
      onNotice(`Repayment recorded — outstanding ${money(updated.outstanding)}`);
      setRepaying(null);
      reload();
    } catch (err) {
      onNotice(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = q ? rows.filter((a) => `${a.staffName ?? ""} ${a.reason}`.toLowerCase().includes(q)) : rows;

  const columns: Column<ServerAdvance>[] = [
    { header: "Team member", cell: (a) => <><strong className="product-name">{a.staffName || a.staffId}</strong><small className="cell-sub">{fmtDate(a.advanceDate)} · {a.reason || "no reason"}</small></> },
    { header: "Original", align: "right", cell: (a) => <span className="amount-cell">{money(a.amount)}</span> },
    { header: "Repaid", align: "right", cell: (a) => <span className="amount-cell">{money(a.repaidAmount)}</span> },
    { header: "Outstanding", align: "right", cell: (a) => <span className="amount-cell">{money(a.outstanding)}</span> },
    { header: "Status", cell: (a) => <Status value={a.status.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} /> },
    { header: "", cell: (a) => can("remuneration.record_payment") && a.outstanding > 0 ? <Button variant="outline" size="sm" disabled={busy} onClick={(e) => { e.stopPropagation(); if (!guard()) return; setRepay({ amount: "", date: new Date().toISOString().slice(0, 10), method: "CASH" }); setRepaying(a); }}>Record repayment</Button> : null },
  ];

  const outstandingTotal = Math.round(rows.reduce((n, a) => n + a.outstanding, 0) * 100) / 100;

  return (
    <section className="panel module-table">
      <div className="panel-heading">
        <h2>Staff advances <span className="inline-count">{filtered.length}</span></h2>
        <span className="text-muted-foreground text-xs">Originals never change — repayments append, balance clears at zero</span>
      </div>
      <div className="table-controls">
        <span className="cell-sub">Outstanding across all advances: <strong>{money(outstandingTotal)}</strong></span>
        {can("remuneration.create") && <Button variant="outline" onClick={() => { if (guard()) setOpen(true); }}><Plus size={16} /> New advance</Button>}
      </div>
      <DataTable
        columns={columns} rows={filtered} rowKey={(a) => a.id} stickyHeader density={density}
        empty={<div className="empty-state"><Search /><h3>No advances recorded</h3><p>Record a salary advance here; recoveries are appended against the original amount.</p></div>}
      />
      <div className="table-foot"><span>{filtered.length} advances</span><span>{rows.filter((a) => a.status === "SETTLED").length} settled</span></div>

      <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
        <DialogContent>
          <DialogTitle>New advance</DialogTitle>
          <DialogDescription>The amount stays immutable — recoveries are recorded separately.</DialogDescription>
          <div className="space-y-3">
            <div><Label htmlFor="av-staff">Team member</Label>
              <select id="av-staff" className="filter-select" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
                <option value="">Choose…</option>
                {staff.filter((s) => s.employmentStatus !== "TERMINATED").map((s) => <option key={s.id} value={s.id}>{s.name} · {s.staffNumber}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="av-amount">Amount (UGX)</Label><Input id="av-amount" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label htmlFor="av-date">Date</Label><Input id="av-date" type="date" value={form.advanceDate} onChange={(e) => setForm({ ...form, advanceDate: e.target.value })} /></div>
            </div>
            <div><Label htmlFor="av-reason">Reason</Label><Input id="av-reason" placeholder="e.g. School fees advance" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || !form.staffId || !(Number(form.amount) > 0)} onClick={() => void submitNew()}>Record advance</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={repaying !== null} onOpenChange={(v) => { if (!v) setRepaying(null); }}>
        <DialogContent>
          <DialogTitle>Record repayment</DialogTitle>
          <DialogDescription>{repaying ? `${repaying.staffName || repaying.staffId} · outstanding ${money(repaying.outstanding)} of ${money(repaying.amount)}` : ""}</DialogDescription>
          <div className="grid grid-cols-3 gap-3">
            <div><Label htmlFor="rp2-amount">Amount (UGX)</Label><Input id="rp2-amount" inputMode="numeric" value={repay.amount} onChange={(e) => setRepay({ ...repay, amount: e.target.value })} /></div>
            <div><Label htmlFor="rp2-date">Date</Label><Input id="rp2-date" type="date" value={repay.date} onChange={(e) => setRepay({ ...repay, date: e.target.value })} /></div>
            <div><Label htmlFor="rp2-method">Method</Label>
              <select id="rp2-method" className="filter-select" value={repay.method} onChange={(e) => setRepay({ ...repay, method: e.target.value })}>
                {(["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "OTHER"] as const).map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setRepaying(null)}>Cancel</Button>
            <Button disabled={busy || !(Number(repay.amount) > 0)} onClick={() => void submitRepay()}>Record repayment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ── Payslips tab (§18.8 — frozen printable snapshots) ────────────────── */

function PayslipsTab(props: {
  can: (perm: string) => boolean;
  connected: boolean;
  onNotice: (m: string) => void;
  onSignIn: () => void;
}) {
  const { can, connected, onNotice, onSignIn } = props;
  const { density } = useDensity();
  const [slips, setSlips] = useState<ServerPayslip[]>([]);
  const [periods, setPeriods] = useState<ServerPeriod[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<ServerPayslip | null>(null);

  const reload = useCallback(() => {
    void listPayslips(periodId ? { periodId } : undefined).then(setSlips);
    void listPeriods().then(setPeriods);
  }, [periodId]);
  useEffect(reload, [reload]);

  const guard = () => { if (!connected) { onSignIn(); return false; } return true; };

  const generate = async () => {
    if (!periodId) { onNotice("Pick a period first"); return; }
    if (!guard()) return;
    setBusy(true);
    try {
      const issued = await issuePayslips(periodId);
      onNotice(`${issued.length} payslips ready (reissuing never clones existing snapshots)`);
      reload();
    } catch (err) {
      onNotice(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const openSlip = async (s: ServerPayslip) => {
    if (!guard()) return;
    const doc = await getPayslip(s.id);
    if (!doc) { onNotice("Opening a payslip needs the payslip.print permission"); return; }
    setViewing(doc);
  };

  const columns: Column<ServerPayslip>[] = [
    { header: "Team member", cell: (s) => <><strong className="product-name">{s.staffName || s.staffId}</strong><small className="cell-sub">{s.periodLabel}</small></> },
    { header: "Basic", align: "right", cell: (s) => <span className="amount-cell">{money(s.basicSalary)}</span> },
    { header: "Allowances", align: "right", cell: (s) => <span className="amount-cell">{money(s.allowances)}</span> },
    { header: "Deductions", align: "right", cell: (s) => <span className="amount-cell">{money(s.deductions)}</span> },
    { header: "Net", align: "right", cell: (s) => <span className="amount-cell"><strong>{money(s.netAmount)}</strong></span> },
    { header: "Issued", cell: (s) => fmtDate(s.issuedAt) },
    { header: "", cell: (s) => <Button variant="outline" size="sm" disabled={busy} onClick={(e) => { e.stopPropagation(); void openSlip(s); }}>Open</Button> },
  ];

  return (
    <section className="panel module-table">
      <div className="panel-heading">
        <h2>Payslips <span className="inline-count">{slips.length}</span></h2>
        <span className="text-muted-foreground text-xs">Figures frozen at issue — later profile changes never rewrite a payslip</span>
      </div>
      <div className="table-controls">
        <label className="filter-select">
          <span className="cell-sub">Period</span>
          <select aria-label="Filter payslips by period" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">All periods</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.label || `${p.startDate} → ${p.endDate}`}</option>)}
          </select>
        </label>
        {can("remuneration.process") && (
          <Button variant="outline" disabled={busy || !periodId} onClick={() => void generate()}>Generate for period</Button>
        )}
      </div>
      <DataTable
        columns={columns} rows={slips} rowKey={(s) => s.id} onRowActivate={(s) => void openSlip(s)}
        stickyHeader density={density}
        empty={<div className="empty-state"><Search /><h3>No payslips yet</h3><p>Pick an approved period and generate its payslips — snapshots stay idempotent.</p></div>}
      />
      <div className="table-foot"><span>{slips.length} payslips</span><span>{periods.length} periods available</span></div>

      <Dialog open={viewing !== null} onOpenChange={(v) => { if (!v) setViewing(null); }}>
        <DialogContent className="order-detail-dialog">
          <DialogTitle>Payslip · {viewing?.staffName || ""}</DialogTitle>
          <DialogDescription>{viewing?.periodLabel} · issued {fmtDate(viewing?.issuedAt ?? null)}</DialogDescription>
          {viewing && (
            <div className="configuration-list">
              <p><span>Basic salary</span><strong>{money(viewing.basicSalary)}</strong></p>
              <p><span>Allowances</span><strong>{money(viewing.allowances)}</strong></p>
              <p><span>Bonuses</span><strong>{money(viewing.bonuses)}</strong></p>
              <p><span>Deductions</span><strong>−{money(viewing.deductions)}</strong></p>
              <p><span>Advance recovery</span><strong>−{money(viewing.advanceAmount)}</strong></p>
              <p><span>Other payments</span><strong>{money(viewing.otherPayments)}</strong></p>
              <p><span>Net pay</span><strong>{money(viewing.netAmount)}</strong></p>
              <p><span>Paid to date</span><strong>{money(viewing.paidAmount)}</strong></p>
            </div>
          )}
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setViewing(null)}>Close</Button>
            <Button onClick={() => window.print()}>Print</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ── Module entry (wired into workspace.tsx) ──────────────────────────── */

export function Staff(props: {
  tab: string;
  search: string;
  setSearch: (v: string) => void;
  onNotice: (m: string) => void;
  onSignIn: () => void;
}) {
  const { tab, search, setSearch, onNotice, onSignIn } = props;
  const { connected, permissions } = useWorkspace();
  // Preview mode (permissions === null) shows every affordance like the other
  // module views; signed-in sessions gate on the real granted permission set.
  const can = useCallback((perm: string) => permissions === null || permissions.includes(perm), [permissions]);

  if (permissions !== null && !permissions.includes("staff.view")) {
    return (
      <section className="panel module-table">
        <Locked title="Staff access required" note="Your role does not include staff.view, so the team directory stays hidden. Ask an Admin to grant it." />
      </section>
    );
  }

  const common = { can, connected, onNotice, onSignIn };
  if (tab === "Attendance") return <AttendanceTab search={search} {...common} />;
  if (tab === "Salary periods") {
    return can("remuneration.view")
      ? <SalaryTab {...common} />
      : <section className="panel module-table"><Locked title="Salary access required" note="Viewing pay figures needs remuneration.view — salary stays confidential to Admin (and any delegated role)." /></section>;
  }
  if (tab === "Advances") {
    return can("remuneration.view")
      ? <AdvancesTab search={search} {...common} />
      : <section className="panel module-table"><Locked title="Salary access required" note="Advances are remuneration data — your role needs remuneration.view to see them." /></section>;
  }
  if (tab === "Payslips") {
    return can("remuneration.view")
      ? <PayslipsTab {...common} />
      : <section className="panel module-table"><Locked title="Salary access required" note="Payslips are confidential — your role needs remuneration.view (opening one additionally needs payslip.print)." /></section>;
  }
  return <TeamTab search={search} setSearch={setSearch} {...common} />;
}
