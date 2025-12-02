# Mobile Feature Recipes Evaluation Report

**Generated:** 2025-12-01T01:00:01.929Z
**Collection ID:** `3b035748-5817-4438-8acc-d974c88a6233`
**Base URL:** http://localhost:3333
**Tasks:** 10

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 10 |
| Passed | 1 |
| Failed | 9 |
| Errors | 0 |
| **Pass Rate** | **10.0%** |

## Results by Category

### authentication (0/3)

| Task ID | Description | MCP Tool | Status | Score |
|---------|-------------|----------|--------|-------|
| auth-001 | Implement email/password auth in Flutter using Supabase | search_mobile_docs | FAIL | 3/4 |
| auth-002 | Social authentication with Google/Apple sign-in | find_code_examples | FAIL | 0/1 |
| auth-003 | Firebase authentication setup | search_mobile_docs | FAIL | 3/4 |

### payments (0/1)

| Task ID | Description | MCP Tool | Status | Score |
|---------|-------------|----------|--------|-------|
| payments-001 | Add subscription billing with Stripe to Flutter app | search_mobile_docs | FAIL | 3/4 |

### subscriptions (0/1)

| Task ID | Description | MCP Tool | Status | Score |
|---------|-------------|----------|--------|-------|
| subscriptions-001 | In-app subscriptions with RevenueCat | get_feature_recipe | FAIL | 3/4 |

### push_notifications (0/1)

| Task ID | Description | MCP Tool | Status | Score |
|---------|-------------|----------|--------|-------|
| notifications-001 | Add push notifications for Android/iOS using Firebase | search_mobile_docs | FAIL | 3/4 |

### offline (0/2)

| Task ID | Description | MCP Tool | Status | Score |
|---------|-------------|----------|--------|-------|
| offline-001 | Implement offline caching for feed screen | get_feature_recipe | FAIL | 3/4 |
| offline-002 | Data synchronization with conflict resolution | search_mobile_docs | FAIL | 3/4 |

### edge_cases (1/2)

| Task ID | Description | MCP Tool | Status | Score |
|---------|-------------|----------|--------|-------|
| edge-001 | Query with very specific terms that may not match | search_mobile_docs | PASS | 2/2 |
| edge-002 | Ambiguous multi-feature query | search_mobile_docs | FAIL | 2/3 |

## Failed Tasks Details

### auth-001: Implement email/password auth in Flutter using Supabase

**MCP Tool:** search_mobile_docs
**Results Found:** 10

**Checks:**
-  **minResults:** Got 10 results (min: 1)
-  **requiredUsageTiers:** Found usage tier(s): recipe
-  **requiredFeatureTags:** Found feature tag(s): auth, social_auth
-  **expectedDocPatterns:** Only matched 0/3 patterns: none

### auth-002: Social authentication with Google/Apple sign-in

**MCP Tool:** find_code_examples
**Results Found:** 0

**Checks:**
-  **minResults:** Expected at least 1 results, got 0

### auth-003: Firebase authentication setup

**MCP Tool:** search_mobile_docs
**Results Found:** 10

**Checks:**
-  **minResults:** Got 10 results (min: 1)
-  **requiredUsageTiers:** Found usage tier(s): recipe
-  **requiredFeatureTags:** Found feature tag(s): auth, social_auth
-  **expectedDocPatterns:** Only matched 0/2 patterns: none

### payments-001: Add subscription billing with Stripe to Flutter app

**MCP Tool:** search_mobile_docs
**Results Found:** 10

**Checks:**
-  **minResults:** Got 10 results (min: 1)
-  **requiredUsageTiers:** Found usage tier(s): recipe
-  **requiredFeatureTags:** Found feature tag(s): payments, billing, subscriptions
-  **expectedDocPatterns:** Only matched 0/2 patterns: none

### subscriptions-001: In-app subscriptions with RevenueCat

**MCP Tool:** get_feature_recipe
**Results Found:** 10

**Checks:**
-  **minResults:** Got 10 results (min: 1)
-  **requiredUsageTiers:** Found usage tier(s): recipe
-  **requiredFeatureTags:** Found feature tag(s): subscriptions, billing, payments
-  **expectedDocPatterns:** Only matched 0/3 patterns: none

### notifications-001: Add push notifications for Android/iOS using Firebase

**MCP Tool:** search_mobile_docs
**Results Found:** 10

**Checks:**
-  **minResults:** Got 10 results (min: 1)
-  **requiredUsageTiers:** Found usage tier(s): recipe
-  **requiredFeatureTags:** Found feature tag(s): push_notifications, realtime
-  **expectedDocPatterns:** Only matched 0/4 patterns: none

### offline-001: Implement offline caching for feed screen

**MCP Tool:** get_feature_recipe
**Results Found:** 3

**Checks:**
-  **minResults:** Got 3 results (min: 1)
-  **requiredUsageTiers:** Found usage tier(s): recipe
-  **requiredFeatureTags:** Found feature tag(s): offline, local_storage, sync
-  **expectedDocPatterns:** Only matched 0/4 patterns: none

### offline-002: Data synchronization with conflict resolution

**MCP Tool:** search_mobile_docs
**Results Found:** 10

**Checks:**
-  **minResults:** Got 10 results (min: 1)
-  **requiredUsageTiers:** Found usage tier(s): recipe
-  **requiredFeatureTags:** Found feature tag(s): offline, local_storage, sync
-  **expectedDocPatterns:** Only matched 0/2 patterns: none

### edge-002: Ambiguous multi-feature query

**MCP Tool:** search_mobile_docs
**Results Found:** 10

**Checks:**
-  **minResults:** Got 10 results (min: 1)
-  **expectedDocPatterns:** Only matched 0/1 patterns: none
-  **verifyMetadataPresent:** All results have metadata

---

_Report generated by mobile_eval_runner.mjs_
