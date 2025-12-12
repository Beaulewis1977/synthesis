-- Migration: 032_add_embedding_profile_presets.sql
-- Purpose: Add new embedding profile presets and rename high-accuracy to high-accuracy-code
-- Phase 16: Improved embedding profile UI with use-case labels

-- First, update the provider check constraint to allow empty strings (for 'none' profile)
-- and include google/cohere providers
ALTER TABLE embedding_profiles DROP CONSTRAINT IF EXISTS embedding_profiles_provider_check;
ALTER TABLE embedding_profiles ADD CONSTRAINT embedding_profiles_provider_check
  CHECK (provider IN ('ollama', 'openai', 'voyage', 'cohere', 'google', ''));

-- Rename high-accuracy to high-accuracy-code
UPDATE embedding_profiles
SET name = 'high-accuracy-code',
    display_name = 'High Accuracy (Code)',
    description = 'Voyage voyage-code-3 embeddings optimized for code. Best for code repositories.',
    model = 'voyage-code-3'
WHERE name = 'high-accuracy';

-- Add high-accuracy-docs preset (OpenAI text-embedding-3-large)
INSERT INTO embedding_profiles (
  id, name, display_name, description, provider, model,
  chunk_size, chunk_overlap, code_aware, cost_tier, is_system
)
VALUES (
  gen_random_uuid(),
  'high-accuracy-docs',
  'High Accuracy (Docs)',
  'OpenAI text-embedding-3-large for general documentation. Best quality for docs.',
  'openai',
  'text-embedding-3-large',
  600,
  100,
  false,
  'high',
  true
) ON CONFLICT (name) DO NOTHING;

-- Add manual/none preset for per-type configuration
INSERT INTO embedding_profiles (
  id, name, display_name, description, provider, model,
  chunk_size, chunk_overlap, code_aware, cost_tier, is_system
)
VALUES (
  gen_random_uuid(),
  'none',
  'Manual Configuration',
  'Use per-type model selectors below. No preset applied.',
  '',
  '',
  800,
  150,
  false,
  'free',
  true
) ON CONFLICT (name) DO NOTHING;

-- Update comments
COMMENT ON TABLE embedding_profiles IS 'Embedding profiles bundle provider, model, and chunking settings. Includes none for manual per-type configuration.';
