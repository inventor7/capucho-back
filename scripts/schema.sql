-- ============================================================================
-- SIMPLIFIED SCHEMA - NO TEAMS, PERFECT FOR FRONTEND DEVS
-- ============================================================================

-- Clean slate
DROP TABLE IF EXISTS device_stats CASCADE;
DROP TABLE IF EXISTS native_update_logs CASCADE;
DROP TABLE IF EXISTS update_logs CASCADE;
DROP TABLE IF EXISTS version_stats CASCADE;
DROP TABLE IF EXISTS device_channels CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS native_updates CASCADE;
DROP TABLE IF EXISTS app_versions CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS app_permissions CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS apps CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS check_team_organization() CASCADE;

-- ============================================================================
-- CORE STRUCTURE (Simplified)
-- ============================================================================

-- Users (linked to Supabase auth)
CREATE TABLE users (
    id UUID PRIMARY KEY, -- matches auth.users.id
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organizations (each brand/client/company)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- for URLs
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization members with roles
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Apps (NO team_id - directly under organization)
CREATE TABLE apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id VARCHAR(255) UNIQUE NOT NULL, -- bundle ID like "com.acme.myapp"
    name VARCHAR(255) NOT NULL,
    icon_url TEXT,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- App permissions (per-app roles for fine-grained control)
CREATE TABLE app_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'developer', 'tester', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(app_id, user_id)
);

-- ============================================================================
-- CHANNELS & VERSIONS
-- ============================================================================

-- Channels (production, staging, beta, etc.)
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT false,
    allow_device_self_set BOOLEAN NOT NULL DEFAULT false,
    allow_dev BOOLEAN NOT NULL DEFAULT true,
    allow_emulator BOOLEAN NOT NULL DEFAULT true,
    ios_enabled BOOLEAN NOT NULL DEFAULT true,
    android_enabled BOOLEAN NOT NULL DEFAULT true,
    disable_auto_update VARCHAR(50) NOT NULL DEFAULT 'none' CHECK (
        disable_auto_update IN ('none', 'major', 'minor', 'patch')
    ),
    disable_auto_update_under_native BOOLEAN NOT NULL DEFAULT false,
    current_version_id UUID, -- FK added later
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(app_id, name)
);

-- OTA Updates (JavaScript bundles)
CREATE TABLE app_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    version_name VARCHAR(50) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    
    -- Storage
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'r2' CHECK (
        storage_provider IN ('r2', 'external', 's3')
    ),
    external_url TEXT,
    r2_path VARCHAR(500),
    checksum VARCHAR(64),
    session_key VARCHAR(255),
    manifest JSONB,
    
    -- Version control
    min_update_version VARCHAR(50),
    required BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(app_id, version_name, platform)
);

-- Add FK for current_version_id
ALTER TABLE channels 
    ADD CONSTRAINT channels_current_version_id_fkey 
    FOREIGN KEY (current_version_id) REFERENCES app_versions(id) ON DELETE SET NULL;

-- Native Updates (full APK/IPA binaries)
CREATE TABLE native_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android')),
    version_name VARCHAR(50) NOT NULL,
    version_code INTEGER NOT NULL,
    
    -- Download
    download_url TEXT NOT NULL,
    checksum VARCHAR(64),
    file_size_bytes BIGINT,
    
    -- Requirements
    min_sdk_version INTEGER,
    required BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    
    -- Distribution
    channel VARCHAR(100) NOT NULL DEFAULT 'production',
    release_notes TEXT,
    
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(app_id, platform, version_code)
);

-- ============================================================================
-- DEVICES
-- ============================================================================

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(255) NOT NULL,
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    
    -- Device info
    custom_id VARCHAR(255),
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    is_prod BOOLEAN NOT NULL DEFAULT true,
    is_emulator BOOLEAN NOT NULL DEFAULT false,
    
    -- Current state
    version_name VARCHAR(50),
    version_build VARCHAR(50),
    version_os VARCHAR(50),
    plugin_version VARCHAR(50),
    
    -- Channel
    channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
    channel_override VARCHAR(100),
    
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(app_id, device_id)
);

CREATE TABLE device_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_id, channel_id)
);

-- ============================================================================
-- ANALYTICS & LOGS
-- ============================================================================

CREATE TABLE version_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
    
    get_count INTEGER NOT NULL DEFAULT 0,
    download_count INTEGER NOT NULL DEFAULT 0,
    install_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(app_id, version_id)
);

