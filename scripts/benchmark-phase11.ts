#!/usr/bin/env tsx
/**
 * Phase 11: Text Chunking Heuristics Benchmark
 *
 * This script benchmarks the improved sentence boundary detection against
 * the legacy implementation to ensure:
 * 1. Correctness: Edge cases are handled properly
 * 2. Performance: Within 10% of legacy implementation
 *
 * Run with: pnpm --filter @synthesis/server exec tsx ../../scripts/benchmark-phase11.ts
 */

import { chunkText } from '../apps/server/src/pipeline/chunk.js';
import {
  splitIntoSentences,
  validateSentenceSplitter,
} from '../apps/server/src/pipeline/sentence-splitter.js';

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  opsPerSec: number;
}

interface CorrectnessResult {
  testCase: string;
  passed: boolean;
  expected: string;
  actual: string;
}

// Test cases for correctness validation
const CORRECTNESS_TEST_CASES = [
  {
    name: 'Abbreviation: Dr.',
    input: 'Dr. Smith went home. He was tired.',
    expectedSentences: 2,
    mustContain: ['Dr. Smith went home.'],
    mustNotSplit: ['Dr.'],
  },
  {
    name: 'Abbreviation: Mr. and Mrs.',
    input: 'Mr. and Mrs. Jones arrived. They were happy.',
    expectedSentences: 2,
    mustContain: ['Mr. and Mrs. Jones arrived.'],
    mustNotSplit: ['Mr.', 'Mrs.'],
  },
  {
    name: 'Version number',
    input: 'Use Flutter 3.24.5 for this project. It works well.',
    expectedSentences: 2,
    mustContain: ['Use Flutter 3.24.5 for this project.'],
    mustNotSplit: ['3.24.5'],
  },
  {
    name: 'Decimal number',
    input: 'The value is 3.14 radians. That is pi.',
    expectedSentences: 2,
    mustContain: ['The value is 3.14 radians.'],
    mustNotSplit: ['3.14'],
  },
  {
    name: 'URL',
    input: 'Visit https://example.com. Then click login.',
    expectedSentences: 2,
    mustContain: ['Visit https://example.com.'],
    mustNotSplit: ['example.com'],
  },
  {
    name: 'Inline code',
    input: 'Call `foo.bar()` method. It returns null.',
    expectedSentences: 2,
    mustContain: ['Call `foo.bar()` method.'],
    mustNotSplit: ['`foo.bar()`'],
  },
  {
    name: 'Initials',
    input: 'J.K. Rowling wrote Harry Potter. It was popular.',
    expectedSentences: 2,
    mustContain: ['J.K. Rowling wrote Harry Potter.'],
    mustNotSplit: ['J.K.'],
  },
  {
    name: 'Ellipsis',
    input: 'Wait... then continue. The story goes on.',
    expectedSentences: 2,
    mustContain: ['Wait... then continue.'],
    mustNotSplit: ['...'],
  },
  {
    name: 'Latin abbreviation e.g.',
    input: 'See e.g. the documentation. It explains everything.',
    expectedSentences: 2,
    mustContain: ['See e.g. the documentation.'],
    mustNotSplit: ['e.g.'],
  },
  {
    name: 'Latin abbreviation i.e.',
    input: 'The result i.e. the output was correct. It worked.',
    expectedSentences: 2,
    mustContain: ['The result i.e. the output was correct.'],
    mustNotSplit: ['i.e.'],
  },
  {
    name: 'Month abbreviation',
    input: 'On Jan. 20, the event occurred. It was memorable.',
    expectedSentences: 2,
    mustContain: ['On Jan. 20, the event occurred.'],
    mustNotSplit: ['Jan.'],
  },
  {
    name: 'Company abbreviation',
    input: 'Apple Inc. announced new products. They were innovative.',
    expectedSentences: 2,
    mustContain: ['Apple Inc. announced new products.'],
    mustNotSplit: ['Inc.'],
  },
  {
    name: 'File path',
    input: 'Edit src/main.ts file. It contains the entry point.',
    expectedSentences: 2,
    mustContain: ['Edit src/main.ts file.'],
    mustNotSplit: ['src/main.ts'],
  },
  {
    name: 'Complex version',
    input: 'Use version 14.3.0-canary.87 for testing. It has fixes.',
    expectedSentences: 2,
    mustContain: ['Use version 14.3.0-canary.87 for testing.'],
    mustNotSplit: ['14.3.0-canary.87'],
  },
];

