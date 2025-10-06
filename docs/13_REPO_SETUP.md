# GitHub Repository Setup Guide
**Version:** 1.0  
**Last Updated:** October 6, 2025

---

## 🎯 Repository Information

**Location:** `/home/kngpnn/dev/synthesis`  
**GitHub:** `https://github.com/<your-username>/synthesis`  
**Purpose:** Autonomous RAG system with Claude Agent SDK

---

## 📋 Step-by-Step Setup

### Step 1: Create Local Repository

```bash
# Navigate to dev directory
cd /home/kngpnn/dev

# Create project directory
mkdir synthesis
cd synthesis

# Initialize git
git init
git branch -M main

# Copy planning docs
cp -r /path/to/NEW-RAG-PLAN docs/

# Create initial project structure
mkdir -p apps/server apps/web apps/mcp
mkdir -p packages/db packages/shared
mkdir -p .github/workflows

# Create README
cat > README.md << 'EOF'
# Synthesis RAG

Autonomous RAG system powered by Claude Agent SDK for multi-project documentation management.

## Quick Start

See `docs/10_ENV_SETUP.md` for setup instructions.

## Documentation

- [Start Here](docs/00_START_HERE.md)
- [Build Plan](docs/09_BUILD_PLAN.md)
- [Agent Workflow](docs/agents.md)

## Status

🚧 Under active development

EOF

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
*.lcov

# Build
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Storage
storage/
*.db
*.sqlite

# Docker
.dockerignore

# Misc
.turbo/
.cache/
EOF

# Initial commit
git add .
git commit -m "chore: initial commit with project structure"
```

---

### Step 2: Create GitHub Repository

#### Option A: Using GitHub CLI

```bash
# Login to GitHub (if not already)
gh auth login

# Create repository
gh repo create synthesis \
  --public \
  --description "Autonomous RAG system with Claude Agent SDK" \
  --homepage "https://github.com/<your-username>/synthesis"

# Push to GitHub
git remote add origin https://github.com/<your-username>/synthesis.git
git push -u origin main
```

#### Option B: Using GitHub Web UI

1. Go to https://github.com/new
2. Repository name: `synthesis`
3. Description: `Autonomous RAG system with Claude Agent SDK`
4. Visibility: **Public** (or Private if preferred)
5. ✅ Add a README file: **NO** (we have one)
6. ✅ Add .gitignore: **NO** (we have one)
7. ✅ Choose a license: **MIT** (or your choice)
8. Click **Create repository**
9. Follow instructions to push existing repository:
   ```bash
   git remote add origin https://github.com/<your-username>/synthesis.git
   git push -u origin main
   ```

---

### Step 3: Create develop Branch

```bash
# Create and push develop branch
git checkout -b develop
git push -u origin develop

# Set develop as default branch on GitHub
gh repo edit --default-branch develop

# Or via GitHub UI:
# Settings → Branches → Default branch → develop
```

---

### Step 4: Configure Branch Protection

#### Protect `main` Branch

```bash
gh api repos/<your-username>/synthesis/branches/main/protection \
  --method PUT \
  --field required_pull_request_reviews[dismiss_stale_reviews]=true \
  --field required_pull_request_reviews[require_code_owner_reviews]=true \
  --field required_pull_request_reviews[required_approving_review_count]=2 \
  --field required_status_checks[strict]=true \
  --field required_status_checks[contexts][]=ci \
  --field required_status_checks[contexts][]=coderabbit \
  --field enforce_admins=true \
  --field required_conversation_resolution[enabled]=true \
  --field restrictions=null
```

#### Protect `develop` Branch

```bash
gh api repos/<your-username>/synthesis/branches/develop/protection \
  --method PUT \
  --field required_pull_request_reviews[dismiss_stale_reviews]=true \
  --field required_pull_request_reviews[required_approving_review_count]=1 \
  --field required_status_checks[strict]=true \
  --field required_status_checks[contexts][]=ci \
  --field enforce_admins=false \
  --field required_conversation_resolution[enabled]=true
```

#### Or via GitHub UI

**For `main`:**
1. Settings → Branches → Add branch protection rule
2. Branch name pattern: `main`
3. ✅ Require a pull request before merging
   - ✅ Require approvals: 2
   - ✅ Dismiss stale reviews
   - ✅ Require review from Code Owners
