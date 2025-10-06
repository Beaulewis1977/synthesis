#!/bin/bash
# Phase 2 Issues: Chunking + Embeddings
set -e

REPO="beaulewis1977/synthesis"
MILESTONE="Phase 1-2: Core Pipeline"

echo "📝 Creating Phase 2 issues..."

# Epic
gh issue create --repo $REPO \
  --title "Phase 2: Chunking and Embeddings" \
  --label "phase-2,epic,priority:high" \
  --milestone "$MILESTONE" \
  --body "## 🎯 Overview
**Goal:** Process uploaded docs into searchable chunks with embeddings

## ⏱️ Duration
Day 2 (8 hours)

## 📚 Documentation References
- **Build Plan:** \`docs/09_BUILD_PLAN.md#day-2-chunking--embeddings\`
- **Pipeline Chunking:** \`docs/06_PIPELINE.md#stage-2-chunking\`
- **Pipeline Embedding:** \`docs/06_PIPELINE.md#stage-3-embedding\`
- **Pipeline Storage:** \`docs/06_PIPELINE.md#stage-4-storage\`
- **Architecture:** \`docs/02_ARCHITECTURE.md#rag-pipeline\`
- **Agent Prompts:** \`docs/15_AGENT_PROMPTS.md#phase-2-prompt\`

## 📋 Morning Tasks (4 hours)
- Implement 800-char chunking with 150-char overlap
- Split on paragraph boundaries
- Unit test chunking logic

## 📋 Afternoon Tasks (4 hours)
- Ollama embedding integration (nomic-embed-text)
- Batch processing (10 chunks at a time)
- Full pipeline orchestrator (extract → chunk → embed → store)
- Update document status tracking

## ✅ Acceptance Criteria
- [ ] Text chunked into 800-char pieces with 150-char overlap
- [ ] Chunks split on paragraph boundaries when possible
- [ ] Metadata preserved in chunks (page numbers, section)
- [ ] Ollama embeddings generated (768 dimensions)
- [ ] Batch processing handles 10 chunks at a time
- [ ] Chunks stored in database with embeddings
- [ ] Document status updated: pending → processing → complete
- [ ] Error handling sets status to 'error'
- [ ] Full pipeline processes document end-to-end

## 🧪 End-to-End Test
\`\`\`typescript
// Upload and process a document
const { documents } = await uploadDocument({
  collection_id: testCollectionId,
  files: ['test.pdf']
});

const docId = documents[0].id;

// Trigger ingestion
await ingestDocument(docId);

// Verify chunks created
const chunks = await db.query(
  'SELECT COUNT(*), AVG(LENGTH(text)), AVG(array_length(embedding, 1)) FROM chunks WHERE doc_id = \$1',
  [docId]
);

console.log(\`Created \${chunks.rows[0].count} chunks\`);
console.log(\`Avg chunk size: \${chunks.rows[0].avg} chars\`);
console.log(\`Embedding dims: \${chunks.rows[0].avg}\`); // Should be 768
\`\`\`

## 📝 Definition of Done
- [ ] All 3 story issues closed
- [ ] All tests passing
- [ ] Phase summary created
- [ ] PR merged to develop"

# Story 1: Chunking
gh issue create --repo $REPO \
  --title "Implement text chunking with overlap" \
  --label "phase-2,feature,priority:high" \
  --milestone "$MILESTONE" \
  --body "## 📋 Context
Part of Phase 2: Chunking and Embeddings - Morning task

## 🎯 What to Build
Text chunking with overlap:
- **Chunk size:** 800 characters
- **Overlap:** 150 characters between chunks
- **Smart splitting:** Prefer paragraph boundaries (\\n\\n)
- **Metadata:** Preserve page numbers, section info

## 📚 Documentation
- **Chunking Strategy:** \`docs/06_PIPELINE.md#stage-2-chunking\`
- **Architecture:** \`docs/02_ARCHITECTURE.md#chunking-strategy\`

## 📁 Files to Create
\`\`\`
apps/server/src/pipeline/
├── chunk.ts                      # Chunking logic
├── __tests__/
│   └── chunk.test.ts             # Unit tests
└── types.ts                      # Update with Chunk type
\`\`\`

## 🔧 Implementation Details

### Function Signature
\`\`\`typescript
export interface ChunkOptions {
  maxSize: number;        // 800
  overlap: number;        // 150
  splitOn?: string;       // '\\n\\n' for paragraphs
}

export interface Chunk {
  text: string;
  position: number;       // Chunk index (0, 1, 2...)
  metadata: {
    pageNumber?: number;
    section?: string;
    startOffset: number;  // Character offset in original
    endOffset: number;
  };
}

export function chunkText(
  text: string, 
  options: ChunkOptions
): Chunk[];
\`\`\`

### Algorithm
1. **Try paragraph splitting:**
   - Split text on \\n\\n
   - Group paragraphs until ~800 chars
   - Add 150-char overlap from previous chunk

2. **Fallback to character splitting:**
   - If paragraph > 800 chars, split at 800
   - Try to split on sentence boundary (. ! ?)
   - Add 150-char overlap

3. **Preserve metadata:**
   - Track character offsets
   - Preserve page numbers if available
   - Store chunk position

## ✅ Acceptance Criteria
- [ ] \`chunkText()\` returns array of Chunk objects
- [ ] Each chunk.text ≤ 800 characters
- [ ] Consecutive chunks have 150-char overlap
- [ ] Splits on \\n\\n boundaries when possible
- [ ] Falls back to sentence/character boundaries
- [ ] Metadata includes position and offsets
- [ ] Handles edge cases (empty text, single word > 800 chars)
- [ ] Unit tests verify all behaviors
- [ ] Tests pass

## 🧪 Testing
\`\`\`typescript
describe('chunkText', () => {
  it('creates chunks of max 800 chars', () => {
    const text = 'a'.repeat(2000);
    const chunks = chunkText(text, { maxSize: 800, overlap: 150 });
    
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(chunk => {
      expect(chunk.text.length).toBeLessThanOrEqual(800);
    });
  });

  it('creates 150-char overlap between chunks', () => {
    const text = 'a'.repeat(2000);
    const chunks = chunkText(text, { maxSize: 800, overlap: 150 });
    
    for (let i = 0; i < chunks.length - 1; i++) {
      const endOfCurrent = chunks[i].text.slice(-150);
      const startOfNext = chunks[i + 1].text.slice(0, 150);
      expect(endOfCurrent).toBe(startOfNext);
    }
  });

  it('splits on paragraph boundaries', () => {
    const text = 'Para 1.\\n\\nPara 2.\\n\\nPara 3.';
    const chunks = chunkText(text, { maxSize: 800, overlap: 150 });
    
    // Should keep paragraphs together
    expect(chunks[0].text).toContain('Para 1.');
  });

  it('preserves metadata', () => {
    const text = 'test text';
    const chunks = chunkText(text, { maxSize: 800, overlap: 150 });
    
    expect(chunks[0].position).toBe(0);
    expect(chunks[0].metadata.startOffset).toBe(0);
    expect(chunks[0].metadata.endOffset).toBeGreaterThan(0);
  });
});
\`\`\`

## 🔗 Related
- Part of Phase 2 Epic
- Enables: Story 2.2 (Ollama Embeddings)
- Used by: Story 2.3 (Pipeline Orchestrator)"

# Story 2: Ollama Embeddings
gh issue create --repo $REPO \
  --title "Integrate Ollama embeddings" \
  --label "phase-2,feature,priority:high" \
  --milestone "$MILESTONE" \
  --body "## 📋 Context
Part of Phase 2: Chunking and Embeddings - Afternoon task

## 🎯 What to Build
Ollama embedding integration:
- Use **nomic-embed-text** model (768 dimensions)
- Batch processing: 10 chunks at a time
- Error handling and retries
- Connection pooling

## 📚 Documentation
- **Embedding Stage:** \`docs/06_PIPELINE.md#stage-3-embedding\`
- **Tech Stack:** \`docs/01_TECH_STACK.md#ollama\`
- **Architecture:** \`docs/02_ARCHITECTURE.md#embedding-engine\`

## 📁 Files to Create
\`\`\`
apps/server/src/pipeline/
├── embed.ts                      # Ollama client
├── __tests__/
│   └── embed.test.ts             # Unit tests (mocked)
└── config.ts                     # Ollama config
\`\`\`

## 📦 Dependencies (for apps/server)
\`\`\`json
{
  \"dependencies\": {
    \"ollama\": \"^0.5.0\"
  }
}
\`\`\`

## 🔧 Implementation Details

### Function Signatures
\`\`\`typescript
export interface EmbedOptions {
  model?: string;          // Default: 'nomic-embed-text'
  batchSize?: number;      // Default: 10
  maxRetries?: number;     // Default: 3
}

export async function embedText(
  text: string,
  options?: EmbedOptions
): Promise<number[]>;  // 768-dim vector

export async function embedBatch(
  texts: string[],
  options?: EmbedOptions
): Promise<number[][]>;  // Array of 768-dim vectors
\`\`\`

### Ollama Client Setup
\`\`\`typescript
import { Ollama } from 'ollama';

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434'
});

export async function embedText(text: string): Promise<number[]> {
  try {
    const response = await ollama.embeddings({
      model: 'nomic-embed-text',
      prompt: text
    });
    
    return response.embedding; // 768-dim array
  } catch (error) {
    // Retry logic
    throw new Error(\`Embedding failed: \${error.message}\`);
  }
}
\`\`\`

### Batch Processing
- Process in batches of 10 to avoid overwhelming Ollama
- Use Promise.all() for parallel requests within batch
- Sequential batches (don't parallelize batches)
- Retry failed embeddings up to 3 times

## ✅ Acceptance Criteria
- [ ] \`embedText(text)\` returns 768-dimensional vector
- [ ] All vector values are numbers
- [ ] \`embedBatch(texts)\` processes multiple texts
- [ ] Batch size configurable (default 10)
- [ ] Connects to Ollama at http://localhost:11434
- [ ] Handles Ollama connection errors gracefully
- [ ] Retry logic: 3 attempts with exponential backoff
- [ ] Environment variable OLLAMA_HOST supported
- [ ] Unit tests pass (with mocked Ollama)

## 🧪 Testing
\`\`\`typescript
// Mock Ollama for unit tests
jest.mock('ollama');

describe('embedText', () => {
  it('returns 768-dimensional vector', async () => {
    const mockEmbedding = Array(768).fill(0.1);
    (ollama.embeddings as jest.Mock).mockResolvedValue({
      embedding: mockEmbedding
    });
    
    const vector = await embedText('test text');
    
    expect(vector).toHaveLength(768);
    expect(vector.every(n => typeof n === 'number')).toBe(true);
  });

  it('retries on failure', async () => {
    (ollama.embeddings as jest.Mock)
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValueOnce({ embedding: Array(768).fill(0.1) });
    
    const vector = await embedText('test');
    expect(vector).toHaveLength(768);
  });
});

describe('embedBatch', () => {
  it('processes 10 texts at a time', async () => {
    const texts = Array(25).fill('test');
    const vectors = await embedBatch(texts);
    
    expect(vectors).toHaveLength(25);
    expect(vectors[0]).toHaveLength(768);
  });
});
\`\`\`

### Manual Integration Test
\`\`\`bash
# Ensure Ollama is running
ollama serve

# Test embedding
node -e \"
const { embedText } = require('./dist/pipeline/embed');
embedText('test').then(v => console.log('Dimensions:', v.length));
\"
# Should output: Dimensions: 768
\`\`\`

## 🔗 Related
- Depends on: Story 2.1 (Chunking)
- Part of Phase 2 Epic
- Used by: Story 2.3 (Pipeline Orchestrator)"

# Story 3: Pipeline Orchestrator
gh issue create --repo $REPO \
  --title "Implement full ingestion orchestrator" \
  --label "phase-2,feature,priority:high" \
  --milestone "$MILESTONE" \
  --body "## 📋 Context
Part of Phase 2: Chunking and Embeddings - Afternoon task

## 🎯 What to Build
Full ingestion pipeline orchestrator:
- **Extract** → **Chunk** → **Embed** → **Store**
- Document status tracking
- Progress updates
- Error handling

## 📚 Documentation
- **Pipeline Overview:** \`docs/06_PIPELINE.md#pipeline-orchestrator\`
- **Storage Stage:** \`docs/06_PIPELINE.md#stage-4-storage\`
- **Architecture:** \`docs/02_ARCHITECTURE.md#ingestion-pipeline\`

## 📁 Files to Create
\`\`\`
apps/server/src/pipeline/
├── ingest.ts                     # Main orchestrator
├── store.ts                      # Database upsert
├── __tests__/
│   └── ingest.integration.test.ts  # E2E tests
└── types.ts                      # Update with pipeline types
\`\`\`

## 🔧 Implementation Details

### Main Orchestrator (ingest.ts)
\`\`\`typescript
export async function ingestDocument(docId: string): Promise<void> {
  try {
    // 1. Update status to 'processing'
    await db.query(
      'UPDATE documents SET status = \$1, updated_at = NOW() WHERE id = \$2',
      ['processing', docId]
    );

    // 2. Get document info
    const doc = await db.query(
      'SELECT * FROM documents WHERE id = \$1',
      [docId]
    );
    const { file_path, content_type } = doc.rows[0];

    // 3. Extract text
    const { text, metadata } = await extractDocument(file_path, content_type);

    // 4. Chunk text
    const chunks = chunkText(text, {
      maxSize: 800,
      overlap: 150
    });

    // 5. Embed chunks (batched)
    const embeddings = await embedBatch(
      chunks.map(c => c.text),
      { batchSize: 10 }
    );

    // 6. Store chunks with embeddings
    await storeChunks(docId, chunks, embeddings);

    // 7. Update status to 'complete'
    await db.query(
      'UPDATE documents SET status = \$1, updated_at = NOW() WHERE id = \$2',
      ['complete', docId]
    );

  } catch (error) {
    // Update status to 'error'
    await db.query(
      'UPDATE documents SET status = \$1, error = \$2, updated_at = NOW() WHERE id = \$3',
      ['error', error.message, docId]
    );
    throw error;
  }
}
\`\`\`

### Storage (store.ts)
\`\`\`typescript
export async function storeChunks(
  docId: string,
  chunks: Chunk[],
  embeddings: number[][]
): Promise<void> {
  // Batch insert all chunks
  const values = chunks.map((chunk, i) => [
    docId,
    chunk.text,
    chunk.position,
    \`[\${embeddings[i].join(',')}]\`, // pgvector format
    JSON.stringify(chunk.metadata)
  ]);

  await db.query(
    \`INSERT INTO chunks (doc_id, text, position, embedding, metadata)
     VALUES \${values.map((_, i) => \`(\$\${i*5+1}, \$\${i*5+2}, \$\${i*5+3}, \$\${i*5+4}, \$\${i*5+5})\`).join(', ')}\`,
    values.flat()
  );
}
\`\`\`

### Helper: Extract based on content type
\`\`\`typescript
async function extractDocument(filePath: string, contentType: string) {
  switch (contentType) {
    case 'application/pdf':
      return extractPDF(filePath);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractDOCX(filePath);
    case 'text/markdown':
      return extractMarkdown(filePath);
    default:
      throw new Error(\`Unsupported content type: \${contentType}\`);
  }
}
\`\`\`

## ✅ Acceptance Criteria
- [ ] \`ingestDocument(docId)\` processes full pipeline
- [ ] Updates document.status: pending → processing → complete
- [ ] Calls extract based on content_type
- [ ] Chunks text into 800-char pieces
- [ ] Embeds all chunks (batched)
- [ ] Stores chunks with embeddings in database
- [ ] On error: sets status to 'error' and stores error message
- [ ] Handles all document types (PDF, DOCX, MD)
- [ ] Integration test passes with real database
- [ ] Transaction handling (rollback on error)

## 🧪 Testing
\`\`\`typescript
// Integration test (requires test database)
describe('ingestDocument', () => {
  let testDocId: string;

  beforeAll(async () => {
    // Setup test database and collection
    // Upload test.pdf
    const { documents } = await uploadDocument({
      collection_id: testCollectionId,
      files: [fs.createReadStream('test.pdf')]
    });
    testDocId = documents[0].id;
  });

  it('processes document end-to-end', async () => {
    await ingestDocument(testDocId);

    // Verify document status
    const doc = await db.query(
      'SELECT status FROM documents WHERE id = \$1',
      [testDocId]
    );
    expect(doc.rows[0].status).toBe('complete');

    // Verify chunks created
    const chunks = await db.query(
      'SELECT COUNT(*), AVG(array_length(embedding, 1)) as dim FROM chunks WHERE doc_id = \$1',
      [testDocId]
    );
    expect(parseInt(chunks.rows[0].count)).toBeGreaterThan(0);
    expect(chunks.rows[0].dim).toBe(768);
  });

  it('handles errors gracefully', async () => {
    // Upload corrupted file
    const { documents } = await uploadCorruptedFile();
    
    await expect(ingestDocument(documents[0].id))
      .rejects.toThrow();

    // Verify status set to error
    const doc = await db.query(
      'SELECT status, error FROM documents WHERE id = \$1',
      [documents[0].id]
    );
    expect(doc.rows[0].status).toBe('error');
    expect(doc.rows[0].error).toBeTruthy();
  });
});
\`\`\`

## 🔗 Related
- Depends on: Story 2.1 (Chunking), Story 2.2 (Embeddings)
- Part of Phase 2 Epic
- Completes Phase 2
- Enables: Phase 3 (Search)"

echo "✅ Phase 2 issues created (1 epic + 3 stories)"
