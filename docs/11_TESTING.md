# Testing Strategy (MVP)
**Version:** 1.0  
**Last Updated:** October 6, 2025

---

## 🎯 Overview

This project follows **Test-Driven Development (TDD)** for core functionality. Write tests BEFORE implementation.

**MVP Philosophy:** Test what matters. Don't over-test. Focus on critical paths.

---

## 📋 Testing Principles

### 1. Test First (TDD)
```
Red → Green → Refactor
1. Write failing test for acceptance criteria
2. Write minimal code to pass
3. Refactor if needed
4. Move on
```

### 2. Coverage Target
- **Target:** 70-80% code coverage (not 100%)
- **Focus:** Critical paths, edge cases, data transformations
- **Skip:** Trivial getters/setters, simple wrappers

### 3. Test Types (Keep it Simple)

**Unit Tests:** Test individual functions
- Fast (<10ms per test)
- Mock external dependencies
- Example: chunking algorithm, text extraction

**Integration Tests:** Test real interactions
- Database operations
- API endpoints
- Example: full ingestion pipeline

**Manual Tests:** For UI and complex flows
- Agent conversations
- File uploads
- MCP interactions

---

## 🛠️ Testing Framework

### Stack (Minimal)
- **Test Runner:** Vitest 2.1+ (fast, modern)
- **Assertions:** Vitest built-in
- **Mocking:** Vitest vi
- **Coverage:** v8 (built-in)

### Root package.json
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^2.1.4",
    "@vitest/coverage-v8": "^2.1.4"
  }
}
```

### vitest.config.ts (Root)
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.config.ts',
      ],
    },
  },
});
```

---

## 📁 Test Structure

```
apps/server/
├── src/
│   ├── pipeline/
│   │   ├── extract.ts
│   │   └── extract.test.ts       # Co-located with source
│   └── routes/
│       ├── ingest.ts
│       └── ingest.test.ts
└── test/
    ├── fixtures/                  # Test PDFs, etc.
    └── helpers.ts                 # Shared test utilities
```

**Naming:** `<module>.test.ts` next to the source file

---

## 📝 Test Examples

### Unit Test
```typescript
// apps/server/src/pipeline/chunk.test.ts
import { describe, it, expect } from 'vitest';
import { chunkText } from './chunk';

describe('chunkText', () => {
  it('creates chunks of max 800 chars', () => {
    const text = 'a'.repeat(2000);
    const chunks = chunkText(text, { maxSize: 800, overlap: 150 });
    
    chunks.forEach(chunk => {
      expect(chunk.text.length).toBeLessThanOrEqual(800);
    });
  });

  it('creates 150-char overlap', () => {
    const text = 'a'.repeat(2000);
    const chunks = chunkText(text, { maxSize: 800, overlap: 150 });
    
    for (let i = 0; i < chunks.length - 1; i++) {
      const endOfCurrent = chunks[i].text.slice(-150);
      const startOfNext = chunks[i + 1].text.slice(0, 150);
      expect(endOfCurrent).toBe(startOfNext);
    }
  });
});
```

### Integration Test
```typescript
// apps/server/src/pipeline/ingest.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pool } from '@synthesis/db';
import { ingestDocument } from './ingest';

describe('ingestDocument', () => {
  beforeEach(async () => {
    await pool.query('BEGIN');
  });

  afterEach(async () => {
    await pool.query('ROLLBACK');
  });

  it('processes PDF end-to-end', async () => {
    // Create test doc
    const { rows } = await pool.query(
      'INSERT INTO documents (title, file_path, content_type) VALUES ($1, $2, $3) RETURNING id',
      ['test.pdf', './test/fixtures/sample.pdf', 'application/pdf']
    );

    await ingestDocument(rows[0].id);

    // Verify chunks created
    const chunks = await pool.query(
      'SELECT COUNT(*) FROM chunks WHERE doc_id = $1',
      [rows[0].id]
    );
    expect(parseInt(chunks.rows[0].count)).toBeGreaterThan(0);
  });
});
```

### Mocking External Services
```typescript
import { vi } from 'vitest';

// Mock Ollama
vi.mock('ollama', () => ({
  Ollama: vi.fn(() => ({
    embeddings: vi.fn().mockResolvedValue({
      embedding: Array(768).fill(0.1),
    }),
  })),
}));

it('generates embeddings', async () => {
  const vector = await embedText('test');
  expect(vector).toHaveLength(768);
});
```

---

## 🔍 What to Test (MVP)

### Phase 1: Database + Pipeline
- ✅ Database connection
- ✅ PDF/DOCX/MD extraction
- ✅ File upload endpoint
- ✅ Error handling (corrupt files)

### Phase 2: Chunking + Embeddings
- ✅ Chunking algorithm
- ✅ Embedding generation (mocked)
- ✅ Pipeline orchestration

### Phase 3: Search + Agent
- ✅ Vector search
- ✅ Agent tool execution (mocked Claude)
- ✅ Chat endpoint

### Phase 4-9: Integration
- ✅ Key agent tools
- ✅ Critical UI flows
- ✅ MCP server basics

**Skip for MVP:**
- ❌ Exhaustive UI tests (manual test instead)
- ❌ Performance tests (Phase 2)
- ❌ Load tests (Phase 2)

---

## 🚀 Running Tests

```bash
# Watch mode (recommended during dev)
pnpm test:watch

# Run all tests
pnpm test

# Run specific test
pnpm test chunk

# With coverage
pnpm test:coverage
```

---

## ✅ Definition of Done

A feature is complete when:
- [ ] Tests written for acceptance criteria
- [ ] All tests passing
- [ ] Manual testing done
- [ ] No console errors

**Don't block on 100% coverage. Get it working first!**

---

## 💡 Best Practices

### DO:
- ✅ Test critical logic (chunking, search, pipeline)
- ✅ Test error cases
- ✅ Mock external services (Ollama, Claude)
- ✅ Keep tests simple and readable
- ✅ Use descriptive test names

### DON'T:
- ❌ Test trivial code
- ❌ Over-mock (use real DB in integration tests)
- ❌ Write tests just to hit coverage %
- ❌ Make tests complex (tests should be simple)

---

## 🎯 Summary

**TDD for core logic. Manual testing for UI. Don't over-test.**

**TDD Workflow:**
1. Read acceptance criteria
2. Write test
3. Make it pass
4. Move on

**Tests are safety nets, not the goal. Ship working code!**
