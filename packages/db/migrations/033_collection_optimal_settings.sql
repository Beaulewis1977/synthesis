-- Migration: 033_collection_optimal_settings.sql
-- Phase: Auto-Optimal RAG Settings
-- Purpose: Add optimal_settings JSONB column to collections table for auto-detected RAG settings

-- Add optimal_settings JSONB column to collections table
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS optimal_settings JSONB DEFAULT NULL;

-- Add GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_collections_optimal_settings
ON collections USING GIN (optimal_settings);

-- Add descriptive comment
COMMENT ON COLUMN collections.optimal_settings IS
'Auto-detected optimal RAG settings based on content analysis. Contains embeddingProvider, embeddingModel, searchMode, reasoning, confidence, analyzedAt, and fileCount.';
