-- Twin Cakery ERP - 010 inventory unit cost (E3)
-- Goods receipt updates the item's current cost (spec section 11 'cost history' /
-- section 12 supplier cost analysis). The DTO/frontend field is 'cost'.

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS cost NUMERIC(14,2) NOT NULL DEFAULT 0;
