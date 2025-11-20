## Roadmap: Phase 14+ (Post 13.5)

---

### 1) Multi‑Source Ingestion (Queued)
- `/ingest-batch` endpoint that accepts curated sources (official docs, selected repos)
- Queue with BullMQ/Redis; rate‑limit and retry strategies
- Worker(s) for crawling, dedupe, and scheduled refresh
- Gating metrics: backlog size, failure rate, average crawl time

---

### 2) Optional Redis Hot/Cold Cache
- Only if search latency/throughput metrics justify
- Cache hybrid results for frequent queries
- Clear invalidation policy tied to ingestion events
- Gating metrics: p95/p99 latency deltas, hit ratio, operational overhead

---

### 3) Evaluation & Monitoring
- Minimal evaluation harness:
  - A task set (queries, expected attributes)
  - Precision@K/Recall@K/MRR compared to baseline
- Observability:
  - Structured logs for ingestion/search
  - Lightweight dashboards; expand later to Prometheus/Grafana as needed

---

### 4) Agentic Workflows (Experimental)
- Post‑retrieval self‑critique loops (scoring candidates)
- Dynamic routing (backend‑heavy vs UI‑heavy queries)
- Strict gating and feature flag; roll back on regressions

---

### 5) Multimodal (Deferred)
- Embed images/diagrams (e.g., ERDs, UI previews) only with a clear use case
- Requires separate embedding pipeline and storage paths

---

### Rollout Principles
- Feature flags on all new capabilities
- Small, measurable increments
- Regressions → disable fast, iterate off‑path (branches)


