# Git Workflow & Branch Strategy
**Version:** 1.0  
**Last Updated:** October 6, 2025

---

## 🌿 Branch Strategy

### Branch Structure

```
main (protected)
  └── develop (protected)
        ├── feature/phase-1-database
        ├── feature/phase-2-ingestion
        ├── feature/phase-3-agent-tools
        └── feature/phase-4-web-crawling
```

### Branch Purposes

#### `main`
- **Purpose:** Production-ready code
- **Protection:** High
- **Status:** Empty until MVP complete
- **Deployment:** Production (future)
- **Merges from:** `develop` only
- **Requires:** All reviews passed, all tests green
- **Tags:** Version releases (v1.0.0, v1.1.0, etc.)

#### `develop`
- **Purpose:** Integration branch for all features
- **Protection:** Medium
- **Status:** Active development
- **Deployment:** Staging/testing environment
- **Merges from:** `feature/*` branches
- **Requires:** Phase summary + reviews passed

#### `feature/*`
- **Purpose:** Individual phase/feature development
- **Protection:** None
- **Naming:** `feature/phase-X-description`
- **Lifespan:** Created → Merged → Deleted
- **Merges to:** `develop`

---

## 📝 Branch Naming Convention

### Feature Branches

**Pattern:**
```
feature/phase-<number>-<short-description>
```

**Examples:**
- `feature/phase-1-database-setup`
- `feature/phase-2-ingestion-pipeline`
- `feature/phase-3-agent-tools`
- `feature/phase-4-web-crawling`
- `feature/phase-5-ui`
- `feature/phase-6-mcp-server`

### Bugfix Branches

**Pattern:**
```
bugfix/<issue-number>-<short-description>
```

**Examples:**
- `bugfix/42-fix-embedding-timeout`
- `bugfix/73-cors-configuration`

### Hotfix Branches (Emergency only)

**Pattern:**
```
hotfix/<version>-<issue>
```

**Examples:**
- `hotfix/1.0.1-security-patch`
- `hotfix/1.0.2-database-connection`

---

## 🔄 Development Workflow

### Daily Workflow

```bash
# 1. Start day - ensure you're on develop and up to date
git checkout develop
git pull origin develop

# 2. Create feature branch for new phase
git checkout -b feature/phase-X-description

# 3. Work on feature
# ... code, test, commit ...

# 4. Keep branch updated with develop (if long-lived)
git checkout develop
git pull origin develop
git checkout feature/phase-X-description
git rebase develop

# 5. Phase complete - push branch
git push origin feature/phase-X-description

# 6. Create PR on GitHub
# (via GitHub UI or gh CLI)

# 7. After PR merged - cleanup
git checkout develop
git pull origin develop
git branch -d feature/phase-X-description
```

---

## 💬 Commit Message Format

### Conventional Commits

**Format:**
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- **feat** - New feature
- **fix** - Bug fix
- **docs** - Documentation only
- **style** - Formatting, missing semicolons, etc (no code change)
- **refactor** - Refactoring production code
- **test** - Adding tests, refactoring tests
- **chore** - Updating build tasks, package manager configs, etc

### Scopes

- **pipeline** - Ingestion pipeline
- **agent** - Agent tools/orchestration
- **database** - Database schema/queries
- **api** - Backend API
- **ui** - Frontend
- **mcp** - MCP server
- **docker** - Docker configuration
- **ci** - CI/CD configuration

### Examples

```bash
# Feature
feat(pipeline): implement PDF extraction with pdf-parse
feat(agent): add search_rag tool with vector search
feat(ui): create chat interface with message history

# Fix
fix(database): correct HNSW index creation parameters
fix(api): handle multipart upload errors properly
fix(agent): prevent infinite tool calling loop

# Documentation
docs(api): update endpoint documentation with examples
docs(readme): add quick start guide

# Refactor
refactor(pipeline): extract chunking logic to separate module
refactor(ui): consolidate API client hooks

# Test
test(pipeline): add unit tests for chunking function
test(agent): add integration tests for tool execution

# Chore
chore(deps): upgrade @anthropic-ai/agent-sdk to 0.4.1
chore(docker): update ollama image to latest
```

### Multi-line Commits

```bash
feat(agent): add autonomous web crawling capability

Implements fetch_web_content tool using Playwright to
crawl documentation sites. Supports single-page and
multi-page crawling with configurable depth.

- Add Playwright dependency
- Create scraper service
- Implement HTML to Markdown conversion
- Add rate limiting for polite crawling

Closes #42
```

---

## 🔀 Pull Request Process

### Creating a PR

1. **Ensure branch is ready:**
   ```bash
   # All tests pass
   pnpm test
   
   # No linting errors
   pnpm lint
   
   # Build succeeds
   pnpm build
   ```

2. **Push to GitHub:**
   ```bash
   git push origin feature/phase-X-description
   ```

3. **Create PR via GitHub UI or CLI:**
   ```bash
   # Using GitHub CLI
   gh pr create \
     --base develop \
     --title "Phase X: Description" \
     --body-file docs/summaries/phase-X-summary.md
   ```

### PR Template

```markdown
## Phase Summary
[Link to phase summary in docs/summaries/]

## Description
Brief overview of changes in this PR

## Type of Change
- [ ] New feature (non-breaking change)
- [ ] Bug fix (non-breaking change)
- [ ] Breaking change
- [ ] Documentation update
- [ ] Refactoring

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review performed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All tests passing
- [ ] Phase summary complete
- [ ] Review agent approved

## Testing
How was this tested?

## Screenshots (if applicable)
[Add screenshots]

## Related Issues
Closes #XXX
Relates to #YYY
```

