## Synthesis Desktop App — Architecture

**Version:** 1.0  
**Date:** 2025-11-13

---

### 1. Design Goals

- **Reuse existing Synthesis stack** (backend, DB, web UI, MCP).
- **Minimal new logic**: the desktop app should be a thin wrapper around the existing HTTP/API and Docker workflows.
- **Cross-platform**: Linux, macOS, Windows.
- **Simple install & run** for you; scalable later if you share binaries with others.

We explicitly do **not** want to:

- Re-implement the UI or RAG logic in native frameworks.
- Maintain multiple divergent codebases for Synthesis.

---

### 2. Architecture Options

We consider two main patterns.

#### Option A — Monorepo Desktop App (`apps/desktop`)

- Desktop app lives **inside the existing Synthesis repo** as another app in the pnpm workspace:
  - `apps/server` — Fastify backend.
  - `apps/web` — React web UI.
  - `apps/mcp` — MCP server.
  - `apps/desktop` — new Electron/Tauri-based desktop shell.

**Pros:**

- Single repo and workspace: shared `pnpm-lock.yaml`, TypeScript config, and CI.
- Desktop and server versions are implicitly aligned (same commit).
- Easier to publish releases that combine backend/server images and desktop binaries.

**Cons:**

- Repo becomes slightly heavier, but you’re already using a monorepo.

#### Option B — Separate Desktop Repo (`synthesis-desktop`)

- Desktop app lives in a separate repo, depending on Synthesis via:
  - Git submodule, or
  - HTTP/Docker images.

**Pros:**

- Can have its own release cadence and contributors.

**Cons:**

- Extra complexity keeping Synthesis server versions in sync with the desktop version.
- More duplication and cross-repo coordination.

**Recommendation:** **Option A (Monorepo)** — add `apps/desktop` to the existing workspace. This matches your preference for not over-engineering.

---

### 3. Component Overview

In the monorepo approach, the desktop system consists of:

1. **Desktop Shell App (`apps/desktop`)**
   - Built with a desktop framework (see tech stack doc):
     - Likely **Electron** (Node + Chromium) or **Tauri** (Rust + WebView).
   - Responsibilities:
     - Start/stop the Synthesis backend stack (directly or via Docker).
     - Display the existing web UI inside a browser window.
     - Show minimal status (running/not running, ports, errors).

2. **Synthesis Backend Stack**
   - **Server**: `apps/server` (Fastify, Node). 
   - **Web UI**: `apps/web` (React/Vite).
   - **DB**: Postgres+pgvector (via Docker or local service).
   - **Optional models**: Ollama, etc., as already configured.

3. **Launch Orchestration**

Two pragmatic approaches:

- **Docker-first orchestration (simpler for distribution)**
  - Desktop app shells out to `docker compose up` / `down` with the existing `docker-compose.yml`.
  - Assumes user has Docker/Podman installed.

- **Direct process orchestration (for local dev)**
  - Desktop app spawns `pnpm dev` or equivalent for server/web, and ensures Postgres is running.
  - More flexible for you during development; less ideal for wider distribution.

**Recommendation:** Support **Docker-first** as the primary mode for end users; keep **direct process** mode as a dev convenience.

---

### 4. Runtime Flow

1. User launches Synthesis Desktop.
2. Desktop app checks prerequisites:
   - Docker available? (if using Docker mode)
   - Ports free? (e.g., 3333 for server, 5173 for web).
3. When user clicks **“Start Synthesis”**:
   - Desktop app runs `docker compose up` (or equivalent) for Synthesis services.
   - Waits until the health checks pass (e.g., server responding on `/health`).
4. When backend is ready:
   - Desktop app opens a window pointing to `http://localhost:5173` (web UI) or a pre-bundled production build served by the backend.
5. **Stop Synthesis**:
   - Desktop app runs `docker compose down` or sends a shutdown signal to the processes.

Throughout, the desktop app may poll simple status endpoints and show green/yellow/red indicators.

---

### 5. Desktop App Responsibilities vs Synthesis Responsibilities

**Desktop app (new):**

- Service orchestration UI (start/stop).
- Basic environment checks.
- Hosting the web UI.
- Packaging (building installers/binaries).

**Synthesis (existing):**

- All RAG logic and APIs.
- Agents, tools, and MCP servers.
- Data storage and search.
- Web UI capabilities.

This separation ensures you don’t double-implement features.

---

### 6. Deployment Targets & Binaries

Target platforms (initially):

- Linux (your current environment + broader desktop users).
- macOS (if you want to share with others).
- Windows (if desired; Tauri/Electron both support it).

Basic plan:

- Use the desktop framework’s tooling (Electron Builder / Tauri bundler) to create:
  - `.AppImage` or `.deb` for Linux.
  - `.dmg`/`.pkg` for macOS.
  - `.exe`/installer for Windows.

CI/CD details and GitHub workflow are described in `03_DESKTOP_APP_REPO_AND_WORKFLOW.md`.

---

### 7. Non-Goals and Constraints

- **No complex plugin system** inside the desktop app.
- **No duplicate configuration** (env vars should be shared or passed through to the server where possible).
- **No monolithic binary that embeds DB + models** on day one — that would be over-engineered and heavy.

The desktop app should remain a **convenience wrapper**, not a new platform.
