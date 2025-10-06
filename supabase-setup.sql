-- Supabase SQL script to create the required tables

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for storing app updates
CREATE TABLE IF NOT EXISTS updates (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(20) NOT NULL,  -- 'android', 'ios', 'web'
  version VARCHAR(20) NOT NULL,   -- '1.2.3'
  download_url TEXT NOT NULL,     -- URL to ZIP bundle
  checksum VARCHAR(100),          -- SHA256 checksum
  session_key VARCHAR(100),       -- For encrypted updates (optional)
  channel VARCHAR(20) DEFAULT 'stable',
  environment VARCHAR(20) DEFAULT 'prod',
  required BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100),
  
  INDEX idx_platform_version (platform, version),
  INDEX idx_active (active),
  INDEX idx_channel_env (channel, environment)
);

-- Table for device channel assignments
CREATE TABLE IF NOT EXISTS device_channels (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(100) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  platform VARCHAR(20),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(app_id, device_id),
  INDEX idx_app_id (app_id),
  INDEX idx_channel (channel)
);

-- Table for update statistics
CREATE TABLE IF NOT EXISTS update_stats (
  id SERIAL PRIMARY KEY,
  bundle_id VARCHAR(100),
  status VARCHAR(20),             -- 'downloaded', 'installed', 'failed'
  device_id VARCHAR(100),
  app_id VARCHAR(100),
  platform VARCHAR(20),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_device (device_id),
  INDEX idx_app (app_id),
  INDEX idx_status (status)
);

-- Table for update logs (analytics)
CREATE TABLE IF NOT EXISTS update_logs (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(100),
  app_id VARCHAR(100),
  current_version VARCHAR(20),
  new_version VARCHAR(20),
  platform VARCHAR(20),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  details TEXT,
  
  INDEX idx_device (device_id),
  INDEX idx_app (app_id),
  INDEX idx_timestamp (timestamp)
);

-- Table for update statistics (expanded)
CREATE TABLE IF NOT EXISTS update_stats (
  id SERIAL PRIMARY KEY,
  bundle_id VARCHAR(100),
  status VARCHAR(20),             -- 'downloaded', 'installed', 'failed'
  device_id VARCHAR(100),
  app_id VARCHAR(100),
  platform VARCHAR(20),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  details TEXT,                   -- Additional error details or metadata
  
  INDEX idx_device (device_id),
  INDEX idx_app (app_id),
  INDEX idx_status (status)
);

-- Insert sample data (optional)
INSERT INTO updates (platform, version, download_url, checksum, channel, environment, required, created_by) VALUES
('android', '1.0.0', 'https://example.com/bundles/android-1.0.0.zip', 'sha256_hash_here', 'stable', 'prod', FALSE, 'admin'),
('android', '1.0.1', 'https://example.com/bundles/android-1.0.1.zip', 'sha256_hash_here', 'stable', 'prod', FALSE, 'admin');