### PR Labels

Apply these labels:

- **Phase:** `phase-1`, `phase-2`, etc.
- **Type:** `feature`, `bugfix`, `docs`, `refactor`
- **Status:** `needs-review`, `changes-requested`, `approved`
- **Priority:** `low`, `medium`, `high`, `critical`
- **Size:** `xs`, `small`, `medium`, `large`, `xl`

---

## 👀 Code Review Process

### Pre-Review Checklist

Before requesting review:

- [ ] Branch is up to date with develop
- [ ] All tests pass locally
- [ ] Linting passes
- [ ] Build succeeds
- [ ] Phase summary complete
- [ ] Self-review done
- [ ] PR description complete

### Review Stages

#### Stage 1: Review Agent
- Reviews phase summary
- Reviews code changes
- Checks acceptance criteria
- Posts feedback as PR comment
- Approves or requests changes

#### Stage 2: CodeRabbit (Automated)
- Runs automatically on PR creation
- Checks code quality
- Identifies bugs/security issues
- Posts inline comments
- Approves or requests changes

#### Stage 3: Final Approval
- Both reviews must approve
- All conversations resolved
- CI/CD checks must pass
- Then ready to merge

---

## 🔐 Branch Protection Rules

### `main` Branch

```yaml
Protection Rules:
  - Require pull request before merging: true
  - Require approvals: 2
  - Dismiss stale approvals: true
  - Require review from Code Owners: true
  - Require status checks to pass: true
    - CI build
    - All tests
    - Linting
    - CodeRabbit
  - Require branches to be up to date: true
  - Require conversation resolution: true
  - Require signed commits: false (optional)
  - Include administrators: true
  - Restrict pushes: true
    - Only allow: develop branch
  - Allow force pushes: false
  - Allow deletions: false
```

### `develop` Branch

```yaml
Protection Rules:
  - Require pull request before merging: true
  - Require approvals: 1
  - Require status checks to pass: true
    - CI build
    - All tests
    - Linting
  - Require branches to be up to date: true
  - Require conversation resolution: true
  - Allow force pushes: false
  - Allow deletions: false
```

---

## 🚀 Merging Strategy

### Squash and Merge (Recommended)

**When:** Most feature branches

**Why:**
- Clean commit history on develop
- Easy to revert entire features
- Simplifies git log

**How:**
```bash
# GitHub will squash automatically when merging PR
# Edit squash message to be descriptive
```

### Rebase and Merge

**When:** Small, atomic commits that tell a story

**Why:**
- Preserves commit history
- Good for understanding feature evolution

**Avoid unless:** Commits are well-crafted and meaningful

---

## 🏷️ Tagging and Releases

### Version Scheme

Follow Semantic Versioning: `MAJOR.MINOR.PATCH`

- **MAJOR:** Breaking changes
- **MINOR:** New features (backward compatible)
- **PATCH:** Bug fixes

### Creating a Release

```bash
# 1. Ensure develop is stable
git checkout develop
pnpm test
pnpm build

# 2. Create release branch
git checkout -b release/1.0.0

# 3. Update version in package.json
# ... edit files ...

# 4. Commit version bump
git commit -am "chore(release): bump version to 1.0.0"

# 5. Merge to main
git checkout main
git merge release/1.0.0

# 6. Tag the release
git tag -a v1.0.0 -m "Release v1.0.0 - MVP Launch"
git push origin main --tags

# 7. Merge back to develop
git checkout develop
git merge main

# 8. Delete release branch
git branch -d release/1.0.0
```

---

## ⚡ Quick Commands Reference

### Starting Work

```bash
# Update and create feature branch
git checkout develop && git pull
git checkout -b feature/phase-X-description
```

### During Work

```bash
# Stage and commit
git add .
git commit -m "feat(scope): description"

# Sync with develop
git fetch origin develop
git rebase origin/develop
```

### Finishing Work

```bash
# Push and create PR
git push origin feature/phase-X-description
gh pr create --base develop
```

### After Merge

```bash
# Cleanup
git checkout develop && git pull
git branch -d feature/phase-X-description
git remote prune origin
```

### Emergency Hotfix

```bash
# Create from main
git checkout main
git pull
git checkout -b hotfix/1.0.1-fix-description

# Fix, test, commit
git commit -am "fix: critical issue description"

# Push and create emergency PR
git push origin hotfix/1.0.1-fix-description
gh pr create --base main --label critical
```

---

## 🔍 Git Hooks

### Pre-commit Hook

**File:** `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run linting
pnpm lint-staged

# Run type checking
pnpm type-check

# Exit with error if any check fails
```

### Pre-push Hook

**File:** `.husky/pre-push`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run tests before pushing
pnpm test

# Build to ensure no build errors
pnpm build
```

### Commit Message Hook

**File:** `.husky/commit-msg`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Validate commit message format
npx --no-install commitlint --edit $1
```

---

## ✅ Git Workflow Checklist

### Starting New Phase

- [ ] On develop branch
- [ ] Pulled latest changes
- [ ] Created feature branch with correct naming
- [ ] First commit is phase start

### During Phase

- [ ] Committing frequently (logical units)
- [ ] Using conventional commit format
- [ ] Tests passing before each commit
- [ ] Keeping branch updated with develop

### Finishing Phase

- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Phase summary created
- [ ] Self-review complete
- [ ] Branch pushed to origin
- [ ] PR created with template

### After PR Merged

- [ ] Switched back to develop
- [ ] Pulled latest changes
- [ ] Deleted local feature branch
- [ ] Cleaned remote branches

---

**Follow this workflow for clean, professional git history!**
