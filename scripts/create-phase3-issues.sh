#!/bin/bash
# Phase 3 Issues: Search + Agent Tools
set -e

REPO="beaulewis1977/synthesis"
MILESTONE="Phase 3-4: Agent & Autonomy"

echo "📝 Creating Phase 3 issues..."

# Epic
gh issue create --repo $REPO \
  --title "Phase 3: Search and Agent Tools" \
  --label "phase-3,epic,priority:high" \
  --milestone "$MILESTONE" \
  --body "## 🎯 Overview
**Goal:** Vector search works, agent can use it

## ⏱️ Duration
Day 3 (8 hours)

## 📚 Documentation References
- **Build Plan:** \`docs/09_BUILD_PLAN.md#day-3-search--agent-tools\`
- **Agent Tools:** \`docs/04_AGENT_TOOLS.md\`
- **API Spec:** \`docs/05_API_SPEC.md#post-apisearch\` and \`#post-apiagentchat\`
- **Architecture:** \`docs/02_ARCHITECTURE.md#vector-search-engine\`
- **Agent Prompts:** \`docs/15_AGENT_PROMPTS.md#phase-3-prompt\`

## 📋 Morning Tasks (4 hours)
- Implement vector search with pgvector
- Create POST /api/search endpoint
- Test search with real queries

## 📋 Afternoon Tasks (4 hours)
- Install Claude Agent SDK
- Configure agent with system prompt
- Implement search_rag tool
- Create POST /api/agent/chat endpoint

## ✅ Acceptance Criteria
- [ ] Vector search returns relevant results with cosine similarity
- [ ] POST /api/search endpoint works
- [ ] Results include citations (doc title, page, similarity score)
- [ ] Claude Agent SDK installed (@anthropic-ai/agent-sdk ^0.4.0)
- [ ] Agent configured with system prompt
- [ ] search_rag tool implemented and registered
- [ ] POST /api/agent/chat endpoint works
- [ ] Agent responds with natural language
- [ ] Agent includes citations in responses
- [ ] Tool calling works end-to-end

## 🧪 End-to-End Test
\`\`\`bash
# Test search directly
curl -X POST http://localhost:3333/api/search \\
  -H \"Content-Type: application/json\" \\
  -d '{\"query\": \"Flutter widgets\", \"collection_id\": \"uuid\", \"top_k\": 5}'

# Test via agent
curl -X POST http://localhost:3333/api/agent/chat \\
  -H \"Content-Type: application/json\" \\
  -d '{\"message\": \"What is Flutter?\", \"collection_id\": \"uuid\"}'
\`\`\`

## 📝 Definition of Done
- [ ] All 4 story issues closed
- [ ] All tests passing
- [ ] Phase summary created
- [ ] PR merged to develop"

# Story 1: Vector Search
gh issue create --repo $REPO \
  --title "Implement vector search with pgvector" \
  --label "phase-3,feature,priority:high" \
  --milestone "$MILESTONE" \
  --body "## 📋 Context
Part of Phase 3: Search and Agent Tools - Morning task

## 🎯 What to Build
Vector search service using pgvector:
- Embed query using Ollama
- Execute cosine similarity search
- Return top-k results with citations
- POST /api/search endpoint

## 📚 Documentation
- **Architecture:** \`docs/02_ARCHITECTURE.md#vector-search-engine\`
- **API Spec:** \`docs/05_API_SPEC.md#post-apisearch\`
- **Database:** \`docs/03_DATABASE_SCHEMA.md#chunks-table\`

## 📁 Files to Create
\`\`\`
apps/server/src/
├── services/
│   ├── search.ts                 # Vector search logic
│   └── __tests__/
│       └── search.test.ts        # Unit tests
├── routes/
│   ├── search.ts                 # Search endpoint
│   └── __tests__/
│       └── search.test.ts        # Route tests
└── types/
    └── search.ts                 # Search types
\`\`\`

## 🔧 Implementation Details

### Search Service (search.ts)
\`\`\`typescript
export interface SearchOptions {
  collection_id: string;
  top_k?: number;          // Default: 5
  minSimilarity?: number;  // Default: 0.5 (filter low scores)
}

export interface SearchResult {
  chunk_id: string;
  text: string;
  similarity: number;      // Cosine similarity (0-1)
  document: {
    id: string;
    title: string;
  };
  metadata: {
    page?: number;
    section?: string;
    position: number;
  };
}

export async function searchRAG(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  // 1. Embed the query
  const queryEmbedding = await embedText(query);

  // 2. Execute pgvector cosine similarity search
  const results = await db.query(
    \`SELECT 
       c.id as chunk_id,
       c.text,
       c.position,
       c.metadata,
       d.id as doc_id,
       d.title as doc_title,
       1 - (c.embedding <=> \$1::vector) as similarity
     FROM chunks c
     JOIN documents d ON c.doc_id = d.id
     WHERE d.collection_id = \$2
       AND d.status = 'complete'
       AND 1 - (c.embedding <=> \$1::vector) >= \$3
     ORDER BY c.embedding <=> \$1::vector
     LIMIT \$4\`,
    [
      \`[\${queryEmbedding.join(',')}]\`,
      options.collection_id,
      options.minSimilarity || 0.5,
      options.top_k || 5
    ]
  );

  // 3. Format results
  return results.rows.map(row => ({
    chunk_id: row.chunk_id,
    text: row.text,
    similarity: parseFloat(row.similarity),
    document: {
      id: row.doc_id,
      title: row.doc_title
    },
    metadata: {
      ...row.metadata,
      position: row.position
    }
  }));
}
\`\`\`

### Search Endpoint (routes/search.ts)
\`\`\`typescript
import { FastifyPluginAsync } from 'fastify';
import { searchRAG } from '../services/search';

const searchRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/search', async (request, reply) => {
    const { query, collection_id, top_k } = request.body;

    if (!query || !collection_id) {
      return reply.code(400).send({
        error: 'Missing required fields: query, collection_id'
      });
    }

    const results = await searchRAG(query, {
      collection_id,
      top_k
    });

    return {
      query,
      results,
      total: results.length
    };
  });
};

export default searchRoute;
\`\`\`

## ✅ Acceptance Criteria
- [ ] \`searchRAG(query, options)\` embeds query
- [ ] Uses pgvector \`<=>\` operator for cosine distance
- [ ] Formula: \`1 - (embedding <=> query)\` gives similarity
- [ ] Filters by collection_id
- [ ] Only returns completed documents
- [ ] Filters results with minSimilarity threshold (0.5)
- [ ] Orders by similarity (highest first)
- [ ] Returns top_k results (default 5)
- [ ] Includes document title and metadata
- [ ] POST /api/search endpoint works
- [ ] Request validation (400 for missing fields)
- [ ] Error handling (500 for server errors)
- [ ] Unit tests pass
- [ ] Integration tests pass

## 🧪 Testing
\`\`\`typescript
describe('searchRAG', () => {
  it('returns relevant results', async () => {
    // Assume test data exists
    const results = await searchRAG('Flutter widgets', {
      collection_id: testCollectionId,
      top_k: 5
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
    
    // Results should be ordered by similarity
    for (let i = 1; i < results.length; i++) {
      expect(results[i-1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
    }

    // Check structure
    expect(results[0]).toHaveProperty('chunk_id');
    expect(results[0]).toHaveProperty('text');
    expect(results[0]).toHaveProperty('similarity');
    expect(results[0]).toHaveProperty('document.title');
  });

  it('filters by min similarity', async () => {
    const results = await searchRAG('irrelevant query', {
      collection_id: testCollectionId,
      minSimilarity: 0.8
    });

    results.forEach(r => {
      expect(r.similarity).toBeGreaterThanOrEqual(0.8);
    });
  });
});

// Route tests
describe('POST /api/search', () => {
  it('returns search results', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: {
        query: 'test query',
        collection_id: testCollectionId,
        top_k: 3
      }
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data).toHaveProperty('query');
    expect(data).toHaveProperty('results');
    expect(data.results.length).toBeLessThanOrEqual(3);
  });

  it('validates required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { query: 'test' } // Missing collection_id
    });

    expect(response.statusCode).toBe(400);
  });
});
\`\`\`

## 🔗 Related
- Part of Phase 3 Epic
- Enables: Story 3.3 (search_rag tool)"

# Story 2: Agent SDK Setup
gh issue create --repo $REPO \
  --title "Setup Claude Agent SDK" \
  --label "phase-3,feature,priority:high" \
  --milestone "$MILESTONE" \
  --body "## 📋 Context
Part of Phase 3: Search and Agent Tools - Afternoon task

## 🎯 What to Build
Claude Agent SDK setup:
- Install SDK packages
- Create agent instance
- Configure system prompt
- Tool registry setup

## 📚 Documentation
- **Agent Tools Overview:** \`docs/04_AGENT_TOOLS.md\`
- **Tech Stack:** \`docs/01_TECH_STACK.md#claude-agent-sdk\`
- **Architecture:** \`docs/02_ARCHITECTURE.md#agent-orchestrator\`

## 📁 Files to Create
\`\`\`
apps/server/src/agent/
├── agent.ts                      # Agent instance
├── prompts.ts                    # System prompts
├── types.ts                      # Agent types
└── __tests__/
    └── agent.test.ts             # Unit tests
\`\`\`

## 📦 Dependencies (for apps/server)
\`\`\`json
{
  \"dependencies\": {
    \"@anthropic-ai/agent-sdk\": \"^0.4.0\",
    \"@anthropic-ai/sdk\": \"^0.27.0\"
  }
}
\`\`\`

## 🔧 Implementation Details

### System Prompt (prompts.ts)
\`\`\`typescript
export const SYSTEM_PROMPT = \`You are Synthesis RAG Agent, an autonomous documentation assistant.

Your capabilities:
- Search documentation using the search_rag tool
- Fetch web content and add to collections
- Manage document collections
- Answer questions with citations

Guidelines:
1. Always cite your sources (document title and page)
2. Use search_rag to find relevant information before answering
3. Be concise but thorough
4. If you don't know something, search for it
5. Include citations in your responses

When answering, format like:
\"[Answer text]

Sources:
- [Document Title], page [X]
- [Document Title], page [Y]\"
\`;
\`\`\`

### Agent Instance (agent.ts)
\`\`\`typescript
import { Agent } from '@anthropic-ai/agent-sdk';
import { SYSTEM_PROMPT } from './prompts';

export const agent = new Agent({
  model: 'claude-3-5-sonnet-20241022',
  system: SYSTEM_PROMPT,
  apiKey: process.env.ANTHROPIC_API_KEY,
  tools: [] // Will register tools in tool files
});

export async function executeAgent(message: string, context?: any) {
  try {
    const result = await agent.execute({
      messages: [{
        role: 'user',
        content: message
      }],
      context
    });

    return {
      message: result.response,
      tool_calls: result.toolCalls || [],
      stop_reason: result.stopReason
    };
  } catch (error) {
    throw new Error(\`Agent execution failed: \${error.message}\`);
  }
}
\`\`\`

## ✅ Acceptance Criteria
- [ ] Agent SDK packages installed
- [ ] Agent instance created with correct model
- [ ] System prompt configured
- [ ] ANTHROPIC_API_KEY environment variable used
- [ ] \`executeAgent()\` function works
- [ ] Returns response message
- [ ] Returns tool_calls array
- [ ] Error handling for API failures
- [ ] Tool registry initialized (empty for now)
- [ ] Unit tests pass (mocked SDK)

## 🧪 Testing
\`\`\`typescript
jest.mock('@anthropic-ai/agent-sdk');

describe('executeAgent', () => {
  it('executes agent with message', async () => {
    const mockResponse = {
      response: 'Test response',
      toolCalls: [],
      stopReason: 'end_turn'
    };
    
    (Agent.prototype.execute as jest.Mock).mockResolvedValue(mockResponse);

    const result = await executeAgent('test message');

    expect(result.message).toBe('Test response');
    expect(result.tool_calls).toEqual([]);
  });

  it('handles API errors', async () => {
    (Agent.prototype.execute as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );

    await expect(executeAgent('test'))
      .rejects.toThrow('Agent execution failed');
  });
});
\`\`\`

## 🔗 Related
- Part of Phase 3 Epic
- Enables: Story 3.3 (search_rag tool), Story 3.4 (chat endpoint)"

# Story 3: search_rag Tool
gh issue create --repo $REPO \
  --title "Implement search_rag agent tool" \
  --label "phase-3,feature,priority:high" \
  --milestone "$MILESTONE" \
  --body "## 📋 Context
Part of Phase 3: Search and Agent Tools - Afternoon task

## 🎯 What to Build
First agent tool: search_rag
- Tool schema definition
- Execute function implementation
- Format results for agent
- Register with agent

## 📚 Documentation
- **Tool Spec:** \`docs/04_AGENT_TOOLS.md#1-search_rag\`
- **Search Service:** Already implemented in Story 3.1

## 📁 Files to Create
\`\`\`
apps/server/src/agent/tools/
├── search.ts                     # search_rag tool
└── __tests__/
    └── search.test.ts            # Tool tests
\`\`\`

## 🔧 Implementation Details

### Tool Definition (search.ts)
\`\`\`typescript
import { agent } from '../agent';
import { searchRAG } from '../../services/search';

export const searchRagTool = {
  name: 'search_rag',
  description: 'Search the RAG documentation system for relevant information. Returns relevant text chunks with citations.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query. Be specific and use keywords from the question.'
      },
      collection_id: {
        type: 'string',
        description: 'UUID of the collection to search. Required.'
      },
      top_k: {
        type: 'number',
        description: 'Number of results to return (1-10). Default: 5',
        default: 5
      }
    },
    required: ['query', 'collection_id']
  },
  async execute(params: {
    query: string;
    collection_id: string;
    top_k?: number;
  }) {
    const results = await searchRAG(params.query, {
      collection_id: params.collection_id,
      top_k: params.top_k || 5
    });

    // Format for agent
    return {
      results: results.map(r => ({
        text: r.text,
        similarity: r.similarity,
        source: {
          document: r.document.title,
          page: r.metadata.page,
          section: r.metadata.section
        }
      })),
      total: results.length
    };
  }
};

// Register tool
agent.registerTool(searchRagTool);
\`\`\`

## ✅ Acceptance Criteria
- [ ] Tool schema matches spec in \`docs/04_AGENT_TOOLS.md#1-search_rag\`
- [ ] \`execute()\` calls searchRAG service
- [ ] Formats results with text, similarity, source
- [ ] Source includes document title, page, section
- [ ] Tool registered with agent instance
- [ ] Agent can successfully call tool
- [ ] Returns results in correct format for agent
- [ ] Error handling (invalid collection_id, search failures)
- [ ] Unit tests pass

## 🧪 Testing
\`\`\`typescript
import { searchRagTool } from '../search';

jest.mock('../../services/search');

describe('search_rag tool', () => {
  it('has correct schema', () => {
    expect(searchRagTool.name).toBe('search_rag');
    expect(searchRagTool.parameters.required).toContain('query');
    expect(searchRagTool.parameters.required).toContain('collection_id');
  });

  it('executes search and formats results', async () => {
    const mockResults = [{
      chunk_id: '1',
      text: 'Test content',
      similarity: 0.9,
      document: { id: 'doc1', title: 'Test Doc' },
      metadata: { page: 1, section: 'intro', position: 0 }
    }];

    (searchRAG as jest.Mock).mockResolvedValue(mockResults);

    const result = await searchRagTool.execute({
      query: 'test',
      collection_id: 'uuid',
      top_k: 5
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toHaveProperty('text');
    expect(result.results[0]).toHaveProperty('source.document');
    expect(result.results[0].source.document).toBe('Test Doc');
  });
});
\`\`\`

## 🔗 Related
- Depends on: Story 3.1 (Vector Search), Story 3.2 (Agent SDK)
- Part of Phase 3 Epic
- Used by: Story 3.4 (Chat endpoint)"

# Story 4: Chat Endpoint
gh issue create --repo $REPO \
  --title "Create /api/agent/chat endpoint" \
  --label "phase-3,feature,priority:high" \
  --milestone "$MILESTONE" \
  --body "## 📋 Context
Part of Phase 3: Search and Agent Tools - Afternoon task

## 🎯 What to Build
POST /api/agent/chat endpoint:
- Accept user message + collection_id
- Pass to agent with context
- Return agent response
- Include tool calls in response

## 📚 Documentation
- **API Spec:** \`docs/05_API_SPEC.md#post-apiagentchat\`
- **Architecture:** \`docs/02_ARCHITECTURE.md#api-layer\`

## 📁 Files to Create
\`\`\`
apps/server/src/routes/
├── agent.ts                      # Chat endpoint
└── __tests__/
    └── agent.test.ts             # Route tests
\`\`\`

## 🔧 Implementation Details

### Chat Endpoint (agent.ts)
\`\`\`typescript
import { FastifyPluginAsync } from 'fastify';
import { executeAgent } from '../agent/agent';

const agentRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/agent/chat', async (request, reply) => {
    const { message, collection_id, history } = request.body;

    // Validation
    if (!message || !collection_id) {
      return reply.code(400).send({
        error: 'Missing required fields: message, collection_id'
      });
    }

    try {
      // Execute agent with context
      const result = await executeAgent(message, {
        collection_id,
        history: history || []
      });

      return {
        message: result.message,
        tool_calls: result.tool_calls,
        stop_reason: result.stop_reason
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Agent execution failed',
        details: error.message
      });
    }
  });
};

export default agentRoute;
\`\`\`

## ✅ Acceptance Criteria
- [ ] POST /api/agent/chat accepts JSON body
- [ ] Required fields: message, collection_id
- [ ] Optional field: history (for conversation context)
- [ ] Passes message to agent.execute()
- [ ] Passes collection_id in context
- [ ] Returns agent response message
- [ ] Returns tool_calls array
- [ ] Returns stop_reason
- [ ] Request validation (400 for missing fields)
- [ ] Error handling (500 for agent failures)
- [ ] Logs errors for debugging
- [ ] Unit tests pass
- [ ] Integration tests pass

## 🧪 Testing
\`\`\`bash
# Manual test
curl -X POST http://localhost:3333/api/agent/chat \\
  -H \"Content-Type: application/json\" \\
  -d '{
    \"message\": \"What is Flutter?\",
    \"collection_id\": \"<uuid>\"
  }'

# Expected response
{
  \"message\": \"Flutter is a UI toolkit... [detailed answer]\\n\\nSources:\\n- Flutter Guide, page 1\",
  \"tool_calls\": [
    {
      \"tool\": \"search_rag\",
      \"input\": {\"query\": \"Flutter overview\", \"collection_id\": \"uuid\"}
    }
  ],
  \"stop_reason\": \"end_turn\"
}
\`\`\`

\`\`\`typescript
// Automated tests
describe('POST /api/agent/chat', () => {
  it('executes agent and returns response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/agent/chat',
      payload: {
        message: 'test question',
        collection_id: testCollectionId
      }
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('tool_calls');
    expect(Array.isArray(data.tool_calls)).toBe(true);
  });

  it('validates required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/agent/chat',
      payload: { message: 'test' } // Missing collection_id
    });

    expect(response.statusCode).toBe(400);
  });

  it('handles agent errors', async () => {
    // Mock agent to throw error
    (executeAgent as jest.Mock).mockRejectedValue(new Error('Test error'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/agent/chat',
      payload: {
        message: 'test',
        collection_id: testCollectionId
      }
    });

    expect(response.statusCode).toBe(500);
  });
});
\`\`\`

## 🔗 Related
- Depends on: Story 3.2 (Agent SDK), Story 3.3 (search_rag tool)
- Part of Phase 3 Epic
- Completes Phase 3
- Enables user/agent interaction"

echo "✅ Phase 3 issues created (1 epic + 4 stories)"
