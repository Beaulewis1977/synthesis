# MCP Tool Selection Decision Tree

**Version:** 1.0
**Created:** December 2025
**Purpose:** Guide agents in selecting the optimal MCP tool(s) for any given query

---

## Table of Contents

1. [Quick Reference Table](#1-quick-reference-table)
2. [Decision Tree (Text-Based)](#2-decision-tree-text-based)
3. [Visual Decision Flow](#3-visual-decision-flow)
4. [Tool Profiles](#4-tool-profiles)
5. [Worked Examples](#5-worked-examples)
6. [Multi-Tool Workflows](#6-multi-tool-workflows)
7. [Anti-Patterns](#7-anti-patterns)

---

## 1. Quick Reference Table

### Query Pattern to Tool Mapping

| Query Pattern | Primary Tool | Fallback Tool | Notes |
|---------------|--------------|---------------|-------|
| "How do I implement X?" | `get_feature_recipe` | `search_mobile_docs` | Start with curated recipes |
| "Show me examples of X" | `find_code_examples` | `search_mobile_docs` | Filter to usage_tier='example' |
| "What does the official docs say about X?" | `search_mobile_docs` | `search_rag` | Use sourceQuality='official' filter |
| "How does this project do X?" | `graph_expand_context` | `find_symbol_usages` | Start from known entry point |
| "Where is X in the code?" | `find_symbol_usages` | `search_rag` | Use symbol name if known |
| "What tech stack does this use?" | `get_project_tech_stack` | `list_documents` | Aggregates detection results |
| "What's the database schema?" | `get_db_schema` | `graph_expand_context` | Filter nodeTypes=['table','column'] |
| "Trace the flow from X to Y" | `graph_expand_context` | N/A | Use edgeTypes filter |
| "Find docs about X for Flutter" | `search_mobile_docs` | `search_rag` | Add framework filter |
| "What calls this function?" | `graph_expand_context` | `find_symbol_usages` | edgeTypes=['calls'] |

### Tool Purpose Summary

| Tool | Purpose | Best For |
|------|---------|----------|
| `search_rag` | Generic semantic search | General queries, exploratory search |
| `search_mobile_docs` | Feature-aware mobile doc search | Framework-specific documentation |
| `find_code_examples` | Find working code samples | Implementation references |
| `get_feature_recipe` | Curated implementation guides | Best practices, patterns |
| `get_project_tech_stack` | Analyze project technologies | Understanding existing codebases |
| `get_db_schema` | Database structure info | Data modeling, persistence |
| `graph_expand_context` | Knowledge graph traversal | Code flow, relationships |
| `find_symbol_usages` | Symbol location search | Refactoring, understanding usage |

---

## 2. Decision Tree (Text-Based)

```
START: What is the user asking about?
|
+---> DOCUMENTATION / LEARNING
|     |
|     +---> "How do I implement X?"
|     |     |
|     |     +---> Is X a common feature (auth, billing, notifications)?
|     |           |
|     |           +---> YES --> get_feature_recipe(featureTags=[X])
|     |           |             THEN: find_code_examples(query=X) for implementation
|     |           |
|     |           +---> NO --> search_mobile_docs(query=X, featureTags=[...])
|     |                        THEN: find_code_examples if docs insufficient
|     |
|     +---> "What does official docs say about X?"
|     |     |
|     |     +---> search_mobile_docs(query=X, sourceQuality='official')
|     |           OR: search_rag with collection filtered to official docs
|     |
|     +---> "Show me examples of X"
|           |
|           +---> Is X framework-specific?
|                 |
|                 +---> YES --> find_code_examples(query=X, framework='flutter')
|                 |
|                 +---> NO --> find_code_examples(query=X)
|                              THEN: search_mobile_docs if examples insufficient
|
+---> CODE / IMPLEMENTATION
|     |
|     +---> "Where is X defined/used?"
|     |     |
|     |     +---> Is X a symbol name (function, class, variable)?
|     |           |
|     |           +---> YES --> find_symbol_usages(symbolName=X)
|     |           |
|     |           +---> NO --> search_rag(query=X)
|     |                        OR: graph_expand_context(query=X)
|     |
|     +---> "What calls/imports X?"
|     |     |
|     |     +---> graph_expand_context(
|     |             query=X OR seedChunkIds from prior search,
|     |             edgeTypes=['calls','imports']
|     |           )
|     |
|     +---> "Trace flow from X to Y"
|           |
|           +---> graph_expand_context(
|                   query=X,
|                   edgeTypes=['calls','persists_to','configured_by'],
|                   maxDepth=5
|                 )
|
+---> PROJECT INTROSPECTION
|     |
|     +---> "What tech stack is used?"
|     |     |
|     |     +---> get_project_tech_stack(collectionId=...)
|     |
|     +---> "What's the database schema?"
|     |     |
|     |     +---> get_db_schema(collectionId=...)
|     |           THEN: graph_expand_context(nodeTypes=['table','column'])
|     |                 if relationships needed
|     |
|     +---> "How is data persisted?"
|           |
|           +---> graph_expand_context(
|                   query='persistence' OR symbol name,
|                   edgeTypes=['persists_to'],
|                   nodeTypes=['symbol','table']
|                 )
|
+---> MAINTENANCE / REFACTORING
      |
      +---> "What depends on X?"
      |     |
      |     +---> graph_expand_context(
      |             query=X,
      |             edgeTypes=['depends_on','imports','calls']
      |           )
      |
      +---> "Where is config for X?"
      |     |
      |     +---> graph_expand_context(
      |             query=X,
      |             edgeTypes=['configured_by'],
      |             nodeTypes=['config_section']
      |           )
      |
      +---> "Find all files related to X"
            |
            +---> search_rag(query=X)
                  THEN: graph_expand_context to expand related context
```

---

## 3. Visual Decision Flow

```
                              +------------------+
                              |   User Query     |
                              +--------+---------+
                                       |
                    +------------------+------------------+
                    |                  |                  |
              LEARN/DOCS          CODE/IMPL         INTROSPECT
                    |                  |                  |
         +----------+----------+      |      +-----------+-----------+
         |          |          |      |      |           |           |
     Patterns   Official   Examples   |   TechStack   Schema    Trace
         |          |          |      |      |           |           |
         v          v          v      v      v           v           v
    +---------+ +--------+ +------+ +----+ +-----+ +--------+ +-------+
    |get_feat_| |search_ | |find_ | |find| |get_ | |get_db_ | |graph_ |
    |recipe   | |mobile_ | |code_ | |symb| |proj_| |schema  | |expand_|
    +---------+ |docs    | |examp.| |usag| |tech | +--------+ |context|
                +--------+ +------+ +----+ +-----+            +-------+
                    |          |      |
                    +----------+------+
                               |
                          (combine for
                         complex queries)
```

### Tool Selection Priority by Task Type

```
FEATURE DESIGN (new feature implementation)
  1. get_feature_recipe     <-- Start here for best practices
  2. search_mobile_docs     <-- Official documentation
  3. find_code_examples     <-- Working implementations

IMPLEMENTATION (writing actual code)
  1. find_code_examples     <-- Start with working code
  2. search_mobile_docs     <-- API reference
  3. graph_expand_context   <-- Understand integration points

INTEGRATION (connecting to existing code)
  1. get_project_tech_stack <-- Understand what exists
  2. graph_expand_context   <-- Find connection points
  3. find_symbol_usages     <-- Locate specific symbols

MAINTENANCE (fixing/modifying existing code)
  1. find_symbol_usages     <-- Find the code
  2. graph_expand_context   <-- Understand dependencies
  3. get_db_schema          <-- If data-related
```

---

## 4. Tool Profiles

### search_rag

**Purpose:** Generic semantic search across all ingested content

**When to Use:**
- Exploratory searches where you don't know what you're looking for
- Searching across multiple content types
- No framework or feature filtering needed

**When NOT to Use:**
- Framework-specific mobile documentation (use `search_mobile_docs`)
- Looking for code examples specifically (use `find_code_examples`)
- Understanding code relationships (use `graph_expand_context`)

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

**Purpose:** Feature-aware search for mobile development documentation

**When to Use:**
- Searching for framework-specific documentation (Flutter, React Native, etc.)
- Filtering by mobile features (auth, payments, offline, etc.)
- Need official documentation vs community content
- Platform-specific queries (mobile, web, backend)

**When NOT to Use:**
- Looking for working code examples (use `find_code_examples`)
- Curated implementation patterns (use `get_feature_recipe`)
- Project-specific code search (use `graph_expand_context`)

**Parameters:**
```typescript
{
  collectionId: string,           // Required: UUID
  query: string,                  // Required: Search query
  featureTags?: string[],         // e.g., ['auth', 'payments', 'offline']
  platform?: 'mobile'|'web'|'backend'|'shared',
  framework?: string,             // e.g., 'flutter', 'react-native'
  top_k?: number                  // Default: 10
}
```

---

### find_code_examples

**Purpose:** Find working code examples and sample implementations

**When to Use:**
- Need working, copy-paste-ready code
- Looking for demo/example implementations
- Want to see how others solved a problem
- Learning a new API or pattern

**When NOT to Use:**
- Need conceptual documentation (use `search_mobile_docs`)
- Looking for best practice recommendations (use `get_feature_recipe`)
- Searching your own project code (use `graph_expand_context`)

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

**Purpose:** Get curated, opinionated implementation guides for features

**When to Use:**
- Starting a new feature and want best practices
- Need a recommended pattern/approach
- Want to avoid common pitfalls
- Building standard mobile features (auth, billing, notifications)

**When NOT to Use:**
- Need raw documentation (use `search_mobile_docs`)
- Looking for variety of examples (use `find_code_examples`)
- Exploring options without commitment (use `search_mobile_docs`)

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

**Purpose:** Analyze and summarize a project's technology stack

**When to Use:**
- First time working with a codebase
- Need to understand what technologies are used
- Planning integration with existing systems
- Documenting project architecture

**When NOT to Use:**
- Looking for specific code (use `graph_expand_context`)
- Need documentation for a technology (use `search_mobile_docs`)

**Parameters:**
```typescript
{
  collectionId: string       // Required: UUID of project collection
}
```

---

### get_db_schema

**Purpose:** Retrieve database schema information from a project

**When to Use:**
- Need to understand data model
- Planning data migrations
- Writing queries or ORM code
- Understanding persistence layer

**When NOT to Use:**
- Need to trace data flow through code (use `graph_expand_context`)
- Looking for database documentation (use `search_mobile_docs`)

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

**Purpose:** Expand context from seed nodes via knowledge graph traversal

**When to Use:**
- Tracing code flow (widget -> service -> API -> DB)
- Understanding what depends on a symbol
- Finding related code across files
- Building end-to-end context for a feature

**When NOT to Use:**
- Simple text search (use `search_rag`)
- Looking for documentation (use `search_mobile_docs`)
- First exploration of unknown codebase (use `get_project_tech_stack` first)

**Parameters:**
```typescript
{
  collectionId: string,                    // Required: UUID
  // At least one seed required:
  query?: string,                          // Semantic search for seeds
  seedChunkIds?: number[],                 // Start from specific chunks
  seedNodeIds?: string[],                  // Start from specific nodes

  maxDepth?: number,                       // Default: 3, Max: 10
  maxNodes?: number,                       // Default: 50, Max: 200
  edgeTypes?: EdgeType[],                  // Filter traversal
  nodeTypes?: NodeType[]                   // Filter results
}

// EdgeType: 'calls' | 'defines' | 'belongs_to' | 'persists_to' |
//           'configured_by' | 'documents' | 'imports' | 'depends_on'

// NodeType: 'document' | 'chunk' | 'symbol' | 'endpoint' |
//           'table' | 'column' | 'config_section'
```

---

### find_symbol_usages (Planned - Phase 3)

**Purpose:** Find where a specific symbol is defined or used

**When to Use:**
- Refactoring: need to find all usages before changing
- Understanding: where is this function called from?
- Navigation: find the definition of a symbol

**When NOT to Use:**
- Don't know the symbol name (use `search_rag` first)
- Need surrounding context (use `graph_expand_context` after)

**Parameters:**
```typescript
{
  collectionId: string,                     // Required: UUID
  symbolName: string,                       // Required: e.g., 'UserRepository'
  symbolKind?: 'function'|'class'|'variable'|'interface',
  includeDefinitions?: boolean,             // Default: true
  includeUsages?: boolean                   // Default: true
}
```

---

## 5. Worked Examples

### Example 1: "Add Stripe billing to my Flutter app"

**Query Analysis:**
- Task type: Feature Design + Implementation
- Keywords: Stripe (payment provider), billing (feature), Flutter (framework)
- Needs: Best practices, code examples, integration guidance

**Tool Selection Workflow:**

```
Step 1: Understand the recommended approach
-----------------------------------------
Tool: get_feature_recipe
Params: {
  collectionId: "<project-collection>",
  featureTags: ["payments", "stripe"],
  framework: "flutter"
}
Result: Curated guide on Flutter + Stripe integration patterns

Step 2: Check existing project setup
------------------------------------
Tool: get_project_tech_stack
Params: {
  collectionId: "<project-collection>"
}
Result: Confirms Flutter, identifies existing payment handling (if any)

Step 3: Find working code examples
----------------------------------
Tool: find_code_examples
Params: {
  collectionId: "<examples-collection>",
  query: "stripe payment flutter integration",
  framework: "flutter",
  featureTags: ["payments"]
}
Result: Working code samples for Stripe Flutter SDK

Step 4: Get official Stripe docs
--------------------------------
Tool: search_mobile_docs
Params: {
  collectionId: "<stripe-docs-collection>",
  query: "flutter SDK integration",
  platform: "mobile",
  framework: "flutter"
}
Result: Official Stripe Flutter SDK documentation
```

---

### Example 2: "Fix the auth bug in the login flow"

**Query Analysis:**
- Task type: Maintenance
- Keywords: auth, bug, login flow
- Needs: Find the code, understand flow, identify issue

**Tool Selection Workflow:**

```
Step 1: Find the login-related code
-----------------------------------
Tool: search_rag  (or find_symbol_usages if available)
Params: {
  collectionId: "<project-collection>",
  query: "login authentication flow",
  top_k: 10
}
Result: Chunks containing login-related code

Step 2: Expand context around login flow
----------------------------------------
Tool: graph_expand_context
Params: {
  collectionId: "<project-collection>",
  query: "login authentication",
  edgeTypes: ["calls", "depends_on"],
  maxDepth: 4,
  maxNodes: 50
}
Result: Full call graph from login UI to auth service to API

Step 3: Check auth documentation for expected behavior
------------------------------------------------------
Tool: search_mobile_docs
Params: {
  collectionId: "<docs-collection>",
  query: "authentication error handling",
  featureTags: ["auth"]
}
Result: Documentation on proper auth error handling

Step 4: Find similar patterns in examples
-----------------------------------------
Tool: find_code_examples
Params: {
  collectionId: "<examples-collection>",
  query: "login error handling flutter",
  featureTags: ["auth"]
}
Result: Examples of correct login flow implementation
```

---

### Example 3: "How does user data persist in this project?"

**Query Analysis:**
- Task type: Integration/Analysis
- Keywords: user data, persist
- Needs: Understand data flow, database schema, code relationships

**Tool Selection Workflow:**

```
Step 1: Get database schema overview
------------------------------------
Tool: get_db_schema
Params: {
  collectionId: "<project-collection>",
  tables: ["users", "user_settings", "user_preferences"],
  include_relationships: true
}
Result: Schema for user-related tables with relationships

Step 2: Trace persistence paths in code
---------------------------------------
Tool: graph_expand_context
Params: {
  collectionId: "<project-collection>",
  query: "user data save persist",
  edgeTypes: ["persists_to", "calls"],
  nodeTypes: ["symbol", "table"],
  maxDepth: 5
}
Result: Graph showing: UserService -> UserRepository -> users table

Step 3: Find the repository/DAO patterns used
---------------------------------------------
Tool: search_rag
Params: {
  collectionId: "<project-collection>",
  query: "UserRepository user persistence",
  top_k: 5
}
Result: Code chunks for user persistence layer
```

---

### Example 4: "What's the recommended pattern for offline caching?"

**Query Analysis:**
- Task type: Feature Design
- Keywords: recommended pattern, offline caching
- Needs: Best practices, curated guidance

**Tool Selection Workflow:**

```
Step 1: Get curated recipe for offline support
----------------------------------------------
Tool: get_feature_recipe
Params: {
  collectionId: "<recipes-collection>",
  featureTags: ["offline", "caching"],
  framework: "flutter"
}
Result: Opinionated guide on offline-first architecture

Step 2: Find implementation examples
------------------------------------
Tool: find_code_examples
Params: {
  collectionId: "<examples-collection>",
  query: "offline caching sqlite hive",
  featureTags: ["offline"]
}
Result: Code examples using SQLite, Hive, or similar

Step 3: Check official docs for the chosen approach
---------------------------------------------------
Tool: search_mobile_docs
Params: {
  collectionId: "<flutter-docs>",
  query: "offline data persistence",
  framework: "flutter",
  platform: "mobile"
}
Result: Official Flutter documentation on local storage
```

---

### Example 5: "Where is the PaymentService class used?"

**Query Analysis:**
- Task type: Maintenance
- Keywords: where, PaymentService, used
- Needs: Find usages of a specific symbol

**Tool Selection Workflow:**

```
Step 1: Find all usages of PaymentService
-----------------------------------------
Tool: find_symbol_usages (if available) OR search_rag
Params: {
  collectionId: "<project-collection>",
  symbolName: "PaymentService",
  symbolKind: "class"
}
OR:
Params: {
  collectionId: "<project-collection>",
  query: "PaymentService",
  top_k: 20
}
Result: All locations where PaymentService is referenced

Step 2: Expand to understand dependencies
-----------------------------------------
Tool: graph_expand_context
Params: {
  collectionId: "<project-collection>",
  query: "PaymentService",
  edgeTypes: ["calls", "imports", "depends_on"],
  maxDepth: 3
}
Result: Graph showing what uses PaymentService and what it depends on
```

---

### Example 6: "Add push notifications using Firebase"

**Query Analysis:**
- Task type: Feature Design + Implementation
- Keywords: push notifications, Firebase
- Needs: Integration guide, code examples, Firebase docs

**Tool Selection Workflow:**

```
Step 1: Get recommended pattern for push notifications
------------------------------------------------------
Tool: get_feature_recipe
Params: {
  collectionId: "<recipes-collection>",
  featureTags: ["notifications", "firebase", "push"],
  framework: "flutter"
}
Result: Curated guide for Firebase Cloud Messaging in Flutter

Step 2: Check current project setup
-----------------------------------
Tool: get_project_tech_stack
Params: {
  collectionId: "<project-collection>"
}
Result: Shows if Firebase is already configured

Step 3: Find code examples for FCM
----------------------------------
Tool: find_code_examples
Params: {
  collectionId: "<examples-collection>",
  query: "firebase cloud messaging push notification",
  framework: "flutter",
  featureTags: ["notifications"]
}
Result: Working FCM implementation examples

Step 4: Get official Firebase docs
----------------------------------
Tool: search_mobile_docs
Params: {
  collectionId: "<firebase-docs>",
  query: "flutter cloud messaging setup",
  platform: "mobile"
}
Result: Official Firebase documentation for Flutter FCM

Step 5: Understand notification handling in project
---------------------------------------------------
Tool: graph_expand_context
Params: {
  collectionId: "<project-collection>",
  query: "notification handler",
  edgeTypes: ["calls", "configured_by"],
  maxDepth: 3
}
Result: Existing notification infrastructure (if any)
```

---

## 6. Multi-Tool Workflows

### Standard Workflows by Task Type

#### New Feature Implementation

```
1. get_feature_recipe        --> Best practices and patterns
2. get_project_tech_stack    --> Understand existing setup
3. find_code_examples        --> Reference implementations
4. search_mobile_docs        --> API documentation
5. graph_expand_context      --> Find integration points
```

#### Bug Investigation

```
1. search_rag                --> Find relevant code
2. graph_expand_context      --> Trace the bug's path
3. search_mobile_docs        --> Check expected behavior
4. find_code_examples        --> Find correct patterns
```

#### Code Refactoring

```
1. find_symbol_usages        --> Find all usages
2. graph_expand_context      --> Understand dependencies
3. get_db_schema             --> If data changes involved
4. find_code_examples        --> Modern patterns to adopt
```

#### Learning a New Concept

```
1. search_mobile_docs        --> Conceptual understanding
2. get_feature_recipe        --> Recommended approach
3. find_code_examples        --> See it in action
```

### Tool Combination Patterns

| First Tool | Follow-up Tool | When |
|------------|----------------|------|
| `search_rag` | `graph_expand_context` | Need more context around results |
| `get_feature_recipe` | `find_code_examples` | Recipe gives pattern, need implementation |
| `find_code_examples` | `search_mobile_docs` | Example works, need to understand why |
| `get_project_tech_stack` | `get_db_schema` | Tech stack shows DB, need schema details |
| `find_symbol_usages` | `graph_expand_context` | Found symbol, need dependency graph |
| `get_db_schema` | `graph_expand_context` | Have schema, need code that uses it |

---

## 7. Anti-Patterns

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
   - Fix: Maintain separate collections, use correct one per query type

---

## Summary: Tool Selection Checklist

Before making a tool call, ask:

1. **What type of query is this?**
   - Documentation/learning -> `search_mobile_docs`, `get_feature_recipe`
   - Code/implementation -> `find_code_examples`, `graph_expand_context`
   - Project introspection -> `get_project_tech_stack`, `get_db_schema`

2. **Is this framework-specific?**
   - Yes -> Add framework parameter
   - No -> Proceed without filter

3. **Do I need relationships or just search?**
   - Relationships -> `graph_expand_context`
   - Simple search -> `search_rag` or `search_mobile_docs`

4. **Am I looking at my project or external docs?**
   - Project code -> Use project collection + graph tools
   - External docs -> Use docs collection + search tools

5. **Should I combine tools?**
   - Complex task -> Yes, follow multi-tool workflow
   - Simple lookup -> Single tool may suffice
