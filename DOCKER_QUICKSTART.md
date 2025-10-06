# 🐳 Docker Quick Start

**TL;DR:** Run everything in Docker with hot reload, Git, and MCP servers.

---

## 🚀 First Time Setup

```bash
cd /home/kngpnn/dev/synthesis

# 1. Create environment file
cp .env.example .env
# Edit .env - add your ANTHROPIC_API_KEY

# 2. Start infrastructure
docker compose up -d synthesis-db synthesis-ollama

# 3. Pull Ollama models (one-time)
docker exec -it synthesis-ollama ollama pull nomic-embed-text
docker exec -it synthesis-ollama ollama pull llama3.2:3b

# 4. Wait for DB to be healthy
docker compose ps

# 5. Build app containers (when ready in Phase 1+)
docker compose --profile app build

# 6. Start all services
docker compose --profile app up -d
```

---

## 📦 Initialize Project in Container

```bash
# Attach to server container
docker exec -it synthesis-server /bin/bash

# Inside container:
pnpm install                    # Install dependencies
chmod +x scripts/*.sh           # Make scripts executable
./scripts/setup-repo.sh         # Initialize Git & GitHub
./scripts/create-milestones.sh  # Create milestones
./scripts/create-phase1-issues.sh # Create issues

# Exit container
exit
```

---

## 💻 Daily Development

```bash
# Start services (if not already running)
docker compose up -d synthesis-db synthesis-ollama
docker compose --profile app up -d

# Attach to container for backend work
docker exec -it synthesis-server /bin/bash

# Inside container - run commands:
pnpm test:watch                 # Run tests
pnpm --filter @synthesis/db migrate  # Run migrations
git add . && git commit -m "..."     # Git commands
pnpm lint:fix                   # Lint/format

# Edit files on HOST with your IDE (hot reload works!)
# Exit: type 'exit'

# View logs
docker compose logs -f

# Stop when done
docker compose down
```

---

## 🌐 Access Services

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3333
- **Database:** postgresql://postgres:postgres@localhost:5432/synthesis
- **Ollama:** http://localhost:11434
- **MCP Server:** http://localhost:3334 (SSE mode)

---

## 🔧 Common Commands

```bash
# View all containers
docker compose ps

# View logs (all)
docker compose logs -f

# View logs (specific service)
docker compose logs -f synthesis-server

# Restart service
docker compose restart synthesis-server

# Rebuild after adding packages
docker compose --profile app build synthesis-server
docker compose --profile app up -d synthesis-server

# Stop everything
docker compose down

# Full cleanup (removes volumes)
docker compose down -v
```

---

## 🎯 Run Commands in Containers

```bash
# Execute one-off commands
docker exec synthesis-server pnpm test
docker exec synthesis-server git status
docker exec synthesis-db psql -U postgres -d synthesis

# Interactive shell
docker exec -it synthesis-server /bin/bash
docker exec -it synthesis-web /bin/bash
docker exec -it synthesis-mcp /bin/bash
```

---

## 📂 How Hot Reload Works

Your entire project is mounted into containers:

```
Host: /home/kngpnn/dev/synthesis
  ↕ mounted to ↕
Container: /app
```

**Edit files on host → Changes reflect in container instantly!**

- ✅ Server: tsx watch auto-restarts
- ✅ Web: Vite hot reloads browser
- ✅ MCP: tsx watch auto-restarts
- ✅ No rebuild needed for code changes
- ✅ Tests run with live code

---

## 🐛 Troubleshooting

**Port in use:**
```bash
docker compose down
```

**Cannot find module:**
```bash
docker compose --profile app build synthesis-server
docker compose --profile app up -d synthesis-server
```

**Database not connecting:**
```bash
docker compose restart synthesis-db
docker exec synthesis-db pg_isready -U postgres
```

**Hot reload not working:**
```bash
docker compose restart synthesis-server
```

---

## 📋 Phase 1 Workflow in Docker

```bash
# 1. Start infrastructure
docker compose up -d synthesis-db synthesis-ollama

# 2. Attach to server
docker exec -it synthesis-server /bin/bash

# 3. Initialize project (inside container)
pnpm install
./scripts/setup-repo.sh
git checkout -b feature/phase-1-database

# 4. Create database package (inside container)
cd packages/db
mkdir -p src migrations
# Create files...

# 5. Run migrations
pnpm migrate

# 6. Verify
docker exec synthesis-db psql -U postgres -d synthesis -c "\dt"

# 7. Build and test
pnpm build
pnpm test

# 8. Commit
git add .
git commit -m "feat(db): implement schema and migrations"
git push

# 9. Continue with Phase 1 tasks...
```

---

## 🎓 Two Workflows

**Option A: Infrastructure in Docker, Apps on Host (Faster)**
```bash
docker compose up -d synthesis-db synthesis-ollama
pnpm install  # On host
pnpm dev      # On host
```

**Option B: Everything in Docker (More Consistent)**
```bash
docker compose --profile app up -d
docker exec -it synthesis-server /bin/bash
# Work inside container
```

**Both work great! Choose what you prefer.**

---

## ✅ Ready Checklist

- [ ] Docker Desktop running
- [ ] `.env` file created with ANTHROPIC_API_KEY
- [ ] DB and Ollama started
- [ ] Ollama models pulled
- [ ] Can attach to containers
- [ ] Hot reload tested (edit file, see change)
- [ ] Git initialized in container
- [ ] Ready to start Phase 1!

---

**Full guide:** See `DOCKER_WORKFLOW.md`

**You're ready to develop entirely in Docker! 🚀**
