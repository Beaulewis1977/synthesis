# MCP Tool Specification: GPT Phase 3 Task-Specific Tools

**Version:** 1.0
**Created:** December 2025
**Phase:** GPT Phase 3 - Task-Specific MCP Tools
**Branch:** `feature/gpt-phase3-mcp-task-tools`

---

## Section 1: Task Taxonomy

This section defines the four primary workflow categories for mobile SaaS development and maps each to appropriate MCP tools. Agents should use this taxonomy to select the right tools for each user query.

---

### 1.1 Workflow Category Overview

| Category | Primary Question | Primary Tools | Priority |
|----------|-----------------|---------------|----------|
| **Feature Design** | "What's the recommended pattern?" | `get_feature_recipe`, `search_mobile_docs` | Recipes first, then official docs |
| **Implementation** | "Show me working code" | `find_code_examples`, `search_mobile_docs` | Examples first, then docs |
| **Integration/Analysis** | "How does this project work?" | `get_project_tech_stack`, `find_symbol_usages`, `graph_expand_context` | Introspection + graph traversal |
| **Maintenance** | "Where is X implemented?" | `get_db_schema`, `graph_expand_context`, `find_symbol_usages` | Trace code and data flows |

---

### 1.2 Feature Design Workflow

**Description:**
Use this workflow when the user needs architectural guidance, best practices, or recommended patterns for implementing a mobile SaaS feature. The agent should consult curated recipes first (opinionated, battle-tested patterns), then fall back to official documentation for authoritative reference.

**Primary Tools (in priority order):**

1. **`get_feature_recipe`** - Retrieve curated, opinionated patterns with step-by-step guidance
2. **`search_mobile_docs`** (with `sourceQuality='official'`) - Find authoritative documentation

**When to Use:**
- User asks "What's the best way to implement X?"
- User needs architecture decisions before writing code
- User wants to understand trade-offs between approaches
- User is starting a new feature from scratch

**Example Queries:**

| Query | Tool Selection | Rationale |
|-------|---------------|-----------|
| "What's the recommended pattern for auth in Flutter with Supabase?" | `get_feature_recipe(feature='auth', framework='flutter')` | Design question - recipes first |
| "How should I structure billing and subscriptions?" | `get_feature_recipe(feature='billing')` then `get_feature_recipe(feature='subscriptions')` | Architecture guidance needed |
| "What's the best approach for push notifications on iOS and Android?" | `get_feature_recipe(feature='push_notifications')` | Cross-platform design pattern |
| "Should I use Riverpod or Bloc for state management?" | `get_feature_recipe(feature='state_management', framework='flutter')` | Trade-off analysis |

**Expected Output:**
```json
{
  "recipe": {
    "name": "Flutter + Supabase Authentication",
    "summary": "Recommended pattern using supabase_flutter package with GoRouter for auth state...",
    "tech_stack": {
      "framework": "flutter",
      "framework_version": ">=3.16.0",
      "backend": "supabase",
      "packages": ["supabase_flutter", "go_router"]
    },
    "steps": [...],
    "pitfalls": [...],
    "alternatives": [...]
  },
  "official_docs": [
    {
      "title": "Supabase Auth - Flutter",
      "url": "https://supabase.com/docs/guides/auth/auth-helpers/flutter-auth",
      "source_quality": "official"
    }
  ],
  "citations": [...]
}
```

**Mobile SaaS Features Covered:**
- `auth`, `social_auth`, `onboarding`
- `billing`, `payments`, `subscriptions`
- `push_notifications`, `in_app_messaging`
- `offline`, `sync`, `local_storage`, `caching`
- `navigation`, `deep_linking`
- `state_management`

---

### 1.3 Implementation Workflow

**Description:**
Use this workflow when the user needs working code examples to implement a specific feature. The agent should prioritize finding executable code samples, demos, and reference implementations over conceptual documentation.

**Primary Tools (in priority order):**

1. **`find_code_examples`** - Find working code samples filtered by framework and feature
2. **`search_mobile_docs`** - Supplement with API reference documentation

**When to Use:**
- User asks "Show me how to do X"
- User needs code snippets or implementation patterns
- User wants to see a working example before adapting it
- User is in active development and needs concrete code

**Example Queries:**

