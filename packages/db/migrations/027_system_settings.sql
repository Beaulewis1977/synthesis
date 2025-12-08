-- Migration: 027_system_settings
-- Description: Create system_settings table for app-wide configuration
-- Created: 2025-12-07

-- System settings table for storing app-wide configuration
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON system_settings(updated_at);

-- Seed default embedding profile setting (null means use 'balanced')
INSERT INTO system_settings (key, value)
VALUES ('default_embedding_profile', '{"profileId": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add comment
COMMENT ON TABLE system_settings IS 'App-wide configuration settings stored as key-value pairs with JSONB values';
