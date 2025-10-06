# 🐳 Docker Development Workflow

Complete guide for developing Synthesis RAG in Docker containers.

---

## 🎯 Overview

You can develop **entirely in Docker containers** with hot reload, Git access, and full MCP server support.

**Services:**
- `synthesis-db` - PostgreSQL 16 + pgvector (always running)
- `synthesis-ollama` - Local LLM with GPU (always running)
- `synthesis-server` - Fastify backend (profile: app)
- `synthesis-web` - React frontend (profile: app)
- `synthesis-mcp` - MCP server (profile: app)

---

## 🚀 Quick Start

### 1. Start Database & Ollama (Always Needed)
```bash
cd /home/kngpnn/dev/synthesis

# Start DB and Ollama
docker compose up -d synthesis-db synthesis-ollama

# Check they're running
docker compose ps

# Pull Ollama models
docker exec -it synthesis-ollama ollama pull nomic-embed-text
docker exec -it synthesis-ollama ollama pull llama3.2:3b
```

### 2. Start Full Stack (When Apps are Ready)
```bash
# Build images (first time or after dependency changes)
docker compose --profile app build

# Start all services
docker compose --profile app up -d

# View logs
docker compose logs -f
```

### 3. Attach to a Container for Development
```bash
# Attach to server container
docker exec -it synthesis-server /bin/bash

# Or web container
docker exec -it synthesis-web /bin/bash

# Or MCP container
docker exec -it synthesis-mcp /bin/bash
```

---

## 📦 Installing Dependencies in Containers

### Initial Setup (From Within Container)
```bash
# Attach to any container
docker exec -it synthesis-server /bin/bash

# Install dependencies (already done in Dockerfile, but if needed)
pnpm install

# Install additional packages
pnpm add package-name --filter @synthesis/server
```

### After Adding Dependencies
```bash
# Outside container - rebuild image
docker compose --profile app build synthesis-server

# Restart container
docker compose --profile app up -d synthesis-server
```

---

## 🔧 Running Commands Inside Containers

### Git Operations
```bash
# Git is available in all app containers
docker exec -it synthesis-server git status
docker exec -it synthesis-server git add .
docker exec -it synthesis-server git commit -m "feat: add feature"
docker exec -it synthesis-server git push
```

### Database Operations
```bash
# Run migrations
docker exec -it synthesis-server pnpm --filter @synthesis/db migrate

# Access PostgreSQL directly
docker exec -it synthesis-db psql -U postgres -d synthesis

# Verify tables
docker exec -it synthesis-db psql -U postgres -d synthesis -c "\dt"
```

### Testing
```bash
# Run tests in server
docker exec -it synthesis-server pnpm test

# Run tests in watch mode
docker exec -it synthesis-server pnpm test:watch

# Run tests in web
docker exec -it synthesis-web pnpm test
```

### Lint & Format
```bash
docker exec -it synthesis-server pnpm lint:fix
docker exec -it synthesis-server pnpm typecheck
```

---

## 🔌 Port Mappings

All ports are exposed to your host machine:

| Service | Internal Port | Host Port | Purpose |
|---------|--------------|-----------|---------|
| synthesis-db | 5432 | 5432 | PostgreSQL |
| synthesis-ollama | 11434 | 11434 | Ollama API |
| synthesis-server | 3333 | 3333 | Backend API |
| synthesis-web | 5173 | 5173 | Frontend Dev Server |
| synthesis-mcp | 3334 | 3334 | MCP Server (SSE mode) |

Access from host:
- Frontend: http://localhost:5173
- Backend: http://localhost:3333
- Database: postgresql://postgres:postgres@localhost:5432/synthesis
- Ollama: http://localhost:11434
- MCP: http://localhost:3334 (SSE mode)

---

## 📂 Volume Mounts & Hot Reload

Your entire project is mounted into containers with hot reload:

```yaml
volumes:
  - .:/app                              # Entire project
  - /app/node_modules                   # Exclude node_modules
  - /app/apps/server/node_modules       # Workspace node_modules
  - /app/apps/web/node_modules
  - /app/apps/mcp/node_modules
  - /app/packages/db/node_modules
  - /app/packages/shared/node_modules
  - storage_data:/app/storage           # Persistent storage
```

**What this means:**
- ✅ Edit files on your host → Changes reflect in container instantly
- ✅ Hot reload works (Vite, tsx watch)
- ✅ No need to rebuild for code changes
- ✅ node_modules stay in container (faster)
- ✅ Uploaded documents persist across restarts

---

## 🛠️ Development Workflows

### Scenario 1: Initialize New Project in Container
```bash
# Start containers
docker compose --profile app up -d

# Attach to server
docker exec -it synthesis-server /bin/bash

# Initialize git (if not already done)
cd /app
git init
git branch -M main
git remote add origin git@github.com:beaulewis1977/synthesis.git

# Run setup
chmod +x scripts/*.sh
./scripts/setup-repo.sh

# Exit container
exit
```

### Scenario 2: Daily Development
```bash
# Start services
docker compose up -d synthesis-db synthesis-ollama
docker compose --profile app up -d

# Attach to server for backend work
docker exec -it synthesis-server /bin/bash

# Work on Phase 1
cd /app/packages/db
# Edit files on host with your IDE
# Tests run in container
pnpm test:watch

# Exit when done
exit

# Stop services
docker compose down
```

### Scenario 3: Testing MCP Server
```bash
# Start full stack
docker compose --profile app up -d

# Check MCP logs
docker compose logs -f synthesis-mcp

# Test stdio mode (from within container)
docker exec -it synthesis-mcp /bin/bash
node dist/index.js  # If built

# Test SSE mode (from host)
curl http://localhost:3334/health
```

