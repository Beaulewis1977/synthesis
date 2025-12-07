-- Migration: 025_chat_session_models.sql
-- Phase 16G: Per-Chat Model Persistence
-- Add provider and model columns to chat_sessions for per-chat model selection

-- Add nullable provider column (TEXT type for varied provider strings)
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT NULL;

-- Add nullable model column (TEXT type for varied model strings like claude-3-5-sonnet-latest, ollama/llama3.2:3b)
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS model TEXT DEFAULT NULL;

-- Index for potential queries by provider
CREATE INDEX IF NOT EXISTS idx_chat_sessions_provider ON chat_sessions(provider) WHERE provider IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN chat_sessions.provider IS 'Chat provider override (anthropic, openai, ollama, etc). NULL = use global default';
COMMENT ON COLUMN chat_sessions.model IS 'Model override (e.g., claude-3-5-sonnet-latest). NULL = use global default';
