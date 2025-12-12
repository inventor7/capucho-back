-- ============================================================
-- CAPGO SELF-HOSTED COMPLETE DATABASE SCHEMA
-- Based on official Capgo documentation + custom native tables
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SECTION 1: CORE CAPGO TABLES (Official Spec)
-- ============================================================

-- Apps registry (optional but recommended for multi-app support)
CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(255) NOT NULL UNIQUE,  -- e.g., "com.example.app"
  name VARCHAR(255),
  owner_org UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- App Versions / Bundles (OTA updates)
CREATE TABLE IF NOT EXISTS app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(255) NOT NULL,           -- e.g., "com.example.app"
  name VARCHAR(50) NOT NULL,              -- version name e.g., "1.0.0"
  external_url TEXT,                      -- URL to download bundle from
  checksum VARCHAR(255),                  -- SHA-256 checksum (encrypted if using encryption)
  session_key VARCHAR(500),               -- "IV:EncryptedAESKey" for encrypted bundles
  storage_provider VARCHAR(50) DEFAULT 'external',  -- "external", "r2", "supabase"
  r2_path VARCHAR(500),                   -- Internal storage path if using R2/Supabase
  
  -- Metadata
  owner_org UUID,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted BOOLEAN DEFAULT FALSE,
  
  -- Version control
  min_update_version VARCHAR(50),         -- Minimum version required to update
  manifest JSONB,                         -- Multi-file download manifest
  
  -- Additional fields for self-hosted
  platform VARCHAR(20) NOT NULL,          -- 'android', 'ios'
  channel VARCHAR(50) DEFAULT 'production',
  environment VARCHAR(20) DEFAULT 'prod', -- 'dev', 'staging', 'prod'
  required BOOLEAN DEFAULT FALSE,         -- Force update
  active BOOLEAN DEFAULT TRUE,            -- Enable/disable this version
  
  UNIQUE(app_id, name, platform)
);

CREATE INDEX idx_app_versions_app_id ON app_versions(app_id);
CREATE INDEX idx_app_versions_active ON app_versions(active);
CREATE INDEX idx_app_versions_channel ON app_versions(channel);
CREATE INDEX idx_app_versions_platform ON app_versions(platform);

-- Channels (Update distribution channels)
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,             -- "production", "beta", "staging"
  version_id UUID,                        -- Current version in this channel
  
  -- Channel settings
  public BOOLEAN DEFAULT FALSE,           -- Public or private channel
  allow_device_self_set BOOLEAN DEFAULT FALSE,  -- Can devices self-assign?
  allow_dev BOOLEAN DEFAULT FALSE,        -- Allow dev builds?
  allow_emulator BOOLEAN DEFAULT FALSE,   -- Allow emulator devices?
  
  -- Platform & update control
  ios BOOLEAN DEFAULT TRUE,
  android BOOLEAN DEFAULT TRUE,
  disable_auto_update VARCHAR(50) DEFAULT 'none',  -- "major", "minor", "patch", "version_number", "none"
  disable_auto_update_under_native BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(app_id, name),
  FOREIGN KEY (version_id) REFERENCES app_versions(id) ON DELETE SET NULL
);

CREATE INDEX idx_channels_app_id ON channels(app_id);
CREATE INDEX idx_channels_name ON channels(name);

-- Devices (Phone device tracking)
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(255) NOT NULL,        -- UUID of phone
  app_id VARCHAR(255) NOT NULL,
  
  -- Device info
  custom_id VARCHAR(255),                 -- Custom identifier (user ID, etc.)
  platform VARCHAR(20),                   -- "ios", "android"
  is_prod BOOLEAN DEFAULT TRUE,
  is_emulator BOOLEAN DEFAULT FALSE,
  
  -- Versions
  version_name VARCHAR(50),               -- Current bundle version
  version_build VARCHAR(50),              -- Build number
  version_os VARCHAR(50),                 -- OS version
  plugin_version VARCHAR(50),             -- Capgo plugin version
  
  -- Channel assignment
  channel_id UUID,                        -- Current channel FK
  channel_override VARCHAR(100),          -- Explicit channel override (admin set)
  
  -- Activity
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(app_id, device_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL
);

CREATE INDEX idx_devices_app_id ON devices(app_id);
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_channel_id ON devices(channel_id);
CREATE INDEX idx_devices_platform ON devices(platform);
CREATE INDEX idx_devices_last_seen ON devices(last_seen);

