# Phase 17B: Fix Z.AI & Moonshot API Testing

## Goal

Add `testZhipuKey()` and `testMoonshotKey()` methods to `ApiKeyService` so the "Test" button works for these providers.

| Provider | Test Endpoint | Auth Header |
|----------|---------------|-------------|
| Z.AI (Zhipu) | `https://api.z.ai/api/paas/v4/chat/completions` (POST) | `Authorization: Bearer {key}` |
| Moonshot | `https://api.moonshot.ai/v1/models` (GET) | `Authorization: Bearer {key}` |

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/server/src/services/api-key-service.ts` | Add test methods and switch cases |

---

## Implementation Details

### 1. Add Switch Cases

**File:** `apps/server/src/services/api-key-service.ts` (around line 317)

```typescript
case 'zhipu':
  return await this.testZhipuKey(key);
case 'moonshot':
  return await this.testMoonshotKey(key);
```

### 2. Add Test Methods

**File:** `apps/server/src/services/api-key-service.ts`

```typescript
private async testZhipuKey(key: string): Promise<{ valid: boolean; message: string }> {
  try {
    const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'glm-4-air',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    });
    if (response.ok) return { valid: true, message: 'API key is valid' };
    if (response.status === 401) return { valid: false, message: 'Invalid API key' };

    const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    return { valid: false, message: data.error?.message || `API error: ${response.status}` };
  } catch (error) {
    return {
      valid: false,
      message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

private async testMoonshotKey(key: string): Promise<{ valid: boolean; message: string }> {
  try {
    const response = await fetch('https://api.moonshot.ai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (response.ok) return { valid: true, message: 'API key is valid' };
    if (response.status === 401) return { valid: false, message: 'Invalid API key' };
    return { valid: false, message: `API error: ${response.status}` };
  } catch (error) {
    return { valid: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}
```

---

## Skills

- `synthesis-architecture`
- `backend-development`

## Subagents

None needed (simple fix)

## MCP Tools

- `context7` - Verify OpenAI SDK `/v1/models` endpoint format
- `perplexity` - Research Z.AI and Moonshot API documentation (if needed)

---

## Commit Message

```
fix(api-keys): add API key testing for Zhipu and Moonshot providers
```

---

## Verification Checklist

- [ ] `testZhipuKey()` method added
- [ ] `testMoonshotKey()` method added
- [ ] Z.AI "Test" button returns valid/invalid result
- [ ] Moonshot "Test" button returns valid/invalid result
- [ ] `pnpm typecheck` passes
