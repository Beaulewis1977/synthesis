# MCP Tool Feature Coverage Matrix

**Version:** 1.0
**Created:** December 2025
**Purpose:** Map mobile SaaS feature tags to MCP tools for optimal retrieval strategies

---

## Overview

This document provides guidance on which MCP tools to use for different mobile SaaS feature implementations. It maps feature tags (from `feature-detector.ts`) to the most effective tools for documentation, code examples, and codebase exploration.

---

## Feature Coverage Matrix

### Legend

| Symbol | Meaning |
|--------|---------|
| **P** | Primary tool - use this first |
| **S** | Secondary tool - use for follow-up or deeper context |
| **-** | Not typically relevant for this feature |

### Auth & User Management

| Feature Tag | search_mobile_docs | find_code_examples | get_feature_recipe | graph_expand_context | find_symbol_usages* | get_project_tech_stack* | get_db_schema* |
|-------------|-------------------|-------------------|-------------------|---------------------|--------------------|-----------------------|---------------|
| `auth` | **P** | S | **P** | S | S | - | S |
| `onboarding` | **P** | S | S | - | - | - | - |
| `social_auth` | S | **P** | **P** | - | S | - | - |
| `biometric_auth` | **P** | S | S | - | S | - | - |
| `sso` | **P** | S | S | - | - | - | - |

**Notes:**
- For `auth`, start with `get_feature_recipe` for implementation patterns, then `search_mobile_docs` for official docs
- For `social_auth`, code examples are critical - OAuth flows vary significantly by provider
- `get_db_schema` helps understand user/session table structures

### Monetization

| Feature Tag | search_mobile_docs | find_code_examples | get_feature_recipe | graph_expand_context | find_symbol_usages* | get_project_tech_stack* | get_db_schema* |
|-------------|-------------------|-------------------|-------------------|---------------------|--------------------|-----------------------|---------------|
| `payments` | S | **P** | **P** | S | S | - | S |
| `billing` | **P** | S | **P** | S | **P** | - | **P** |
| `subscriptions` | **P** | S | **P** | S | S | - | **P** |
| `in_app_purchases` | **P** | **P** | S | - | - | - | - |

**Notes:**
- Monetization features benefit heavily from code examples - payment integrations are error-prone
- `billing` and `subscriptions` require understanding database schema for subscription states
- Use `graph_expand_context` to trace payment flows from UI to backend

### Communication

| Feature Tag | search_mobile_docs | find_code_examples | get_feature_recipe | graph_expand_context | find_symbol_usages* | get_project_tech_stack* | get_db_schema* |
|-------------|-------------------|-------------------|-------------------|---------------------|--------------------|-----------------------|---------------|
| `push_notifications` | **P** | S | **P** | S | S | S | - |
| `in_app_messaging` | S | **P** | S | S | - | - | S |
| `chat` | S | **P** | **P** | **P** | S | S | **P** |
| `realtime` | **P** | S | S | **P** | S | S | - |
| `email` | S | S | S | - | - | - | - |

**Notes:**
- `chat` is complex - use `graph_expand_context` to understand message flow architecture
- `realtime` benefits from tech stack detection to identify WebSocket/Supabase Realtime usage
- Push notifications require platform-specific docs (FCM, APNs)

### Data & Storage

| Feature Tag | search_mobile_docs | find_code_examples | get_feature_recipe | graph_expand_context | find_symbol_usages* | get_project_tech_stack* | get_db_schema* |
|-------------|-------------------|-------------------|-------------------|---------------------|--------------------|-----------------------|---------------|
| `offline` | **P** | S | **P** | **P** | S | S | S |
| `sync` | S | **P** | **P** | **P** | **P** | - | **P** |
| `local_storage` | **P** | S | S | S | S | S | - |
| `caching` | **P** | S | S | S | - | - | - |
| `search` | S | S | S | - | - | - | S |
| `file_storage` | **P** | S | S | - | - | - | - |

