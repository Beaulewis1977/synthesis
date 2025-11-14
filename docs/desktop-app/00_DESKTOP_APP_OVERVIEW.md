## Synthesis Desktop App — Overview

**Version:** 1.0  
**Date:** 2025-11-13

---

### Purpose

This folder (`docs/desktop-app`) defines a **high-level plan** for creating a desktop version of Synthesis.

The goals:

- Provide a **desktop shell** for Synthesis so you can:
  - Start/stop the Synthesis backend stack from a desktop UI.
  - Use the existing web UI in a window without manually managing browser tabs and Docker commands.
  - Optionally bundle services (DB, Ollama, etc.) or at least orchestrate them.
- Keep the solution **simple and not over-engineered**:
  - Reuse the existing web frontend and backend.
  - Avoid duplicating logic already handled in the main repo.
  - Treat the desktop app as a thin wrapper around the server + web UI.

This is **planning only**; no implementation is done here.

---

### High-Level Approach

We will treat Synthesis Desktop as:

- A **separate app** that:
  - Starts the Synthesis backend (via Docker or direct processes) on localhost.
  - Hosts the web UI in a desktop window via a webview (Electron or Tauri).
- A **thin client** around the existing architecture:
  - All RAG logic, DB, and MCP servers remain in the existing Synthesis codebase.
  - The desktop shell focuses on orchestration and UX.

This avoids rewriting the RAG pipeline or backend and leverages what is already working.

---

### Recommended Strategy

- Keep Synthesis as the **source of truth** in this repo (`synthesis` monorepo).
- Create a **desktop shell app** that depends on Synthesis:
  - Either in this repo as `apps/desktop` (monorepo approach), or
  - In a new repo (e.g. `synthesis-desktop`) that treats Synthesis as a dependency.
- Recommended (to avoid over-engineering and duplication):
  - Use the **monorepo approach** and create `apps/desktop` in this repo.
  - This keeps versions of server + desktop shell aligned at the same commit.

GitHub workflow details and options are described in `03_DESKTOP_APP_REPO_AND_WORKFLOW.md`.

---

### Target User Experience

For you (and future users), the desktop app should:

- On first run:
  - Guide the user through initial setup (install Docker or configure local Postgres/Ollama if used).
  - Optionally check for `docker-compose` and prompt to start the stack.
- On normal use:
  - Provide buttons like **“Start Synthesis”**, **“Stop Synthesis”**, **“Open UI”**.
  - Open the existing Synthesis web UI in a native window.
- For advanced users:
  - Show health/status of services (DB, server, MCP, Ollama, etc.) at a simple level.
  - Expose basic logs/error messages.

We do **not** want to rebuild all Synthesis UI in a native toolkit; we reuse the web app.

---

### Scope & Non-Goals

**In scope:**

- Desktop shell (Electron/Tauri) which:
  - Manages the lifecycle of the Synthesis backend stack.
  - Embeds the existing web UI.
  - Provides minimal status/diagnostics.
- CI/CD and GitHub strategy for building desktop binaries for major platforms.

**Out of scope (for now):**

- Deep OS-specific integrations (tray icons, global hotkeys, protocol handlers).
- Complex multi-tenant or sync features.
- Running Claude/LLM models locally (still handled by Synthesis backend / external providers).

---

### Documents in This Folder

- `00_DESKTOP_APP_OVERVIEW.md` — this overview.
- `01_DESKTOP_APP_ARCHITECTURE.md` — detailed architecture options and chosen design.
- `02_DESKTOP_APP_BUILD_PLAN.md` — phased build plan and tasks for implementation.
- `03_DESKTOP_APP_REPO_AND_WORKFLOW.md` — GitHub repository and workflow strategy.
- `04_DESKTOP_APP_GITHUB_ISSUES.md` — proposed issues cross-referenced with phases.
- `05_DESKTOP_APP_PHASE_PROMPTS.md` — prompts for implementation agents per phase.
- `06_DESKTOP_APP_TECH_STACK.md` — recommended tech stack, versions, and tooling.

These docs are meant to be used later when you (or an agent) are ready to actually build the desktop app.