| Query | Tool Selection | Rationale |
|-------|---------------|-----------|
| "Show me examples of Stripe checkout in Flutter" | `find_code_examples(framework='flutter', feature='payments', tech_stack=['stripe'])` | Needs working code |
| "How do I implement deep linking with go_router?" | `find_code_examples(framework='flutter', feature='deep_linking', tech_stack=['go_router'])` | Implementation example |
| "Show me offline sync patterns using Hive" | `find_code_examples(framework='flutter', feature='offline', tech_stack=['hive'])` | Specific tech stack example |
| "Example of Firebase push notifications in Flutter" | `find_code_examples(framework='flutter', feature='push_notifications', tech_stack=['firebase'])` | Working sample needed |

**Expected Output:**
```json
{
  "examples": [
    {
      "title": "Stripe Checkout Integration",
      "file_path": "examples/flutter_stripe/lib/checkout_screen.dart",
      "language": "dart",
      "code_snippet": "class CheckoutScreen extends StatefulWidget {...}",
      "line_range": { "start": 15, "end": 89 },
      "metadata": {
        "framework": "flutter",
        "framework_version": "3.16.0",
        "feature_tags": ["payments", "billing"],
        "tech_stack": ["stripe", "flutter_stripe"]
      }
    }
  ],
  "related_docs": [
    {
      "title": "flutter_stripe package API",
      "chunk_text": "...",
      "source_quality": "reference"
    }
  ],
  "citations": [...]
}
```

**Query Variations Handled:**
- "Show examples of X in Flutter using Y backend"
- "How to implement X with Y package"
- "Code sample for X feature"
- "Working example of X"

---

### 1.4 Integration/Analysis Workflow

**Description:**
Use this workflow when the user needs to understand how an existing project or codebase handles a specific concern. The agent should analyze project structure, tech stack, and code relationships to provide a comprehensive understanding of the implementation.

**Primary Tools (in priority order):**

1. **`get_project_tech_stack`** - Understand technologies and dependencies used
2. **`find_symbol_usages`** - Find where specific functions/classes are used
3. **`graph_expand_context`** - Traverse the knowledge graph to understand relationships

**When to Use:**
- User asks "How does this project handle X?"
- User needs to understand existing code structure
- User wants to trace code paths through the application
- User is onboarding to an existing codebase

**Example Queries:**

| Query | Tool Selection | Rationale |
|-------|---------------|-----------|
| "How does this project handle auth?" | `get_project_tech_stack(collection_id)` then `find_symbol_usages(query='auth')` | Understand existing implementation |
| "What routing library does this use?" | `get_project_tech_stack(collection_id)` | Tech stack discovery |
| "Where is the user state managed?" | `find_symbol_usages(query='UserState')` then `graph_expand_context(seed='UserState')` | Trace state management |
| "How is navigation structured in this app?" | `find_symbol_usages(query='router')` then `graph_expand_context(seed='AppRouter', max_depth=3)` | Understand navigation flow |

**Expected Output:**
```json
{
  "tech_stack": {
    "framework": "flutter",
    "framework_version": "3.19.0",
    "state_management": "riverpod",
    "navigation": "go_router",
    "backend": "supabase",
    "local_storage": "hive",
    "detected_features": ["auth", "offline", "push_notifications"]
  },
  "symbol_usages": [
    {
      "symbol": "AuthNotifier",
      "type": "class",
      "file_path": "lib/providers/auth_provider.dart",
      "usages": [
        { "file": "lib/screens/login_screen.dart", "line": 42 },
        { "file": "lib/app.dart", "line": 15 }
      ]
    }
  ],
  "graph_context": {
    "nodes": [...],
    "edges": [...],
    "traversal_path": "AuthNotifier -> SupabaseClient -> users table"
  }
}
```

**Graph Expansion Use Cases:**
- Understanding widget-to-service-to-database flow
- Tracing authentication state through the app
- Mapping navigation routes and deep links
- Understanding data persistence paths

---

### 1.5 Maintenance Workflow

**Description:**
Use this workflow when the user needs to locate specific implementations, understand data schemas, or trace code/data flows for debugging, refactoring, or extending existing functionality.

**Primary Tools (in priority order):**

1. **`get_db_schema`** - Retrieve database table definitions and relationships
2. **`graph_expand_context`** - Traverse code relationships to find connected components
3. **`find_symbol_usages`** - Locate all references to specific symbols

