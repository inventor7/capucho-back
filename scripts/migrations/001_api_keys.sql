-- ============================================================================
-- API KEYS TABLE - For CLI authentication
-- Run this migration to add API key support
-- ============================================================================

-- API Keys for CLI authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'CLI Key',
    key_hash VARCHAR(255) NOT NULL, -- SHA256 hash of the key
    key_prefix VARCHAR(12) NOT NULL, -- First 12 chars for display (cap_xxxx)
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast key lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- RLS Policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see their own API keys
CREATE POLICY "Users can view own api_keys" ON api_keys
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own api_keys" ON api_keys
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own api_keys" ON api_keys
    FOR DELETE USING (user_id = auth.uid());