**Notes:**
- `offline` and `sync` are architecturally complex - use `graph_expand_context` to trace data flow
- `sync` requires understanding both client and server schemas - use `get_db_schema`
- `find_symbol_usages` helps locate sync conflict resolution implementations

### Navigation & UX

| Feature Tag | search_mobile_docs | find_code_examples | get_feature_recipe | graph_expand_context | find_symbol_usages* | get_project_tech_stack* | get_db_schema* |
|-------------|-------------------|-------------------|-------------------|---------------------|--------------------|-----------------------|---------------|
| `navigation` | **P** | **P** | S | S | S | S | - |
| `deep_linking` | **P** | S | **P** | S | S | - | - |
| `routing` | **P** | S | S | S | S | S | - |
| `bottom_nav` | S | **P** | - | - | - | - | - |
| `tabs` | S | **P** | - | - | - | - | - |

**Notes:**
- Navigation patterns vary by framework - check `get_project_tech_stack` first
- `deep_linking` requires platform-specific configuration - recipes provide best patterns
- UI components (`bottom_nav`, `tabs`) are best learned from code examples

### Device Features

| Feature Tag | search_mobile_docs | find_code_examples | get_feature_recipe | graph_expand_context | find_symbol_usages* | get_project_tech_stack* | get_db_schema* |
|-------------|-------------------|-------------------|-------------------|---------------------|--------------------|-----------------------|---------------|
| `camera` | **P** | **P** | S | - | S | - | - |
| `location` | **P** | S | S | - | S | - | - |
| `permissions` | **P** | S | **P** | - | S | - | - |
| `sensors` | **P** | S | - | - | - | - | - |
| `background_processing` | **P** | S | **P** | S | S | - | - |

**Notes:**
- Device features are platform-specific - official docs are critical
- `permissions` benefit from recipes showing proper request flows
- `background_processing` requires understanding of platform limitations

### Analytics & Monitoring

| Feature Tag | search_mobile_docs | find_code_examples | get_feature_recipe | graph_expand_context | find_symbol_usages* | get_project_tech_stack* | get_db_schema* |
|-------------|-------------------|-------------------|-------------------|---------------------|--------------------|-----------------------|---------------|
| `analytics` | **P** | S | S | S | S | S | - |
| `crash_reporting` | **P** | S | S | - | - | S | - |
| `logging` | S | S | S | S | S | - | - |
| `performance_monitoring` | **P** | S | S | - | - | S | - |

**Notes:**
- Analytics tools are documentation-heavy - start with official docs
- Use `get_project_tech_stack` to identify existing analytics integrations
- `graph_expand_context` can help trace what events are being tracked

---

## Tool Selection Guide

### Primary Tool by Use Case

| Use Case | Start With | Why |
|----------|------------|-----|
| "How do I implement X?" | `get_feature_recipe` | Curated patterns with best practices |
| "What's the official way to do X?" | `search_mobile_docs` | Filters to official tier documentation |
| "Show me code for X" | `find_code_examples` | Biased toward example/demo content |
| "Where is X implemented in this codebase?" | `graph_expand_context` | Traces relationships through the code |
| "What's this project's tech stack?" | `get_project_tech_stack`* | Aggregates framework detection |
| "What tables exist for X?" | `get_db_schema`* | Returns schema from SQL analysis |
| "Find all usages of X symbol" | `find_symbol_usages`* | Locates symbol references |

*Planned for Phase 3 - not yet implemented

### Tool Selection Decision Tree

```
Question: What kind of information do you need?

+-- LEARNING (new feature implementation)
|   |
|   +-- Want official guidance? --> search_mobile_docs (platform=mobile, feature_tags=[X])
|   |
|   +-- Want opinionated patterns? --> get_feature_recipe (featureTags=[X])
|   |
|   +-- Want working code? --> find_code_examples (featureTags=[X])

+-- UNDERSTANDING (existing codebase)
|   |
|   +-- What technologies are used? --> get_project_tech_stack*
|   |
|   +-- How is feature X connected? --> graph_expand_context (query="X")
|   |
|   +-- Where is symbol X used? --> find_symbol_usages*
|   |
|   +-- What's the database structure? --> get_db_schema*

+-- DEBUGGING
    |
    +-- How does data flow through X? --> graph_expand_context (maxDepth=3)
    |
    +-- What calls this function? --> graph_expand_context (edgeTypes=['calls'])
```

