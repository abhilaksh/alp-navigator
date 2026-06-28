-- Alp Navigator MySQL schema
-- Generated from lib/db/schema.ts

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100),
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` TEXT NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'member',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS `teams` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `razorpay_customer_id` TEXT,
  `razorpay_subscription_id` TEXT,
  `razorpay_plan_id` TEXT,
  `plan_name` VARCHAR(50),
  `subscription_status` VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS `team_members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `team_id` INT NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `joined_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`)
);

CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `team_id` INT NOT NULL,
  `user_id` INT,
  `action` TEXT NOT NULL,
  `timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` VARCHAR(45),
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);

CREATE TABLE IF NOT EXISTS `invitations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `team_id` INT NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `invited_by` INT NOT NULL,
  `invited_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`),
  FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`)
);

CREATE TABLE IF NOT EXISTS `clients` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `team_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255),
  `phone` VARCHAR(30),
  `whatsapp` VARCHAR(30),
  `nationality` VARCHAR(100),
  `passport_expiry` VARCHAR(10),
  `preferences` TEXT,
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`)
);

CREATE TABLE IF NOT EXISTS `trips` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `team_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `client_id` INT,
  `label` VARCHAR(255) NOT NULL,
  `adults` INT NOT NULL DEFAULT 2,
  `children` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `preview_key` VARCHAR(100),
  `preview_expires_at` BIGINT,
  `total_from_inr` INT,
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`)
);

CREATE TABLE IF NOT EXISTS `destinations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `trip_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `country` VARCHAR(100),
  `checkin` VARCHAR(10),
  `checkout` VARCHAR(10),
  `nights` INT,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `trip_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `destination_id` INT,
  `trip_id` INT NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `booking_status` VARCHAR(20) NOT NULL DEFAULT 'researching',
  `booking_ref` VARCHAR(100),
  `confirmed_total_inr` INT,
  `start_date` VARCHAR(10),
  `end_date` VARCHAR(10),
  `start_time` VARCHAR(8),
  `details_json` TEXT,
  `sort_order` INT NOT NULL DEFAULT 0,
  `added_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `hotel_details` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `item_id` INT NOT NULL UNIQUE,
  `stars` INT,
  `rating` FLOAT,
  `reviews` INT,
  `location_score` FLOAT,
  `recommendation` TEXT,
  `source` VARCHAR(20) NOT NULL DEFAULT 'manual',
  `fora_id` VARCHAR(100),
  `hotel_website` TEXT,
  `google_rate_inr` INT,
  `thumbnail` TEXT,
  `lat` FLOAT,
  `lng` FLOAT,
  `serp_data` TEXT,
  FOREIGN KEY (`item_id`) REFERENCES `trip_items`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `rates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `hotel_detail_id` INT NOT NULL,
  `source` VARCHAR(30) NOT NULL DEFAULT 'fora',
  `source_label` VARCHAR(100),
  `raw_text` TEXT,
  `status` VARCHAR(20) NOT NULL DEFAULT 'idle',
  `is_confirmed` INT NOT NULL DEFAULT 0,
  `parsed_data` TEXT,
  `proposals` TEXT,
  `error_message` TEXT,
  `history` TEXT,
  `sort_order` INT NOT NULL DEFAULT 0,
  `added_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`hotel_detail_id`) REFERENCES `hotel_details`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `itinerary_days` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `trip_id` INT NOT NULL,
  `destination_id` INT,
  `day_number` INT NOT NULL,
  `date` VARCHAR(10),
  `title` VARCHAR(255),
  `summary` TEXT,
  `sort_order` INT NOT NULL DEFAULT 0,
  FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`)
);

CREATE TABLE IF NOT EXISTS `itinerary_blocks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `day_id` INT NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `content` TEXT,
  `item_id` INT,
  `sort_order` INT NOT NULL DEFAULT 0,
  FOREIGN KEY (`day_id`) REFERENCES `itinerary_days`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`item_id`) REFERENCES `trip_items`(`id`)
);
