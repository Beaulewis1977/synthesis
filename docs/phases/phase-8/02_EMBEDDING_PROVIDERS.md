# Phase 8: Multi-Provider Embedding System

**Flexible, cost-effective embedding strategy**

---

## 🎯 Goals

1. **Support multiple embedding providers** (Ollama, OpenAI, Voyage)
2. **Auto-route based on content type** (docs vs code vs personal)
3. **Minimize API costs** (default to free, upgrade selectively)
4. **Track which model was used** (metadata per chunk)
5. **Simple provider switching** (environment variables)

---

## 🏗️ Architecture

### Provider Selection Flow

```
Document/Query
    ↓
Content Type Detection
  - Is it code? (imports, functions, classes)
  - Is it personal writing? (collection metadata)
  - Is it general docs? (default)
    ↓
Collection Metadata Check
  - Does collection specify provider?
  - Override auto-detection
    ↓
Environment Config
  - CODE_EMBEDDING_PROVIDER
  - DOC_EMBEDDING_PROVIDER
  - WRITING_EMBEDDING_PROVIDER
    ↓
Provider Selection
  - voyage-code-2 (for code)
  - text-embedding-3-large (for personal)
  - nomic-embed-text (for docs, default)
    ↓
Embed & Store
  - Generate embedding
  - Store with metadata: {model, dimensions}
```

---

## 📦 Implementation

### 1. Embedding Router

**File:** `apps/server/src/services/embedding-router.ts`

```typescript
export type EmbeddingProvider = 
  | 'ollama'
  | 'openai'
  | 'voyage';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
}

export interface ContentContext {
  type?: 'code' | 'docs' | 'personal';
  language?: string;
  collectionId?: string;
}

const PROVIDER_CONFIGS: Record<EmbeddingProvider, EmbeddingConfig> = {
  ollama: { provider: 'ollama', model: 'nomic-embed-text', dimensions: 768 },
  openai: { provider: 'openai', model: 'text-embedding-3-large', dimensions: 1536 },
  voyage: { provider: 'voyage', model: 'voyage-code-2', dimensions: 1024 },
};

const SUPPORTED_PROVIDERS = ['ollama', 'openai', 'voyage'] as const;

function isEmbeddingProvider(value: string): value is EmbeddingProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

export function getProviderConfig(
  provider: string | EmbeddingProvider,
  fallback: EmbeddingProvider = 'ollama'
): EmbeddingConfig {
  if (typeof provider === 'string' && !isEmbeddingProvider(provider)) {
    return PROVIDER_CONFIGS[fallback];
  }

  return PROVIDER_CONFIGS[provider as EmbeddingProvider] ?? PROVIDER_CONFIGS[fallback];
}

/**
 * Select optimal embedding provider based on content
 */
export function selectEmbeddingProvider(
  content: string,
  context?: ContentContext
): EmbeddingConfig {
  // 1. Check explicit context type
  if (context?.type === 'code') {
    return getProviderConfig('voyage');
  }
  
  if (context?.type === 'personal') {
    return getProviderConfig('openai');
  }
  
  // 2. Auto-detect code patterns
  if (isCodeContent(content)) {
    const envProvider = process.env.CODE_EMBEDDING_PROVIDER;
    return getProviderConfig(envProvider ?? 'voyage', 'voyage');
  }
  
  // 3. Default to free Ollama
  return getProviderConfig('ollama');
}

/**
 * Detect if content is code
 */
function isCodeContent(text: string): boolean {
  const codePatterns = [
    /^import\s+/m,           // imports
    /^function\s+\w+/m,      // function declarations
    /^class\s+\w+/m,         // class declarations
    /^const\s+\w+\s*=/m,     // const assignments
    /^\s*\/\/|\/\*/m,        // comments
    /{[\s\S]*}/,             // code blocks
  ];
  
  return codePatterns.some(pattern => pattern.test(text));
}
```

### 2. Enhanced Embed Service

**File:** `apps/server/src/pipeline/embed.ts` (modifications)

