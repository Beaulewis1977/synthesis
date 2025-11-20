## Synthesis Desktop App — Overview

**Version:** 1.0  
**Date:** 2025-11-20

---

### Purpose

This folder (`docs/desktop-app`) defines a **high-level plan** for creating a desktop version of Synthesis.

The goals:

- Provide a **desktop shell** for Synthesis so you can:
  - Start/stop the Synthesis backend stack from a desktop UI.
  - Use the existing web UI in a window without manually managing browser tabs and Docker commands.
  - Manage MCP servers and tools (enable/disable specific servers and tools).
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
  - Hosts the web UI in a desktop window via Electron webview.
- A **thin client** around the existing architecture:
  - All RAG logic, DB, and MCP servers remain in the existing Synthesis codebase.
  - The desktop shell focuses on orchestration and UX.

This avoids rewriting the RAG pipeline or backend and leverages what is already working.

---

### Chosen Strategy

- Keep Synthesis as the **source of truth** in this repo (`synthesis` monorepo).
- Create a **desktop shell app** in this repo as `apps/desktop` (monorepo approach).
- This keeps versions of server + desktop shell aligned at the same commit.

GitHub workflow details are in `03_DESKTOP_APP_REPO_AND_WORKFLOW.md` (lines 8-42).

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

- Desktop shell (Electron) which:
  - Manages the lifecycle of the Synthesis backend stack.
  - Embeds the existing web UI.
  - Provides minimal status/diagnostics.
  - MCP server and tool management UI.
- CI/CD and GitHub strategy for building desktop binaries for major platforms.

**Out of scope (for initial release, see Phase 7 in Build Plan):**

- System tray integration.
- Global hotkeys and keyboard shortcuts.
- Protocol handlers (`synthesis://` URLs).
- Auto-start on boot.
- Multi-workspace management.
- Complex multi-tenant or sync features.
- Running Claude/LLM models locally (still handled by Synthesis backend / external providers).

---

### Documents in This Folder

- `00_DESKTOP_APP_OVERVIEW.md` — this overview.
- `01_DESKTOP_APP_ARCHITECTURE.md` — architecture design and component responsibilities (lines 1-161).
- `02_DESKTOP_APP_BUILD_PLAN.md` — 4 phases for implementation (lines 1-177).
- `03_DESKTOP_APP_REPO_AND_WORKFLOW.md` — GitHub repository and CI/CD strategy (lines 1-148).
- `04_DESKTOP_APP_GITHUB_ISSUES.md` — proposed GitHub issues per phase (lines 1-156).
- `05_DESKTOP_APP_PHASE_PROMPTS.md` — agent prompts for each phase (lines 1-180).
- `06_DESKTOP_APP_TECH_STACK.md` — tech stack with specific versions and docs links (lines 1-150).

These docs are meant to be used when you (or an agent) are ready to build the desktop app.