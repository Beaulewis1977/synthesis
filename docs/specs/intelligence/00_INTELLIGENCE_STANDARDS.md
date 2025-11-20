# Intelligence Standards & Implementation Guide

## The "Intelligence" Maturity Model

When adding a new language, aim for **Level 3**.

| Level | Capability | Current State |
|-------|------------|---------------|
| **L0** | **Text Dump** | Treating code like `.txt` files. No structure. |
| **L1** | **RegEx Chunking** | Splitting by simple delimiters (empty lines). Often breaks functions in half. |
| **L2** | **AST Parsing** | (Current TS/Dart) extracting functions/classes cleanly. Preserves imports. |
| **L3** | **Semantic Tagging** | **(Target)** Identifying *roles* (e.g., "This is a ViewModel", "This is an API Route"). |
| **L4** | **Graph Awareness** | Understanding "This API route calls *that* DB function". |

---

## Implementation Standard for New Languages

For every new language (Kotlin, Swift, Python), you must implement a dedicated **Analyzer** in `apps/server/src/pipeline/` that fulfills these 4 requirements:

### 1. Strict AST Parsing (No Regex)
You must use a proper parser (e.g., `tree-sitter`, `typescript-eslint` for JS, specialized parsers) to guarantee valid code blocks.
*   **Requirement:** Every chunk must be syntactically valid (balanced braces/parentheses).
*   **Requirement:** Imports/Requires must be preserved in metadata.

### 2. "Role" Detection (The Secret Sauce)
This is what makes the Flutter analyzer "smart" (detecting `StatelessWidget`). You must define heuristics for the target language.

**Metadata Field:** `role` (enum)
*   `ui_component`: Renders pixels (React Component, SwiftUI View, Android Activity).
*   `state_manager`: Handles logic (Redux Slice, ViewModel, Controller).
*   `data_model`: Defines shape (DTO, Entity, Struct, Schema).
*   `api_endpoint`: Entry point for traffic (Route handler, Controller method).
*   `service`: Business logic helper.
*   `configuration`: Env vars, setup code.

### 3. "Tech Stack" Tagging
The analyzer must detect specific libraries used within the file and tag them.
*   *Example:* If a Python file imports `boto3`, tag `tech_stack: ['aws']`.
*   *Example:* If a Kotlin file uses `@HiltAndroidApp`, tag `tech_stack: ['hilt', 'dependency_injection']`.

### 4. Cross-File Relationship Heuristics
Define how this language references others.
*   **Explicit:** `import x from 'y'` (Source -> Dependency).
*   **Implicit:** Convention-based (e.g., Next.js `pages/api/user.ts` maps to `GET /api/user`).

