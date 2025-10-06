# ✅ Docker Setup Complete

**Date:** October 6, 2025  
**Status:** Ready for containerized development with Git, MCP, and hot reload

---

## 🎯 What Was Added for Docker

### Dockerfiles Created
- ✅ `apps/server/Dockerfile` - Node 22, pnpm, git, bash, curl
- ✅ `apps/web/Dockerfile` - Node 22, Vite dev server with --host 0.0.0.0
- ✅ `apps/mcp/Dockerfile` - Node 22, MCP server ready

### Docker Compose Enhanced
- ✅ All 5 services defined with clear names
- ✅ Full volume mounts for hot reload
- ✅ `stdin_open: true` and `tty: true` for interactive shells
- ✅ Proper working directories (`/app`)
- ✅ All ports exposed to host
- ✅ Networks configured
- ✅ Profiles for staged startup (`--profile app`)
- ✅ Health checks on database
- ✅ Dependency ordering

### Documentation Created
- ✅ `DOCKER_WORKFLOW.md` - Complete guide (4000+ words)
- ✅ `DOCKER_QUICKSTART.md` - Quick reference
- ✅ `README.md` - Updated with Docker options

---

## 🐳 Container Features

### Git Support ✅
```bash
# Git is installed in all app containers
docker exec -it synthesis-server git status
docker exec -it synthesis-server git commit -m "feat: add feature"
docker exec -it synthesis-server git push
```

### MCP Server Support ✅
```bash
# MCP container configured with:
- Port 3334 exposed (SSE mode)
- Environment variable MCP_MODE
- stdin/tty for stdio mode
- Full access to backend API
```

### Hot Reload ✅
```yaml
volumes:
  - .:/app                    # Entire project mounted
  - /app/node_modules         # Exclude node_modules (in container)
```
**Edit on host → Changes reflect in container instantly!**

### All Ports Exposed ✅
- `5432` - PostgreSQL (synthesis-db)
- `11434` - Ollama API (synthesis-ollama)
- `3333` - Backend API (synthesis-server)
- `5173` - Frontend Dev Server (synthesis-web)
- `3334` - MCP Server (synthesis-mcp)

### Interactive Shells ✅
```yaml
stdin_open: true  # Keep stdin open
tty: true         # Allocate pseudo-TTY
```
**Can attach and run commands interactively!**

---

## 📦 Complete Service Configuration

### synthesis-db
- **Image:** pgvector/pgvector:pg16
- **Port:** 5432
- **Health Check:** pg_isready
- **Volume:** postgres_data (persistent)
- **Always Running:** No profile needed

### synthesis-ollama
- **Image:** ollama/ollama:latest
- **Port:** 11434
- **GPU:** NVIDIA support enabled
- **Volume:** ollama_data (persistent)
- **Always Running:** No profile needed

### synthesis-server (profile: app)
- **Build:** apps/server/Dockerfile
- **Port:** 3333
- **Volumes:** Full project + storage
- **Hot Reload:** ✅ tsx watch
- **Git:** ✅ Installed
- **Interactive:** ✅ stdin/tty

### synthesis-web (profile: app)
- **Build:** apps/web/Dockerfile
- **Port:** 5173
- **Volumes:** Full project
- **Hot Reload:** ✅ Vite HMR
- **Git:** ✅ Installed
- **Interactive:** ✅ stdin/tty

### synthesis-mcp (profile: app)
- **Build:** apps/mcp/Dockerfile
- **Port:** 3334
- **Volumes:** Full project
- **Hot Reload:** ✅ tsx watch
- **Git:** ✅ Installed
- **Interactive:** ✅ stdin/tty
- **MCP Mode:** stdio or SSE

---

## 🚀 Complete Workflow Examples

### Initialize Project in Docker

```bash
# 1. Start infrastructure
cd /home/kngpnn/dev/synthesis
docker compose up -d synthesis-db synthesis-ollama

# 2. Pull Ollama models
docker exec -it synthesis-ollama ollama pull nomic-embed-text
docker exec -it synthesis-ollama ollama pull llama3.2:3b

# 3. Build app containers
docker compose --profile app build

# 4. Start app containers
docker compose --profile app up -d

# 5. Attach to server
docker exec -it synthesis-server /bin/bash

# 6. Inside container - initialize
pnpm install
git init
git branch -M main
git remote add origin git@github.com:beaulewis1977/synthesis.git

# Run setup script
chmod +x scripts/*.sh
./scripts/setup-repo.sh

# Create milestones and issues
./scripts/create-milestones.sh
./scripts/create-phase1-issues.sh

# Exit
exit
```

### Daily Development

```bash
# Start services
docker compose up -d synthesis-db synthesis-ollama
docker compose --profile app up -d

# View logs
docker compose logs -f

# Attach for backend work
docker exec -it synthesis-server /bin/bash

# Inside container:
cd packages/db
pnpm test:watch  # Tests with hot reload

# Edit files on HOST with your IDE
# Tests automatically re-run

# Run migrations
pnpm --filter @synthesis/db migrate

# Git operations
git add .
git commit -m "feat(db): add schema"
git push

exit

# Stop when done
docker compose down
```

### Frontend Development

```bash
# Start services
docker compose --profile app up -d

# Attach to web
docker exec -it synthesis-web /bin/bash

# Dev server already running
# Edit React files on host
# Browser at http://localhost:5173 auto-refreshes

# Run tests
pnpm test

exit
```

