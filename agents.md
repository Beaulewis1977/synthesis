# Agent Collaboration Workflow
**Version:** 1.0  
**Last Updated:** October 6, 2025

---

## 🎯 Purpose

This document defines how AI agents collaborate to build the Synthesis RAG system using a structured, review-based workflow.

## YOU MUST NOT BE LAZY
## YOU MUST NOT LIE
## YOU MUST COMPLETE ALL WORK AS CALLED FOR IN THE PLANS OR TOLD TO BY ME.

---

## 👥 Agent Roles

### 1. Builder Agent (You/Primary AI)
**Responsibilities:**
- Implement features based on planning docs
- Write clean, tested code
- Create phase summaries
- Prepare PRs for review

### 2. Review Agent (Secondary AI)
**Responsibilities:**
- Review phase summaries
- Check code quality
- Verify acceptance criteria
- Approve or request changes

### 3. CodeRabbit (Automated)
**Responsibilities:**
- Automated code review
- Check for bugs, security issues
- Enforce style guidelines
- PR approval/comments

---

## 🔧 MCP Servers for Agents

### Required MCP Servers

Builder agents MUST have access to these MCP servers:

#### 1. Context7 (or similar) - Document Search
**Purpose:** Search planning documentation when stuck

**Usage:**
```
@context7 search "database schema setup"
@context7 search "agent tool implementation"
```

**When to use:**
- Forgot implementation details
- Need to reference specs
- Unclear about requirements
- Want to verify approach

#### 2. Perplexity (or web search) - Technical Solutions
**Purpose:** Search web for technical problems

**Usage:**
```
@perplexity "how to configure pgvector HNSW index"
@perplexity "typescript async error handling best practices"
```

**When to use:**
- Encounter technical errors
- Need implementation examples
- Library documentation needed
- Best practices unclear

#### 3. Sequential Thinking - Complex Problems
**Purpose:** Break down complex problems

**Usage:**
```
Use sequential thinking to plan implementation of multi-step feature
```

**When to use:**
- Complex architectural decisions
- Multi-step implementation planning
- Debugging difficult issues

### MCP Usage Guidelines

**DO:**
- ✅ Search docs BEFORE guessing
- ✅ Use web search for errors
- ✅ Reference planning docs frequently
- ✅ Verify assumptions with searches

**DON'T:**
- ❌ Guess implementation details
- ❌ Skip documentation search
- ❌ Ignore available resources
- ❌ Make up requirements

### Example Workflow with MCPs

```
1. Read phase requirements from planning docs
2. If unclear → @context7 search relevant doc
3. Start implementation
4. Encounter error → @perplexity search error message
5. Find solution → Apply fix
6. Complex decision → Use sequential thinking
7. Verify against docs → @context7 search spec
8. Complete and test
```

---

## 🔄 Development Workflow

```
Phase Start
  ↓
Builder Agent: Implement Feature
  ↓
Builder Agent: Run Tests
  ↓
Builder Agent: Create Phase Summary ← YOU ARE HERE
  ↓
Review Agent: Review Summary & Code
  ↓
Review Agent: Approve or Request Changes
  ├─ Changes Needed → Builder Agent fixes → Review Again
  └─ Approved ↓
  
Create Feature Branch
  ↓
Commit Code + Summary
  ↓
Push to GitHub (develop)
  ↓
Create Pull Request
  ↓
CodeRabbit: Automated Review
  ↓
CodeRabbit: Approve or Request Changes
  ├─ Changes Needed → Fix → Push → Review Again
  └─ Approved ↓
  
Merge to develop
  ↓
Phase Complete
```

---

## 📋 Phase-Based Development

### Phase Structure

Each "phase" is a cohesive unit of work from the build plan:
- **Example:** "Day 1: Database + Core Pipeline"
- **Example:** "Day 3: Search + Agent Tools"

### Phase Checklist

Before finishing a phase:

- [ ] All features implemented
- [ ] Unit tests written and passing
- [ ] Integration tests passing (if applicable)
- [ ] No console errors
- [ ] Documentation updated
- [ ] Phase summary created
- [ ] Review agent approved
- [ ] Feature branch created
- [ ] Code committed
- [ ] PR created
- [ ] CodeRabbit approved
- [ ] Merged to develop

---

## 📝 Phase Summary Template

**Location:** Create `PHASE_SUMMARY_TEMPLATE.md` (see dedicated file)

Builder agent MUST create a summary after completing each phase:

