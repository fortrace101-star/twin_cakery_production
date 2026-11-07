-- Twin Cakery ERP — 017 staff management & salary/remuneration (Postgres 16+)
--
-- E7 (governing architecture doc §§18.1–18.8, §21 permission list, §40 rules
-- 30–34): lightweight staff module + confidential Admin-only remuneration.
-- Until now none of it existed: no staff tables, no salary permissions, no
-- routes. Phase D reserved the name 009 for content, so this lands as 017.
--
-- Design notes (spec-driven):
--   §18.3 periods are ADMIN-DEFINED — weekly|biweekly|monthly|quarterly|custom,
--        no assumed monthly cycle; each period carries its own intended
--        payment date which may differ from the period range.
--   §18.4/18.7 status machine OPEN → PROCESSING → APPROVED → PARTIALLY_PAID →
--        PAID → CLOSED. Once CLOSED nothing is rewritten — corrections must be
--        new records (enforced in store.ts, not just by convention).
--   §18.6 staff advances keep the ORIGINAL amount immutable; recoveries append
--        to a repayment log + repaid_amount — the outstanding balance is
--        derived, never silently overwritten.
--   §18.2 salary data (salary_profiles + every figure in here) is read through
--        remuneration.* permissions only — staff.view is not enough.
--
-- Permissions follow the §21 key list verbatim (+ payslip.print from plan
-- §6.2) and are granted to role-admin only ("Default Admin view only; other
-- roles see nothing unless granted"). Safe to re-run (all inserts CONFLICT
-- no-op; role grant is guarded so a pre-seed fresh DB skips it and the seed
-- grants instead).
--
-- Purely additive: 8 tables + indexes + permission rows.

-- ---------------------------------------------------------------------------
-- Staff identity (§18.1): ID, name, contact, role, employment status, start
-- date, schedule/work pattern, notes. Deliberately NOT an HR suite. user_id is
-- an OPTIONAL link — most staff never get an ERP login. No hard delete: salary
-- history must stay reconstructable, so "leaving" is employment_status.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  staff_number TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  employment_status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (employment_status IN ('ACTIVE','PROBATION','ON_LEAVE','INACTIVE','TERMINATED')),
  start_date DATE,
  schedule TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(employment_status);

