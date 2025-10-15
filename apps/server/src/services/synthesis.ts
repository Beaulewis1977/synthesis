import { performance } from 'node:perf_hooks';
import type { EmbedResult } from '../pipeline/embed.js';
import { embedBatch } from '../pipeline/embed.js';
import {
  type Conflict,
  type ContradictionApproach,
  detectContradictions,
} from './contradiction-detection.js';
import type { SmartSearchResult } from './search.js';

export interface SynthesisOptions {
  maxResults?: number;
  signal?: AbortSignal;
}

export interface SynthesizedSource {
  docId: string;
  docTitle: string | null;
  sourceUrl: string | null;
  snippet: string;
  metadata: Record<string, unknown> | null;
}

export interface Approach {
  method: string;
  topic: string;
  summary: string;
  consensusScore: number;
  sources: SynthesizedSource[];
}

export interface SynthesisResponse {
  query: string;
  approaches: Approach[];
  conflicts: Conflict[];
  recommended: Approach | null;
  metadata: {
    total_sources: number;
    approaches_found: number;
    conflicts_found: number;
    synthesis_time_ms: number;
  };
}

interface ResultCluster {
  indices: number[];
  centroid: number[];
}

const MAX_APPROACHES = 3;
const MAX_SUMMARY_LENGTH = 360;
const EMBEDDING_SLICE = 600;
const MAX_ITERATIONS = 10;

export async function synthesizeResults(
  query: string,
  results: SmartSearchResult[],
  options: SynthesisOptions = {}
): Promise<SynthesisResponse> {
  const start = performance.now();
  const limitedResults = results.slice(0, options.maxResults ?? 15);

  if (limitedResults.length === 0) {
    return buildEmptySynthesis(query, start);
  }

  const embeddings = await generateEmbeddings(limitedResults);
  const clusters = createClusters(limitedResults, embeddings);
  const approaches = clusters.map((cluster) =>
    buildApproach(cluster, limitedResults, embeddings, query)
  );

  const contradictionInput: ContradictionApproach[] = approaches.map((approach) => ({
    method: approach.method,
    topic: approach.topic,
    summary: approach.summary,
    consensusScore: approach.consensusScore,
    sources: approach.sources.map((source) => ({
      title: source.docTitle,
      statement: source.snippet,
      quality: readMetadataValue(source.metadata, 'source_quality'),
      date:
        readMetadataValue(source.metadata, 'last_verified') ??
        readMetadataValue(source.metadata, 'published_date'),
      url: source.sourceUrl,
    })),
  }));

  const conflicts = await detectContradictions(contradictionInput, {
    signal: options.signal,
  });

  const recommended = selectRecommendedApproach(approaches, conflicts);
  const end = performance.now();

  return {
    query,
    approaches,
    conflicts,
    recommended,
    metadata: {
      total_sources: limitedResults.length,
      approaches_found: approaches.length,
      conflicts_found: conflicts.length,
      synthesis_time_ms: Math.round(end - start),
    },
  };
}

function buildEmptySynthesis(query: string, start: number): SynthesisResponse {
  return {
    query,
    approaches: [],
    conflicts: [],
    recommended: null,
    metadata: {
      total_sources: 0,
      approaches_found: 0,
      conflicts_found: 0,
      synthesis_time_ms: Math.round(performance.now() - start),
    },
  };
}

async function generateEmbeddings(results: SmartSearchResult[]): Promise<EmbedResult[]> {
  const texts = results.map((result) => result.text.slice(0, EMBEDDING_SLICE));
  try {
    return await embedBatch(texts, { batchSize: 6 });
  } catch {
    const dimension = 16;
    return texts.map((text) => ({
      embedding: Array.from({ length: dimension }, (_, i) => {
        const charCode = text.charCodeAt(i) || 0;
        return (charCode % 255) / 255;
      }),
      provider: 'ollama',
      model: 'fallback',
      dimensions: dimension,
      usedFallback: true,
    }));
  }
}

