# Phase Documentation Update Plan

**Date:** 2025-10-13  
**Purpose:** Fix phase numbering in recovered documentation files

---

## 🎯 Problem

Documentation files for old Phase 9 and Phase 10 were recovered from dangling objects, but they still reference the **old phase numbers** (9, 10) instead of the new numbers (12, 13).

**Mapping:**
- Old Phase 9 → New Phase 12 (Re-ranking & Synthesis)
- Old Phase 10 → New Phase 13 (Code Intelligence)

---

## 📂 Current File Structure

### Phase 9 Files (Should be Phase 12)
Location: `docs/phases/phase-9/`

```
✅ 02_PROVIDER_COMPARISON.md       - Needs Phase 9 → 12
✅ 03_SYNTHESIS_ENGINE.md           - Needs Phase 9 → 12
✅ 04_CONTRADICTION_DETECTION.md    - Needs Phase 9 → 12
✅ 05_COST_MONITORING.md            - Needs Phase 9 → 12
```

**Missing from phase-9:** Overview (00), Reranking Architecture (01), Build Plan (06), Acceptance Criteria (07)

### Phase 10 Files (Should be Phase 13)
Location: `docs/phases/phase-10/`

```
✅ 02_DART_AST_PARSING.md           - Needs Phase 10 → 13
✅ 03_FILE_RELATIONSHIPS.md         - Needs Phase 10 → 13
⚠️  09_FRONTEND_UPDATES.md          - DUPLICATE (already in phase-13 as 06)
```

**Missing from phase-10:** Overview (00), Code Chunking Architecture (01), Build Plan (04), Acceptance Criteria (05)

---

## 📋 Phase-Specific Changes Needed

### Phase 9 → Phase 12 Updates

#### File: `02_PROVIDER_COMPARISON.md`
**Line-by-line changes:**
```
Line 1:  # Phase 9: Re-ranking Provider Comparison
         → # Phase 12: Re-ranking Provider Comparison

Line 9:  Phase 9 supports two re-ranking providers:
         → Phase 12 supports two re-ranking providers:
```

#### File: `03_SYNTHESIS_ENGINE.md`
**Changes:**
```
Line 1:  # Phase 9: Document Synthesis Engine
         → # Phase 12: Document Synthesis Engine
```

#### File: `04_CONTRADICTION_DETECTION.md`
**Changes:**
```
Line 1:  # Phase 9: Contradiction Detection
         → # Phase 12: Contradiction Detection
```

#### File: `05_COST_MONITORING.md`
**Changes:**
```
Line 1:  # Phase 9: Cost Monitoring & Budget Control
         → # Phase 12: Cost Monitoring & Budget Control
```

---

### Phase 10 → Phase 13 Updates

#### File: `02_DART_AST_PARSING.md`
**Changes:**
```
Line 1:  # Phase 10: Dart AST Parsing
         → # Phase 13: Dart AST Parsing
```

#### File: `03_FILE_RELATIONSHIPS.md`
**Changes:**
```
Line 1:  # Phase 10: File Relationships
         → # Phase 13: File Relationships

Line 597: **Phase 10 Documentation Complete!** 🎉
          → **Phase 13 Documentation Complete!** 🎉
```

#### File: `09_FRONTEND_UPDATES.md` ⚠️ DUPLICATE
**Action:** DELETE (already exists as phase-13/06_FRONTEND_UPDATES.md)

**Changes in this file IF kept:**
```
Line 1:   # Phase 10: Frontend Updates
          → # Phase 13: Frontend Updates

Line 9:   Phase 10 adds **code intelligence**
          → Phase 13 adds **code intelligence**

Line 22:  ### Before Phase 10:
          → ### Before Phase 13:

Line 29:  ### After Phase 10:
          → ### After Phase 13:

Line 361: defer to Phase 14
          → (keep as-is, Phase 14 is correct)

Line 421: After Phase 10 UI:
          → After Phase 13 UI:

Line 430: **Phase 10 Complete!**
          → **Phase 13 Complete!**

Line 434: Integration with Phase 9
          → Integration with Phase 12

Line 448: Phase 14 will add...
          → (keep as-is, Phase 14 is correct)
```

---

## 🔄 File Movement Plan

### Step 1: Move Phase 9 docs to Phase 12
```bash
# Move recovered docs to correct phase directory
mv docs/phases/phase-9/02_PROVIDER_COMPARISON.md \
   docs/phases/phase-12/02_PROVIDER_COMPARISON.md

mv docs/phases/phase-9/03_SYNTHESIS_ENGINE.md \
   docs/phases/phase-12/03_SYNTHESIS_ENGINE.md

mv docs/phases/phase-9/04_CONTRADICTION_DETECTION.md \
   docs/phases/phase-12/04_CONTRADICTION_DETECTION.md

mv docs/phases/phase-9/05_COST_MONITORING.md \
   docs/phases/phase-12/05_COST_MONITORING.md
```

**Result:** phase-12 will have files 00, 01, 02, 03, 04, 05, 06, 07, 08

### Step 2: Move Phase 10 docs to Phase 13
```bash
# Move recovered docs to correct phase directory
mv docs/phases/phase-10/02_DART_AST_PARSING.md \
   docs/phases/phase-13/02_DART_AST_PARSING.md

mv docs/phases/phase-10/03_FILE_RELATIONSHIPS.md \
   docs/phases/phase-13/03_FILE_RELATIONSHIPS.md

# DELETE duplicate frontend doc
rm docs/phases/phase-10/09_FRONTEND_UPDATES.md
```

