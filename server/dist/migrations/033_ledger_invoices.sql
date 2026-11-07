-- 033_ledger_invoices.sql
CREATE TABLE IF NOT EXISTS accounts (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ASSET','LIABILITY','EQUITY','REVENUE','COGS','EXPENSE')),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO accounts (code,name,type) VALUES
 ('1010','Cash on hand','ASSET'), ('1015','Cash with drivers','ASSET'), ('1020','Mobile money','ASSET'), ('1030','Bank','ASSET'),
 ('1100','Accounts receivable','ASSET'), ('1200','Inventory','ASSET'),
 ('2010','Customer deposits','LIABILITY'), ('2100','Accounts payable','LIABILITY'),
 ('2110','Goods received not invoiced','LIABILITY'), ('2200','VAT payable','LIABILITY'), ('2300','Wages payable','LIABILITY'),
 ('3000','Owner equity','EQUITY'),
 ('4000','Sales revenue','REVENUE'), ('4100','Delivery income','REVENUE'), ('4900','Forfeited deposits','REVENUE'),
 ('5000','COGS ingredients','COGS'), ('5010','COGS packaging','COGS'), ('5020','COGS labour','COGS'), ('5030','COGS overhead','COGS'),
 ('5100','Wastage expense','EXPENSE'), ('5110','Inventory shrinkage','EXPENSE'), ('6000','Operating expenses','EXPENSE'),
 ('6100','Payroll expense','EXPENSE'), ('6900','Cash over/short','EXPENSE')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS accounting_periods (
  period TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  closed_by TEXT,
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id BIGSERIAL PRIMARY KEY,
  entry_date DATE NOT NULL,
  period TEXT NOT NULL REFERENCES accounting_periods(period),
  source_event_id BIGINT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  reverses_entry_id BIGINT REFERENCES journal_entries(id),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  backfilled BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (source_type, source_id, memo)
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES journal_entries(id),
  account_code TEXT NOT NULL REFERENCES accounts(code),
  debit NUMERIC(14,0) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(14,0) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  order_id TEXT,
  customer_id TEXT,
  job_id TEXT,
  supplier_id TEXT,
  CHECK ((debit = 0) <> (credit = 0))
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines (account_code, entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_order ON journal_lines (order_id);

CREATE OR REPLACE FUNCTION journal_guard() RETURNS TRIGGER AS $$
DECLARE st TEXT;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'journal is immutable; post a reversing entry';
  END IF;
  SELECT status INTO st FROM accounting_periods WHERE period = NEW.period;
  IF st = 'CLOSED' THEN
    RAISE EXCEPTION 'period % is closed', NEW.period;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_je_guard ON journal_entries;
CREATE TRIGGER trg_je_guard
  BEFORE INSERT OR UPDATE OR DELETE ON journal_entries
  FOR EACH ROW
  EXECUTE PROCEDURE journal_guard();

DROP TRIGGER IF EXISTS trg_jl_guard ON journal_lines;
CREATE TRIGGER trg_jl_guard
  BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW
  EXECUTE PROCEDURE journal_guard();

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_no TEXT UNIQUE,
  order_id TEXT NOT NULL REFERENCES orders(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ISSUED','PART_PAID','PAID','VOID')),
  issue_date DATE,
  due_date DATE,
  currency TEXT NOT NULL DEFAULT 'UGX',
  subtotal NUMERIC(14,0) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,0) NOT NULL DEFAULT 0,
  delivery_charge NUMERIC(14,0) NOT NULL DEFAULT 0,
  discount NUMERIC(14,0) NOT NULL DEFAULT 0,
  total NUMERIC(14,0) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id BIGSERIAL PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(14,0) NOT NULL,
  total NUMERIC(14,0) NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_notes (
  id TEXT PRIMARY KEY,
  credit_no TEXT UNIQUE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount NUMERIC(14,0) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  approved_by TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id BIGSERIAL PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount NUMERIC(14,0) NOT NULL
);

CREATE TABLE IF NOT EXISTS document_counters (
  kind TEXT,
  year INT,
  last_no INT NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, year)
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload JSONB,
  requested_by TEXT,
  decided_by TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cash_handovers (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL,
  expected NUMERIC(14,0) NOT NULL,
  counted NUMERIC(14,0) NOT NULL,
  confirmed_by TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

CREATE TABLE IF NOT EXISTS provider_statement_lines (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_ref TEXT NOT NULL,
  amount NUMERIC(14,0) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  payment_id TEXT REFERENCES payments(id),
  match_status TEXT NOT NULL DEFAULT 'UNMATCHED',
  UNIQUE (provider, provider_ref)
);
