ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS preferred_status VARCHAR(20) NULL DEFAULT 'none';
ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS elimination_note TEXT NULL;
ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS familiarity_score INT NULL;
ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS familiarity_date VARCHAR(10) NULL;
