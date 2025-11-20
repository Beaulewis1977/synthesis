# Infrastructure & Data Intelligence Specification

**Goal:** Enable Synthesis to map the "Ground Truth" of the application (Database Schemas, Cloud Resources).
**Target Level:** L3 (Semantic Tagging)

---

## 1. SQL & Database Intelligence (`sql-analyzer.ts`)

**Current Status:** Partially implemented (Table/Index detection).
**Enhancements:**

### Advanced Role Detection
| Role | Pattern | Value |
|------|---------|-------|
| `migration` | Files in `migrations/` or `supabase/migrations/` | Critical history of schema changes. |
| `trigger` | `CREATE TRIGGER` statements | "Magic" logic that happens invisibly. |
| `rls_policy` | `CREATE POLICY` statements | Security rules. *Crucial* for LLM to understand permissions. |
| `function` | `CREATE FUNCTION` / `plpgsql` | Backend logic living in the DB. |

### Relationship Mapping
*   **Foreign Keys:** Explicitly link Table A -> Table B chunks.
*   **Graph Construction:** Build an in-memory graph of table dependencies to improve "Related Files" retrieval.

---

## 2. Infrastructure as Code (Terraform/Docker)

**Parser:** `tree-sitter-hcl` (Terraform), Custom Docker parser.

### Terraform Heuristics
| Role | Pattern |
|------|---------|
| `resource` | `resource "type" "name" { ... }` |
| `data_source` | `data "type" "name" { ... }` |
| `provider` | `provider "name" { ... }` |
| `variable` | `variable "name" { ... }` |

### Docker Heuristics
*   **Base Image:** Extract `FROM` instruction. Tag as `base_os`.
*   **Entrypoint:** Extract `CMD` / `ENTRYPOINT`. Tag as `runtime_command`.

---

## 3. Supabase Specifics (The "Glue")

Since you use Supabase heavily, we need specific detectors for its configuration:

### `supabase/config.toml`
*   **Role:** `configuration`
*   **Metadata:** Extract active auth providers, storage bucket names, and edge function definitions.

### Edge Functions (`index.ts` in `supabase/functions/*`)
*   **Heuristic:** `Deno.serve(...)`
*   **Role:** `serverless_function`
*   **Metadata:** Map the folder name to the function slug (e.g., `functions/payment-webhook` -> `payment-webhook`).

