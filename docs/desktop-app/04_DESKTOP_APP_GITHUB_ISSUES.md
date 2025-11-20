## Synthesis Desktop App — Proposed GitHub Issues

**Version:** 1.0  
**Date:** 2025-11-20

---

### Labels

- `desktop-app`, `electron`, `feature`, `phase-18`
- `priority:high/medium/low`

**Milestone:** `Synthesis Desktop v1.0`

---

### Phase 1 — Shell + Docker Orchestration

**Issue #1:** `feat(desktop): Scaffold apps/desktop with Electron and Docker orchestration`

**Labels:** `desktop-app`, `electron`, `feature`, `phase-18`, `priority:high`

**Description:**
Create `apps/desktop` with Electron 33.2.0 + TypeScript 5.7.2. Implement basic window, Docker start/stop, health checks, and simple status UI.

**Tasks:**
- [ ] Scaffold `apps/desktop` in pnpm workspace
- [ ] Setup Electron + TypeScript + electron-builder
- [ ] Main process + BrowserWindow pointing to `http://localhost:5173`
- [ ] Docker orchestration: `docker compose up/down`
- [ ] Health checks: poll `/health` endpoint
- [ ] Simple status UI: Starting → Running → Stopped
- [ ] Error handling: Docker not found, ports in use

**Acceptance Criteria:**
- Desktop app starts and shows control UI
- Click "Start" → launches stack via Docker → shows web UI when ready
- Click "Stop" → cleanly shuts down stack

**Cross-refs:** `02_DESKTOP_APP_BUILD_PLAN.md` lines 17-47, `05_DESKTOP_APP_PHASE_PROMPTS.md` lines 23-65

---

### Phase 2 — MCP Management + Dev Mode + Logs

**Issue #2:** `feat(desktop): Add MCP management UI, dev mode, and log viewer`

**Labels:** `desktop-app`, `electron`, `feature`, `phase-18`, `priority:high`

**Description:**
Implement MCP server/tool toggle UI, direct process mode for dev, and scrollable log viewer.

**Tasks:**
- [ ] MCP management UI: list servers, toggle on/off
- [ ] Per-server tool list with toggles
- [ ] Save MCP preferences to local config
- [ ] Restart backend when MCP config changes
- [ ] Direct process mode: spawn `pnpm dev` commands
- [ ] Monitor stdout/stderr from processes
- [ ] Log viewer: color-coded, scrollable, clear button

**Acceptance Criteria:**
- Can toggle MCP servers and tools on/off
- Dev mode works without Docker
- Logs show useful diagnostic info

**Cross-refs:** `02_DESKTOP_APP_BUILD_PLAN.md` lines 49-83, `05_DESKTOP_APP_PHASE_PROMPTS.md` lines 67-105

---

### Phase 3 — Status Dashboard + Packaging

**Issue #3:** `feat(desktop): Implement status dashboard and packaging for distribution`

**Labels:** `desktop-app`, `electron`, `feature`, `phase-18`, `priority:medium`

**Description:**
Add per-service status indicators, error handling, and configure electron-builder for cross-platform distribution.

**Tasks:**
- [ ] Status dashboard: DB, Server, Web, MCP indicators
- [ ] Status colors: gray/yellow/green/red
- [ ] Show port numbers and health check URLs
- [ ] Auto-refresh status every 5 seconds
- [ ] Error handling: port conflicts, Docker missing, service crashes
- [ ] Configure electron-builder for Linux/macOS/Windows
- [ ] Test local packaging (`.AppImage` for Linux)
- [ ] GitHub Actions workflow for release builds
- [ ] Upload artifacts to GitHub release

**Acceptance Criteria:**
- Status dashboard shows real-time health
- Packaged `.AppImage` installs and runs
- CI builds packages automatically on tag push

**Cross-refs:** `02_DESKTOP_APP_BUILD_PLAN.md` lines 85-129, `05_DESKTOP_APP_PHASE_PROMPTS.md` lines 107-145

---

### Phase 4 — Advanced Features (Future)

**Issue #4:** `feat(desktop): Add advanced features (system tray, hotkeys, etc.)`

**Labels:** `desktop-app`, `electron`, `feature`, `phase-18`, `priority:low`

**Description:**
Quality-of-life features for power users. Implement on-demand based on user requests.

**Possible tasks (not all required):**
- [ ] System tray integration
- [ ] Global keyboard shortcuts
- [ ] Protocol handlers (`synthesis://`)
- [ ] Auto-start on boot
- [ ] Multi-workspace management
- [ ] Auto-update checker
- [ ] Config editor UI

**Acceptance Criteria:**
- At least one advanced feature implemented
- Features behind configuration flags
- Documentation updated

**Cross-refs:** `02_DESKTOP_APP_BUILD_PLAN.md` lines 131-174, `05_DESKTOP_APP_PHASE_PROMPTS.md` lines 147-180

---

### Summary

- **4 issues** mapped to **4 phases**
- Issues 1-3: core functionality (~3 days implementation)
- Issue 4: future enhancements (on-demand)
- All issues cross-reference build plan and phase prompts with line numbers
