## Synthesis Desktop App — Build Plan

**Version:** 1.0  
**Date:** 2025-11-20

---

### Overview

**4 implementation phases** for Synthesis Desktop app (monorepo, `apps/desktop`, Electron wrapper).  
Each phase completable within 150k tokens. Architecture in `01_DESKTOP_APP_ARCHITECTURE.md` (lines 1-161).  
Tech stack in `06_DESKTOP_APP_TECH_STACK.md` (lines 1-150).

---

### Phase 1 — Desktop Shell + Docker Orchestration

**Goal:** Minimal desktop app that can start/stop Synthesis via Docker and display the web UI.

**Estimated tokens:** ~120k  
**Time:** 1 day

**Tasks:**

1. **Scaffold `apps/desktop`**
   - Add to pnpm workspace
   - Install Electron 33.2.0 + TypeScript 5.7.2
   - Setup: `package.json`, `tsconfig.json`, `main.ts`, `preload.ts`
   - Scripts: `dev`, `build`

2. **Basic window**
   - Main process creates BrowserWindow
   - Loads `http://localhost:5173` (configurable via env)
   - Window config: 1280x800, dev tools in dev mode

3. **Docker orchestration**
   - Check Docker availability (`docker --version`)
   - Start button → `docker compose up -d` (using repo's `docker-compose.yml`)
   - Stop button → `docker compose down`
   - Health check: poll `http://localhost:3333/health` until ready

4. **Simple status UI**
   - Show: Starting → Running → Stopped
   - Error handling: Docker not found, ports in use

**Exit Criteria:**
- Desktop app starts, shows control UI
- Click "Start" → launches Synthesis stack → shows web UI when ready
- Click "Stop" → cleanly shuts down stack

---

### Phase 2 — MCP Management + Dev Mode + Logs

**Goal:** Add MCP server/tool management UI, direct process mode for dev, and log viewer.

**Estimated tokens:** ~130k  
**Time:** 1 day

**Tasks:**

1. **MCP Management UI**
   - Read MCP server config from `apps/mcp/src/index.ts` or config file
   - Display list of available MCP servers
   - Toggle buttons to enable/disable each server
   - Per-server tool list with enable/disable toggles
   - Save preferences to local config file
   - Restart backend when MCP config changes

2. **Direct Process Mode (dev)**
   - Config toggle: Docker mode vs Direct mode
   - Direct mode spawns:
     - `pnpm --filter @synthesis/server dev`
     - `pnpm --filter @synthesis/web dev`
   - Monitor stdout/stderr, show in logs
   - Clean process termination on stop/exit

3. **Log Viewer**
   - Scrollable log panel showing recent events
   - Color-coded: info (white), warn (yellow), error (red)
   - Focus on: startup, Docker errors, port conflicts, health checks
   - Clear logs button

**Exit Criteria:**
- Can toggle MCP servers/tools on/off
- Dev mode works (no Docker required)
- Logs show useful diagnostic info

---

### Phase 3 — Status Dashboard + Packaging

**Goal:** Per-service status indicators and build distributable packages.

**Estimated tokens:** ~140k  
**Time:** 1 day

**Tasks:**

1. **Status Dashboard**
   - Per-service indicators: DB, Server, Web, MCP
   - Status: Stopped (gray), Starting (yellow), Running (green), Error (red)
   - Show port numbers and health check URLs
   - Quick actions: restart service, view service logs
   - Auto-refresh status every 5 seconds

2. **Error Handling**
   - Detect port conflicts → suggest alternatives
   - Docker not found → show install instructions
   - Service crash → show error and restart button
   - Health check timeout → show troubleshooting steps

3. **Packaging with electron-builder**
   - Configure `electron-builder` in `package.json`
   - Target platforms: Linux (AppImage), macOS (DMG), Windows (NSIS)
   - App icons and metadata
   - Bundle `docker-compose.yml` with package
   - Test builds locally for your platform (WSL2/Linux)

4. **GitHub Actions CI**
   - Workflow: build desktop on tag push (e.g., `v1.0.0-desktop`)
   - Matrix build: Linux, macOS, Windows
   - Upload artifacts to GitHub release
   - Auto-generate release notes

**Exit Criteria:**
- Status dashboard shows real-time health
- Packaged `.AppImage` installs and runs
- CI builds packages automatically

---

### Phase 4 — Advanced Features (Future/Optional)

**Goal:** Quality-of-life features for power users.

**Estimated tokens:** ~100k  
**Time:** 0.5 day

**Not implemented initially. Implement only if requested:**

1. **System Tray**
   - Minimize to tray instead of taskbar
   - Tray menu: Start/Stop, Show Window, Quit
   - System notifications for status changes

2. **Global Hotkeys**
   - Register keyboard shortcuts (e.g., `Ctrl+Alt+S` to show)
   - Quick search from anywhere (OS-level)

3. **Protocol Handlers**
   - Register `synthesis://` URL scheme
   - Open specific collections/documents from browser links

4. **Auto-Start on Boot**
   - Option to launch Synthesis on system startup
   - Run in background with tray icon

5. **Multi-Workspace**
   - Switch between multiple Synthesis instances
   - Per-workspace configuration and data isolation

6. **Auto-Update**
   - Check for new desktop versions on launch
   - Download and install updates in background

7. **Config Editor**
   - UI for editing Synthesis `.env` variables
   - Validation and auto-restart on save

**Exit Criteria:**
- Implemented on-demand based on user requests
- Each feature behind feature flag

---

### Summary

**4 phases total:**
- Phase 1: Core shell + Docker (1 day, ~120k tokens)
- Phase 2: MCP + Dev mode + Logs (1 day, ~130k tokens)
- Phase 3: Status + Packaging + CI (1 day, ~140k tokens)
- Phase 4: Advanced features (future, on-demand)

**Total implementation: 3 days** for fully functional desktop app.

See `05_DESKTOP_APP_PHASE_PROMPTS.md` (lines 1-180) for agent prompts per phase.  
See `04_DESKTOP_APP_GITHUB_ISSUES.md` (lines 1-156) for GitHub issue templates.