```typescript
import { Ollama } from 'ollama';
import OpenAI from 'openai';
import { VoyageAIClient } from '@voyageai/voyageai';
import { selectEmbeddingProvider, getProviderConfig, type ContentContext, type EmbeddingProvider } from '../services/embedding-router.js';

const ollama = new Ollama({ host: process.env.OLLAMA_HOST });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

export interface EmbedOptions {
  context?: ContentContext;
  provider?: EmbeddingProvider; // Override auto-detection
}

export interface EmbedResult {
  embedding: number[];
  provider: string;
  model: string;
  dimensions: number;
}

/**
 * Generate embedding with auto-selected or explicit provider
 */
export async function embedText(
  text: string,
  options?: EmbedOptions
): Promise<EmbedResult> {
  // Select provider
  const config = options?.provider
    ? getProviderConfig(options.provider)
    : selectEmbeddingProvider(text, options?.context);
  
  // Generate embedding
  const embedding = await generateEmbedding(text, config);
  
  return {
    embedding,
    provider: config.provider,
    model: config.model,
    dimensions: config.dimensions,
  };
}

/**
 * Generate embedding with specific provider
 */
async function generateEmbedding(
  text: string,
  config: EmbeddingConfig
): Promise<number[]> {
  switch (config.provider) {
    case 'ollama':
      return embedWithOllama(text);
    
    case 'openai':
      return embedWithOpenAI(text);
    
    case 'voyage':
      return embedWithVoyage(text);
    
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Ollama embedding (free, local)
 */
async function embedWithOllama(text: string): Promise<number[]> {
  const response = await ollama.embeddings({
    model: 'nomic-embed-text',
    prompt: text,
  });
  
  return response.embedding;
}

/**
 * OpenAI embedding (paid, high quality)
 */
async function embedWithOpenAI(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    dimensions: 1536, // Can reduce to 1024, 768 for smaller
  });
  
  return response.data[0].embedding;
}

/**
 * Voyage embedding (paid, code-specialized)
 */
async function embedWithVoyage(text: string): Promise<number[]> {
  const response = await voyage.embed({
    input: [text],
    model: 'voyage-code-2',
  });
  
  return response.embeddings[0];
}

```

### 3. Update Ingestion Pipeline

**File:** `apps/server/src/pipeline/ingest.ts` (modifications)

```typescript
// When embedding chunks, store metadata
const embedResult = await embedText(chunk.text, {
  context: {
    type: determineContentType(document),
    language: document.content_type,
    collectionId: document.collection_id,
  },
});

// Store with embedding metadata
await db.query(
  `
    INSERT INTO chunks (doc_id, chunk_index, text, embedding, metadata)
    VALUES ($1, $2, $3, $4, $5)
  `,
  [
    document.id,
    chunkIndex,
    chunk.text,
    `[${embedResult.embedding.join(',')}]`,
    JSON.stringify({
      ...chunk.metadata,
      embedding_model: embedResult.model,
      embedding_provider: embedResult.provider,
      embedding_dimensions: embedResult.dimensions,
    }),
  ]
);
```

---

## 🎛️ Configuration

### Environment Variables

```bash
# API Keys
OPENAI_API_KEY=sk-...
VOYAGE_API_KEY=vo-...
# Ollama doesn't need key (local)

# Provider Selection
DOC_EMBEDDING_PROVIDER=ollama              # General docs (free)
CODE_EMBEDDING_PROVIDER=voyage             # Code snippets (paid)
WRITING_EMBEDDING_PROVIDER=openai          # Personal writings (paid)

# OpenAI Settings
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_EMBEDDING_DIMENSIONS=1536           # Can reduce to save $

# Voyage Settings
VOYAGE_MODEL=voyage-code-2
```

### Per-Collection Override

```typescript
// Collection metadata
{
  name: "Flutter Official Docs",
  metadata: {
    embedding_provider: "voyage",         // Override for code-heavy docs
    embedding_model: "voyage-code-2",
    embedding_dimensions: 1024,
    content_type: "code",
  }
}
```

---

## 📊 Cost Analysis

### Pricing

| Provider | Model | Dimensions | Cost | Use Case |
|----------|-------|------------|------|----------|
| Ollama | nomic-embed-text | 768 | FREE | General docs, default |
| OpenAI | text-embedding-3-large | 1536 | $0.13/1M tokens | Personal writings, high quality |
| Voyage | voyage-code-2 | 1024 | $0.12/1M tokens | Code, technical docs |

### Example Monthly Costs

**Scenario: Building Flutter app with docs**

```
Ingestion (one-time):
- Flutter docs: 10MB text = ~2.5M tokens
  → Voyage: 2.5M × $0.12 = $0.30

- Backend docs: 5MB text = ~1.25M tokens
  → Ollama: FREE

- Personal writings: 2MB text = ~500k tokens
  → OpenAI: 500k × $0.13 = $0.065

Total ingestion: ~$0.37 one-time

Queries (monthly):
- 1,000 queries × ~50 tokens/query = 50k tokens
  → Ollama: FREE (most queries)
  → OpenAI: 10k tokens = $0.0013
  → Voyage: 10k tokens = $0.0012

Total monthly: ~$0.002 for queries

Total first month: ~$0.37
Total subsequent months: ~$0.002 (negligible)
```

**Verdict:** Extremely cost-effective with smart routing!

---

## 🔄 Migration Strategy

### Handling Different Dimensions

