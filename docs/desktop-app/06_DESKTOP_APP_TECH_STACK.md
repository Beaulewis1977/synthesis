## Synthesis Desktop App — Tech Stack & Versions

**Version:** 1.0  
**Date:** 2025-11-20

---

### 1. Chosen Tech Stack

**Framework:** Electron + TypeScript  
**Reason:** WSL2 compatible, pure TypeScript, fast development, massive ecosystem.

---

### 2. Specific Versions (as of Nov 2025)

#### 2.1 Runtime & Package Manager

- **Node.js:** `22.20.0` (current LTS, already in use)
- **pnpm:** `9.14.2` (current stable)
- **TypeScript:** `5.7.2` (matches repo-wide version)

**Version management:**
- Use `.nvmrc` set to `22.20.0`
- Use `pnpm-lock.yaml` for reproducible installs

#### 2.2 Desktop Framework

- **Electron:** `33.2.0` (latest stable Nov 2025)
- **electron-builder:** `25.1.8` (for packaging)

**Why Electron (not Tauri):**
- ✅ WSL2 works out of box (critical for your environment)
- ✅ Pure TypeScript (no Rust toolchain needed)
- ✅ Fast implementation (~1-2 days vs 3-4 with Tauri)
- ✅ Huge ecosystem, well-documented
- ⚠️ Larger bundle (~150MB vs Tauri's ~3MB, acceptable for desktop use)

---

### 3. Documentation Links for Implementation

#### Core Electron

- **Main:** https://www.electronjs.org/docs/latest/
- **Quick Start:** https://www.electronjs.org/docs/latest/tutorial/quick-start
- **Process Model:** https://www.electronjs.org/docs/latest/tutorial/process-model
- **TypeScript Setup:** https://www.electronjs.org/docs/latest/tutorial/typescript

#### Packaging

- **electron-builder:** https://www.electron.build/
- **Configuration:** https://www.electron.build/configuration/configuration
- **Code Signing:** https://www.electron.build/code-signing

#### Node.js APIs (for orchestration)

- **child_process.spawn:** https://nodejs.org/api/child_process.html#child_processspawncommand-args-options
- **child_process.exec:** https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback

#### Docker Integration

- **Docker Compose CLI:** https://docs.docker.com/compose/reference/
- **docker compose up:** https://docs.docker.com/compose/reference/up/
- **docker compose down:** https://docs.docker.com/compose/reference/down/

#### Health Checks

- **Node Fetch:** https://github.com/node-fetch/node-fetch (for HTTP health checks)

---

### 4. UI Layer

**Desktop control UI:** Minimal Electron renderer with:
- Start/stop buttons
- Status indicators
- MCP server/tool toggles
- Basic logs

**Main app UI:** Existing Synthesis web frontend (React/Vite) loaded in Electron BrowserWindow.

No additional frontend frameworks needed beyond what's already in the monorepo.

---

### 5. External Dependencies

**Required:**
- **Docker:** Use existing `docker-compose.yml` from repo

**Optional (dev mode):**
- Local Postgres/Ollama (instead of Docker)

**Not embedding:** DB, Ollama, or other heavy services in binary.

---

### 6. Summary

- **Node.js 22.20.0** + **pnpm 9.14.2** + **TypeScript 5.7.2**
- **Electron 33.2.0** + **electron-builder 25.1.8**
- Pure TypeScript, WSL2 compatible, fast to implement
- Minimal dependencies, reuses existing Synthesis stack