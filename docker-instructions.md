# Docker Instructions for Synthesis RAG

This guide covers all Docker commands for starting, stopping, and managing the Synthesis RAG system containers.

---

## 🚀 Startup Options

### Option 1: Infrastructure Only (Recommended for Development)

Start just the database and Ollama for local development:

```bash
docker compose up -d synthesis-db synthesis-ollama
```

**What this starts:**
- ✅ PostgreSQL (port 5432) - Database with pgvector
- ✅ Ollama (port 11434) - Local LLM with GPU support

**When to use:**
- Working with pgAdmin
- Running dev servers locally with `pnpm dev`
- Active development with hot reload
- Testing and debugging

**Then run apps locally:**
```bash
# In separate terminals:
pnpm --filter @synthesis/server dev    # Terminal 1 - Backend API
pnpm --filter @synthesis/web dev       # Terminal 2 - Frontend UI
pnpm --filter @synthesis/mcp dev       # Terminal 3 - MCP Server (optional)
```

---

### Option 2: Full Containerized Stack

Start everything in Docker containers:

```bash
docker compose --profile app up -d
```

**What this starts:**
- ✅ PostgreSQL (port 5432)
- ✅ Ollama (port 11434)
- ✅ Backend Server (port 3333)
- ✅ Frontend Web (port 5173)
- ✅ MCP Server (port 3334)

**When to use:**
- Production-like environment
- Testing the full containerized stack
- Deployment scenarios
- Don't want to run `pnpm dev` locally

**⚠️ Note:** First run will take time to build Docker images for all services.

---

### Option 3: Hybrid Approach (Best for Active Development) ✨

Recommended setup for most development work:

```bash
# Step 1: Start infrastructure
docker compose up -d synthesis-db synthesis-ollama

# Step 2: Verify they're running
docker compose ps

# Step 3: Run application services locally
pnpm --filter @synthesis/server dev    # Terminal 1
pnpm --filter @synthesis/web dev       # Terminal 2
```

**Benefits:**
- Fast code changes (no Docker rebuilds)
- Better debugging experience
- Hot reload for instant feedback
- pgAdmin access to database
- GPU-accelerated embeddings

**Access points:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3333
- Database: localhost:5432 (via pgAdmin)
- Ollama: http://localhost:11434

---

## 📊 Check Status

### View running containers
```bash
docker compose ps
```

**Example output:**
```
NAME               IMAGE                    STATUS          PORTS
synthesis-db       pgvector/pgvector:pg16   Up (healthy)    0.0.0.0:5432->5432/tcp
synthesis-ollama   ollama/ollama:latest     Up              0.0.0.0:11434->11434/tcp
```

### Check container logs
```bash
# View logs for all running containers
docker compose logs -f

# View logs for specific service
docker compose logs synthesis-db -f
docker compose logs synthesis-ollama -f

# View last 50 lines
docker compose logs --tail 50 synthesis-db
```

### Check container health
```bash
# Database health check
docker compose exec synthesis-db pg_isready -U postgres

# List Ollama models
docker compose exec synthesis-ollama ollama list
```

---

## 🛑 Stop Services

### Stop all containers (keeps data)
```bash
docker compose down
```

### Stop specific service
```bash
docker compose stop synthesis-db
docker compose stop synthesis-ollama
```

### Stop and remove all data (⚠️ DESTRUCTIVE)
```bash
# This deletes all database data, Ollama models, and storage!
docker compose down -v
```

---

## 🔧 Individual Service Control

### Start specific service
```bash
docker compose up -d synthesis-db
docker compose up -d synthesis-ollama
```

### Restart service
```bash
docker compose restart synthesis-db
docker compose restart synthesis-ollama
```

### Stop and start (rebuild if needed)
```bash
docker compose up -d --force-recreate synthesis-db
```

### Rebuild and start (after code changes)
```bash
docker compose up -d --build synthesis-server
docker compose up -d --build synthesis-web
```

---

## 🔍 Troubleshooting Commands

### Check if database is accepting connections
```bash
psql "postgresql://postgres:postgres@localhost:5432/synthesis" -c "SELECT version();"
```

### Check Ollama API
```bash
curl http://localhost:11434/api/tags
```

### View database tables
```bash
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\dt"
```

### Check database size
```bash
docker compose exec synthesis-db psql -U postgres -d synthesis -c "SELECT pg_size_pretty(pg_database_size('synthesis'));"
```

### Inspect container
```bash
docker compose exec synthesis-db bash
docker compose exec synthesis-ollama bash
```

---

## 📦 Docker Volumes

### List volumes
```bash
docker volume ls | grep synthesis
```

**Volumes used:**
- `postgres_data` - PostgreSQL database files
- `ollama_data` - Ollama models and cache
- `storage_data` - Uploaded document files