function createClusters(results: SmartSearchResult[], embeddings: EmbedResult[]): ResultCluster[] {
  const k = Math.max(1, Math.min(MAX_APPROACHES, Math.floor(results.length / 3) || 1));
  const vectors = embeddings.map((item) => item.embedding);
  if (vectors.length === 0) {
    return [{ indices: results.map((_, index) => index), centroid: [] }];
  }

  let centroids = initializeCentroids(vectors, k);
  let assignments: number[][] = [];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    assignments = Array.from({ length: k }, () => []);

    for (let index = 0; index < vectors.length; index += 1) {
      const vector = vectors[index];
      const distances = centroids.map((centroid) => cosineSimilarity(vector, centroid));
      const clusterIndex = distances.indexOf(Math.max(...distances));
      assignments[clusterIndex].push(index);
    }

    const newCentroids = assignments.map((indices) =>
      calculateCentroid(indices.map((idx) => vectors[idx]))
    );

    if (hasConverged(centroids, newCentroids)) {
      break;
    }

    centroids = newCentroids;
  }

  return assignments
    .filter((cluster) => cluster.length > 0)
    .map((indices, clusterIdx) => ({
      indices,
      centroid: centroids[clusterIdx],
    }));
}

function buildApproach(
  cluster: ResultCluster,
  results: SmartSearchResult[],
  embeddings: EmbedResult[],
  query: string
): Approach {
  const sources = cluster.indices.map((index) => buildSource(results[index]));
  const centroid = cluster.centroid;
  const consensus = calculateConsensus(cluster.indices, embeddings, centroid, results);

  const topic = deriveTopic(cluster.indices, results, query);
  const method = deriveMethod(cluster.indices, results, topic);
  const summary = buildSummary(cluster.indices, results);

  return {
    method,
    topic,
    summary,
    consensusScore: consensus,
    sources,
  };
}

function buildSource(result: SmartSearchResult): SynthesizedSource {
  const snippet = result.text.replace(/\s+/g, ' ').trim() || result.docTitle || result.docId;
  return {
    docId: result.docId,
    docTitle: result.docTitle ?? null,
    sourceUrl: result.sourceUrl ?? null,
    snippet: snippet.slice(0, 420),
    metadata: (result.metadata as Record<string, unknown> | null) ?? null,
  };
}

function calculateConsensus(
  indices: number[],
  embeddings: EmbedResult[],
  centroid: number[],
  results: SmartSearchResult[]
): number {
  if (indices.length <= 1) {
    return 1;
  }

  const quality = averageQuality(indices, results);
  const similarity = averageSimilarity(indices, embeddings, centroid);
  const freshness = averageFreshness(indices, results);

  return clamp01(quality * 0.4 + similarity * 0.4 + freshness * 0.2);
}

function averageQuality(indices: number[], results: SmartSearchResult[]): number {
  const weights = indices.map((index) => {
    const quality = String(
      readMetadataValue(results[index].metadata, 'source_quality') ?? ''
    ).toLowerCase();
    if (quality === 'official') return 1;
    if (quality === 'verified') return 0.85;
    if (quality === 'community') return 0.6;
    return 0.5;
  });

  return average(weights);
}

function averageSimilarity(
  indices: number[],
  embeddings: EmbedResult[],
  centroid: number[]
): number {
  if (!centroid.length) {
    return 0.7;
  }

  const sims = indices.map((index) => cosineSimilarity(embeddings[index].embedding, centroid));
  return average(sims.map((value) => clamp01(value)));
}

