-- 011: post-delivery customer follow-up (CRM).
-- An order that reaches COMPLETED_DELIVERED raises a follow-up request for the
-- admin; it stays "pending" (badge on Customers & CRM, notification in the bell)
-- until staff document the follow-up, which stamps follow_up_completed_at.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS follow_up_completed_at TIMESTAMPTZ;