#!/usr/bin/env bash
#
# Synthesis Development Startup Script
# Starts infrastructure in Docker and runs apps locally for hot reload
#
# Usage: ./scripts/dev.sh [options]
#   --skip-infra    Skip starting Docker infrastructure
#   --skip-build    Skip building packages
#   --server-only   Only start the backend server
#   --web-only      Only start the web frontend
#   --help          Show this help message

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Options
SKIP_INFRA=false
SKIP_BUILD=false
SERVER_ONLY=false
WEB_ONLY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-infra)
      SKIP_INFRA=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --server-only)
      SERVER_ONLY=true
      shift
      ;;
    --web-only)
      WEB_ONLY=true
      shift
      ;;
    --help|-h)
      echo "Synthesis Development Startup Script"
      echo ""
      echo "Usage: ./scripts/dev.sh [options]"
      echo ""
      echo "Options:"
      echo "  --skip-infra    Skip starting Docker infrastructure"
      echo "  --skip-build    Skip building packages"
      echo "  --server-only   Only start the backend server"
      echo "  --web-only      Only start the web frontend"
      echo "  --help          Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           Synthesis Development Environment                ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to wait for a service to be ready
wait_for_service() {
  local service=$1
  local check_cmd=$2
  local max_attempts=${3:-30}
  local attempt=1

  echo -e "${YELLOW}Waiting for $service to be ready...${NC}"
  while [ $attempt -le $max_attempts ]; do
    if eval "$check_cmd" >/dev/null 2>&1; then
      echo -e "${GREEN}✓ $service is ready${NC}"
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done
  echo -e "${RED}✗ $service failed to start after $max_attempts seconds${NC}"
  return 1
}

# Step 1: Check prerequisites
echo -e "${BLUE}[1/5] Checking prerequisites...${NC}"

if ! command_exists docker; then
  echo -e "${RED}✗ Docker is not installed${NC}"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo -e "${RED}✗ Docker is not running. Please start Docker first.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

if ! command_exists pnpm; then
  echo -e "${RED}✗ pnpm is not installed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ pnpm is available${NC}"

# Check for .env file
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo -e "${YELLOW}⚠ No .env file found. Copying from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠ Please edit .env and add your ANTHROPIC_API_KEY${NC}"
  else
    echo -e "${YELLOW}⚠ No .env file found. Make sure environment variables are set.${NC}"
  fi
fi

# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Step 2: Start Docker infrastructure
if [ "$SKIP_INFRA" = false ]; then
  echo ""
  echo -e "${BLUE}[2/5] Starting Docker infrastructure...${NC}"
  docker compose up -d synthesis-db synthesis-ollama synthesis-redis

  # Wait for PostgreSQL
  wait_for_service "PostgreSQL" "docker compose exec -T synthesis-db pg_isready -U postgres" 30

  # Wait for Redis
  wait_for_service "Redis" "docker compose exec -T synthesis-redis redis-cli ping" 10

  # Check Ollama (don't fail if it's slow)
  echo -e "${YELLOW}Checking Ollama...${NC}"
  if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Ollama is ready${NC}"
  else
    echo -e "${YELLOW}⚠ Ollama may still be starting. Models will be available shortly.${NC}"
  fi
else
  echo ""
  echo -e "${YELLOW}[2/5] Skipping infrastructure startup (--skip-infra)${NC}"
fi

# Step 3: Run database migrations
echo ""
echo -e "${BLUE}[3/5] Running database migrations...${NC}"
pnpm --filter @synthesis/db migrate
echo -e "${GREEN}✓ Migrations complete${NC}"

# Step 4: Build packages
if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo -e "${BLUE}[4/5] Building packages...${NC}"
  pnpm --filter @synthesis/shared build
  pnpm --filter @synthesis/db build
  echo -e "${GREEN}✓ Packages built${NC}"
else
  echo ""
  echo -e "${YELLOW}[4/5] Skipping package build (--skip-build)${NC}"
fi

# Step 5: Start applications
echo ""
echo -e "${BLUE}[5/5] Starting applications...${NC}"

# Set environment variables for the server
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/synthesis}"
export OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export STORAGE_PATH="${STORAGE_PATH:-$ROOT_DIR/storage}"

# Create storage directory if it doesn't exist
mkdir -p "$STORAGE_PATH"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   Services Starting                        ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Backend Server:   http://localhost:3333                   ║${NC}"
echo -e "${GREEN}║  Web Frontend:     http://localhost:5173                   ║${NC}"
echo -e "${GREEN}║  MCP Server:       http://localhost:3334                   ║${NC}"
echo -e "${GREEN}║  PostgreSQL:       localhost:5432                          ║${NC}"
echo -e "${GREEN}║  Ollama:           http://localhost:11434                  ║${NC}"
echo -e "${GREEN}║  Redis:            localhost:6379                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Press Ctrl+C to stop all services${NC}"
echo ""

# Trap to handle Ctrl+C gracefully
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  # Kill all background processes
  pkill -P $$ 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# Start services based on options
if [ "$SERVER_ONLY" = true ]; then
  echo -e "${BLUE}Starting server only...${NC}"
  pnpm --filter @synthesis/server dev
elif [ "$WEB_ONLY" = true ]; then
  echo -e "${BLUE}Starting web frontend only...${NC}"
  pnpm --filter @synthesis/web dev
else
  # Start all services concurrently
  # Using background processes with wait
  pnpm --filter @synthesis/server dev &
  SERVER_PID=$!

  sleep 2  # Give server a head start

  pnpm --filter @synthesis/web dev &
  WEB_PID=$!

  # Optionally start MCP server (uncomment if needed)
  # pnpm --filter @synthesis/mcp dev &
  # MCP_PID=$!

  # Wait for all background processes
  wait
fi
