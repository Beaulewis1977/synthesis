#!/bin/bash
# Phase 1 Issues: Database + Core Pipeline
set -e

REPO="beaulewis1977/synthesis"
MILESTONE="Phase 1-2: Core Pipeline"

echo "📝 Creating Phase 1 issues..."

# Epic
gh issue create --repo $REPO \
  --title "Phase 1: Database Setup and Core Pipeline" \
  --label "phase-1,epic,priority:high" \
  --milestone "$MILESTONE" \
  --body "## 🎯 Overview
**Goal:** Upload a PDF, extract text, store in database

## ⏱️ Duration
Day 1 (8 hours)

## 📚 Documentation References
- **Build Plan:** \`docs/09_BUILD_PLAN.md#day-1-database--core-pipeline\`
- **Database Schema:** \`docs/03_DATABASE_SCHEMA.md\`
- **Pipeline Details:** \`docs/06_PIPELINE.md#stage-1-extraction\`
- **API Spec:** \`docs/05_API_SPEC.md#post-apiingest\`
- **Architecture:** \`docs/02_ARCHITECTURE.md#data-layer\`
- **Agent Prompts:** \`docs/15_AGENT_PROMPTS.md#phase-1-prompt\`

## 📋 Morning Tasks (4 hours)
- Database schema and migrations
- Database client setup
- Connection pool configuration

## 📋 Afternoon Tasks (4 hours)
- PDF/DOCX/Markdown extraction
- File upload endpoint
- End-to-end test

## ✅ Acceptance Criteria
- [ ] 3 tables created: collections, documents, chunks
- [ ] pgvector extension enabled
- [ ] HNSW index created on chunks.embedding
- [ ] Migration runner works
- [ ] POST /api/ingest accepts files
- [ ] PDF extraction works
- [ ] DOCX extraction works
- [ ] Markdown extraction works
- [ ] Files saved to \`storage/{collection_id}/\`
- [ ] Document records in database

## 🧪 End-to-End Test
\`\`\`bash
# Upload PDF
curl -F \"collection_id=\$(uuidgen)\" -F \"files=@test.pdf\" \\
  http://localhost:3333/api/ingest

# Verify in database
docker compose exec db psql -U postgres -d synthesis \\
  -c \"SELECT id, title, status FROM documents;\"
\`\`\`

## 📝 Definition of Done
- [ ] All 3 story issues closed
- [ ] All tests passing
- [ ] Phase summary created (use \`docs/PHASE_SUMMARY_TEMPLATE.md\`)
- [ ] PR created and merged to develop"

# Story 1: Database Schema
gh issue create --repo $REPO \
  --title "Create database schema and migrations" \
  --label "phase-1,feature,priority:high" \
  --milestone "$MILESTONE" \
  --body "## 📋 Context
Part of Phase 1: Database Setup - Morning task

## 🎯 What to Build
Initial database schema with pgvector:
- 3 tables: \`collections\`, \`documents\`, \`chunks\`
- pgvector extension for embeddings
- HNSW index for fast vector search
- Migration runner script

## 📚 Documentation
- **Complete Schema:** \`docs/03_DATABASE_SCHEMA.md\`
- **Migration SQL:** See migration 001_initial_schema.sql in docs
- **Architecture:** \`docs/02_ARCHITECTURE.md#data-layer\`

## 📁 Files to Create
\`\`\`
packages/db/
├── migrations/
│   └── 001_initial_schema.sql    # Full schema from docs
├── src/
│   ├── client.ts                 # Connection pool setup
│   ├── queries.ts                # Basic CRUD operations
│   ├── migrate.ts                # Migration runner
│   └── index.ts                  # Package exports
├── package.json
└── tsconfig.json
\`\`\`

## 📦 Dependencies
\`\`\`json
{
  \"name\": \"@synthesis/db\",
  \"dependencies\": {
    \"pg\": \"^8.11.3\"
  },
  \"devDependencies\": {
    \"@types/pg\": \"^8.10.9\",
    \"typescript\": \"^5.6.2\"
  }
}
\`\`\`

## 🔧 Implementation Details

### Migration SQL (001_initial_schema.sql)
Copy exact schema from \`docs/03_DATABASE_SCHEMA.md\`:
- Enable pgvector extension
- Create collections table (id, name, description, created_at)
- Create documents table (id, collection_id FK, title, content_type, etc.)
- Create chunks table (id, doc_id FK, text, embedding vector(768), etc.)
- Create HNSW index on chunks.embedding
- Add all constraints and indexes

### Connection Pool (client.ts)
\`\`\`typescript
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
\`\`\`

### Migration Runner (migrate.ts)
- Read SQL files from migrations/
- Track applied migrations
- Apply new migrations in order
- Handle errors gracefully

## ✅ Acceptance Criteria
- [ ] All 3 tables created with exact schema from docs
- [ ] pgvector extension installed: \`CREATE EXTENSION vector\`
- [ ] HNSW index created: \`CREATE INDEX chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops)\`
- [ ] Foreign keys work correctly
- [ ] Migration runner applies 001_initial_schema.sql
- [ ] Connection pool connects successfully
- [ ] Can execute queries from Node.js
- [ ] Connection pooling configured (max 20 connections)

## 🧪 Testing
\`\`\`bash
# Run migration
cd packages/db
pnpm migrate

# Verify tables
docker compose exec db psql -U postgres -d synthesis -c \"\\dt\"
# Should show: collections, documents, chunks

# Verify pgvector
docker compose exec db psql -U postgres -d synthesis \\
  -c \"SELECT * FROM pg_extension WHERE extname='vector';\"

# Verify indexes
docker compose exec db psql -U postgres -d synthesis \\
  -c \"SELECT indexname, indexdef FROM pg_indexes WHERE tablename='chunks';\"

# Test connection from Node
node -e \"const {pool} = require('./dist/client'); pool.query('SELECT 1').then(() => console.log('✅ Connected'))\"
\`\`\`

## 🔗 Related
- Part of Phase 1 Epic
- Blocks: Story 1.2 (Extraction), Story 1.3 (Upload)"

# Story 2: Extraction
gh issue create --repo $REPO \
  --title "Implement PDF/DOCX/MD extraction" \
  --label "phase-1,feature,priority:high" \
  --milestone "$MILESTONE" \
  --body "## 📋 Context
Part of Phase 1: Core Pipeline - Afternoon task

## 🎯 What to Build
Text extraction from 3 document types:
- **PDF:** Extract text and metadata (page count, title)
- **DOCX:** Extract text preserving basic structure
- **Markdown:** Parse and extract text content

## 📚 Documentation
- **Pipeline Stage 1:** \`docs/06_PIPELINE.md#stage-1-extraction\`
- **Architecture:** \`docs/02_ARCHITECTURE.md#ingestion-pipeline\`

## 📁 Files to Create
\`\`\`
apps/server/src/
├── pipeline/
│   ├── extract.ts                # Main extraction logic
│   ├── __tests__/
│   │   └── extract.test.ts       # Unit tests
│   └── types.ts                  # Shared types
\`\`\`

## 📦 Dependencies (for apps/server)
\`\`\`json
{
  \"dependencies\": {
    \"pdf-parse\": \"^1.1.1\",
    \"mammoth\": \"^1.6.0\",
    \"unified\": \"^11.0.4\",
    \"remark-parse\": \"^11.0.0\",
    \"remark-stringify\": \"^11.0.0\"
  }
}
\`\`\`

## 🔧 Implementation Details

### Function Signatures
\`\`\`typescript
// extract.ts
export async function extractPDF(filePath: string): Promise<ExtractionResult>;
export async function extractDOCX(filePath: string): Promise<ExtractionResult>;
export async function extractMarkdown(filePath: string): Promise<ExtractionResult>;

interface ExtractionResult {
  text: string;
  metadata: {
    title?: string;
    pageCount?: number;
    author?: string;
    wordCount: number;
  };
}
\`\`\`

### PDF Extraction
Use pdf-parse library:
- Extract all text content
- Get page count from \`info.numPages\`
- Handle encrypted PDFs gracefully
- Preserve line breaks

### DOCX Extraction
Use mammoth library:
- Extract text with basic formatting
- Get document properties (title, author)
- Handle images (skip or note)

### Markdown Extraction
Use remark/unified:
- Parse markdown to AST
- Extract plain text
- Preserve structure hints

## ✅ Acceptance Criteria
- [ ] \`extractPDF(path)\` returns text and metadata
- [ ] \`extractDOCX(path)\` returns text and metadata
- [ ] \`extractMarkdown(path)\` returns text and metadata
- [ ] Handles corrupt/invalid files with errors
- [ ] Extracts metadata (title, page count, etc.)
- [ ] Unit tests cover all 3 file types
- [ ] Tests use real sample files
- [ ] All tests pass

## 🧪 Testing
\`\`\`typescript
// extract.test.ts
import { extractPDF, extractDOCX, extractMarkdown } from '../extract';

describe('extractPDF', () => {
  it('extracts text from valid PDF', async () => {
    const result = await extractPDF('./test-files/sample.pdf');
    expect(result.text).toContain('expected content');
    expect(result.metadata.pageCount).toBeGreaterThan(0);
  });
  
  it('throws error for invalid PDF', async () => {
    await expect(extractPDF('./test-files/invalid.pdf'))
      .rejects.toThrow();
  });
});

// Similar tests for DOCX and Markdown
\`\`\`

Create \`test-files/\` directory with sample documents for testing.

## 🔗 Related
- Depends on: Story 1.1 (Database)
- Part of Phase 1 Epic
- Enables: Story 1.3 (Upload endpoint)"

# Story 3: Upload Endpoint
gh issue create --repo $REPO \
  --title "Implement file upload endpoint" \
  --label "phase-1,feature,priority:high" \
  --milestone "$MILESTONE" \
  --body "## 📋 Context
Part of Phase 1: Core Pipeline - Afternoon task

## 🎯 What to Build
POST /api/ingest endpoint with multipart file upload:
- Accept file uploads (multiple files)
- Save files to storage directory
- Create document records in database
- Return document IDs

## 📚 Documentation
- **API Spec:** \`docs/05_API_SPEC.md#post-apiingest\`
- **Architecture:** \`docs/02_ARCHITECTURE.md#api-layer\`

## 📁 Files to Create
\`\`\`
apps/server/src/
├── routes/
│   ├── ingest.ts                 # Upload route
│   └── __tests__/
│       └── ingest.test.ts        # Route tests
├── services/
│   └── storage.ts                # File storage service
└── types/
    └── api.ts                    # Request/response types
\`\`\`

## 📦 Dependencies (for apps/server)
\`\`\`json
{
  \"dependencies\": {
    \"@fastify/multipart\": \"^8.3.0\",
    \"@fastify/cors\": \"^9.0.1\"
  }
}
\`\`\`

## 🔧 Implementation Details

### Route Registration (ingest.ts)
\`\`\`typescript
import { FastifyPluginAsync } from 'fastify';
import { MultipartFile } from '@fastify/multipart';

const ingestRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/ingest', async (request, reply) => {
    // Handle multipart upload
    const parts = request.parts();
    let collectionId: string;
    const files: MultipartFile[] = [];
    
    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'collection_id') {
        collectionId = part.value as string;
      } else if (part.type === 'file') {
        files.push(part);
      }
    }
    
    // Save files and create records
    // Return document IDs
  });
};
\`\`\`

### Storage Service
- Create \`storage/{collection_id}/\` directory
- Save files with original names (handle duplicates)
- Return file paths

### Database Records
- Create document record for each file
- Set status to 'pending'
- Store file_path, content_type, file_size
- Return document IDs

## ✅ Acceptance Criteria
- [ ] POST /api/ingest accepts multipart/form-data
- [ ] Accepts \`collection_id\` field (required, UUID)
- [ ] Accepts \`files\` field (one or more files)
- [ ] Validates collection exists in database
- [ ] Saves files to \`storage/{collection_id}/\` directory
- [ ] Creates document record for each file
- [ ] Sets content_type based on file extension
- [ ] Returns array of document IDs
- [ ] Handles errors (missing collection_id, invalid files, etc.)
- [ ] CORS enabled for development
- [ ] Tests pass

## 🧪 Testing
\`\`\`bash
# Manual test with curl
curl -F \"collection_id=550e8400-e29b-41d4-a716-446655440000\" \\
     -F \"files=@test.pdf\" \\
     -F \"files=@test.docx\" \\
     http://localhost:3333/api/ingest

# Expected response
{
  \"documents\": [
    {
      \"id\": \"uuid-1\",
      \"title\": \"test.pdf\",
      \"content_type\": \"application/pdf\",
      \"status\": \"pending\"
    },
    {
      \"id\": \"uuid-2\",
      \"title\": \"test.docx\",
      \"content_type\": \"application/vnd.openxmlformats-officedocument.wordprocessingml.document\",
      \"status\": \"pending\"
    }
  ]
}
\`\`\`

\`\`\`typescript
// Automated test
import { build } from '../app';

test('POST /api/ingest uploads files', async () => {
  const app = await build();
  
  const form = new FormData();
  form.append('collection_id', testCollectionId);
  form.append('files', fs.createReadStream('test.pdf'));
  
  const response = await app.inject({
    method: 'POST',
    url: '/api/ingest',
    payload: form,
    headers: form.getHeaders()
  });
  
  expect(response.statusCode).toBe(200);
  expect(response.json().documents).toHaveLength(1);
  
  // Verify file exists
  const filePath = \`storage/\${testCollectionId}/test.pdf\`;
  expect(fs.existsSync(filePath)).toBe(true);
});
\`\`\`

## 🔗 Related
- Depends on: Story 1.1 (Database), Story 1.2 (Extraction)
- Part of Phase 1 Epic
- Completes Phase 1"

echo "✅ Phase 1 issues created (1 epic + 3 stories)"
