# Phase Renumbering Plan

**Created:** 2025-10-13  
**Status:** TO BE EXECUTED AFTER PHASE 8 COMPLETION  
**Estimated Time:** 30-45 minutes

---

## 🎯 Problem Statement

### What Happened

During documentation creation for advanced RAG features (Hybrid Search, Re-ranking, Code Intelligence), we **reused phase numbers 8-10**, creating a conflict with the original MVP phases:

**ORIGINAL MVP PHASES (in docs/09_BUILD_PLAN.md):**
- Phase 8: Polish + Documentation ← Part of v1.0.0 MVP
- Phase 9: Final Testing + Buffer ← Part of v1.0.0 MVP

**NEW ADVANCED FEATURES (in docs/phases/):**
- Phase 8: Hybrid Search ← **CONFLICTS!**
- Phase 9: Re-ranking & Synthesis ← **CONFLICTS!**
- Phase 10: Code Intelligence ← New

This creates confusion because:
- Two different "Phase 8" exist in the codebase
- GitHub issues may reference wrong phases
- Agents following prompts may implement wrong features
- Documentation roadmap is unclear

---

## ✅ Solution: Renumber Advanced Features

**Renumber advanced features to Phase 11-15:**

```
MVP Timeline (COMPLETE):
Phase 1-7: Core Features
Phase 8: Polish + Documentation
Phase 9: Final Testing
→ Tag v1.0.0 ✅

v2.0.0 Enhancement Timeline (IN PROGRESS):
Phase 11: Hybrid Search (was Phase 8) ← Currently implementing
Phase 12: Re-ranking & Synthesis (was Phase 9)
Phase 13: Code Intelligence (was Phase 10)
Phase 14: Integration & Polish (NEW)
Phase 15: Final Testing & Buffer (NEW)
→ Tag v2.0.0 ✅
```

---

## 📋 Execution Plan

### When to Execute

**⚠️ DO NOT EXECUTE UNTIL:**
- [x] Current Phase 8 (Hybrid Search) implementation is COMPLETE
- [x] Phase 8 tested and verified working
- [x] Checkpoint tagged (e.g., v1.1.0-hybrid or similar)
- [x] User gives explicit "go ahead" command

### Prerequisites

```bash
# 1. Ensure git is clean
git status

# 2. Create backup branch
git checkout -b backup/pre-phase-renumbering
git add -A
git commit -m "backup: snapshot before phase renumbering"

# 3. Return to main branch
git checkout main  # or your working branch
```

---

## 🔄 Step-by-Step Renumbering

### Step 1: Rename Directories (2 minutes)

```bash
cd docs/phases/

# Rename phase directories
mv phase-8 phase-11
mv phase-9 phase-12
mv phase-10 phase-13

# Verify
ls -d phase-{11,12,13}
# Should show:
# phase-11/
# phase-12/
# phase-13/
```

---

### Step 2: Rename Summary Files (1 minute)

```bash
cd docs/phases/

# Rename main summary
mv PHASES_8-10_SUMMARY.md PHASES_11-15_SUMMARY.md

# Verify
ls -1 *.md
```

---

### Step 3: Update File Contents - Phase 11 Directory (5 minutes)

**Files to update in `docs/phases/phase-11/` (9 files):**

1. `00_PHASE_11_OVERVIEW.md`
2. `01_HYBRID_SEARCH_ARCHITECTURE.md`
3. `02_EMBEDDING_PROVIDERS.md`
4. `03_METADATA_SCHEMA.md`
5. `04_TRUST_SCORING.md`
6. `05_MIGRATION_GUIDE.md`
7. `06_BUILD_PLAN.md`
8. `07_API_CHANGES.md`
9. `08_ACCEPTANCE_CRITERIA.md`

**Find & Replace in ALL 9 files:**
- Find: `Phase 8`
- Replace: `Phase 11`
- Find: `phase-8`
- Replace: `phase-11`

**Special attention:**
- `00_PHASE_11_OVERVIEW.md`: Update "Prerequisites: Phase 7" → stays same ✓
- `00_PHASE_11_OVERVIEW.md`: Update "Enables: Phase 9" → "Enables: Phase 12"
- `05_MIGRATION_GUIDE.md`: Update all "from Phase 7 to Phase 8" → "from Phase 7 to Phase 11"