4. ✅ Require status checks to pass
   - ✅ Require branches to be up to date
   - Add: `ci`, `lint`, `test`, `build`, `coderabbit`
5. ✅ Require conversation resolution
6. ✅ Include administrators
7. ✅ Restrict who can push (only develop branch)
8. Save changes

**For `develop`:**
1. Settings → Branches → Add branch protection rule
2. Branch name pattern: `develop`
3. ✅ Require a pull request before merging
   - ✅ Require approvals: 1
4. ✅ Require status checks to pass
   - ✅ Require branches to be up to date
   - Add: `ci`, `lint`, `test`, `build`
5. ✅ Require conversation resolution
6. Save changes

---

### Step 5: Add Repository Secrets

```bash
# Add secrets via GitHub CLI
gh secret set ANTHROPIC_API_KEY --body "sk-ant-..."
gh secret set DOCKER_USERNAME --body "your-username"
gh secret set DOCKER_PASSWORD --body "your-token"

# Or via GitHub UI:
# Settings → Secrets and variables → Actions → New repository secret
```

**Required secrets:**
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `DOCKER_USERNAME` - Docker Hub username (for CD)
- `DOCKER_PASSWORD` - Docker Hub access token (for CD)

**Optional secrets (for deployment):**
- `STAGING_HOST`
- `STAGING_USER`
- `STAGING_SSH_KEY`
- `PROD_HOST`
- `PROD_USER`
- `PROD_SSH_KEY`
- `CODECOV_TOKEN`

---

### Step 6: Add Repository Labels

```bash
# Create phase labels
for i in {1..9}; do
  gh label create "phase-$i" --color "0052CC" --description "Phase $i work"
done

# Create type labels
gh label create "feature" --color "1D76DB" --description "New feature"
gh label create "bugfix" --color "D73A4A" --description "Bug fix"
gh label create "docs" --color "0075CA" --description "Documentation"
gh label create "refactor" --color "FBCA04" --description "Code refactoring"
gh label create "test" --color "BFD4F2" --description "Testing"

# Create status labels
gh label create "needs-review" --color "FBCA04" --description "Awaiting review"
gh label create "changes-requested" --color "D93F0B" --description "Changes needed"
gh label create "approved" --color "0E8A16" --description "Approved to merge"

# Create priority labels
gh label create "priority:low" --color "C2E0C6" --description "Low priority"
gh label create "priority:medium" --color "FEF2C0" --description "Medium priority"
gh label create "priority:high" --color "FBCA04" --description "High priority"
gh label create "priority:critical" --color "D73A4A" --description "Critical"

# Create size labels
gh label create "size:xs" --color "E0F2F1" --description "Extra small change"
gh label create "size:small" --color "C8E6C9" --description "Small change"
gh label create "size:medium" --color "FFF9C4" --description "Medium change"
gh label create "size:large" --color "FFE0B2" --description "Large change"
gh label create "size:xl" --color "FFCDD2" --description "Extra large change"
```

---

### Step 7: Setup CodeRabbit

#### Enable CodeRabbit

1. Go to https://coderabbit.ai
2. Sign in with GitHub
3. Install CodeRabbit GitHub App
4. Select `synthesis` repository
5. Grant permissions

#### Add Configuration

```bash
# Copy CodeRabbit config to root
cp docs/.coderabbit.yml .coderabbit.yml
git add .coderabbit.yml
git commit -m "chore: add CodeRabbit configuration"
git push origin develop
```

---

### Step 8: Add GitHub Actions Workflows

```bash
# Copy CI/CD workflows
cp docs/ci.yml .github/workflows/ci.yml
cp docs/cd.yml .github/workflows/cd.yml
cp docs/coderabbit.yml .github/workflows/coderabbit.yml

# Commit workflows
git add .github/
git commit -m "ci: add CI/CD workflows"
git push origin develop
```

---

### Step 9: Create Initial Issues

```bash
# Create issues for each phase
gh issue create \
  --title "Phase 1: Database Setup and Core Pipeline" \
  --body "Implement database schema and ingestion pipeline. See docs/09_BUILD_PLAN.md#day-1" \
  --label "phase-1,feature" \
  --assignee "@me"

gh issue create \
  --title "Phase 2: Chunking and Embeddings" \
  --body "Implement chunking strategy and Ollama embeddings. See docs/09_BUILD_PLAN.md#day-2" \
  --label "phase-2,feature"

gh issue create \
  --title "Phase 3: Search and Agent Tools" \
  --body "Implement vector search and Claude Agent SDK tools. See docs/09_BUILD_PLAN.md#day-3" \
  --label "phase-3,feature"

# Continue for all phases...
```

