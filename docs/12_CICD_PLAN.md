# CI/CD Plan
**Version:** 1.0  
**Platform:** GitHub Actions  
**Last Updated:** October 6, 2025

---

## 🎯 CI/CD Goals

1. **Automated quality checks** on every PR
2. **Fast feedback** (<5 mins for most checks)
3. **Block bad code** from merging
4. **Automated deployment** to staging (develop) and prod (main)
5. **Docker builds** for all services

---

## 🏗️ Pipeline Overview

```
Push/PR Created
  ↓
┌─────────────────────────────────────┐
│  Lint & Format Check (Biome)        │  ~30s
└─────────────┬───────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Type Check (TypeScript)             │  ~45s
└─────────────┬───────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Unit Tests (Vitest)                 │  ~60s
└─────────────┬───────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Build All Packages                  │  ~90s
└─────────────┬───────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Integration Tests                   │  ~120s
└─────────────┬───────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Docker Build (all services)         │  ~180s
└─────────────┬───────────────────────┘
              ↓
         All Passed?
         ├─ Yes → ✅ Merge Allowed
         └─ No  → ❌ Merge Blocked
```

**Total time:** ~6-8 minutes

---

## 📋 GitHub Actions Workflows

### Workflow 1: CI (Continuous Integration)

**File:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [develop, main]
  push:
    branches: [develop, main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.2
      
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run Biome lint
        run: pnpm lint
      
      - name: Check formatting
        run: pnpm format:check

  typecheck:
    name: TypeScript Type Check
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.2
      
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Type check
        run: pnpm type-check

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.2
      
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run tests
        run: pnpm test --coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          flags: unittests

  build:
    name: Build All Packages
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.2
      
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build all packages
        run: pnpm build
      
      - name: Check for build errors
        run: |
          if [ -n "$(find . -name '*.tsbuildinfo' -size 0)" ]; then
            echo "Build produced empty files"
            exit 1
          fi

  integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_USER: postgres
          POSTGRES_DB: synthesis_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.2
      
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run migrations
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/synthesis_test
        run: pnpm --filter @synthesis/db migrate
      
      - name: Run integration tests
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/synthesis_test
        run: pnpm test:integration

  docker:
    name: Docker Build
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Build server image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/server/Dockerfile
          push: false
          tags: synthesis-server:test
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Build web image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/web/Dockerfile
          push: false
          tags: synthesis-web:test
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Build MCP image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/mcp/Dockerfile
          push: false
          tags: synthesis-mcp:test
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

### Workflow 2: CD (Continuous Deployment)

**File:** `.github/workflows/cd.yml`

```yaml
name: CD

on:
  push:
    branches:
      - develop  # Auto-deploy staging
      - main     # Auto-deploy production

jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    name: Deploy to Staging
    runs-on: ubuntu-latest
    environment: staging
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push images
        run: |
          docker-compose -f docker-compose.prod.yml build
          docker-compose -f docker-compose.prod.yml push
      
      - name: Deploy to staging server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /home/synthesis
            docker-compose pull
            docker-compose up -d
            docker-compose exec -T server pnpm --filter @synthesis/db migrate

  deploy-production:
    if: github.ref == 'refs/heads/main'
    name: Deploy to Production
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push images
        run: |
          docker-compose -f docker-compose.prod.yml build
          docker-compose -f docker-compose.prod.yml push
      
      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ github.run_number }}
          release_name: Release v${{ github.run_number }}
          draft: false
          prerelease: false
      
      - name: Deploy to production server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /home/synthesis
            docker-compose pull
            docker-compose up -d
            docker-compose exec -T server pnpm --filter @synthesis/db migrate
```

---

### Workflow 3: CodeRabbit

**File:** `.github/workflows/coderabbit.yml`

```yaml
name: CodeRabbit Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  coderabbit:
    runs-on: ubuntu-latest
    steps:
      - name: CodeRabbit Review
        uses: coderabbitai/coderabbit-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## 🔒 Required GitHub Secrets

### Repository Secrets

Add these in GitHub Settings → Secrets and variables → Actions:

```
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# Docker Hub (for image pushing)
DOCKER_USERNAME=your-username
DOCKER_PASSWORD=your-token

# Deployment (future)
STAGING_HOST=staging.synthesis.example.com
STAGING_USER=deploy
STAGING_SSH_KEY=<private key>

PROD_HOST=synthesis.example.com
PROD_USER=deploy
PROD_SSH_KEY=<private key>

# Optional: Codecov
CODECOV_TOKEN=...
```

---

## 🧪 Testing Strategy

### Test Types

#### 1. Unit Tests (Fast ~60s)
**Location:** `apps/*/src/**/__tests__/*.test.ts`

**Run:** `pnpm test`

**Coverage:** Aim for 80%+

**Example:**
```typescript
// apps/server/src/pipeline/__tests__/chunk.test.ts
import { describe, it, expect } from 'vitest';
import { chunkText } from '../chunk';

describe('chunkText', () => {
  it('splits text into correct chunks', () => {
    const text = 'a'.repeat(1000);
    const chunks = chunkText(text);
    
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].text.length).toBeLessThanOrEqual(800);
  });
});
```

#### 2. Integration Tests (Slower ~120s)
**Location:** `apps/*/src/**/__tests__/*.integration.test.ts`

**Run:** `pnpm test:integration`

**Requires:** Postgres running

**Example:**
```typescript
// apps/server/src/pipeline/__tests__/ingest.integration.test.ts
import { describe, it, expect } from 'vitest';
import { ingestDocument } from '../ingest';

describe('Ingestion Pipeline', () => {
  it('processes PDF end-to-end', async () => {
    const docId = await uploadTestPDF();
    await ingestDocument(db, docId);
    
    const chunks = await db.query(
      'SELECT COUNT(*) FROM chunks WHERE doc_id = $1',
      [docId]
    );
    
    expect(chunks.rows[0].count).toBeGreaterThan(0);
  });
});
```

#### 3. E2E Tests (Future - Phase 2)
**Tool:** Playwright

**Location:** `tests/e2e/`

**Run:** `pnpm test:e2e`

---

## 🎨 Linting & Formatting

### Biome Configuration

**File:** `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.3/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error",
        "noConsoleLog": "warn"
      },
      "style": {
        "useConst": "error",
        "noVar": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5",
      "semicolons": "always"
    }
  }
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "type-check": "tsc --noEmit --project tsconfig.base.json"
  }
}
```

---

## 📊 Quality Metrics

### Code Coverage

**Tool:** Vitest Coverage (c8)

**Target:** 80%+ coverage

**Configuration:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/__tests__/',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

---

## 🚨 Failure Handling

### When CI Fails

#### Lint Errors
```bash
# Fix automatically
pnpm lint:fix

# Or manually review
pnpm lint
```

#### Type Errors
```bash
# Check types
pnpm type-check

# Fix errors in reported files
```

#### Test Failures
```bash
# Run tests locally
pnpm test

# Debug specific test
pnpm test chunk.test.ts

# Watch mode
pnpm test --watch
```

#### Build Errors
```bash
# Clean and rebuild
pnpm clean
pnpm build

# Check for circular deps
pnpm check-circular
```

---

## 🔄 Deployment Process

### Staging (develop branch)

1. PR merged to develop
2. GitHub Actions builds Docker images
3. Images pushed to Docker Hub
4. SSH into staging server
5. Pull new images
6. Restart containers
7. Run migrations
8. Health check

### Production (main branch)

1. Release PR merged to main
2. GitHub Actions builds Docker images
3. Images tagged with version
4. Images pushed to Docker Hub
5. GitHub Release created
6. SSH into production server
7. Pull new images
8. Backup database
9. Restart containers with new images
10. Run migrations
11. Smoke tests
12. Health check
13. Rollback if issues

---

## ✅ CI/CD Checklist

### Initial Setup
- [ ] Create `.github/workflows/` directory
- [ ] Add ci.yml workflow
- [ ] Add cd.yml workflow
- [ ] Add coderabbit.yml workflow
- [ ] Configure Biome (biome.json)
- [ ] Add package.json scripts
- [ ] Add GitHub secrets
- [ ] Enable branch protection
- [ ] Test CI on dummy PR

### Per Phase
- [ ] All tests passing locally
- [ ] Lint passing locally
- [ ] Build succeeds locally
- [ ] Push triggers CI
- [ ] CI passes on GitHub
- [ ] CodeRabbit review complete
- [ ] Ready to merge

### After MVP
- [ ] Add E2E tests
- [ ] Set up staging environment
- [ ] Configure CD for develop
- [ ] Test deployment process
- [ ] Add monitoring/alerts
- [ ] Document rollback procedure

---

**Follow this CI/CD plan for automated quality and deployment!**
