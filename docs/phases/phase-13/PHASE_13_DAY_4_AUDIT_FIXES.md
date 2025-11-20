# Phase 13 Day 4 — Audit Findings & Fix Plan

Author: Code Intelligence Team

Scope: Bring implementation and documentation into alignment so TypeScript support, ingestion, and relationship tracking work as planned for Phase 13.

---

## Critical blockers to address

- TypeScript chunking not implemented; `.ts/.tsx` currently fall back to text chunks.
- Docs reference non-existent or outdated endpoints/files:
  - `apps/server/src/pipeline/ingest.ts` (actual: `orchestrator.ts`)
  - `/api/ingest/directory` (non-existent)
  - `/api/documents/{id}/chunks` (non-existent)
  - `/api/collections/{name}/documents` using a name (server expects UUID `:id`)
- Relationship tracking is Dart-centric; TS/JS paths and test-file patterns aren’t handled.

---

## Detailed issues and corrective actions

### 1) TypeScript parser and chunking

- Symptom: `.ts/.tsx` files produce `text` chunks; tests explicitly assert fallback behavior.
- Root cause: `chunkTypeScriptCode` is a placeholder and `ts-analyzer.ts` doesn’t exist.
- Fix:
  1. Create `apps/server/src/pipeline/ts-analyzer.ts` using the TypeScript Compiler API. Return a DartAST-compatible structure (`imports`, `functions`, `classes`, `constants`) so the chunker can be language-agnostic.
  2. Implement `chunkTypeScriptCode(...)` in `code-chunker.ts` mirroring Dart logic. Preserve imports when enabled; chunk whole classes if small, else per-method.
  3. Add fixtures `sample.ts` and `sample-react.tsx`; add unit tests `ts-analyzer.test.ts` and extend integration tests to assert function/class chunks for TS.

Example skeleton for `ts-analyzer.ts`:

```ts
import ts from 'typescript';
import type { DartAST } from './dart-analyzer.js';

export async function parseTypeScriptFile(content: string, filePath: string): Promise<DartAST> {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  const ast: DartAST = { imports: [], functions: [], classes: [], constants: [] };

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node)) {
      const spec = node.moduleSpecifier;
      if (ts.isStringLiteral(spec)) ast.imports.push({ uri: spec.text });
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      const code = content.substring(node.pos, node.end).trim();
      ast.functions.push({
        name: node.name.text,
        code,
        parameters: node.parameters.map((p) => p.name.getText()),
        returnType: node.type?.getText() || 'any',
        lineRange: [sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1, sourceFile.getLineAndCharacterOfPosition(node.end).line + 1],
        isAsync: Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)),
        startOffset: node.pos,
        endOffset: node.end,
      });
    }
    if (ts.isClassDeclaration(node) && node.name) {
      const code = content.substring(node.pos, node.end).trim();
      const methods = node.members.filter(ts.isMethodDeclaration).map((m) => ({
        name: m.name.getText(),
        code: content.substring(m.pos, m.end).trim(),
        parameters: m.parameters.map((p) => p.name.getText()),
        returnType: m.type?.getText() || 'any',
        lineRange: [sourceFile.getLineAndCharacterOfPosition(m.pos).line + 1, sourceFile.getLineAndCharacterOfPosition(m.end).line + 1],
        isStatic: Boolean(m.modifiers?.some((mm) => mm.kind === ts.SyntaxKind.StaticKeyword)),
        isAsync: Boolean(m.modifiers?.some((mm) => mm.kind === ts.SyntaxKind.AsyncKeyword)),
        startOffset: m.pos,
        endOffset: m.end,
      }));
      const properties = node.members.filter(ts.isPropertyDeclaration).map((p) => ({
        name: p.name.getText(),
        type: p.type?.getText() || 'any',
        isFinal: Boolean(p.modifiers?.some((mm) => mm.kind === ts.SyntaxKind.ReadonlyKeyword)),
        isStatic: Boolean(p.modifiers?.some((mm) => mm.kind === ts.SyntaxKind.StaticKeyword)),
      }));
      ast.classes.push({
        name: node.name.text,
        code,
        methods,
        properties,
        superclass: node.heritageClauses?.find((c) => c.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression.getText(),
        interfaces: node.heritageClauses?.find((c) => c.token === ts.SyntaxKind.ImplementsKeyword)?.types.map((t) => t.expression.getText()) || [],
        mixins: [],
        lineRange: [sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1, sourceFile.getLineAndCharacterOfPosition(node.end).line + 1],
        isAbstract: Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AbstractKeyword)),
        startOffset: node.pos,
        endOffset: node.end,
      });
    }
  });

  return ast;
}
```

