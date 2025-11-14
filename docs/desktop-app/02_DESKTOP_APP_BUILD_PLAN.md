## Synthesis Desktop App — Build Plan

**Version:** 1.0  
**Date:** 2025-11-13

---

### Overview

This document lays out a **phased build plan** for the Synthesis Desktop app, assuming the architecture chosen in `01_DESKTOP_APP_ARCHITECTURE.md` (monorepo, `apps/desktop`, thin wrapper around existing stack).

Each phase is designed to be small and focused to avoid over-engineering.

---

### Phase 1 — Desktop Shell Scaffolding

**Goal:** Create a minimal desktop app that can open a window pointing at the existing Synthesis web UI.

**Tasks:**

1. **Scaffold `apps/desktop`**
   - Add a new app under pnpm workspace: `apps/desktop`.
   - Choose desktop framework (see `06_DESKTOP_APP_TECH_STACK.md`):
     - Likely **Electron + TypeScript** initially, to stay close to existing Node/TS tooling.
   - Add basic scripts:
     - `pnpm --filter @synthesis/desktop dev`
     - `pnpm --filter @synthesis/desktop build`

2. **Minimal window open**
   - Implement a main process that:
     - Creates a single window.
     - Loads a configurable URL (e.g., `http://localhost:5173`).

3. **Configuration**
   - Read base URL from env (e.g., `SYNTHESIS_URL=http://localhost:5173`).

**Exit Criteria:**

- Running `pnpm --filter @synthesis/desktop dev` opens a desktop window pointed at the, already-running, Synthesis web UI.

---

### Phase 2 — Service Orchestration (Docker-first)

**Goal:** Let the desktop app start/stop the Synthesis backend via Docker.

**Tasks:**

1. **Prerequisite checks**
   - From the desktop app, detect whether Docker is installed and running.
   - Provide clear error messaging if not available.

2. **Start/stop commands**
   - Wire UI buttons to shell out to:
     - `docker compose up -d` (using the repo’s `docker-compose.yml`).
     - `docker compose down`.
   - Optionally allow configuration of the Docker command for users with Podman or alternative setups.

3. **Health checks**
   - Implement simple checks (HTTP requests) to:
     - `http://localhost:3333/health` (or equivalent) for the server.
     - Optionally `http://localhost:5173` for the frontend.
   - Display basic status in the UI: starting, running, error.

**Exit Criteria:**

- User can click “Start Synthesis” and the desktop app will:
  - Run Docker compose.
  - Wait for health checks to pass.
  - Open the web UI when ready.
- User can click “Stop Synthesis” and the app will bring down the stack.

---

### Phase 3 — Direct Process Mode (Dev Convenience)

**Goal:** Support a mode for you as a developer to run Synthesis without Docker via the desktop app.

**Tasks:**

1. **Mode selection**
   - Config flag (env or UI) to choose between **Docker mode** and **Direct process mode**.

2. **Process spawning**
   - In direct mode, spawn:
     - `pnpm --filter @synthesis/server dev` (or equivalent).
     - `pnpm --filter @synthesis/web dev`.
   - Monitor stdout/stderr and surface basic logs/errors.

3. **Shutdown**
   - Ensure processes are terminated cleanly when the desktop app exits or when the user clicks “Stop Synthesis”.

**Exit Criteria:**

- In dev mode, a single start in the desktop app can launch the server and web dev servers.
- Clean shutdown works reliably.

---

### Phase 4 — Status, Logs, and UX Polish

**Goal:** Improve the desktop UX with status indicators and basic diagnostics.

**Tasks:**

1. **Status indicators**
   - Show per-service status: DB, server, web, MCP, models (if possible).
   - Keep this simple: green/amber/red, plus short text messages.

2. **Logs**
   - Provide an optional panel or view where recent logs (or error summaries) are shown.
   - Focus on: startup failures, port conflicts, Docker errors.

3. **Error handling**
   - Gracefully handle cases where:
     - Ports are already in use.
     - Services crash after startup.

**Exit Criteria:**

- User can understand at a glance whether Synthesis is healthy from the desktop UI.
- Common errors are surfaced in a human-readable way.

---

### Phase 5 — Packaging & Distribution

**Goal:** Build distributable binaries/installers for major platforms.

**Tasks:**

1. **Build configuration**
   - Use Electron Builder (or equivalent) to configure packaging for:
     - Linux (AppImage or `.deb`).
     - macOS (`.dmg`/`.pkg`).
     - Windows (`.exe`/installer).

2. **Environment and config**
   - Ensure the desktop app can find:
     - The repo’s `docker-compose.yml`.
     - Default ports and URLs.
   - Decide how to handle config per environment (dev vs packaged release).

3. **GitHub Actions CI**
   - Add workflows to:
     - Build desktop packages on tagged releases.
     - Attach artifacts to GitHub releases.

**Exit Criteria:**

- Simple installable artifacts exist for at least Linux and macOS.
- CI can produce these artifacts on demand.

---

### Phase 6 — Optional Enhancements

**Goal:** Add quality-of-life features as needed, without over-engineering.

Possible tasks (only if they provide clear value):

- Auto-update checks for new desktop versions.
- Quick links to open Synthesis docs, logs, and config.
- Basic configuration editor for Synthesis env vars (write `.env.local` or similar).

---

### Summary

This build plan keeps the Synthesis Desktop app **very thin**:

- It orchestrates Docker or dev processes.
- It reuses the existing web UI and backend.
- It avoids duplicating RAG or agent logic.

A future implementation agent can follow this plan phase by phase, using `05_DESKTOP_APP_PHASE_PROMPTS.md` for scoped instructions and `04_DESKTOP_APP_GITHUB_ISSUES.md` to create tracking issues in GitHub.