# MCP Agent Tool Usage Guide

**Version:** 1.0
**Created:** December 2025
**Purpose:** Guide agents in selecting and using MCP tools effectively for mobile SaaS development

---

## Quick Reference

### Tool Selection by Task Type

| Task Type | Primary Tool | Secondary Tool | Notes |
|-----------|--------------|----------------|-------|
| Feature design | `get_feature_recipe` | `search_mobile_docs` | Start with curated patterns |
| Code examples | `find_code_examples` | `search_mobile_docs` | Filter to usage_tier='example' |
| Official docs | `search_mobile_docs` | `search_rag` | Use sourceQuality='official' |
| Project analysis | `get_project_tech_stack` | `get_db_schema` | Run first on unfamiliar projects |
| Code tracing | `graph_expand_context` | `find_symbol_usages` | Use edge types for precision |
| Symbol lookup | `find_symbol_usages` | `search_rag` | When you know the symbol name |
| General search | `search_rag` | `search_mobile_docs` | Exploratory queries |

---

## Tool Profiles

### search_rag

**Purpose:** Generic semantic search across all ingested content.

**When to Use:**
- Exploratory searches where you don't know what you're looking for
- Searching across multiple content types
- No framework or feature filtering needed

**When NOT to Use:**
- Framework-specific mobile documentation → use `search_mobile_docs`
- Looking for code examples → use `find_code_examples`
- Understanding code relationships → use `graph_expand_context`

**Parameters:**
```typescript
{
  collectionId: string,     // Required: UUID of collection
  query: string,            // Required: Search query
  top_k?: number,           // Default: 5, Max: 50
  min_similarity?: number   // Default: 0.5, Range: 0-1
}
```

---

### search_mobile_docs

**Purpose:** Feature-aware search for mobile development documentation.

**When to Use:**
- Searching for framework-specific documentation (Flutter, React Native, etc.)
- Filtering by mobile features (auth, payments, offline, etc.)
- Need official documentation vs community content
- Platform-specific queries (mobile, web, backend)

**When NOT to Use:**
- Looking for working code examples → use `find_code_examples`
- Curated implementation patterns → use `get_feature_recipe`
- Project-specific code search → use `graph_expand_context`

**Parameters:**
```typescript
{
  collectionId: string,           // Required: UUID
  query: string,                  // Required: Search query
  featureTags?: string[],         // e.g., ['auth', 'payments', 'offline']
  platform?: 'mobile'|'web'|'backend'|'shared',
  framework?: string,             // e.g., 'flutter', 'react-native'
  sourceQuality?: 'official'|'verified'|'community',
  top_k?: number                  // Default: 10
}
```

---

### find_code_examples

**Purpose:** Find working code examples and sample implementations.

**When to Use:**
- Need working, copy-paste-ready code
- Looking for demo/example implementations
- Want to see how others solved a problem
- Learning a new API or pattern

**When NOT to Use:**
- Need conceptual documentation → use `search_mobile_docs`
- Looking for best practice recommendations → use `get_feature_recipe`
- Searching your own project code → use `graph_expand_context`

**Parameters:**
```typescript
{
  collectionId: string,      // Required: UUID
  query: string,             // Required: What to find examples of
  featureTags?: string[],    // Filter by features
  framework?: string,        // e.g., 'flutter', 'supabase'
  top_k?: number             // Default: 5
}
```

---

### get_feature_recipe

**Purpose:** Get curated, opinionated implementation guides for features.

**When to Use:**
- Starting a new feature and want best practices
- Need a recommended pattern/approach
- Want to avoid common pitfalls
- Building standard mobile features (auth, billing, notifications)

**When NOT to Use:**
- Need raw documentation → use `search_mobile_docs`
- Looking for variety of examples → use `find_code_examples`
- Exploring options without commitment → use `search_mobile_docs`

**Parameters:**
```typescript
{
  collectionId: string,      // Required: UUID
  featureTags: string[],     // Required: e.g., ['auth', 'supabase']
  framework?: string,        // e.g., 'flutter'
  top_k?: number             // Default: 5
}
```

---

### get_project_tech_stack

