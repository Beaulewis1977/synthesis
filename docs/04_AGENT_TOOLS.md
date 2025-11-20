# Claude Agent SDK - Tools Specification
**Version:** 1.0  
**Last Updated:** October 6, 2025

---

## 🎯 Purpose

Define all tools the autonomous agent can use to manage your RAG system.

**Key Concept:** The agent decides WHEN and HOW to use these tools based on your requests. You don't call tools directly - you chat naturally with the agent.

---

## 🤖 Agent Configuration

**File:** `apps/server/src/agent/agent.ts`

```typescript
import { Agent } from '@anthropic-ai/agent-sdk';
import Anthropic from '@anthropic-ai/sdk';

export function createRAGAgent(db: Pool) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  return new Agent({
    client,
    model: 'claude-3-5-sonnet-20241022',
    maxTurns: 10,  // Allow multi-step workflows
    
    systemPrompt: `You are an autonomous RAG assistant helping a developer manage documentation for multiple projects.

Your capabilities:
- Search the knowledge base across collections
- Add documents from file paths or URLs
- Fetch and process web documentation (crawl pages)
- List and manage collections and documents
- Provide answers with specific citations

Guidelines:
- Always cite sources with document title and page/section when available
- When asked to add docs, proactively fetch and process them without asking for confirmation
- If documentation is outdated, offer to update it
- Be concise but thorough in your responses
- Confirm destructive actions (delete) before executing
- Use multiple tools in sequence when needed to complete a task

Current context:
- You have access to multiple project collections (Flutter, Supabase, etc.)
- All operations are collection-scoped
- The user can switch between collections in the UI`,

    tools: [
      searchRAGTool(db),
      addDocumentTool(db),
      fetchWebContentTool(db),
      listCollectionsTool(db),
      listDocumentsTool(db),
      deleteDocumentTool(db),
      getDocumentStatusTool(db),
    ],
  });
}
```

---

## 🛠️ Tool Definitions

### 1. search_rag

**Purpose:** Search the knowledge base for relevant information

**Input Schema:**
```typescript
{
  name: "search_rag",
  description: "Search the RAG knowledge base for relevant information. Returns top matching chunks with citations.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query or question"
      },
      collection_id: {
        type: "string",
        description: "UUID of the collection to search within. Required to scope the search."
      },
      top_k: {
        type: "number",
        description: "Number of results to return",
        default: 10
      },
      min_similarity: {
        type: "number",
        description: "Minimum similarity score (0-1). Filters out low-quality matches.",
        default: 0.5
      }
    },
    required: ["query", "collection_id"]
  }
}
```

**Implementation:**
```typescript
// apps/server/src/agent/tools/search.ts
import { embedText } from '../../pipeline/embed';
import type { Pool } from 'pg';

export function searchRAGTool(db: Pool) {
  return {
    name: "search_rag",
    description: "Search the RAG knowledge base...",
    input_schema: { /* as above */ },
    
    async execute({ query, collection_id, top_k = 10, min_similarity = 0.5 }) {
      // 1. Embed the query
      const queryEmbedding = await embedText(query);
      
      // 2. Vector search
      const result = await db.query(`
        SELECT 
          ch.id,
          ch.text,
          ch.metadata,
          d.id as doc_id,
          d.title as doc_title,
          d.source_url,
          (1 - (ch.embedding <=> $1::vector)) as similarity
        FROM chunks ch
        JOIN documents d ON d.id = ch.doc_id
        WHERE d.collection_id = $2
          AND (1 - (ch.embedding <=> $1::vector)) >= $3
        ORDER BY ch.embedding <=> $1::vector
        LIMIT $4
      `, [queryEmbedding, collection_id, min_similarity, top_k]);
      
      // 3. Format results
      return {
        results: result.rows.map(row => ({
          text: row.text,
          similarity: row.similarity,
          doc_id: row.doc_id,
          doc_title: row.doc_title,
          source_url: row.source_url,
          citation: {
            title: row.doc_title,
            page: row.metadata?.page,
            section: row.metadata?.heading,
          }
        })),
        query,
        total_results: result.rows.length
      };
    }
  };
}
```

