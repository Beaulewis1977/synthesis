#!/usr/bin/env node

import { writeFileSync } from 'node:fs';

/**
 * Real Hybrid Search + Reranking Evaluation
 * Tests against your actual Flutter corpus using the full hybrid search pipeline
 */

const SEARCH_URL = process.env.SEARCH_URL || 'http://localhost:3000/api/search';
const COLLECTION_ID = '00000000-0000-0000-0000-000000000002'; // Flutter collection
const SEARCH_TIMEOUT_MS = (() => {
  const parsed = Number.parseInt(process.env.SEARCH_TIMEOUT_MS ?? '10000', 10);
  return Number.isFinite(parsed) ? parsed : 10000;
})();

// Test queries that should benefit from reranking
const TEST_QUERIES = [
  {
    query: 'StatefulWidget lifecycle',
    expectedRelevant: [
      // You'll need to identify these from your actual corpus
      // Look for documents that contain lifecycle information but might not rank highly with lexical search
    ],
  },
  {
    query: 'Flutter authentication',
    expectedRelevant: [],
  },
  {
    query: 'StreamBuilder usage',
    expectedRelevant: [],
  },
  {
    query: 'Navigator 2.0 routing',
    expectedRelevant: [],
  },
  {
    query: 'Widget testing best practices',
    expectedRelevant: [],
  },
];

function validateSearchResponse(payload, { query, rerank }) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(
      `Invalid search response for "${query}" (rerank=${rerank}): expected an object but received ${typeof payload}`
    );
  }

  const missingFields = [];

  if (!Array.isArray(payload.results)) {
    missingFields.push('results (array)');
  } else if (!payload.results.every((result) => result && typeof result === 'object')) {
    missingFields.push('results[*] (object)');
  }

  if (typeof payload.search_time_ms !== 'number' || !Number.isFinite(payload.search_time_ms)) {
    missingFields.push('search_time_ms (number)');
  }

  if (missingFields.length > 0) {
    const keys = Object.keys(payload);
    throw new Error(
      `Invalid search response for "${query}" (rerank=${rerank}): missing ${missingFields.join(
        ', '
      )}; received keys: ${keys.join(', ') || 'none'}`
    );
  }
}

