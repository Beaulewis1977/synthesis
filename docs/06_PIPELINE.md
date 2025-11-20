# RAG Ingestion Pipeline
**Version:** 1.0  
**Last Updated:** October 6, 2025

---

## 🎯 Pipeline Overview

Transform uploaded documents into searchable vector embeddings through 4 stages:

```
Upload → Extract → Chunk → Embed → Store
```

Each stage updates the document status so you can track progress.

---

## 📊 Status Flow

```sql
-- Document status progression
pending → extracting → chunking → embedding → complete
                                            ↘ error
```

Status tracked in `documents.status` column.

---

## 🔄 Stage 1: Extraction

**Purpose:** Convert binary files to plain text

**File:** `apps/server/src/pipeline/extract.ts`

### Supported Formats

#### PDF (application/pdf)
```typescript
import pdfParse from 'pdf-parse';

export async function extractPDF(buffer: Buffer): Promise<ExtractionResult> {
  const data = await pdfParse(buffer);
  
  return {
    text: data.text,
    metadata: {
      pages: data.numpages,
      info: data.info,
    }
  };
}
```

**Metadata extracted:**
- Total pages
- Author (if available)
- Creation date
- Title

#### DOCX (application/vnd.openxmlformats...)
```typescript
import mammoth from 'mammoth';

export async function extractDOCX(buffer: Buffer): Promise<ExtractionResult> {
  const result = await mammoth.extractRawText({ buffer });
  
  return {
    text: result.value,
    metadata: {
      warnings: result.messages,
    }
  };
}
```

#### Markdown (text/markdown, text/plain)
```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkStringify from 'remark-stringify';

export async function extractMarkdown(buffer: Buffer): Promise<ExtractionResult> {
  const text = buffer.toString('utf-8');
  
  // Parse frontmatter if present
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkStringify);
  
  const tree = processor.parse(text);
  
  return {
    text,
    metadata: {
      frontmatter: extractFrontmatter(tree),
    }
  };
}
```

### Extraction Orchestrator

**File:** `apps/server/src/pipeline/extract.ts`

```typescript
export interface ExtractionResult {
  text: string;
  metadata: Record<string, any>;
}

export async function extractText(
  filePath: string,
  contentType: string
): Promise<ExtractionResult> {
  const buffer = await fs.readFile(filePath);
  
  switch (contentType) {
    case 'application/pdf':
      return extractPDF(buffer);
      
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractDOCX(buffer);
      
    case 'text/markdown':
    case 'text/plain':
      return extractMarkdown(buffer);
      
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }
}
```

### Error Handling

```typescript
try {
  const result = await extractText(filePath, contentType);
  await updateDocumentStatus(docId, 'chunking');
  return result;
} catch (error) {
  await updateDocumentStatus(docId, 'error', error.message);
  throw error;
}
```

---

## 🔪 Stage 2: Chunking

**Purpose:** Split text into optimal-sized pieces for embedding

**File:** `apps/server/src/pipeline/chunk.ts`

### Chunking Strategy

**Parameters:**
- Max size: **800 characters**
- Overlap: **150 characters**
- Split on: Paragraph boundaries (`\n\n`)

**Why these values?**
- 800 chars ≈ 200 tokens (within embedding model limits)
- 150 char overlap ensures context continuity
- Paragraph boundaries preserve semantic meaning

### Implementation

```typescript
export interface Chunk {
  text: string;
  chunk_index: number;
  metadata?: {
    page?: number;
    heading?: string;
    section?: string;
  };
}

export function chunkText(
  text: string,
  metadata: Record<string, any> = {}
): Chunk[] {
  const maxSize = 800;
  const overlap = 150;
  const chunks: Chunk[] = [];
  
  // Split on paragraph boundaries first
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (const paragraph of paragraphs) {
    // If paragraph alone is too big, split it
    if (paragraph.length > maxSize) {
      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          chunk_index: chunkIndex++,
          metadata: extractChunkMetadata(currentChunk, metadata),
        });
        currentChunk = '';
      }
      
      // Split large paragraph
      const subChunks = splitLongText(paragraph, maxSize, overlap);
      for (const subChunk of subChunks) {
        chunks.push({
          text: subChunk,
          chunk_index: chunkIndex++,
          metadata: extractChunkMetadata(subChunk, metadata),
        });
      }
      continue;
    }
    
    // Try to add paragraph to current chunk
    if (currentChunk.length + paragraph.length < maxSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      // Save current chunk and start new one
      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          chunk_index: chunkIndex++,
          metadata: extractChunkMetadata(currentChunk, metadata),
        });
      }
      
      // Start new chunk with overlap
      const overlap_text = getOverlap(currentChunk, overlap);
      currentChunk = overlap_text + paragraph;
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk) {
    chunks.push({
      text: currentChunk.trim(),
      chunk_index: chunkIndex++,
      metadata: extractChunkMetadata(currentChunk, metadata),
    });
  }
  
  return chunks;
}

function splitLongText(text: string, maxSize: number, overlap: number): string[] {
  const result: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = start + maxSize;
    result.push(text.slice(start, end));
    start = end - overlap;
  }
  
  return result;
}

function getOverlap(text: string, overlapSize: number): string {
  if (text.length <= overlapSize) return text;
  return text.slice(-overlapSize);
}
```

