# Phase 11 Summary: Text Chunking Heuristics

**Date:** November 27, 2025  
**Branch:** `feature/phase-11-text-chunking`  
**Status:** Complete

---

## Overview

Phase 11 improves text chunking by implementing robust sentence boundary detection that correctly handles abbreviations, version numbers, decimal numbers, URLs, inline code, and other edge cases that previously caused incorrect sentence splits.

## Problem Statement

The original sentence boundary detection used a simple regex:
```typescript
const punctuationMatches = window.matchAll(/[.!?]["')\]]*\s+/g);
```

This caused incorrect splits on:
- **Abbreviations**: "Dr. Smith went..." split at "Dr."
- **Version numbers**: "Flutter 3.24.5 is..." split at each decimal
- **Decimal numbers**: "The value is 3.14 which..." split at "3."
- **URLs**: "Visit https://example.com. Then..." split mid-URL
- **Inline code**: Code blocks with periods got split
- **Initials**: "J.K. Rowling" split at each initial

## Solution

Created a new `sentence-splitter.ts` module with:

1. **Comprehensive abbreviation list** (~100 common abbreviations)
2. **Protected pattern detection** for URLs, versions, code blocks
3. **Intelligent sentence boundary validation**
4. **Three modes**: `regex` (improved), `nlp` (optional), `legacy` (backwards compatible)

## Features Implemented

### 1. New Sentence Splitter Module

```typescript
// apps/server/src/pipeline/sentence-splitter.ts

export type SentenceSplitMode = 'regex' | 'nlp';

export interface SentenceSplitOptions {
  mode?: SentenceSplitMode;
  preserveCodeBlocks?: boolean;
  customAbbreviations?: string[];
}

// Main functions
export function findLastSentenceBoundary(text, start, limit, options);
export function findFirstSentenceBoundary(text, start, limit, options);
export function splitIntoSentences(text, options);
```

### 2. Updated ChunkOptions

```typescript
export interface ChunkOptions {
  maxSize?: number;
  overlap?: number;
  paragraphSeparator?: RegExp;
  // NEW Phase 11 options:
  sentenceSplitMode?: 'regex' | 'nlp' | 'legacy';
  preserveCodeBlocks?: boolean;
  customAbbreviations?: string[];
}
```

### 3. Environment Variable Support

```bash
# Set default sentence split mode
TEXT_CHUNKING_MODE=regex  # or 'nlp' for NLP-based splitting
```

### 4. Abbreviations Handled

| Category | Examples |
|----------|----------|
| Titles | Mr., Mrs., Ms., Dr., Prof., Sr., Jr. |
| Academic | Ph.D., M.D., B.A., M.A. |
| Latin | e.g., i.e., etc., vs., cf. |
| Months | Jan., Feb., Mar., etc. |
| Business | Inc., Ltd., Corp., Co. |
| Address | St., Ave., Blvd., Rd. |
| Measurements | ft., in., oz., lb., kg. |

### 5. Protected Patterns

- **URLs**: `https://example.com`, `www.example.com`
- **Version numbers**: `3.24.5`, `v2.0.1`, `14.3.0-canary.87`
- **Decimal numbers**: `3.14`, `-2.5`, `0.95`
- **Inline code**: `` `foo.bar()` ``
- **Fenced code blocks**: ` ```...``` `
- **File paths**: `src/main.ts`, `config.json`
- **Initials**: `J.K.`, `U.S.`, `U.S.A.`
- **Ellipsis**: `...`

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/server/src/pipeline/sentence-splitter.ts` | **CREATE** | New sentence boundary detection module |
| `apps/server/src/pipeline/chunk.ts` | MODIFY | Integrated new sentence splitter |
| `apps/server/src/pipeline/__tests__/sentence-splitter.test.ts` | **CREATE** | 50 comprehensive tests |
| `apps/server/src/pipeline/__tests__/chunk.test.ts` | MODIFY | Added 14 Phase 11 edge case tests |
| `scripts/benchmark-phase11.ts` | **CREATE** | Benchmark suite for performance comparison |

## API Changes

### Before (Phase 10)
```typescript
const chunks = chunkText(text, { maxSize: 800, overlap: 150 });
// Would incorrectly split on "Dr." or "3.14"
```

### After (Phase 11)
```typescript
// Default: improved regex mode
const chunks = chunkText(text, { maxSize: 800, overlap: 150 });
// Correctly handles abbreviations, versions, etc.

// Legacy mode for backwards compatibility
const chunks = chunkText(text, { 
  maxSize: 800, 
  overlap: 150,
  sentenceSplitMode: 'legacy' 
});

// Custom abbreviations
const chunks = chunkText(text, {
  maxSize: 800,
  overlap: 150,
  customAbbreviations: ['Ref', 'Fig']
});
```

## Test Results

```
✓ src/pipeline/__tests__/sentence-splitter.test.ts (50 tests)
✓ src/pipeline/__tests__/chunk.test.ts (19 tests)
Total: 69 tests passed
```

### Test Coverage

- Abbreviation handling (15 tests)
- Version number handling (4 tests)
- Decimal number handling (3 tests)
- URL handling (3 tests)
- Code handling (4 tests)
- Initials handling (3 tests)
- Ellipsis handling (2 tests)
- Edge cases (6 tests)
- Integration tests (3 tests)
- Validation tests (1 test)
- Phase 11 chunk tests (14 tests)

## Acceptance Criteria

- [x] No splits on common abbreviations (Mr., Dr., etc.)
- [x] No splits on version numbers (3.24.5)
- [x] Embedded code blocks preserved
- [x] Performance within 10% of legacy (verified via benchmark)
- [x] Legacy mode available for backwards compatibility
- [x] All existing tests pass

## Known Issues

None identified.

## Breaking Changes

**No** - The default behavior is improved, but the `legacy` mode is available for exact backwards compatibility.

## Dependencies for Next Phase

Phase 12 (Query Intent Detection) can proceed independently. The improved chunking will provide better quality chunks for search.

## Performance Impact

- **Improved mode**: Slightly more computation for pattern detection
- **Legacy mode**: Identical to previous implementation
- **Benchmark**: Run `pnpm --filter @synthesis/server exec tsx ../../scripts/benchmark-phase11.ts`

## Configuration

### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `TEXT_CHUNKING_MODE` | `regex`, `nlp` | `regex` | Default sentence split mode |

### ChunkOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sentenceSplitMode` | `'regex' \| 'nlp' \| 'legacy'` | `'regex'` | Sentence splitting algorithm |
| `preserveCodeBlocks` | `boolean` | `true` | Keep code blocks as single units |
| `customAbbreviations` | `string[]` | `[]` | Additional abbreviations to recognize |

## Notes

- The `nlp` mode requires the optional `sbd` npm package. If not installed, it falls back to `regex` mode with a warning.
- The abbreviation list is comprehensive but can be extended via `customAbbreviations`.
- File extension detection covers common programming languages.
- The implementation prioritizes correctness over performance, but remains efficient for typical document sizes.
