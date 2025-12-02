# Scenario: Stripe Billing Integration

## Overview

- **Goal**: Agent adds Stripe subscription billing to an existing Flutter app with a Node.js/TypeScript backend
- **Starting Collection**: `placeholder-collection-id` (existing project + Stripe docs + payment examples)
- **Primary Tools**: `get_project_tech_stack`, `get_feature_recipe`, `find_code_examples`, `search_mobile_docs`
- **Category**: Payments
- **Difficulty**: Hard

## Preconditions

- Collection contains:
  - Existing Flutter project codebase (already indexed)
  - Stripe official documentation
  - Payment integration recipes
  - Backend Node.js/TS examples
- Project has tech stack profile already generated

## Workflow Steps

### Step 1: Analyze Existing Tech Stack

**Tool**: `get_project_tech_stack`
**Purpose**: Understand the existing project architecture before adding billing

```json
{
  "collectionId": "placeholder-collection-id"
}
```

**Expected Results**:
- Framework: Flutter (with version)
- Backend: Node.js/TypeScript
- Database: PostgreSQL or Supabase
- State management solution (Riverpod, Bloc, etc.)
- Existing payment/billing if any

**Success Criteria**:
- Tech stack profile returned
- Framework identified as Flutter
- Backend technology identified

---

### Step 2: Get Billing Recipe

**Tool**: `get_feature_recipe`
**Purpose**: Retrieve the recommended pattern for Stripe billing integration

```json
{
  "featureTags": ["payments", "billing", "subscriptions"],
  "framework": "flutter",
  "tech_stack": ["stripe", "node"]
}
```

**Expected Results**:
- Complete billing implementation recipe
- Architecture for client/server split
- Webhook handling patterns
- Subscription lifecycle management

**Success Criteria**:
- At least 1 recipe result returned
- Result contains subscription/billing patterns
- Covers both frontend and backend

---

### Step 3: Find Checkout Examples

**Tool**: `find_code_examples`
**Purpose**: Get working code for Stripe checkout flow

```json
{
  "feature": "stripe checkout payment sheet",
  "framework": "flutter",
  "tech_stack": ["stripe"],
  "limit": 5
}
```

**Expected Results**:
- Flutter Stripe SDK integration code
- Payment sheet implementation
- Customer portal integration

**Success Criteria**:
- At least 2 code examples returned
- Examples include stripe_flutter package usage
- Payment sheet or checkout flow present

---

### Step 4: Search Backend Webhook Docs

**Tool**: `search_mobile_docs`
**Purpose**: Find Stripe webhook handling documentation for Node.js backend

```json
{
  "query": "stripe webhooks node typescript subscription events",
  "featureTags": ["payments", "backend"],
  "tech_stack": ["node", "typescript"]
}
```

**Expected Results**:
- Webhook signature verification code
- Subscription event handling
- Database update patterns

**Success Criteria**:
- At least 1 result with webhook handling
- Node.js/TypeScript code snippets
- Covers subscription lifecycle events

---

## Success Criteria Summary

| Criterion | Required |
|-----------|----------|
| `get_project_tech_stack` called | Yes |
| `get_feature_recipe` called | Yes |
| `find_code_examples` called | Yes |
| `search_mobile_docs` called | Yes |
| Tech stack identified | Yes |
| Billing recipe found | Yes |
| Code examples found | Yes |
| Total tool calls | >= 4 |

## Expected Outcome

After completing this scenario, the agent should have gathered:

1. **Project context**: Existing tech stack and architecture
2. **Integration pattern**: Recommended Stripe + Flutter + Node.js architecture
3. **Frontend code**: Payment sheet and checkout implementations
4. **Backend code**: Webhook handlers and subscription management

This information enables the agent to:
- Add stripe_flutter package with correct configuration
- Create backend endpoints for checkout sessions
- Implement webhook handlers for subscription events
- Handle payment UI with proper error states

## Workflow Diagram

```
[get_project_tech_stack] → Understand existing architecture
          ↓
[get_feature_recipe] → Get billing integration pattern
          ↓
[find_code_examples] → Get Flutter checkout code
          ↓
[search_mobile_docs] → Get backend webhook handling
```

## Anti-Patterns

- Implementing billing without checking existing tech stack
- Using client-side only billing (security issue)
- Not handling webhook verification
- Skipping subscription lifecycle management

## Notes

This scenario tests the "integration" workflow where the agent must understand existing project context before adding a new feature. The `get_project_tech_stack` call is critical for ensuring the billing implementation matches the existing architecture.
