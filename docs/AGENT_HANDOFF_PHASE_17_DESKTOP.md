# Agent Handoff: Phase 17 Completion + Desktop App Implementation

**Date:** November 24, 2025  
**Priority:** High  
**Estimated Time:** 2-3 days

---

## Overview

This handoff covers two areas of work:
1. **Phase 17 Verification** - The ingestion agent appears implemented but needs verification/testing
2. **Desktop App (Phase 18)** - Currently just a placeholder, needs full implementation

---

## Pre-Work: Branch Setup

```bash
# Always start from latest develop
git checkout develop
git pull origin develop

# Create feature branch with best practices naming
git checkout -b feature/phase-18-desktop-app

# For commits, use conventional commit format:
# feat(desktop): description
# fix(desktop): description
```

---

## Part 1: Phase 17 Verification (1-2 hours)

### Current Status
Phase 17 (Ingestion Agent) appears to be **already implemented**:

| Component | Status | Location |
|-----------|--------|----------|
| DB Migration | ✅ Exists | `packages/db/migrations/009_ingestion_agent.sql` |
| DB Queries | ✅ Exists | `packages/db/src/queries.ts` (getIngestionJob, getIngestionJobStats) |
| Worker | ✅ Exists | `apps/server/src/ingestion-agent/worker.ts` |
| Scraper | ✅ Exists | `apps/server/src/ingestion-agent/scraper.ts` |
| Search | ✅ Exists | `apps/server/src/ingestion-agent/search.ts` |
| API Routes | ✅ Exists | `apps/server/src/routes/agent-ingestion.ts` |
| Frontend UI | ✅ Exists | `apps/web/src/pages/AgentIngestionPage.tsx` |

### Tasks
1. **Verify the ingestion agent works end-to-end**
   - Start the dev server: `pnpm dev`
   - Navigate to the Agent Ingestion page
   - Test with a simple topic (e.g., "React hooks")
   - Verify URLs are found, scraped, and ingested

2. **Check for any missing pieces**
   - Ensure API client methods exist in `apps/web/src/lib/api.ts`
   - Ensure route is registered in `apps/server/src/index.ts`
   - Ensure page is routed in `apps/web/src/App.tsx`

3. **Fix any issues found during testing**

---

## Part 2: Desktop App Implementation (2-3 days)

### Current Status
The desktop app is a **placeholder only**:

```typescript
// apps/desktop/src/index.ts - CURRENT STATE
export const VERSION = '1.0.0';
// That's it - no actual Electron code
```

### What Exists
- ✅ Package scaffolding (`package.json`, `tsconfig.json`)
- ✅ Electron-builder config (`electron-builder.yml`)
- ✅ Build scripts (fixed in recent PR)
- ❌ No main process code
- ❌ No preload script
- ❌ No renderer/UI
- ❌ No Docker orchestration

### Implementation Plan

#### Phase 1: Desktop Shell + Docker Orchestration (Day 1)

**File: `apps/desktop/src/main.ts`**
```typescript
// Main Electron process
// - Create BrowserWindow
// - Load web UI (http://localhost:5173 in dev, bundled in prod)
// - Handle app lifecycle (ready, window-all-closed, activate)
```

**File: `apps/desktop/src/preload.ts`**
```typescript
// Preload script for IPC bridge
// - Expose safe APIs to renderer via contextBridge
// - Docker control methods
// - Status polling methods
```

**File: `apps/desktop/src/docker.ts`**
```typescript
// Docker orchestration
// - checkDockerAvailable(): Promise<boolean>
// - startStack(): Promise<void> - runs docker compose up -d
// - stopStack(): Promise<void> - runs docker compose down
// - getStackStatus(): Promise<'stopped' | 'starting' | 'running' | 'error'>
// - healthCheck(): Promise<boolean> - polls localhost:3333/health
```

**File: `apps/desktop/src/renderer/index.html`**
```html
<!-- Simple control UI -->
<!-- Status indicator: Stopped | Starting | Running | Error -->
<!-- Start/Stop button -->
<!-- Link to open web UI when running -->
```