**When to Use:**
- User asks "Where is X implemented?"
- User needs to understand database schema
- User is debugging data flow issues
- User is planning a refactor and needs to understand impact

**Example Queries:**

| Query | Tool Selection | Rationale |
|-------|---------------|-----------|
| "Where is billing implemented?" | `find_symbol_usages(query='billing')` then `graph_expand_context(seed='BillingService')` | Locate implementation |
| "What's the DB schema for user subscriptions?" | `get_db_schema(collection_id, tables=['users', 'subscriptions'])` | Schema discovery |
| "How does user data flow from signup to database?" | `graph_expand_context(seed='SignupScreen', edge_types=['calls', 'persists_to'])` | Trace data flow |
| "What would break if I change the Profile model?" | `find_symbol_usages(query='Profile')` then `graph_expand_context(seed='Profile', max_depth=2)` | Impact analysis |

**Expected Output:**
```json
{
  "db_schema": {
    "tables": [
      {
        "name": "users",
        "columns": [
          { "name": "id", "type": "uuid", "primary_key": true },
          { "name": "email", "type": "text", "nullable": false },
          { "name": "subscription_tier", "type": "text", "default": "free" }
        ],
        "relationships": [
          { "type": "has_many", "table": "subscriptions", "foreign_key": "user_id" }
        ]
      }
    ]
  },
  "code_locations": [
    {
      "symbol": "BillingService",
      "file_path": "lib/services/billing_service.dart",
      "line_start": 10,
      "persists_to": ["subscriptions", "payments"]
    }
  ],
  "graph_context": {
    "nodes_visited": 12,
    "edges_traversed": 15,
    "data_flow": "SignupScreen -> AuthService -> SupabaseClient -> users table"
  }
}
```

**Database Schema Features:**
- Table definitions with column types
- Primary keys and foreign keys
- Relationships (has_many, belongs_to)
- Constraints and defaults

---

### 1.6 Tool Selection Decision Tree

```text
User Query
    |
    +-- Asks about "best way" / "recommended" / "pattern" / "should I"?
    |       |
    |       +-- YES --> FEATURE DESIGN workflow
    |       |           1. get_feature_recipe
    |       |           2. search_mobile_docs (sourceQuality='official')
    |       |
    +-- Asks for "example" / "show me" / "code" / "implement"?
    |       |
    |       +-- YES --> IMPLEMENTATION workflow
    |       |           1. find_code_examples
    |       |           2. search_mobile_docs
    |       |
    +-- Asks "how does this project" / "what does this use" / "understand"?
    |       |
    |       +-- YES --> INTEGRATION/ANALYSIS workflow
    |       |           1. get_project_tech_stack
    |       |           2. find_symbol_usages
    |       |           3. graph_expand_context
    |       |
    +-- Asks "where is" / "what's the schema" / "trace" / "find"?
            |
            +-- YES --> MAINTENANCE workflow
                        1. get_db_schema
                        2. graph_expand_context
                        3. find_symbol_usages
```

---

### 1.7 Feature Tag Reference

The following feature tags are used across all workflows for filtering and categorization:

| Category | Tags | Description |
|----------|------|-------------|
| **Authentication** | `auth`, `onboarding`, `social_auth` | User identity, signup flows, OAuth providers |
| **Monetization** | `billing`, `payments`, `subscriptions` | Stripe, RevenueCat, in-app purchases |
| **Communication** | `push_notifications`, `in_app_messaging` | FCM, APNS, local notifications |
| **Data Persistence** | `offline`, `sync`, `local_storage`, `caching` | Hive, Isar, SQLite, background sync |
| **Navigation** | `navigation`, `deep_linking` | GoRouter, AutoRoute, universal links |
| **State** | `state_management` | Riverpod, Bloc, Provider, GetX |

---

### 1.8 Framework Support Matrix

| Framework | Version Range | Backend Support |
|-----------|--------------|-----------------|
| `flutter` | >= 3.10.0 | Supabase, Firebase, REST, GraphQL |
| `react_native` | >= 0.72.0 | Supabase, Firebase, REST, GraphQL |
| `swift` | >= 5.9 | Supabase, Firebase, REST |
| `kotlin` | >= 1.9.0 | Supabase, Firebase, REST |

---

### 1.9 Workflow Combination Patterns