### Metadata Extraction

```typescript
function extractChunkMetadata(
  chunkText: string,
  docMetadata: Record<string, any>
): Record<string, any> {
  const metadata: Record<string, any> = {};
  
  // Extract page number if available in text (PDF)
  const pageMatch = chunkText.match(/\[Page (\d+)\]/);
  if (pageMatch) {
    metadata.page = parseInt(pageMatch[1]);
  }
  
  // Extract heading (first line if it looks like a heading)
  const lines = chunkText.split('\n');
  if (lines[0].length < 100 && /^[A-Z]/.test(lines[0])) {
    metadata.heading = lines[0];
  }
  
  // Copy relevant doc metadata
  if (docMetadata.pages) metadata.doc_pages = docMetadata.pages;
  
  return metadata;
}
```

---

## 🧠 Stage 3: Embedding

**Purpose:** Convert text chunks to vector representations

**File:** `apps/server/src/pipeline/embed.ts`

### Ollama Embeddings (Default)

```typescript
export async function embedText(text: string): Promise<number[]> {
  const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
      prompt: text,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Ollama embedding failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.embedding; // Array of 768 floats
}
```

### Batch Embedding

```typescript
export async function embedChunks(chunks: Chunk[]): Promise<Array<number[]>> {
  const embeddings: Array<number[]> = [];
  const batchSize = 10; // Process 10 chunks at a time
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    
    const batchEmbeddings = await Promise.all(
      batch.map(chunk => embedText(chunk.text))
    );
    
    embeddings.push(...batchEmbeddings);
    
    // Progress tracking
    const progress = Math.min(100, Math.round(((i + batchSize) / chunks.length) * 100));
    console.log(`Embedding progress: ${progress}%`);
  }
  
  return embeddings;
}
```

### Voyage Embeddings (Alternative)

```typescript
import { VoyageAIClient } from 'voyageai';

export async function embedWithVoyage(texts: string[]): Promise<Array<number[]>> {
  const client = new VoyageAIClient({
    apiKey: process.env.VOYAGE_API_KEY,
  });
  
  const result = await client.embed({
    input: texts,
    model: 'voyage-3.5',
  });
  
  return result.data.map(item => item.embedding);
}
```

### Toggle Logic

```typescript
export async function embed(chunks: Chunk[]): Promise<Array<number[]>> {
  const useVoyage = process.env.USE_VOYAGE === 'true';
  
  if (useVoyage) {
    return embedWithVoyage(chunks.map(c => c.text));
  } else {
    return embedChunks(chunks); // Ollama
  }
}
```

---

## 💾 Stage 4: Storage

**Purpose:** Upsert chunks with embeddings to database

**File:** `apps/server/src/pipeline/store.ts`

### Upsert Implementation

```typescript
export async function storeChunks(
  db: Pool,
  docId: string,
  chunks: Chunk[],
  embeddings: Array<number[]>
): Promise<void> {
  if (chunks.length !== embeddings.length) {
    throw new Error('Chunks and embeddings length mismatch');
  }
  
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    // Delete existing chunks for this document (if re-processing)
    await client.query('DELETE FROM chunks WHERE doc_id = $1', [docId]);
    
    // Batch insert new chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      
      await client.query(`
        INSERT INTO chunks (
          doc_id, 
          chunk_index, 
          text, 
          embedding, 
          embedding_model,
          metadata,
          token_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        docId,
        chunk.chunk_index,
        chunk.text,
        JSON.stringify(embedding), // pgvector handles array
        process.env.EMBEDDING_MODEL || 'nomic-embed-text',
        JSON.stringify(chunk.metadata || {}),
        estimateTokens(chunk.text),
      ]);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}
```

---

## 🔄 Pipeline Orchestrator

**File:** `apps/server/src/pipeline/ingest.ts`

```typescript
import { Pool } from 'pg';
import { extractText } from './extract';
import { chunkText } from './chunk';
import { embed } from './embed';
import { storeChunks } from './store';

