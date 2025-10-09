# Claude Agent Tools Specification
**Version:** 1.1  
**Last Updated:** October 8, 2025

---

## 🎯 Purpose

Define all tools the autonomous agent can use to manage your RAG system.

**Key Concept:** The agent decides WHEN and HOW to use these tools based on your requests. You don't call tools directly - you chat naturally with the agent.

---

## 🤖 Agent Architecture

#### Key files
- Conversation loop: `apps/server/src/agent/agent.ts`
- Tool factories: `apps/server/src/agent/tools.ts`

### Messages API Loop

The agent now talks directly to Anthropic's Messages API. Each turn:

1. `buildAgentTools()` returns a list of tool **definitions** (JSON schema metadata Anthropic understands) and tool **executors** (local functions that perform the work).
2. `runAgentChat()` calls `anthropic.messages.create({ …, tools })`.
3. If Claude emits any `tool_use` blocks, the matching executor runs locally and the structured results are appended as `tool_result` content.
4. The loop continues until Claude responds without tool calls or the 10-turn safety cap is hit.

```typescript
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const { tools, toolExecutors } = buildAgentTools(db, { collectionId });

while (turns < 10) {
  const response = await anthropic.messages.create({
    model: 'claude-3-7-sonnet-20250219',
    system,
    messages,
    tools, // Tool definitions from buildAgentTools
  });

  const toolUses = response.content.filter((block) => block.type === 'tool_use');
  if (toolUses.length === 0) break;

  for (const call of toolUses) {
    const executor = toolExecutors[call.name];
    const resultText = await executor(call.input);
    toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: resultText });
  }

  messages.push({ role: 'assistant', content: response.content });
  messages.push({ role: 'user', content: toolResults });
}
```

Each tool factory follows the same shape:

```typescript
export function createSearchRagTool(db: Pool, context: ToolContext) {
  const inputSchema = z.object({ /* … */ });

  return {
    definition: {
      name: 'search_rag',
      description: 'Search the RAG knowledge base…',
      input_schema: zodToJsonSchema(inputSchema),
    },
    executor: async (rawInput) => {
      const args = inputSchema.parse(rawInput);
      const results = await searchCollection(db, { /* … */ });
      return formatResult(results);
    },
  };
}
```

> **Environment:** Ensure `ANTHROPIC_API_KEY`, `DATABASE_URL`, `OLLAMA_BASE_URL`, and `STORAGE_PATH` are set (see `apps/server/.env.example`).

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

**Implementation:** `apps/server/src/agent/tools.ts`
```typescript
export function createSearchRagTool(db: Pool, context: ToolContext) {
  const inputSchema = z.object({ /* … */ });

  return {
    definition: {
      name: 'search_rag',
      description: 'Search the RAG knowledge base…',
      input_schema: zodToJsonSchema(inputSchema),
    },
    executor: async (rawInput) => {
      const args = inputSchema.parse(rawInput);
      const searchResult = await searchCollection(db, {
        query: args.query,
        collectionId: args.collection_id ?? context.collectionId,
        topK: args.top_k ?? 5,
        minSimilarity: args.min_similarity ?? 0.5,
      });

      return formatSearchPayload(searchResult);
    },
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

**Implementation:** `apps/server/src/agent/tools.ts`
```typescript
export function createAddDocumentTool(db: Pool, context: ToolContext) {
  const inputSchema = z.object({ /* … */ });

  return {
    definition: {
      name: 'add_document',
      description: 'Add a document to the RAG system…',
      input_schema: zodToJsonSchema(inputSchema),
    },
    executor: async (rawInput) => {
      const args = inputSchema.parse(rawInput);
      const download = isUrl(args.source)
        ? await downloadRemoteFile(args.source)
        : await readLocalFile(args.source);

      const document = await createDocument({
        collection_id: args.collection_id ?? context.collectionId,
        title: deriveTitle(args, download),
        content_type: resolveContentType(args, download),
        file_size: download.buffer.length,
        source_url: isUrl(args.source) ? args.source : undefined,
      });

      const filePath = await writeDocumentFile(
        args.collection_id ?? context.collectionId,
        document.id,
        inferExtension(resolveContentType(args, download), args.source),
        download.buffer
      );

      await updateDocumentStatusSafe(db, document.id, 'pending', undefined, filePath);
      ingestDocument(document.id).catch((err) => console.error('Ingestion failed', err));

      return createToolResponse('Document queued for ingestion.', {
        doc_id: document.id,
        title: document.title,
        file_path: filePath,
      });
    },
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

**Implementation:** `apps/server/src/agent/tools.ts`
```typescript
export function createFetchWebContentTool(db: Pool, context: ToolContext) {
  const inputSchema = z.object({ /* … */ });

  return {
    definition: {
      name: 'fetch_web_content',
      description: 'Fetch and process content from a URL…',
      input_schema: zodToJsonSchema(inputSchema),
    },
    executor: async (rawInput) => {
      const args = inputSchema.parse(rawInput);
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        const processed = await crawlAndQueue({ page, db, context, args });
        return createToolResponse(`Fetched and queued ${processed.length} page(s) for ingestion.`, processed);
      } finally {
        await browser.close();
      }
    },
  };
}
```

> ℹ️ **Prerequisite:** Install Playwright browsers once per environment with `pnpm --filter @synthesis/server exec -- npx playwright install chromium` so the tool can launch headless Chromium.

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

**Implementation:** `createListCollectionsTool`
- Provides tool metadata with an empty schema.
- Executor aggregates document counts per collection and returns the response via `createToolResponse`.

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

**Implementation:** `createListDocumentsTool`
- Builds a filtered query (status, limit) and serialises the resulting rows via `createToolResponse`.

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

**Implementation:** `createDeleteDocumentTool`
- Requires `confirm=true`; otherwise the executor returns a safety message.
- Deletes associated chunks, removes the document row, and deletes the stored file path before responding.

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

**Implementation:** `createGetDocumentStatusTool`
- Aggregates processing metadata (status, error message, chunk/token counts) and returns a formatted string or a not-found message.

---

### 8. restart_ingest

**Purpose:** Retry ingestion for a document that previously failed or needs to be reprocessed.

**Input Schema:**
```typescript
{
  name: "restart_ingest",
  description: "Retry ingestion for a document that failed or is stuck.",
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

**Implementation:** `createRestartIngestTool`
- Resets the document to `pending`, clears errors, and replays the ingestion pipeline before returning a confirmation string.

---

### 9. summarize_document

**Purpose:** Generate a high-level summary of a document leveraging Claude and stored chunks.

**Input Schema:**
```typescript
{
  name: "summarize_document",
  description: "Summarize a processed document using Claude.",
  input_schema: {
    type: "object",
    properties: {
      doc_id: {
        type: "string",
        description: "Document UUID"
      },
      max_chunks: {
        type: "number",
        description: "Maximum number of chunks to include in the summary prompt",
        default: 10
      }
    },
    required: ["doc_id"]
  }
}
```

**Implementation:** `createSummarizeDocumentTool`
- Validates the document and available chunks, streams up to `max_chunks` into Claude, and returns the generated summary.

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
