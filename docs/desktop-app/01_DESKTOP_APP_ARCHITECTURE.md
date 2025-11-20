## Synthesis Desktop App — Architecture

**Version:** 1.0  
**Date:** 2025-11-20

---

### 1. Design Goals

- **Reuse existing Synthesis stack** (backend, DB, web UI, MCP).
- **Minimal new logic**: thin wrapper around HTTP/API and Docker workflows.
- **Cross-platform**: Linux (primary), macOS, Windows.
- **Simple install & run** for personal use; scalable for distribution.
- **MCP Management**: UI to toggle MCP servers and tools on/off.

We explicitly do **not** want to:

- Re-implement UI or RAG logic in native frameworks.
- Maintain multiple divergent codebases.

---

### 2. Chosen Architecture

**Option: Monorepo with `apps/desktop`**

Desktop app lives **inside the existing Synthesis repo** as another app in the pnpm workspace:
- `apps/server` — Fastify backend
- `apps/web` — React web UI
- `apps/mcp` — MCP server
- `apps/desktop` — **Electron-based desktop shell** (new)

**Advantages:**
- Single repo/workspace: shared `pnpm-lock.yaml`, TypeScript, CI
- Desktop and server versions aligned (same commit)
- Unified releases (backend + desktop binaries)

**Alternative considered (rejected):**
- Separate repo (`synthesis-desktop`) → rejected due to version sync complexity and duplication

---

### 3. Component Overview

1. **Desktop Shell (`apps/desktop`)**
   - **Framework:** Electron 33.2.0 + TypeScript 5.7.2 (see `06_DESKTOP_APP_TECH_STACK.md` lines 15-38)
   - **Responsibilities:**
     - Start/stop Synthesis backend (Docker or direct processes)
     - Display web UI in Electron BrowserWindow
     - Show status dashboard (DB, server, web, MCP)
     - MCP management UI (toggle servers/tools)
     - Log viewer

2. **Synthesis Backend Stack** (unchanged)
   - **Server:** `apps/server` (Fastify + Node 22.20.0)
   - **Web UI:** `apps/web` (React + Vite)
   - **DB:** Postgres 16 + pgvector (Docker or local)
   - **MCP:** `apps/mcp` (MCP server)
   - **Models:** Ollama (optional, Docker or local)

3. **Launch Orchestration**

**Primary mode: Docker**
- Desktop app → `docker compose up/down` using `docker-compose.yml`
- Assumes Docker installed (check on first run)

**Dev mode: Direct processes**
- Desktop app → spawn `pnpm --filter @synthesis/server dev` and `pnpm --filter @synthesis/web dev`
- Monitor stdout/stderr
- Clean termination on stop

---

### 4. Runtime Flow

1. User launches Synthesis Desktop
2. Desktop shows control UI (status dashboard + buttons)
3. User clicks **"Start Synthesis"**:
   - Check Docker available (if Docker mode)
   - Check ports free (3333, 5173)
   - Run `docker compose up -d` (or spawn dev processes)
   - Poll `http://localhost:3333/health` every 2s until ready
   - Update status indicators: DB → Server → Web → MCP
4. When healthy:
   - Open BrowserWindow → `http://localhost:5173`
   - Continue polling status every 5s
5. User clicks **"Stop Synthesis"**:
   - Run `docker compose down` (or kill processes)
   - Update status to Stopped

**MCP Management Flow:**
1. User opens MCP settings panel
2. Desktop reads current MCP config
3. User toggles servers/tools on/off
4. Desktop writes new config
5. Desktop restarts backend to apply changes

---

### 5. Responsibilities

**Desktop app (new):**
- Service orchestration (start/stop)
- Status monitoring and health checks
- MCP server/tool management UI
- Environment checks (Docker, ports)
- Log viewer
- Packaging and distribution

**Synthesis (existing, unchanged):**
- All RAG logic and APIs
- Agent tools and MCP servers
- Data storage and search
- Web UI and React components

**No overlap:** Desktop does not duplicate any RAG/agent logic.

---

### 6. Deployment Targets

**Primary:** Linux (WSL2 + native Linux)  
**Secondary:** macOS, Windows

**Packaging with electron-builder 25.1.8:**
- Linux: `.AppImage` (universal) or `.deb` (Debian/Ubuntu)
- macOS: `.dmg` (drag-and-drop installer)
- Windows: `.exe` (NSIS installer)

**CI/CD:** GitHub Actions builds all platforms on tag push.  
See `03_DESKTOP_APP_REPO_AND_WORKFLOW.md` (lines 104-138) for workflow details.

---

### 7. Constraints

- **No complex plugin system**
- **No duplicate config** (use existing env vars)
- **No embedded DB/models** (use Docker/external services)
- **Desktop remains a thin wrapper**, not a new platform

---

**Cross-references:**
- Build plan: `02_DESKTOP_APP_BUILD_PLAN.md` (lines 1-188)
- Tech stack: `06_DESKTOP_APP_TECH_STACK.md` (lines 1-104)
- CI/CD: `03_DESKTOP_APP_REPO_AND_WORKFLOW.md` (lines 104-138)
