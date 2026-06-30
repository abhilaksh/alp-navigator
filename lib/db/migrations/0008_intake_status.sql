ALTER TABLE `trips` ADD COLUMN IF NOT EXISTS `intake_status` varchar(30) DEFAULT 'new_inquiry';
ALTER TABLE `trips` ADD COLUMN IF NOT EXISTS `acknowledged_at` bigint DEFAULT NULL;
ALTER TABLE `trips` ADD COLUMN IF NOT EXISTS `brief_complete_at` bigint DEFAULT NULL;
