## Synthesis Desktop App — Phase Prompts for Implementation Agents

**Version:** 1.0  
**Date:** 2025-11-20

---

### General System Prompt

> **System Prompt (Desktop App)**  
> You are implementing Synthesis Desktop, an Electron-based wrapper around the existing Synthesis RAG system.  
> 
> **Core principles:**
> - Synthesis is a RAG system: Fastify backend, React frontend, PostgreSQL/pgvector, MCP servers
> - Desktop app is a **thin wrapper** - no RAG logic, no UI duplication
> - Use Electron 33.2.0 + TypeScript 5.7.2 + Node 22.20.0
> - Follow existing architecture: `docs/desktop-app/01_DESKTOP_APP_ARCHITECTURE.md` (lines 1-148)
> - Tech stack: `docs/desktop-app/06_DESKTOP_APP_TECH_STACK.md` (lines 1-104)
> - Small, incremental changes - don't over-engineer
> - Each phase must complete within 150k tokens
> 
> **Documentation you have access to:**
> - Electron: https://www.electronjs.org/docs/latest/
> - Electron TypeScript: https://www.electronjs.org/docs/latest/tutorial/typescript
> - electron-builder: https://www.electron.build/
> - Node child_process: https://nodejs.org/api/child_process.html
> - Docker Compose CLI: https://docs.docker.com/compose/reference/

---

### Phase 1 — Shell + Docker Orchestration

> **User Prompt (Phase 1)**  
> 
> **CRITICAL - Branching instructions:**
> ```bash
> git checkout feature/phase-18-desktop-app
> git pull origin feature/phase-18-desktop-app
> git checkout -b feature/desktop-phase-1
> git push -u origin feature/desktop-phase-1
> # Work on feature/desktop-phase-1 branch
> # PR target: feature/phase-18-desktop-app (NOT develop)
> ```
> 
> **Objective:** Create `apps/desktop` with Electron and implement Docker-based start/stop for Synthesis stack.
> 
> **Estimated tokens:** ~120k  
> **Time:** 1 day
> 
> **Read first:**
> - `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` lines 16-50
> - `docs/desktop-app/06_DESKTOP_APP_TECH_STACK.md` lines 1-104
> - `docs/desktop-app/03_DESKTOP_APP_REPO_AND_WORKFLOW.md` lines 26-94
> 
> **Tasks:**
> 
> 1. **Scaffold `apps/desktop`**
>    - Add to `pnpm-workspace.yaml`
>    - Create `apps/desktop/package.json`:
>      ```json
>      {
>        "name": "@synthesis/desktop",
>        "version": "1.0.0",
>        "main": "dist/main.js",
>        "scripts": {
>          "dev": "electron .",
>          "build": "tsc && electron-builder"
>        },
>        "dependencies": {
>          "electron": "33.2.0"
>        },
>        "devDependencies": {
>          "typescript": "5.7.2",
>          "electron-builder": "25.1.8"
>        }
>      }
>      ```
>    - Create `tsconfig.json` (extends root config)
>    - Create `src/main.ts` (Electron main process)
>    - Create `src/preload.ts` (bridge script)
> 
> 2. **Basic window**
>    - In `main.ts`: create BrowserWindow (1280x800)
>    - Load URL from env: `process.env.SYNTHESIS_URL || 'http://localhost:5173'`
>    - Enable dev tools in dev mode
>    - Handle window close events
> 
> 3. **Docker orchestration**
>    - Function `checkDocker()`: run `docker --version`, return boolean
>    - Function `startSynthesis()`: 
>      - Use `child_process.spawn('docker', ['compose', 'up', '-d'])`
>      - Monitor stdout/stderr
>      - Return process handle
>    - Function `stopSynthesis()`:
>      - Use `child_process.spawn('docker', ['compose', 'down'])`
>    - Function `healthCheck()`:
>      - Poll `http://localhost:3333/health` every 2s, max 60s timeout
>      - Return true when 200 OK received
> 
> 4. **Simple control UI**
>    - Create `src/renderer/index.html`:
>      - "Start Synthesis" button
>      - "Stop Synthesis" button
>      - Status text: "Stopped" | "Starting..." | "Running" | "Error"
>    - Use IPC (ipcMain/ipcRenderer) to communicate main ↔ renderer
>    - When "Start" clicked:
>      1. Check Docker available
>      2. Start compose
>      3. Update status to "Starting..."
>      4. Health check loop
>      5. When healthy → open new window with web UI
>      6. Update status to "Running"
> 
> 5. **Error handling**
>    - Docker not found → show error dialog with install instructions
>    - Port 3333 or 5173 in use → show error with suggestion
>    - Health check timeout → show error with troubleshooting
> 
> **Exit criteria:**
> - `pnpm --filter @synthesis/desktop dev` opens control window
> - Click "Start" → Docker launches Synthesis → web UI opens when ready
> - Click "Stop" → cleanly shuts down
> - All error cases handled gracefully
> 
> **Constraints:**
> - No changes to existing `apps/server`, `apps/web`, `apps/mcp`
> - Minimal dependencies (just Electron + TypeScript)
> - No advanced features yet (MCP management comes in Phase 2)
> - Keep it simple - ~500 lines of code total