**Exit Criteria:**
- [ ] App launches and shows control UI
- [ ] "Start" button runs `docker compose up -d`
- [ ] Health check polls until server is ready
- [ ] Web UI loads in embedded browser or external browser
- [ ] "Stop" button cleanly shuts down stack

#### Phase 2: Dev Mode + Logs (Day 2)

**File: `apps/desktop/src/process-manager.ts`**
```typescript
// Direct process mode (no Docker)
// - startDevMode(): spawn pnpm dev processes
// - stopDevMode(): kill spawned processes
// - captureOutput(): stream stdout/stderr to log viewer
```

**File: `apps/desktop/src/renderer/logs.html`**
```html
<!-- Log viewer panel -->
<!-- Color-coded: info (white), warn (yellow), error (red) -->
<!-- Clear logs button -->
<!-- Auto-scroll to bottom -->
```

**Exit Criteria:**
- [ ] Toggle between Docker mode and Dev mode
- [ ] Dev mode spawns server + web processes
- [ ] Logs display in real-time
- [ ] Clean process termination on stop/exit

#### Phase 3: Status Dashboard + Packaging (Day 3)

**File: `apps/desktop/src/renderer/dashboard.html`**
```html
<!-- Per-service status indicators -->
<!-- DB: gray/yellow/green/red -->
<!-- Server: gray/yellow/green/red -->
<!-- Web: gray/yellow/green/red -->
<!-- Port numbers and health URLs -->
```

**Packaging Tasks:**
1. Update `electron-builder.yml` with correct file paths
2. Test Linux AppImage build locally
3. Add GitHub Actions workflow for release builds

**Exit Criteria:**
- [ ] Dashboard shows real-time service status
- [ ] Error states show helpful messages
- [ ] AppImage builds and runs correctly
- [ ] CI workflow creates release artifacts

---

## Key Files Reference

| Purpose | Path |
|---------|------|
| Main process | `apps/desktop/src/main.ts` (create) |
| Preload script | `apps/desktop/src/preload.ts` (create) |
| Docker control | `apps/desktop/src/docker.ts` (create) |
| Process manager | `apps/desktop/src/process-manager.ts` (create) |
| Renderer HTML | `apps/desktop/src/renderer/index.html` (create) |
| Package config | `apps/desktop/package.json` (modify) |
| Builder config | `apps/desktop/electron-builder.yml` (modify) |
| CI workflow | `.github/workflows/desktop-release.yml` (create) |

---

## Git Workflow

```bash
# Start
git checkout develop
git pull origin develop
git checkout -b feature/phase-18-desktop-app

# After each phase, commit with conventional format
git add -A
git commit -m "feat(desktop): implement shell and docker orchestration"

# Push and create PR
git push -u origin feature/phase-18-desktop-app
gh pr create --base develop --title "Phase 18: Desktop App Implementation"
```

---

## Testing Checklist

### Phase 17 (Ingestion Agent)
- [ ] Start ingestion job via UI
- [ ] Job finds relevant URLs
- [ ] URLs are scraped successfully
- [ ] Documents are ingested into collection
- [ ] Status polling shows progress
- [ ] Job completes without errors

### Desktop App
- [ ] App launches without errors
- [ ] Docker mode starts/stops stack
- [ ] Dev mode starts/stops processes
- [ ] Health checks work correctly
- [ ] Logs display in real-time
- [ ] Status dashboard updates
- [ ] AppImage builds and runs
- [ ] Clean shutdown on app close

---

## Dependencies

**Electron packages (already in package.json):**
- electron: 33.2.0
- electron-builder: 25.1.8

**May need to add:**
- No additional dependencies expected

---

## Notes

1. The desktop app architecture doc is at `docs/desktop-app/01_DESKTOP_APP_ARCHITECTURE.md`
2. Detailed phase prompts are at `docs/desktop-app/05_DESKTOP_APP_PHASE_PROMPTS.md`
3. The web UI already exists - desktop just needs to orchestrate and display it
4. Focus on Docker mode first, dev mode is secondary
5. Keep the UI simple - it's just a control panel, not a full app
