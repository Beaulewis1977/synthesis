# Synthesis Desktop

Electron-based desktop wrapper for the Synthesis RAG system. Provides a simple control interface for starting/stopping Docker services and accessing the web UI.

## Overview

Synthesis Desktop is a **thin wrapper** that:
- Orchestrates Docker Compose to start/stop Synthesis services
- Monitors backend health via `/health` endpoint
- Opens the React web UI when services are ready
- Provides error handling for common issues (Docker not found, port conflicts, startup timeouts)

## Architecture

- **Main Process** (`src/main.ts`): Window management, IPC handlers, lifecycle
- **Preload Script** (`src/preload.ts`): Secure IPC bridge between main and renderer
- **Docker Utilities** (`src/docker.ts`): Docker Compose orchestration, port checks
- **Health Check** (`src/health.ts`): Backend health polling with timeout
- **Control UI** (`src/renderer/index.html`): Start/Stop buttons, status display

## Requirements

- Node.js 22.20.0 (LTS)
- Docker Desktop installed and running
- Ports 3333 (backend) and 5173 (web UI) available

## Development

### First-time setup

```bash
# Install dependencies (from repo root)
pnpm install

# Build TypeScript files
pnpm --filter @synthesis/desktop build
```

### Running in dev mode

```bash
# From repo root
pnpm --filter @synthesis/desktop dev

# Control window will open
# Click "Start Synthesis" to launch Docker services
# Web UI window opens automatically when backend is ready
```

### Type checking

```bash
pnpm --filter @synthesis/desktop typecheck
```

## Features

### Control Window
- **Start Synthesis**: Launches Docker Compose, polls health endpoint, opens web UI
- **Stop Synthesis**: Shuts down Docker services cleanly
- **Open Web UI**: Reopens web UI window if closed
- **View Logs**: Shows recent Docker Compose logs for troubleshooting

### Status Indicators
- 🔴 **Stopped**: Services not running
- 🟠 **Starting**: Docker launching, health check in progress
- 🟢 **Running**: Backend healthy, web UI available
- 🔴 **Error**: Startup failed (see error message)

### Error Handling
- **Docker Not Found**: Shows dialog with install link
- **Port Conflict**: Detects if 3333 or 5173 in use, suggests resolution
- **Health Timeout**: Backend failed to start within 60s, shows logs
- **Docker Errors**: Displays stderr output for troubleshooting

## How It Works

### Startup Flow
1. User clicks "Start Synthesis"
2. Check Docker is installed (`docker --version`)
3. Check ports 3333 and 5173 are available
4. Run `docker compose up -d` from repo root
5. Poll `http://localhost:3333/health` every 2s (max 60s)
6. When healthy, open web UI window at `http://localhost:5173`
7. Update status to "Running"

### Shutdown Flow
1. User clicks "Stop Synthesis"
2. Close web UI window if open
3. Run `docker compose down` from repo root
4. Update status to "Stopped"

## Configuration

### Environment Variables
- `SYNTHESIS_URL`: Web UI URL (default: `http://localhost:5173`)
- `NODE_ENV`: Set to `development` to enable DevTools

### Docker Working Directory
The app runs Docker Compose from the **repo root** (`/path/to/synthesis`), ensuring it finds `docker-compose.yml` correctly.

## Project Structure

```
apps/desktop/
├── package.json          # Dependencies, scripts, electron-builder config
├── tsconfig.json         # TypeScript configuration (extends root)
├── tsup.config.ts        # Build configuration (tsup for bundling)
├── .gitignore            # Ignore dist/, release/, node_modules/
├── src/
│   ├── main.ts           # Main process (339 lines)
│   ├── preload.ts        # IPC bridge (70 lines)
│   ├── docker.ts         # Docker orchestration (200 lines)
│   ├── health.ts         # Health polling (59 lines)
│   └── renderer/
│       └── index.html    # Control UI (313 lines)
└── dist/                 # Build output (gitignored)
    ├── main.js
    ├── preload.js
    └── *.map
```

## Production Build

```bash
# Build TypeScript + create AppImage (Linux)
pnpm --filter @synthesis/desktop build

# Output: apps/desktop/release/Synthesis Desktop-1.0.0.AppImage
```

**Note**: Full electron-builder packaging is for production only. Development uses `tsup + electron .`

## Troubleshooting

### "Docker is not installed"
Install Docker Desktop: https://www.docker.com/products/docker-desktop

### "Port 3333 or 5173 is already in use"
Find and kill conflicting processes:
```bash
lsof -i :3333
lsof -i :5173
kill -9 <PID>
```

### "Backend failed to start within 60 seconds"
- Check Docker services: `docker compose ps`
- View logs: Click "View Logs" button or run `docker compose logs`
- Verify `.env` file has required keys (`ANTHROPIC_API_KEY`, `DATABASE_URL`)

### App won't start
- Ensure you're in the repo root directory
- Check `docker-compose.yml` exists
- Verify Docker daemon is running: `docker ps`

## Integration with Synthesis

This desktop app **does not duplicate** any RAG logic. It purely:
- Wraps existing Docker Compose infrastructure
- Loads existing React web UI (`apps/web`)
- Provides convenience for desktop users

All RAG functionality (search, ingestion, agent, MCP) remains in `apps/server`, `apps/web`, `apps/mcp`.

## Phase 1 & 2 Exit Criteria ✅

This implementation completes **Phase 1 (Desktop Shell Scaffolding)** and **Phase 2 (Service Orchestration)** from the build plan.

### Phase 1: Desktop Shell ✅
- [x] Control window opens with Electron
- [x] Loads web UI URL (http://localhost:5173)
- [x] Dev mode enables DevTools
- [x] TypeScript configuration and build setup
- [x] No changes to existing apps (server/web/mcp)

### Phase 2: Docker Orchestration ✅
- [x] Docker availability detection with clear error messaging
- [x] Start/Stop buttons wired to `docker compose up -d` / `down`
- [x] Health check polls `http://localhost:3333/health` (2s interval, 60s timeout)
- [x] Status display: stopped, starting, running, error
- [x] Web UI opens automatically when backend healthy
- [x] Clean shutdown via `docker compose down`
- [x] Graceful error handling for Docker not found

### Bonus Features (Phase 4 Preview) 🎁

Beyond Phase 1 & 2 requirements, this implementation includes:

- **Port Conflict Detection**: Checks ports 3333 & 5173 availability before startup
- **View Logs Button**: Shows recent Docker Compose logs for troubleshooting (Phase 4 feature)
- **Open Web UI Button**: Reopens web UI window if user closes it
- **Real-time Status Updates**: IPC event stream for live status changes
- **Progress Indicators**: Shows "Health check: attempt X/Y..." during startup
- **Detailed Error Dialogs**: All errors show helpful troubleshooting steps
- **Auto-cleanup on Quit**: Stops Docker services gracefully when app exits
- **Port Conflict Resolution**: Error messages include `lsof` commands to find conflicting processes

### Code Statistics
- **Total Lines**: 981 (668 TypeScript + 313 HTML/CSS)
- **Files**: main.ts (339), docker.ts (200), health.ts (59), preload.ts (70), index.html (313)
- **Build**: TypeScript 5.7.2 ✅ compiles successfully
- **Bundler**: tsup ✅ builds without errors

## Next Steps (Future Phases)

- **Phase 3**: Direct Process Mode (dev convenience - spawn pnpm processes)
- **Phase 4**: Enhanced status/logs/UX (per-service indicators, dedicated logs panel)
- **Phase 5**: Packaging & distribution (installers, CI/CD, multi-platform)

## License

Same as main Synthesis project.