CREATE TABLE update_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    
    current_version VARCHAR(50),
    new_version VARCHAR(50),
    platform VARCHAR(20),
    
    action VARCHAR(50) NOT NULL DEFAULT 'get' CHECK (
        action IN ('get', 'download', 'install', 'fail', 'rollback')
    ),
    status VARCHAR(50) CHECK (status IN ('success', 'failed', 'pending')),
    error_message TEXT,
    details JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE native_update_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    
    event VARCHAR(50) NOT NULL CHECK (
        event IN ('check', 'download', 'install', 'fail', 'skip')
    ),
    platform VARCHAR(20) NOT NULL,
    
    current_version_code INTEGER,
    new_version VARCHAR(50),
    new_version_code INTEGER,
    channel VARCHAR(100),
    
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE device_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    
    action VARCHAR(50) NOT NULL,
    version_name VARCHAR(50),
    platform VARCHAR(20),
    is_emulator BOOLEAN,
    is_prod BOOLEAN,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Organization indexes
CREATE INDEX idx_apps_org ON apps(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);

-- App permission indexes
CREATE INDEX idx_app_permissions_user ON app_permissions(user_id);
CREATE INDEX idx_app_permissions_app ON app_permissions(app_id);

-- Channel & Version indexes
CREATE INDEX idx_channels_app ON channels(app_id);
CREATE INDEX idx_app_versions_app ON app_versions(app_id);
CREATE INDEX idx_app_versions_platform ON app_versions(platform);
CREATE INDEX idx_app_versions_active ON app_versions(app_id, platform, active);
CREATE INDEX idx_native_updates_app ON native_updates(app_id);
CREATE INDEX idx_native_updates_platform ON native_updates(platform);
CREATE INDEX idx_native_updates_active ON native_updates(app_id, platform, active);

-- Device indexes
CREATE INDEX idx_devices_app ON devices(app_id);
CREATE INDEX idx_devices_channel ON devices(channel_id);
CREATE INDEX idx_devices_last_seen ON devices(last_seen);
CREATE INDEX idx_device_channels_device ON device_channels(device_id);
CREATE INDEX idx_device_channels_channel ON device_channels(channel_id);

