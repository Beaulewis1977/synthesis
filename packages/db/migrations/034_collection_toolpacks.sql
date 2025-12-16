-- Migration: Add enabled_toolpacks to collections
-- Description: Stores which toolpacks are enabled per collection for agent chat sessions

-- Add enabled_toolpacks column with default ['gateway', 'core']
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS enabled_toolpacks JSONB DEFAULT '["gateway", "core"]'::jsonb;

-- Create GIN index for efficient toolpack queries
CREATE INDEX IF NOT EXISTS idx_collections_enabled_toolpacks
ON collections USING GIN (enabled_toolpacks);

-- Add comment for documentation
COMMENT ON COLUMN collections.enabled_toolpacks IS 'Array of enabled toolpack names for agent chat sessions. Gateway is always enabled.';
