# Phase 17H: Frontend CustomProviderForm Component

## Goal

Create modal form for adding/editing custom providers.

---

## Files to Create

| File | Description |
|------|-------------|
| `apps/web/src/components/settings/CustomProviderForm.tsx` | Form component |

---

## Implementation Details

### Form Fields

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| Name | Text | Yes | - | e.g., "Local vLLM" |
| Base URL | Text | Yes | - | e.g., "http://localhost:8000/v1" |
| API Key | Password | No | - | Optional for local endpoints |
| Max Context Tokens | Number | No | 8192 | |
| Supports Vision | Checkbox | No | false | |
| Supports Tools | Checkbox | No | true | |
| Custom Models | Textarea | No | - | Comma-separated fallback |

### URL Validation

**Must allow:**
- `http://localhost:*`
- `http://127.0.0.1:*`
- `https://*`
- Custom hostnames for Docker/WSL

Primary use case is local inference (vLLM, Ollama, LMStudio).

### UI States

1. **Empty** - Initial state, waiting for user input
2. **Testing** - Connection test in progress (show spinner)
3. **Success** - Shows discovered models, ready to save
4. **Failed** - Shows error, allows manual model entry
5. **Saving** - Save in progress

### Component Structure

```tsx
interface CustomProviderFormProps {
  provider?: CustomProvider;  // For edit mode
  onSave: (provider: CustomProvider) => void;
  onCancel: () => void;
}

export function CustomProviderForm({ provider, onSave, onCancel }: CustomProviderFormProps) {
  const [name, setName] = useState(provider?.name || '');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl || '');
  const [apiKey, setApiKey] = useState('');
  const [maxContextTokens, setMaxContextTokens] = useState(provider?.maxContextTokens || 8192);
  const [supportsVision, setSupportsVision] = useState(provider?.supportsVision || false);
  const [supportsTools, setSupportsTools] = useState(provider?.supportsTools ?? true);
  const [customModels, setCustomModels] = useState(provider?.customModels?.join(', ') || '');
  const [discoveredModels, setDiscoveredModels] = useState<string[]>(provider?.discoveredModels || []);

  const testConnection = useTestCustomProviderConnection();
  const createProvider = useCreateCustomProvider();
  const updateProvider = useUpdateCustomProvider();

  const handleTestConnection = async () => {
    const result = await testConnection.mutateAsync({ baseUrl, apiKey: apiKey || undefined });
    if (result.valid && result.models) {
      setDiscoveredModels(result.models);
    }
  };

  const handleSave = async () => {
    const data = {
      name,
      baseUrl,
      apiKey: apiKey || undefined,
      maxContextTokens,
      supportsVision,
      supportsTools,
      customModels: customModels ? customModels.split(',').map(m => m.trim()) : undefined,
    };

    if (provider) {
      const updated = await updateProvider.mutateAsync({ id: provider.id, data });
      onSave(updated);
    } else {
      const created = await createProvider.mutateAsync(data);
      onSave(created);
    }
  };

  return (
    <div className="...">
      {/* Form fields */}
      {/* Test Connection button */}
      {/* Discovered models display */}
      {/* Manual models fallback */}
      {/* Save/Cancel buttons */}
    </div>
  );
}
```

### Test Connection Flow

1. User enters Base URL + API Key
2. User clicks "Test Connection"
3. Show loading spinner
4. On success:
   - Display discovered models in a list
   - Enable "Save" button
5. On failure:
   - Show error message
   - Enable manual model entry textarea
   - Show warning: "Auto-discovery failed. Enter models manually."

---

## Skills

- `frontend-design`
- `professional-frontend-stack`

## Subagents (parallel, up to 3)

1. `Explore` - Find modal patterns in codebase
2. `Explore` - Find form validation patterns
3. `frontend-ui-architect` - Design form layout

## MCP Tools

None needed

---

## Commit Message

```
feat(web): add CustomProviderForm component
```

---

## Verification Checklist

- [ ] Component file created: `CustomProviderForm.tsx`
- [ ] Form renders correctly
- [ ] Base URL validation allows localhost
- [ ] Test connection shows results
- [ ] Manual model fallback works when discovery fails
- [ ] `pnpm typecheck` passes