```markdown
# Phase Summary: [Phase Name]

## Overview
Brief description of what was accomplished

## Features Implemented
- Feature 1
- Feature 2
- Feature 3

## Files Changed
- `path/to/file1.ts` - Description of changes
- `path/to/file2.ts` - Description of changes

## Tests Added
- Test suite 1: X tests
- Test suite 2: Y tests

## Acceptance Criteria
- [x] Criterion 1
- [x] Criterion 2
- [ ] Criterion 3 (deferred to Phase X)

## Known Issues
- Issue 1: Description (tracked in #123)
- Issue 2: Description (will fix in next phase)

## Breaking Changes
None / List any breaking changes

## Dependencies for Next Phase
- Requirement 1 from this phase
- Requirement 2 from this phase

## Review Checklist
- [ ] Code follows style guide
- [ ] Tests are comprehensive
- [ ] No security issues
- [ ] Performance is acceptable
- [ ] Documentation is updated

## Notes
Any additional context for reviewers
```

---

## 🔍 Review Agent Process

### What Review Agent Checks

#### 1. Phase Summary Quality
- [ ] Summary is complete and accurate
- [ ] All sections filled out
- [ ] Acceptance criteria addressed
- [ ] Known issues documented

#### 2. Code Quality
- [ ] Files match summary description
- [ ] Code is clean and readable
- [ ] No obvious bugs
- [ ] Error handling present
- [ ] No hardcoded values (use env vars)

#### 3. Testing
- [ ] Tests exist for new features
- [ ] Tests are meaningful (not just placeholders)
- [ ] Edge cases covered
- [ ] Tests pass

#### 4. Documentation
- [ ] Code comments where needed
- [ ] README updated if needed
- [ ] API docs updated if endpoints changed

#### 5. Dependencies
- [ ] No unnecessary dependencies added
- [ ] Package.json updated correctly
- [ ] Lock file updated

### Review Agent Response Format

```markdown
## Review: Phase [Name]

### Summary Assessment
✅ Complete / ⚠️ Issues Found / ❌ Major Problems

### Detailed Feedback

**Code Quality:** ✅ / ⚠️ / ❌
- Feedback item 1
- Feedback item 2

**Testing:** ✅ / ⚠️ / ❌
- Feedback item 1

**Documentation:** ✅ / ⚠️ / ❌
- Feedback item 1

### Required Changes
1. Change 1
2. Change 2

### Optional Suggestions
1. Suggestion 1
2. Suggestion 2

### Decision
✅ APPROVED - Proceed to PR
⚠️ APPROVED WITH COMMENTS - Proceed but address in next phase
❌ REJECTED - Fix issues and resubmit for review
```

---

## 🌿 Git Workflow

### Branch Strategy

```
main
  ├── develop
  │     ├── feature/phase-1-database
  │     ├── feature/phase-2-chunking
  │     ├── feature/phase-3-search
  │     └── feature/phase-4-web-fetching
```

### Branch Naming

**Pattern:** `feature/phase-X-description`

**Examples:**
- `feature/phase-1-database-setup`
- `feature/phase-2-ingestion-pipeline`
- `feature/phase-3-agent-tools`
- `feature/phase-4-web-crawling`
- `feature/phase-5-ui`

### Commit Message Format

**Format:** Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting (no code change)
- `refactor`: Code restructure (no behavior change)
- `test`: Adding tests
- `chore`: Maintenance (deps, config, etc.)

**Examples:**
```
feat(pipeline): implement PDF extraction
feat(agent): add search_rag tool
fix(database): correct HNSW index parameters
docs(api): update endpoint documentation
test(pipeline): add chunking unit tests
```

### Commit Best Practices

1. **One feature per commit** (when possible)
2. **Write descriptive messages**
3. **Reference issues** when relevant: `fixes #123`
4. **Include co-author** if pair programming:
   ```
   Co-authored-by: Agent Name <agent@example.com>
   ```

---

## 🔀 Pull Request Process

### PR Creation

**Title Format:**
```
Phase X: Brief Description
```

**Examples:**
- `Phase 1: Database Schema and Migration System`
- `Phase 3: Agent Tools and Search Implementation`

### PR Description Template

```markdown
## Phase Summary
[Link to phase summary file]

## Changes
Brief overview of what this PR does

## Checklist
- [ ] All tests passing
- [ ] Documentation updated
- [ ] No console warnings
- [ ] Review agent approved
- [ ] Phase summary complete

## Screenshots (if UI changes)
[Add screenshots]

## Related Issues
Closes #123
Relates to #456
```

### PR Labels

- `phase-1` through `phase-9` - Which phase
- `feature` - New functionality
- `bugfix` - Fixes a bug
- `documentation` - Doc changes only
- `needs-review` - Awaiting review
- `approved` - Ready to merge

