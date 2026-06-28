-- Run as root on the VPS MySQL instance
-- Creates the navigator database and a dedicated user

CREATE DATABASE IF NOT EXISTS navigator_alp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'navigator'@'localhost' IDENTIFIED BY 'X9hMAEkQvOaT4JRE8w9KNApi';
GRANT ALL PRIVILEGES ON navigator_alp.* TO 'navigator'@'localhost';
FLUSH PRIVILEGES;
