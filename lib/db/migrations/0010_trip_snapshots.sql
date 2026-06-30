CREATE TABLE IF NOT EXISTS `trip_snapshots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `trip_id` int NOT NULL,
  `version` int NOT NULL DEFAULT 1,
  `label` varchar(100) DEFAULT NULL,
  `snapshot_json` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `trip_snapshots_trip_id_fk` FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON DELETE CASCADE
);