---


### Step 4: Update File Contents - Phase 12 Directory (5 minutes)

**Files to update in `docs/phases/phase-12/` (8 files):**

1. `00_PHASE_12_OVERVIEW.md`
2. `01_RERANKING_ARCHITECTURE.md`
3. `02_PROVIDER_COMPARISON.md`
4. `03_SYNTHESIS_ENGINE.md`
5. `04_CONTRADICTION_DETECTION.md`
6. `05_COST_MONITORING.md`
7. `06_BUILD_PLAN.md`
8. `07_ACCEPTANCE_CRITERIA.md`

**Find & Replace in ALL 8 files:**
- Find: `Phase 9`
- Replace: `Phase 12`
- Find: `phase-9`
- Replace: `phase-12`

**Special attention:**
- `00_PHASE_12_OVERVIEW.md`: Update "Prerequisites: Phase 8" → "Prerequisites: Phase 11"
- `00_PHASE_12_OVERVIEW.md`: Update "Enables: Phase 10" → "Enables: Phase 13"

---


### Step 5: Update File Contents - Phase 13 Directory (5 minutes)

**Files to update in `docs/phases/phase-13/` (6 files):**

1. `00_PHASE_13_OVERVIEW.md`
2. `01_CODE_CHUNKING_ARCHITECTURE.md`
3. `02_DART_AST_PARSING.md`
4. `03_FILE_RELATIONSHIPS.md`
5. `04_BUILD_PLAN.md`
6. `05_ACCEPTANCE_CRITERIA.md`

**Find & Replace in ALL 6 files:**
- Find: `Phase 10`
- Replace: `Phase 13`
- Find: `phase-10`
- Replace: `phase-13`

**Special attention:**
- `00_PHASE_13_OVERVIEW.md`: Update "Prerequisites: Phases 8 & 9" → "Prerequisites: Phases 11 & 12"

---


### Step 6: Update Summary Documents (10 minutes)

#### A. `docs/phases/PHASES_11-15_SUMMARY.md`

**Updates needed:**
1. Title: "Phases 8-10" → "Phases 11-15"
2. All "Phase 8" → "Phase 11"
3. All "Phase 9" → "Phase 12"
4. All "Phase 10" → "Phase 13"
5. Add new sections for Phase 14-15 (see Step 9)

#### B. `docs/phases/IMPLEMENTATION_ROADMAP.md`

**Updates needed:**
1. Timeline section: Phase 8-10 → Phase 11-13
2. All section headings: Phase 8/9/10 → Phase 11/12/13
3. Prerequisites: "After Phase 7" → "After Phase 9 (MVP complete)"
4. Add Phase 14-15 sections

#### C. `docs/phases/DOCUMENTATION_COMPLETE.md`

**Updates needed:**
1. All "Phase 8" → "Phase 11"
2. All "Phase 9" → "Phase 12"
3. All "Phase 10" → "Phase 13"
4. File counts: Add Phase 14-15 (when created)
5. Directory paths: `phase-8/` → `phase-11/`, etc.

#### D. `docs/phases/README.md`

**Updates needed:**
1. Table of contents: Phase 8-10 → Phase 11-13
2. Links: Update all `phase-8/`, `phase-9/`, `phase-10/` → `phase-11/`, `phase-12/`, `phase-13/`
3. Add Phase 14-15 entries

#### E. `docs/phases/DETAILED_DOCS_REFERENCE.md`

**Updates needed:**
1. All section headings: Phase 8/9/10 → Phase 11/12/13
2. All references in text
3. Add Phase 14-15 reference sections

---


### Step 7: Verify MVP Docs UNCHANGED (2 minutes)

**CRITICAL: These files must NOT be changed:**

```bash
# Check MVP Phase 8-9 still intact
grep -n "Phase 8: Polish" docs/09_BUILD_PLAN.md
# Expected: Line 395: ### Phase 8: Polish + Documentation

grep -n "Phase 9: Final Testing" docs/09_BUILD_PLAN.md
# Expected: Line 438: ### Phase 9: Final Testing + Buffer

grep -n "Phase 8-9" docs/14_GITHUB_ISSUES.md
# Expected: Line 598: ### Phase 8-9: Polish + Testing

grep -n "Phase 8-9" docs/15_AGENT_PROMPTS.md
# Expected: Line 517-520: ### Phase 8-9: Polish and Final Testing
```

