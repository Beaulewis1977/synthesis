---
title: "Supabase Edge Functions (Deno)"
platform: backend
framework: deno
feature_tags:
  - serverless
  - edge
usage_tier: recipe
framework_version: "1.x"
tech_stack:
  - supabase
  - deno
difficulty: intermediate
last_updated: 2025-12-08
recommended: true
---

# Supabase Edge Functions

> **Summary:** Write and deploy globally distributed TypeScript functions using Deno. Ideal for webhooks, payment processing, or lightweight API logic.

## Prerequisites

- [ ] Supabase CLI installed (`brew install supabase/tap/supabase`)
- [ ] Docker (for local testing)

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Deno | 1.4x | Runtime |
| Supabase CLI | Latest | Deployment Tool |

## Step-by-Step Implementation

### 1. Create a Function

```bash
supabase functions new my-function
```

This creates `supabase/functions/my-function/index.ts`.

### 2. Implementation Pattern

Supabase functions use standard Web API `Request` and `Response` objects.

> **⚠️ SECURITY WARNING:** The example below uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses Row Level Security. Only use this for internal/authenticated workloads. For user-facing endpoints, use the anon key with the user's JWT from the `Authorization` header.

```typescript
// supabase/functions/my-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // CORS configuration
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    // 1. Parse Input
    const { name } = await req.json()

    // 2. Initialize Client
    // OPTION A: Service Role (internal use only - bypasses RLS!)
    // Only use for webhooks, cron jobs, or authenticated internal calls
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // OPTION B: User context (recommended for user-facing endpoints)
    // Uses the user's JWT to respect Row Level Security
    // const authHeader = req.headers.get('Authorization')!
    // const supabaseClient = createClient(
    //   Deno.env.get('SUPABASE_URL') ?? '',
    //   Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    //   { global: { headers: { Authorization: authHeader } } }
    // )

    // 3. Logic (using admin client - ensure this endpoint is protected!)
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({ name })
      .select()

    if (error) throw error

    // 4. Response
    return new Response(
      JSON.stringify(data),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }
})
```

### 3. Local Development

Serve functions locally. They will hot-reload on changes.

```bash
supabase functions serve --no-verify-jwt
```

Test with curl:

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/my-function' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Test"}'
```

### 4. Deployment

```bash
supabase functions deploy my-function
# Set secrets
supabase secrets set STRIPE_KEY=sk_test_...
```

## Common Pitfalls

### 1. Node.js vs Deno

**Problem:** Trying to import npm packages directly.

**Solution:** Deno uses ES Modules. Use `esm.sh` or `deno.land` imports.

```typescript
// Bad
// import { z } from 'zod';
// Good
import { z } from 'https://deno.land/x/zod/mod.ts';
```

### 2. Cold Starts

**Problem:** Database connections in the global scope might time out or behave unexpectedly if not managed.

**Solution:** For lightweight usage, `supabase-js` HTTP client is fine. For heavy DB usage, use a connection pooler string (Supabase Transaction Mode on port 6543) and a Deno postgres driver to avoid connection exhaustion.