-- ---------------------------------------------------------------------------
-- Attendance (§18.1): one row per staff per date (store enforces the upsert —
-- no second UNIQUE beyond PKs, mirroring the 016 decision: a surprise unique
-- violation would roll back the whole cache write-back transaction).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_attendance (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PRESENT'
    CHECK (status IN ('PRESENT','ABSENT','HALF_DAY','LEAVE','SICK','LATE')),
  hours NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  recorded_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff ON staff_attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(date);

-- ---------------------------------------------------------------------------
-- Payment periods (§18.3): admin-defined ranges. status drives the §18.4
-- workflow; approved_by/approved_at/closed_at record who did what.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS remuneration_periods (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  period_type TEXT NOT NULL DEFAULT 'monthly'
    CHECK (period_type IN ('weekly','biweekly','monthly','quarterly','custom')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  intended_payment_date DATE,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','PROCESSING','APPROVED','PARTIALLY_PAID','PAID','CLOSED')),
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_remuneration_periods_status ON remuneration_periods(status);

-- ---------------------------------------------------------------------------
-- Remuneration items (§18.4): one selected staff line inside a period with the
-- calculation breakdown. net = basic + allowances + bonuses − deductions −
-- advance + other. Adjustments BEFORE approval edit the line; after approval
-- they become NEW lines (never silent rewrites).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS remuneration_items (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES remuneration_periods(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  basic_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(14,2) NOT NULL DEFAULT 0,
  bonuses NUMERIC(14,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  advance_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_payments NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','PAID','PARTIALLY_PAID','ADJUSTED')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_remuneration_items_period ON remuneration_items(period_id);
CREATE INDEX IF NOT EXISTS idx_remuneration_items_staff ON remuneration_items(staff_id);

-- ---------------------------------------------------------------------------
-- Salary profile (§18.2): the recurring baseline behind "calculate salary".
-- Figures here are CONFIDENTIAL — routes read them behind remuneration.view.
-- payment_frequency mirrors period_type vocabulary but stays advisory: the
-- Admin still defines each concrete period (§18.3 — never assume monthly).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salary_profiles (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  basic_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_frequency TEXT NOT NULL DEFAULT 'monthly'
    CHECK (payment_frequency IN ('weekly','biweekly','monthly','quarterly','custom')),
  allowance_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  deduction_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  effective_from DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_salary_profiles_staff ON salary_profiles(staff_id);

-- ---------------------------------------------------------------------------
-- Staff advances (§18.6): the ORIGINAL amount is immutable. Repayments append
-- to repayment_log (JSONB) and bump repaid_amount; outstanding is always
-- amount − repaid_amount. Balances are never silently overwritten.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_advances (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  repaid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  advance_date DATE,
  status TEXT NOT NULL DEFAULT 'OUTSTANDING'
    CHECK (status IN ('OUTSTANDING','SETTLED')),
  repayment_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  recorded_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_advances_staff ON staff_advances(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_advances_status ON staff_advances(status);

-- ---------------------------------------------------------------------------
-- Payments (§18.7): actual money movement — staff, amount, date, method,
-- reference, status, recorder, notes. Period rollups derive from these; closed
-- periods keep every row exactly as recorded.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS remuneration_payments (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES remuneration_periods(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES remuneration_items(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL,
  method TEXT NOT NULL DEFAULT 'CASH'
    CHECK (method IN ('CASH','MOBILE_MONEY','BANK_TRANSFER','OTHER')),
  reference TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (payment_status IN ('RECORDED','PENDING','PAID','CANCELLED')),
  notes TEXT NOT NULL DEFAULT '',
  recorded_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_remuneration_payments_period ON remuneration_payments(period_id);
CREATE INDEX IF NOT EXISTS idx_remuneration_payments_staff ON remuneration_payments(staff_id);

-- ---------------------------------------------------------------------------
-- Payslips (§18.8): generated snapshots — printable documents that inherit
-- Admin-only authorization. Figures are frozen at generation time so a later
-- profile change can never rewrite an issued payslip.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payslips (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES remuneration_periods(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES remuneration_items(id) ON DELETE SET NULL,
  period_label TEXT NOT NULL DEFAULT '',
  staff_name TEXT NOT NULL DEFAULT '',
  basic_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(14,2) NOT NULL DEFAULT 0,
  bonuses NUMERIC(14,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  advance_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_payments NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ,
  issued_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payslips_period ON payslips(period_id);
CREATE INDEX IF NOT EXISTS idx_payslips_staff ON payslips(staff_id);

-- ---------------------------------------------------------------------------
-- Permissions (§21 key list verbatim + payslip.print per plan §6.2).
-- Granted to role-admin ONLY — salary/remuneration is Admin/Proprietor-only
-- by default (§18.2, "Default Admin view only; other roles see nothing unless
-- granted"). Production gets staff.view alone (staff identity for scheduling —
-- never a remuneration key). The role grant runs only when the roles exist, so
-- a fresh un-seeded DB skips it here and seed.ts grants on first run instead.
-- Safe to re-run (all inserts CONFLICT no-ops).
-- ---------------------------------------------------------------------------
INSERT INTO permissions (id, key) VALUES
  ('perm-staff-view','staff.view'),
  ('perm-staff-manage','staff.manage'),
  ('perm-staff-attendance','staff.attendance'),
  ('perm-remuneration-view','remuneration.view'),
  ('perm-remuneration-create','remuneration.create'),
  ('perm-remuneration-edit','remuneration.edit'),
  ('perm-remuneration-approve','remuneration.approve'),
  ('perm-remuneration-process','remuneration.process'),
  ('perm-remuneration-record-payment','remuneration.record_payment'),
  ('perm-remuneration-close-period','remuneration.close_period'),
  ('perm-remuneration-view-reports','remuneration.view_reports'),
  ('perm-payslip-print','payslip.print')
ON CONFLICT (key) DO NOTHING;

-- Admin / Proprietor owns the whole module (incl. every salary figure).
-- The WHERE EXISTS guard skips this on a fresh un-seeded DB (roles empty);
-- seed.ts grants on first run instead. ON CONFLICT keeps re-runs no-ops.
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-admin-' || p.id, 'role-admin', p.id
FROM permissions p
WHERE p.key IN (
  'staff.view','staff.manage','staff.attendance',
  'remuneration.view','remuneration.create','remuneration.edit',
  'remuneration.approve','remuneration.process','remuneration.record_payment',
  'remuneration.close_period','remuneration.view_reports','payslip.print'
)
AND EXISTS (SELECT 1 FROM roles WHERE id = 'role-admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Production sees staff identity only (§18.1 roles stay RBAC-controlled) —
-- never remuneration.* (§18.2 confidential).
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-prod-' || p.id, 'role-production', p.id
FROM permissions p
WHERE p.key IN ('staff.view')
AND EXISTS (SELECT 1 FROM roles WHERE id = 'role-production')
ON CONFLICT (role_id, permission_id) DO NOTHING;


