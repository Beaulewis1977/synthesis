# Phase 11: Enhanced Metadata Schema

**Comprehensive metadata for version tracking, source quality, and content classification**

---

## 🎯 Goals

1. **Track framework versions** (Flutter 3.24.3, Dart SDK constraints)
2. **Source quality scoring** (official vs community)
3. **Embedding model tracking** (which provider was used)
4. **Content type classification** (code vs docs vs personal)
5. **Freshness tracking** (last verified date)
6. **Backwards compatible** (extend existing JSONB field)

---

## 📋 Schema Design

### Document Metadata (JSONB)

**Full Schema:**
```typescript
interface DocumentMetadata {
  // === Source Tracking ===
  doc_type: 'official_doc' | 'code_sample' | 'repo' | 'tutorial' | 'build_plan' | 'personal_writing';
  source_url?: string;
  source_quality: 'official' | 'verified' | 'community';
  source_author?: string;
  
  // === Framework/Version Tracking ===
  framework?: 'flutter' | 'dart' | 'fastify' | 'postgres' | 'supabase' | 'firebase';
  framework_version?: string;           // e.g., "3.24.3"
  sdk_constraints?: string;             // e.g., ">=3.22.0 <4.0.0"
  compatibility_tested?: string[];      // e.g., ["3.22.0", "3.24.3"]
  
  // === Content Classification ===
  language?: 'dart' | 'typescript' | 'javascript' | 'yaml' | 'sql' | 'markdown';
  content_category?: 'api_reference' | 'tutorial' | 'example' | 'guide' | 'snippet';
  
  // === Code Context (for code documents) ===
  file_path?: string;                   // e.g., "lib/services/auth_service.dart"
  repo_name?: string;                   // e.g., "flutter/samples"
  repo_stars?: number;                  // GitHub stars (for verification)
  
  // === Embedding Tracking ===
  embedding_model: 'nomic-embed-text' | 'text-embedding-3-large' | 'voyage-code-2';
  embedding_provider: 'ollama' | 'openai' | 'voyage';
  embedding_dimensions: 768 | 1024 | 1536;
  
  // === Freshness ===
  last_verified?: Date;                 // When content was last checked
  published_date?: Date;                // Original publication
  
  // === Custom Fields ===
  tags?: string[];                      // User-defined tags
  notes?: string;                       // User notes
}
```

### Chunk Metadata (JSONB)

**Additional chunk-level metadata:**
```typescript
interface ChunkMetadata extends DocumentMetadata {
  // Inherits document-level metadata via the extends clause

  // === Chunk-Specific ===
  chunk_type?: 'text' | 'code' | 'heading' | 'list';
  heading?: string;                     // Section heading
  page?: number | string;               // Page number (PDFs)
  line_range?: [number, number];        // Line numbers in source file
  
  // === Code-Specific (Phase 10) ===
  function_name?: string;
  class_name?: string;
  imports?: string[];
  is_example?: boolean;
}
```

---

## 🗄️ Database Implementation

### Option 1: Pure JSONB (Recommended)

**No schema changes needed:**
```sql
-- Already exists:
-- metadata JSONB in documents table
-- metadata JSONB in chunks table

-- Just store structured JSON
INSERT INTO documents (title, metadata, ...)
VALUES (
  'Flutter Authentication Guide',
  '{
    "doc_type": "official_doc",
    "source_quality": "official",
    "framework": "flutter",
    "framework_version": "3.24.3",
    "sdk_constraints": ">=3.22.0 <4.0.0",
    "embedding_model": "voyage-code-2",
    "embedding_provider": "voyage",
    "embedding_dimensions": 1024,
    "last_verified": "2025-10-11"
  }'::jsonb,
  ...
);
```

**Query with metadata:**
```sql
-- Find Flutter 3.24+ official docs
SELECT d.title, d.metadata
FROM documents d
WHERE d.metadata->>'framework' = 'flutter'
  AND d.metadata->>'source_quality' = 'official'
  AND (d.metadata->>'framework_version')::text >= '3.24.0';

-- Find code embedded with Voyage
SELECT COUNT(*)
FROM chunks c
WHERE c.metadata->>'embedding_provider' = 'voyage';
```

### Option 2: Indexed Columns (Optional Optimization)

**If querying specific fields frequently:**
```sql
-- Add columns for frequently queried fields
ALTER TABLE documents 
  ADD COLUMN source_quality TEXT 
    GENERATED ALWAYS AS (metadata->>'source_quality') STORED,
  ADD COLUMN framework TEXT
    GENERATED ALWAYS AS (metadata->>'framework') STORED,
  ADD COLUMN framework_version TEXT
    GENERATED ALWAYS AS (metadata->>'framework_version') STORED;

-- Add indexes
CREATE INDEX documents_source_quality_idx ON documents(source_quality);
CREATE INDEX documents_framework_idx ON documents(framework);
CREATE INDEX documents_framework_version_idx ON documents(framework_version);
```

**Recommendation:** Start with Option 1, add Option 2 only if needed for performance.

---

## 🔧 Implementation

### 1. Metadata Builder Helper

