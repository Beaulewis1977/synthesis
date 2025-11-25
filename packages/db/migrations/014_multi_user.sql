-- Migration: Multi-User Foundations (Auth & Tenancy)
-- Provides foundation for user authentication and multi-tenant support

-- Users table (integrates with external auth like Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- External auth provider ID (e.g., Supabase Auth user ID)
  external_id VARCHAR(255) UNIQUE,
  auth_provider VARCHAR(50) DEFAULT 'local', -- local, supabase, google, github
  
  -- Profile
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  avatar_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false,
  
  -- Preferences
  preferences JSONB DEFAULT '{}'::jsonb,
  -- Example: {"theme": "dark", "default_collection": "uuid", "notifications": true}
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Organizations/Teams for multi-tenancy
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  
  -- Settings
  settings JSONB DEFAULT '{}'::jsonb,
  -- Example: {"max_collections": 10, "max_documents_per_collection": 1000}
  
  -- Billing (for future)
  plan VARCHAR(50) DEFAULT 'free', -- free, pro, enterprise
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization membership
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role within organization
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
  
  -- Permissions (fine-grained)
  permissions JSONB DEFAULT '[]'::jsonb,
  -- Example: ["read", "write", "delete", "manage_members"]
  
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id)
);

-- Add ownership to collections
ALTER TABLE collections ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);
ALTER TABLE collections ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE collections ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private'; -- private, organization, public

-- Collection sharing/permissions
CREATE TABLE IF NOT EXISTS collection_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  
  -- Who has access
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- What access
  permission VARCHAR(20) NOT NULL DEFAULT 'read', -- read, write, admin
  
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Either user_id or organization_id must be set
  CHECK (user_id IS NOT NULL OR organization_id IS NOT NULL)
);

-- API keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Key details
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(255) NOT NULL, -- SHA-256 hash of the actual key
  key_prefix VARCHAR(10) NOT NULL, -- First 8 chars for identification (e.g., "syn_abc1")
  
  -- Permissions
  scopes JSONB DEFAULT '["read"]'::jsonb,
  -- Example: ["read", "write", "search", "chat"]
  
  -- Limits
  rate_limit_per_minute INTEGER DEFAULT 60,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for security
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who
  user_id UUID REFERENCES users(id),
  api_key_id UUID REFERENCES api_keys(id),
  ip_address INET,
  user_agent TEXT,
  
  -- What
  action VARCHAR(100) NOT NULL, -- create_collection, delete_document, search, chat, etc.
  resource_type VARCHAR(50), -- collection, document, chat_session
  resource_id UUID,
  
  -- Details
  details JSONB DEFAULT '{}'::jsonb,
  
  -- When
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure audit trail has a source
  CHECK (user_id IS NOT NULL OR api_key_id IS NOT NULL)
);

-- Session tokens (for stateful auth if needed)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  token_hash VARCHAR(255) NOT NULL,
  
  -- Session info
  ip_address INET,
  user_agent TEXT,
  
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_external_id ON users(external_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_collections_owner ON collections(owner_id);
CREATE INDEX idx_collections_org ON collections(organization_id);
CREATE INDEX idx_collection_permissions_collection ON collection_permissions(collection_id);
CREATE INDEX idx_collection_permissions_user ON collection_permissions(user_id);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE UNIQUE INDEX idx_sessions_token ON sessions(token_hash);

-- Row Level Security policies (for Supabase integration)
-- These would be enabled when using Supabase
-- ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view own collections" ON collections FOR SELECT USING (owner_id = auth.uid());