---

### Phase 2 — MCP Management + Dev Mode + Logs

> **User Prompt (Phase 2)**  
> 
> **CRITICAL - Branching instructions:**
> ```bash
> git checkout feature/phase-18-desktop-app
> git pull origin feature/phase-18-desktop-app  # includes Phase 1
> git checkout -b feature/desktop-phase-2
> git push -u origin feature/desktop-phase-2
> # Work on feature/desktop-phase-2 branch
> # PR target: feature/phase-18-desktop-app (NOT develop)
> ```
> 
> **Objective:** Add MCP server/tool management UI, direct process mode, and log viewer.
> 
> **Estimated tokens:** ~130k  
> **Time:** 1 day
> 
> **Read first:**
> - `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` lines 53-88
> - `docs/desktop-app/03_DESKTOP_APP_REPO_AND_WORKFLOW.md` lines 26-94
> - `apps/mcp/src/index.ts` (to understand MCP server structure)
> 
> **Tasks:**
> 
> 1. **MCP Management UI**
>    - Add "MCP Settings" panel to control UI
>    - Read MCP config: parse `apps/mcp/src/index.ts` or config file
>    - Display list of available servers (e.g., filesystem, brave-search, perplexity)
>    - Each server: toggle switch (on/off)
>    - Expand server → show list of tools
>    - Each tool: toggle switch (on/off)
>    - "Save" button → write new config to `.synthesis/mcp-config.json`
>    - "Restart Backend" button → restart server to apply changes
> 
> 2. **Direct Process Mode**
>    - Add mode selector: "Docker Mode" | "Dev Mode" (radio buttons or dropdown)
>    - In Dev Mode, `startSynthesis()` spawns:
>      ```bash
>      pnpm --filter @synthesis/server dev
>      pnpm --filter @synthesis/web dev
>      ```
>    - Use `child_process.spawn()` with `shell: true`
>    - Capture stdout/stderr from both processes
>    - Display in log viewer (see next task)
>    - On stop: `process.kill()` with cleanup
> 
> 3. **Log Viewer**
>    - Add scrollable log panel (max 1000 lines, auto-scroll to bottom)
>    - Color-coded by level:
>      - Info: white
>      - Warn: yellow
>      - Error: red
>    - Log format: `[HH:MM:SS] [LEVEL] message`
>    - Log events:
>      - Docker/process start/stop
>      - Health check attempts
>      - Port conflicts, errors
>      - MCP config changes
>    - "Clear Logs" button
> 
> 4. **MCP Config Persistence**
>    - On app start: load `.synthesis/mcp-config.json` (if exists)
>    - When toggling servers/tools: update in-memory config
>    - On "Save": write to file, restart backend
>    - Config format:
>      ```json
>      {
>        "servers": {
>          "filesystem": { "enabled": true, "tools": {"read": true, "write": false} },
>          "perplexity": { "enabled": false, "tools": {} }
>        }
>      }
>      ```
> 
> **Exit criteria:**
> - MCP settings panel displays all servers and tools
> - Can toggle servers/tools on/off and save
> - Dev mode works (spawns pnpm commands, no Docker needed)
> - Logs show all important events with timestamps and colors
> - Backend restarts when MCP config changes
> 
> **Constraints:**
> - Don't modify MCP server code itself
> - Config file should be read by backend (add support there if needed)
> - Keep UI simple - basic HTML/CSS, no React
> - ~700 lines of code added

---

### Phase 3 — Status Dashboard + Packaging

