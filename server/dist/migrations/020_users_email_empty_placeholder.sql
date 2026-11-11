-- 020: allow the empty-email placeholder on users.
--
-- users.email is UNIQUE NOT NULL (001_core.sql), but both signup paths default
-- a missing email to '' (POST /auth/register and POST /auth/claim-admin). The
-- first signup therefore claims the empty string, and every later signup
-- without an email fails with 500 duplicate key "users_email_key".
--
-- Keep real addresses unique; let the empty placeholder repeat. Partial index
-- covers only non-empty values, so duplicate real emails still fail — but as a
-- named index violation rather than a table constraint.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (email)
  WHERE email <> '';