**If ANY of these show changes, REVERT IMMEDIATELY!**

---


### Step 8: Update GitHub Milestones & Issues (15-20 minutes)

#### Part A: Create New Milestones

**Check existing milestones:**
```bash
gh api repos/beaulewis1977/synthesis/milestones --jq '.[] | "\(.number): \(.title)''
```

**Expected existing milestones:**
```
1: Phase 1-2: Core Pipeline (COMPLETE)
2: Phase 3-4: Agent & Autonomy (COMPLETE)
3: Phase 5-6: UI & MCP (COMPLETE)
4: Phase 7-9: Production Ready (MVP phases, in progress)
```

**Create Milestone 5 for advanced features:**
```bash
gh api repos/beaulewis1977/synthesis/milestones \
  -f title="Phase 11-13: Advanced RAG Features" \
  -f description="Hybrid search, re-ranking, code intelligence - v2.0.0 enhancements" \
  -f due_on="2025-11-15T00:00:00Z"
```

**Create Milestone 6 for integration:**
```bash
gh api repos/beaulewis1977/synthesis/milestones \
  -f title="Phase 14-15: Integration & v2.0" \
  -f description="Integration testing, polish, production readiness for v2.0.0" \
  -f due_on="2025-11-30T00:00:00Z"
```

**Get milestone numbers for later use:**
```bash
# Store milestone numbers in variables
MILESTONE_5=$(gh api repos/beaulewis1977/synthesis/milestones --jq '.[] | select(.title | contains("Phase 11-13")) | .number')
MILESTONE_6=$(gh api repos/beaulewis1977/synthesis/milestones --jq '.[] | select(.title | contains("Phase 14-15")) | .number')

echo "Milestone 5: $MILESTONE_5"
echo "Milestone 6: $MILESTONE_6"
```

---


#### Part B: Update Existing Issue Titles & Labels

