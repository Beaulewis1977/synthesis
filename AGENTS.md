# Repository Guidelines

This is a pnpm + Turbo monorepo for the Synthesis RAG system. Use Node 22+ and pnpm 9+.

## Project Structure & Module Organization

- `apps/server`: API, ingestion, pipeline, MCP integration (`src/**`, tests in `src/__tests__`).
- `apps/web`: React UI (`src/pages`, `src/components`, Playwright e2e in `e2e/`).
- `apps/desktop`: Desktop wrapper for the web app.
- `apps/mcp`: MCP tools used by the server and agents.
- `packages/db`: Database client and migrations (`migrations/`, `src/__tests__`).
- `packages/shared`: Shared TypeScript utilities and types.
- `docs`: Planning/docs (start with `docs/00_START_HERE.md` and `docs/09_BUILD_PLAN.md`).

## Build, Test, and Development Commands

- Install: `pnpm install`
- Dev (all via Turbo): `pnpm dev` or targeted (`pnpm dev:server`, `pnpm dev:web`).
- Build: `pnpm build`
- Tests: `pnpm test`, with `pnpm test:integration` and `pnpm test:coverage` for deeper runs.
- Quality: `pnpm lint`, `pnpm format`, `pnpm typecheck`
- Local infra (DB, Ollama, Redis): `pnpm dev:infra`

## Coding Style & Naming Conventions

- Language: TypeScript/TSX with strict typing where practical.
- Indentation: 2 spaces; avoid trailing whitespace.
- Files: kebab-case for modules (`knowledge-graph.ts`), PascalCase for React components (`App.tsx`).
- Use Biome for style/formatting (`pnpm lint`, `pnpm format`); do not hand-format around violations.

## Testing Guidelines

- Unit tests: Vitest, colocated in `__tests__` or `*.test.ts`.
- E2E/UI: Playwright specs in `apps/web/e2e`.
- New features should ship with at least one unit test; user-facing flows should add/extend Playwright coverage.
- Before opening a PR, run `pnpm test` and `pnpm test:integration` when relevant.

## Commit & Pull Request Guidelines

- Use Conventional Commits: `feat(server): add route`, `fix(db): handle null id`, `docs: update README`.
- Keep commits focused and descriptive; include migrations or config changes explicitly in the message.
- Branch naming: `feature/<short-description>` or `fix/<short-description>`.
- PRs must include: a short summary, key changes list, test evidence (commands run), linked issues (`Closes #123`), and screenshots for UI changes.

## Git & GitHub Workflow

- Branches: `main` (protected, releases), `develop` (default integration), feature branches like `feature/phase-X-description`.
- Always branch from `develop` and open PRs back into `develop`; `main` is updated only via reviewed merges from `develop`.
- Before pushing or opening a PR, ensure `pnpm test`, `pnpm lint`, and `pnpm build` pass locally.
- GitHub Actions in `.github/workflows/ci.yml` run tests/lint/build on PRs; CodeRabbit performs automated review.
- After a PR is merged, pull `develop` and delete the feature branch locally and on GitHub to keep history tidy.

## Security & Configuration

- Never commit secrets; copy `.env.example` to `.env` and fill in locally.
- Access config via environment variables and shared config helpers rather than hardcoding.
- Generated data in `logs/`, `storage/`, and build artifacts should not be treated as source.

## Agent-Specific Workflow

- AI builder/review agents must follow the detailed rules in `docs/Agent-Collaboration-Workflow.md`.
- Roles: Builder implements changes and writes summaries; Review Agent checks quality, tests, and docs; CodeRabbit provides automated review on PRs.
- Agents should use MCP tools (documentation search, web search, sequential thinking) before guessing, and keep phase summaries, progress, and known issues up to date as described in the workflow doc.