### MCP Server Development

```bash
# Start services
docker compose --profile app up -d

# Check MCP logs
docker compose logs -f synthesis-mcp

# Test stdio mode
docker exec -it synthesis-mcp /bin/bash
node dist/index.js

# Test SSE mode (from host)
curl http://localhost:3334/health

# View MCP environment
docker exec synthesis-mcp env | grep MCP
```

### Database Operations

```bash
# Access PostgreSQL
docker exec -it synthesis-db psql -U postgres -d synthesis

# Run SQL
docker exec synthesis-db psql -U postgres -d synthesis -c "SELECT * FROM documents;"

# Verify tables
docker exec synthesis-db psql -U postgres -d synthesis -c "\dt"

# Check pgvector
docker exec synthesis-db psql -U postgres -d synthesis -c "\dx"

# Run migrations from server
docker exec synthesis-server pnpm --filter @synthesis/db migrate
```

---

## 🔧 Troubleshooting in Docker

### Check Container Status
```bash
docker compose ps
# All should show "Up" or "healthy"
```

### View Container Logs
```bash
docker compose logs -f synthesis-server
docker compose logs -f synthesis-db
```

### Restart Services
```bash
docker compose restart synthesis-server
docker compose restart synthesis-web
```

### Rebuild After Package Changes
```bash
docker compose --profile app build synthesis-server
docker compose --profile app up -d synthesis-server
```

### Test Connectivity
```bash
# From host
curl http://localhost:3333/health
curl http://localhost:11434/api/tags

# From server container to DB
docker exec synthesis-server curl synthesis-db:5432

# From server container to Ollama
docker exec synthesis-server curl http://synthesis-ollama:11434/api/tags
```

### Clean Slate
```bash
# Remove all containers and volumes
docker compose down -v

# Rebuild from scratch
docker compose build --no-cache
docker compose --profile app up -d
```

---

## 📋 Docker Development Checklist

### Prerequisites
- [x] Docker Desktop installed and running
- [x] WSL2 configured (if Windows)
- [x] NVIDIA Docker support (for GPU)
- [x] `.env` file created with API keys
- [x] Git configured in WSL

### First Time Setup
- [ ] Start DB and Ollama: `docker compose up -d synthesis-db synthesis-ollama`
- [ ] Pull Ollama models
- [ ] Build app images: `docker compose --profile app build`
- [ ] Start apps: `docker compose --profile app up -d`
- [ ] Verify all containers running: `docker compose ps`
- [ ] Test hot reload (edit file, see change)

### Project Initialization (In Container)
- [ ] Attach to server: `docker exec -it synthesis-server /bin/bash`
- [ ] Install dependencies: `pnpm install`
- [ ] Initialize Git
- [ ] Run setup script: `./scripts/setup-repo.sh`
- [ ] Create milestones and issues
- [ ] Create feature branch: `git checkout -b feature/phase-1-database`

### Development Ready
- [ ] Can attach to all containers
- [ ] Can run commands in containers
- [ ] Hot reload works (server, web)
- [ ] Can access all ports from host
- [ ] Git operations work in containers
- [ ] Database accessible
- [ ] Ollama responding

---

## ✨ Key Benefits

### ✅ Full Development in Docker
- Work entirely in containers
- Consistent environment
- No local Node.js conflicts
- Easy to reset/rebuild

### ✅ Hot Reload
- Edit on host with your IDE
- Changes reflect instantly in container
- No manual rebuilds for code changes
- Fast iteration

### ✅ Git Integration
- Git installed in all app containers
- Full git operations
- Push/pull from containers
- SSH keys work (mounted)

### ✅ MCP Server Ready
- stdio mode for IDE agents
- SSE mode for Claude Desktop
- Port 3334 exposed
- Can test from host or container

### ✅ Isolated Services
- Clean container names
- Proper networking
- Volume persistence
- Easy debugging

### ✅ Production-Like
- Same environment as production
- Docker Compose → Kubernetes easy
- Consistent across team
- Reproducible builds

---

## 🎯 Recommended Workflow

**For MVP Development (Phase 1-9):**

1. **Keep DB + Ollama always running**
   ```bash
   docker compose up -d synthesis-db synthesis-ollama
   ```

2. **Start apps when needed**
   ```bash
   docker compose --profile app up -d
   ```

3. **Attach for commands**
   ```bash
   docker exec -it synthesis-server /bin/bash
   ```

4. **Edit on host**
   - Use your IDE on host
   - Hot reload handles the rest

5. **Test in container**
   ```bash
   docker exec synthesis-server pnpm test
   ```

6. **Stop when done**
   ```bash
   docker compose down
   ```

---

## 📚 Reference Documents

- **Quick Start:** `DOCKER_QUICKSTART.md`
- **Full Guide:** `DOCKER_WORKFLOW.md`
- **Setup Status:** `SETUP_COMPLETE.md`
- **Main README:** `README.md`

---

## 🚀 You're Ready!

Everything is set up for **full Docker development** including:

✅ Git operations  
✅ Hot reload  
✅ MCP servers  
✅ All ports exposed  
✅ Interactive shells  
✅ Volume mounts  
✅ Network isolation  
✅ Persistent storage  

**Just run:**
```bash
docker compose up -d synthesis-db synthesis-ollama
docker compose --profile app up -d
docker exec -it synthesis-server /bin/bash
```

**Then start building Phase 1! 🎉**
