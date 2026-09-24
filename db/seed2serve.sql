-- ============================================================
-- Seed2Serve — MySQL schema
-- Create the database and the users table used for authentication.
--
-- Run once against your MySQL server, e.g.:
--   mysql -u root -p < db/seed2serve.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS seed2serve
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE seed2serve;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  full_name     VARCHAR(120)     NOT NULL,
  username      VARCHAR(60)      NOT NULL,
  email         VARCHAR(255)     NOT NULL,
  phone         VARCHAR(40)      NOT NULL,
  password_hash VARCHAR(255)     NOT NULL,
  created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED  NOT NULL,
  token_hash  CHAR(64)      NOT NULL,
  expires_at  DATETIME      NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_password_resets_user (user_id),
  KEY idx_password_resets_hash (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