**Option 1: Separate collections** ✅ Recommended
```typescript
// Each collection uses one provider
collections = [
  {
    name: "Flutter Code",
    metadata: {
      embedding_provider: "voyage",
      embedding_model: "voyage-code-2",
      embedding_dimensions: 1024,
    },
  },
  {
    name: "General Docs",
    metadata: {
      embedding_provider: "ollama",
      embedding_model: "nomic-embed-text",
      embedding_dimensions: 768,
    },
  },
  {
    name: "My Writings",
    metadata: {
      embedding_provider: "openai",
      embedding_model: "text-embedding-3-large",
      embedding_dimensions: 1536,
    },
  },
];

// Search queries use same provider/model as collection
async function searchCollection(collectionId: string) {
  const collection = await getCollection(collectionId);
  const provider = collection.metadata.embedding_provider;
  const model = collection.metadata.embedding_model;
  
  // Embed query with same provider (ensures dimensions match)
  const queryEmbedding = await embedText(query, { provider });
  
  // Pass expected model so the search layer can validate dimensions/metrics
  return vectorSearch(queryEmbedding, collectionId, { model });
}
```

**Option 2: Normalize dimensions** (not needed if using Option 1)
- Convert all to 768d
- Loses quality from higher-dim models

### Existing Data

**No re-embedding needed:**
```typescript
// Add metadata to existing chunks
UPDATE chunks
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{embedding_model}',
  '"nomic-embed-text"'
)
WHERE metadata->>'embedding_model' IS NULL;

UPDATE chunks
SET metadata = jsonb_set(
  metadata,
  '{embedding_dimensions}',
  '768'
)
WHERE metadata->>'embedding_dimensions' IS NULL;
```

---

## 🧪 Testing

### Provider Tests

```typescript
describe('Embedding providers', () => {
  it('selects correct provider for code', async () => {
    const content = 'function myFunction() { return 42; }';
    const config = selectEmbeddingProvider(content);
    
    expect(config.provider).toBe('voyage');
    expect(config.dimensions).toBe(1024);
  });
  
  it('defaults to Ollama for general text', async () => {
    const content = 'This is a general documentation paragraph.';
    const config = selectEmbeddingProvider(content);
    
    expect(config.provider).toBe('ollama');
    expect(config.dimensions).toBe(768);
  });
  
  it('respects collection override', async () => {
    const content = 'General text';
    const config = selectEmbeddingProvider(content, {
      type: 'personal',
    });
    
    expect(config.provider).toBe('openai');
    expect(config.dimensions).toBe(1536);
  });
});

describe('embedText', () => {
  it('generates embedding with Ollama', async () => {
    const result = await embedText('test', { provider: 'ollama' });
    
    expect(result.embedding).toHaveLength(768);
    expect(result.provider).toBe('ollama');
  });
  
  it('generates embedding with OpenAI', async () => {
    const result = await embedText('test', { provider: 'openai' });
    
    expect(result.embedding).toHaveLength(1536);
    expect(result.provider).toBe('openai');
  });
  
  it('generates embedding with Voyage', async () => {
    const result = await embedText('test', { provider: 'voyage' });
    
    expect(result.embedding).toHaveLength(1024);
    expect(result.provider).toBe('voyage');
  });
});
```

---

## 🐛 Error Handling

### Provider Fallbacks

```typescript
export async function embedTextWithFallback(
  text: string,
  options?: EmbedOptions
): Promise<EmbedResult> {
  const config = selectEmbeddingProvider(text, options?.context);
  
  try {
    return await embedText(text, { ...options, provider: config.provider });
  } catch (error) {
    console.error(`Failed with ${config.provider}, falling back to Ollama`, error);
    
    // Always fall back to free local Ollama
    return await embedText(text, { ...options, provider: 'ollama' });
  }
}
```

### API Key Validation

```typescript
export function validateApiKeys(): {
  ollama: boolean;
  openai: boolean;
  voyage: boolean;
} {
  return {
    ollama: true, // Always available (local)
    openai: !!process.env.OPENAI_API_KEY,
    voyage: !!process.env.VOYAGE_API_KEY,
  };
}

// Warn on startup
const keys = validateApiKeys();
if (!keys.openai) {
  console.warn('OpenAI API key not set - personal writings will use Ollama');
}
if (!keys.voyage) {
  console.warn('Voyage API key not set - code will use Ollama');
}
```

---

## ✅ Acceptance Criteria

- [ ] Can embed text with Ollama, OpenAI, or Voyage
- [ ] Auto-selects provider based on content type
- [ ] Collection metadata can override provider
- [ ] Environment variables control defaults
- [ ] Metadata tracks which model was used per chunk
- [ ] Queries use same model as collection
- [ ] Fallback to Ollama on API errors
- [ ] Cost stays under $1/month for typical usage
- [ ] Backwards compatible with existing chunks

---

**Next:** See `03_METADATA_SCHEMA.md` for enhanced metadata system
