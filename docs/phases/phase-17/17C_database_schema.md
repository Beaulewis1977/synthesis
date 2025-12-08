# Phase 17C: Database Schema for Custom Providers

## Goal

Create `custom_providers` table for storing user-defined LLM endpoints.

---

## Files to Create

| File | Description |
|------|-------------|
| `packages/db/migrations/028_custom_providers.sql` | Migration for custom_providers table |

---

## Implementation Details

### Migration File

**File:** `packages/db/migrations/028_custom_providers.sql`

```sql
-- Custom LLM Provider Support
-- Phase 17C: Store user-defined OpenAI-compatible endpoints

CREATE TABLE custom_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,           -- Display name (e.g., "Local vLLM")
  base_url TEXT NOT NULL,              -- e.g., "http://localhost:8000/v1"
  encrypted_key TEXT,                  -- Encrypted API key (nullable for no-auth endpoints)
  provider_type TEXT NOT NULL DEFAULT 'openai-compatible',
  max_context_tokens INTEGER DEFAULT 8192,
  supports_vision BOOLEAN DEFAULT false,
  supports_tools BOOLEAN DEFAULT true,
  custom_models TEXT[],                -- Manual model list fallback
  discovered_models TEXT[],            -- Cached auto-discovered models
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update timestamp trigger
CREATE TRIGGER update_custom_providers_updated_at
  BEFORE UPDATE ON custom_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for name lookups
CREATE INDEX idx_custom_providers_name ON custom_providers(name);
```

---

## Schema Notes

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Unique display name |
| `base_url` | TEXT | OpenAI-compatible base URL |
| `encrypted_key` | TEXT | AES-256-GCM encrypted API key (nullable) |
| `provider_type` | TEXT | Always 'openai-compatible' for now |
| `max_context_tokens` | INTEGER | Max tokens for context window |
| `supports_vision` | BOOLEAN | Whether provider supports vision |
| `supports_tools` | BOOLEAN | Whether provider supports tool calling |
| `custom_models` | TEXT[] | Manual model list fallback |
| `discovered_models` | TEXT[] | Cached auto-discovered models |

---

## Skills

- `saas-backend-stack`
- `backend-development`

## Subagents

None needed (simple migration)

## MCP Tools

None needed

---

## Commit Message

```text
feat(db): add custom_providers table migration
```

---

## Verification Checklist

- [ ] Migration file created: `028_custom_providers.sql`
- [ ] `pnpm --filter @synthesis/db migrate` succeeds
- [ ] Table exists with correct schema
- [ ] Trigger works (updated_at auto-updates)
