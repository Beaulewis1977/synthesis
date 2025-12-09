-- Migration: 029_custom_providers_array_defaults
-- Phase 17C: Fix array column defaults to avoid NULL confusion
-- Description: Add explicit defaults for TEXT array columns (custom_models, discovered_models)

-- ============================================================================
-- Fix Array Column Defaults
-- ============================================================================

-- Add explicit defaults to avoid NULL vs empty array confusion
ALTER TABLE custom_providers
  ALTER COLUMN custom_models SET DEFAULT '{}',
  ALTER COLUMN discovered_models SET DEFAULT '{}';

-- Update any existing NULL values to empty arrays (table is currently empty, but future-proof)
UPDATE custom_providers
SET custom_models = '{}'
WHERE custom_models IS NULL;

UPDATE custom_providers
SET discovered_models = '{}'
WHERE discovered_models IS NULL;

-- Add comments noting the default behavior
COMMENT ON COLUMN custom_providers.custom_models IS 'Manual model list fallback (defaults to empty array)';
COMMENT ON COLUMN custom_providers.discovered_models IS 'Cached auto-discovered models from /v1/models endpoint (defaults to empty array)';
