-- Migration: 020_api_keys
-- Phase 6: API Key Management
-- 
-- Creates table for storing encrypted provider API keys.
-- Keys are encrypted using AES-256-GCM before storage.
-- Note: Uses provider_api_keys to avoid conflict with existing api_keys table.

-- ============================================================================
-- Provider API Keys Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL UNIQUE,
    encrypted_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for provider lookups
CREATE INDEX IF NOT EXISTS idx_provider_api_keys_provider ON provider_api_keys(provider);

-- Comment on table
COMMENT ON TABLE provider_api_keys IS 'Stores encrypted API keys for AI providers (Phase 6)';
COMMENT ON COLUMN provider_api_keys.provider IS 'Provider name (anthropic, openai, google, voyage, cohere)';
COMMENT ON COLUMN provider_api_keys.encrypted_key IS 'AES-256-GCM encrypted API key (format: iv:authTag:ciphertext)';

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_provider_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_provider_api_keys_updated_at ON provider_api_keys;
CREATE TRIGGER trigger_provider_api_keys_updated_at
    BEFORE UPDATE ON provider_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_provider_api_keys_updated_at();
