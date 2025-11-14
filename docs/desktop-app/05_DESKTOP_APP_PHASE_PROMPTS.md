## Synthesis Desktop App — Phase Prompts for Implementation Agents

**Version:** 1.0  
**Date:** 2025-11-13

---

### General System Prompt

> **System Prompt (Desktop App)**  
> You are an experienced full-stack engineer working on the Synthesis project.  
> Synthesis is a RAG system with a Fastify backend, React frontend, PostgreSQL/pgvector, and MCP integrations.  
> Your task in this phase is to implement part of the Synthesis Desktop app, which is a thin wrapper around the existing Synthesis stack.  
> You must follow the design and constraints in `docs/desktop-app/*` and the existing architecture docs.  
> Do not over-engineer: prefer small, incremental changes.  
> Reuse existing code and workflows wherever possible.  
> Do not duplicate RAG logic or UI in native code; use the existing server and web UI.  
> When in doubt, document trade-offs and choose the simplest workable approach.

You can combine this system prompt with the phase-specific user prompts below.

---

### Phase 1 — Desktop Shell Scaffolding

> **User Prompt (Phase 1)**  
> Phase: 1 — Desktop Shell Scaffolding.  
> Objective: Create `apps/desktop` and a minimal desktop app that opens a window pointing to the Synthesis web UI.  
> 
> 1. Read:  
>    - `docs/desktop-app/00_DESKTOP_APP_OVERVIEW.md`  
>    - `docs/desktop-app/01_DESKTOP_APP_ARCHITECTURE.md`  
>    - `docs/desktop-app/06_DESKTOP_APP_TECH_STACK.md` (for framework choice).  
> 2. Scaffold `apps/desktop` as a new app in the pnpm workspace using the chosen framework (Electron or Tauri).  
> 3. Implement a main process that opens a single window pointing at a configurable `SYNTHESIS_URL` (e.g., `http://localhost:5173`).  
> 4. Add minimal scripts to run the desktop app in dev mode.  
> 5. Do not implement orchestration or complex UI yet; focus on proving that the desktop shell can host the web UI.  
> 
> Constraints:  
> - No changes to the Synthesis backend or web app.  
> - Keep dependencies minimal.  
> - Ensure the app builds and runs on your primary dev OS.

---

### Phase 2 — Service Orchestration (Docker-first)

> **User Prompt (Phase 2)**  
> Phase: 2 — Service Orchestration (Docker-first).  
> Objective: Allow the desktop app to start and stop the Synthesis backend via Docker.  
> 
> 1. Read:  
>    - `docs/desktop-app/01_DESKTOP_APP_ARCHITECTURE.md` (runtime flow).  
>    - `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` (Phase 2).  
> 2. Implement checks for Docker availability and show friendly errors if not present.  
> 3. Add “Start Synthesis” and “Stop Synthesis” controls that:  
>    - Run `docker compose up -d` using the repo’s `docker-compose.yml`.  
>    - Run `docker compose down` to stop services.  
> 4. Implement simple health checks (HTTP) to wait for the server to be ready before opening the web UI.  
> 5. Keep logging simple: show a short status or toast when starting/stopping.  
> 
> Constraints:  
> - Do not introduce a complex process manager; shelling out is acceptable.  
> - Focus on Docker mode; direct process mode will be added later.  
> - Fail gracefully if Docker is missing.

---

### Phase 3 — Direct Process Mode (Dev Convenience)

> **User Prompt (Phase 3)**  
> Phase: 3 — Direct Process Mode.  
> Objective: Add a developer-only mode that runs the Synthesis server and web dev servers directly (without Docker).  
> 
> 1. Read:  
>    - `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` (Phase 3).  
> 2. Add configuration to choose between Docker mode and direct process mode (env or simple UI toggle).  
> 3. In direct mode, spawn the Node processes for server and web dev (e.g., `pnpm --filter @synthesis/server dev` and `pnpm --filter @synthesis/web dev`).  
> 4. Ensure processes are monitored and terminated cleanly on stop/exit.  
> 5. Keep logs minimal but accessible if needed for debugging.  
> 
> Constraints:  
> - Direct mode is optional and mainly for you as the developer; it’s okay if Docker remains the recommended path for others.  
> - Avoid complicated process supervision frameworks; basic spawn/kill is acceptable.

---

### Phase 4 — Status, Logs, and UX Polish

> **User Prompt (Phase 4)**  
> Phase: 4 — Status, Logs, and UX Polish.  
> Objective: Improve the desktop UX with clear service status indicators and basic log display.  
> 
> 1. Read:  
>    - `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` (Phase 4).  
> 2. Implement visual indicators for the status of core services (server, web, DB, MCP if possible).  
> 3. Surface common errors (Docker unavailable, port conflicts, health check failures) with human-readable messages.  
> 4. Add a simple log or “recent events” view that shows key startup/shutdown messages, not a full log viewer.  
> 
> Constraints:  
> - Keep UI minimal and clean.  
> - Don’t build a full log management tool; just enough to debug common issues.

---

### Phase 5 — Packaging & Distribution

> **User Prompt (Phase 5)**  
> Phase: 5 — Packaging & Distribution.  
> Objective: Configure packaging and CI for building installable desktop binaries.  
> 
> 1. Read:  
>    - `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md` (Phase 5).  
>    - `docs/desktop-app/03_DESKTOP_APP_REPO_AND_WORKFLOW.md`.  
> 2. Configure packaging (Electron Builder or equivalent) for at least Linux and macOS.  
> 3. Integrate this into a GitHub Actions workflow that builds artifacts on tagged releases.  
> 4. Ensure versioning aligns with Synthesis server/web releases or has a clear mapping.  
> 
> Constraints:  
> - Start with a minimal set of targets; you can add Windows later.  
> - Avoid overly complex release automation; a straightforward “build on tag” workflow is enough.

---

### Phase 6 — Optional Enhancements

> **User Prompt (Phase 6)**  
> Phase: 6 — Optional Enhancements.  
> Objective: Add one or more quality-of-life features that make the desktop app more pleasant to use, without major complexity.  
> 
> 1. Review the optional enhancement ideas in `docs/desktop-app/02_DESKTOP_APP_BUILD_PLAN.md`.  
> 2. Pick one high-value feature (e.g., auto-update checks, quick links to logs/docs, simple env var editor).  
> 3. Design and implement it in a way that’s easy to disable or extend later.  
> 4. Update documentation and, if needed, GitHub issues to reflect the new capability.  
> 
> Constraints:  
> - Keep each enhancement small.  
> - Avoid features that significantly expand scope (e.g., complex settings UIs, user management).

---

### Summary

These prompts give you a **structured way** to guide future implementation agents through the desktop app work:

- Each phase has a clear objective, references, and constraints.
- The system prompt enforces the “thin wrapper, no over-engineering” philosophy.
- As with the Agent SDK docs, these can be copied directly into an agent’s instructions when you’re ready to build.