-- Device channel assignments (simplified version for backwards compatibility)
CREATE TABLE IF NOT EXISTS device_channels (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(255) NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  channel VARCHAR(100) NOT NULL,
  platform VARCHAR(20),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(app_id, device_id)
);

CREATE INDEX idx_device_channels_app_id ON device_channels(app_id);
CREATE INDEX idx_device_channels_device_id ON device_channels(device_id);
CREATE INDEX idx_device_channels_channel ON device_channels(channel);

-- ============================================================
-- SECTION 2: STATISTICS TABLES (Official Spec)
-- ============================================================

-- Per-version statistics (aggregate counts)
CREATE TABLE IF NOT EXISTS stats_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(255) NOT NULL,
  version_id UUID NOT NULL,
  
  -- Action counts
  get_count INTEGER DEFAULT 0,            -- "get" action count
  set_count INTEGER DEFAULT 0,            -- "set" action count  
  fail_count INTEGER DEFAULT 0,           -- "fail" action count
  download_count INTEGER DEFAULT 0,       -- downloads initiated
  install_count INTEGER DEFAULT 0,        -- successful installs
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (version_id) REFERENCES app_versions(id) ON DELETE CASCADE
);

CREATE INDEX idx_stats_version_app_id ON stats_version(app_id);
CREATE INDEX idx_stats_version_version_id ON stats_version(version_id);

-- Device activity/events (granular tracking)
CREATE TABLE IF NOT EXISTS stats_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(255) NOT NULL,
  app_id VARCHAR(255) NOT NULL,
  
  -- Event info
  action VARCHAR(100),                    -- 'get', 'set', 'download_fail', 'install', etc.
  version_name VARCHAR(50),
  
  -- Additional context
  platform VARCHAR(20),
  is_emulator BOOLEAN,
  is_prod BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stats_devices_device_id ON stats_devices(device_id);
CREATE INDEX idx_stats_devices_app_id ON stats_devices(app_id);
CREATE INDEX idx_stats_devices_action ON stats_devices(action);
CREATE INDEX idx_stats_devices_created_at ON stats_devices(created_at);

-- Update logs (for tracking update flow)
CREATE TABLE IF NOT EXISTS update_logs (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255),
  app_id VARCHAR(255),
  current_version VARCHAR(50),
  new_version VARCHAR(50),
  platform VARCHAR(20),
  action VARCHAR(100) DEFAULT 'get',      -- 'get', 'set', 'download_fail', etc.
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  details TEXT                            -- Error details or metadata
);

CREATE INDEX idx_update_logs_device_id ON update_logs(device_id);
CREATE INDEX idx_update_logs_app_id ON update_logs(app_id);
CREATE INDEX idx_update_logs_timestamp ON update_logs(timestamp);
CREATE INDEX idx_update_logs_action ON update_logs(action);

-- Legacy update_stats (for backwards compatibility with your current code)
CREATE TABLE IF NOT EXISTS update_stats (
  id SERIAL PRIMARY KEY,
  bundle_id VARCHAR(100),
  status VARCHAR(50),                     -- 'downloaded', 'installed', 'failed'
  action VARCHAR(100),                    -- Official Capgo field name
  device_id VARCHAR(255),
  app_id VARCHAR(255),
  platform VARCHAR(20),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  details TEXT
);

CREATE INDEX idx_update_stats_device_id ON update_stats(device_id);
CREATE INDEX idx_update_stats_app_id ON update_stats(app_id);
CREATE INDEX idx_update_stats_status ON update_stats(status);
CREATE INDEX idx_update_stats_action ON update_stats(action);

-- ============================================================
-- SECTION 3: LEGACY UPDATES TABLE (Backwards compatibility)
-- Keep if you want to support existing code
-- ============================================================

CREATE TABLE IF NOT EXISTS updates (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(255),                    -- Added: required for multi-app
  platform VARCHAR(20) NOT NULL,
  version VARCHAR(50) NOT NULL,
  download_url TEXT NOT NULL,
  checksum VARCHAR(255),
  session_key VARCHAR(500),
  min_native_version INTEGER DEFAULT 0,   -- Minimum native build required for this OTA
  channel VARCHAR(50) DEFAULT 'stable',
  environment VARCHAR(20) DEFAULT 'prod',
  required BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(255)
);

CREATE INDEX idx_updates_platform ON updates(platform);
CREATE INDEX idx_updates_version ON updates(version);
CREATE INDEX idx_updates_channel ON updates(channel);
CREATE INDEX idx_updates_active ON updates(active);
CREATE INDEX idx_updates_app_id ON updates(app_id);