**Purpose:** Analyze and summarize a project's technology stack.

**When to Use:**
- First time working with a codebase
- Need to understand what technologies are used
- Planning integration with existing systems
- Documenting project architecture

**When NOT to Use:**
- Looking for specific code → use `graph_expand_context`
- Need documentation for a technology → use `search_mobile_docs`

**Parameters:**
```typescript
{
  collectionId: string       // Required: UUID of project collection
}
```

---

### get_db_schema

**Purpose:** Retrieve database schema information from a project.

**When to Use:**
- Need to understand data model
- Planning data migrations
- Writing queries or ORM code
- Understanding persistence layer

**When NOT to Use:**
- Need to trace data flow through code → use `graph_expand_context`
- Looking for database documentation → use `search_mobile_docs`

**Parameters:**
```typescript
{
  collectionId: string,              // Required: UUID
  tables?: string[],                 // Filter to specific tables
  include_relationships?: boolean    // Default: true
}
```

---

### graph_expand_context

**Purpose:** Expand context from seed nodes via knowledge graph traversal.

**When to Use:**
- Tracing code flow (widget → service → API → DB)
- Understanding what depends on a symbol
- Finding related code across files
- Building end-to-end context for a feature

**When NOT to Use:**
- Simple text search → use `search_rag`
- Looking for documentation → use `search_mobile_docs`
- First exploration of unknown codebase → use `get_project_tech_stack` first

**Parameters:**
```typescript
{
  collectionId: string,              // Required: UUID
  query?: string,                    // Semantic search for seeds
  seedChunkIds?: number[],           // Start from specific chunks
  seedNodeIds?: string[],            // Start from specific nodes
  maxDepth?: number,                 // Default: 3, Max: 10
  maxNodes?: number,                 // Default: 50, Max: 200
  edgeTypes?: string[],              // Filter: 'calls', 'defines', 'imports', etc.
  nodeTypes?: string[]               // Filter: 'symbol', 'table', 'chunk', etc.
}
```

**Edge Types:**
- `calls` - Function/method invocations
- `defines` - Symbol definitions
- `imports` - Import/require statements
- `depends_on` - Dependency relationships
- `persists_to` - Database persistence
- `configured_by` - Configuration references

---

### find_symbol_usages

**Purpose:** Find where a specific symbol is defined or used.

**When to Use:**
- Refactoring: need to find all usages before changing
- Understanding: where is this function called from?
- Navigation: find the definition of a symbol

**When NOT to Use:**
- Don't know the symbol name → use `search_rag` first
- Need surrounding context → use `graph_expand_context` after

**Parameters:**
```typescript
{
  collectionId: string,                     // Required: UUID
  symbolName: string,                       // Required: e.g., 'UserRepository'
  symbolKind?: 'function'|'class'|'widget'|'method'|'constant',
  includeDefinitions?: boolean,             // Default: true
  includeUsages?: boolean                   // Default: true
}
```

---

## Multi-Tool Workflows

### New Feature Implementation

```
1. get_feature_recipe        → Best practices and patterns
2. get_project_tech_stack    → Understand existing setup
3. find_code_examples        → Reference implementations
4. search_mobile_docs        → API documentation
5. graph_expand_context      → Find integration points
```

### Bug Investigation

```
1. search_rag                → Find relevant code
2. graph_expand_context      → Trace the bug's path
3. search_mobile_docs        → Check expected behavior
4. find_code_examples        → Find correct patterns
```

### Code Refactoring

```
1. find_symbol_usages        → Find all usages
2. graph_expand_context      → Understand dependencies
3. get_db_schema             → If data changes involved
4. find_code_examples        → Modern patterns to adopt
```

### Learning a New Concept

```
1. search_mobile_docs        → Conceptual understanding
2. get_feature_recipe        → Recommended approach
3. find_code_examples        → See it in action
```

---

## Worked Examples

### Example 1: "Add Stripe billing to my Flutter app"

