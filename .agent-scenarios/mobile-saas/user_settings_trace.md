# Scenario: User Settings Persistence Trace

## Overview

- **Goal**: Agent traces how user settings are persisted in an existing codebase, from UI to database, to understand and modify the persistence path
- **Starting Collection**: `placeholder-collection-id` (indexed Flutter project with Supabase backend)
- **Primary Tools**: `get_db_schema`, `graph_expand_context`, `find_symbol_usages`
- **Category**: Maintenance / Code Analysis
- **Difficulty**: Hard

## Preconditions

- Collection contains:
  - Indexed Flutter project codebase
  - Knowledge graph with code relationships (defines, calls, imports edges)
  - Database schema extracted from SQL/migrations
- Project has user settings functionality implemented

## Workflow Steps

### Step 1: Get Database Schema

**Tool**: `get_db_schema`
**Purpose**: Understand the database tables related to user settings

```json
{
  "collectionId": "placeholder-collection-id",
  "tables": ["users", "user_settings", "preferences", "app_settings"],
  "include_relationships": true
}
```

**Expected Results**:
- user_settings table schema (if exists)
- Column definitions (setting_key, setting_value, user_id)
- Foreign key relationships to users table
- Indexes and constraints

**Success Criteria**:
- Schema extraction returns results
- At least one settings-related table found
- Relationships included if present

---

### Step 2: Trace Code Flow from Settings Widget

**Tool**: `graph_expand_context`
**Purpose**: Trace the code path from UI widget to persistence layer

```json
{
  "collectionId": "placeholder-collection-id",
  "seed": "UserSettingsScreen",
  "seed_type": "symbol",
  "max_depth": 3,
  "max_nodes": 30,
  "edge_types": ["calls", "imports", "persists_to"]
}
```

**Expected Results**:
- UserSettingsScreen widget node
- Connected provider/bloc/controller nodes
- Repository layer nodes
- Database client/API nodes
- Complete call chain from UI to storage

**Success Criteria**:
- Graph traversal returns connected nodes
- At least 3 levels of depth explored
- Repository or service layer found in path

---

### Step 3: Find Save Settings Usages

**Tool**: `find_symbol_usages`
**Purpose**: Find all places where user settings are saved/updated

```json
{
  "collectionId": "placeholder-collection-id",
  "symbol_name": "saveUserSettings",
  "symbol_kind": "function",
  "include_definitions": true,
  "include_usages": true,
  "max_results": 20
}
```

**Expected Results**:
- Definition location of saveUserSettings function
- All call sites across the codebase
- File paths and line numbers
- Context around each usage

**Success Criteria**:
- At least 1 definition found (or 0 if different naming)
- Usage locations identified
- File paths are valid

---

### Step 4: Expand Repository Context

**Tool**: `graph_expand_context`
**Purpose**: Deep dive into the repository/service layer handling settings

```json
{
  "collectionId": "placeholder-collection-id",
  "seed": "UserSettingsRepository",
  "seed_type": "symbol",
  "max_depth": 2,
  "max_nodes": 20,
  "edge_types": ["defines", "calls", "implements"]
}
```

**Expected Results**:
- Repository class definition
- Methods for CRUD operations
- Dependencies (database client, API client)
- Interface implementations if any

**Success Criteria**:
- Repository node found
- Method definitions expanded
- Database interaction layer visible

---

## Success Criteria Summary

| Criterion | Required |
|-----------|----------|
| `get_db_schema` called | Yes |
| `graph_expand_context` called (2x) | Yes |
| `find_symbol_usages` called | Yes |
| Schema information retrieved | Yes |
| Code flow traced | Yes |
| Total tool calls | >= 4 |

## Expected Outcome

After completing this scenario, the agent should have mapped:

1. **Database schema**: User settings table structure
2. **UI layer**: Settings screen widget and state management
3. **Service layer**: Repository/provider handling persistence
4. **Call chain**: Complete path from UI → state → repository → database

This information enables the agent to:
- Add new setting fields with correct schema
- Modify persistence logic safely
- Understand data flow for debugging
- Identify all places settings are read/written

## Trace Visualization

```
UserSettingsScreen (Widget)
         ↓ calls
SettingsProvider/Bloc (State)
         ↓ calls
UserSettingsRepository (Service)
         ↓ persists_to
SupabaseClient / LocalStorage (Storage)
         ↓
user_settings table (Database)
```

## Anti-Patterns

- Modifying settings code without understanding full persistence path
- Assuming single storage location (might be local + remote)
- Not checking for caching layers
- Missing sync/conflict handling in multi-device scenarios

## Notes

This scenario tests the "maintenance" workflow where the agent needs to understand existing code before making changes. It heavily relies on the knowledge graph built from code analysis.

### Handling Missing Graph Data

If the knowledge graph doesn't have the expected nodes/edges:
- Fall back to `search_rag` with code search queries
- Use file pattern matching to find likely candidates
- Report that graph indexing may need to be run

### Alternative Symbol Names

The scenario should handle variations:
- `saveUserSettings`, `updateSettings`, `setUserPreference`
- `UserSettingsRepository`, `SettingsService`, `PreferencesProvider`
- `user_settings`, `preferences`, `settings` tables