---

## 🤖 CodeRabbit Configuration

**File:** `.coderabbit.yml` (see dedicated file)

CodeRabbit automatically reviews:
- Code quality
- Security vulnerabilities
- Performance issues
- Style violations
- Best practice violations

---

## ⚠️ Handling Issues

### During Development

**If you discover a bug:**
1. Document in phase summary under "Known Issues"
2. Create GitHub issue
3. Decide: Fix now or defer?
4. If defer, note in phase summary

**If tests fail:**
1. Don't proceed to review
2. Fix the issue
3. Re-run tests
4. Only submit for review when green

**If stuck:**
1. Document what you tried
2. Note in phase summary
3. Mark phase as "blocked"
4. Escalate to human

### During Review

**If review agent requests changes:**
1. Address each point
2. Update code
3. Re-run tests
4. Resubmit summary with "Changes Made" section
5. Tag review agent

**If CodeRabbit requests changes:**
1. Review comments
2. Decide if valid (usually they are)
3. Fix issues
4. Push new commit
5. CodeRabbit will re-review

---

## 🎯 Quality Gates

### Gate 1: Self-Review (Builder Agent)

Before creating phase summary:
- [ ] Code compiles/runs
- [ ] Tests pass
- [ ] No TODO comments (or documented)
- [ ] No debug console.logs
- [ ] Env vars not hardcoded

### Gate 2: Review Agent

Before creating PR:
- [ ] Phase summary approved
- [ ] Code quality acceptable
- [ ] Tests sufficient
- [ ] Documentation adequate

### Gate 3: CodeRabbit

Before merging:
- [ ] No critical issues
- [ ] No security vulnerabilities
- [ ] Style guide followed
- [ ] Best practices followed

---

## 📊 Progress Tracking

### Daily Update

At end of each day, update `PROGRESS.md`:

```markdown
## Day X: [Date]

**Phase:** [Phase Name]

**Status:** In Progress / Blocked / Complete

**Completed:**
- Item 1
- Item 2

**In Progress:**
- Item 3 (50% done)

**Blockers:**
- Blocker 1: Description

**Tomorrow:**
- Plan 1
- Plan 2
```

### Phase Tracking

In `NEW-RAG-PLAN/09_BUILD_PLAN.md`, update status:

```markdown
| Day | Goal | Status | Notes |
|-----|------|--------|-------|
| 1 | Database | ✅ Done | Completed on time |
| 2 | Pipeline | 🟡 In Progress | Chunking done, embeddings next |
```

---

## 🚨 Emergency Procedures

### Critical Bug in Production

1. Create hotfix branch from `main`
2. Fix bug with minimal changes
3. Test thoroughly
4. Create PR to `main` (skip review agent if emergency)
5. Merge after CodeRabbit approval
6. Backport to `develop`

### Rollback Needed

1. Revert merge commit on `develop`
2. Document why in issue
3. Fix in new feature branch
4. Follow normal process

---

## ✅ Agent Checklist (Quick Reference)

### Before Starting Phase
- [ ] Read phase requirements in build plan
- [ ] Understand acceptance criteria
- [ ] Check dependencies from previous phases

### During Phase
- [ ] Implement features
- [ ] Write tests
- [ ] Run tests frequently
- [ ] Document as you go

### After Phase
- [ ] All tests green
- [ ] Create phase summary
- [ ] Self-review code
- [ ] Tag review agent
- [ ] Wait for approval

### After Review Approval
- [ ] Create feature branch
- [ ] Commit with good messages
- [ ] Push to GitHub
- [ ] Create PR with template
- [ ] Wait for CodeRabbit
- [ ] Address CodeRabbit comments
- [ ] Merge when approved

### After Merge
- [ ] Delete feature branch
- [ ] Update progress tracker
- [ ] Start next phase

---

## 💬 Communication

### Between Agents

Use GitHub comments for all communication:
- PR comments for code-specific feedback
- Issue comments for bug discussions
- Discussions for general questions

### With Human

- **Blockers:** Comment on relevant PR/issue
- **Questions:** Create discussion
- **Status:** Update PROGRESS.md

---

## 📚 Key Documents Reference

| Document | Purpose | When to Use |
|----------|---------|-------------|
| `09_BUILD_PLAN.md` | Day-by-day tasks | Start of each day |
| `PHASE_SUMMARY_TEMPLATE.md` | Summary template | End of each phase |
| `agents.md` | This file | Reference workflow |
| `.coderabbit.yml` | Review config | Setup only |
| `PROGRESS.md` | Track progress | Daily updates |

---

**Follow this workflow and you'll build a quality system with clear accountability!**
