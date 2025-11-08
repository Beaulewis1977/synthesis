# Phase 13: Daily Agent Prompts - Index

This directory contains detailed daily prompts for implementing Phase 13: Code Intelligence & AST Chunking.

Each prompt is a complete, standalone guide that your AI agent can follow to complete that day's work.

---

## 📅 Daily Prompt Overview

### [Day 1: Dart AST Parser](./PHASE_13_DAY_1_AGENT_PROMPT.md)
**Duration:** 6 hours  
**Focus:** Build regex-based Dart parser

**Deliverables:**
- `apps/server/src/pipeline/dart-analyzer.ts` (~300 lines)
- Parser functions for imports, functions, classes
- Test fixtures: `sample.dart`
- Unit tests with 80%+ coverage

**Key Tasks:**
- Extract imports (with prefixes, show/hide)
- Extract functions (async/sync)
- Extract classes (methods, properties)
- Implement brace matching
- Handle edge cases (strings, comments, nesting)

---

### [Day 2: Code Chunker Service](./PHASE_13_DAY_2_AGENT_PROMPT.md)
**Duration:** 6 hours  
**Focus:** Build AST-based chunking system

**Deliverables:**
- `apps/server/src/pipeline/code-chunker.ts` (~250 lines)
- Modified `orchestrator.ts` (pipeline integration)
- Unit tests and integration tests
- Feature flag controlled (CODE_CHUNKING env var)

**Key Tasks:**
- Route files by extension (.dart, .ts, .tsx, .js, .jsx)
- Use Dart parser for .dart files
- Chunk functions as complete units
- Chunk classes intelligently
- Preserve imports when enabled
- Fallback to simple chunking on errors

---

### [Day 3: File Relationships](./PHASE_13_DAY_3_AGENT_PROMPT.md)
**Duration:** 6 hours  
**Focus:** Track dependencies between files

**Deliverables:**
- Database migration: `006_file_relationships.sql`
- Service: `apps/server/src/services/file-relationships.ts` (~350 lines)
- Modified `code-chunker.ts` (call relationship tracking)
- API endpoint: `GET /api/documents/:id/related-files`

**Key Tasks:**
- Create `file_relationships` table with 5 indexes
- Track import relationships
- Detect test files
- Find sibling files
- Integrate with code chunker
- Add API endpoint

---

### [Day 4: TypeScript Parser](./PHASE_13_DAY_4_AGENT_PROMPT.md)
**Duration:** 4 hours  
**Focus:** Add TypeScript/JSX support

**Deliverables:**
- `apps/server/src/pipeline/ts-analyzer.ts` (~200 lines)
- Updated `code-chunker.ts` (TypeScript support)
- Test fixtures: `sample.ts`, `sample-react.tsx`
- Unit tests for TypeScript parsing

**Key Tasks:**
- Use TypeScript Compiler API
- Extract imports, functions, classes
- Handle JSX/TSX syntax
- Support React components
- Maintain DartAST interface compatibility
- Update chunker to use TS parser

---

### [Day 5: Testing & Validation](./PHASE_13_DAY_5_AGENT_PROMPT.md)
**Duration:** 6-8 hours  
**Focus:** Performance, testing, documentation

**Deliverables:**
- Benchmark results document
- Code Chunking Guide
- Updated README and .env.example
- Performance metrics
- Complete acceptance criteria validation

**Key Tasks:**
- Test on 100+ real files (Flutter samples)
- Run performance benchmarks
- Validate all acceptance criteria
- Update documentation
- Verify no breaking changes
- Prepare final summary

---

## 🎯 Quick Start

To use these prompts with your AI agent:

### Option 1: Give One Prompt at a Time
```bash
# Start Day 1
cat docs/phases/phase-13/PHASE_13_DAY_1_AGENT_PROMPT.md

# After Day 1 complete, give Day 2
cat docs/phases/phase-13/PHASE_13_DAY_2_AGENT_PROMPT.md

# And so on...
```

### Option 2: Reference in Your Prompt
```
"Please implement Phase 13 Day 1. Read and follow the instructions in docs/phases/phase-13/PHASE_13_DAY_1_AGENT_PROMPT.md"
```

### Option 3: Copy-Paste Approach
Simply copy the daily prompt content and paste it into your AI conversation.

---

## 📊 Total Effort Estimate

| Day | Focus | Time | Complexity |
|-----|-------|------|------------|
| Day 1 | Dart Parser | 6 hours | Medium |
| Day 2 | Code Chunker | 6 hours | Medium |
| Day 3 | Relationships | 6 hours | Medium |
| Day 4 | TypeScript | 4 hours | Low |
| Day 5 | Testing | 6-8 hours | High |
| **Total** | | **28-30 hours** | **~5 days** |

