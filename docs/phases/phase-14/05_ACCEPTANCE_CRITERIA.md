## Phase 14: Acceptance Criteria

Functional
- [ ] Backend applies `tech_stack` filter when provided
- [ ] Vector path narrows results by `metadata.tech_stack`
- [ ] Hybrid path narrows candidates before fusion/rerank
- [ ] Frontend (if enabled) sends `tech_stack[]` and persists tags in URL
- [ ] Behavior unchanged when no tags provided

Performance
- [ ] No material regression without index (small corpora)
- [ ] Guidance provided for GIN index on JSONB to safeguard large datasets

Quality
- [ ] Unit tests for service filtering (vector/hybrid) pass
- [ ] Integration test proves end-to-end filtering works
- [ ] Typecheck clean
- [ ] Lint clean

Documentation
- [ ] Integration guide updated with examples
- [ ] Agent prompt prepared for execution
- [ ] Epic closed post-approval


