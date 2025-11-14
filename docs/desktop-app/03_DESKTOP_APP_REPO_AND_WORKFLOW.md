## Synthesis Desktop App — Repo & Workflow Strategy

**Version:** 1.0  
**Date:** 2025-11-13

---

### 1. Repository Strategy

We want a strategy that:

- Keeps Synthesis as the **single source of truth** for backend + web.
- Minimizes duplication between web/server and desktop.
- Works well with your existing pnpm monorepo.

#### Recommended: Monorepo with `apps/desktop`

- Keep everything in this repo and add:
  - `apps/desktop` for the desktop shell.
- Use the existing pnpm workspace (`pnpm-workspace.yaml`) to manage dependencies.

**Advantages:**

- One repo = easier mental model.
- Desktop app and server always at compatible versions (same commit).
- CI can build server, web, MCP, and desktop in one place.

#### Alternative: New Repo `synthesis-desktop`

You could also create a separate repo:

- `synthesis-desktop` that depends on:
  - Docker images published from the main Synthesis repo, or
  - Git submodule/remote of Synthesis.

**Trade-offs:**

- Slightly cleaner separation of concerns for contributors.
- But more complex versioning and cross-repo maintenance.

**Conclusion:** For now, **monorepo with `apps/desktop` is recommended** to avoid over-engineering and dual-maintenance.

---

### 2. Branching & Release Workflow

#### Branches

- **`main`**: stable Synthesis (server/web/MCP) + optionally stable desktop.
- **`develop` or feature branches**: new desktop features (`desktop-init`, `desktop-orchestration`, etc.).
- **`agent-sdk`**: as already planned, used for Agent SDK migration on the server side.

Desktop work can be done on dedicated feature branches and merged into `main` once stable.

#### Releases

- Use **Git tags** and GitHub Releases to manage versions.
- Suggested version alignment:
  - Synthesis server/web: `v2.0.x`.
  - Desktop: `v2.0.x-desktop.y` or keep same version if you release them together.

Distribution strategy:

- On a tagged desktop-related release:
  - Build desktop binaries via CI (see build plan).
  - Attach them as assets to the GitHub release.

---

### 3. CI/CD Workflow (High Level)

Assuming GitHub Actions:

1. **Build & Test Workflow** (on PRs and main pushes):
   - Steps:
     - Install Node (LTS) and pnpm.
     - `pnpm install`.
     - `pnpm lint`, `pnpm test`, `pnpm typecheck` for server/web.
     - `pnpm --filter @synthesis/desktop test` (once desktop has tests).

2. **Release Workflow** (on tags like `v2.0.0-desktop.0`):
   - Steps:
     - Build server/web as usual (if desired for container publish).
     - Build desktop app for target platforms.
     - Upload artifacts to the GitHub release.

**Note:** We don’t need a very complex CI initially; just enough to build and test the desktop app alongside the existing services.

---

### 4. GitHub Project Organization

To keep things clear for contributors and your future self:

- Create a **GitHub Project board** (optional) for "Synthesis Desktop".
- Use labels like:
  - `desktop-app`
  - `electron` (or `tauri`), depending on chosen stack.
  - `priority:high`, `priority:medium`, `priority:low`.

Group issues by phases defined in `02_DESKTOP_APP_BUILD_PLAN.md`:

- Phase 1: Scaffolding
- Phase 2: Orchestration (Docker)
- Phase 3: Direct Process mode
- Phase 4: Status & Logs
- Phase 5: Packaging
- Phase 6: Optional enhancements

Cross-reference issues in `04_DESKTOP_APP_GITHUB_ISSUES.md` with these phases.

---

### 5. Developer Workflow Summary

For you / contributors:

1. Clone the repo.
2. Install Node LTS and pnpm.
3. For desktop development:
   - Run `pnpm install`.
   - Run `pnpm --filter @synthesis/desktop dev` (and ensure server/web/DB are running via Docker or direct commands).
4. For full stack testing:
   - Use existing commands for server/web/MCP.
   - Use desktop app to orchestrate stack as a sanity check.

This keeps the workflow consistent with how you already work on Synthesis, avoiding a separate "desktop-only" dev story.

---

### 6. Future Scaling Options (Optional)

If the desktop app becomes popular and needs more independence:

- You could later:
  - Split it into its own repo if that simplifies onboarding for desktop-only contributors.
  - Consume Synthesis via Docker images or published artifacts.

But at the current stage, co-locating everything in one repo is simpler and avoids premature optimisation.

---

### Summary

- **Monorepo with `apps/desktop` is recommended** for simplicity and alignment.
- Branches and CI can follow your existing patterns.
- Desktop app releases can be tied to or versioned alongside Synthesis server/web releases.
- The workflow stays close to what you already do: build, test, and run everything from one place.