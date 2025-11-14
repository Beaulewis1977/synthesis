## Synthesis Desktop App — Proposed GitHub Issues

**Version:** 1.0  
**Date:** 2025-11-13

---

### Overview

This document defines **issue templates** for building the Synthesis Desktop app, cross-referenced with phases from `02_DESKTOP_APP_BUILD_PLAN.md`.

Suggested labels:

- `desktop-app`
- `electron` (or `tauri`, once chosen)
- `feature`
- `refactor`
- `priority:high` / `priority:medium` / `priority:low`

Milestone name (example):

- `Milestone: Synthesis Desktop v1`

---

### Phase 1 — Desktop Shell Scaffolding

**Issue 1:** `feat(desktop): Scaffold apps/desktop and basic window`

- **Phase:** 1 (Scaffolding)
- **Labels:** `desktop-app`, `feature`, `priority:high`
- **Description:**
  - Create the `apps/desktop` app in the pnpm workspace.
  - Set up the chosen desktop framework.
  - Implement a main process that opens a window pointing at a configurable URL (Synthesis web UI).
- **Acceptance Criteria:**
  - [ ] `apps/desktop` exists and builds.
  - [ ] `pnpm --filter @synthesis/desktop dev` opens a window.
  - [ ] The window points at `SYNTHESIS_URL` (e.g., `http://localhost:5173`).

**Cross-References:**

- `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` — Phase 1.
- `docs/desktop-app/06_DESKTOP_APP_TECH_STACK.md` — tech choices.

---

### Phase 2 — Service Orchestration (Docker-first)

**Issue 2:** `feat(desktop): Add Docker-based start/stop controls`

- **Phase:** 2 (Orchestration — Docker)
- **Labels:** `desktop-app`, `feature`, `priority:high`
- **Description:**
  - Add UI controls to start/stop Synthesis via Docker.
  - Shell out to `docker compose up -d` and `docker compose down` using the repo’s `docker-compose.yml`.
  - Implement basic health checks to confirm when services are ready.
- **Acceptance Criteria:**
  - [ ] "Start Synthesis" and "Stop Synthesis" buttons exist.
  - [ ] Starting triggers Docker compose and waits for server health to be green.
  - [ ] Stopping tears down the stack cleanly.

**Cross-References:**

- `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` — Phase 2.
- `docs/desktop-app/01_DESKTOP_APP_ARCHITECTURE.md` — runtime flow.

---

### Phase 3 — Direct Process Mode (Dev Convenience)

**Issue 3:** `feat(desktop): Implement direct process mode for dev`

- **Phase:** 3 (Direct process mode)
- **Labels:** `desktop-app`, `feature`, `priority:medium`
- **Description:**
  - Add a mode that spawns the Synthesis server and web dev servers directly (without Docker).
  - Allow switching between Docker and direct modes via config.
- **Acceptance Criteria:**
  - [ ] A config flag selects Docker vs direct mode.
  - [ ] In direct mode, server and web dev processes are spawned and monitored.
  - [ ] Processes are shut down cleanly when stopping.

**Cross-References:**

- `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` — Phase 3.

---

### Phase 4 — Status, Logs, and UX Polish

**Issue 4:** `feat(desktop): Display service status and basic logs`

- **Phase:** 4 (Status & Logs)
- **Labels:** `desktop-app`, `feature`, `priority:medium`
- **Description:**
  - Show simple status indicators (running/starting/error) for key services.
  - Provide a log view or panel for recent errors and warnings.
- **Acceptance Criteria:**
  - [ ] Per-service status indicators are visible.
  - [ ] Log output or error summaries can be viewed.
  - [ ] Common failures (port conflict, Docker not available) are clearly communicated.

**Cross-References:**

- `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` — Phase 4.

---

### Phase 5 — Packaging & Distribution

**Issue 5:** `feat(desktop): Configure packaging for desktop binaries`

- **Phase:** 5 (Packaging)
- **Labels:** `desktop-app`, `feature`, `priority:medium`
- **Description:**
  - Set up build configuration for producing installable artifacts on Linux and macOS (and optionally Windows).
  - Add CI workflow(s) to build these artifacts on tagged releases.
- **Acceptance Criteria:**
  - [ ] `pnpm --filter @synthesis/desktop build` produces platform-specific binaries.
  - [ ] GitHub Actions workflow builds desktop artifacts on tag push.
  - [ ] Release notes clearly mention the desktop version.

**Cross-References:**

- `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` — Phase 5.
- `docs/desktop-app/03_DESKTOP_APP_REPO_AND_WORKFLOW.md` — release workflow.

---

### Phase 6 — Optional Enhancements

**Issue 6:** `feat(desktop): Add quality-of-life features`

- **Phase:** 6 (Optional Enhancements)
- **Labels:** `desktop-app`, `feature`, `priority:low`
- **Description:**
  - Add optional features such as:
    - Auto-update checks.
    - Quick links to logs, docs, and config.
    - Simple UI for editing key Synthesis env vars.
- **Acceptance Criteria (examples, not all required at once):**
  - [ ] At least one high-value enhancement is implemented.
  - [ ] Features are behind configuration flags if they add complexity.

**Cross-References:**

- `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` — Phase 6.

---

### Summary

- Each issue is intentionally scoped to a single phase or feature.
- Issues are cross-referenced with the build plan and other docs to make navigation easy for implementation agents.
- You can copy these templates into GitHub when you’re ready to start actual implementation work on the Synthesis Desktop app.