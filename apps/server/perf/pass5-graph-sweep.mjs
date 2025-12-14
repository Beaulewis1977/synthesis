#!/usr/bin/env node
/**
 * Pass 5: Graph Expansion Sweep
 *
 * Tests different graph configurations on recipe-slot-webapp collection.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATASET_PATH = join(__dirname, 'eval_datasets/recipe-slot-webapp-eval.json');

const API_BASE = 'http://localhost:3333';

// Graph configurations to test
const GRAPH_CONFIGS = [
  { name: 'no-graph', enabled: false, maxDepth: 0, maxNodes: 0 },
  { name: 'd2-n25', enabled: true, maxDepth: 2, maxNodes: 25 },
  { name: 'd3-n50', enabled: true, maxDepth: 3, maxNodes: 50 },
  { name: 'd3-n100', enabled: true, maxDepth: 3, maxNodes: 100 },
  { name: 'd4-n100', enabled: true, maxDepth: 4, maxNodes: 100 },
];

// Load dataset from file
async function loadDataset() {
  const content = await readFile(DATASET_PATH, 'utf-8');
  const dataset = JSON.parse(content);
  return {
    collectionId: dataset.collection_id,
    queries: dataset.queries.map((q) => ({
      id: q.id,
      query: q.query,
      expectedDocIds: q.expected_doc_ids,
    })),
  };
}

async function runSearch(query, collectionId, graphConfig) {
  const body = {
    query: query.query,
    collectionId: collectionId,
    topK: 10,
    searchMode: 'hybrid', // Use hybrid (default) for better results
  };

  // Only add graph params when enabled
  if (graphConfig.enabled) {
    body.expandWithGraph = true;
    body.graphMaxDepth = graphConfig.maxDepth;
    body.graphMaxNodes = graphConfig.maxNodes;
  }

  const start = Date.now();
  const response = await fetch(`${API_BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  const latency = Date.now() - start;

  return { results: data.results || [], latency };
}

function calculateMRR(results, expectedDocIds) {
  // Find first relevant result
  for (let i = 0; i < results.length; i++) {
    if (expectedDocIds.includes(results[i].doc_id)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

function calculateRecall(results, expectedDocIds, k) {
  const topK = results.slice(0, k);
  // Use Set to count unique relevant docs found
  const uniqueFound = new Set(
    topK.filter((r) => expectedDocIds.includes(r.doc_id)).map((r) => r.doc_id)
  );
  return Math.min(1, uniqueFound.size / expectedDocIds.length);
}

async function runSweep() {
  // Load dataset
  const { collectionId, queries } = await loadDataset();

  console.log('='.repeat(60));
  console.log('Pass 5: Graph Expansion Sweep');
  console.log('Collection:', collectionId);
  console.log('Queries:', queries.length);
  console.log('='.repeat(60));
  console.log();

  // Track failing queries for no-graph baseline
  const failingQueries = [];

  const results = [];

  for (const config of GRAPH_CONFIGS) {
    console.log(`Testing config: ${config.name}`);
    console.log(
      `  Graph enabled: ${config.enabled}, Depth: ${config.maxDepth}, Nodes: ${config.maxNodes}`
    );

    let totalMRR = 0;
    let totalRecall5 = 0;
    let totalRecall10 = 0;
    let totalLatency = 0;
    let hits = 0;

    for (const query of queries) {
      try {
        const { results: searchResults, latency } = await runSearch(query, collectionId, config);

        const mrr = calculateMRR(searchResults, query.expectedDocIds);
        const recall5 = calculateRecall(searchResults, query.expectedDocIds, 5);
        const recall10 = calculateRecall(searchResults, query.expectedDocIds, 10);

        totalMRR += mrr;
        totalRecall5 += recall5;
        totalRecall10 += recall10;
        totalLatency += latency;
        if (mrr > 0) hits++;

        // Track failing queries for baseline
        if (config.name === 'no-graph' && mrr === 0) {
          failingQueries.push({ id: query.id, query: query.query, expected: query.expectedDocIds });
        }
      } catch (error) {
        console.error(`  Error on ${query.id}: ${error.message}`);
      }
    }

    const n = queries.length;
    const avgMRR = totalMRR / n;
    const avgRecall5 = totalRecall5 / n;
    const avgRecall10 = totalRecall10 / n;
    const avgLatency = totalLatency / n;

    results.push({
      config: config.name,
      mrr: avgMRR,
      recall5: avgRecall5,
      recall10: avgRecall10,
      hitRate: hits / n,
      avgLatency,
    });

    console.log(
      `  Results: MRR=${avgMRR.toFixed(3)}, Recall@5=${(avgRecall5 * 100).toFixed(1)}%, Recall@10=${(avgRecall10 * 100).toFixed(1)}%, Hit=${hits}/${n}, Latency=${avgLatency.toFixed(0)}ms`
    );
    console.log();
  }

  // Summary table
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log('Config       | MRR   | R@5   | R@10  | Hit%  | Latency');
  console.log('-'.repeat(60));
  for (const r of results) {
    const name = r.config.padEnd(12);
    const mrr = r.mrr.toFixed(3).padStart(5);
    const r5 = (r.recall5 * 100).toFixed(0).padStart(4) + '%';
    const r10 = (r.recall10 * 100).toFixed(0).padStart(4) + '%';
    const hit = (r.hitRate * 100).toFixed(0).padStart(4) + '%';
    const lat = r.avgLatency.toFixed(0).padStart(5) + 'ms';
    console.log(`${name} | ${mrr} | ${r5} | ${r10} | ${hit} | ${lat}`);
  }
  console.log('='.repeat(60));

  // Find best config
  const best = results.reduce((a, b) => (a.mrr > b.mrr ? a : b));
  console.log(`\nBest config: ${best.config} (MRR=${best.mrr.toFixed(3)})`);

  // Show failing queries
  if (failingQueries.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log(`FAILING QUERIES (${failingQueries.length} queries with MRR=0)`);
    console.log('='.repeat(60));
    for (const q of failingQueries.slice(0, 10)) {
      console.log(`  ${q.id}: "${q.query.slice(0, 50)}..."`);
      console.log(`     Expected: ${q.expected.join(', ')}`);
    }
    if (failingQueries.length > 10) {
      console.log(`  ... and ${failingQueries.length - 10} more`);
    }
  }
}

runSweep().catch(console.error);
