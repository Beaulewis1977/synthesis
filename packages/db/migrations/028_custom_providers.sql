-- Migration: 028_custom_providers
-- Phase 17C: Custom LLM Provider Support
-- Description: Store user-defined OpenAI-compatible endpoints

-- ============================================================================
-- Custom Providers Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  base_url TEXT NOT NULL,
  encrypted_key TEXT,
  provider_type TEXT NOT NULL DEFAULT 'openai-compatible',
  max_context_tokens INTEGER DEFAULT 8192,
  supports_vision BOOLEAN DEFAULT false,
  supports_tools BOOLEAN DEFAULT true,
  custom_models TEXT[] DEFAULT '{}',
  discovered_models TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for name lookups
CREATE INDEX IF NOT EXISTS idx_custom_providers_name ON custom_providers(name);

-- Comment on table and columns
COMMENT ON TABLE custom_providers IS 'User-defined OpenAI-compatible LLM endpoints (Phase 17C)';
COMMENT ON COLUMN custom_providers.id IS 'Primary key';
COMMENT ON COLUMN custom_providers.name IS 'Display name (e.g., "Local vLLM")';
COMMENT ON COLUMN custom_providers.base_url IS 'OpenAI-compatible base URL (e.g., "http://localhost:8000/v1")';
COMMENT ON COLUMN custom_providers.encrypted_key IS 'AES-256-GCM encrypted API key (nullable for no-auth endpoints)';
COMMENT ON COLUMN custom_providers.provider_type IS 'Provider type (always "openai-compatible" for now)';
COMMENT ON COLUMN custom_providers.max_context_tokens IS 'Maximum context window tokens';
COMMENT ON COLUMN custom_providers.supports_vision IS 'Whether provider supports vision/image inputs';
COMMENT ON COLUMN custom_providers.supports_tools IS 'Whether provider supports tool/function calling';
COMMENT ON COLUMN custom_providers.custom_models IS 'Manual model list fallback';
COMMENT ON COLUMN custom_providers.discovered_models IS 'Cached auto-discovered models from /v1/models endpoint';

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_custom_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_custom_providers_updated_at ON custom_providers;
CREATE TRIGGER trigger_custom_providers_updated_at
    BEFORE UPDATE ON custom_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_providers_updated_at();
