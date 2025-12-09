-- Migration 030: Add model curation columns to custom_providers
-- Phase 17K: Custom Provider Model Curation & Tool Support
--
-- Adds:
-- - starred_models: User-selected favorite models to show prominently in chat dropdown
-- - models_without_tools: Models known to not support function/tool calling

-- Add starred_models column for user favorites
ALTER TABLE custom_providers
  ADD COLUMN IF NOT EXISTS starred_models TEXT[] DEFAULT '{}';

-- Add models_without_tools column for tracking tool support
ALTER TABLE custom_providers
  ADD COLUMN IF NOT EXISTS models_without_tools TEXT[] DEFAULT '{}';

-- Add comments
COMMENT ON COLUMN custom_providers.starred_models IS 'User-selected favorite models to show prominently in chat model selector';
COMMENT ON COLUMN custom_providers.models_without_tools IS 'Models known to not support function/tool calling (auto-detected or manually marked)';
