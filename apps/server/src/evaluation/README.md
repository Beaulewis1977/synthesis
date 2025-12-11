# Synthesis RAG Evaluation Framework

A benchmarking system for evaluating the Synthesis RAG pipeline's retrieval and generation quality.

## Quick Start

```bash
# 1. Generate a synthetic dataset from your documents
pnpm --filter @synthesis/server eval:generate

# 2. Run evaluation (retrieval metrics only - fast)
pnpm --filter @synthesis/server eval:retrieval

# 3. Run full evaluation (includes LLM-as-judge - slower, costs API calls)
pnpm --filter @synthesis/server eval
```

## Prerequisites

- PostgreSQL running with documents ingested
- At least one collection with chunked documents
- `DATABASE_URL` environment variable set
- `ANTHROPIC_API_KEY` for generation evaluation (optional)

## CLI Options

```bash
pnpm --filter @synthesis/server eval [options]

Options:
  -c, --category <type>       Filter by category: docs, code, mobile, general
  -r, --retrieval-only        Skip LLM generation evaluation (faster, free)
  -g, --generate-dataset      Generate synthetic queries from your docs
  -d, --dataset <path>        Path to dataset JSON file
  --search-mode <mode>        vector | hybrid | bm25 (default: hybrid)
  --rerank                    Enable reranking (default: true)
  --top-k <n>                 Results to retrieve (default: 10)
  --compare <path>            Compare against a baseline report
  -o, --output <dir>          Output directory (default: perf/eval_results)
  -v, --verbose               Show per-query progress
  --queries-per-category <n>  Queries to generate per category (default: 10)
```

## What Gets Tested

### Currently Implemented

| Test Type | Description | Metrics |
|-----------|-------------|---------|
| **Retrieval Quality** | Are the right documents retrieved? | MRR, NDCG@5/10, Recall@3/5/10, Precision@5, Hit Rate |
| **Generation Quality** | Is the answer accurate and grounded? | Faithfulness, Relevancy, Completeness, Coherence |
| **Latency** | How fast is search? | P50, P95, P99 latency |

### Search Modes Tested

The evaluation runs queries through `smartSearch()` which uses:

- **Vector search**: Embedding similarity via pgvector
- **Hybrid search**: Vector + BM25 with Reciprocal Rank Fusion (RRF)
- **Intent detection**: Auto-adjusts weights based on query type
- **Reranking**: Optional Cohere or BGE reranker
- **MMR**: Maximal Marginal Relevance for diversity (if enabled)
- **Graph expansion**: Knowledge graph traversal (if enabled)

**Note**: Currently tests ONE configuration per run. Use `--search-mode` and `--rerank` flags to test different configurations.

## Metrics Explained

### Retrieval Metrics

| Metric | What It Measures | Target |
|--------|------------------|--------|
| **MRR** | Position of first relevant result (1/rank) | > 0.7 |
| **NDCG@k** | Ranking quality - are relevant docs ranked higher? | > 0.65 |
| **Recall@k** | Coverage - what % of relevant docs are in top k? | > 0.85 |
| **Precision@k** | Accuracy - what % of top k are relevant? | > 0.5 |
| **Hit Rate** | Did we find at least one relevant doc? | > 0.90 |

### Generation Metrics (LLM-as-Judge)

| Metric | What It Measures | Target |
|--------|------------------|--------|
| **Faithfulness** | Is every claim supported by retrieved context? | > 0.85 |
| **Relevancy** | Does the answer address the query? | > 0.80 |
| **Completeness** | Are all key points covered? | > 0.75 |
| **Coherence** | Is the answer well-structured? | > 0.80 |

## Dataset Format

Datasets are JSON files with this structure:

```json
{
  "metadata": {
    "name": "my-eval-dataset",
    "description": "...",
    "version": "1.0.0",
    "createdAt": "2024-12-09T00:00:00.000Z",
    "source": "manual" | "synthetic" | "mixed"
  },
  "queries": [
    {
      "id": "docs-1",
      "query": "How do I implement X?",
      "category": "docs" | "code" | "mobile" | "general",
      "difficulty": "easy" | "medium" | "hard",
      "queryType": "factual" | "conceptual" | "how-to" | "comparison",
      "relevantDocIds": ["uuid-1", "uuid-2"],
      "relevantChunkIds": ["chunk-1"],
      "collectionId": "uuid-of-collection",
      "requiredKeywords": ["keyword1", "keyword2"],
      "expectedAnswer": "Optional ideal answer for generation eval"
    }
  ]
}
```

**Important**: Each query needs a `collectionId` to search in. The starter dataset at `perf/eval_datasets/combined.json` has empty `relevantDocIds` - you'll need to populate these with actual document IDs from your collections.

## Output

Reports are saved to `perf/eval_results/`:

- `eval-YYYY-MM-DD-XXXXXX.json` - Full results data
- `eval-YYYY-MM-DD-XXXXXX.md` - Human-readable markdown report

### Sample Report Output

```
========================================
EVALUATION COMPLETE
========================================

Overall Results:
  Queries Evaluated: 35
  MRR:               0.732
  NDCG@5:            0.684
  Recall@5:          0.821
  Hit Rate:          0.914
  Avg Latency:       342ms

Failures:
  Zero Hits:         3
  Low Faithfulness:  2
  High Latency:      1
```

## Future Enhancements (Not Yet Implemented)

### Multi-Mode Comparison
Compare vector vs hybrid vs hybrid+rerank in a single run:
```bash
pnpm eval --compare-modes
```

### Component Isolation
Test individual pipeline stages:
- Embedding provider comparison (Ollama vs OpenAI vs Voyage)
- Reranker comparison (Cohere vs BGE vs none)
- MMR impact analysis
- Graph expansion impact

### Local LLM Judge
Use Ollama for free generation evaluation:
```bash
pnpm eval --judge=ollama --judge-model=llama3.2:3b
```

### Advanced Metrics
- Answer latency (full agent response time)
- Token efficiency
- Citation accuracy
- Hallucination detection
- Cross-encoder relevance scoring

### Automated Regression Testing
- CI/CD integration
- Baseline comparison with alerts
- Quality gates (fail if MRR drops below threshold)

### A/B Testing Framework
- Test configuration changes
- Statistical significance testing
- Gradual rollout validation

## Troubleshooting

### "No collectionId specified"
Each query needs a collection to search. Either:
1. Add `collectionId` to each query in your dataset
2. Pass `--collection-ids` flag (not yet implemented)

### Empty results
- Verify documents are ingested and chunked
- Check embedding provider is running (Ollama)
- Ensure collection has vectors with matching dimensions

### Low metrics on synthetic dataset
Synthetic queries may not have accurate `relevantDocIds`. Options:
1. Manually curate ground truth document IDs
2. Use the generated `sourceChunkId` in metadata as the relevant chunk
3. Focus on relative comparisons (before/after changes) rather than absolute scores

## Files

```
apps/server/src/evaluation/
├── README.md           # This file
├── index.ts            # Module exports
├── types.ts            # Type definitions
├── metrics.ts          # MRR, NDCG, Recall calculations
├── runner.ts           # Main evaluation orchestrator
├── dataset-generator.ts # Synthetic query generation
├── llm-judge.ts        # LLM-based generation evaluation
└── reporter.ts         # JSON + Markdown report generation

apps/server/perf/
├── eval_datasets/
│   └── combined.json   # Starter dataset (35 queries)
└── eval_results/       # Generated reports
```