---

## Common Scenario Tool Sequences

### Scenario 1: "How do I implement auth in Flutter?"

**Optimal tool sequence:**

1. **`get_feature_recipe`** (featureTags: `['auth']`, framework: `'flutter'`)
   - Get curated implementation patterns first
   - Returns opinionated guides with recommended approaches

2. **`search_mobile_docs`** (query: `'authentication'`, featureTags: `['auth']`, framework: `'flutter'`)
   - Get official Flutter/Supabase auth documentation
   - Fills in API details and configuration

3. **`find_code_examples`** (query: `'auth login'`, featureTags: `['auth']`, framework: `'flutter'`)
   - See working implementations
   - Copy/adapt specific code patterns

**Why this order:** Recipes provide the "big picture" approach, official docs fill in details, examples show concrete implementations.

---

### Scenario 2: "Where is billing handled in this codebase?"

**Optimal tool sequence:**

1. **`get_project_tech_stack`*** (collectionId: `<project-collection>`)
   - Identify what payment provider is used (Stripe, RevenueCat, etc.)
   - Understand the overall architecture

2. **`graph_expand_context`** (query: `'billing payment subscription'`, collectionId: `<project-collection>`)
   - Find billing-related symbols and their connections
   - Trace from UI to service to database

3. **`get_db_schema`*** (collectionId: `<project-collection>`, tables: `['subscriptions', 'payments', 'invoices']`)
   - Understand data model for billing
   - See relationships between tables

4. **`find_symbol_usages`*** (symbol: `'BillingService'` or identified class)
   - Find all places billing is invoked
   - Understand integration points

**Why this order:** Tech stack tells you WHAT is used, graph expansion shows HOW it's connected, schema reveals the DATA model, symbol search shows WHERE it's called.

---

### Scenario 3: "What's the best practice for offline sync?"

**Optimal tool sequence:**

1. **`get_feature_recipe`** (featureTags: `['offline', 'sync']`, framework: `'flutter'`)
   - Get recommended offline-first architecture
   - Understand sync strategies (optimistic, last-write-wins, etc.)

2. **`search_mobile_docs`** (query: `'offline sync conflict resolution'`, featureTags: `['sync', 'offline']`)
   - Deep dive into specific sync approaches
   - Platform-specific considerations

3. **`find_code_examples`** (query: `'offline first sync'`, featureTags: `['offline', 'sync']`)
   - See implementations of sync managers
   - Copy conflict resolution patterns

4. **`graph_expand_context`** (query: `'sync manager repository'`, collectionId: `<project-collection>`)
   - If working with existing codebase, trace the sync flow
   - Understand what data is synced and how

**Why this order:** Sync is architecturally complex - start with high-level patterns, then details, then examples. Use graph only when exploring existing implementations.

---

## Tool Parameters Quick Reference

### search_mobile_docs

```typescript
{
  collectionId: string;       // Required: Collection to search
  query: string;              // Required: Search query
  featureTags?: string[];     // Optional: Filter by feature tags
  platform?: 'mobile' | 'web' | 'backend' | 'shared';
  framework?: string;         // e.g., 'flutter', 'react-native'
  top_k?: number;             // Default: 10
}
```

### find_code_examples

```typescript
{
  collectionId: string;       // Required: Collection to search
  query: string;              // Required: Search query
  featureTags?: string[];     // Optional: Filter by feature tags
  framework?: string;         // e.g., 'flutter', 'supabase'
  top_k?: number;             // Default: 5
}
```

### get_feature_recipe

```typescript
{
  collectionId: string;       // Required: Collection to search
  featureTags: string[];      // Required: At least one feature tag
  framework?: string;         // e.g., 'flutter'
  top_k?: number;             // Default: 5
}
```