### Backup database volume
```bash
docker run --rm -v synthesis_postgres_data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/postgres-backup-$(date +%Y%m%d).tar.gz /data
```

### Remove specific volume (⚠️ data loss)
```bash
docker volume rm synthesis_postgres_data
docker volume rm synthesis_ollama_data
```

---

## 🐳 Docker Compose Services

| Service | Container Name | Port | Purpose |
|---------|---------------|------|---------|
| `synthesis-db` | synthesis-db | 5432 | PostgreSQL + pgvector |
| `synthesis-ollama` | synthesis-ollama | 11434 | Local LLM with GPU |
| `synthesis-server` | synthesis-server | 3333 | Fastify backend API |
| `synthesis-web` | synthesis-web | 5173 | React frontend |
| `synthesis-mcp` | synthesis-mcp | 3334 | MCP server |

**Note:** Services with `profiles: [app]` only start with `--profile app` flag.

---

## 🎯 Common Workflows

### Daily Development
```bash
# Start infrastructure (once)
docker compose up -d synthesis-db synthesis-ollama

# Run dev servers (each session)
pnpm --filter @synthesis/server dev
pnpm --filter @synthesis/web dev
```

### Testing Full Stack
```bash
# Start everything in Docker
docker compose --profile app up -d

# Watch logs
docker compose logs -f

# Stop when done
docker compose down
```

### Fresh Start (Reset Everything)
```bash
# Stop and remove everything including data
docker compose down -v

# Rebuild and start
docker compose up -d synthesis-db synthesis-ollama

# Wait for database to be ready
sleep 10

# Run migrations
pnpm --filter @synthesis/db migrate
```

### Production Deployment
```bash
# Build images
docker compose --profile app build

# Start in detached mode
docker compose --profile app up -d

# Check health
docker compose ps
docker compose logs --tail 100
```

---

## ⚡ Quick Reference

| What You Want | Command |
|---------------|---------|
| **Start DB + Ollama** | `docker compose up -d synthesis-db synthesis-ollama` |
| **Start everything** | `docker compose --profile app up -d` |
| **Stop all** | `docker compose down` |
| **Stop all + delete data** | `docker compose down -v` |
| **Check status** | `docker compose ps` |
| **View logs** | `docker compose logs -f` |
| **Restart service** | `docker compose restart synthesis-db` |
| **Rebuild service** | `docker compose up -d --build synthesis-server` |
| **Database health** | `docker compose exec synthesis-db pg_isready -U postgres` |
| **List Ollama models** | `docker compose exec synthesis-ollama ollama list` |

---

## 🔐 Environment Variables

Set these before starting containers (or in `.env` file):

```bash
# Required
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/synthesis
ANTHROPIC_API_KEY=sk-ant-api03-xxx...

# Optional
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
SERVER_PORT=3333
NODE_ENV=development
```

**For containerized stack:**
```bash
# Example .env file
ANTHROPIC_API_KEY=sk-ant-api03-xxx...
MCP_MODE=stdio
```

---

## 💡 Pro Tips

1. **Use hybrid approach for development:** Infrastructure in Docker, apps locally
2. **Warm up Ollama:** Pull models after first start:
   ```bash
   docker compose exec synthesis-ollama ollama pull nomic-embed-text
   ```
3. **Monitor resources:** Use `docker stats` to see CPU/memory usage
4. **Clean up periodically:** Run `docker system prune` to free space
5. **Check logs frequently:** Tail logs during development to catch issues early

---

## 🆘 Getting Help

### Container won't start?
```bash
# Check logs for errors
docker compose logs synthesis-db

# Try recreating
docker compose up -d --force-recreate synthesis-db
```

### Port already in use?
```bash
# Find what's using port 5432
sudo lsof -i :5432
# or
sudo netstat -tulpn | grep 5432
```

### Database connection refused?
```bash
# Wait for health check
docker compose ps

# Should show "healthy" for synthesis-db
# If "starting", wait 10 seconds and check again
```

### GPU not detected in Ollama?
```bash
# Check NVIDIA runtime
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi

# Check Ollama logs
docker compose logs synthesis-ollama | grep -i gpu
```

---

## 📚 Additional Resources

- **Docker Compose docs:** https://docs.docker.com/compose/
- **pgvector:** https://github.com/pgvector/pgvector
- **Ollama:** https://ollama.ai/
- **Project setup:** `docs/10_ENV_SETUP.md`
- **Database schema:** `docs/03_DATABASE_SCHEMA.md`
- **pgAdmin setup:** `docs/PGADMIN_SETUP.md`

---

**Last Updated:** October 14, 2025  
**Project:** Synthesis RAG  
**Docker Compose Version:** 3.9+

