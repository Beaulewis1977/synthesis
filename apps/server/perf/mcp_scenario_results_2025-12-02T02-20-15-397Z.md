# MCP Scenario Evaluation Report

**Generated:** 2025-12-02T02:20:15.398Z
**Collection ID:** `3b035748-5817-4438-8acc-d974c88a6233`
**Base URL:** http://localhost:3333
**Scenarios:** 4

## Summary

| Metric | Value |
|--------|-------|
| Total Scenarios | 4 |
| Passed | 0 |
| Failed | 4 |
| **Pass Rate** | **0.0%** |

## Tool Coverage

| Tool | Calls |
|------|-------|
| get_feature_recipe | 3 |
| search_mobile_docs | 3 |
| find_code_examples | 3 |
| get_db_schema | 2 |
| get_project_tech_stack | 2 |
| graph_expand_context | 2 |
| find_symbol_usages | 1 |

## Scenario Results

### authentication (0/1)

#### [FAIL] flutter-supabase-auth

Build a minimal Flutter + Supabase authentication flow. Tests the agent's ability to find recipes, documentation, code examples, and database schema for implementing auth.

**Duration:** 26ms | **Tools Used:** none

| Step | Tool | Status | Duration |
|------|------|--------|----------|
| 1-get-recipe | get_feature_recipe | ERROR | 22ms |
| 2-search-docs | search_mobile_docs | ERROR | 1ms |
| 3-find-examples | find_code_examples | ERROR | 1ms |
| 4-get-db-schema | get_db_schema | ERROR | N/A |

### payments (0/1)

#### [FAIL] flutter-stripe-billing

Add Stripe billing to an existing Flutter app with a Node/TypeScript backend. Tests the agent's ability to understand project tech stack and find payment integration patterns.

**Duration:** 3ms | **Tools Used:** none

| Step | Tool | Status | Duration |
|------|------|--------|----------|
| 1-get-tech-stack | get_project_tech_stack | ERROR | N/A |
| 2-get-recipe | get_feature_recipe | ERROR | N/A |
| 3-find-examples | find_code_examples | ERROR | 1ms |
| 4-search-backend-docs | search_mobile_docs | ERROR | N/A |

### notifications (0/1)

#### [FAIL] firebase-push-notifications

Add push notifications using Firebase Cloud Messaging to an Android + iOS Flutter app. Tests integration of FCM setup across platforms.

**Duration:** 2ms | **Tools Used:** none

| Step | Tool | Status | Duration |
|------|------|--------|----------|
| 1-get-recipe | get_feature_recipe | ERROR | N/A |
| 2-find-examples | find_code_examples | ERROR | 1ms |
| 3-get-tech-stack | get_project_tech_stack | ERROR | 1ms |
| 4-search-platform-docs | search_mobile_docs | ERROR | N/A |

### maintenance (0/1)

#### [FAIL] user-settings-trace

Trace and modify the persistence path for user settings in an existing repository. Tests the agent's ability to use graph context expansion and symbol search for code navigation.

**Duration:** 3ms | **Tools Used:** none

| Step | Tool | Status | Duration |
|------|------|--------|----------|
| 1-get-db-schema | get_db_schema | ERROR | 1ms |
| 2-expand-screen-context | graph_expand_context | ERROR | 1ms |
| 3-find-symbol-usages | find_symbol_usages | ERROR | N/A |
| 4-expand-repository-context | graph_expand_context | ERROR | N/A |

## Failed Scenario Details

### flutter-supabase-auth: Build a minimal Flutter + Supabase authentication flow. Tests the agent's ability to find recipes, documentation, code examples, and database schema for implementing auth.

**Scenario Criteria:**
- [FAIL] **requiredTools:** Missing required tools: get_feature_recipe, find_code_examples, search_mobile_docs, get_db_schema
- [FAIL] **minToolCalls:** Expected at least 4 tool calls, made 0
- [FAIL] **allStepsPassed:** 4 step(s) failed, 4 error(s)