**File:** `apps/server/src/services/metadata-builder.ts`

```typescript
import type { DocumentMetadata, ChunkMetadata } from '@synthesis/shared';

export class MetadataBuilder {
  private metadata: Partial<DocumentMetadata> = {};
  
  // === Source Tracking ===
  
  setDocType(type: DocumentMetadata['doc_type']) {
    this.metadata.doc_type = type;
    return this;
  }
  
  setSourceQuality(quality: DocumentMetadata['source_quality']) {
    this.metadata.source_quality = quality;
    return this;
  }
  
  setSourceUrl(url: string) {
    this.metadata.source_url = url;
    
    // Auto-detect quality from URL
    if (url.includes('flutter.dev') || url.includes('dart.dev')) {
      this.metadata.source_quality = 'official';
    } else if (url.includes('github.com')) {
      this.metadata.source_quality = 'verified';
    } else {
      this.metadata.source_quality = 'community';
    }
    
    return this;
  }
  
  // === Framework Tracking ===
  
  setFramework(framework: string, version?: string) {
    this.metadata.framework = framework as any;
    if (version) {
      this.metadata.framework_version = version;
    }
    return this;
  }
  
  setSdkConstraints(constraints: string) {
    this.metadata.sdk_constraints = constraints;
    return this;
  }
  
  // === Content Classification ===
  
  setLanguage(language: string) {
    this.metadata.language = language as any;
    return this;
  }
  
  setContentCategory(category: string) {
    this.metadata.content_category = category as any;
    return this;
  }
  
  // === Code Context ===
  
  setFilePath(path: string) {
    this.metadata.file_path = path;
    
    // Auto-detect language from extension
    if (path.endsWith('.dart')) this.metadata.language = 'dart';
    else if (path.endsWith('.ts')) this.metadata.language = 'typescript';
    else if (path.endsWith('.js')) this.metadata.language = 'javascript';
    else if (path.endsWith('.yaml') || path.endsWith('.yml')) this.metadata.language = 'yaml';
    
    return this;
  }
  
  setRepo(name: string, stars?: number) {
    this.metadata.repo_name = name;
    if (stars) this.metadata.repo_stars = stars;
    
    // Auto-verify if popular repo
    if (stars && stars >= 1000) {
      this.metadata.source_quality = 'verified';
    }
    
    return this;
  }
  
  // === Embedding Tracking ===
  
  setEmbedding(provider: string, model: string, dimensions: number) {
    this.metadata.embedding_provider = provider as any;
    this.metadata.embedding_model = model as any;
    this.metadata.embedding_dimensions = dimensions as any;
    return this;
  }
  
  // === Freshness ===
  
  setLastVerified(date: Date = new Date()) {
    this.metadata.last_verified = date;
    return this;
  }
  
  setPublishedDate(date: Date) {
    this.metadata.published_date = date;
    return this;
  }
  
  // === Tags & Notes ===
  
  addTags(...tags: string[]) {
    this.metadata.tags = [...(this.metadata.tags || []), ...tags];
    return this;
  }
  
  setNotes(notes: string) {
    this.metadata.notes = notes;
    return this;
  }
  
  // === Build ===
  
  build(): DocumentMetadata {
    // Set defaults
    if (!this.metadata.source_quality) {
      this.metadata.source_quality = 'community';
    }
    if (!this.metadata.doc_type) {
      this.metadata.doc_type = 'tutorial';
    }
    if (!this.metadata.embedding_model) {
      this.metadata.embedding_model = 'nomic-embed-text';
      this.metadata.embedding_provider = 'ollama';
      this.metadata.embedding_dimensions = 768;
    }
    
    return this.metadata as DocumentMetadata;
  }
}

// Convenience function
export function buildMetadata(): MetadataBuilder {
  return new MetadataBuilder();
}
```

### 2. Usage Examples

**Example 1: Official Flutter Documentation**
```typescript
import { buildMetadata } from './metadata-builder.js';

const metadata = buildMetadata()
  .setDocType('official_doc')
  .setSourceUrl('https://flutter.dev/docs/authentication')
  .setFramework('flutter', '3.24.3')
  .setSdkConstraints('>=3.22.0 <4.0.0')
  .setEmbedding('voyage', 'voyage-code-2', 1024)
  .setLastVerified()
  .addTags('authentication', 'security')
  .build();

// Result:
{
  doc_type: 'official_doc',
  source_url: 'https://flutter.dev/docs/authentication',
  source_quality: 'official',  // Auto-detected
  framework: 'flutter',
  framework_version: '3.24.3',
  sdk_constraints: '>=3.22.0 <4.0.0',
  embedding_model: 'voyage-code-2',
  embedding_provider: 'voyage',
  embedding_dimensions: 1024,
  last_verified: new Date('2025-10-11'),
  tags: ['authentication', 'security']
}
```

