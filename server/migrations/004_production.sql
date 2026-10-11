-- Twin Cakery ERP — 004 production jobs + costs (Postgres 16+)

CREATE TABLE IF NOT EXISTS production_jobs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL,
  variant_options TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(14,3) NOT NULL,
  recipe_version TEXT NOT NULL DEFAULT 'v1.0',
  required_by TEXT,
  required_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING',
  stage TEXT NOT NULL DEFAULT 'PLAN',
  progress INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_production_jobs_order ON production_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_production_jobs_status ON production_jobs(status);

CREATE TABLE IF NOT EXISTS production_steps (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_consumption (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL,
  unit TEXT NOT NULL,
  recipe_version TEXT NOT NULL DEFAULT 'v1.0',
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_costs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  ingredient_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  packaging_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  labour_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  overhead_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_wastage (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL,
  unit TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  recorded_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quality_checks (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  result TEXT NOT NULL,
  checked_by TEXT NOT NULL DEFAULT '',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issues TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  rework_required BOOLEAN NOT NULL DEFAULT FALSE,
  rework_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  wastage_caused NUMERIC(14,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
