-- Migration: 037_update_embedding_profiles_1024.sql
-- Purpose: Rename and update embedding profiles for 1024-dimensional embeddings
-- Phase: 1024-dimensional embedding standardization
--
-- Changes:
--   1. Rename profiles: fast-cheap -> free-local, balanced -> cheap,
--      high-accuracy-code -> medium, high-accuracy-docs -> high
--   2. Update display_name and description for each profile
--   3. Set default profile to 'free-local' in system_settings
--   4. Delete embedding model_configs to fall back to profile inheritance
--   5. Remove 'google' from embedding_profiles provider CHECK constraint

BEGIN;

-- ============================================
-- Step 1: Rename 'fast-cheap' to 'free-local'
-- ============================================
UPDATE embedding_profiles
SET
  name = 'free-local',
  display_name = 'Free (Local)',
  description = 'Local embedding with Ollama mxbai-embed-large (1024 dims). Free, fast, runs locally.',
  provider = 'ollama',
  model = 'mxbai-embed-large',
  cost_tier = 'free',
  updated_at = NOW()
WHERE name = 'fast-cheap';

-- ============================================
-- Step 2: Rename 'balanced' to 'cheap'
-- ============================================
UPDATE embedding_profiles
SET
  name = 'cheap',
  display_name = 'Cheap',
  description = 'Voyage voyage-3.5-lite embeddings (1024 dims). Low cost with good quality.',
  provider = 'voyage',
  model = 'voyage-3.5-lite',
  cost_tier = 'low',
  updated_at = NOW()
WHERE name = 'balanced';

-- ============================================
-- Step 3: Rename 'high-accuracy-code' to 'medium'
-- ============================================
UPDATE embedding_profiles
SET
  name = 'medium',
  display_name = 'Medium',
  description = 'Voyage voyage-3-large embeddings (1024 dims). Best for code repositories.',
  provider = 'voyage',
  model = 'voyage-3-large',
  cost_tier = 'medium',
  updated_at = NOW()
WHERE name = 'high-accuracy-code';

-- ============================================
-- Step 4: Rename 'high-accuracy-docs' to 'high'
-- ============================================
UPDATE embedding_profiles
SET
  name = 'high',
  display_name = 'High',
  description = 'Voyage voyage-3.5 embeddings (1024 dims). Best quality for documentation.',
  provider = 'voyage',
  model = 'voyage-3.5',
  cost_tier = 'high',
  updated_at = NOW()
WHERE name = 'high-accuracy-docs';

-- ============================================
-- Step 5: Update 'none' profile description
-- ============================================
UPDATE embedding_profiles
SET
  display_name = 'Manual Configuration',
  description = 'Use per-type model selectors. No preset applied.',
  updated_at = NOW()
WHERE name = 'none';

-- ============================================
-- Step 6: Set default embedding profile to 'free-local'
-- ============================================
-- Get the UUID of the 'free-local' profile and update system_settings
UPDATE system_settings
SET
  value = jsonb_build_object('profileId', (
    SELECT id::text FROM embedding_profiles WHERE name = 'free-local'
  )),
  updated_at = NOW()
WHERE key = 'default_embedding_profile';

-- Insert if not exists
INSERT INTO system_settings (key, value)
SELECT
  'default_embedding_profile',
  jsonb_build_object('profileId', (
    SELECT id::text FROM embedding_profiles WHERE name = 'free-local'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE key = 'default_embedding_profile'
);

-- ============================================
-- Step 7: Delete embedding model_configs
-- ============================================
-- Remove per-type embedding configs so they fall back to profile inheritance
DELETE FROM model_configs
WHERE feature IN ('embedding_docs', 'embedding_code', 'embedding_writing');

-- ============================================
-- Step 8: Update provider CHECK constraint
-- ============================================
-- Remove 'google' from valid providers (not supported for embeddings)
ALTER TABLE embedding_profiles DROP CONSTRAINT IF EXISTS embedding_profiles_provider_check;
ALTER TABLE embedding_profiles ADD CONSTRAINT embedding_profiles_provider_check
  CHECK (provider IN ('ollama', 'openai', 'voyage', 'cohere', ''));

-- ============================================
-- Step 9: Update comments
-- ============================================
COMMENT ON TABLE embedding_profiles IS 'Embedding profiles for 1024-dimensional vectors. Bundles provider, model, and chunking settings.';

COMMIT;
