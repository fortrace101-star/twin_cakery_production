-- Twin Cakery ERP — 007 restore actual delivery date on deliveries
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS actual_delivery_date TIMESTAMPTZ;