-- Analytics indexes
CREATE INDEX idx_version_stats_app ON version_stats(app_id);
CREATE INDEX idx_version_stats_version ON version_stats(version_id);
CREATE INDEX idx_update_logs_app ON update_logs(app_id);
CREATE INDEX idx_update_logs_device ON update_logs(device_id);
CREATE INDEX idx_update_logs_created ON update_logs(created_at DESC);
CREATE INDEX idx_native_update_logs_app ON native_update_logs(app_id);
CREATE INDEX idx_native_update_logs_device ON native_update_logs(device_id);
CREATE INDEX idx_native_update_logs_created ON native_update_logs(created_at DESC);
CREATE INDEX idx_device_stats_app ON device_stats(app_id);
CREATE INDEX idx_device_stats_created ON device_stats(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_apps_updated_at BEFORE UPDATE ON apps 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_app_permissions_updated_at BEFORE UPDATE ON app_permissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_app_versions_updated_at BEFORE UPDATE ON app_versions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_native_updates_updated_at BEFORE UPDATE ON native_updates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_device_channels_updated_at BEFORE UPDATE ON device_channels 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_version_stats_updated_at BEFORE UPDATE ON version_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE organizations IS 'Each organization represents a brand, client, or company';
COMMENT ON TABLE organization_members IS 'Organization-level roles: owner, admin, member';
COMMENT ON TABLE apps IS 'Apps belong directly to organizations (no teams)';
COMMENT ON TABLE app_permissions IS 'Per-app roles: admin, developer, tester, viewer - controls what users can see and do per app';
COMMENT ON TABLE channels IS 'Distribution channels (production, staging, beta) for OTA updates';
COMMENT ON TABLE app_versions IS 'OTA updates (JavaScript bundles) for Capacitor/Cordova apps';
COMMENT ON TABLE native_updates IS 'Native binary updates (APK/IPA) for major releases';

COMMENT ON COLUMN organization_members.role IS 'owner: full control, admin: manage org, member: basic access';
COMMENT ON COLUMN app_permissions.role IS 'admin: full app control, developer: deploy updates, tester: test builds, viewer: read-only';
COMMENT ON COLUMN apps.app_id IS 'Bundle identifier like com.acme.myapp - unique across platform';
COMMENT ON COLUMN app_versions.storage_provider IS 'Where bundle is stored: r2, s3, or external URL';







































-- ============================================================================
-- RLS POLICIES - SIMPLIFIED (NO TEAMS)
-- ============================================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE native_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE update_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE native_update_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_stats ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user is org owner/admin
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is org member (any role)
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get user's app role (returns NULL if no access)
CREATE OR REPLACE FUNCTION get_app_role(app_uuid UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM app_permissions
    WHERE app_id = app_uuid
      AND user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user can access app (has permission OR is org admin)
CREATE OR REPLACE FUNCTION can_access_app(app_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- Has direct app permission
    SELECT 1 FROM app_permissions
    WHERE app_id = app_uuid AND user_id = auth.uid()
  ) OR EXISTS (
    -- Is org admin
    SELECT 1 FROM apps a
    JOIN organization_members om ON a.organization_id = om.organization_id
    WHERE a.id = app_uuid 
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user can manage app (admin role OR org admin)
CREATE OR REPLACE FUNCTION can_manage_app(app_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_app_role(app_uuid) = 'admin' OR EXISTS (
    SELECT 1 FROM apps a
    JOIN organization_members om ON a.organization_id = om.organization_id
    WHERE a.id = app_uuid 
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user can deploy (developer+ OR org admin)
CREATE OR REPLACE FUNCTION can_deploy(app_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_app_role(app_uuid) IN ('admin', 'developer') OR EXISTS (
    SELECT 1 FROM apps a
    JOIN organization_members om ON a.organization_id = om.organization_id
    WHERE a.id = app_uuid 
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- USERS POLICIES
-- ============================================================================

CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can view org members" ON users
  FOR SELECT USING (
    id IN (
      SELECT DISTINCT om2.user_id
      FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid()
    )
  );

-- ============================================================================
-- ORGANIZATIONS POLICIES
-- ============================================================================

CREATE POLICY "View member organizations" ON organizations
  FOR SELECT USING (is_org_member(id));

CREATE POLICY "Create organizations" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins update organizations" ON organizations
  FOR UPDATE USING (is_org_admin(id));

CREATE POLICY "Owners delete organizations" ON organizations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- ============================================================================
-- ORGANIZATION MEMBERS POLICIES
-- ============================================================================

CREATE POLICY "View org members" ON organization_members
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Admins add members" ON organization_members
  FOR INSERT WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "Admins update members" ON organization_members
  FOR UPDATE USING (
    is_org_admin(organization_id) AND role != 'owner'
  );

CREATE POLICY "Admins remove members" ON organization_members
  FOR DELETE USING (
    is_org_admin(organization_id) AND role != 'owner'
  );

-- ============================================================================
-- APPS POLICIES (KEY: Users only see apps they have permission to)
-- ============================================================================

CREATE POLICY "View accessible apps" ON apps
  FOR SELECT USING (can_access_app(id));

CREATE POLICY "Org admins create apps" ON apps
  FOR INSERT WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "App admins update apps" ON apps
  FOR UPDATE USING (can_manage_app(id));

CREATE POLICY "Org admins delete apps" ON apps
  FOR DELETE USING (is_org_admin(organization_id));

-- ============================================================================
-- APP PERMISSIONS POLICIES
-- ============================================================================

CREATE POLICY "View app permissions" ON app_permissions
  FOR SELECT USING (can_access_app(app_id));

CREATE POLICY "App admins add permissions" ON app_permissions
  FOR INSERT WITH CHECK (can_manage_app(app_id));

CREATE POLICY "App admins update permissions" ON app_permissions
  FOR UPDATE USING (can_manage_app(app_id));

CREATE POLICY "App admins remove permissions" ON app_permissions
  FOR DELETE USING (can_manage_app(app_id));

-- ============================================================================
-- CHANNELS POLICIES
-- ============================================================================

CREATE POLICY "View channels" ON channels
  FOR SELECT USING (can_access_app(app_id));

CREATE POLICY "Developers create channels" ON channels
  FOR INSERT WITH CHECK (can_deploy(app_id));

CREATE POLICY "Developers update channels" ON channels
  FOR UPDATE USING (can_deploy(app_id));

CREATE POLICY "App admins delete channels" ON channels
  FOR DELETE USING (can_manage_app(app_id));

-- ============================================================================
-- APP VERSIONS POLICIES (OTA)
-- ============================================================================

CREATE POLICY "View versions" ON app_versions
  FOR SELECT USING (can_access_app(app_id));

CREATE POLICY "Developers upload versions" ON app_versions
  FOR INSERT WITH CHECK (can_deploy(app_id));

CREATE POLICY "Developers update versions" ON app_versions
  FOR UPDATE USING (can_deploy(app_id));

CREATE POLICY "Developers delete versions" ON app_versions
  FOR DELETE USING (can_deploy(app_id));

-- ============================================================================
-- NATIVE UPDATES POLICIES
-- ============================================================================

CREATE POLICY "View native updates" ON native_updates
  FOR SELECT USING (can_access_app(app_id));

CREATE POLICY "Developers upload native updates" ON native_updates
  FOR INSERT WITH CHECK (can_deploy(app_id));

CREATE POLICY "Developers update native updates" ON native_updates
  FOR UPDATE USING (can_deploy(app_id));

CREATE POLICY "Developers delete native updates" ON native_updates
  FOR DELETE USING (can_deploy(app_id));

-- ============================================================================
-- DEVICES POLICIES
-- ============================================================================

CREATE POLICY "View devices" ON devices
  FOR SELECT USING (can_access_app(app_id));

CREATE POLICY "Developers manage devices" ON devices
  FOR ALL USING (can_deploy(app_id));

-- ============================================================================
-- ANALYTICS POLICIES (Read-only for all with app access)
-- ============================================================================

CREATE POLICY "View device channels" ON device_channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = device_id AND can_access_app(d.app_id)
    )
  );

CREATE POLICY "View version stats" ON version_stats
  FOR SELECT USING (can_access_app(app_id));

CREATE POLICY "View update logs" ON update_logs
  FOR SELECT USING (can_access_app(app_id));

CREATE POLICY "View native update logs" ON native_update_logs
  FOR SELECT USING (can_access_app(app_id));

CREATE POLICY "View device stats" ON device_stats
  FOR SELECT USING (can_access_app(app_id));

-- ============================================================================
-- HELPER FUNCTIONS FOR FRONTEND
-- ============================================================================

-- Get user's organizations with stats
CREATE OR REPLACE FUNCTION get_user_organizations()
RETURNS TABLE (
  org_id UUID,
  org_name VARCHAR,
  org_slug VARCHAR,
  user_role VARCHAR,
  member_count BIGINT,
  app_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.slug,
    om.role,
    (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id),
    (SELECT COUNT(*) FROM apps WHERE organization_id = o.id)
  FROM organizations o
  JOIN organization_members om ON o.id = om.organization_id
  WHERE om.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get apps user has access to
CREATE OR REPLACE FUNCTION get_user_apps()
RETURNS TABLE (
  app_uuid UUID,
  app_bundle_id VARCHAR,
  app_name VARCHAR,
  app_icon_url TEXT,
  user_role VARCHAR,
  organization_id UUID,
  organization_name VARCHAR,
  organization_slug VARCHAR,
  last_deploy TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.app_id,
    a.name,
    a.icon_url,
    COALESCE(ap.role, 'org_admin') as user_role,
    o.id,
    o.name,
    o.slug,
    (SELECT MAX(created_at) FROM app_versions WHERE app_id = a.id) as last_deploy
  FROM apps a
  JOIN organizations o ON a.organization_id = o.id
  LEFT JOIN app_permissions ap ON a.id = ap.app_id AND ap.user_id = auth.uid()
  WHERE can_access_app(a.id)
  ORDER BY a.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get single app details with permissions
CREATE OR REPLACE FUNCTION get_app_details(app_uuid UUID)
RETURNS TABLE (
  app_id UUID,
  bundle_id VARCHAR,
  app_name VARCHAR,
  icon_url TEXT,
  org_id UUID,
  org_name VARCHAR,
  org_slug VARCHAR,
  user_role VARCHAR,
  can_deploy BOOLEAN,
  can_manage BOOLEAN,
  total_devices BIGINT,
  active_devices BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.app_id,
    a.name,
    a.icon_url,
    o.id,
    o.name,
    o.slug,
    COALESCE(get_app_role(a.id), 'org_admin') as user_role,
    can_deploy(a.id),
    can_manage_app(a.id),
    (SELECT COUNT(*) FROM devices WHERE app_id = a.id),
    (SELECT COUNT(*) FROM devices WHERE app_id = a.id AND last_seen > NOW() - INTERVAL '7 days')
  FROM apps a
  JOIN organizations o ON a.organization_id = o.id
  WHERE a.id = app_uuid AND can_access_app(a.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;