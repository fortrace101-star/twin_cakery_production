-- Twin Cakery ERP — 018 activation codes (Phase B)
-- Makes password_hash nullable and adds activation_codes table for
-- admin bootstrap codes and staff reset codes.

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS activation_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,           -- sha256 hex of the plaintext code
  type TEXT NOT NULL,           -- 'admin' | 'reset' | 'register'
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_activation_codes_user ON activation_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_activation_codes_type ON activation_codes(type);