Complex tasks often require combining workflows. Here are common patterns:

**Pattern 1: Research then Implement**
```text
1. FEATURE DESIGN: get_feature_recipe('auth') --> understand pattern
2. IMPLEMENTATION: find_code_examples('auth', 'flutter') --> get code
```

**Pattern 2: Analyze then Extend**
```text
1. INTEGRATION: get_project_tech_stack() --> understand current setup
2. FEATURE DESIGN: get_feature_recipe('push_notifications') --> plan addition
3. IMPLEMENTATION: find_code_examples() --> implement
```

**Pattern 3: Debug and Fix**
```text
1. MAINTENANCE: find_symbol_usages('PaymentService') --> locate code
2. MAINTENANCE: graph_expand_context(seed='PaymentService') --> understand dependencies
3. MAINTENANCE: get_db_schema(tables=['payments']) --> verify schema
```

**Pattern 4: Onboarding to Codebase**
```text
1. INTEGRATION: get_project_tech_stack() --> overview
2. INTEGRATION: find_symbol_usages('App') --> entry points
3. INTEGRATION: graph_expand_context(seed='App', max_depth=2) --> architecture
```

---

## Section 2: Tool Specifications

### 2.1 Existing Tools (Implemented in Phase 1 & 2)

See [MCP_TOOL_SPECIFICATIONS.md](./MCP_TOOL_SPECIFICATIONS.md) for detailed specifications of:
1. `search_mobile_docs` - Feature-aware mobile documentation search (ENHANCED with sourceQuality)
2. `find_code_examples` - Find code examples biased toward demo content
3. `get_feature_recipe` - Get curated recipe documentation for features
4. `graph_expand_context` - BFS traversal of knowledge graph

### 2.2 New Tools (To Be Implemented in Phase 3)

See [../phases/gpt-phase3/MCP_TOOL_SPECIFICATIONS.md](../phases/gpt-phase3/MCP_TOOL_SPECIFICATIONS.md) for detailed specifications of:
5. `find_symbol_usages` - Find symbol definitions and usages (NEW - needs POST /api/graph/symbols)
6. `get_project_tech_stack` - Get project technology stack (uses existing GET /api/tech-profiles/:collectionId)
7. `get_db_schema` - Get database schema from knowledge graph (NEW - needs GET /api/graph/schema/:collectionId)

### 2.3 Tool Summary

| # | Tool | Status | HTTP Endpoint | Primary Use Case |
|---|------|--------|---------------|------------------|
| 1 | `search_mobile_docs` | ✅ Exists (enhance) | POST /api/search | Feature-aware mobile doc search |
| 2 | `find_code_examples` | ✅ Exists | POST /api/search | Find working code samples |
| 3 | `get_feature_recipe` | ✅ Exists | POST /api/search | Get curated implementation patterns |
| 4 | `graph_expand_context` | ✅ Exists | POST /api/graph/context | Knowledge graph BFS traversal |
| 5 | `find_symbol_usages` | 🆕 New | POST /api/graph/symbols | Find symbol definitions and usages |
| 6 | `get_project_tech_stack` | 🆕 New MCP tool | GET /api/tech-profiles/:id | Get project technology stack |
| 7 | `get_db_schema` | 🆕 New | GET /api/graph/schema/:id | Get database schema from graph |

---

## Section 3: Feature Coverage Matrix

See [MCP_TOOL_FEATURE_COVERAGE_MATRIX.md](./MCP_TOOL_FEATURE_COVERAGE_MATRIX.md) for:
- Feature tag to tool mapping
- Primary (P) vs Secondary (S) tool recommendations by feature
- Tool selection guidance by use case
- Common scenario tool sequences

### Quick Reference: Tool by Feature Category

| Category | Primary Tools |
|----------|---------------|
| Auth & User Management | `get_feature_recipe`, `search_mobile_docs` |
| Monetization | `find_code_examples`, `get_feature_recipe`, `get_db_schema` |
| Communication | `search_mobile_docs`, `graph_expand_context` |
| Data & Storage | `get_feature_recipe`, `graph_expand_context`, `get_db_schema` |
| Navigation & UX | `find_code_examples`, `search_mobile_docs` |
| Device Features | `search_mobile_docs`, `get_feature_recipe` |
| Analytics & Monitoring | `search_mobile_docs`, `get_project_tech_stack` |

