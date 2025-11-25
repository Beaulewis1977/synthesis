# Model Selector Feature: Summary & Build Plan

## 1. Overview

The goal of this feature is to provide a **runtime model & provider selector** for all major LLM- and embedding-backed capabilities in Synthesis, so that:

- You can choose **which provider/model** is used for:
  - Agent chat
  - Document summarization tools
  - Synthesis contradiction detection
  - Vision OCR
  - Vector embeddings (docs, code, writing/personal)
  - Search reranking
- You can express preferences like **"local-only" vs "cloud-allowed"** without editing `.env`.
- A simple **admin UI** exposes these settings and persists them to the database, while `.env` remains the source of truth for secrets and sane defaults.

This feature should be implemented **after current testing** stabilizes the default configuration, and it should be compatible with the existing `.env`-driven behavior (env remains the default if no overrides are configured).

---

## 2. Functional Requirements

### 2.1 Per-feature model selection

For each of the following features, the user can view and change the active configuration via UI:

- **Chat / Agent**
  - Provider: Anthropic | Ollama (future) | (optionally others later)
  - Model: e.g. `claude-3-5-haiku-20241022`, `claude-3-opus-20240229`, etc.

- **Document Summarization Tool**
  - Provider: Anthropic (initially)
  - Model: default same as Chat unless overridden.

- **Synthesis Contradiction Detection**
  - Provider: Anthropic
  - Model: from a small, curated list (e.g. Haiku variants).

- **Vision OCR for PDFs**
  - Provider: Anthropic Vision
  - Model: `VISION_OCR_MODEL` compatible models (starting with `claude-3-5-haiku-20241022`).

- **Embeddings**
  - Docs/general: provider + model (currently `DOC_EMBEDDING_PROVIDER` → Ollama/OpenAI/Voyage).
  - Code: provider + model (currently `CODE_EMBEDDING_PROVIDER` → typically Voyage).
  - Writing/personal: provider + model (currently `WRITING_EMBEDDING_PROVIDER` → typically OpenAI).

- **Search Reranker**
  - Provider: `none` | `bge` (local) | `cohere` (cloud).
  - Model: implied by provider for now (e.g., Voyage and Cohere models are fixed initially).

### 2.2 Local vs cloud preference

- UI exposes a **"Local only"** toggle per feature group.
- When `local_only=true`, backend must:
  - Restrict providers/models to those that do not require external API calls.
  - Fail gracefully with a clear error if no local provider is available.

### 2.3 Persistence & defaults

- **Defaults** come from existing `.env` variables (e.g., `DOC_EMBEDDING_PROVIDER`, `VISION_OCR_MODEL`, `CONTRADICTION_MODEL`, `RERANKER_PROVIDER`, etc.).
- **Overrides** are stored in the database in a new configuration table, and are resolved at runtime by a central config service.
- If a DB override is invalid (e.g., chooses `cohere` but `COHERE_API_KEY` is missing), backend must:
  - Either reject the update, or
  - Fall back to the env default and surface a validation error in the UI.

### 2.4 Scope & constraints

- Initial scope: **global configuration only** (one set of settings for the whole deployment).
- Future scope (out-of-scope but design-aware): per-collection or per-user model overrides.
- No secrets (API keys) are ever stored in DB or visible in the UI; only provider/model choices.

---

## 3. High-level Architecture

### 3.1 Config service

Introduce a **ModelConfigService** in the backend (e.g., under `apps/server/src/services/model-config.ts`) with responsibilities:

- Read env-based defaults for each feature:
  - Chat model (new env, e.g. `CHAT_MODEL`), default to `claude-3-5-haiku-20241022`.
  - Summary model (e.g. `SUMMARY_MODEL`, defaulting to `CHAT_MODEL`).
  - `CONTRADICTION_MODEL`, `VISION_OCR_MODEL` (already env-based).
  - Embedding providers from existing envs:
    - `DOC_EMBEDDING_PROVIDER`, `CODE_EMBEDDING_PROVIDER`, `WRITING_EMBEDDING_PROVIDER`.
  - `RERANKER_PROVIDER` / `RERANKER_PROVIDER_OVERRIDE`.
- Load persisted model configuration rows from DB (new table, see below).
- Expose typed getters the rest of the code can use, for example:
  - `getChatModelConfig()` → { provider, model, localOnly }.
  - `getSummaryModelConfig()`.
  - `getOCRModelConfig()`.
  - `getContradictionModelConfig()`.
  - `getEmbeddingConfig('docs' | 'code' | 'writing')`.
  - `getRerankerConfig()`.
- Apply precedence:
  1. **DB override** (if valid), otherwise
  2. **Env default**, otherwise
  3. **Hard-coded safe fallback** (if any).

### 3.2 Database schema

Add a table (in `packages/db` migration) for model configuration, e.g.:

```sql
model_configs (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null default 'global', -- only 'global' for now
  scope_id text null,                         -- reserved for collection/user
  feature text not null,                      -- 'chat', 'summary', 'ocr', 'contradiction', 'embedding_docs', 'embedding_code', 'embedding_writing', 'reranker'
  provider text not null,                     -- 'anthropic', 'ollama', 'openai', 'voyage', 'cohere', 'none'
  model text not null,                        -- concrete model string
  local_only boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Add a small seed migration that **mirrors current env defaults** into this table at first run so the UI has data to display.

### 3.3 Backend integration points

Refactor the following areas to use `ModelConfigService` instead of hard-coded values / raw envs:

- `apps/server/src/agent/agent.ts`
  - Replace literal `'claude-3-5-haiku-20241022'` with `config.getChatModelConfig()`.
- `apps/server/src/agent/tools.ts` (summarize document tool)
  - Replace literal model with `config.getSummaryModelConfig()`.
- `apps/server/src/pipeline/vision-ocr.ts`
  - Replace direct `VISION_OCR_MODEL` reads with `config.getOCRModelConfig()`.
- `apps/server/src/services/contradiction-detection.ts`
  - Use `config.getContradictionModelConfig()` instead of reading `CONTRADICTION_MODEL` directly.
- `apps/server/src/services/embedding-router.ts` / `pipeline/embed.ts`
  - Delegate provider/model resolution to `config.getEmbeddingConfig(kind)` but keep env vars as defaults.
- `apps/server/src/services/reranker.ts`
  - Use `config.getRerankerConfig()` to select provider, still honoring env overrides.

The goal is **no UI code touches `.env`**, only this config service and the DB-backed table.

### 3.4 API surface for UI

Add admin-only routes, e.g. under `apps/server/src/routes/model-config.ts`:

- `GET /api/admin/models` → returns current effective config per feature (provider, model, localOnly, enabled, and whether it came from env or DB override).
- `PUT /api/admin/models` → accepts updates for one or more feature configs, with validation:
  - Check provider is supported and compatible with `localOnly` flag.
  - Check required API keys exist for cloud providers.
  - On success, upsert into `model_configs` table.

Integrate this route file into the Fastify server registration.

---

## 4. UI Design (High-level)

Add a new **"Models & Providers"** admin page in the web app:

- Route: e.g. `/settings/models` (link from an admin or settings menu).
- Layout: table or cards with one row per feature group:
  - Chat
  - Summarization
  - Synthesis Contradictions
  - Vision OCR
  - Embeddings (docs/code/writing)
  - Reranker
- For each row:
  - **Provider** select (dropdown) constrained to valid values.
  - **Model** text input or limited dropdown (pre-populated with recommended defaults).
  - **Local-only** toggle.
  - **Enabled** toggle (where applicable).
- Fetch initial data from `GET /api/admin/models`.
- On change, send `PUT /api/admin/models` with the updated row(s) and show success or validation errors.

Role/permissions:
- Initially, assume **single-user dev setup** (no auth) or reuse existing auth gate if present.
- Future extension: only allow access for admin users.

---

## 5. Implementation Phases

### Phase 1 – Config & DB plumbing

1. Add `model_configs` table migration in `packages/db`.
2. Implement `ModelConfigService` with env → DB → fallback precedence.
3. Implement `GET /api/admin/models` & `PUT /api/admin/models` routes.
4. Write unit tests for the config service and routes, including validation:
   - Missing keys for cloud providers.
   - Invalid provider strings.
   - Local-only constraints.

### Phase 2 – Wire backend features to config

1. Update agent chat, summarize tool, contradiction detection, OCR to use config service.
2. Update embeddings and reranker logic to delegate provider/model selection to config service.
3. Ensure existing env behavior is preserved when no DB overrides are present (backwards compatible).
4. Add integration tests (Vitest) to verify that a DB override actually changes the called model/provider.

### Phase 3 – Admin UI

1. Add `/settings/models` page in `apps/web` with query hooks calling the new API.
2. Implement table/form controls for each feature type.
3. Handle optimistic updates and error states from backend validation.
4. Add basic Cypress/Playwright UI tests (or Vitest + React Testing Library) to cover main flows.

### Phase 4 – Polish & Documentation

1. Update `docs/CONFIGURATION.md` to explain the relationship between `.env` defaults and runtime model configuration.
2. Add troubleshooting section (e.g., what happens if a selected provider lacks an API key).
3. Optionally add a lightweight audit log (even just Fastify logs) when model configs change.

---

## 6. Acceptance Criteria

- Backend uses **config service** for all model/provider choices (no remaining hard-coded model strings).
- `.env` continues to provide safe defaults; removing all DB overrides reverts to current behavior.
- Admin UI allows changing provider/model for all listed features without editing `.env`.
- Invalid configurations (missing keys, unsupported provider for local-only, etc.) are prevented or clearly surfaced.
- All existing tests pass; new tests cover config resolution and UI flows.
