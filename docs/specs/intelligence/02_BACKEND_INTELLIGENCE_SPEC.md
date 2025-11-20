# Backend Intelligence Specification (Python & Extended Node)

**Goal:** Enable Synthesis to understand the "Business Logic" layer of your SaaS.
**Target Level:** L3 (Semantic Tagging)

---

## 1. Python Intelligence (`python-analyzer.ts`)

**Parser:** Use `tree-sitter-python` or a robust WASM-based Python parser.

### Role Detection Heuristics

| Role | Pattern / Heuristic | Example |
|------|---------------------|---------|
| `api_endpoint` | Decorators starting with `@app.`, `@router.`, `@*.get/post/put/delete` | `@app.get("/users")` |
| `data_model` | Classes inheriting from `BaseModel` (Pydantic), `models.Model` (Django/SQLAlchemy) | `class User(BaseModel):` |
| `task` | Decorators like `@celery.task`, `@shared_task` | `@shared_task def process_payment():` |
| `configuration` | Files named `settings.py`, `config.py`, or classes loading env vars | `class Settings(BaseSettings):` |
| `test` | Functions starting with `test_` or classes inheriting `unittest.TestCase` | `def test_user_creation():` |

### Metadata Extraction
For every `api_endpoint` chunk, extract:
*   **Route Path:** `/api/v1/users/{id}`
*   **HTTP Method:** `GET`, `POST`
*   **Auth Requirement:** Presence of dependencies like `Depends(get_current_user)`

### Tech Stack Detection
*   `fastapi` -> `import fastapi`
*   `django` -> `from django`
*   `pandas` -> `import pandas`
*   `sqlalchemy` -> `from sqlalchemy`
*   `stripe` -> `import stripe` (Payment Processing)

---

## 2. Node.js / TypeScript Extensions (`ts-analyzer.ts` Upgrade)

**Current Status:** Good at general TS parsing.
**Missing:** Backend-specific semantic understanding (NestJS, Express).

### Role Detection Extensions

| Role | Pattern / Heuristic | Example |
|------|---------------------|---------|
| `api_endpoint` | Express: `app.get(...)`, `router.post(...)` | `router.get('/users', ...)` |
| `api_endpoint` | NestJS: `@Get()`, `@Post()`, `@Controller()` | `@Controller('users')` |
| `serverless_function` | Deno: `Deno.serve(...)` (Supabase Edge Function) | `Deno.serve(async (req) => ...)` |
| `data_model` | Prisma: `model User { ... }` (in schema.prisma) | *Handled by schema parser* |
| `data_model` | TypeORM: `@Entity()`, extending `BaseEntity` | `@Entity() class User` |
| `middleware` | Functions taking `(req, res, next)` | `function authMiddleware(req, res, next)` |

### SDK Usage Detection (Integration Intelligence)
Detect specific library calls to tag the *business purpose* of code.

*   **Stripe:** `stripe.checkout.sessions.create`, `stripe.paymentIntents` -> `payment_logic`
*   **RevenueCat:** `Purchases.configure`, `Purchases.getOfferings` -> `subscription_logic`
*   **Supabase Admin:** `supabase.auth.admin` -> `admin_logic`

### Zod Integration
*   **Pattern:** Variables assigned `z.object({ ... })`
*   **Action:** Tag as `validation_schema`.
*   **Value:** These are critical for the LLM to understand API input constraints.

---

## 3. Go Intelligence (Future)

**Parser:** `tree-sitter-go`

### Role Detection
*   `api_endpoint`: Calls to `gin.GET`, `http.HandleFunc`, `echo.POST`.
*   `data_model`: `type X struct { ... }` with `json:"..."` tags.
*   `service`: Structs with methods implementing business logic interfaces.