And in `code-chunker.ts`, implement `chunkTypeScriptCode(...)` similar to `chunkDartCode(...)` but setting `language: 'typescript'` in metadata.

Test updates (high-level):
- Replace “TS currently falls back to text” assertions with checks for function/class chunks and metadata presence.
- Add tests for TSX React components (functional component extraction via function/arrow function nodes).

Acceptance checks:
- TS files produce code-aware chunks (functions/classes) and preserve imports when enabled.

---

### 2) Ingestion pipeline docs point at wrong file

- Symptom: Docs reference `apps/server/src/pipeline/ingest.ts`.
- Root cause: Implementation uses `orchestrator.ts` for ingestion.
- Fix: Update docs to reference `apps/server/src/pipeline/orchestrator.ts`. Environment flags are already wired (`CODE_CHUNKING`, `PRESERVE_IMPORTS`, `TRACK_RELATIONSHIPS`).

---

### 3) Non-existent HTTP endpoints referenced

- `/api/ingest/directory`: Not implemented.
  - Fix (Option A – recommended): Document client-side loop to POST each file to existing `/api/ingest`.
  - Fix (Option B – optional future): Implement a new route to recursively ingest a directory path on the server.

- `/api/documents/{id}/chunks`: Not implemented.
  - Fix (Option A – recommended): Implement a `GET /api/documents/:id/chunks` route that returns all chunks for a document.
  - Fix (Option B): Adjust docs to query chunks via internal tooling/DB and omit the HTTP call.

Suggested route skeleton (Option A):

```ts
// apps/server/src/routes/documents.ts
import type { FastifyPluginAsync } from 'fastify';
import { getDocumentChunks } from '@synthesis/db';

export const documentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>('/api/documents/:id/chunks', async (request, reply) => {
    const chunks = await getDocumentChunks(request.params.id);
    return reply.send({ document_id: request.params.id, chunks });
  });
};
```

Update server bootstrap to register this route file.

---

### 4) Collection id vs name in docs

- Symptom: Docs use `/api/collections/test-ts/documents` treating `test-ts` like an id.
- Root cause: Server expects a UUID `:id`.
- Fix: Update examples to:
  1) Create a collection via `POST /api/collections` (name, description),
  2) Capture returned `collection.id`,
  3) Use that id in `/api/collections/:id/documents` and when posting to `/api/ingest`.

---

### 5) Relationship tracking is Dart-centric

- Symptom: `resolveImportPath` assumes Dart conventions; `isTestFile` checks only Dart patterns.
- Root cause: Initial implementation targeted Dart.
- Fix:
  - `resolveImportPath` enhancements:
    - If specifier starts with `.` → resolve relative path (already works).
    - If bare specifier (e.g., `react`, `@org/pkg`) → store literal specifier (do not force `lib/` prefix), or attempt Node resolution if repo context is provided.
  - `isTestFile` enhancements:
    - Include TS/JS test patterns: `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.spec.tsx`, paths under `__tests__/`.

Example logic to include in relationship service:

```ts
export function isTestFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.includes('_test.dart') ||
    lower.startsWith('test/') ||
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(lower) ||
    lower.includes('/__tests__/')
  );
}

export function resolveImportPath(importUri: string, currentFile: string): string {
  if (importUri.startsWith('.')) {
    const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'));
    return resolvePath(currentDir, importUri);
  }
  // Bare/aliased specifiers (TS/JS). Keep as-is for dependency graph unless a resolver is available.
  return importUri;
}
```

Note: When TS parser is integrated, `buildFileRelationships(...)` can continue to accept a `DartAST`-compatible shape; TS analyzer should return the same shape.

