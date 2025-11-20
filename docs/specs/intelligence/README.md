# Intelligence Implementation Roadmap

This folder (`docs/specs/intelligence/`) contains the technical blueprints for making Synthesis "smart" about different technologies.

## 🎯 The "Core Stack" Priority List (Your Immediate Needs)

You specifically asked for: **Flutter, Supabase, Postgres, Redis, RevenueCat, Stripe, RLS, Deno, Node, TS, Realtime, Dart.**

Here is the exact order to implement the intelligence for these, from "Must Have" to "Nice to Have".

### 🛑 Phase A: The "Brain" of the SaaS (Critical Path)
*These technologies define YOUR business logic and data truth. Without these, the LLM is guessing.*

1.  **Postgres & RLS (Supabase)** - *Spec: `03_INFRA_DATA_SPEC.md`*
    *   **Why:** RLS (Row Level Security) is your security model. The LLM *must* understand your `CREATE POLICY` statements to write secure code.
    *   **Action:** Implement the SQL Analyzer upgrades to detect `CREATE POLICY` and `CREATE TRIGGER`.
2.  **Supabase Edge Functions (Deno/TS)** - *Spec: `03_INFRA_DATA_SPEC.md`*
    *   **Why:** This is where your backend logic lives.
    *   **Action:** Update `ts-analyzer.ts` to specifically detect `Deno.serve` patterns.
3.  **Flutter/Dart (Existing Polish)** - *Spec: `01_MOBILE_INTELLIGENCE_SPEC.md`*
    *   **Why:** You already have this, but you need the enhancements (Bloc/Riverpod detection) so it handles complex state management better.
    *   **Action:** Add the `Bloc` and `Provider` heuristics to `dart-analyzer.ts`.

### 🚧 Phase B: The "Nervous System" (Integrations)
*These connect your app to the world (Payments, Analytics).*

4.  **Stripe & RevenueCat (SDK Usage)** - *Spec: `02_BACKEND_INTELLIGENCE_SPEC.md` (Node/Python)*
    *   **Why:** You don't need a "Stripe Parser". You need to detect *usage* of the Stripe SDK in your Node/Deno code.
    *   **Action:** Add `tech_stack` tagging for `stripe`, `revenuecat`. Detect calls to `stripe.checkout.sessions.create` as `payment_flow`.
5.  **Redis (Caching/Queues)** - *Spec: `04_CROSS_PLATFORM_SPEC.md`*
    *   **Why:** Redis is simple, but you need to know *where* it's used.
    *   **Action:** Implement the "Usage Scanner" to find `redis.set`/`redis.publish` calls in your backend.

### 🎨 Phase C: Future Expansion (When needed)
*Implement these only when you actually start writing code in these languages.*

6. **React Native** - *Spec: `04_CROSS_PLATFORM_SPEC.md`*
7. **Firebase/Firestore** - *Spec: `04_CROSS_PLATFORM_SPEC.md`*

---

## ❓ Do all of them need "Special Intelligence"?

**No.** And here is the honest truth:

*   **YES, Special Intelligence Needed:**
  *   **SQL/RLS:** Because strict security logic cannot be "fuzzy".
  *   **Flutter/Dart:** Because the nesting structure of Widgets is unique and hard for generic parsers.
  *   **Backend Logic (Node/Deno/Python):** Because parsing API routes (`GET /user`) is high-value metadata.

*   **NO, Standard Ingestion is Fine:**
  *   **RevenueCat/Stripe:** These are just *libraries*. You don't need a special parser for them. You just need your existing TypeScript analyzer to say "Oh, this file imports `stripe`". That is enough (Level 2).
  *   **Redis:** It's a key-value store. You don't need deep structural parsing. Simple usage detection is enough.
  *   **Realtime:** This is just a feature of Supabase. As long as you parse the Client SDK usage (in Dart/JS), you are good.

**Verdict:**
Don't over-engineer parsers for libraries (Stripe/RevenueCat). **DO** engineer parsers for **Languages** (SQL, Dart, TS, Python) and **Framework Patterns** (Supabase RLS, Flutter Widgets, NestJS Controllers).

