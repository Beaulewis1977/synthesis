# Phase 17A: Anthropic OAuth/API Key Toggle

## Goal

Add toggle for Anthropic provider to switch between OAuth (Claude subscription billing) and API key (pay-per-use billing).

| Mode | Authentication | Billing |
|------|----------------|---------|
| **OAuth** | `CLAUDE_CODE_OAUTH_TOKEN` via CLI | Claude Pro/Max subscription |
| **API Key** | `ANTHROPIC_API_KEY` via SDK | Pay-per-use API billing |

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/server/src/services/api-key-service.ts` | Add `getAnthropicAuthMode()`, `testAnthropicOAuth()` |
| `apps/server/src/services/chat-providers/anthropic.ts` | Branch on auth mode |
| `apps/web/src/components/settings/ApiKeyManager.tsx` | Add OAuth toggle for Anthropic |
| `apps/web/src/hooks/useModelConfig.ts` | Add hook for auth mode setting |

---

## Implementation Details

### 1. Add Auth Mode Helper

**File:** `apps/server/src/services/api-key-service.ts`

```typescript
// In ProviderSettingsService class
async getAnthropicAuthMode(): Promise<'oauth' | 'api_key'> {
  const value = await this.getSetting('anthropic', 'auth_mode');
  return (value === 'oauth') ? 'oauth' : 'api_key';
}
```

### 2. Modify Anthropic Provider

**File:** `apps/server/src/services/chat-providers/anthropic.ts`

```typescript
const authMode = await getProviderSettingsService(this.db).getAnthropicAuthMode();

if (authMode === 'oauth') {
  // OAuth: Use CLI which reads CLAUDE_CODE_OAUTH_TOKEN
  const response = query({
    prompt,
    options: {
      pathToClaudeCodeExecutable: process.env.CLAUDE_CLI_PATH || 'claude',
      // ... other options
    },
  });
} else {
  // API Key: Pass directly to SDK
  const apiKey = await getProviderApiKey(this.db, 'anthropic');
  const response = query({
    prompt,
    options: {
      apiKey,
      // ... other options
    },
  });
}
```

### 3. Add OAuth Test Method

**File:** `apps/server/src/services/api-key-service.ts`

```typescript
private async testAnthropicOAuth(): Promise<{ valid: boolean; message: string }> {
  const cliPath = process.env.CLAUDE_CLI_PATH || 'claude';
  try {
    const { execSync } = await import('node:child_process');
    execSync(`${cliPath} --version`, { timeout: 5000 });
    return { valid: true, message: 'OAuth token is valid (CLI accessible)' };
  } catch {
    return { valid: false, message: 'OAuth token invalid or CLI not accessible' };
  }
}
```

### 4. Add UI Toggle

**File:** `apps/web/src/components/settings/ApiKeyManager.tsx`

```tsx
{key.provider === 'anthropic' && (
  <ProviderSettingToggle
    label="Use Claude Subscription (OAuth)"
    description="Uses your Claude Pro/Max subscription instead of API credits."
    currentValue={anthropicAuthMode === 'oauth'}
    onToggle={() => handleAnthropicAuthModeToggle()}
  />
)}
```

---

## OAuth Token Setup Instructions

```bash
# 1. Install Claude CLI (if not installed)
pnpm add -g @anthropic-ai/claude-code

# 2. Login to Claude
claude login

# 3. Generate OAuth token
claude setup-token
# Outputs: eyJhbGciOiJSUzI1...

# 4. Set environment variable
export CLAUDE_CODE_OAUTH_TOKEN='eyJhbGciOiJSUzI1...'
```

---

## Environment Variables

```bash
# OAuth mode (Claude subscription):
CLAUDE_CODE_OAUTH_TOKEN='eyJhbGciOiJSUzI1...'
CLAUDE_CLI_PATH='/path/to/claude'  # Optional, defaults to 'claude'

# API key mode (pay-per-use):
ANTHROPIC_API_KEY='sk-ant-...'
```

---

## Skills

- `synthesis-architecture`
- `backend-development`

## Subagents

None needed (straightforward implementation)

## MCP Tools

- `context7` - Claude Agent SDK authentication patterns (if needed)

---

## Commit Message

```
feat(anthropic): add OAuth/API key authentication toggle
```

---

## Verification Checklist

- [ ] `getAnthropicAuthMode()` method added to ProviderSettingsService
- [ ] `testAnthropicOAuth()` method added to ApiKeyService
- [ ] Anthropic provider branches on auth mode
- [ ] OAuth toggle appears in Settings > API Keys
- [ ] OAuth mode works (chat uses Claude subscription)
- [ ] API Key mode works (chat uses API billing)
- [ ] `pnpm typecheck` passes