**Example Usage (by agent):**
```
User: "How do I set up RLS in Supabase?"
Agent internally: search_rag("setup RLS Supabase", collection_id, top_k=5)
Agent response: "To set up RLS in Supabase... [cites Supabase Docs, p. 34]"
```

---

### 2. add_document

**Purpose:** Add a document from local file path or URL

**Input Schema:**
```typescript
{
  name: "add_document",
  description: "Add a document to the RAG system from a file path or URL. The system will automatically extract text, chunk, embed, and index it.",
  input_schema: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description: "File path (e.g., /home/user/docs/guide.pdf) or URL (e.g., https://example.com/doc.pdf)"
      },
      collection_id: {
        type: "string",
        description: "UUID of the collection to add the document to"
      },
      title: {
        type: "string",
        description: "Optional custom title. If not provided, will be inferred from filename or URL."
      },
      metadata: {
        type: "object",
        description: "Optional metadata (tags, author, etc.)"
      }
    },
    required: ["source", "collection_id"]
  }
}
```

**Implementation:**
```typescript
// apps/server/src/agent/tools/add-doc.ts
import { ingestDocument } from '../../pipeline/ingest';

export function addDocumentTool(db: Pool) {
  return {
    name: "add_document",
    description: "Add a document to the RAG system...",
    input_schema: { /* as above */ },
    
    async execute({ source, collection_id, title, metadata = {} }) {
      // Determine if source is URL or file path
      const isURL = source.startsWith('http://') || source.startsWith('https://');
      
      let filePath: string;
      let contentType: string;
      
      if (isURL) {
        // Download file
        const response = await fetch(source);
        const buffer = await response.arrayBuffer();
        contentType = response.headers.get('content-type') || 'application/octet-stream';
        
        // Save to temp storage
        const tempPath = await saveTemp(buffer, contentType);
        filePath = tempPath;
      } else {
        // Use local file
        filePath = source;
        contentType = inferContentType(source);
      }
      
      // Infer title if not provided
      const docTitle = title || inferTitle(source);
      
      // Create document record
      const { rows } = await db.query(`
        INSERT INTO documents (collection_id, title, file_path, content_type, source_url, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [collection_id, docTitle, filePath, contentType, isURL ? source : null, metadata]);
      
      const docId = rows[0].id;
      
      // Start ingestion pipeline (async)
      ingestDocument(db, docId).catch(err => {
        console.error(`Ingestion failed for ${docId}:`, err);
      });
      
      return {
        success: true,
        doc_id: docId,
        title: docTitle,
        status: "Document added and processing started. Use get_document_status to check progress."
      };
    }
  };
}
```

---

### 3. fetch_web_content

**Purpose:** Autonomously fetch and crawl web documentation

**Input Schema:**
```typescript
{
  name: "fetch_web_content",
  description: "Fetch and process content from a URL. Can handle single pages or crawl documentation sites. Automatically converts to markdown and adds to RAG.",
  input_schema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to fetch"
      },
      collection_id: {
        type: "string",
        description: "Collection to add the fetched content to"
      },
      mode: {
        type: "string",
        enum: ["single", "crawl"],
        description: "single = just this page, crawl = follow links in same domain",
        default: "single"
      },
      max_pages: {
        type: "number",
        description: "Maximum pages to crawl (if mode=crawl)",
        default: 50
      },
      title_prefix: {
        type: "string",
        description: "Optional prefix for document titles"
      }
    },
    required: ["url", "collection_id"]
  }
}
```

**Implementation:**
```typescript
// apps/server/src/agent/tools/fetch-web.ts
import { chromium } from 'playwright';
import { htmlToMarkdown } from '../../utils/converter';

