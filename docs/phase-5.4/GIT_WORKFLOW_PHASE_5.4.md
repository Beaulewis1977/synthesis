# Git Workflow for Phase 5.4 - Quick Reference

## 🎯 Your Situation

**Current State:**
- You're on: `feature/phase-6-mcp-server` branch
- Phase 5 work is on: `feature/phase-5-ui` branch (remote)
- Phase 5.1, 5.2, 5.3 already committed there
- You need to add Phase 5.4 (upload) to complete it

**Goal:**
- Add upload functionality to `feature/phase-5-ui`
- Keep Phase 6 changes separate
- Eventually merge completed Phase 5 to `develop`

---

## 📋 Step-by-Step Git Workflow

### **Step 1: Stash or Commit Phase 6 Changes**

First, save your Phase 6 work:

```bash
# You're currently on feature/phase-6-mcp-server
# You have uncommitted changes (.env.example, etc)

# Option A: Stash them (if you want to keep working on Phase 6 later)
git stash push -m "WIP: Phase 6 env setup changes"

# Option B: Commit them (if they're done)
git add .env.example ENV_VARIABLES.md apps/server/package.json apps/server/src/index.ts pnpm-lock.yaml
git commit -m "chore(env): add .env.example and ENV_VARIABLES.md documentation"
git push origin feature/phase-6-mcp-server
```

**Recommendation: Use Option B (commit)** - Your .env work is complete and useful.

---

### **Step 2: Switch to Phase 5 Branch**

```bash
# Fetch latest from remote
git fetch origin

# Checkout the Phase 5 branch
git checkout feature/phase-5-ui

# Pull latest changes
git pull origin feature/phase-5-ui

# Verify you're on the right branch
git status
# Should say: "On branch feature/phase-5-ui"
```

---

### **Step 3: Do the Phase 5.4 Work**

Now the agent implements upload functionality:
- Creates `UploadZone.tsx`
- Creates `UploadPage.tsx`
- Modifies `App.tsx`, `CollectionView.tsx`, `api.ts`, `types/index.ts`

---

### **Step 4: Commit Phase 5.4 Changes**

```bash
# Check what changed
git status

# Add the new files
git add apps/web/src/components/UploadZone.tsx
git add apps/web/src/pages/UploadPage.tsx

# Add modified files
git add apps/web/src/App.tsx
git add apps/web/src/pages/CollectionView.tsx
git add apps/web/src/api.ts
git add apps/web/src/types/index.ts

# Also add the phase summary
git add PHASE_5.4_SUMMARY.md

# Commit with conventional commit format
git commit -m "feat(ui): complete phase 5.4 - upload functionality

- Add UploadZone component with drag & drop support
- Add UploadPage for document uploads
- Wire upload button in CollectionView to navigate to upload page
- Add uploadDocument method to API client with FormData
- Add UploadResponse type definitions
- Add file validation and progress tracking
- Handle error states and success feedback

This completes the missing upload functionality from Phase 5.3
that was originally in Story 5.3 (GitHub issue) but was skipped.

Fixes: Upload button now functional
Closes: Phase 5 upload requirements"
```

---

### **Step 5: Push to Remote**

```bash
# Push to the feature/phase-5-ui branch
git push origin feature/phase-5-ui
```

---

### **Step 6: Handle the Pull Request**

**Check if PR already exists:**

```bash
# Check GitHub for existing PR
gh pr list --base develop
```

**Scenario A: PR #55 already exists for Phase 5**

The PR exists and was already merged (you can see commit `8584d89` in main history).

**So Phase 5 is ALREADY MERGED!** This means:

1. **You need to check `develop` branch:**
   ```bash
   git checkout develop
   git pull origin develop
   git log --oneline -10
   ```