export async function ingestDocument(
  db: Pool,
  docId: string
): Promise<void> {
  try {
    // Get document info
    const { rows } = await db.query(
      'SELECT file_path, content_type FROM documents WHERE id = $1',
      [docId]
    );
    
    if (rows.length === 0) {
      throw new Error(`Document ${docId} not found`);
    }
    
    const { file_path, content_type } = rows[0];
    
    // Stage 1: Extract
    await updateStatus(db, docId, 'extracting');
    const { text, metadata } = await extractText(file_path, content_type);
    
    // Stage 2: Chunk
    await updateStatus(db, docId, 'chunking');
    const chunks = chunkText(text, metadata);
    
    // Stage 3: Embed
    await updateStatus(db, docId, 'embedding');
    const embeddings = await embed(chunks);
    
    // Stage 4: Store
    await storeChunks(db, docId, chunks, embeddings);
    
    // Mark complete
    await updateStatus(db, docId, 'complete');
    await db.query(
      'UPDATE documents SET processed_at = NOW() WHERE id = $1',
      [docId]
    );
    
    console.log(`✓ Document ${docId} processed: ${chunks.length} chunks`);
    
  } catch (error) {
    console.error(`✗ Document ${docId} failed:`, error);
    await updateStatus(db, docId, 'error', error.message);
    throw error;
  }
}

async function updateStatus(
  db: Pool,
  docId: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  await db.query(
    `UPDATE documents 
     SET status = $1, error_message = $2, updated_at = NOW() 
     WHERE id = $3`,
    [status, errorMessage || null, docId]
  );
}
```

---

## ⚡ Performance Optimization

### Parallel Processing

```typescript
// Process multiple documents in parallel
export async function ingestBatch(
  db: Pool,
  docIds: string[]
): Promise<void> {
  const MAX_PARALLEL = 3; // Don't overwhelm GPU
  
  for (let i = 0; i < docIds.length; i += MAX_PARALLEL) {
    const batch = docIds.slice(i, i + MAX_PARALLEL);
    await Promise.all(
      batch.map(docId => ingestDocument(db, docId))
    );
  }
}
```

### Caching

```typescript
// Cache embeddings for duplicate chunks
const embeddingCache = new Map<string, number[]>();

export async function embedWithCache(text: string): Promise<number[]> {
  const hash = createHash('sha256').update(text).digest('hex');
  
  if (embeddingCache.has(hash)) {
    return embeddingCache.get(hash)!;
  }
  
  const embedding = await embedText(text);
  embeddingCache.set(hash, embedding);
  return embedding;
}
```

---

## 🧪 Testing

**File:** `apps/server/src/pipeline/__tests__/ingest.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { chunkText } from '../chunk';
import { ingestDocument } from '../ingest';

describe('Pipeline', () => {
  describe('Chunking', () => {
    it('splits text into correct chunks', () => {
      const text = 'a'.repeat(1000);
      const chunks = chunkText(text);
      
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].text.length).toBeLessThanOrEqual(800);
    });
    
    it('preserves paragraph boundaries', () => {
      const text = 'Para 1\n\nPara 2\n\nPara 3';
      const chunks = chunkText(text);
      
      expect(chunks[0].text).toContain('Para 1');
    });
  });
  
  describe('Full Pipeline', () => {
    it('processes document end-to-end', async () => {
      const docId = await uploadTestDoc();
      await ingestDocument(db, docId);
      
      const { rows } = await db.query(
        'SELECT status, COUNT(*) as chunk_count FROM documents d ' +
        'LEFT JOIN chunks c ON c.doc_id = d.id ' +
        'WHERE d.id = $1 GROUP BY d.id',
        [docId]
      );
      
      expect(rows[0].status).toBe('complete');
      expect(rows[0].chunk_count).toBeGreaterThan(0);
    });
  });
});
```

---

## 📊 Monitoring

### Progress Tracking

```typescript
// Emit progress events
import { EventEmitter } from 'events';

export class PipelineEmitter extends EventEmitter {
  emitProgress(docId: string, stage: string, percent: number) {
    this.emit('progress', { docId, stage, percent });
  }
}

export const pipelineEvents = new PipelineEmitter();

// In UI, listen for progress
pipelineEvents.on('progress', ({ docId, stage, percent }) => {
  console.log(`Document ${docId}: ${stage} ${percent}%`);
});
```

### Performance Metrics

```typescript
export interface PipelineMetrics {
  doc_id: string;
  extraction_time_ms: number;
  chunking_time_ms: number;
  embedding_time_ms: number;
  storage_time_ms: number;
  total_time_ms: number;
  chunk_count: number;
}

// Log metrics for monitoring
await logMetrics(db, metrics);
```

---

## ✅ Pipeline Checklist

For agents building this:

- [ ] Install dependencies: `pdf-parse`, `mammoth`, `unified`, `remark-*`
- [ ] Implement extraction for PDF, DOCX, Markdown
- [ ] Implement chunking with overlap
- [ ] Implement Ollama embedding client
- [ ] Implement database upsert
- [ ] Create orchestrator function
- [ ] Add status tracking
- [ ] Add error handling
- [ ] Write unit tests
- [ ] Test with real documents

---

**This pipeline is the heart of your RAG system. Build it carefully!**
