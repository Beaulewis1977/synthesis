#!/bin/bash
# Synthesis Development Start Script
# Uses: Local PostgreSQL, Local Ollama, Docker Redis

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Synthesis Development Environment   ${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if local PostgreSQL is running
echo -e "\n${YELLOW}Checking PostgreSQL...${NC}"
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is running on localhost:5432${NC}"
else
    echo -e "${RED}✗ PostgreSQL is not running. Start it with: sudo systemctl start postgresql${NC}"
    exit 1
fi

# Check if Ollama is running
echo -e "\n${YELLOW}Checking Ollama...${NC}"
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Ollama is running on localhost:11434${NC}"
else
    echo -e "${RED}✗ Ollama is not running. Start it with: ollama serve${NC}"
    exit 1
fi

# Start Redis via Docker (only if not already running)
echo -e "\n${YELLOW}Checking Redis...${NC}"
if docker ps | grep -q synthesis-redis; then
    echo -e "${GREEN}✓ Redis is already running${NC}"
else
    echo -e "${YELLOW}Starting Redis via Docker...${NC}"
    docker compose up -d synthesis-redis
    sleep 2
    echo -e "${GREEN}✓ Redis started on localhost:6379${NC}"
fi

# Export environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/synthesis"
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"
export OLLAMA_BASE_URL="http://localhost:11434"
export STORAGE_PATH="$(pwd)/storage"
export REDIS_URL="redis://localhost:6379"

echo -e "\n${GREEN}Environment configured:${NC}"
echo "  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/synthesis"
echo "  OLLAMA_BASE_URL: http://localhost:11434"
echo "  REDIS_URL: redis://localhost:6379"
echo "  STORAGE_PATH: $(pwd)/storage"

# Parse command line arguments
case "${1:-all}" in
    server)
        echo -e "\n${GREEN}Starting Backend Server...${NC}"
        pnpm --filter @synthesis/server dev
        ;;
    web)
        echo -e "\n${GREEN}Starting Frontend...${NC}"
        pnpm --filter @synthesis/web dev
        ;;
    desktop)
        echo -e "\n${GREEN}Starting Desktop App...${NC}"
        pnpm --filter @synthesis/desktop dev
        ;;
    mcp)
        echo -e "\n${GREEN}Starting MCP Server...${NC}"
        pnpm --filter @synthesis/mcp dev
        ;;
    all)
        echo -e "\n${GREEN}Starting all services in background...${NC}"
        echo -e "${YELLOW}Use 'pkill -f pnpm' to stop all services${NC}"

        # Start backend
        echo "Starting backend on :3333..."
        pnpm --filter @synthesis/server dev > /tmp/synthesis-server.log 2>&1 &

        sleep 3

        # Start frontend
        echo "Starting frontend on :5173..."
        pnpm --filter @synthesis/web dev > /tmp/synthesis-web.log 2>&1 &

        sleep 2

        echo -e "\n${GREEN}========================================${NC}"
        echo -e "${GREEN}   All services started!                ${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo "  Backend:  http://localhost:3333"
        echo "  Frontend: http://localhost:5173"
        echo ""
        echo "Logs:"
        echo "  Backend:  tail -f /tmp/synthesis-server.log"
        echo "  Frontend: tail -f /tmp/synthesis-web.log"
        echo ""
        echo "To stop: pkill -f 'pnpm.*synthesis'"
        ;;
    *)
        echo "Usage: ./start.sh [server|web|desktop|mcp|all]"
        echo ""
        echo "  server  - Start backend only"
        echo "  web     - Start frontend only"
        echo "  desktop - Start desktop app (Tauri)"
        echo "  mcp     - Start MCP server"
        echo "  all     - Start backend + frontend (default)"
        ;;
esac