// Sample texts for performance benchmarking
const BENCHMARK_TEXTS = {
  short: 'Dr. Smith went to the store. He bought apples. Then he went home.',
  medium: `
    Flutter 3.24.5 introduces many new features. The framework is now faster than ever.
    Dr. Johnson from Google announced the release. He mentioned that performance improved by 20%.
    Visit https://flutter.dev for more information. The documentation is comprehensive.
    See e.g. the migration guide for upgrade instructions. It covers all breaking changes.
    The API is stable and production-ready. Many companies use it in production.
  `.trim(),
  long: `
    Introduction to Modern Software Development

    Dr. Smith, a renowned computer scientist at MIT, has published extensive research on software architecture.
    His work, published in Vol. 42 of the ACM Journal, covers topics from microservices to monoliths.

    Version Control with Git

    Use Git version 2.40.1 or later for best results. The new features include improved merge algorithms.
    See https://git-scm.com/docs for comprehensive documentation. The site is regularly updated.

    Code Examples

    Here is a simple example using TypeScript:

    \`\`\`typescript
    const config = {
      version: "1.0.0",
      api: {
        endpoint: "https://api.example.com",
        timeout: 30.5
      }
    };

    async function fetchData() {
      const response = await fetch(config.api.endpoint);
      return response.json();
    }
    \`\`\`

    The \`fetchData()\` function demonstrates async/await patterns. It is commonly used in modern JavaScript.

    Best Practices

    Mr. and Mrs. Johnson, senior engineers at Google Inc., recommend the following practices:

    1. Use semantic versioning (e.g. 1.2.3) for all packages
    2. Document APIs thoroughly (i.e. include examples)
    3. Test edge cases (etc. null values, empty strings)

    J.K. Rowling once said... "It is our choices that show what we truly are."
    This applies to software development as well. Choose your tools wisely.

    For more information, visit:
    - https://docs.flutter.dev/get-started/install
    - https://reactjs.org/docs/getting-started.html
    - https://angular.io/guide/setup-local

    The temperature today is -2.5 degrees Celsius. Stay warm while coding!
  `.trim(),
};

function runCorrectnessTests(): CorrectnessResult[] {
  const results: CorrectnessResult[] = [];

  for (const testCase of CORRECTNESS_TEST_CASES) {
    const sentences = splitIntoSentences(testCase.input);

    // Check sentence count
    if (sentences.length !== testCase.expectedSentences) {
      results.push({
        testCase: testCase.name,
        passed: false,
        expected: `${testCase.expectedSentences} sentences`,
        actual: `${sentences.length} sentences: ${JSON.stringify(sentences)}`,
      });
      continue;
    }

    // Check must contain
    let passed = true;
    let failReason = '';

    for (const expected of testCase.mustContain) {
      if (!sentences.some((s) => s.includes(expected.replace(/\.$/, '')))) {
        passed = false;
        failReason = `Missing: "${expected}"`;
        break;
      }
    }

    // Check must not split
    if (passed) {
      for (const pattern of testCase.mustNotSplit) {
        const allText = sentences.join(' ');
        if (!allText.includes(pattern)) {
          passed = false;
          failReason = `Split incorrectly at: "${pattern}"`;
          break;
        }
      }
    }

    results.push({
      testCase: testCase.name,
      passed,
      expected: passed ? 'PASS' : testCase.mustContain.join(', '),
      actual: passed ? 'PASS' : failReason,
    });
  }

  return results;
}

function benchmark(name: string, fn: () => void, iterations = 1000): BenchmarkResult {
  // Warm up
  for (let i = 0; i < 10; i++) {
    fn();
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();

  const totalMs = end - start;
  const avgMs = totalMs / iterations;
  const opsPerSec = 1000 / avgMs;

  return {
    name,
    iterations,
    totalMs,
    avgMs,
    opsPerSec,
  };
}

function runPerformanceBenchmarks(): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];

  // Benchmark splitIntoSentences
  for (const [size, text] of Object.entries(BENCHMARK_TEXTS)) {
    results.push(
      benchmark(`splitIntoSentences (${size})`, () => {
        splitIntoSentences(text);
      })
    );
  }

  // Benchmark chunkText with improved mode
  for (const [size, text] of Object.entries(BENCHMARK_TEXTS)) {
    results.push(
      benchmark(`chunkText improved (${size})`, () => {
        chunkText(text, { maxSize: 200, overlap: 30, sentenceSplitMode: 'regex' });
      })
    );
  }

  // Benchmark chunkText with legacy mode
  for (const [size, text] of Object.entries(BENCHMARK_TEXTS)) {
    results.push(
      benchmark(`chunkText legacy (${size})`, () => {
        chunkText(text, { maxSize: 200, overlap: 30, sentenceSplitMode: 'legacy' });
      })
    );
  }

  return results;
}

function formatTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || '').length))
  );

  const separator = colWidths.map((w) => '-'.repeat(w + 2)).join('+');
  const formatRow = (row: string[]) =>
    row.map((cell, i) => ` ${cell.padEnd(colWidths[i])} `).join('|');

  return [separator, formatRow(headers), separator, ...rows.map(formatRow), separator].join('\n');
}

async function main() {
  console.info('='.repeat(80));
  console.info('Phase 11: Text Chunking Heuristics Benchmark');
  console.info('='.repeat(80));
  console.info();

  // Run built-in validation
  console.info('## Built-in Validation');
  console.info();
  const validation = validateSentenceSplitter();
  if (validation.passed) {
    console.info('✅ All built-in validation tests passed');
  } else {
    console.info('❌ Built-in validation failed:');
    for (const failure of validation.failures) {
      console.info(`   - ${failure}`);
    }
  }
  console.info();

  // Run correctness tests
  console.info('## Correctness Tests');
  console.info();
  const correctnessResults = runCorrectnessTests();
  const passed = correctnessResults.filter((r) => r.passed).length;
  const failed = correctnessResults.filter((r) => !r.passed).length;

  console.info(`Results: ${passed} passed, ${failed} failed`);
  console.info();

  if (failed > 0) {
    console.info('Failed tests:');
    for (const result of correctnessResults.filter((r) => !r.passed)) {
      console.info(`  ❌ ${result.testCase}`);
      console.info(`     Expected: ${result.expected}`);
      console.info(`     Actual: ${result.actual}`);
    }
    console.info();
  }

  const correctnessTable = formatTable(
    ['Test Case', 'Status'],
    correctnessResults.map((r) => [r.testCase, r.passed ? '✅ PASS' : '❌ FAIL'])
  );
  console.info(correctnessTable);
  console.info();

  // Run performance benchmarks
  console.info('## Performance Benchmarks');
  console.info();
  const perfResults = runPerformanceBenchmarks();

  const perfTable = formatTable(
    ['Benchmark', 'Iterations', 'Total (ms)', 'Avg (ms)', 'Ops/sec'],
    perfResults.map((r) => [
      r.name,
      r.iterations.toString(),
      r.totalMs.toFixed(2),
      r.avgMs.toFixed(4),
      r.opsPerSec.toFixed(0),
    ])
  );
  console.info(perfTable);
  console.info();

  // Compare improved vs legacy performance
  console.info('## Performance Comparison (Improved vs Legacy)');
  console.info();

  for (const size of ['short', 'medium', 'long']) {
    const improved = perfResults.find((r) => r.name === `chunkText improved (${size})`);
    const legacy = perfResults.find((r) => r.name === `chunkText legacy (${size})`);

    if (improved && legacy) {
      const ratio = improved.avgMs / legacy.avgMs;
      const percentDiff = ((ratio - 1) * 100).toFixed(1);
      const status = ratio <= 1.1 ? '✅' : '⚠️';

      console.info(
        `${status} ${size}: Improved is ${percentDiff}% ${ratio > 1 ? 'slower' : 'faster'} than legacy`
      );
      console.info(
        `   Improved: ${improved.avgMs.toFixed(4)}ms, Legacy: ${legacy.avgMs.toFixed(4)}ms`
      );
    }
  }
  console.info();

  // Summary
  console.info('## Summary');
  console.info();

  const allCorrect = failed === 0 && validation.passed;
  const perfWithin10 = perfResults.every((r) => {
    if (!r.name.includes('improved')) return true;
    const legacyName = r.name.replace('improved', 'legacy');
    const legacy = perfResults.find((l) => l.name === legacyName);
    return !legacy || r.avgMs / legacy.avgMs <= 1.1;
  });

  console.info(`Correctness: ${allCorrect ? '✅ PASS' : '❌ FAIL'}`);
  console.info(`Performance (within 10% of legacy): ${perfWithin10 ? '✅ PASS' : '⚠️ REVIEW'}`);
  console.info();

  if (allCorrect && perfWithin10) {
    console.info('🎉 Phase 11 benchmarks passed!');
    process.exit(0);
  } else {
    console.info('⚠️ Some benchmarks need attention.');
    process.exit(1);
  }
}

main().catch(console.error);
