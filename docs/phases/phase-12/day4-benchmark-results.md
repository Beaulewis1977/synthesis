
=== Phase 12 Benchmark Results ===

┌─────────────────────────────────────┬──────────┐
│ (index)                             │ Values   │
├─────────────────────────────────────┼──────────┤
│ queries_evaluated                   │ 59       │
│ baseline_precision_at_5             │ '0.000'  │
│ reranked_precision_at_5             │ '0.125'  │
│ precision_at_5_improvement_percent  │ '100.00' │
│ baseline_precision_at_10            │ '0.051'  │
│ reranked_precision_at_10            │ '0.088'  │
│ precision_at_10_improvement_percent │ '73.33'  │
│ baseline_mrr                        │ '0.104'  │
│ reranked_mrr                        │ '0.373'  │
│ mrr_improvement_percent             │ '257.94' │
│ baseline_latency_ms                 │ '0.01'   │
│ reranked_latency_ms                 │ '0.17'   │
│ added_latency_ms                    │ '0.16'   │
│ baseline_latency_p50_ms             │ '0.00'   │
│ baseline_latency_p95_ms             │ '0.00'   │
│ baseline_latency_p99_ms             │ '0.03'   │
│ reranked_latency_p50_ms             │ '0.14'   │
│ reranked_latency_p95_ms             │ '0.39'   │
│ reranked_latency_p99_ms             │ '0.58'   │
│ delta_latency_p50_ms                │ '0.14'   │
│ delta_latency_p95_ms                │ '0.39'   │
│ delta_latency_p99_ms                │ '0.55'   │
└─────────────────────────────────────┴──────────┘

Top Queries (Precision@5 delta)
┌─────────┬────────────────────────────────────────────────────┬──────────────────┬────────┐
│ (index) │ Query                                              │ Category         │ Δ P@5  │
├─────────┼────────────────────────────────────────────────────┼──────────────────┼────────┤
│ 0       │ 'firebase email auth setup walkthrough'            │ 'firebase-email' │ '0.20' │
│ 1       │ 'flutter firebase email password login screen'     │ 'firebase-email' │ '0.20' │
│ 2       │ 'firebase authentication change notifier pattern'  │ 'firebase-email' │ '0.20' │
│ 3       │ 'secure firebase auth refresh tokens flutter'      │ 'firebase-email' │ '0.20' │
│ 4       │ 'firebase email auth provider integration example' │ 'firebase-email' │ '0.20' │
└─────────┴────────────────────────────────────────────────────┴──────────────────┴────────┘

Queries With No Precision Gain
┌─────────┬─────────────────────────────────────────────────┬───────────────────┬────────┐
│ (index) │ Query                                           │ Category          │ Δ P@5  │
├─────────┼─────────────────────────────────────────────────┼───────────────────┼────────┤
│ 0       │ 'keep web history sync navigator 2 flutter'     │ 'nav-declarative' │ '0.00' │
│ 1       │ 'nested navigator 2 tabs example flutter'       │ 'nav-declarative' │ '0.00' │
│ 2       │ 'state restoration with routerdelegate flutter' │ 'nav-declarative' │ '0.00' │
│ 3       │ 'migrate navigator 1 to gorouter flutter'       │ 'nav-gorouter'    │ '0.00' │
│ 4       │ 'gorouter hero transition setup flutter'        │ 'nav-gorouter'    │ '0.00' │
└─────────┴─────────────────────────────────────────────────┴───────────────────┴────────┘
