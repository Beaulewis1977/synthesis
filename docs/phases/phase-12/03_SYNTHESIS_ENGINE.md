# Phase 12: Document Synthesis Engine

**Multi-source document comparison and contradiction detection**

---

## 🎯 Purpose

The Synthesis Engine enables:
1. **Multi-source comparison** - Compare 3+ documentation sources
2. **Approach clustering** - Group results by methodology
3. **Contradiction detection** - Identify conflicts between sources
4. **Consensus scoring** - Determine agreement level
5. **Recommendation generation** - Suggest best approach

---

## 🏗️ Architecture

### High-Level Flow

```
Search Results (Top N after re-ranking; default 50)
  ↓
Result Clustering
  - Group by topic/approach
  - Identify common themes
  - Calculate similarity within groups
    ↓
Approach Extraction
  - Identify distinct methodologies
  - Extract sources for each approach
  - Calculate consensus scores
    ↓
Contradiction Detection
  - Pairwise comparison of approaches
  - LLM-based verification
  - Severity categorization
    ↓
Synthesis Response
  {
    approaches: [...],
    conflicts: [...],
    recommended: {...}
  }
```

---

## 📦 Implementation

### Core Synthesis Function

**File:** `apps/server/src/services/synthesis.ts`

```typescript
import type { SearchResult } from './search.js';
import { detectContradictions } from './contradiction-detection.js';

export interface Approach {
  method: string;
  sources: SearchResult[];
  consensus_score: number;
  summary: string;
}

export interface Conflict {
  topic: string;
  source_a: {
    title: string;
    statement: string;
    quality: string;
  };
  source_b: {
    title: string;
    statement: string;
    quality: string;
  };
  severity: 'high' | 'medium' | 'low';
  difference: string;
  recommendation: string;
  confidence: number;
}

export interface SynthesisResponse {
  query: string;
  approaches: Approach[];
  conflicts: Conflict[];
  recommended: Approach;
  metadata: {
    total_sources: number;
    approaches_found: number;
    conflicts_found: number;
    synthesis_time_ms: number;
  };
}

/**
 * Synthesize multiple search results into structured comparison
 */
export async function synthesizeResults(
  query: string,
  results: SearchResult[]
): Promise<SynthesisResponse> {
  const startTime = performance.now();
  
  // 1. Group results by approach/topic
  const groups = await clusterResults(results);
  
  // 2. Extract distinct approaches
  const approaches = groups.map(group => ({
    method: identifyMethod(group),
    sources: group.results,
    consensus_score: calculateConsensus(group),
    summary: generateSummary(group),
  }));
  
  // 3. Detect contradictions between approaches
  const conflicts = await detectContradictions(approaches);
  
  // 4. Select recommended approach
  const recommended = selectBestApproach(approaches, conflicts);
  
  const endTime = performance.now();
  
  return {
    query,
    approaches,
    conflicts,
    recommended,
    metadata: {
      total_sources: results.length,
      approaches_found: approaches.length,
      conflicts_found: conflicts.length,
      synthesis_time_ms: Math.round(endTime - startTime),
    },
  };
}
```

### Result Clustering

**Purpose:** Group similar results together

```typescript
import { embed } from '../pipeline/embed.js';

interface ResultCluster {
  topic: string;
  results: SearchResult[];
  centroid: number[]; // Average embedding
}

/**
 * Cluster results by semantic similarity
 */
export async function clusterResults(
  results: SearchResult[]
): Promise<ResultCluster[]> {
  // Use simple k-means clustering
  const k = Math.min(3, Math.floor(results.length / 3)); // Max 3 clusters
  
  // Embed all result texts
  const embeddings = await Promise.all(
    results.map(r => embed(r.text.slice(0, 500))) // First 500 chars
  );
  
  // K-means clustering
  const clusters = kMeans(embeddings, k);
  
  // Group results by cluster
  return clusters.map((clusterIndices, i) => {
    const clusterResults = clusterIndices.map(idx => results[idx]);
    const clusterEmbeddings = clusterIndices.map(idx => embeddings[idx]);
    
    return {
      topic: extractCommonTopic(clusterResults),
      results: clusterResults,
      centroid: calculateCentroid(clusterEmbeddings),
    };
  });
}

/**
 * Simple k-means clustering implementation
 */
function kMeans(
  embeddings: number[][],
  k: number
): number[][] {
  // Initialize random centroids
  let centroids = embeddings
    .sort(() => Math.random() - 0.5)
    .slice(0, k);
  
  let clusters: number[][] = [];
  let iterations = 0;
  const maxIterations = 10;
  
  while (iterations < maxIterations) {
    // Assign points to nearest centroid
    clusters = Array(k).fill(null).map(() => []);
    
    embeddings.forEach((emb, idx) => {
      const distances = centroids.map(c => 
        cosineSimilarity(emb, c)
      );
      const nearestCluster = distances.indexOf(Math.max(...distances));
      clusters[nearestCluster].push(idx);
    });
    
    // Recalculate centroids
    const newCentroids = clusters.map(clusterIndices =>
      calculateCentroid(clusterIndices.map(idx => embeddings[idx]))
    );
    
    // Check convergence
    if (JSON.stringify(newCentroids) === JSON.stringify(centroids)) {
      break;
    }
    
    centroids = newCentroids;
    iterations++;
  }
  
  return clusters;
}
```
### Consensus Scoring