> **User Prompt (Phase 3)**  
> 
> **CRITICAL - Branching instructions:**
> ```bash
> git checkout feature/phase-18-desktop-app
> git pull origin feature/phase-18-desktop-app  # includes Phase 1+2
> git checkout -b feature/desktop-phase-3
> git push -u origin feature/desktop-phase-3
> # Work on feature/desktop-phase-3 branch
> # PR target: feature/phase-18-desktop-app (NOT develop)
> ```
> 
> **Objective:** Add per-service status dashboard and configure cross-platform packaging.
> 
> **Estimated tokens:** ~140k  
> **Time:** 1 day
> 
> **Read first:**
> - `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` lines 91-130
> - `docs/desktop-app/03_DESKTOP_APP_REPO_AND_WORKFLOW.md` lines 26-94
> - electron-builder docs: https://www.electron.build/configuration/configuration
> 
> **Tasks:**
> 
> 1. **Status Dashboard**
>    - Replace simple status text with dashboard showing:
>      ```
>      ┌─────────────────────────────────┐
>      │ ● PostgreSQL   :5432   Running  │
>      │ ● Server       :3333   Running  │
>      │ ● Web UI       :5173   Running  │
>      │ ● MCP Server   :3000   Stopped  │
>      └─────────────────────────────────┘
>      ```
>    - Status colors:
>      - Gray: Stopped
>      - Yellow: Starting
>      - Green: Running
>      - Red: Error
>    - Auto-refresh every 5 seconds
>    - Health check per service:
>      - DB: try connect to `postgres://localhost:5432`
>      - Server: GET `http://localhost:3333/health`
>      - Web: GET `http://localhost:5173/`
>      - MCP: GET `http://localhost:3000/health` (if implemented)
>    - Click service → show service-specific logs
> 
> 2. **Enhanced Error Handling**
>    - Port conflict detection:
>      - Before starting, check if ports 3333, 5173, 5432 are in use
>      - Show error: "Port 3333 in use. Stop other services or change port."
>      - Offer "Retry" button
>    - Docker not found:
>      - Show dialog with install link: https://docs.docker.com/get-docker/
>      - Button: "Check Again"
>    - Service crash after start:
>      - Detect when health check stops responding
>      - Update status to "Error"
>      - Show "View Logs" and "Restart" buttons
>    - Health check timeout (>60s):
>      - Show troubleshooting: "Check Docker logs: `docker compose logs`"
> 
> 3. **Packaging with electron-builder**
>    - Add `electron-builder` config to `package.json`:
>      ```json
>      "build": {
>        "appId": "com.synthesis.desktop",
>        "productName": "Synthesis",
>        "files": ["dist/**/*", "docker-compose.yml"],
>        "directories": {"output": "release"},
>        "linux": {
>          "target": ["AppImage", "deb"],
>          "category": "Development"
>        },
>        "mac": {
>          "target": ["dmg"],
>          "category": "public.app-category.developer-tools"
>        },
>        "win": {
>          "target": ["nsis"]
>        }
>      }
>      ```
>    - Add script: `"build:release": "tsc && electron-builder --linux --mac --win"`
>    - Test local build: `pnpm --filter @synthesis/desktop build:release`
>    - Verify `.AppImage` works on Linux
> 
> 4. **GitHub Actions CI**
>    - Create `.github/workflows/desktop-release.yml`:
>      ```yaml
>      name: Desktop Release
>      on:
>        push:
>          tags: ['v*']
>      jobs:
>        release:
>          strategy:
>            matrix:
>              os: [ubuntu-latest, macos-latest, windows-latest]
>          runs-on: ${{ matrix.os }}
>          steps:
>            - uses: actions/checkout@v4
>            - uses: actions/setup-node@v4
>              with: {node-version: '22.20.0'}
>            - uses: pnpm/action-setup@v2
>              with: {version: '9.14.2'}
>            - run: pnpm install
>            - run: pnpm --filter @synthesis/desktop build:release
>            - uses: softprops/action-gh-release@v1
>              with:
>                files: apps/desktop/release/*
>      ```
> 
> **Exit criteria:**
> - Status dashboard shows real-time per-service health
> - All error scenarios handled with clear messages
> - Local packaging produces installable `.AppImage`
> - CI workflow builds for all platforms on tag push
> - Release artifacts uploaded to GitHub
> 
> **Constraints:**
> - Keep dashboard simple (HTML/CSS grid)
> - Don't add complex monitoring - basic HTTP checks sufficient
> - CI should work on first try (test locally first)
> - ~600 lines of code added

---

### Phase 4 — Advanced Features (Future)