### Scenario 4: Frontend Development
```bash
# Start services
docker compose --profile app up -d

# Attach to web container
docker exec -it synthesis-web /bin/bash

# Dev server is already running
# Edit React components on host
# Browser auto-refreshes at http://localhost:5173

# Run tests
pnpm test

exit
```

---

## 🔍 Useful Commands

### Container Management
```bash
# List all containers
docker compose ps

# View logs (all services)
docker compose logs -f

# View logs (specific service)
docker compose logs -f synthesis-server

# Restart a service
docker compose restart synthesis-server

# Rebuild a service
docker compose build synthesis-server
docker compose up -d synthesis-server

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

### Troubleshooting
```bash
# Check container health
docker compose ps

# Inspect a container
docker inspect synthesis-server

# Check network
docker network inspect synthesis_synthesis-network

# Check volumes
docker volume ls
docker volume inspect synthesis_storage_data

# Container resource usage
docker stats
```

### Cleanup
```bash
# Remove stopped containers
docker compose down

# Remove everything (including volumes)
docker compose down -v

# Remove dangling images
docker image prune

# Full cleanup (careful!)
docker system prune -a --volumes
```

---

## 🎓 Attach vs Exec

### Attach (Interactive Session)
```bash
# Attach to running container
docker attach synthesis-server

# Exit: Ctrl+P, Ctrl+Q (detach without stopping)
# Exit: Ctrl+C (stops container if not detached)
```

### Exec (Preferred for Commands)
```bash
# Execute command in running container
docker exec -it synthesis-server /bin/bash

# Run one-off command
docker exec synthesis-server pnpm test

# Exit: type 'exit' or Ctrl+D (doesn't stop container)
```

**Use exec for development** - safer and more flexible.

---

## 🔄 Rebuild After Changes

When to rebuild:

### Rebuild NOT Needed (Hot Reload)
- ✅ Changing source code (.ts, .tsx files)
- ✅ Changing config files (tsconfig.json, biome.json)
- ✅ Changing environment variables (restart container)

### Rebuild Needed
- ❌ Adding/removing npm packages
- ❌ Changing Dockerfile
- ❌ Changing package.json scripts

```bash
# Rebuild specific service
docker compose --profile app build synthesis-server

# Rebuild all services
docker compose --profile app build

# Rebuild with no cache (clean build)
docker compose --profile app build --no-cache
```

---

## 🐛 Common Issues

### Issue: "Cannot find module"
```bash
# Solution: Rebuild container
docker compose --profile app build synthesis-server
docker compose --profile app up -d synthesis-server
```

### Issue: "Port already in use"
```bash
# Find what's using the port
lsof -i :3333

# Stop conflicting service
docker compose down

# Or kill the process
kill -9 <PID>
```

### Issue: "Database connection failed"
```bash
# Check DB is running
docker compose ps synthesis-db

# Check DB logs
docker compose logs synthesis-db

# Restart DB
docker compose restart synthesis-db

# Test connection
docker exec synthesis-db pg_isready -U postgres
```

### Issue: "Hot reload not working"
```bash
# Check volume mounts
docker inspect synthesis-server | grep Mounts -A 20

# Restart container
docker compose restart synthesis-server

# Rebuild if needed
docker compose --profile app build synthesis-server
```

---

## 📋 Docker Development Checklist

Before starting development:

- [ ] Docker Desktop running
- [ ] `docker compose up -d synthesis-db synthesis-ollama` (DB and Ollama started)
- [ ] Ollama models pulled (nomic-embed-text, llama3.2:3b)
- [ ] `.env` file created (cp .env.example .env)
- [ ] `docker compose --profile app build` (images built)
- [ ] `docker compose --profile app up -d` (all services running)
- [ ] Can attach to containers: `docker exec -it synthesis-server /bin/bash`
- [ ] Hot reload works (edit file, see change)

---

## 🎯 Recommended Workflow

**Option 1: Hybrid (Recommended for MVP)**
- DB + Ollama in Docker
- Apps on host (faster development)

```bash
# Start infrastructure
docker compose up -d synthesis-db synthesis-ollama

# Develop on host
pnpm install
pnpm dev  # Runs all apps
```

**Option 2: Full Docker (Recommended for consistency)**
- Everything in Docker
- Attach to containers for commands

```bash
# Start everything
docker compose --profile app up -d

# Attach for work
docker exec -it synthesis-server /bin/bash

# Edit on host, test in container
```

**Choose based on preference! Both work great.**

---

## ✨ Pro Tips

1. **Use Docker Desktop's UI** - Visual container management
2. **Keep DB/Ollama running** - Start once, use all day
3. **Use exec, not attach** - Safer for running commands
4. **Watch logs in separate terminal** - `docker compose logs -f`
5. **Rebuild sparingly** - Only when adding packages
6. **Volume mounts = hot reload** - Just edit and save
7. **Test in container** - Ensures consistency

---

## 📚 Next Steps

1. Start DB/Ollama: `docker compose up -d synthesis-db synthesis-ollama`
2. Pull models: `docker exec -it synthesis-ollama ollama pull nomic-embed-text`
3. Build apps: `docker compose --profile app build`
4. Start apps: `docker compose --profile app up -d`
5. Attach: `docker exec -it synthesis-server /bin/bash`
6. Initialize: Run `./scripts/setup-repo.sh` from within container
7. Start Phase 1 development!

**You can now develop entirely in Docker with full Git, MCP, and hot reload support! 🚀**