```typescript
/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Calculate cluster cohesion using centroid similarity
 */
function calculateClusterCohesion(results: SearchResult[], centroid: number[]): number {
  if (results.length <= 1) {
    return 1.0; // Single result = perfect cohesion
  }

  // Calculate average cosine similarity to centroid
  const similarities = results.map(result =>
    cosineSimilarity(result.embedding, centroid)
  );

  return similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
}

/**
 * Calculate how much agreement exists within a cluster
 */
export function calculateConsensus(cluster: ResultCluster): number {
  const results = cluster.results;

  if (results.length <= 1) {
    return 1.0; // Single source = full consensus
  }

  // Factors:
  // 1. Source quality agreement
  const qualityScore = calculateQualityAgreement(results);

  // 2. Semantic similarity (using real cluster cohesion)
  const similarityScore = calculateClusterCohesion(results, cluster.centroid);

  // 3. Freshness agreement
  const freshnessScore = calculateFreshnessAgreement(results);

  // Weighted average
  return (
    qualityScore * 0.4 +
    similarityScore * 0.4 +
    freshnessScore * 0.2
  );
}

function calculateQualityAgreement(results: SearchResult[]): number {
  const qualities = results.map(r => r.metadata?.source_quality || 'community');
  const officialCount = qualities.filter(q => q === 'official').length;
  const verifiedCount = qualities.filter(q => q === 'verified').length;
  
  const highQualityRatio = (officialCount + verifiedCount) / results.length;
  return highQualityRatio;
}

function calculateFreshnessAgreement(results: SearchResult[]): number {
  const dates = results
    .map(r => r.metadata?.last_verified || r.metadata?.published_date)
    .filter(Boolean)
    .map(d => new Date(d as string));
  
  if (dates.length === 0) return 0.7; // Default
  
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const recentCount = dates.filter(d => d > sixMonthsAgo).length;
  return recentCount / dates.length;
}
```

---

## 🌐 API Endpoint

```typescript
// apps/server/src/routes/synthesis.ts

import { FastifyInstance } from 'fastify';
import { searchWithReranking } from '../services/search.js';
import { synthesizeResults } from '../services/synthesis.js';

export async function registerSynthesisRoutes(app: FastifyInstance) {
  app.post('/api/synthesis/compare', async (request, reply) => {
    const { query, collection_id, top_k } = request.body as any;
    
    // Feature flag guard (default OFF)
    if (process.env.ENABLE_SYNTHESIS !== 'true') {
      return reply.code(404).send({ message: 'Synthesis disabled' });
    }
    
    // 1. Search with re-ranking
    const results = await searchWithReranking({
      query,
      collectionId: collection_id,
      rerank: true,
      topK: top_k ?? 50,
    });
    
    // 2. Synthesize
    const synthesis = await synthesizeResults(query, results);
    
    return synthesis;
  });
}
```

---

## 🧪 Testing

```typescript
describe('Synthesis Engine', () => {
  it('groups results by approach', async () => {
    const results = [
      { text: 'Use Firebase Auth...', docTitle: 'Firebase Guide' },
      { text: 'Firebase Authentication...', docTitle: 'Firebase Docs' },
      { text: 'Supabase Auth is better...', docTitle: 'Supabase Guide' },
    ];
    
    const synthesis = await synthesizeResults('authentication', results);
    
    expect(synthesis.approaches.length).toBeGreaterThanOrEqual(2);
  });
  
  it('calculates consensus score', async () => {
    const cluster = {
      topic: 'Authentication',
      results: [
        { metadata: { source_quality: 'official' } },
        { metadata: { source_quality: 'official' } },
      ],
    };
    
    const consensus = calculateConsensus(cluster);
    expect(consensus).toBeGreaterThan(0.8);
  });
});
```

---

## ✅ Acceptance Criteria

- [ ] Groups results into 2-3 distinct approaches
- [ ] Consensus scores reflect agreement level
- [ ] Summaries are concise and accurate
- [ ] Best approach selection is logical
- [ ] API endpoint returns structured synthesis
- [ ] Performance <2 seconds for 15 results

---

**Next:** See `04_CONTRADICTION_DETECTION.md` for conflict identification