> **User Prompt (Phase 4)**  
> 
> **CRITICAL - Branching instructions:**
> ```bash
> # If implementing a Phase 4 feature:
> git checkout feature/phase-18-desktop-app
> git pull origin feature/phase-18-desktop-app  # includes Phase 1+2+3
> git checkout -b feature/desktop-phase-4-<feature-name>
> # e.g., feature/desktop-phase-4-system-tray
> git push -u origin feature/desktop-phase-4-<feature-name>
> # PR target: feature/phase-18-desktop-app (NOT develop)
> ```
> 
> **Objective:** Implement quality-of-life features on-demand.
> 
> **Estimated tokens:** ~100k  
> **Time:** 0.5 day per feature
> 
> **Read first:**
> - `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` lines 133-174
> - `docs/desktop-app/03_DESKTOP_APP_REPO_AND_WORKFLOW.md` lines 26-94
> 
> **Implement only when requested. Pick from:**
> 
> 1. **System Tray** (if requested)
>    - https://www.electronjs.org/docs/latest/api/tray
>    - Minimize to tray instead of closing
>    - Tray menu: Show, Start/Stop, Quit
>    - System notifications on status changes
> 
> 2. **Global Hotkeys** (if requested)
>    - https://www.electronjs.org/docs/latest/api/global-shortcut
>    - Register `Ctrl+Alt+S` to show window
>    - Configurable in settings
> 
> 3. **Protocol Handlers** (if requested)
>    - https://www.electronjs.org/docs/latest/api/app#appsetasdefaultprotocolclientprotocol-path-args
>    - Register `synthesis://` scheme
>    - Handle URLs like `synthesis://collection/123`
> 
> 4. **Auto-Start** (if requested)
>    - https://www.electronjs.org/docs/latest/api/app#appsetloginitemsettingssettings
>    - Option in settings to launch on boot
>    - Start minimized to tray
> 
> 5. **Multi-Workspace** (if requested)
>    - Support multiple Synthesis instances
>    - Different data directories, ports, configs
>    - Workspace selector in UI
> 
> 6. **Auto-Update** (if requested)
>    - https://www.electronjs.org/docs/latest/api/auto-updater
>    - Check for updates on launch
>    - Download and install in background
> 
> 7. **Config Editor** (if requested)
>    - UI for editing `.env` variables
>    - Validation (e.g., API keys, URLs)
>    - Auto-restart backend on save
> 
> **Exit criteria:**
> - Feature works as specified
> - Feature behind config flag (can be disabled)
> - Documentation updated
> - ~200 lines per feature
> 
> **Constraints:**
> - Only implement when explicitly requested
> - Each feature self-contained (no dependencies between features)
> - Keep it simple - MVP implementation

---

### Final Integration (After All Phases Complete)

> **CRITICAL - Final PR to develop:**
> ```bash
> # After Phase 1, 2, and 3 are all merged to feature/phase-18-desktop-app
> git checkout feature/phase-18-desktop-app
> git pull origin feature/phase-18-desktop-app
> 
> # Test the complete desktop app thoroughly:
> pnpm --filter @synthesis/desktop dev
> # Test all features:
> # - Start/stop via Docker
> # - Start/stop via Dev mode
> # - MCP server/tool toggles
> # - Log viewer
> # - Status dashboard
> # - Error handling
> 
> # When fully tested and working, open PR to develop:
> gh pr create --base develop \
>   --head feature/phase-18-desktop-app \
>   --title "feat: Phase 18 - Synthesis Desktop App (Complete)" \
>   --body "Complete Electron-based desktop app with:\n\n- Docker orchestration\n- MCP management UI\n- Dev mode support\n- Status dashboard\n- Cross-platform packaging\n\nCloses #<issue-number>"
> 
> # Do NOT merge until:
> # ✅ All CI checks pass
> # ✅ Manual testing complete
> # ✅ PR reviewed and approved
> ```

---

### Summary

**Phase breakdown:**
- Phase 1: Core shell + Docker (~120k tokens, 1 day)
- Phase 2: MCP + Dev + Logs (~130k tokens, 1 day)
- Phase 3: Status + Packaging (~140k tokens, 1 day)
- Phase 4: Advanced features (~100k tokens each, on-demand)

**Total: 3 days for core functionality**

**Branching strategy:**
- Each phase: `feature/desktop-phase-N` → PR to `feature/phase-18-desktop-app`
- Final: `feature/phase-18-desktop-app` → PR to `develop`
- See `03_DESKTOP_APP_REPO_AND_WORKFLOW.md` lines 13-47 for full workflow

All phases reference:
- Build plan: `02_DESKTOP_APP_BUILD_PLAN.md` (lines 1-188)
- Tech stack: `06_DESKTOP_APP_TECH_STACK.md` (lines 1-104)
- Architecture: `01_DESKTOP_APP_ARCHITECTURE.md` (lines 1-148)
- Workflow: `03_DESKTOP_APP_REPO_AND_WORKFLOW.md` (lines 26-94)
