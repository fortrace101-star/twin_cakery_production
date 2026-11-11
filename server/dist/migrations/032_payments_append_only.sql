-- 032_payments_append_only.sql
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'PAYMENT',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN IF NOT EXISTS reverses_payment_id TEXT REFERENCES payments(id),
  ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_ref TEXT,
  ADD COLUMN IF NOT EXISTS delivery_id TEXT,
  ADD COLUMN IF NOT EXISTS collected_by TEXT,
  ADD COLUMN IF NOT EXISTS cash_handover_id TEXT,
  ADD COLUMN IF NOT EXISTS invoice_id TEXT;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_kind_chk;
ALTER TABLE payments ADD CONSTRAINT payments_kind_chk CHECK (kind IN ('PAYMENT','REFUND','REVERSAL'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_chk;
ALTER TABLE payments ADD CONSTRAINT payments_status_chk CHECK (status IN ('PENDING','CONFIRMED','FAILED'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_idem ON payments (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_ref ON payments (method, reference) WHERE reference <> '' AND status <> 'FAILED' AND kind = 'PAYMENT';

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_sign_chk;
ALTER TABLE payments ADD CONSTRAINT payments_sign_chk CHECK (
  (kind = 'PAYMENT' AND amount > 0) OR (kind IN ('REFUND','REVERSAL') AND amount < 0)
);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_whole_ugx;
ALTER TABLE payments ADD CONSTRAINT payments_whole_ugx CHECK (amount = round(amount)) NOT VALID;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_chk;
ALTER TABLE payments ADD CONSTRAINT payments_method_chk CHECK (method IN ('Cash','MTN MoMo','Airtel Money','Bank Transfer','M-Pesa','Card','Other')) NOT VALID;

CREATE OR REPLACE FUNCTION payments_append_only() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payments is append-only';
  END IF;
  IF TG_OP = 'UPDATE' AND (
       OLD.amount <> NEW.amount OR
       OLD.order_id <> NEW.order_id OR
       OLD.kind <> NEW.kind OR
       OLD.method <> NEW.method OR
       OLD.reference <> NEW.reference
     ) THEN
    RAISE EXCEPTION 'payment financial fields are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payments_append_only ON payments;
CREATE TRIGGER trg_payments_append_only
  BEFORE UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE PROCEDURE payments_append_only();
