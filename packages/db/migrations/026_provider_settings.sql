-- Migration: 026_provider_settings
-- Phase 16G: Provider-specific settings
--
-- Stores provider-specific configuration settings (e.g., Z.AI coding plan endpoint).
-- Separate from API keys to allow flexible per-provider options.

-- ============================================================================
-- Provider Settings Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, setting_key)
);

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_provider_settings_provider ON provider_settings(provider);

-- Comment on table
COMMENT ON TABLE provider_settings IS 'Stores provider-specific configuration settings (Phase 16G)';
COMMENT ON COLUMN provider_settings.provider IS 'Provider name (zhipu, moonshot, google, etc.)';
COMMENT ON COLUMN provider_settings.setting_key IS 'Setting identifier (e.g., use_coding_plan, region)';
COMMENT ON COLUMN provider_settings.setting_value IS 'Setting value (stored as text, parsed by application)';

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_provider_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_provider_settings_updated_at ON provider_settings;
CREATE TRIGGER trigger_provider_settings_updated_at
    BEFORE UPDATE ON provider_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_provider_settings_updated_at();
