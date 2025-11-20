# Code Standards (MVP)
**Version:** 1.0  
**Last Updated:** October 6, 2025

---

## 🎯 Overview

Clean, consistent code. Not over-engineered.

**MVP Philosophy:** Use tools, not ceremony. Ship working code.

---

## 🔧 Tools (Minimal Setup)

### Required
- **TypeScript:** 5.6+ (strict mode)
- **Biome:** Fast linting + formatting (replaces ESLint + Prettier)

### Root package.json
```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.3",
    "typescript": "^5.6.2"
  }
}
```

### biome.json (Root)
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.3/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      },
      "style": {
        "noUnusedVariables": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "es5"
    }
  }
}
```

---

## 📐 TypeScript Configuration

### tsconfig.json (Root)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Strict Mode
- ✅ All strict flags enabled
- ✅ No `any` types (use `unknown`)
- ✅ Explicit return types on exported functions

---

## 📝 Naming Conventions

### Files
```
✅ kebab-case for files
- extract.ts
- search-rag.ts

✅ PascalCase for React components
- Dashboard.tsx
- ChatMessage.tsx

✅ Tests next to source
- chunk.ts
- chunk.test.ts
```

### Variables & Functions
```typescript
// ✅ camelCase for variables and functions
const documentId = 'abc';
function extractText(filePath: string): string { }

// ✅ PascalCase for types
interface SearchResult { }
type EmbeddingVector = number[];

// ✅ UPPER_SNAKE_CASE for constants
const MAX_CHUNK_SIZE = 800;
const DEFAULT_TOP_K = 5;
```

---

## 🏗️ Code Structure

### Keep Functions Small
- **Target:** < 50 lines per function
- If longer, break it up

### Keep Files Focused
- **Target:** < 300 lines per file
- One responsibility per file

### Import Order
```typescript
// 1. External packages
import { Fastify } from 'fastify';
import { z } from 'zod';

// 2. Internal packages
import { pool } from '@synthesis/db';

// 3. Relative imports
import { extractPDF } from './extract';
import type { Document } from './types';
```

---

## 💡 Best Practices

### Error Handling
```typescript
// ✅ Always catch async errors
async function processDocument(docId: string): Promise<void> {
  try {
    const doc = await getDocument(docId);
    await process(doc);
  } catch (error) {
    console.error('Failed to process:', error);
    throw new Error(`Processing failed: ${error.message}`);
  }
}

// ✅ Don't swallow errors
catch (error) {
  // ❌ Bad
  return null;
  
  // ✅ Good
  console.error(error);
  throw error;
}
```

### Async/Await
```typescript
// ✅ Use async/await
const result = await doSomething();

// ❌ Don't use .then()
doSomething().then(result => { });

// ✅ Parallel operations
const [doc, chunks] = await Promise.all([
  getDocument(docId),
  getChunks(docId),
]);
```

### Type Safety
```typescript
// ✅ Explicit types for exports
export function chunkText(text: string, options: ChunkOptions): Chunk[] {
  // ...
}

// ✅ Use unknown instead of any
function parseJSON(text: string): unknown {
  return JSON.parse(text);
}

// ✅ Type guards
function isDocument(obj: unknown): obj is Document {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'title' in obj
  );
}
```

### Comments
```typescript
// ✅ Explain WHY, not WHAT
// Retry 3 times because Ollama occasionally times out
const result = await retry(embedText, 3);

// ❌ Don't explain obvious code
// Increment i
i++;

// ✅ JSDoc for public APIs
/**
 * Searches the RAG system for relevant chunks.
 * 
 * @param query - The search query
 * @param options - Search options
 * @returns Array of search results with citations
 */
export async function searchRAG(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  // ...
}
```

---

## 🔒 Security

### Environment Variables
```typescript
// ✅ Validate at startup
const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  databaseUrl: process.env.DATABASE_URL,
};

if (!config.anthropicApiKey) {
  throw new Error('ANTHROPIC_API_KEY is required');
}

// ❌ Never commit secrets
const apiKey = 'sk-ant-1234...';  // ❌ NEVER
```

### Input Validation
```typescript
// ✅ Validate user inputs
import { z } from 'zod';

const SearchSchema = z.object({
  query: z.string().min(1).max(1000),
  collection_id: z.string().uuid(),
  top_k: z.number().int().min(1).max(50).optional(),
});

const input = SearchSchema.parse(request.body);
```

### SQL Injection
```typescript
// ✅ Always use parameterized queries
await pool.query('SELECT * FROM documents WHERE id = $1', [docId]);

// ❌ NEVER concatenate
await pool.query(`SELECT * FROM documents WHERE id = '${docId}'`);  // DANGEROUS
```

---

## 🧹 Before Committing

```bash
# 1. Fix linting/formatting
pnpm lint:fix

# 2. Check types
pnpm typecheck

# 3. Run tests
pnpm test
```

**No git hooks for MVP.** Just run these manually before pushing.

---

## 📊 Code Review Checklist

### Must-Have
- [ ] Tests passing
- [ ] No TypeScript errors
- [ ] Code formatted (Biome)
- [ ] Acceptance criteria met

### Nice-to-Have (Don't block on these)
- [ ] JSDoc on complex functions
- [ ] No obvious performance issues
- [ ] Error cases handled

---

## 🚫 Avoid These

```typescript
// ❌ Magic numbers
if (chunks.length > 10) { }

// ✅ Named constants
const MAX_CHUNKS = 10;
if (chunks.length > MAX_CHUNKS) { }

// ❌ Nested callbacks
doA(() => {
  doB(() => {
    doC(() => { });
  });
});

// ✅ Async/await
await doA();
await doB();
await doC();

// ❌ Any type
function process(data: any) { }

// ✅ Unknown + type guard
function process(data: unknown) {
  if (isValidData(data)) {
    // ...
  }
}
```

---

## 🎯 Summary

**Simple > Perfect**

Key principles:
1. **Type safety:** Strict TypeScript
2. **Consistency:** Use Biome
3. **Testability:** TDD for core logic
4. **Security:** Validate inputs, parameterize SQL

**Before commit:**
- ✅ Biome format/lint
- ✅ TypeScript check
- ✅ Tests pass

**Don't over-engineer. Ship working code!**