---

## ✅ What Each Prompt Contains

Every daily prompt includes:

1. **📚 Documentation to Read** - Relevant docs in priority order
2. **🎯 Main Objectives** - Clear goals for the day
3. **✅ Requirements Checklist** - Detailed task breakdown
4. **🔧 Commands to Run** - Copy-paste ready commands
5. **📊 Code Examples** - Implementation patterns
6. **📝 Deliverables** - Expected outputs
7. **🚨 Validation Steps** - How to verify it works
8. **⚠️ Important Notes** - Gotchas and best practices
9. **🎉 Success Criteria** - When to consider day complete
10. **📞 Handoff** - What to post to GitHub issue

---

## 🔗 Related Documentation

**Core Phase 13 Docs:**
- [00_PHASE_13_OVERVIEW.md](./00_PHASE_13_OVERVIEW.md) - Executive summary
- [01_CODE_CHUNKING_ARCHITECTURE.md](./01_CODE_CHUNKING_ARCHITECTURE.md) - Technical design
- [02_DART_AST_PARSING.md](./02_DART_AST_PARSING.md) - Dart parser details
- [03_FILE_RELATIONSHIPS.md](./03_FILE_RELATIONSHIPS.md) - Relationship tracking
- [04_BUILD_PLAN.md](./04_BUILD_PLAN.md) - Overall implementation plan
- [05_ACCEPTANCE_CRITERIA.md](./05_ACCEPTANCE_CRITERIA.md) - Validation checklist
- [06_FRONTEND_UPDATES.md](./06_FRONTEND_UPDATES.md) - UI components (optional Day 6)

**GitHub:**
- [Issue #62](https://github.com/Beaulewis1977/synthesis/issues/62) - Phase 13 Epic

---

## 💡 Tips for Success

### For the AI Agent:

1. **Read docs first** - Each prompt lists docs to read in priority order
2. **Follow the checklist** - Don't skip steps
3. **Run validation commands** - Verify each component works
4. **Post summaries** - Update GitHub issue after each day
5. **Test incrementally** - Don't wait until Day 5 to test

### For the Human Operator:

1. **Review daily summaries** - Check progress after each day
2. **Verify tests pass** - Run `pnpm test` regularly
3. **Monitor performance** - Watch for slowdowns
4. **Read validation outputs** - Check that things actually work
5. **Ask questions** - If something seems off, investigate

---

## 🚨 Common Pitfalls to Avoid

1. **Skipping tests** - Write tests as you go, not at the end
2. **Ignoring edge cases** - Test with malformed code early
3. **Forgetting feature flags** - All features should be opt-in
4. **Breaking existing code** - Run full test suite regularly
5. **Poor error handling** - Always catch and log parse errors
6. **Hardcoding paths** - Use relative imports consistently
7. **Not testing fallback** - Verify simple chunking still works

---

## 📈 Progress Tracking

After each day, post a summary to Issue #62 using the template in each daily prompt.

**Example progress comment:**
```markdown
## Phase 13 Progress Update

- ✅ Day 1: Dart Parser (6h) - COMPLETE
- ✅ Day 2: Code Chunker (6h) - COMPLETE  
- 🔄 Day 3: Relationships (4h/6h) - IN PROGRESS
- ⏸️ Day 4: TypeScript - NOT STARTED
- ⏸️ Day 5: Testing - NOT STARTED

**Current Status:** Building file relationships service

**Blockers:** None

**Next:** Complete Day 3, then move to TypeScript parser
```

---

## 🎉 Definition of Done

Phase 13 is complete when:

- ✅ All 5 daily prompts executed
- ✅ All deliverables created
- ✅ All tests passing (100% of test suite)
- ✅ Acceptance criteria validated
- ✅ Documentation updated
- ✅ Performance benchmarks met
- ✅ Final summary posted to Issue #62
- ✅ Ready for PR/merge

---

## 📞 Support

**Questions?**
- Review the relevant daily prompt
- Check the detailed documentation in `docs/phases/phase-13/`
- Review Issue #62 on GitHub
- Check existing code in `apps/server/src/pipeline/` for patterns

**Issues?**
- Post to Issue #62 with:
  - Which day you're on
  - What went wrong
  - Error messages/logs
  - What you've tried

---

**Ready to start?** Begin with [Day 1: Dart AST Parser](./PHASE_13_DAY_1_AGENT_PROMPT.md) 🚀