function averageFreshness(indices: number[], results: SmartSearchResult[]): number {
  const now = new Date();
  const recentThreshold = new Date();
  recentThreshold.setMonth(now.getMonth() - 6);

  const scores = indices.map((index) => {
    const raw =
      readMetadataValue(results[index].metadata, 'last_verified') ??
      readMetadataValue(results[index].metadata, 'published_date');
    if (!raw) {
      return 0.7;
    }
    const date = new Date(String(raw));
    if (Number.isNaN(date.getTime())) {
      return 0.7;
    }
    if (date > recentThreshold) {
      return 1;
    }
    const monthsDiff =
      (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
    if (monthsDiff <= 12) {
      return 0.85;
    }
    if (monthsDiff <= 24) {
      return 0.7;
    }
    return 0.5;
  });

  return average(scores);
}

function deriveTopic(indices: number[], results: SmartSearchResult[], query: string): string {
  const metadataTopic = indices
    .map((index) => readMetadataValue(results[index].metadata, 'topic'))
    .find((value) => typeof value === 'string' && value.length > 3);

  if (typeof metadataTopic === 'string') {
    return metadataTopic;
  }

  const docTitle = results[indices[0]]?.docTitle;
  if (docTitle) {
    return docTitle;
  }

  return query;
}

function deriveMethod(indices: number[], results: SmartSearchResult[], topic: string): string {
  const metadataMethod = indices
    .map(
      (index) =>
        readMetadataValue(results[index].metadata, 'approach') ??
        readMetadataValue(results[index].metadata, 'method')
    )
    .find((value) => typeof value === 'string' && value.length > 3);

  if (typeof metadataMethod === 'string') {
    return metadataMethod;
  }

  const title = results[indices[0]]?.docTitle;
  if (title) {
    return title;
  }

  return topic;
}

function buildSummary(indices: number[], results: SmartSearchResult[]): string {
  const snippets = indices
    .map((index) => results[index].text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 2);

  const summary = snippets.join(' ').slice(0, MAX_SUMMARY_LENGTH).trim();
  return summary.length > 0 ? summary : results[indices[0]].text.slice(0, MAX_SUMMARY_LENGTH);
}

function selectRecommendedApproach(approaches: Approach[], conflicts: Conflict[]): Approach | null {
  if (approaches.length === 0) {
    return null;
  }

  return approaches
    .map((approach) => ({
      approach,
      score: approach.consensusScore - computePenalty(approach, conflicts),
    }))
    .sort((left, right) => right.score - left.score)[0].approach;
}

function computePenalty(approach: Approach, conflicts: Conflict[]): number {
  for (const conflict of conflicts) {
    const affectedTitles = new Set(
      [conflict.source_a.title, conflict.source_b.title].filter(Boolean) as string[]
    );

    const affectedUrls = new Set(
      [conflict.source_a.url, conflict.source_b.url].filter(Boolean) as string[]
    );

    const hits = approach.sources.some((source) => {
      return (
        (source.docTitle && affectedTitles.has(source.docTitle)) ||
        (source.sourceUrl && affectedUrls.has(source.sourceUrl))
      );
    });

    if (hits) {
      return conflict.severity === 'high' ? 0.3 : conflict.severity === 'medium' ? 0.15 : 0.05;
    }
  }

  return 0;
}

function initializeCentroids(vectors: number[][], k: number): number[][] {
  if (vectors.length <= k) {
    return vectors.slice();
  }
  return vectors.slice(0, k);
}

function calculateCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    return [];
  }

  const dimension = vectors[0].length;
  const centroid = new Array(dimension).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dimension; i += 1) {
      centroid[i] += vector[i];
    }
  }

  return centroid.map((value) => value / vectors.length);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function hasConverged(previous: number[][], current: number[][]): boolean {
  if (previous.length !== current.length) {
    return false;
  }

  return previous.every((prev, index) => {
    const curr = current[index];
    if (prev.length !== curr.length) {
      return false;
    }

    return prev.every((value, i) => Math.abs(value - curr[i]) < 1e-4);
  });
}

function readMetadataValue(metadata: unknown, key: string): string | null {
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !(key in (metadata as Record<string, unknown>))
  ) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
