# Environment Setup & Docker Guide
**Version:** 1.0  
**Last Updated:** October 6, 2025

---

## 🎯 Quick Start

### Prerequisites
- Windows 11 + WSL2 (Ubuntu 24.04) OR Linux/macOS
- 16GB+ RAM
- NVIDIA GPU with 16GB VRAM (for Ollama)
- 50GB free disk space

### 5-Minute Setup
```bash
# 1. Install dependencies (WSL2/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 22
npm install -g pnpm@9.12.2

# 2. Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull nomic-embed-text
ollama pull llama3.2:3b

# 3. Clone and setup
git clone <repo-url>
cd synthesis
pnpm install
cp .env.example .env
# Edit .env with your API keys

# 4. Start services
docker compose up -d

# 5. Run migrations
pnpm --filter @synthesis/db migrate

# 6. Start development
pnpm --filter @synthesis/server dev &
pnpm --filter @synthesis/web dev
```

Visit http://localhost:5173

---

## 📋 Detailed Setup Instructions

### Step 1: WSL2 Setup (Windows Users)

**Enable WSL2:**
```powershell
# Run in PowerShell as Administrator
wsl --install
wsl --set-default-version 2
wsl --install -d Ubuntu-24.04
```

**Install Docker Desktop:**
1. Download from https://www.docker.com/products/docker-desktop
2. Install with WSL2 backend
3. Settings → Resources → WSL Integration → Enable for Ubuntu

**Configure WSL2:**
```bash
# Inside WSL2
sudo apt update
sudo apt install -y build-essential git wget curl
```

---

### Step 2: Node.js + pnpm

**Install nvm (Node Version Manager):**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Install Node 22
nvm install 22
nvm use 22
nvm alias default 22
```

**Install pnpm:**
```bash
npm install -g pnpm@9.12.2
```

**Verify:**
```bash
node --version  # Should show v22.x.x
pnpm --version  # Should show 9.12.2
```

---

### Step 3: Ollama (Local LLM)

**Install:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Pull Models:**
```bash
# Embeddings (required)
ollama pull nomic-embed-text

# Chat (optional, for local fallback)
ollama pull llama3.2:3b
ollama pull qwen2.5-coder:3b
```

**Verify:**
```bash
ollama list
# Should show: nomic-embed-text, llama3.2:3b

# Test
ollama run llama3.2:3b "Hello"
# Should respond
```

**Start Ollama Service:**
```bash
# Should start automatically, but if not:
systemctl start ollama
```

---

### Step 4: PostgreSQL (Docker)

**docker-compose.yml:**
```yaml
version: "3.9"

services:
  db:
    image: pgvector/pgvector:pg16
    container_name: synthesis_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: synthesis
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

  ollama:
    image: ollama/ollama:latest
    container_name: synthesis_ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

volumes:
  postgres_data:
  ollama_data:
```

**Start Services:**
```bash
docker compose up -d
```

**Verify:**
```bash
docker compose ps
# All services should be "healthy"

# Test Postgres
docker compose exec db psql -U postgres -c "SELECT version();"

# Test Ollama
curl http://localhost:11434/api/tags
```

---

### Step 5: API Keys

**Get Anthropic API Key:**
1. Visit https://console.anthropic.com/
2. Create account
3. Go to API Keys
4. Create new key

**Get Voyage API Key (optional):**
1. Visit https://www.voyageai.com/
2. Sign up
3. Dashboard → API Keys
4. Create key

---

### Step 6: Environment Variables

**Copy template:**
```bash
cp .env.example .env
```

**.env file:**
```bash
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/synthesis

# Anthropic (required)
ANTHROPIC_API_KEY=sk-ant-api03-xxx...

# Ollama (local)
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text

# Voyage (optional cloud embeddings)
VOYAGE_API_KEY=pa-xxx...

# LLM Toggle
USE_LOCAL_LLM=false  # false = Claude, true = Ollama

# Server
SERVER_PORT=3333
WEB_PORT=5173
NODE_ENV=development

# Storage
STORAGE_PATH=./storage