**Result:** phase-13 will have files 00, 01, 02, 03, 04, 05, 06

### Step 3: Cleanup empty directories
```bash
# Remove old phase-9 and phase-10 directories
rmdir docs/phases/phase-9
rmdir docs/phases/phase-10
```

---

## 🔍 Content Updates (After Moving)

### Phase 12 Files (in docs/phases/phase-12/)

#### `02_PROVIDER_COMPARISON.md`
```bash
# Replace "Phase 9" with "Phase 12"
sed -i 's/Phase 9/Phase 12/g' docs/phases/phase-12/02_PROVIDER_COMPARISON.md
```

#### `03_SYNTHESIS_ENGINE.md`
```bash
sed -i 's/Phase 9/Phase 12/g' docs/phases/phase-12/03_SYNTHESIS_ENGINE.md
```

#### `04_CONTRADICTION_DETECTION.md`
```bash
sed -i 's/Phase 9/Phase 12/g' docs/phases/phase-12/04_CONTRADICTION_DETECTION.md
```

#### `05_COST_MONITORING.md`
```bash
sed -i 's/Phase 9/Phase 12/g' docs/phases/phase-12/05_COST_MONITORING.md
```

---

### Phase 13 Files (in docs/phases/phase-13/)

#### `02_DART_AST_PARSING.md`
```bash
sed -i 's/Phase 10/Phase 13/g' docs/phases/phase-13/02_DART_AST_PARSING.md
```

#### `03_FILE_RELATIONSHIPS.md`
```bash
sed -i 's/Phase 10/Phase 13/g' docs/phases/phase-13/03_FILE_RELATIONSHIPS.md
```

---

## ✅ Verification Checklist

After all updates, verify:

### Phase 12 (docs/phases/phase-12/)
- [ ] All files present: 00, 01, 02, 03, 04, 05, 06, 07, 08
- [ ] No references to "Phase 9" in any file
- [ ] All cross-references use Phase 12
- [ ] File numbering sequential

### Phase 13 (docs/phases/phase-13/)
- [ ] All files present: 00, 01, 02, 03, 04, 05, 06
- [ ] No references to "Phase 10" in any file
- [ ] All cross-references use Phase 13
- [ ] File numbering sequential
- [ ] No duplicate 09_FRONTEND_UPDATES.md

### Cleanup
- [ ] Old phase-9 directory removed
- [ ] Old phase-10 directory removed
- [ ] Git status shows moves, not deletions + additions

---

## 🚀 Execution Order

1. **Move files** (Step 1-2 above)
2. **Update content** (Phase number replacements)
3. **Delete duplicates** (phase-10/09_FRONTEND_UPDATES.md)
4. **Cleanup directories** (remove phase-9, phase-10)
5. **Verify** (run grep to check no old numbers remain)
6. **Commit** (single atomic commit)

---

## 📊 Summary

**Files to move:** 6 files (4 from phase-9, 2 from phase-10)  
**Files to delete:** 1 file (duplicate frontend doc)  
**Text replacements:** ~10-15 instances of "Phase 9/10"  
**Directories to remove:** 2 (phase-9, phase-10)  

**Estimated time:** 10 minutes  
**Risk level:** Low (all moves, no data loss)

---

## 🔧 One-Liner Execution Script

```bash
# DO NOT RUN YET - This is the planned script

# Phase 9 → Phase 12
mv docs/phases/phase-9/02_PROVIDER_COMPARISON.md docs/phases/phase-12/
mv docs/phases/phase-9/03_SYNTHESIS_ENGINE.md docs/phases/phase-12/
mv docs/phases/phase-9/04_CONTRADICTION_DETECTION.md docs/phases/phase-12/
mv docs/phases/phase-9/05_COST_MONITORING.md docs/phases/phase-12/

# Phase 10 → Phase 13
mv docs/phases/phase-10/02_DART_AST_PARSING.md docs/phases/phase-13/
mv docs/phases/phase-10/03_FILE_RELATIONSHIPS.md docs/phases/phase-13/

# Delete duplicate
rm docs/phases/phase-10/09_FRONTEND_UPDATES.md

# Remove old directories
rmdir docs/phases/phase-9
rmdir docs/phases/phase-10

# Update content
find docs/phases/phase-12 -name "*.md" -exec sed -i 's/Phase 9/Phase 12/g' {} \;
find docs/phases/phase-13 -name "*.md" -exec sed -i 's/Phase 10/Phase 13/g' {} \;

# Verify
echo "=== Checking for old phase numbers ==="
grep -rn "Phase 9:" docs/phases/phase-12/ 2>/dev/null || echo "✓ No Phase 9 references"
grep -rn "Phase 10:" docs/phases/phase-13/ 2>/dev/null || echo "✓ No Phase 10 references"

echo "=== Phase 12 files ==="
ls -1 docs/phases/phase-12/

echo "=== Phase 13 files ==="
ls -1 docs/phases/phase-13/

echo "✅ Update complete!"
```

---

**Status:** READY TO EXECUTE  
**Approval needed:** YES  
**Next step:** User confirms, then execute the script