---

### Step 10: Create Project Board (Optional)

```bash
# Create project board
gh project create \
  --title "Synthesis MVP Development" \
  --body "Track progress of MVP build"

# Or via GitHub UI:
# Projects → New project → Board
```

**Columns:**
- 📋 Backlog
- 🏗️ In Progress
- 👀 In Review
- ✅ Done

---

### Step 11: Add Collaborators (if team)

```bash
# Add collaborator
gh api repos/<your-username>/synthesis/collaborators/<username> \
  --method PUT \
  --field permission=push

# Or via GitHub UI:
# Settings → Collaborators → Add people
```

---

### Step 12: Setup README Badges

Add to top of README.md:

```markdown
# Synthesis RAG

[![CI](https://github.com/<your-username>/synthesis/workflows/CI/badge.svg)](https://github.com/<your-username>/synthesis/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/<your-username>/synthesis/branch/develop/graph/badge.svg)](https://codecov.io/gh/<your-username>/synthesis)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Autonomous RAG system powered by Claude Agent SDK for multi-project documentation management.

[Documentation](docs/) | [Build Plan](docs/09_BUILD_PLAN.md) | [Agent Workflow](docs/agents.md)

## Status

🚧 **Under Active Development** - Currently in Phase 1/9

## Quick Start

See [Environment Setup](docs/10_ENV_SETUP.md) for detailed instructions.
```

---

### Step 13: Verify Setup

```bash
# Check branches
git branch -a

# Check protection
gh api repos/<your-username>/synthesis/branches/main/protection

# Check secrets
gh secret list

# Check workflows
gh workflow list

# Check labels
gh label list
```

---

## 📋 Checklist

### Repository Created
- [ ] Local git repository initialized
- [ ] GitHub repository created
- [ ] Initial commit pushed to main
- [ ] develop branch created and pushed
- [ ] develop set as default branch

### Branch Protection
- [ ] main branch protection enabled (2 approvals)
- [ ] develop branch protection enabled (1 approval)
- [ ] Status checks required
- [ ] Conversation resolution required

### Secrets & Configuration
- [ ] ANTHROPIC_API_KEY added
- [ ] Docker secrets added (if using CD)
- [ ] CodeRabbit installed and configured
- [ ] .coderabbit.yml in root
- [ ] GitHub Actions workflows added

### Organization
- [ ] Labels created (phase, type, status, priority, size)
- [ ] Initial issues created
- [ ] Project board created (optional)
- [ ] README with badges updated

### Documentation
- [ ] All docs in `docs/` directory
- [ ] README points to key docs
- [ ] CONTRIBUTING.md added (optional)
- [ ] LICENSE added

---

## 🔄 First PR Workflow Test

### Test the full workflow:

```bash
# 1. Create test feature branch
git checkout -b feature/test-ci
echo "# Test" > TEST.md
git add TEST.md
git commit -m "test: verify CI/CD setup"
git push origin feature/test-ci

# 2. Create PR
gh pr create \
  --base develop \
  --title "Test: Verify CI/CD Setup" \
  --body "Testing that CI runs and branch protection works"

# 3. Verify:
# - CI workflow runs
# - CodeRabbit reviews
# - Cannot merge without approval
# - Can merge after approval

# 4. Clean up after test
gh pr close <pr-number>
git checkout develop
git branch -D feature/test-ci
git push origin --delete feature/test-ci
```

---

## ✅ Post-Setup

### You're ready when:
- [x] Repository exists on GitHub
- [x] Both branches (main, develop) are protected
- [x] CI/CD workflows are active
- [x] CodeRabbit is reviewing PRs
- [x] Secrets are configured
- [x] Test PR workflow passed

### Next steps:
1. Start Day 0: Environment setup (see `docs/10_ENV_SETUP.md`)
2. Begin Phase 1: Database setup (see `docs/09_BUILD_PLAN.md`)
3. Follow agent workflow (see `docs/agents.md`)

---

**Your repository is now ready for agent-driven development!**
