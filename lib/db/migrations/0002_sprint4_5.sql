-- Sprint 4: Booking record enhancement
ALTER TABLE `trip_items`
  ADD COLUMN `cancellation_free_until` DATE NULL,
  ADD COLUMN `visa_required` TINYINT(1) NOT NULL DEFAULT 0;

-- Sprint 5: Exchange rate lock
ALTER TABLE `trips`
  ADD COLUMN `fx_date` VARCHAR(10) NULL,
  ADD COLUMN `fx_source` VARCHAR(50) NULL,
  ADD COLUMN `fx_buffer_pct` FLOAT NULL,
  ADD COLUMN `fx_usd_to_inr` FLOAT NULL;