**Failed Steps:**

**1-get-recipe** (get_feature_recipe):

**2-search-docs** (search_mobile_docs):

**3-find-examples** (find_code_examples):

**4-get-db-schema** (get_db_schema):

**Error Steps:**

**1-get-recipe** (get_feature_recipe):
```
fetch failed
```

**2-search-docs** (search_mobile_docs):
```
fetch failed
```

**3-find-examples** (find_code_examples):
```
fetch failed
```

**4-get-db-schema** (get_db_schema):
```
fetch failed
```

### flutter-stripe-billing: Add Stripe billing to an existing Flutter app with a Node/TypeScript backend. Tests the agent's ability to understand project tech stack and find payment integration patterns.

**Scenario Criteria:**
- [FAIL] **requiredTools:** Missing required tools: get_project_tech_stack, get_feature_recipe, find_code_examples, search_mobile_docs
- [FAIL] **minToolCalls:** Expected at least 4 tool calls, made 0
- [FAIL] **allStepsPassed:** 4 step(s) failed, 4 error(s)

**Failed Steps:**

**1-get-tech-stack** (get_project_tech_stack):

**2-get-recipe** (get_feature_recipe):

**3-find-examples** (find_code_examples):

**4-search-backend-docs** (search_mobile_docs):

**Error Steps:**

**1-get-tech-stack** (get_project_tech_stack):
```
fetch failed
```

**2-get-recipe** (get_feature_recipe):
```
fetch failed
```

**3-find-examples** (find_code_examples):
```
fetch failed
```

**4-search-backend-docs** (search_mobile_docs):
```
fetch failed
```

### firebase-push-notifications: Add push notifications using Firebase Cloud Messaging to an Android + iOS Flutter app. Tests integration of FCM setup across platforms.

**Scenario Criteria:**
- [FAIL] **requiredTools:** Missing required tools: get_feature_recipe, find_code_examples, get_project_tech_stack, search_mobile_docs
- [FAIL] **minToolCalls:** Expected at least 4 tool calls, made 0
- [FAIL] **allStepsPassed:** 4 step(s) failed, 4 error(s)

**Failed Steps:**

**1-get-recipe** (get_feature_recipe):

**2-find-examples** (find_code_examples):

**3-get-tech-stack** (get_project_tech_stack):

**4-search-platform-docs** (search_mobile_docs):

**Error Steps:**

**1-get-recipe** (get_feature_recipe):
```
fetch failed
```

**2-find-examples** (find_code_examples):
```
fetch failed
```

**3-get-tech-stack** (get_project_tech_stack):
```
fetch failed
```

**4-search-platform-docs** (search_mobile_docs):
```
fetch failed
```

### user-settings-trace: Trace and modify the persistence path for user settings in an existing repository. Tests the agent's ability to use graph context expansion and symbol search for code navigation.

**Scenario Criteria:**
- [FAIL] **requiredTools:** Missing required tools: get_db_schema, graph_expand_context, find_symbol_usages
- [FAIL] **minToolCalls:** Expected at least 4 tool calls, made 0
- [FAIL] **allStepsPassed:** 4 step(s) failed, 4 error(s)

**Failed Steps:**

**1-get-db-schema** (get_db_schema):

**2-expand-screen-context** (graph_expand_context):

**3-find-symbol-usages** (find_symbol_usages):

**4-expand-repository-context** (graph_expand_context):

**Error Steps:**

**1-get-db-schema** (get_db_schema):
```
fetch failed
```

**2-expand-screen-context** (graph_expand_context):
```
fetch failed
```

**3-find-symbol-usages** (find_symbol_usages):
```
fetch failed
```

**4-expand-repository-context** (graph_expand_context):
```
fetch failed
```

---

_Report generated by mcp_scenario_runner.mjs_
