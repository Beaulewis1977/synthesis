# Phase 17J: Chat Model Selector Integration

## Goal

Add custom providers to ChatModelSelector dropdown.

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/components/ChatModelSelector.tsx` | Add custom provider groups |

---

## Implementation Details

### Integration Approach

```typescript
// Add to ChatModelSelector component:
import { useCustomProviders } from '../hooks/useCustomProviders';

// Inside the component:
const { data: customProviders } = useCustomProviders();

// Modify modelGroups useMemo to include custom providers:
const modelGroups = useMemo(() => {
  const groups = [
    // ... existing provider groups (Anthropic, OpenAI, Google, etc.)
  ];

  // Add custom providers after built-in providers
  if (customProviders) {
    for (const provider of customProviders) {
      const models = provider.discoveredModels?.length > 0
        ? provider.discoveredModels
        : provider.customModels || [];

      if (models.length > 0) {
        groups.push({
          provider: `custom:${provider.id}`,
          displayName: provider.name,
          models: models.map(modelId => ({
            id: modelId,
            displayName: modelId,  // Use model ID as display name
          })),
        });
      }
    }
  }

  return groups;
}, [/* dependencies */, customProviders]);
```

### Selection Handling

When user selects a custom provider model:
1. Format value as `custom:${providerId}:${modelId}`
2. Backend extracts `custom:${providerId}` prefix
3. Routes to `getCustomChatProvider()` factory function

```typescript
// Handle selection
const handleModelSelect = (value: string) => {
  // value format: "custom:uuid:model-id" for custom providers
  // or "provider:model-id" for built-in providers
  onModelChange(value);
};
```

### Dropdown Structure

```text
Model Selector Dropdown
├── Anthropic
│   ├── Claude 3.5 Sonnet
│   └── Claude 3.5 Haiku
├── OpenAI
│   ├── GPT-4o
│   └── GPT-4o Mini
├── Google
│   └── Gemini 2.0 Flash
├── Ollama
│   └── Llama 3.2
├── [Custom: Local vLLM]        <-- NEW
│   ├── llama-3-70b-instruct
│   └── mistral-7b-instruct
└── [Custom: OpenRouter]        <-- NEW
    ├── anthropic/claude-3-opus
    └── openai/gpt-4-turbo
```

---

## Skills

- `frontend-design`
- `synthesis-architecture`

## Subagents

1. `code-reviewer` - Review after implementation

## MCP Tools

None needed

---

## Commit Message

```text
feat(web): integrate custom providers into ChatModelSelector
```

---

## Verification Checklist

- [ ] Custom providers fetched with `useCustomProviders()`
- [ ] Custom provider groups added after built-in providers
- [ ] Custom providers appear in dropdown
- [ ] Selection works (passes `custom:uuid` to backend)
- [ ] Chat functions with custom provider
- [ ] Tool calling works
- [ ] `pnpm typecheck` passes
