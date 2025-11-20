## Synthesis Desktop App — Repo & Workflow Strategy

**Version:** 1.0  
**Date:** 2025-11-20

---

### 1. Repository Strategy

**Chosen:** Monorepo with `apps/desktop`

- Keep everything in this repo
- Add `apps/desktop` for the Electron shell
- Use existing pnpm workspace (`pnpm-workspace.yaml`)

**Advantages:**
- One repo, easier mental model
- Desktop + server always at compatible versions (same commit)
- CI builds all apps in one place (server, web, MCP, desktop)

**Alternative considered (rejected):**
- Separate `synthesis-desktop` repo → rejected due to version sync complexity

---

### 2. Branching & PR Workflow (Stacked PRs)

**Branch structure:**
```
develop (protected)
  ↑
  └── feature/phase-18-desktop-app (integration branch)
        ↑
        ├── feature/desktop-phase-1 → PR to integration
        ├── feature/desktop-phase-2 → PR to integration
        └── feature/desktop-phase-3 → PR to integration
```

**Why stacked PRs:**
- ✅ Smaller, reviewable PRs (~500-700 lines each)
- ✅ Test each phase independently
- ✅ Integration branch accumulates all phases for final testing
- ✅ Can fix phase issues without affecting others
- ✅ CI validates each phase before merge

**Workflow per phase:**

```bash
# Phase 1
git checkout feature/phase-18-desktop-app
git pull origin feature/phase-18-desktop-app
git checkout -b feature/desktop-phase-1
# implement Phase 1...
gh pr create --base feature/phase-18-desktop-app \
  --head feature/desktop-phase-1 \
  --title "feat(desktop): Phase 1 - Shell + Docker"
# review, test, merge → integration branch

# Phase 2
git checkout feature/phase-18-desktop-app
git pull origin feature/phase-18-desktop-app  # now has Phase 1
git checkout -b feature/desktop-phase-2
# implement Phase 2...
gh pr create --base feature/phase-18-desktop-app \
  --head feature/desktop-phase-2 \
  --title "feat(desktop): Phase 2 - MCP + Dev Mode + Logs"
# review, test, merge → integration branch

# Phase 3
git checkout feature/phase-18-desktop-app
git pull origin feature/phase-18-desktop-app  # now has Phase 1+2
git checkout -b feature/desktop-phase-3
# implement Phase 3...
gh pr create --base feature/phase-18-desktop-app \
  --head feature/desktop-phase-3 \
  --title "feat(desktop): Phase 3 - Status + Packaging"
# review, test, merge → integration branch
```

**Final integration:**

```bash
# Test complete desktop app on integration branch
git checkout feature/phase-18-desktop-app
git pull origin feature/phase-18-desktop-app
pnpm --filter @synthesis/desktop dev
# test all features thoroughly

# When ready, PR to develop
gh pr create --base develop \
  --head feature/phase-18-desktop-app \
  --title "feat: Phase 18 - Synthesis Desktop App (Complete)"
# review, CI passes, merge → develop
```

**Release workflow:**
- Use Git tags: `v2.0.0`, `v2.1.0`, etc.
- Desktop + server/web share same version
- On tag push → CI builds binaries for all platforms
- Binaries attached as GitHub release assets

---

### 3. CI/CD Workflow

**Existing CI** (from Phase 16):
- Lint, typecheck, test, build, integration tests, docker builds
- Runs on PRs and pushes to `develop`/`main`

**Add to CI for desktop:**

1. **Build & Test** (on PRs/pushes):
```yaml
desktop-test:
  runs-on: ubuntu-latest
  steps:
    - pnpm install
    - pnpm --filter @synthesis/desktop typecheck
    - pnpm --filter @synthesis/desktop test
    - pnpm --filter @synthesis/desktop build
```

2. **Release Build** (on tag push `v*`):
```yaml
desktop-release:
  strategy:
    matrix:
      os: [ubuntu-latest, macos-latest, windows-latest]
  runs-on: ${{ matrix.os }}
  steps:
    - pnpm install
    - pnpm --filter @synthesis/desktop build:release
    - Upload to GitHub release
```

**Workflow file:** `.github/workflows/desktop-release.yml`  
**Triggered by:** tag push matching `v*`

---

### 4. Labels & Issues

**Labels:**
- `desktop-app` → all desktop-related issues
- `electron` → Electron-specific
- `phase-18` → Phase 18 work
- `priority:high/medium/low` → priority levels

**Phases (from Build Plan):**
- Phase 1: Shell + Docker
- Phase 2: MCP + Dev Mode + Logs
- Phase 3: Status + Packaging
- Phase 4: Advanced Features (future)

**Issue templates:** `04_DESKTOP_APP_GITHUB_ISSUES.md` (lines 1-156)

---

### 5. Developer Workflow

**Setup:**
```bash
git clone <repo>
nvm use  # Uses Node 22.20.0 from .nvmrc
pnpm install
```

**Desktop dev:**
```bash
# Terminal 1: Start Synthesis backend (Docker or dev mode)
pnpm docker:dev  # or manually start services

# Terminal 2: Run desktop app in dev
pnpm --filter @synthesis/desktop dev
```

**Full-stack test:**
- Desktop app orchestrates stack
- Web UI loads in Electron window
- Test start/stop, MCP toggles, logs

---

### 6. Summary

- Monorepo with `apps/desktop` for simplicity
- Desktop + server share versions and releases
- CI builds all platforms on tag push
- Workflow consistent with existing Synthesis development

**Cross-references:**
- Build plan: `02_DESKTOP_APP_BUILD_PLAN.md` (lines 1-177)
- Issues: `04_DESKTOP_APP_GITHUB_ISSUES.md` (lines 1-156)
- Prompts: `05_DESKTOP_APP_PHASE_PROMPTS.md` (lines 1-180)