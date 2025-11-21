# Synthesis Versioning Strategy

**Version:** 1.0
**Date:** 2025-11-20
**Status:** Active

---

## Overview

Synthesis uses a **combined versioning strategy** where all packages in the monorepo share the same semantic version. This ensures consistency across the desktop app, server, web app, and internal packages.

---

## Version Number Format

We follow [Semantic Versioning 2.0.0](https://semver.org/):

```
vMAJOR.MINOR.PATCH

Examples:
- v1.0.0 (First production release)
- v1.1.0 (New features added)
- v1.0.1 (Bug fixes)
```

---

## Current Version: `v1.0.0`

All packages aligned at version `1.0.0` as of Phase 5:

| Package | Version | Description |
|---------|---------|-------------|
| `synthesis-monorepo` (root) | `1.0.0` | Workspace root |
| `@synthesis/desktop` | `1.0.0` | Electron desktop app |
| `@synthesis/server` | `1.0.0` | Fastify backend |
| `@synthesis/web` | `1.0.0` | React frontend |
| `@synthesis/mcp` | `1.0.0` | MCP server |
| `@synthesis/db` | `1.0.0` | Database client |
| `@synthesis/shared` | `1.0.0` | Shared types |

---

## Git Tagging Convention

### Release Tags

Use **annotated tags** for releases:

```bash
# Create release tag
git tag -a v1.0.0 -m "Release v1.0.0 - First production release"

# Push tag to remote (triggers CI release workflow)
git push origin v1.0.0
```

### Tag Naming

- **Production releases**: `v1.0.0`, `v1.1.0`, `v2.0.0`
- **Pre-releases**: `v1.0.0-beta.1`, `v1.0.0-rc.2`
- **Desktop-specific tags** (optional): `desktop-v1.0.0` (if needed for independent desktop releases)

---

## When to Bump Versions

### MAJOR (v2.0.0)
Breaking changes that require user action:
- Database schema changes requiring migrations
- API breaking changes
- Configuration format changes
- Agent SDK major version upgrades

### MINOR (v1.1.0)
New features, backwards-compatible:
- New agent tools
- New search modes
- New desktop orchestration features
- Phase completions (e.g., Phase 5 → v1.5.0)

### PATCH (v1.0.1)
Bug fixes, no new features:
- Security patches
- Performance improvements
- Bug fixes
- Documentation updates

---

## Version Bump Process

### 1. Update Version Numbers

Edit all `package.json` files:

```bash
# Root
./package.json → "version": "1.1.0"

# Apps
./apps/desktop/package.json → "version": "1.1.0"
./apps/server/package.json → "version": "1.1.0"
./apps/web/package.json → "version": "1.1.0"
./apps/mcp/package.json → "version": "1.1.0"

# Packages
./packages/db/package.json → "version": "1.1.0"
./packages/shared/package.json → "version": "1.1.0"
```

### 2. Update CHANGELOG.md

Add release notes to `CHANGELOG.md`:

```markdown
## [1.1.0] - 2025-12-01

### Added
- New hybrid search mode with RRF fusion
- Desktop Phase 5 packaging (AppImage + NSIS)

### Fixed
- Memory leak in vector search
- Docker compose port conflicts

### Changed
- Upgraded to Claude Opus 4.5
```

### 3. Create Git Tag

```bash
git add .
git commit -m "chore: bump version to v1.1.0"
git tag -a v1.1.0 -m "Release v1.1.0 - Hybrid search and packaging"
git push origin feature/your-branch
git push origin v1.1.0
```

### 4. Monitor Release Workflow

- GitHub Actions will automatically build desktop artifacts
- Check `.github/workflows/release-desktop.yml` for progress
- Artifacts will appear on GitHub Releases page

---

## Automated Versioning (Future)

For fully automated versioning, consider:

- **semantic-release**: Automates version bumps and changelog generation based on commit messages
- **Conventional Commits**: Standardize commit messages (`feat:`, `fix:`, `chore:`)
- **Commitizen**: CLI tool to enforce conventional commits

**Example:**
```bash
# Install semantic-release
pnpm add -D semantic-release @semantic-release/git @semantic-release/changelog

# Configure .releaserc
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/git",
    "@semantic-release/github"
  ]
}
```

---

## Independent Versioning (Not Recommended)

If you need independent desktop versioning:

```bash
# Desktop-specific tag
git tag -a desktop-v1.2.0 -m "Desktop Phase 6 - Auto-update"

# Update only desktop package.json
./apps/desktop/package.json → "version": "1.2.0"
```

**Trade-offs:**
- ✅ Allows independent desktop release cycles
- ❌ Confusing for users (which version am I running?)
- ❌ Complicates support (server v1.0.0 + desktop v1.2.0?)
- ❌ Requires custom CI logic to parse desktop tags

**Recommendation:** Stick with combined versioning for simplicity.

---

## Version Injection in Builds

Electron Builder automatically injects version from `package.json`:

```typescript
// apps/desktop/src/main.ts
import { app } from 'electron';

console.log(`Synthesis Desktop v${app.getVersion()}`); // e.g., "1.0.0"
```

Server and web apps can read from `package.json`:

```typescript
import { version } from './package.json';

console.log(`Server v${version}`);
```

---

## Release Checklist

- [ ] Update all `package.json` versions
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Run full test suite: `pnpm test && pnpm typecheck`
- [ ] Build all packages: `pnpm build`
- [ ] Test desktop app locally: `pnpm --filter @synthesis/desktop build`
- [ ] Create git tag: `git tag -a v1.x.x -m "Release notes"`
- [ ] Push tag: `git push origin v1.x.x`
- [ ] Monitor GitHub Actions release workflow
- [ ] Verify artifacts on GitHub Releases page
- [ ] Test downloaded artifacts on clean system
- [ ] Update documentation with new version references

---

## References

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [semantic-release](https://semantic-release.gitbook.io/)
- [Electron Builder Versioning](https://www.electron.build/configuration/configuration#Configuration-version)