export function fetchWebContentTool(db: Pool) {
  return {
    name: "fetch_web_content",
    description: "Fetch and process content from a URL...",
    input_schema: { /* as above */ },
    
    async execute({ url, collection_id, mode = 'single', max_pages = 50, title_prefix }) {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      
      const processed: string[] = [];
      const toProcess = [url];
      const visited = new Set<string>();
      
      while (toProcess.length > 0 && processed.length < max_pages) {
        const currentURL = toProcess.shift()!;
        if (visited.has(currentURL)) continue;
        visited.add(currentURL);
        
        try {
          await page.goto(currentURL, { waitUntil: 'networkidle' });
          
          // Extract content
          const content = await page.evaluate(() => {
            // Remove nav, footer, ads
            const main = document.querySelector('main, article, .content, #content') || document.body;
            return main.innerText;
          });
          
          const html = await page.content();
          const markdown = htmlToMarkdown(html);
          
          // Get title
          const pageTitle = await page.title();
          const docTitle = title_prefix ? `${title_prefix} - ${pageTitle}` : pageTitle;
          
          // Save as document
          const { rows } = await db.query(`
            INSERT INTO documents (collection_id, title, source_url, content_type)
            VALUES ($1, $2, $3, 'text/markdown')
            RETURNING id
          `, [collection_id, docTitle, currentURL]);
          
          const docId = rows[0].id;
          
          // Save markdown to storage
          const filePath = await saveMarkdown(docId, markdown);
          await db.query(`UPDATE documents SET file_path = $1 WHERE id = $2`, [filePath, docId]);
          
          // Process
          await ingestDocument(db, docId);
          
          processed.push(currentURL);
          
          // Find more links if crawling
          if (mode === 'crawl') {
            const links = await page.evaluate((baseURL) => {
              const domain = new URL(baseURL).origin;
              return Array.from(document.querySelectorAll('a[href]'))
                .map(a => a.href)
                .filter(href => href.startsWith(domain) && !href.includes('#'));
            }, url);
            
            toProcess.push(...links.filter(link => !visited.has(link)));
          }
        } catch (error) {
          console.error(`Failed to fetch ${currentURL}:`, error);
        }
      }
      
      await browser.close();
      
      return {
        success: true,
        pages_processed: processed.length,
        urls: processed,
        message: `Successfully fetched and processed ${processed.length} page(s)`
      };
    }
  };
}
```

**Example:**
```
User: "Add the Flutter documentation"
Agent: fetch_web_content("https://docs.flutter.dev", collection_id, mode="crawl", max_pages=100)
Agent: "I've crawled the Flutter docs and added 100 pages to your collection."
```

---

### 4. list_collections

**Purpose:** See available collections

**Input Schema:**
```typescript
{
  name: "list_collections",
  description: "List all available collections with document counts",
  input_schema: {
    type: "object",
    properties: {}
  }
}
```

**Implementation:**
```typescript
export function listCollectionsTool(db: Pool) {
  return {
    name: "list_collections",
    description: "List all available collections...",
    input_schema: { type: "object", properties: {} },
    
    async execute() {
      const result = await db.query(`
        SELECT 
          c.id,
          c.name,
          c.description,
          COUNT(d.id) as doc_count,
          c.created_at
        FROM collections c
        LEFT JOIN documents d ON d.collection_id = c.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `);
      
      return {
        collections: result.rows
      };
    }
  };
}
```

---

### 5. list_documents

**Purpose:** List documents in a collection

**Input Schema:**
```typescript
{
  name: "list_documents",
  description: "List all documents in a specific collection with their processing status",
  input_schema: {
    type: "object",
    properties: {
      collection_id: {
        type: "string",
        description: "Collection UUID"
      },
      status: {
        type: "string",
        enum: ["pending", "complete", "error", "all"],
        description: "Filter by status",
        default: "all"
      },
      limit: {
        type: "number",
        default: 50
      }
    },
    required: ["collection_id"]
  }
}
```

**Implementation:**
```typescript
export function listDocumentsTool(db: Pool) {
  return {
    name: "list_documents",
    description: "List all documents...",
    input_schema: { /* as above */ },
    
    async execute({ collection_id, status = 'all', limit = 50 }) {
      const statusFilter = status === 'all' ? '' : 'AND d.status = $2';
      const params = status === 'all' ? [collection_id, limit] : [collection_id, status, limit];
      
      const result = await db.query(`
        SELECT 
          d.id,
          d.title,
          d.content_type,
          d.file_size,
          d.status,
          d.source_url,
          d.created_at,
          d.processed_at,
          COUNT(ch.id) as chunk_count
        FROM documents d
        LEFT JOIN chunks ch ON ch.doc_id = d.id
        WHERE d.collection_id = $1 ${statusFilter}
        GROUP BY d.id
        ORDER BY d.created_at DESC
        LIMIT ${status === 'all' ? '$2' : '$3'}
      `, params);
      
      return {
        documents: result.rows,
        total: result.rows.length
      };
    }
  };
}
```

---

### 6. delete_document

**Purpose:** Remove a document (with confirmation)

**Input Schema:**
```typescript
{
  name: "delete_document",
  description: "Delete a document and all its chunks from the RAG system. This is permanent.",
  input_schema: {
    type: "object",
    properties: {
      doc_id: {
        type: "string",
        description: "UUID of the document to delete"
      },
      confirm: {
        type: "boolean",
        description: "Must be true to actually delete. Safety check.",
        default: false
      }
    },
    required: ["doc_id", "confirm"]
  }
}
```

**Implementation:**
```typescript
export function deleteDocumentTool(db: Pool) {
  return {
    name: "delete_document",
    description: "Delete a document...",
    input_schema: { /* as above */ },
    
    async execute({ doc_id, confirm = false }) {
      if (!confirm) {
        return {
          success: false,
          message: "Deletion cancelled. Set confirm=true to proceed."
        };
      }
      
      // Get doc info before deletion
      const { rows } = await db.query(
        'SELECT title, file_path FROM documents WHERE id = $1',
        [doc_id]
      );
      
      if (rows.length === 0) {
        return {
          success: false,
          message: "Document not found"
        };
      }
      
      const doc = rows[0];
      
      // Delete from DB (chunks cascade)
      await db.query('DELETE FROM documents WHERE id = $1', [doc_id]);
      
      // Delete file
      if (doc.file_path) {
        await fs.unlink(doc.file_path).catch(() => {});
      }
      
      return {
        success: true,
        message: `Deleted document "${doc.title}" and all its chunks`
      };
    }
  };
}
```

---

### 7. get_document_status

**Purpose:** Check processing progress

**Input Schema:**
```typescript
{
  name: "get_document_status",
  description: "Check the processing status of a document",
  input_schema: {
    type: "object",
    properties: {
      doc_id: {
        type: "string",
        description: "Document UUID"
      }
    },
    required: ["doc_id"]
  }
}
```

**Implementation:**
```typescript
export function getDocumentStatusTool(db: Pool) {
  return {
    name: "get_document_status",
    description: "Check the processing status...",
    input_schema: { /* as above */ },
    
    async execute({ doc_id }) {
      const { rows } = await db.query(`
        SELECT 
          d.id,
          d.title,
          d.status,
          d.error_message,
          d.created_at,
          d.processed_at,
          COUNT(ch.id) as chunk_count,
          SUM(ch.token_count) as total_tokens
        FROM documents d
        LEFT JOIN chunks ch ON ch.doc_id = d.id
        WHERE d.id = $1
        GROUP BY d.id
      `, [doc_id]);
      
      if (rows.length === 0) {
        return {
          success: false,
          message: "Document not found"
        };
      }
      
      const doc = rows[0];
      
      return {
        doc_id: doc.id,
        title: doc.title,
        status: doc.status,
        error: doc.error_message,
        chunks_processed: doc.chunk_count,
        total_tokens: doc.total_tokens,
        created_at: doc.created_at,
        processed_at: doc.processed_at,
        processing_time_sec: doc.processed_at 
          ? (new Date(doc.processed_at).getTime() - new Date(doc.created_at).getTime()) / 1000
          : null
      };
    }
  };
}
```

---

## 💬 Conversation Examples

### Example 1: Simple Search
```
User: "How do I handle auth in Supabase?"