---

### 6) Minor documentation alignments

- Architecture doc mentions a “JavaScript parser” while implementation currently falls back for JS/JSX. Clarify: JS uses fallback chunking; code-aware parser is TBD.
- Use `chunkText(...)` terminology (matches `apps/server/src/pipeline/chunk.ts`) instead of `splitIntoChunks(...)` in docs.
- Remove redundant `pnpm add -w -D typescript` step; the repo already includes `typescript` at root and server package.

---

## Updated, working command examples

Create a collection and ingest a TS file (using real UUID):

```bash
# 1) Create collection
COLLECTION_JSON=$(curl -s -X POST http://localhost:3333/api/collections \
  -H 'Content-Type: application/json' \
  -d '{"name":"test-ts","description":"TS test"}')
COLLECTION_ID=$(echo "$COLLECTION_JSON" | jq -r '.collection.id')

# 2) Start server with code-aware chunking
CODE_CHUNKING=true PRESERVE_IMPORTS=true TRACK_RELATIONSHIPS=true \
  pnpm --filter @synthesis/server dev

# 3) Ingest a TypeScript file
curl -s -X POST http://localhost:3333/api/ingest \
  -F "file=@apps/server/src/pipeline/__tests__/fixtures/sample.ts" \
  -F "collection_id=$COLLECTION_ID"

# 4) List documents in the collection and get the first doc id
DOCS=$(curl -s http://localhost:3333/api/collections/$COLLECTION_ID/documents)
DOC_ID=$(echo "$DOCS" | jq -r '.documents[0].id')

# 5) (If implemented) Fetch chunks for the document
curl -s http://localhost:3333/api/documents/$DOC_ID/chunks | jq '.'

# 6) Related files (already implemented)
curl -s http://localhost:3333/api/documents/$DOC_ID/related-files | jq '.'
```

Batch ingest (replace /api/ingest/directory):

```bash
# Example: simple client-side loop over .ts files in a directory
for f in $(find your-project -type f -name "*.ts" -o -name "*.tsx"); do
  curl -s -X POST http://localhost:3333/api/ingest \
    -F "file=@$f" \
    -F "collection_id=$COLLECTION_ID" >/dev/null
  echo "Queued: $f"
done
```

---

## Test plan updates

- Unit tests:
  - `ts-analyzer.test.ts`: imports (named/default/namespace), function/arrow/async, classes (methods, props, decorators if used), interfaces/types, TSX component function extraction.
  - Relationship service tests: `isTestFile` for TS/JS patterns; `resolveImportPath` behavior for bare/relative specifiers.
- Integration tests:
  - Replace TS fallback assertions with code-aware chunk assertions.
  - Verify `preserveImports` on TS.
  - Verify related-files endpoint returns expected structure for TS files.

---

## Acceptance criteria mapping

- TS functions and classes chunk as complete units (≥90% typical projects): covered via analyzer + chunker tests.
- Imports preserved with code chunks when enabled: covered in TS chunker tests.
- File relationships tracked and queryable: endpoint exists; improved mapping for TS/JS.
- Performance: TS parsing <300ms typical files (validate on fixtures and a sample repo).
- Fallback on parse errors: chunker `try/catch` already falls back; verify with malformed TS.

---

## Risks and mitigations

- TS AST coverage gaps (decorators/generics/overloads): add tests for representative patterns; ensure analyzer extracts code/metadata without throwing.
- Module resolution for bare specifiers: capture raw specifier in graph; optionally add Node resolution later if needed.
- Back-compat for existing tests: update any tests asserting TS fallback.

---

## Checklist (implementation order)

1) Create `ts-analyzer.ts` and plug into `code-chunker.ts`.
2) Add TS/TSX fixtures and analyzer tests; update integration tests.
3) Update relationship service helpers (`resolveImportPath`, `isTestFile`).
4) Update docs: reference `orchestrator.ts`, correct endpoints and UUID usage.
5) (Optional) Implement `GET /api/documents/:id/chunks` route; otherwise remove that call from docs.
6) Validate performance targets on real files.
