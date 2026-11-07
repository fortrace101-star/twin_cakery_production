-- 021: persist the delivery location captured on the New-order form.
-- The ERP keeps a per-order delivery location + landmark note (entered in
-- src/components/erp/dialogs.tsx) but it only lived in the client session —
-- add the columns so it survives refreshes and shows on the Deliveries
-- Upcoming/Dispatch tables (Destination column).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_location TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_note TEXT NOT NULL DEFAULT '';
