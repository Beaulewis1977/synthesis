# Phase 4: SaaS Features

## Objective
Prepare the application for multi-user production usage and monetization.

## 1. Multi-tenancy & Data Isolation
**Current State**: Single-tenant assumption (or weak isolation).
**Target State**: Strict logical isolation per Organization/User.

### Implementation Steps
1.  **Schema Update**: Add `org_id` (or `tenant_id`) to *every* relevant table (`collections`, `documents`, `chats`, `api_keys`).
2.  **Middleware**: Ensure the authenticated user's `org_id` is extracted from the session and injected into the request context.
3.  **RLS (Row Level Security)**: If using Supabase/Postgres directly, enable RLS policies to enforce that users can only query rows matching their `org_id`.
4.  **API Refactor**: Update all service calls to include `where org_id = $1` filters.

## 2. Billing & Subscriptions
**Current State**: None.
**Target State**: Stripe Integration.

### Implementation Steps
1.  **Stripe Setup**: Create a Stripe account and define products (Free, Pro, Enterprise).
2.  **Schema Update**: Add `subscription_status`, `stripe_customer_id`, `plan_id` to the `users` or `organizations` table.
3.  **Webhooks**: Create a webhook handler in `apps/server` to listen for Stripe events (`checkout.session.completed`, `customer.subscription.updated`) and update the DB.
4.  **Frontend**: Create a "Billing" settings page to show current plan and usage. Add "Upgrade" buttons.
5.  **Gating**: Implement logic to restrict features based on plan (e.g., "Pro users only", "Max 5 collections for Free tier").

## Success Criteria
- [ ] Data is strictly isolated; User A cannot see User B's collections.
- [ ] Users can subscribe to a plan via Stripe.
- [ ] Features are correctly gated based on subscription status.