2. **If Phase 5 is in develop, work from there:**
   ```bash
   # Create new branch from develop
   git checkout -b feature/phase-5.4-upload develop
   
   # Do your Phase 5.4 work
   # Commit
   # Push
   
   git push origin feature/phase-5.4-upload
   
   # Create new PR
   gh pr create --base develop --head feature/phase-5.4-upload \
     --title "feat(ui): Add upload functionality to complete Phase 5" \
     --body "## What's This?
   
   Phase 5.3 was merged but was incomplete - it only delivered the chat 
   interface and skipped the upload functionality entirely.
   
   This PR completes Phase 5 by adding:
   - UploadZone component (drag & drop)
   - UploadPage for document uploads
   - Wired upload button in CollectionView
   - File validation and progress tracking
   
   ## Testing
   - Tested file upload flow end-to-end
   - Verified drag & drop works
   - Tested error handling
   - All TypeScript types correct
   
   ## Related
   - Completes Story 5.3 from GitHub issues (docs/14_GITHUB_ISSUES.md)
   - Implements requirements from docs/09_BUILD_PLAN.md Day 5
   - Follows UI spec from docs/08_UI_SPEC.md"
   ```

**Scenario B: PR doesn't exist yet**

```bash
# Create new PR
gh pr create --base develop --head feature/phase-5-ui \
  --title "feat(ui): Complete Phase 5 - Frontend UI with Upload" \
  --body "## Summary
  
Completes Phase 5 (5.1-5.4) with full frontend implementation.

## What's Included
- Phase 5.1: UI setup and layout ✅
- Phase 5.2: Dashboard and collections ✅  
- Phase 5.3: Chat interface ✅
- Phase 5.4: Upload functionality ✅ (NEW)

## Phase 5.4 Details
Adds missing upload functionality that was skipped in Phase 5.3:
- UploadZone component with drag & drop
- UploadPage for document management
- Wire upload button to navigation
- File validation and progress tracking

## Testing
All features tested manually and working.

## Documentation
- Phase summaries: PHASE_5.1-5.4_SUMMARY.md files
- Follows build plan: docs/09_BUILD_PLAN.md
- Follows UI spec: docs/08_UI_SPEC.md"
```

---

### **Step 7: Switch Back to Phase 6 (After Phase 5.4 is done)**

```bash
# Go back to your Phase 6 work
git checkout feature/phase-6-mcp-server

# If you stashed changes earlier, restore them
git stash pop

# Continue Phase 6 work
```

---

## 🎯 Summary: Your Git Commands

Here's the complete sequence:

```bash
# 1. Save Phase 6 work
git add .env.example ENV_VARIABLES.md apps/server/package.json apps/server/src/index.ts pnpm-lock.yaml
git commit -m "chore(env): add comprehensive environment documentation"
git push origin feature/phase-6-mcp-server

# 2. Switch to Phase 5 work  
git fetch origin
git checkout develop  # Check if Phase 5 is already merged here
git pull origin develop

# 3. Create Phase 5.4 branch from develop (since Phase 5 was already merged)
git checkout -b feature/phase-5.4-upload develop

# 4. [Agent does work here]

# 5. Commit Phase 5.4
git add apps/web/src/components/UploadZone.tsx apps/web/src/pages/UploadPage.tsx
git add apps/web/src/App.tsx apps/web/src/pages/CollectionView.tsx
git add apps/web/src/lib/api.ts apps/web/src/types/index.ts
git add PHASE_5.4_SUMMARY.md
git commit -m "feat(ui): complete phase 5.4 - upload functionality

- Add UploadZone component with drag & drop
- Add UploadPage for document uploads
- Wire upload button in CollectionView
- Add API client upload support
- Add file validation and progress

Completes Phase 5 upload requirements that were skipped"

# 6. Push and create PR
git push origin feature/phase-5.4-upload
gh pr create --base develop --head feature/phase-5.4-upload

# 7. Return to Phase 6
git checkout feature/phase-6-mcp-server
```

---

## ⚠️ Important Notes

1. **Phase 5 might already be merged** - Check `develop` first!
2. **Don't merge Phase 6 stuff** into Phase 5 branch
3. **Use conventional commits** format
4. **Create phase summary** before PR
5. **Test thoroughly** before committing

---

## 🆘 If Things Go Wrong

**"I'm on wrong branch!"**
```bash
git stash
git checkout [correct-branch]
git stash pop
```

**"I committed to wrong branch!"**
```bash
# Don't panic, just cherry-pick to correct branch
git log  # Note the commit hash
git checkout [correct-branch]
git cherry-pick [commit-hash]
```

**"I have merge conflicts!"**
```bash
# Resolve conflicts in files
git add [resolved-files]
git commit
```

---

**Questions? Ask before proceeding!**