### graph_expand_context

```typescript
{
  collectionId: string;       // Required: Collection to search
  seedChunkIds?: number[];    // Option 1: Start from specific chunks
  seedNodeIds?: string[];     // Option 2: Start from specific nodes
  query?: string;             // Option 3: Find seeds via semantic search
  maxDepth?: number;          // Default: 3, Max: 10
  maxNodes?: number;          // Default: 50, Max: 200
  edgeTypes?: ('calls' | 'defines' | 'belongs_to' | 'persists_to' |
               'configured_by' | 'documents' | 'imports' | 'depends_on')[];
  nodeTypes?: ('document' | 'chunk' | 'symbol' | 'endpoint' |
               'table' | 'column' | 'config_section')[];
}
```

### Planned Tools (Phase 3)*

#### get_project_tech_stack*
```typescript
{
  collectionId: string;       // Required: Project collection ID
}
```

#### get_db_schema*
```typescript
{
  collectionId: string;       // Required: Project collection ID
  tables?: string[];          // Optional: Filter to specific tables
  include_relationships?: boolean;  // Default: true
}
```

#### find_symbol_usages*
```typescript
{
  collectionId: string;       // Required: Project collection ID
  symbol: string;             // Required: Symbol name to find
  symbol_type?: 'function' | 'class' | 'variable' | 'type';
}
```

---

## Feature Tag Reference

### All Supported Feature Tags

From `apps/server/src/services/feature-detector.ts`:

**Auth & User Management:**
- `auth` - General authentication (login, logout, JWT, OAuth)
- `onboarding` - First-run experience, welcome flows
- `social_auth` - OAuth providers (Google, Apple, Facebook)

**Monetization:**
- `billing` - Invoices, subscription management
- `payments` - Payment processing (Stripe, PayPal)
- `subscriptions` - Recurring billing, IAP

**Communication:**
- `push_notifications` - FCM, APNs, OneSignal
- `chat` - Real-time messaging, conversations
- `realtime` - WebSockets, live updates

**Data & Storage:**
- `offline` - Offline-first patterns
- `local_storage` - Hive, Isar, SQLite, SharedPreferences
- `sync` - Data synchronization, conflict resolution
- `caching` - Memory/HTTP caching
- `search` - Full-text search, Algolia

**Navigation & UI:**
- `navigation` - Routing, Navigator, GoRouter
- `state_management` - Provider, Bloc, Riverpod
- `forms` - Form handling, validation
- `theming` - Dark mode, color schemes
- `localization` - i18n, translations

**Device Features:**
- `camera` - Photo/video capture, QR codes
- `file_upload` - File picking, multipart upload
- `location` - GPS, geolocation
- `maps` - Google Maps, Mapbox

**Analytics:**
- `analytics` - Event tracking, Firebase Analytics
- `deep_linking` - Universal links, dynamic links

---

## Best Practices

### Do's

1. **Start broad, then narrow:** Use `search_mobile_docs` first, then `get_feature_recipe` for specific patterns
2. **Combine tools:** Most features benefit from 2-3 tools used in sequence
3. **Use feature tags:** Always include relevant `featureTags` for better filtering
4. **Specify framework:** Include `framework` when you know the target platform
5. **Trace existing code:** Use `graph_expand_context` before modifying existing features

### Don'ts

1. **Don't skip official docs:** Even with recipes, verify against official documentation
2. **Don't use graph for learning:** Graph expansion is for existing codebases, not tutorials
3. **Don't over-specify:** If unsure about feature tags, start without them and refine
4. **Don't ignore tech stack:** Check `get_project_tech_stack` before making architectural decisions

---

## Related Documentation

- Tool Specifications: `docs/gpt/PHASE_3_MCP_TASK_TOOLS_IMPLEMENTATION_PLAN.md`
- Feature Detector: `apps/server/src/services/feature-detector.ts`
- Agent Tools: `docs/04_AGENT_TOOLS.md`
- MCP Server Implementation: `apps/mcp/src/index.ts`