-- ============================================================
-- SECTION 4: NATIVE UPDATES (Your Custom Tables)
-- For APK/IPA distribution
-- ============================================================

CREATE TABLE IF NOT EXISTS native_updates (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(255),                    -- Added for multi-app support
  platform VARCHAR(20) NOT NULL,          -- 'android', 'ios'
  version VARCHAR(50) NOT NULL,           -- Semver e.g., "1.0.0"
  version_code INTEGER NOT NULL,          -- Integer build number for comparison
  download_url TEXT NOT NULL,             -- URL to APK/IPA file
  checksum VARCHAR(255),                  -- SHA-256 of file
  channel VARCHAR(50) DEFAULT 'stable',
  environment VARCHAR(20) DEFAULT 'prod',
  required BOOLEAN DEFAULT FALSE,         -- Force update
  active BOOLEAN DEFAULT TRUE,
  file_size BIGINT,                       -- File size in bytes
  release_notes TEXT,                     -- Changelog for this version
  min_sdk_version INTEGER,                -- Minimum SDK/OS version
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(app_id, platform, version_code)
);

CREATE INDEX idx_native_updates_platform ON native_updates(platform);
CREATE INDEX idx_native_updates_version_code ON native_updates(version_code);
CREATE INDEX idx_native_updates_channel ON native_updates(channel);
CREATE INDEX idx_native_updates_active ON native_updates(active);
CREATE INDEX idx_native_updates_app_id ON native_updates(app_id);

CREATE TABLE IF NOT EXISTS native_update_logs (
  id SERIAL PRIMARY KEY,
  event VARCHAR(100) NOT NULL,            -- 'check', 'download', 'install', 'fail'
  platform VARCHAR(20) NOT NULL,
  device_id VARCHAR(255),
  app_id VARCHAR(255),
  current_version_code INTEGER,
  new_version VARCHAR(50),
  new_version_code INTEGER,
  channel VARCHAR(50) DEFAULT 'stable',
  environment VARCHAR(20) DEFAULT 'prod',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_native_update_logs_device_id ON native_update_logs(device_id);
CREATE INDEX idx_native_update_logs_event ON native_update_logs(event);
CREATE INDEX idx_native_update_logs_platform ON native_update_logs(platform);
CREATE INDEX idx_native_update_logs_app_id ON native_update_logs(app_id);

-- ============================================================
-- SECTION 5: HELPER VIEWS
-- ============================================================

-- View: Active bundles per channel/platform
CREATE OR REPLACE VIEW active_bundles AS
SELECT 
  app_id,
  platform,
  channel,
  version,
  download_url,
  checksum,
  session_key,
  created_at
FROM updates
WHERE active = TRUE
ORDER BY created_at DESC;

-- View: Device count per channel
CREATE OR REPLACE VIEW channel_device_counts AS
SELECT 
  app_id,
  channel,
  platform,
  COUNT(*) as device_count
FROM device_channels
GROUP BY app_id, channel, platform;

-- View: Recent update activity
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
  ul.app_id,
  ul.device_id,
  ul.action,
  ul.current_version,
  ul.new_version,
  ul.platform,
  ul.timestamp
FROM update_logs ul
WHERE ul.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY ul.timestamp DESC;

-- ============================================================
-- SECTION 6: INITIAL DATA (Optional)
-- ============================================================

-- Insert default channels
INSERT INTO channels (app_id, name, public, allow_device_self_set, ios, android)
VALUES 
  ('default', 'production', FALSE, FALSE, TRUE, TRUE),
  ('default', 'beta', TRUE, TRUE, TRUE, TRUE),
  ('default', 'staging', FALSE, FALSE, TRUE, TRUE)
ON CONFLICT (app_id, name) DO NOTHING;

-- ============================================================
-- MIGRATION NOTES:
-- 
-- If migrating from your current schema, run these:
--
-- ALTER TABLE updates ADD COLUMN IF NOT EXISTS app_id VARCHAR(255);
-- ALTER TABLE native_updates ADD COLUMN IF NOT EXISTS app_id VARCHAR(255);
-- ALTER TABLE update_stats ADD COLUMN IF NOT EXISTS action VARCHAR(100);
-- 
-- Then update existing rows:
-- UPDATE updates SET app_id = 'com.your.app' WHERE app_id IS NULL;
-- UPDATE native_updates SET app_id = 'com.your.app' WHERE app_id IS NULL;
-- ============================================================