Agent (internal):
1. search_rag("handle auth Supabase", collection_id="supabase-stack", top_k=5)
2. Synthesizes answer from results

Agent: "Supabase provides several auth methods:
1. Email/password authentication
2. OAuth providers (Google, GitHub, etc.)
3. Magic links

To set up basic auth... [cites Supabase Auth Guide, p. 12-15]"
```

### Example 2: Adding Docs
```
User: "Add the Flutter widget catalog"

Agent (internal):
1. Recognizes need to fetch from web
2. fetch_web_content("https://docs.flutter.dev/ui/widgets", 
                      collection_id, 
                      mode="crawl",
                      max_pages=50)

Agent: "I'm fetching the Flutter widget catalog now... 
[processes]
Done! I've added 47 pages covering all Flutter widgets. The docs are now searchable."
```

### Example 3: Multi-Step Workflow
```
User: "I need updated Postgres docs"

Agent (internal):
1. list_documents(collection_id="supabase-stack")
2. Finds old Postgres docs from 6 months ago
3. fetch_web_content("https://www.postgresql.org/docs/16/")
4. delete_document(old_doc_id, confirm=true)

Agent: "I found your Postgres docs were 6 months old. I've fetched the latest 
Postgres 16 documentation (120 pages) and removed the outdated version. 
Your knowledge base is now up to date!"
```

---

## 🔧 Agent Behavior Configuration

**apps/server/src/agent/prompts.ts**

```typescript
export const SYSTEM_PROMPTS = {
  default: `You are an autonomous RAG assistant...`,
  
  web_crawling: `When fetching web documentation:
- Start with the main docs URL
- Crawl systematically (don't jump randomly)
- Limit to 100 pages unless specifically asked for more
- Convert everything to markdown for consistent formatting
- Extract main content only (skip navigation, ads, footers)`,
  
  citation_style: `Always cite sources in this format:
[Document Title, page X] or [Document Title, Section Y]
Example: "Use RLS for security [Supabase Docs, p. 34]"`,
  
  deletion_policy: `Before deleting anything:
1. Confirm the user really wants to delete
2. Explain what will be removed
3. Require explicit confirm=true parameter`,
};
```

---

## 🎯 Tool Execution Flow

```
User message
  ↓
Agent receives message
  ↓
Agent analyzes and plans
  ↓
Agent selects tool(s) to use
  ↓
[Tool 1] Execute → Return result
  ↓
Agent uses result to decide next step
  ↓
[Tool 2] Execute → Return result (if needed)
  ↓
Agent synthesizes final response
  ↓
Return to user
```

**Max turns = 10** means agent can use up to 10 tools in sequence before giving up.

---

## ✅ Testing Tools

**apps/server/src/agent/tools/__tests__/search.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { searchRAGTool } from '../search';

describe('search_rag tool', () => {
  it('returns relevant results', async () => {
    const tool = searchRAGTool(mockDB);
    const result = await tool.execute({
      query: "setup authentication",
      collection_id: "test-collection",
      top_k: 5
    });
    
    expect(result.results).toHaveLength(5);
    expect(result.results[0]).toHaveProperty('text');
    expect(result.results[0]).toHaveProperty('similarity');
    expect(result.results[0].similarity).toBeGreaterThan(0.5);
  });
});
```

---

**These tools give the agent full autonomous control over your RAG system.**