```
Step 1: Get recommended pattern
→ get_feature_recipe(featureTags=['payments', 'stripe'], framework='flutter')

Step 2: Check existing project setup
→ get_project_tech_stack(collectionId='<project>')

Step 3: Find working code examples
→ find_code_examples(query='stripe payment flutter', featureTags=['payments'])

Step 4: Get official Stripe docs
→ search_mobile_docs(query='flutter SDK integration', framework='flutter')
```

### Example 2: "Fix the auth bug in the login flow"

```
Step 1: Find login-related code
→ search_rag(query='login authentication flow', top_k=10)

Step 2: Expand context around login flow
→ graph_expand_context(query='login authentication', edgeTypes=['calls', 'depends_on'])

Step 3: Check auth documentation
→ search_mobile_docs(query='authentication error handling', featureTags=['auth'])

Step 4: Find correct patterns
→ find_code_examples(query='login error handling flutter', featureTags=['auth'])
```

### Example 3: "How does user data persist in this project?"

```
Step 1: Get database schema
→ get_db_schema(collectionId='<project>', tables=['users', 'user_settings'])

Step 2: Trace persistence paths
→ graph_expand_context(query='user data save', edgeTypes=['persists_to', 'calls'])

Step 3: Find repository patterns
→ search_rag(query='UserRepository user persistence', top_k=5)
```

### Example 4: "Where is the PaymentService class used?"

```
Step 1: Find all usages
→ find_symbol_usages(symbolName='PaymentService', symbolKind='class')

Step 2: Understand dependencies
→ graph_expand_context(query='PaymentService', edgeTypes=['calls', 'imports'])
```

---

## Anti-Patterns

### DO NOT

| Anti-Pattern | Why It's Wrong | Correct Approach |
|--------------|----------------|------------------|
| Use `search_rag` for framework-specific docs | Misses framework/feature filtering | Use `search_mobile_docs` with filters |
| Use `search_mobile_docs` for project code | Wrong content type | Use `graph_expand_context` or `search_rag` on project collection |
| Use `graph_expand_context` without seeds | Will fail validation | Always provide query, seedChunkIds, or seedNodeIds |
| Use `find_code_examples` for best practices | Examples show "how", not "why" | Use `get_feature_recipe` first |
| Use `get_db_schema` for code that uses DB | Schema is static, code is dynamic | Use `graph_expand_context` with edgeTypes=['persists_to'] |
| Skip `get_project_tech_stack` for new codebases | Miss crucial context | Always run first on unfamiliar projects |
| Use only one tool for complex tasks | Single tool rarely has complete answer | Combine tools per workflows above |

### Common Mistakes

1. **Starting with code examples instead of recipes**
   - Mistake: Jump straight to `find_code_examples`
   - Issue: May find outdated or suboptimal patterns
   - Fix: Start with `get_feature_recipe` for recommended approach

2. **Ignoring the knowledge graph for relationship queries**
   - Mistake: Use `search_rag` for "what calls X"
   - Issue: Returns mentions, not actual call relationships
   - Fix: Use `graph_expand_context` with appropriate edgeTypes

3. **Not filtering by framework when relevant**
   - Mistake: `search_mobile_docs(query='state management')`
   - Issue: Returns results for all frameworks
   - Fix: Add `framework='flutter'` or relevant filter

4. **Using wrong collection for project vs docs**
   - Mistake: Search project code in documentation collection
   - Issue: Zero results or irrelevant results
   - Fix: Use project collection for code, docs collection for documentation

---

## Tool Selection Checklist

Before making a tool call, ask:

1. **What type of query is this?**
   - Documentation/learning → `search_mobile_docs`, `get_feature_recipe`
   - Code/implementation → `find_code_examples`, `graph_expand_context`
   - Project introspection → `get_project_tech_stack`, `get_db_schema`

2. **Is this framework-specific?**
   - Yes → Add framework parameter
   - No → Proceed without filter

3. **Do I need relationships or just search?**
   - Relationships → `graph_expand_context`
   - Simple search → `search_rag` or `search_mobile_docs`

4. **Am I looking at my project or external docs?**
   - Project code → Use project collection + graph tools
   - External docs → Use docs collection + search tools

5. **Should I combine tools?**
   - Complex task → Yes, follow multi-tool workflow
   - Simple lookup → Single tool may suffice
