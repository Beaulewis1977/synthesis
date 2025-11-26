-- Migration: 019_embedding_profiles.sql
-- Purpose: Create embedding_profiles table for per-collection embedding configuration
-- Phase 5: Embedding Profiles

-- ============================================
-- Embedding Profiles Table
-- ============================================

CREATE TABLE IF NOT EXISTS embedding_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Profile identification
  name TEXT NOT NULL UNIQUE,           -- 'fast-cheap', 'balanced', 'high-accuracy'
  display_name TEXT NOT NULL,          -- 'Fast & Cheap', 'Balanced', 'High Accuracy'
  description TEXT,
  
  -- Provider/model configuration
  provider TEXT NOT NULL,              -- 'ollama', 'openai', 'voyage'
  model TEXT NOT NULL,
  
  -- Chunking configuration
  chunk_size INT NOT NULL DEFAULT 800,
  chunk_overlap INT NOT NULL DEFAULT 150,
  code_aware BOOLEAN NOT NULL DEFAULT false,
  
  -- Cost indicator (for UI display)
  cost_tier TEXT NOT NULL DEFAULT 'free', -- 'free', 'low', 'medium', 'high'
  
  -- System profile flag (cannot be deleted by users)
  is_system BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS embedding_profiles_name_idx ON embedding_profiles (name);
CREATE INDEX IF NOT EXISTS embedding_profiles_is_system_idx ON embedding_profiles (is_system);

-- ============================================
-- Add profile reference to collections
-- ============================================

ALTER TABLE collections 
  ADD COLUMN IF NOT EXISTS embedding_profile_id UUID REFERENCES embedding_profiles(id) ON DELETE SET NULL;

-- Index for collection profile lookups
CREATE INDEX IF NOT EXISTS collections_embedding_profile_id_idx ON collections (embedding_profile_id);

-- ============================================
-- Auto-update updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_embedding_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS embedding_profiles_updated_at_trigger ON embedding_profiles;
CREATE TRIGGER embedding_profiles_updated_at_trigger
  BEFORE UPDATE ON embedding_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_embedding_profiles_updated_at();

-- ============================================
-- Constraints
-- ============================================

-- Valid provider names
ALTER TABLE embedding_profiles DROP CONSTRAINT IF EXISTS embedding_profiles_provider_check;
ALTER TABLE embedding_profiles ADD CONSTRAINT embedding_profiles_provider_check
  CHECK (provider IN ('ollama', 'openai', 'voyage'));

-- Valid cost tiers
ALTER TABLE embedding_profiles DROP CONSTRAINT IF EXISTS embedding_profiles_cost_tier_check;
ALTER TABLE embedding_profiles ADD CONSTRAINT embedding_profiles_cost_tier_check
  CHECK (cost_tier IN ('free', 'low', 'medium', 'high'));

-- Chunk size constraints
ALTER TABLE embedding_profiles DROP CONSTRAINT IF EXISTS embedding_profiles_chunk_size_check;
ALTER TABLE embedding_profiles ADD CONSTRAINT embedding_profiles_chunk_size_check
  CHECK (chunk_size >= 100 AND chunk_size <= 10000);

-- Chunk overlap constraints
ALTER TABLE embedding_profiles DROP CONSTRAINT IF EXISTS embedding_profiles_chunk_overlap_check;
ALTER TABLE embedding_profiles ADD CONSTRAINT embedding_profiles_chunk_overlap_check
  CHECK (chunk_overlap >= 0 AND chunk_overlap < chunk_size);

-- ============================================
-- Seed System Profiles
-- ============================================

INSERT INTO embedding_profiles (name, display_name, description, provider, model, chunk_size, chunk_overlap, code_aware, cost_tier, is_system)
VALUES 
  (
    'fast-cheap', 
    'Fast & Cheap', 
    'Local embedding with Ollama nomic-embed-text. Free, fast, good for general documentation and text content.',
    'ollama', 
    'nomic-embed-text', 
    1000, 
    150, 
    false, 
    'free', 
    true
  ),
  (
    'balanced', 
    'Balanced', 
    'OpenAI text-embedding-3-small with code-aware chunking. Good balance of cost, quality, and speed.',
    'openai', 
    'text-embedding-3-small', 
    800, 
    150, 
    true, 
    'low', 
    true
  ),
  (
    'high-accuracy', 
    'High Accuracy', 
    'Voyage voyage-code-2 embeddings optimized for code. Best quality for code repositories and technical content.',
    'voyage', 
    'voyage-code-2', 
    600, 
    100, 
    true, 
    'medium', 
    true
  )
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  provider = EXCLUDED.provider,
  model = EXCLUDED.model,
  chunk_size = EXCLUDED.chunk_size,
  chunk_overlap = EXCLUDED.chunk_overlap,
  code_aware = EXCLUDED.code_aware,
  cost_tier = EXCLUDED.cost_tier,
  is_system = EXCLUDED.is_system,
  updated_at = NOW();

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON TABLE embedding_profiles IS 'Embedding configuration profiles that bundle provider, model, and chunking settings. Phase 5.';
COMMENT ON COLUMN embedding_profiles.name IS 'Unique identifier for the profile (e.g., fast-cheap, balanced)';
COMMENT ON COLUMN embedding_profiles.display_name IS 'Human-readable name for UI display';
COMMENT ON COLUMN embedding_profiles.provider IS 'Embedding provider: ollama, openai, voyage';
COMMENT ON COLUMN embedding_profiles.model IS 'Provider-specific model identifier';
COMMENT ON COLUMN embedding_profiles.chunk_size IS 'Target chunk size in characters (100-10000)';
COMMENT ON COLUMN embedding_profiles.chunk_overlap IS 'Overlap between chunks in characters';
COMMENT ON COLUMN embedding_profiles.code_aware IS 'Whether to use AST-aware code chunking';
COMMENT ON COLUMN embedding_profiles.cost_tier IS 'Cost indicator for UI: free, low, medium, high';
COMMENT ON COLUMN embedding_profiles.is_system IS 'System profiles cannot be deleted by users';
COMMENT ON COLUMN collections.embedding_profile_id IS 'Optional embedding profile override for this collection';