**Issues to update (currently #60-65):**

```bash
# Issue #60: Backend Epic
gh issue edit 60 \
  --title "Phase 11: Implement Hybrid Search & Multi-Model Embeddings" \
  --repo beaulewis1977/synthesis

# Update labels (remove phase-8, add phase-11)
gh issue edit 60 \
  --remove-label "phase-8" \
  --add-label "phase-11" \
  --repo beaulewis1977/synthesis

# Issue #61: Backend Epic
gh issue edit 61 \
  --title "Phase 12: Implement Re-ranking & Document Synthesis" \
  --remove-label "phase-9" \
  --add-label "phase-12" \
  --repo beaulewis1977/synthesis

# Issue #62: Backend Epic
gh issue edit 62 \
  --title "Phase 13: Implement Code Intelligence & AST Chunking" \
  --remove-label "phase-10" \
  --add-label "phase-13" \
  --repo beaulewis1977/synthesis

# Issue #63: Frontend
gh issue edit 63 \
  --title "Phase 11: Frontend - Trust Score Badges & Recency Indicators" \
  --remove-label "phase-8" \
  --add-label "phase-11" \
  --repo beaulewis1977/synthesis

# Issue #64: Frontend
gh issue edit 64 \
  --title "Phase 12: Frontend - Cost Dashboard & Document Synthesis View" \
  --remove-label "phase-9" \
  --add-label "phase-12" \
  --repo beaulewis1977/synthesis

# Issue #65: Frontend
gh issue edit 65 \
  --title "Phase 13: Frontend - Related Files Panel & Code Navigation" \
  --remove-label "phase-10" \
  --add-label "phase-13" \
  --repo beaulewis1977/synthesis
```

---


#### Part C: Assign Issues to Milestones

**Assign Phase 11-13 issues to Milestone 5:**
```bash
# Use the milestone number from Part A
for issue in 60 61 62 63 64 65; do
  gh issue edit $issue --milestone $MILESTONE_5 --repo beaulewis1977/synthesis
  echo "✓ Assigned #$issue to Milestone 5"
done
```

---


#### Part D: Add Renumbering Comments

**Add explanation comment to each issue:**
```bash
# Comment for all Phase 11-13 issues
RENUMBER_COMMENT='📝 **Phase Renumbering Update**

This issue has been renumbered to avoid conflicts with MVP phases:

**Mapping:**
- Phase 8 → Phase 11 (Hybrid Search)
- Phase 9 → Phase 12 (Re-ranking & Synthesis)
- Phase 10 → Phase 13 (Code Intelligence)

**Why:** The original project plan uses Phase 8-9 for MVP polish/testing. Advanced features have been renumbered to Phase 11-15.

**Timeline:**
- MVP: Phase 1-9 (v1.0.0) ✅
- Advanced: Phase 11-15 (v2.0.0) 🚧

See `docs/PHASE_RENUMBERING_PLAN.md` for full details.'

# Add comment to issues
for issue in 60 61 62 63 64 65; do
  gh issue comment $issue --body "$RENUMBER_COMMENT" --repo beaulewis1977/synthesis
  echo "✓ Added comment to #$issue"
done
```

---


#### Part E: Create New Labels (if needed)

**Check if phase-11, phase-12, phase-13 labels exist:**
```bash
gh label list --repo beaulewis1977/synthesis | grep "phase-1[123]"
```

**If they don't exist, create them:**
```bash
gh label create "phase-11" \
  --description "Tasks related to Hybrid Search & Multi-Model Embeddings" \
  --color "fbca04" \
  --repo beaulewis1977/synthesis

gh label create "phase-12" \
  --description "Tasks related to Re-ranking & Document Synthesis" \
  --color "fbca04" \
  --repo beaulewis1977/synthesis

gh label create "phase-13" \
  --description "Tasks related to Code Intelligence & AST Chunking" \
  --color "fbca04" \
  --repo beaulewis1977/synthesis

gh label create "phase-14" \
  --description "Tasks related to Integration & Polish" \
  --color "fbca04" \
  --repo beaulewis1977/synthesis

gh label create "phase-15" \
  --description "Tasks related to Final Testing & v2.0 Release" \
  --color "fbca04" \
  --repo beaulewis1977/synthesis
```

---


#### Part F: Verify GitHub Changes

```bash
# Check issue titles updated
echo "=== Checking issue titles ==="
gh issue view 60 --json title --jq '.title' --repo beaulewis1977/synthesis
# Should show: "Phase 11: Implement Hybrid Search..."

# Check labels updated
echo "=== Checking labels ==="
gh issue view 60 --json labels --jq '.labels[].name' --repo beaulewis1977/synthesis
# Should include "phase-11" (not "phase-8")

# Check milestones assigned
echo "=== Checking milestones ==="
gh issue view 60 --json milestone --jq '.milestone.title' --repo beaulewis1977/synthesis
# Should show: "Phase 11-13: Advanced RAG Features"
```

---


### Step 9: Create Phase 14-15 GitHub Issues (20-30 minutes)

**After creating Phase 14-15 documentation, create corresponding issues:**

#### Phase 14 Issues (Integration & Polish)

```bash
# Issue: Integration Testing
gh issue create \
  --title "Phase 14: Integration Testing - All Features Working Together" \
  --body "Test hybrid search + re-ranking + code intelligence working in combination.

**Documentation:** `docs/phases/phase-14/01_INTEGRATION_TESTING.md`

**Acceptance Criteria:**
- [ ] All Phase 11-13 features work together
- [ ] No performance degradation
- [ ] Cost monitoring tracks all operations
- [ ] UI displays all features correctly
- [ ] Error handling across features

**Effort:** 6-8 hours" \
  --label "phase-14,testing,priority:high" \
  --milestone $MILESTONE_6 \
  --repo beaulewis1977/synthesis

# Issue: Performance Optimization
gh issue create \
  --title "Phase 14: Performance Optimization - Maintain <600ms Target" \
  --body "Ensure search performance stays under 600ms with all Phase 11-13 features active.

**Documentation:** `docs/phases/phase-14/02_PERFORMANCE_OPTIMIZATION.md`

**Acceptance Criteria:**
- [ ] Search response time <600ms (p95)
- [ ] Re-ranking adds <200ms overhead
- [ ] Code chunking doesn't slow ingestion
- [ ] Cost per search <$0.01
- [ ] Load testing with 20k files passes

**Effort:** 8-10 hours" \
  --label "phase-14,performance,priority:high" \
  --milestone $MILESTONE_6 \
  --repo beaulewis1977/synthesis

# Issue: UI Polish
gh issue create \
  --title "Phase 14: Frontend Polish - Visual Consistency & Mobile" \
  --body "Polish all Phase 11-13 UI additions for production quality.

**Documentation:** `docs/phases/phase-14/03_UI_UPDATES.md`

**Acceptance Criteria:**
- [ ] Mobile responsive (all new components)
- [ ] Consistent design language
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Loading states polished
- [ ] Error messages helpful
- [ ] Dark mode support (if applicable)

**Effort:** 6-8 hours" \
  --label "phase-14,frontend,priority:medium" \
  --milestone $MILESTONE_6 \
  --repo beaulewis1977/synthesis

# Issue: Documentation Updates
gh issue create \
  --title "Phase 14: Update Documentation for v2.0 Features" \
  --body "Update all docs to reflect Phase 11-13 features.

**Tasks:**
- [ ] Update README with new features
- [ ] Update API docs
- [ ] Add usage examples
- [ ] Update architecture diagrams
- [ ] Create upgrade guide (v1 → v2)

**Effort:** 4-6 hours" \
  --label "phase-14,documentation,priority:medium" \
  --milestone $MILESTONE_6 \
  --repo beaulewis1977/synthesis
```

#### Phase 15 Issues (Final Testing & Release)

```bash
# Issue: E2E Testing
gh issue create \
  --title "Phase 15: End-to-End Testing - Complete User Flows" \
  --body "Test complete user journeys with all v2.0 features.

**Documentation:** `docs/phases/phase-15/01_E2E_TESTING.md`

**Test Scenarios:**
- [ ] Upload → Ingest → Search → Synthesis
- [ ] Code search → Related files → Navigation
- [ ] Cost monitoring → Budget alerts
- [ ] Multi-source comparison with contradictions

**Effort:** 6-8 hours" \
  --label "phase-15,testing,priority:high" \
  --milestone $MILESTONE_6 \
  --repo beaulewis1977/synthesis

# Issue: Load Testing
gh issue create \
  --title "Phase 15: Load Testing - 20,000 Files Performance" \
  --body "Stress test system with full 20k file corpus.

**Documentation:** `docs/phases/phase-15/02_LOAD_TESTING.md`

**Acceptance Criteria:**
- [ ] 20,000 files ingested successfully
- [ ] Search remains <600ms at scale
- [ ] Memory usage stable
- [ ] No database performance issues
- [ ] Cost projections accurate

**Effort:** 4-6 hours" \
  --label "phase-15,performance,testing,priority:high" \
  --milestone $MILESTONE_6 \
  --repo beaulewis1977/synthesis

# Issue: v2.0.0 Release Preparation
gh issue create \
  --title "Phase 15: v2.0.0 Release Preparation & Checklist" \
  --body "Final checklist and release preparation for v2.0.0.

**Documentation:** `docs/phases/phase-15/04_ACCEPTANCE_CRITERIA.md`

**Release Checklist:**
- [ ] All tests passing
- [ ] Documentation complete
- [ ] CHANGELOG updated
- [ ] Version numbers bumped
- [ ] Docker images built
- [ ] Migration guide published
- [ ] Tag v2.0.0 created

**Effort:** 2-4 hours" \
  --label "phase-15,release,priority:high" \
  --milestone $MILESTONE_6 \
  --repo beaulewis1977/synthesis
```

---


### Step 10: Create Phase 14-15 Documentation (30-45 minutes)

#### Phase 14: Integration & Polish

**Create:** `docs/phases/phase-14/`

**Files to create:**
1. `00_PHASE_14_OVERVIEW.md` - Goals, metrics, integration points
2. `01_INTEGRATION_TESTING.md` - Test all phases working together
3. `02_PERFORMANCE_OPTIMIZATION.md` - Ensure <600ms with all features
4. `03_UI_UPDATES.md` - Expose new features in frontend
5. `04_BUILD_PLAN.md` - 2-3 day schedule
6. `05_ACCEPTANCE_CRITERIA.md` - Production readiness checklist

**Key content:**
- Integration testing (Phases 11-13 working together)
- Performance benchmarks (20k files with all features)
- UI updates (show trust scores, related files, cost dashboard)
- Bug fixes from complex interactions
- Documentation updates

#### Phase 15: Final Testing & Buffer

**Create:** `docs/phases/phase-15/`

**Files to create:**
1. `00_PHASE_15_OVERVIEW.md` - Final testing goals
2. `01_E2E_TESTING.md` - End-to-end test scenarios
3. `02_LOAD_TESTING.md` - 20k files stress testing
4. `03_BUILD_PLAN.md` - 1-2 day schedule
5. `04_ACCEPTANCE_CRITERIA.md` - v2.0.0 release checklist

**Key content:**
- End-to-end testing
- Load testing (20,000 files)
- Final bug fixes
- Buffer time
- v2.0.0 tagging checklist

---


### Step 11: Update Root Documentation (5 minutes)

**Files to check and update:**

1. `README.md` (if it mentions phases)
2. `CLAUDE.md` (if it mentions phases)
3. `agent-setup-instructions.md` (if it mentions phases)
4. Any other root-level docs referencing phases

---


## ✅ Verification Checklist

After all changes, run these verification commands:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "=== 1. Check MVP phases unchanged ==="
grep -n "Phase 8: Polish" docs/09_BUILD_PLAN.md
grep -n "Phase 9: Final Testing" docs/09_BUILD_PLAN.md
# Expected: Both should show original MVP phase references

echo ""
echo "=== 2. Check old phase directories gone ==="
ls -d docs/phases/phase-{8,9,10} 2>&1
# Expected: "No such file or directory"

echo ""
echo "=== 3. Check new phase directories exist ==="
ls -d docs/phases/phase-{11,12,13,14,15}
# Expected: All 5 directories listed

echo ""
echo "=== 4. Check no stray Phase 8/9/10 in advanced docs ==="
grep -r "Phase 8:" docs/phases/phase-1[1-5]/ | grep -v "Phase 11" | grep -v "MVP" || echo "✅ Clean"
grep -r "Phase 9:" docs/phases/phase-1[1-5]/ | grep -v "Phase 12" | grep -v "MVP" || echo "✅ Clean"
grep -r "Phase 10:" docs/phases/phase-1[1-5]/ | grep -v "Phase 13" || echo "✅ Clean"

echo ""
echo "=== 5. Check summary files renamed ==="
ls -1 docs/phases/PHASES_*.md
# Expected: PHASES_11-15_SUMMARY.md (NOT PHASES_8-10_SUMMARY.md)

echo ""
echo "=== 6. Check file counts ==="
find docs/phases/phase-11 -name "*.md" | wc -l  # Should be 9
find docs/phases/phase-12 -name "*.md" | wc -l  # Should be 8
find docs/phases/phase-13 -name "*.md" | wc -l  # Should be 6
find docs/phases/phase-14 -name "*.md" | wc -l  # Should be 6
find docs/phases/phase-15 -name "*.md" | wc -l  # Should be 5

echo ""
echo "=== 7. Check cross-references ==="
grep -r "Phase 11" docs/phases/phase-12/ | head -3
# Expected: Should show "Prerequisites: Phase 11" references

grep -r "Phase 12" docs/phases/phase-13/ | head -3
# Expected: Should show "Prerequisites: Phase 11 & 12" references

echo ""
echo "=== 8. Check GitHub milestones created ==="
gh api repos/beaulewis1977/synthesis/milestones --jq '.[] | select(.number >= 5) | "\(.number): \(.title)''
# Expected: 
# 5: Phase 11-13: Advanced RAG Features
# 6: Phase 14-15: Integration & v2.0

echo ""
echo "=== 9. Check GitHub issues updated ==="
gh issue view 60 --json title --jq '.title' --repo beaulewis1977/synthesis
# Expected: "Phase 11: Implement Hybrid Search..."

gh issue view 60 --json labels --jq '.labels[] | select(.name | startswith("phase-")) | .name' --repo beaulewis1977/synthesis
# Expected: "phase-11" (not "phase-8")

echo ""
echo "=== 10. Check issues assigned to milestones ==="
gh issue list --milestone 5 --repo beaulewis1977/synthesis --json number --jq '.[].number'
# Expected: 60, 61, 62, 63, 64, 65

echo ""
echo "=== 11. Check new labels exist ==="
gh label list --repo beaulewis1977/synthesis --json name --jq '.[] | select(.name | startswith("phase-1")) | .name' | sort
# Expected: phase-1, phase-10, phase-11, phase-12, phase-13, phase-14, phase-15, phase-2, etc.
```

---


## 📝 Post-Renumbering Tasks

### 1. Commit All Changes

```bash
git add .
git commit -m "docs: renumber advanced phases 8-10 to 11-15

- Rename phase-8 → phase-11 (Hybrid Search)
- Rename phase-9 → phase-12 (Re-ranking)
- Rename phase-10 → phase-13 (Code Intelligence)
- Add phase-14 (Integration & Polish)
- Add phase-15 (Final Testing)
- Create GitHub milestones 5-6
- Update GitHub issues #60-65
- Create Phase 14-15 GitHub issues

This resolves numbering conflict with MVP Phase 8-9.

BREAKING CHANGE: All references to advanced Phase 8-10 now Phase 11-13"
```

### 2. Verify GitHub State

**Check everything is correct:**
```bash
# List all milestones
gh api repos/beaulewis1977/synthesis/milestones --jq '.[] | "\(.number): \(.title) (open: \(.open_issues))''

# List Phase 11-13 issues
gh issue list --milestone 5 --repo beaulewis1977/synthesis

# List Phase 14-15 issues
gh issue list --milestone 6 --repo beaulewis1977/synthesis
```

### 3. Update README Roadmap

Ensure main README.md shows clear v1.0.0 vs v2.0.0 timeline:

```markdown
## Roadmap

### v1.0.0 - MVP (COMPLETE ✅)
- Phase 1-7: Core features
- Phase 8: Polish + Documentation
- Phase 9: Final Testing

### v2.0.0 - Enhanced RAG (IN PROGRESS 🔧)
- Phase 11: Hybrid Search ← Currently implementing
- Phase 12: Re-ranking & Synthesis
- Phase 13: Code Intelligence
- Phase 14: Integration & Polish
- Phase 15: Final Testing
```

### 4. Notify Team/Agents (if applicable)

If working with other developers or agents:
- Send notification about renumbering
- Update any agent prompts to use new phase numbers
- Update project management tools

---


## 🚨 Rollback Plan

If something goes wrong during renumbering:

```bash
# 1. Abort current changes
git reset --hard HEAD

# 2. Return to backup
git checkout backup/pre-phase-renumbering

# 3. Review what went wrong
git diff main backup/pre-phase-renumbering

# 4. Fix issue and retry
```

---


## 📊 Summary

**What changes:**
- Directory names: `phase-8/9/10` → `phase-11/12/13`
- All file contents in those directories
- Summary documents (PHASES_8-10 → PHASES_11-15)
- GitHub issues referencing advanced phases
- Cross-references between phase docs

**What does NOT change:**
- `docs/09_BUILD_PLAN.md` - MVP Phase 8-9 stays
- `docs/14_GITHUB_ISSUES.md` - MVP references stay
- `docs/15_AGENT_PROMPTS.md` - MVP references stay
- Any existing implementation code (already uses correct structure)

**Time estimate:** 30-45 minutes for renumbering + 30-45 minutes for Phase 14-15 creation = **1-1.5 hours total**

---


## ✅ When to Execute

**Execute this plan when:**
1. ✅ Phase 11 (current "Phase 8") implementation is COMPLETE
2. ✅ Phase 11 is tested and verified working
3. ✅ You've tagged a checkpoint (e.g., v1.1.0)
4. ✅ You're ready to proceed to Phase 12 (Re-ranking)

**DO NOT execute until you explicitly say: "Ready to renumber phases"**

---

**Created:** 2025-10-13  
**Status:** DRAFT - Awaiting Phase 8 completion  
**Next Step:** Complete Phase 8 (Hybrid Search) implementation