async function runHybridSearch(query, rerank = false, timeoutMs = SEARCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();

  try {
    const response = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        collection_id: COLLECTION_ID,
        top_k: 50,
        search_mode: 'hybrid',
        rerank: rerank,
        rerank_top_k: 15,
        rerank_provider: 'bge',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    validateSearchResponse(payload, { query, rerank });
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Search request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function calculatePrecisionAt5(results, expectedRelevant) {
  if (expectedRelevant.length === 0) return 0; // Can't calculate without relevance judgments

  const k = Math.min(5, results.length);
  if (k === 0) return 0;

  const topIds = results.slice(0, k).map((r) => r.doc_id);
  const relevantFound = topIds.filter((id) => expectedRelevant.includes(id)).length;
  return relevantFound / k;
}

async function runRealEvaluation() {
  console.info('🔬 Real Hybrid Search + Reranking Evaluation');
  console.info('============================================\n');

  const results = [];

  for (const { query, expectedRelevant = [] } of TEST_QUERIES) {
    console.info(`Testing: "${query}"`);

    const relevantDocs = Array.isArray(expectedRelevant) ? expectedRelevant : [];

    try {
      // Baseline hybrid search (no reranking)
      console.info('  Running hybrid baseline...');
      const baselineStart = Date.now();
      const baselineResponse = await runHybridSearch(query, false);
      const baselineTime = Date.now() - baselineStart;

      // Reranked hybrid search
      console.info('  Running hybrid + rerank...');
      const rerankStart = Date.now();
      const rerankResponse = await runHybridSearch(query, true);
      const rerankTime = Date.now() - rerankStart;

      console.info(`  ✅ Baseline: ${baselineResponse.results.length} results, ${baselineTime}ms`);
      console.info(`  ✅ Reranked: ${rerankResponse.results.length} results, ${rerankTime}ms`);
      console.info(`  📈 Latency overhead: ${rerankTime - baselineTime}ms`);

      // Show top results for manual relevance judgment
      console.info('\n  🔍 TOP 5 BASELINE RESULTS:');
      baselineResponse.results.slice(0, 5).forEach((result, i) => {
        console.info(
          `    ${i + 1}. ${result.doc_title || 'Unknown'} (score: ${result.similarity?.toFixed(3) || 'N/A'})`
        );
        console.info(`       "${result.text?.substring(0, 100)}..."`);
      });

      console.info('\n  🔍 TOP 5 RERANKED RESULTS:');
      rerankResponse.results.slice(0, 5).forEach((result, i) => {
        console.info(
          `    ${i + 1}. ${result.doc_title || 'Unknown'} (score: ${result.similarity?.toFixed(3) || 'N/A'})`
        );
        console.info(`       "${result.text?.substring(0, 100)}..."`);
      });

      const baselinePrecisionAt5 = calculatePrecisionAt5(baselineResponse.results, relevantDocs);
      const rerankedPrecisionAt5 = calculatePrecisionAt5(rerankResponse.results, relevantDocs);

      results.push({
        query,
        baseline: {
          latency_ms: baselineTime,
          search_time_ms: baselineResponse.search_time_ms,
          results_count: baselineResponse.results.length,
          top_results: baselineResponse.results.slice(0, 5).map((r) => ({
            doc_id: r.doc_id,
            title: r.doc_title,
            score: r.similarity,
          })),
          precision_at_5: baselinePrecisionAt5,
        },
        reranked: {
          latency_ms: rerankTime,
          search_time_ms: rerankResponse.search_time_ms,
          results_count: rerankResponse.results.length,
          top_results: rerankResponse.results.slice(0, 5).map((r) => ({
            doc_id: r.doc_id,
            title: r.doc_title,
            score: r.similarity,
          })),
          precision_at_5: rerankedPrecisionAt5,
        },
        latency_overhead_ms: rerankTime - baselineTime,
      });

      console.info(`\n${'='.repeat(60)}\n`);
    } catch (error) {
      console.error(`❌ Error testing "${query}":`, error.message);
      results.push({ query, error: error.message });
    }
  }

  // Generate evaluation report
  generateReport(results);
}

function generateReport(results) {
  console.info('📊 EVALUATION SUMMARY');
  console.info('====================');

  const successfulTests = results.filter((r) => !r.error);
  const totalLatencyOverhead = successfulTests.reduce((sum, r) => sum + r.latency_overhead_ms, 0);
  const avgLatencyOverhead =
    successfulTests.length > 0 ? totalLatencyOverhead / successfulTests.length : null;

  if (avgLatencyOverhead !== null) {
    console.info(`\n⏱️  Average Latency Overhead: ${avgLatencyOverhead.toFixed(0)}ms`);
  } else {
    console.info('\n⏱️  Average Latency Overhead: N/A (no successful tests)');
  }
  console.info('🎯 Target: <300ms overhead');

  console.info('\n📐 Precision@5 Summary:');
  if (successfulTests.length === 0) {
    console.info('- No successful tests to calculate precision');
  } else {
    for (const result of successfulTests) {
      const baselinePrecision = result.baseline?.precision_at_5;
      const rerankedPrecision = result.reranked?.precision_at_5;
      const formatPrecision = (value) =>
        typeof value === 'number' && Number.isFinite(value)
          ? `${(value * 100).toFixed(1)}%`
          : 'N/A';

      console.info(
        `- ${result.query}: baseline ${formatPrecision(baselinePrecision)}, reranked ${formatPrecision(
          rerankedPrecision
        )}`
      );
    }
  }

  console.info('\n📋 NEXT STEPS FOR PRECISION MEASUREMENT:');
  console.info('1. Review the top results above for each query');
  console.info('2. Identify which documents are actually relevant for each query');
  console.info('3. Update TEST_QUERIES with the expectedRelevant arrays');
  console.info('4. Run this script again to calculate precision@5 improvements');

  console.info('\n💡 To get relevance judgments:');
  console.info('- Look through your Flutter corpus for docs that truly answer each query');
  console.info('- Add the doc_ids to the expectedRelevant arrays above');
  console.info('- Rerun to see if reranking improves precision@5');

  // Save raw results for later analysis
  writeFileSync(
    'real-hybrid-results.json',
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        results,
      },
      null,
      2
    )
  );

  console.info('\n💾 Raw results saved to: real-hybrid-results.json');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRealEvaluation().catch(console.error);
}
