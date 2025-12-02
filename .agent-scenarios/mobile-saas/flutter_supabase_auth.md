# Scenario: Flutter + Supabase Auth Flow

## Overview

- **Goal**: Agent designs and implements a minimal authentication flow for a new Flutter app using Supabase as the backend
- **Starting Collection**: `placeholder-collection-id` (mobile documentation + Supabase docs + Flutter examples)
- **Primary Tools**: `get_feature_recipe`, `find_code_examples`, `search_mobile_docs`, `get_db_schema`
- **Category**: Authentication
- **Difficulty**: Medium

## Preconditions

- Collection contains:
  - Supabase official documentation
  - Flutter authentication examples
  - Mobile feature recipes for auth
- Database has knowledge graph with auth-related nodes and edges

## Workflow Steps

### Step 1: Get Auth Recipe

**Tool**: `get_feature_recipe`
**Purpose**: Retrieve the recommended pattern for Flutter + Supabase authentication

```json
{
  "featureTags": ["auth"],
  "framework": "flutter",
  "tech_stack": ["supabase"]
}
```

**Expected Results**:
- Recipe document with step-by-step auth implementation guide
- Covers email/password, social auth, and session management
- Includes architecture recommendations (state management, routing)

**Success Criteria**:
- At least 1 recipe result returned
- Result contains `usage_tier: "recipe"`
- Content mentions "Supabase" and "authentication"

---

### Step 2: Search Official Docs

**Tool**: `search_mobile_docs`
**Purpose**: Find official Supabase Flutter SDK documentation

```json
{
  "query": "supabase flutter auth signInWithPassword signUp",
  "framework": "flutter",
  "featureTags": ["auth"],
  "sourceQuality": "official"
}
```

**Expected Results**:
- Official Supabase Flutter documentation
- API reference for auth methods
- Configuration guide for Supabase client

**Success Criteria**:
- At least 2 results returned
- Results include official documentation source
- Content covers signIn/signUp methods

---

### Step 3: Find Code Examples

**Tool**: `find_code_examples`
**Purpose**: Get working code examples for auth implementation

```json
{
  "feature": "authentication",
  "framework": "flutter",
  "tech_stack": ["supabase"],
  "limit": 5
}
```

**Expected Results**:
- Complete Flutter widget examples for login/signup screens
- Supabase client initialization code
- Error handling patterns

**Success Criteria**:
- At least 2 code examples returned
- Results have `usage_tier: "example"`
- Code includes Flutter widget imports

---

### Step 4: Get Database Schema

**Tool**: `get_db_schema`
**Purpose**: Understand the auth table structure in Supabase

```json
{
  "collectionId": "placeholder-collection-id",
  "tables": ["users", "auth.users", "profiles"],
  "include_relationships": true
}
```

**Expected Results**:
- User/profile table schemas
- Foreign key relationships
- Column types and constraints

**Success Criteria**:
- Schema extraction enabled message OR table definitions returned
- If tables exist, relationships are included

---

## Success Criteria Summary

| Criterion | Required |
|-----------|----------|
| `get_feature_recipe` called | Yes |
| `search_mobile_docs` called | Yes |
| `find_code_examples` called | Yes |
| `get_db_schema` called | Yes |
| Recipe with auth pattern found | Yes |
| Code examples found | Yes |
| Total tool calls | >= 4 |

## Expected Outcome

After completing this scenario, the agent should have gathered:

1. **Architecture guidance**: Recommended patterns for auth state management
2. **Official documentation**: Supabase Flutter SDK methods
3. **Working examples**: Login/signup widget implementations
4. **Database context**: User table schema for profile storage

This information enables the agent to:
- Implement email/password authentication
- Add social auth providers (Google, Apple)
- Handle auth state with proper session management
- Create user profiles with correct schema

## Anti-Patterns

- Using generic `search_rag` instead of `get_feature_recipe` for patterns
- Skipping `get_db_schema` and guessing table structure
- Not filtering by framework (Flutter) in searches

## Notes

This scenario tests the core "feature design" workflow for authentication, demonstrating how agents should chain multiple tools to gather comprehensive implementation context.
