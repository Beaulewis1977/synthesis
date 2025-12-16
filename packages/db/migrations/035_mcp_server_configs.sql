-- Migration: 035_mcp_server_configs
-- Feature: External MCP Server Support
-- Description: Store configuration for external MCP servers (Perplexity, custom servers, etc.)

-- ============================================================================
-- MCP Server Configs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_server_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  server_type VARCHAR(50) NOT NULL CHECK (server_type IN ('stdio', 'sse', 'http')),
  config JSONB NOT NULL,  -- { command, args, env } for stdio, { url, headers } for sse/http
  api_key_env_var VARCHAR(100),  -- Environment variable name for API key (e.g., 'PERPLEXITY_API_KEY')
  enabled BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for name lookups
CREATE INDEX IF NOT EXISTS idx_mcp_server_configs_name ON mcp_server_configs(name);

-- Index for enabled servers
CREATE INDEX IF NOT EXISTS idx_mcp_server_configs_enabled ON mcp_server_configs(enabled) WHERE enabled = true;

-- Comment on table and columns
COMMENT ON TABLE mcp_server_configs IS 'External MCP server configurations (Feature: External MCP Server Support)';
COMMENT ON COLUMN mcp_server_configs.id IS 'Primary key';
COMMENT ON COLUMN mcp_server_configs.name IS 'Unique identifier (e.g., "perplexity")';
COMMENT ON COLUMN mcp_server_configs.display_name IS 'Display name (e.g., "Perplexity AI")';
COMMENT ON COLUMN mcp_server_configs.server_type IS 'Connection type: stdio (local process), sse (Server-Sent Events), http';
COMMENT ON COLUMN mcp_server_configs.config IS 'Server config: { command, args, env } for stdio; { url, headers } for sse/http';
COMMENT ON COLUMN mcp_server_configs.api_key_env_var IS 'Environment variable name containing API key';
COMMENT ON COLUMN mcp_server_configs.enabled IS 'Whether server is active';
COMMENT ON COLUMN mcp_server_configs.description IS 'Human-readable description';

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_mcp_server_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_mcp_server_configs_updated_at ON mcp_server_configs;
CREATE TRIGGER trigger_mcp_server_configs_updated_at
    BEFORE UPDATE ON mcp_server_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_mcp_server_configs_updated_at();

-- ============================================================================
-- Default MCP Servers (Optional - uncomment to seed)
-- ============================================================================

-- Example: Perplexity MCP Server
-- INSERT INTO mcp_server_configs (name, display_name, server_type, config, api_key_env_var, description)
-- VALUES (
--   'perplexity',
--   'Perplexity AI',
--   'stdio',
--   '{"command": "npx", "args": ["-y", "@anthropic/perplexity-mcp-server"]}'::jsonb,
--   'PERPLEXITY_API_KEY',
--   'Web search and research via Perplexity AI'
-- )
-- ON CONFLICT (name) DO NOTHING;
