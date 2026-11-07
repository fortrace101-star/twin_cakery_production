-- Twin Cakery ERP — 020 production fixed operational cost categories/entries (Postgres 16+)
-- Fixed operational costs are indirect/overhead production costs not tracked as inventory consumables.

CREATE TABLE IF NOT EXISTS production_fixed_cost_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cost_type TEXT NOT NULL DEFAULT 'perJob',
  unit TEXT NOT NULL DEFAULT '',
  default_unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_fixed_cost_entries (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES production_fixed_cost_categories(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT '',
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  recorded_by TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fixed_cost_entries_job ON production_fixed_cost_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_fixed_cost_entries_category ON production_fixed_cost_entries(category_id);
