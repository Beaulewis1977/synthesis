# Phase 17: Custom LLM Providers & API Testing Fixes

## Overview

Enable users to add custom OpenAI-compatible LLM providers (vLLM, LMStudio, OpenRouter, Groq, etc.) with model auto-discovery, connection testing, and full tool calling support. Also fix missing API key testing for Z.AI and Moonshot providers, and add Anthropic OAuth/API key toggle.

## Current State

### Working Features
- Multi-provider chat (Anthropic, OpenAI, Google, Ollama, Z.AI/Zhipu, Moonshot)
- `OpenAICompatibleProvider` base class for OpenAI-compatible APIs
- API key encryption (AES-256-GCM) in `provider_api_keys` table
- `ProviderSettingsService` for provider-specific settings
- API key testing for: Anthropic, OpenAI, Google, Voyage, Cohere

### Known Issues (To Fix)
1. Z.AI API key testing not supported
2. Moonshot API key testing not supported
3. No custom provider support
4. No OAuth option for Anthropic (Claude subscription billing)

## Environment

- **Branch:** `feature/custom-llm-providers` (off `develop`)
- **Infrastructure:** Docker Compose (PostgreSQL + Ollama + Redis)

---

## Sub-Phase Index

| Phase | Description | File |
|-------|-------------|------|
| 17A | Anthropic OAuth/API Key Toggle | [17A_anthropic_oauth.md](17A_anthropic_oauth.md) |
| 17B | Fix Z.AI & Moonshot API Testing | [17B_api_testing_fix.md](17B_api_testing_fix.md) |
| 17C | Database Schema for Custom Providers | [17C_database_schema.md](17C_database_schema.md) |
| 17D | Backend CustomProviderService | [17D_backend_service.md](17D_backend_service.md) |
| 17E | Backend Custom Provider Routes | [17E_backend_routes.md](17E_backend_routes.md) |
| 17F | Integrate into Chat System | [17F_chat_integration.md](17F_chat_integration.md) |
| 17G | Frontend API Client & Hooks | [17G_frontend_hooks.md](17G_frontend_hooks.md) |
| 17H | Frontend CustomProviderForm Component | [17H_provider_form.md](17H_provider_form.md) |
| 17I | Settings UI Integration | [17I_settings_ui.md](17I_settings_ui.md) |
| 17J | Chat Model Selector Integration | [17J_chat_selector.md](17J_chat_selector.md) |

---

## Parallel Execution Plan

### Wave 1: Foundation (3 tasks in parallel)
| Task | Subagent/Skill | Dependencies |
|------|----------------|--------------|
| Phase 17A: Anthropic OAuth | `backend-development` | None |
| Phase 17B: Fix API Testing | None (simple) | None |
| Phase 17C: Database Migration | None (simple) | None |

### Wave 2: Backend Core (3 tasks in parallel)
| Task | Subagent/Skill | Dependencies |
|------|----------------|--------------|
| Phase 17D: CustomProviderService | `Explore` x2, `backend-development` | 17C |
| Phase 17E: Routes (start) | `Explore`, `synthesis-architecture` | 17C |
| Shared Types | None | None |

### Wave 3: Backend Complete + Frontend Start (4 tasks in parallel)
| Task | Subagent/Skill | Dependencies |
|------|----------------|--------------|
| Phase 17E: Routes (complete) | `code-reviewer` | 17D |
| Phase 17F: Chat Integration | `Explore` x2, `llm-provider-integration` | 17D, 17E |
| Phase 17G: API Client & Hooks | `Explore` x2, `frontend-design` | 17E |
| Frontend Types | None | Shared Types |

### Wave 4: Frontend UI (3 tasks in parallel)
| Task | Subagent/Skill | Dependencies |
|------|----------------|--------------|
| Phase 17H: CustomProviderForm | `Explore` x2, `frontend-ui-architect` | 17G |
| Phase 17I: ModelsPage Integration | `Explore`, `frontend-design` | 17G, 17H |
| Phase 17J: ChatModelSelector | `frontend-design` | 17G |