---

## Section 4: Tool Selection Decision Tree

See [MCP_TOOL_SELECTION_DECISION_TREE.md](./MCP_TOOL_SELECTION_DECISION_TREE.md) for:
- Query pattern to tool mapping
- Text-based decision tree
- Visual decision flow
- Detailed tool profiles
- 6 worked examples
- Multi-tool workflow patterns
- Anti-patterns to avoid

### Quick Reference: Query Pattern to Tool

| Query Pattern | Start With |
|---------------|------------|
| "How do I implement X?" | `get_feature_recipe` |
| "Show me examples of X" | `find_code_examples` |
| "What does official docs say?" | `search_mobile_docs` (sourceQuality='official') |
| "How does this project do X?" | `graph_expand_context` |
| "Where is X in the code?" | `find_symbol_usages` |
| "What tech stack?" | `get_project_tech_stack` |
| "What's the database schema?" | `get_db_schema` |

---

## Section 5: HTTP API Requirements for Phase 5.2

### Existing Endpoints (Leverage)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/search` | POST | Smart search with filtering |
| `/api/graph/context` | POST | Graph BFS traversal |
| `/api/tech-profiles/:collectionId` | GET | Tech stack profile |

### New Endpoints Required

| Endpoint | Method | Purpose | Tool |
|----------|--------|---------|------|
| `/api/graph/symbols` | POST | Symbol usage search | `find_symbol_usages` |
| `/api/graph/schema/:collectionId` | GET | Database schema extraction | `get_db_schema` |

---

## Section 6: Agent Prompt Integration (Phase 5.4)

### Tool Usage Examples for Agent Prompts

**Feature Design:**
```
When asked "What's the best way to implement auth?":
1. get_feature_recipe(featureTags=['auth'], framework='flutter')
2. search_mobile_docs(query='authentication', sourceQuality='official')
```

**Implementation:**
```
When asked "Show me Stripe checkout examples":
1. find_code_examples(query='stripe checkout', featureTags=['payments'])
2. search_mobile_docs(query='stripe flutter SDK')
```

**Project Analysis:**
```
When asked "How does this project handle billing?":
1. get_project_tech_stack(collectionId=<project>)
2. find_symbol_usages(symbolName='BillingService')
3. graph_expand_context(query='billing payment')
```

**Maintenance:**
```
When asked "What's the database schema for users?":
1. get_db_schema(collectionId=<project>, tables=['users'])
2. graph_expand_context(edgeTypes=['persists_to'])
```

---

## Section 7: Evaluation Scenarios (Phase 5.5)

Scenario-based evaluation will cover:

1. **Flutter + Supabase Auth Flow**
   - Tools: `get_feature_recipe`, `find_code_examples`, `search_mobile_docs`
   - Success criteria: Complete auth pattern with code samples

2. **Adding Stripe Billing**
   - Tools: `get_project_tech_stack`, `get_feature_recipe`, `find_code_examples`
   - Success criteria: Integration guide matching project tech stack

3. **Firebase Push Notifications**
   - Tools: `get_feature_recipe`, `search_mobile_docs`, `graph_expand_context`
   - Success criteria: End-to-end setup guide

4. **Trace User Data Persistence**
   - Tools: `find_symbol_usages`, `get_db_schema`, `graph_expand_context`
   - Success criteria: Complete data flow from UI to database

---

## Appendix A: Related Documentation

- Phase 3 Implementation Plan: `docs/gpt/PHASE_3_MCP_TASK_TOOLS_IMPLEMENTATION_PLAN.md`
- Phase 2 Summary: `docs/gpt/GPT_PHASE_2_SUMMARY.md`
- MCP Server Implementation: `apps/mcp/src/index.ts`
- Feature Detector: `apps/server/src/services/feature-detector.ts`
- Graph Search Service: `apps/server/src/services/graph-search.ts`

## Appendix B: Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SEARCH_MODE` | `vector` | Default search mode |
| `ENABLE_GRAPH_EXPANSION` | `false` | Enable graph expansion |
| `GRAPH_MAX_DEPTH` | `3` | Max graph traversal depth |
| `GRAPH_MAX_NODES` | `50` | Max nodes to return |
| `ENABLE_TRUST_SCORING` | `false` | Enable source quality weighting |
