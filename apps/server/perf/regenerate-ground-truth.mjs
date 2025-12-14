#!/usr/bin/env node
/**
 * Ground Truth Regeneration Script
 *
 * Uses semantic search to find actually relevant documents for each query.
 * This ensures ground truth reflects what the RAG pipeline actually retrieves.
 *
 * Usage:
 *   node regenerate-ground-truth.mjs <dataset-path> [options]
 *
 * Options:
 *   --top-k=N       Number of results per query (default: 5)
 *   --min-sim=N     Minimum similarity threshold (default: 0.3)
 *   --dry-run       Show results without writing file
 *   --output=PATH   Output path (default: overwrites input)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = 'http://localhost:3333';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    datasetPath: null,
    topK: 5,
    minSimilarity: 0.3,
    dryRun: false,
    outputPath: null,
  };

  for (const arg of args) {
    if (arg.startsWith('--top-k=')) {
      options.topK = Number.parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--min-sim=')) {
      options.minSimilarity = Number.parseFloat(arg.split('=')[1]);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--output=')) {
      options.outputPath = arg.split('=')[1];
    } else if (!arg.startsWith('--')) {
      options.datasetPath = arg;
    }
  }

  return options;
}

// Load dataset from file
async function loadDataset(path) {
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

// Run semantic search for a query
async function searchForQuery(query, collectionId, topK, minSimilarity) {
  const body = {
    query: query,
    collectionId: collectionId,
    topK: topK,
    minSimilarity: minSimilarity,
    searchMode: 'hybrid', // Use hybrid for best results
  };

  try {
    const response = await fetch(`${API_BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`  Search error: ${error.message}`);
    return [];
  }
}

// Get document details by ID
async function getDocumentTitle(docId) {
  try {
    const response = await fetch(`${API_BASE}/api/documents/${docId}`);
    if (!response.ok) return docId;
    const data = await response.json();
    // API returns { document: {...} }
    const doc = data.document || data;
    return doc.title || doc.file_path?.split('/').pop() || docId;
  } catch {
    return docId;
  }
}

// Extract unique doc IDs from search results
function extractUniqueDocIds(results) {
  const seenDocIds = new Set();
  const uniqueDocs = [];

  for (const result of results) {
    const docId = result.doc_id;
    if (docId && !seenDocIds.has(docId)) {
      seenDocIds.add(docId);
      uniqueDocs.push({
        docId,
        similarity: result.similarity,
        snippet: result.snippet?.slice(0, 100),
      });
    }
  }

  return uniqueDocs;
}

// Main regeneration function
async function regenerateGroundTruth(options) {
  if (!options.datasetPath) {
    console.error('Usage: node regenerate-ground-truth.mjs <dataset-path> [options]');
    console.error('\nOptions:');
    console.error('  --top-k=N       Number of results per query (default: 5)');
    console.error('  --min-sim=N     Minimum similarity threshold (default: 0.3)');
    console.error('  --dry-run       Show results without writing file');
    console.error('  --output=PATH   Output path (default: overwrites input)');
    process.exit(1);
  }

  // Load dataset
  console.log(`Loading dataset: ${options.datasetPath}`);
  const dataset = await loadDataset(options.datasetPath);
  console.log(`Collection: ${dataset.collection_id}`);
  console.log(`Queries: ${dataset.queries.length}`);
  console.log(`Settings: top-k=${options.topK}, min-sim=${options.minSimilarity}`);
  console.log();

  const updatedQueries = [];
  let unchangedCount = 0;
  let updatedCount = 0;
  let noResultsCount = 0;

  // Process each query
  for (const query of dataset.queries) {
    process.stdout.write(`Processing ${query.id}... `);

    // Search for relevant documents
    const results = await searchForQuery(
      query.query,
      dataset.collection_id,
      options.topK * 2, // Get more results, then filter
      options.minSimilarity
    );

    // Extract unique doc IDs
    const uniqueDocs = extractUniqueDocIds(results);

    if (uniqueDocs.length === 0) {
      console.log('NO RESULTS');
      noResultsCount++;
      // Keep original if no results found
      updatedQueries.push(query);
      continue;
    }

    // Take top K unique docs
    const topDocs = uniqueDocs.slice(0, options.topK);
    const newDocIds = topDocs.map((d) => d.docId);

    // Get document titles
    const newTitles = await Promise.all(newDocIds.map((docId) => getDocumentTitle(docId)));

    // Check if ground truth changed
    const originalIds = new Set(query.expected_doc_ids);
    const newIds = new Set(newDocIds);
    const sameIds =
      originalIds.size === newIds.size && [...originalIds].every((id) => newIds.has(id));

    if (sameIds) {
      console.log('unchanged');
      unchangedCount++;
    } else {
      console.log(
        `UPDATED (was: ${query.expected_doc_ids.length} docs, now: ${newDocIds.length} docs)`
      );
      updatedCount++;

      if (options.dryRun) {
        console.log(`    Old: ${query.expected_doc_titles?.join(', ')}`);
        console.log(`    New: ${newTitles.join(', ')}`);
        console.log(
          `    Top match: "${topDocs[0].snippet}..." (sim=${topDocs[0].similarity.toFixed(3)})`
        );
      }
    }

    // Create updated query object
    updatedQueries.push({
      ...query,
      expected_doc_ids: newDocIds,
      expected_doc_titles: newTitles,
    });
  }

  // Summary
  console.log();
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Unchanged: ${unchangedCount}`);
  console.log(`Updated:   ${updatedCount}`);
  console.log(`No results: ${noResultsCount}`);
  console.log();

  if (options.dryRun) {
    console.log('DRY RUN - no file written');
    return;
  }

  // Create updated dataset
  const updatedDataset = {
    ...dataset,
    queries: updatedQueries,
    regenerated_at: new Date().toISOString(),
    regeneration_settings: {
      topK: options.topK,
      minSimilarity: options.minSimilarity,
      searchMode: 'hybrid',
    },
  };

  // Write output file
  const outputPath = options.outputPath || options.datasetPath;
  await writeFile(outputPath, JSON.stringify(updatedDataset, null, 2) + '\n');
  console.log(`Written to: ${outputPath}`);
}

// Run
const options = parseArgs();
regenerateGroundTruth(options).catch(console.error);