**Example 2: GitHub Repository Code**
```typescript
const metadata = buildMetadata()
  .setDocType('code_sample')
  .setSourceUrl('https://github.com/flutter/samples')
  .setRepo('flutter/samples', 5000) // 5k stars → verified
  .setFilePath('lib/authentication/auth_service.dart')
  .setFramework('flutter', '3.24.3')
  .setEmbedding('voyage', 'voyage-code-2', 1024)
  .build();

// Result:
{
  doc_type: 'code_sample',
  source_quality: 'verified',  // Auto-set due to stars
  repo_name: 'flutter/samples',
  repo_stars: 5000,
  file_path: 'lib/authentication/auth_service.dart',
  language: 'dart',  // Auto-detected from extension
  framework: 'flutter',
  framework_version: '3.24.3',
  embedding_model: 'voyage-code-2',
  embedding_provider: 'voyage',
  embedding_dimensions: 1024
}
```

**Example 3: Personal Writing**
```typescript
const metadata = buildMetadata()
  .setDocType('personal_writing')
  .setContentCategory('guide')
  .setLanguage('markdown')
  .setEmbedding('openai', 'text-embedding-3-large', 1536)
  .setLastVerified()
  .addTags('my-style', 'documentation-guidelines')
  .setNotes('Reference for my writing style')
  .build();
```

---

## 🔍 Querying Patterns

### Find Documents by Version

```typescript
// Find all Flutter 3.24+ documents
const docs = await db.query(`
  SELECT d.id, d.title, d.metadata
  FROM documents d
  WHERE d.metadata->>'framework' = 'flutter'
    AND string_to_array(d.metadata->>'framework_version', '.')::int[] >= string_to_array('3.24.0', '.')::int[]
  ORDER BY d.created_at DESC
`);
```

> ℹ️ JSON stores version numbers as strings, so always compare parsed numeric arrays (or a dedicated semver column) to avoid lexicographic bugs like `3.10.0` sorting before `3.2.0`.

### Filter by Source Quality

```typescript
// Official sources only
const results = await hybridSearch(db, {
  query: 'authentication',
  collectionId: 'flutter-docs',
  filters: {
    source_quality: 'official',
  },
});

// Implementation in search.ts:
WHERE d.metadata->>'source_quality' = $filter_quality
```

### Find Recently Verified Content

```typescript
// Content verified in last 6 months
const fresh = await db.query(`
  SELECT d.title, d.metadata->>'last_verified' as verified
  FROM documents d
  WHERE (d.metadata->>'last_verified')::date > NOW() - INTERVAL '6 months'
  ORDER BY (d.metadata->>'last_verified')::date DESC
`);
```

---

## 📊 Metadata Statistics

### Collection Analytics

```typescript
export async function getCollectionStats(
  db: Pool,
  collectionId: string
) {
  const stats = await db.query(`
    SELECT
      d.metadata->>'source_quality' as quality,
      d.metadata->>'framework' as framework,
      d.metadata->>'embedding_provider' as provider,
      COUNT(*) as count
    FROM documents d
    WHERE d.collection_id = $1
    GROUP BY quality, framework, provider
  `, [collectionId]);
  
  return stats.rows;
}

// Example output:
[
  { quality: 'official', framework: 'flutter', provider: 'voyage', count: 120 },
  { quality: 'verified', framework: 'flutter', provider: 'voyage', count: 45 },
  { quality: 'community', framework: 'flutter', provider: 'ollama', count: 30 },
]
```

---

## 🧪 Testing

```typescript
describe('MetadataBuilder', () => {
  it('auto-detects official source from URL', () => {
    const metadata = buildMetadata()
      .setSourceUrl('https://flutter.dev/docs')
      .build();
    
    expect(metadata.source_quality).toBe('official');
  });
  
  it('auto-detects language from file path', () => {
    const metadata = buildMetadata()
      .setFilePath('lib/services/auth.dart')
      .build();
    
    expect(metadata.language).toBe('dart');
  });
  
  it('sets verified quality for popular repos', () => {
    const metadata = buildMetadata()
      .setRepo('flutter/samples', 5000)
      .build();
    
    expect(metadata.source_quality).toBe('verified');
  });
});
```

---

## ✅ Migration

### Add Metadata to Existing Documents

```sql
-- Add default metadata to existing documents
UPDATE documents
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{source_quality}',
  '"community"'
)
WHERE metadata->>'source_quality' IS NULL;

-- Add embedding model tracking
UPDATE documents d
SET metadata = jsonb_set(
  metadata,
  '{embedding_model}',
  '"nomic-embed-text"'
)
WHERE metadata->>'embedding_model' IS NULL;

-- Add dimensions
UPDATE documents
SET metadata = jsonb_set(
  metadata,
  '{embedding_dimensions}',
  to_jsonb(768)
)
WHERE metadata->>'embedding_dimensions' IS NULL;
```

---

## 🎯 Acceptance Criteria

- [ ] Can store all metadata fields in JSONB
- [ ] MetadataBuilder creates valid metadata objects
- [ ] Auto-detection works (URL → quality, path → language)
- [ ] Can query documents by version constraints
- [ ] Can filter by source quality
- [ ] Can track which embedding model was used
- [ ] Migration adds defaults to existing documents
- [ ] Collection stats show metadata distribution

---

**Next:** See `04_TRUST_SCORING.md` for how metadata affects search ranking
