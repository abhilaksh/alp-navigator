ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS commission_pct FLOAT NULL;
ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS commission_amount_inr INT NULL;
ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS commission_paid_at VARCHAR(10) NULL;
