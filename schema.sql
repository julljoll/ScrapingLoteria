-- ============================================================
-- RESULTADO LOTERÍA LARA — Database Schema for Neon Serverless
-- ============================================================
-- Run this SQL in your Neon console to set up the required tables.

-- 1. USERS TABLE — Managed by admin, users cannot self-register
CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  username     VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,   -- Store plain password here (admin-created)
  display_name VARCHAR(100) NOT NULL,
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ONLINE SESSIONS TABLE — Tracks who is currently viewing the app
CREATE TABLE IF NOT EXISTS online_sessions (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(50) UNIQUE NOT NULL,
  display_name    VARCHAR(100),
  last_heartbeat  TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast heartbeat lookups
CREATE INDEX IF NOT EXISTS idx_online_heartbeat ON online_sessions (last_heartbeat);

-- ============================================================
-- SEED: Create a default admin user (change password after first login)
-- ============================================================
INSERT INTO users (username, password_hash, display_name)
VALUES ('admin', 'admin123', 'Administrador')
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- EXAMPLE: Add more users
-- ============================================================
-- INSERT INTO users (username, password_hash, display_name) VALUES
--   ('usuario1', 'pass123', 'Juan Pérez'),
--   ('usuario2', 'pass456', 'María García'),
--   ('kiosko1',  'kiosko2025', 'Kiosko Principal');
