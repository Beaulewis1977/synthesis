## Synthesis Desktop App — Tech Stack & Versions

**Version:** 1.0  
**Date:** 2025-11-13

---

### 1. Goals for the Tech Stack

- Align with the existing Synthesis stack where possible.
- Use **stable, well-supported tools** with good ecosystem support.
- Avoid introducing heavy or exotic technologies that would over-complicate setup.

---

### 2. Core Choices

#### 2.1 Node.js & Package Manager

- **Node.js:** use the same LTS version as Synthesis:
  - Recommended: **Node.js 20 LTS** (matches Anthropic TypeScript SDK’s supported runtimes and modern TS tooling) — see the `@anthropic-ai/sdk` README’s supported runtimes for Node 20 LTS guidance.
- **Package manager:** `pnpm` (already in use in this repo).
- **Version management:**
  - Keep `.nvmrc` pointing to Node 20 LTS.
  - Use `pnpm-lock.yaml` for reproducible installs.

#### 2.2 Desktop Framework

Two realistic options that work well with your existing TypeScript/React experience:

- **Option A: Electron + TypeScript** (recommended starting point)
  - Pros:
    - Very mature ecosystem and tooling.
    - Pure JS/TS stack; no Rust/C++ needed.
    - Easy integration with Node/Pnpm monorepo.
  - Cons:
    - Heavier runtime (bundled Chromium).

- **Option B: Tauri + TypeScript**
  - Pros:
    - Lightweight bundle; uses system webview.
    - Good security model.
  - Cons:
    - Requires Rust toolchain.
    - Slightly more complex initial setup if you’re not already using Rust.

**Recommendation:** Start with **Electron + TypeScript** for the first version of Synthesis Desktop to keep everything in the TypeScript/Node ecosystem.

#### 2.3 UI Layer

- The desktop app will mostly:
  - Use Electron’s main process to orchestrate services.
  - Use a minimal renderer (front-end) for:
    - Start/stop buttons.
    - Status indicators.
    - Basic logs.
- The main **RAG UI** remains the existing Synthesis web frontend (React/Vite), loaded inside a webview.

---

### 3. Suggested Versions (Initial Baseline)

> Note: These are starting points; you can adjust to the latest stable LTS at the time you implement.

- **Node.js:** 20.x LTS (e.g., `20.18.0`).
- **pnpm:** 9.x (matching current repo tooling).
- **Electron:** latest stable major at the time of implementation (e.g., ~`31.x`+). When you start, pick the then-current stable and record it here.
- **TypeScript:** follow repo-wide version (already in `pnpm-lock.yaml`).

You do not need additional frontend frameworks inside the desktop app beyond minimal UI components; reusing the Synthesis web UI is the priority.

---

### 4. Tooling & Configuration

#### 4.1 Node & pnpm

- Use existing `nvm` + `.nvmrc` to pin Node version.
- Run `pnpm install` at repo root; desktop app will be part of the workspace.

#### 4.2 Electron Config

- Basic config files:
  - `apps/desktop/package.json` with scripts (`dev`, `build`).
  - Main process entry file (`main.ts` or `main.js`).
  - Electron Builder config (if used) for packaging.

- Favor simple, well-documented defaults; avoid advanced Electron features unless needed.

---

### 5. External Dependencies

The desktop app relies on external services rather than embedding everything:

- **Docker** (for production-style local runs):
  - Use existing `docker-compose.yml` from the Synthesis repo.
- **Local Postgres/Ollama/etc.** (optional):
  - For dev mode, you may rely on local services instead of Docker.

We do **not** plan to embed Postgres or Ollama in the desktop binary in the first version.

---

### 6. Best Practices & Non-Goals

- **Best practices:**
  - Keep dependency list short; avoid pulling in large UI kits just for status indicators.
  - Use TypeScript for type safety, consistent with the rest of the repo.
  - Keep all environment-specific configuration in `.env` files or Electron’s config rather than hardcoding paths.

- **Non-goals:**
  - No native OS-specific UI beyond what is truly needed.
  - No complex plugin/add-on system for the desktop app.
  - No bundling of heavy, long-running services inside the desktop binary itself.

---

### Summary

- The desktop app tech stack should mirror Synthesis where possible: Node 20 LTS, TypeScript, pnpm, and a simple Electron wrapper.
- This keeps the learning curve low, leverages existing tooling, and avoids over-engineering while still giving you a convenient way to run and manage Synthesis locally.