# MCP
MCP_PORT=3334
MCP_MODE=stdio  # stdio or sse
```

---

### Step 7: Install Dependencies

**Install workspace:**
```bash
cd synthesis
pnpm install
```

**Verify packages:**
```bash
pnpm list --depth=0
# Should show all apps and packages
```

---

### Step 8: Database Migrations

**Apply schema:**
```bash
pnpm --filter @synthesis/db migrate
```

**Verify:**
```bash
docker compose exec db psql -U postgres -d synthesis -c "\dt"
# Should show: collections, documents, chunks
```

**Seed data (optional):**
```bash
pnpm --filter @synthesis/db seed
```

---

### Step 9: Start Development Servers

**Terminal 1 - Backend:**
```bash
pnpm --filter @synthesis/server dev
```

**Terminal 2 - Frontend:**
```bash
pnpm --filter @synthesis/web dev
```

**Terminal 3 - MCP Server (optional):**
```bash
pnpm --filter @synthesis/mcp dev
```

**Verify:**
- Backend: http://localhost:3333/health
- Frontend: http://localhost:5173
- MCP: Stdio via IDE or SSE via http://localhost:3334

---

## 🐳 Docker Production Setup

**Build all images:**
```bash
docker compose -f docker-compose.prod.yml build
```

**Start production:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

**docker-compose.prod.yml:**
```yaml
version: "3.9"

services:
  db:
    image: pgvector/pgvector:pg16
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: synthesis
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  ollama:
    image: ollama/ollama:latest
    restart: always
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

  server:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
    restart: always
    depends_on:
      db:
        condition: service_healthy
      ollama:
        condition: service_started
    environment:
      - DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@db:5432/synthesis
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OLLAMA_HOST=http://ollama:11434
      - NODE_ENV=production
    ports:
      - "3333:3333"
    volumes:
      - storage_data:/app/storage

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        - VITE_API_URL=http://localhost:3333
    restart: always
    ports:
      - "80:80"

  mcp:
    build:
      context: .
      dockerfile: apps/mcp/Dockerfile
    restart: always
    depends_on:
      - server
    ports:
      - "3334:3334"

volumes:
  postgres_data:
  ollama_data:
  storage_data:
```

---

## 🔧 Troubleshooting

### Ollama Not Responding
```bash
# Check if running
systemctl status ollama

# Restart
systemctl restart ollama

# Check logs
journalctl -u ollama -f
```

### Postgres Connection Failed
```bash
# Check if running
docker compose ps db

# Check logs
docker compose logs db

# Test connection
psql postgres://postgres:postgres@localhost:5432/synthesis -c "SELECT 1;"
```

### pgvector Extension Missing
```bash
docker compose exec db psql -U postgres -d synthesis
# In psql:
CREATE EXTENSION IF NOT EXISTS vector;
\dx
```

### Port Already in Use
```bash
# Find process using port 3333
lsof -i :3333
# or
netstat -tulpn | grep 3333

# Kill process
kill -9 <PID>
```

### GPU Not Available in Docker
```bash
# Install nvidia-docker2
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker

# Test
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

---

## 📊 Health Checks

**Check all services:**
```bash
# Backend
curl http://localhost:3333/health

# Frontend
curl http://localhost:5173

# Ollama
curl http://localhost:11434/api/tags

# Postgres
docker compose exec db pg_isready -U postgres

# MCP
# For stdio mode: no HTTP check
# For SSE mode:
curl http://localhost:3334/health
```

---

## 🔐 Security Best Practices

### Production Environment
1. **Change default passwords:**
   ```bash
   DB_PASSWORD=$(openssl rand -base64 32)
   ```

2. **Use secrets management:**
   - Never commit `.env` to git
   - Use Docker secrets or vault

3. **Restrict network access:**
   ```yaml
   # docker-compose.prod.yml
   services:
     db:
       networks:
         - internal
     server:
       networks:
         - internal
         - external
   networks:
     internal:
       internal: true
     external:
   ```

4. **Enable HTTPS:**
   - Add nginx reverse proxy
   - Use Let's Encrypt certificates

---

## 📦 Backup & Restore

### Backup Database
```bash
docker compose exec db pg_dump -U postgres synthesis > backup.sql
```

### Restore Database
```bash
docker compose exec -T db psql -U postgres synthesis < backup.sql
```

### Backup Storage
```bash
tar -czf storage-backup.tar.gz storage/
```

---

## ✅ Setup Checklist

Before considering setup complete:

- [ ] Node 22.x installed
- [ ] pnpm 9.12.2 installed
- [ ] Docker running
- [ ] Ollama installed and models pulled
- [ ] Postgres running with pgvector
- [ ] API keys configured
- [ ] Dependencies installed (`pnpm install`)
- [ ] Migrations applied
- [ ] Backend starts without errors
- [ ] Frontend loads
- [ ] Can upload a test document
- [ ] Can search and get results

---

**Your environment is now ready for development!**
