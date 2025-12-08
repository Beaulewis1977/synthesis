# Phase 17I: Settings UI Integration

## Goal

Add "Custom Providers" section to ModelsPage.

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/pages/settings/ModelsPage.tsx` | Add Custom Providers section |

---

## Implementation Details

### UI Layout

```
Settings > Models
├── LLM Features (Chat, Summary, OCR)
├── Embedding Features
├── API Keys
│   ├── [existing providers]
│   └── Test buttons (now working for Z.AI & Moonshot)
├── Custom Providers  <-- NEW
│   ├── [Add Custom Provider] button
│   ├── Custom Provider Card 1
│   ├── Custom Provider Card 2
│   └── ...
└── Reset to Defaults
```

### Custom Provider Card

```tsx
interface CustomProviderCardProps {
  provider: CustomProvider;
  onEdit: () => void;
  onDelete: () => void;
}

function CustomProviderCard({ provider, onEdit, onDelete }: CustomProviderCardProps) {
  const modelCount = (provider.discoveredModels?.length || 0) + (provider.customModels?.length || 0);

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div>
        <h4 className="font-medium">{provider.name}</h4>
        <p className="text-sm text-muted-foreground">{provider.baseUrl}</p>
        <div className="flex gap-2 mt-1">
          <Badge variant="outline">{modelCount} models</Badge>
          {provider.supportsTools && <Badge variant="secondary">Tools</Badge>}
          {provider.supportsVision && <Badge variant="secondary">Vision</Badge>}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

### Section Component

```tsx
function CustomProvidersSection() {
  const { data: providers, isLoading } = useCustomProviders();
  const deleteProvider = useDeleteCustomProvider();
  const [editingProvider, setEditingProvider] = useState<CustomProvider | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Custom Providers</h3>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Provider
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Add OpenAI-compatible LLM endpoints (vLLM, LMStudio, OpenRouter, Groq, etc.)
      </p>

      {isLoading ? (
        <div>Loading...</div>
      ) : providers?.length ? (
        <div className="space-y-2">
          {providers.map((provider) => (
            <CustomProviderCard
              key={provider.id}
              provider={provider}
              onEdit={() => {
                setEditingProvider(provider);
                setIsFormOpen(true);
              }}
              onDelete={() => deleteProvider.mutate(provider.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No custom providers configured
        </div>
      )}

      {/* Modal for CustomProviderForm */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? 'Edit Custom Provider' : 'Add Custom Provider'}
            </DialogTitle>
          </DialogHeader>
          <CustomProviderForm
            provider={editingProvider ?? undefined}
            onSave={() => {
              setIsFormOpen(false);
              setEditingProvider(null);
            }}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingProvider(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
```

---

## Skills

- `frontend-design`
- `synthesis-architecture`

## Subagents (parallel, up to 2)

1. `Explore` - Find card component patterns
2. `code-reviewer` - Review after implementation

## MCP Tools

None needed

---

## Commit Message

```
feat(web): add Custom Providers section to ModelsPage
```

---

## Verification Checklist

- [ ] "Custom Providers" section added to ModelsPage
- [ ] "Add Custom Provider" button works
- [ ] Provider cards display correctly
- [ ] Edit/Delete buttons work
- [ ] `pnpm typecheck` passes