### Wave 5: Review & Testing (2 tasks in parallel)
| Task | Subagent/Skill | Dependencies |
|------|----------------|--------------|
| Code Review | `code-reviewer` | All phases |
| Integration Testing | `test-writer` | All phases |

---

## GitHub Workflow

### Branch Strategy
- **Base branch:** `develop`
- **Feature branch:** `feature/custom-llm-providers` (already created)

### IMPORTANT: No Committing or Pushing Without User Permission

**Before ANY commit:**
1. Show the user the changes to be committed
2. Wait for explicit approval
3. Only then run `git commit`

**Before ANY push:**
1. Show the user the commits to be pushed
2. Wait for explicit approval
3. Only then run `git push`

### Commit Messages (Atomic, Logical Units)

| Phase | Commit Message |
|-------|---------------|
| 17A | `feat(anthropic): add OAuth/API key authentication toggle` |
| 17B | `fix(api-keys): add API key testing for Zhipu and Moonshot providers` |
| 17C | `feat(db): add custom_providers table migration` |
| 17D | `feat(server): add CustomProviderService with CRUD and model discovery` |
| 17E | `feat(server): add custom-providers admin routes` |
| 17F.1 | `feat(shared): add CustomProvider types` |
| 17F.2 | `feat(server): integrate custom providers into chat provider factory` |
| 17G | `feat(web): add custom provider API client and hooks` |
| 17H | `feat(web): add CustomProviderForm component` |
| 17I | `feat(web): add Custom Providers section to ModelsPage` |
| 17J | `feat(web): integrate custom providers into ChatModelSelector` |

### PR Strategy
- **Single PR** for all Phase 17 changes
- **Title:** `feat: add custom OpenAI-compatible LLM provider support`
- **Target:** `develop`

---

## Skills Reference

| Skill | Used In Phases |
|-------|----------------|
| `synthesis-architecture` | 17A, 17D, 17E, 17F, 17I, 17J |
| `backend-development` | 17A, 17B, 17C, 17D, 17E |
| `saas-backend-stack` | 17C, 17D, 17G |
| `llm-provider-integration` | 17F |
| `frontend-design` | 17G, 17H, 17I, 17J |
| `professional-frontend-stack` | 17H |

---

## Subagents Reference

| Subagent | Used In Phases |
|----------|----------------|
| `Explore` | 17D, 17E, 17F, 17G, 17H, 17I |
| `code-reviewer` | 17E, 17I, 17J, Wave 5 |
| `frontend-ui-architect` | 17H |
| `test-writer` | Wave 5 |
| `context7-docs-fetcher` | 17D (OpenAI SDK) |

---

## MCP Servers & Tools

| Tool | Purpose |
|------|---------|
| `context7` | OpenAI SDK docs for /v1/models, custom baseURL patterns |
| `perplexity` | Research provider APIs (vLLM, LMStudio, OpenRouter, Groq) |
| `mcp__ide__getDiagnostics` | TypeScript errors during implementation |

---

## Tracking Documents

- **[01_CHECKLIST.md](01_CHECKLIST.md)** - Master verification checklist
- **[02_SUMMARY_LOG.md](02_SUMMARY_LOG.md)** - Progress log (agent-updated)

---

## Reference Links

- OpenAI /v1/models endpoint: https://platform.openai.com/docs/api-reference/models/list
- vLLM OpenAI-compatible server: https://docs.vllm.ai/en/latest/serving/openai_compatible_server/
- LMStudio OpenAI compatibility: https://lmstudio.ai/docs/api/openai-api
- OpenRouter API: https://openrouter.ai/docs

### Key Codebase Files
- `apps/server/src/services/chat-providers/openai-compatible.ts`
- `apps/server/src/services/api-key-service.ts`
- `apps/web/src/components/ChatModelSelector.tsx`
- `apps/web/src/pages/settings/ModelsPage.tsx`
