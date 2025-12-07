#!/usr/bin/env bash
#
# Synthesis Docker Production Startup Script
# Starts ALL services in Docker containers (production-like environment)
#
# Usage: ./scripts/docker-all.sh [options]
#   --build         Rebuild containers before starting
#   --clean         Remove volumes and rebuild from scratch
#   --logs          Follow logs after starting
#   --stop          Stop all containers
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
DO_BUILD=false
DO_CLEAN=false
FOLLOW_LOGS=false
DO_STOP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --build)
      DO_BUILD=true
      shift
      ;;
    --clean)
      DO_CLEAN=true
      shift
      ;;
    --logs)
      FOLLOW_LOGS=true
      shift
      ;;
    --stop)
      DO_STOP=true
      shift
      ;;
    --help|-h)
      echo "Synthesis Docker Production Startup Script"
      echo ""
      echo "Usage: ./scripts/docker-all.sh [options]"
      echo ""
      echo "Options:"
      echo "  --build         Rebuild containers before starting"
      echo "  --clean         Remove volumes and rebuild from scratch"
      echo "  --logs          Follow logs after starting"
      echo "  --stop          Stop all containers"
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

# Handle stop command
if [ "$DO_STOP" = true ]; then
  echo -e "${YELLOW}Stopping all Synthesis containers...${NC}"
  docker compose --profile app down
  echo -e "${GREEN}✓ All containers stopped${NC}"
  exit 0
fi

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         Synthesis Docker Production Environment            ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to wait for a service to be healthy
wait_for_container() {
  local container=$1
  local max_attempts=${2:-60}
  local attempt=1

  echo -e "${YELLOW}Waiting for $container to be healthy...${NC}"
  while [ $attempt -le $max_attempts ]; do
    local status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not_found")
    if [ "$status" = "healthy" ]; then
      echo -e "${GREEN}✓ $container is healthy${NC}"
      return 0
    elif [ "$status" = "not_found" ]; then
      echo -e "${RED}✗ Container $container not found${NC}"
      return 1
    fi
    sleep 2
    attempt=$((attempt + 1))
  done
  echo -e "${RED}✗ $container failed to become healthy after $((max_attempts * 2)) seconds${NC}"
  return 1
}

# Step 1: Check prerequisites
echo -e "${BLUE}[1/4] Checking prerequisites...${NC}"

if ! command_exists docker; then
  echo -e "${RED}✗ Docker is not installed${NC}"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo -e "${RED}✗ Docker is not running. Please start Docker first.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check for .env file
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo -e "${YELLOW}⚠ No .env file found. Copying from .env.example...${NC}"
    cp .env.example .env
    echo -e "${RED}✗ Please edit .env and add your ANTHROPIC_API_KEY, then run again.${NC}"
    exit 1
  else
    echo -e "${RED}✗ No .env file found. Please create one with ANTHROPIC_API_KEY.${NC}"
    exit 1
  fi
fi

# Verify ANTHROPIC_API_KEY is set
if ! grep -q "ANTHROPIC_API_KEY=sk-" .env 2>/dev/null; then
  echo -e "${YELLOW}⚠ ANTHROPIC_API_KEY may not be set in .env${NC}"
fi

echo -e "${GREEN}✓ Environment file found${NC}"

# Step 2: Handle clean/build options
if [ "$DO_CLEAN" = true ]; then
  echo ""
  echo -e "${YELLOW}[2/4] Cleaning up (removing containers and volumes)...${NC}"
  docker compose --profile app down -v
  echo -e "${GREEN}✓ Cleanup complete${NC}"
fi

# Step 3: Build if requested
if [ "$DO_BUILD" = true ] || [ "$DO_CLEAN" = true ]; then
  echo ""
  echo -e "${BLUE}[3/4] Building containers...${NC}"
  docker compose --profile app build
  echo -e "${GREEN}✓ Build complete${NC}"
else
  echo ""
  echo -e "${YELLOW}[3/4] Skipping build (use --build to rebuild)${NC}"
fi

# Step 4: Start all services
echo ""
echo -e "${BLUE}[4/4] Starting all services...${NC}"

# Start infrastructure first
docker compose up -d synthesis-db synthesis-ollama synthesis-redis

# Wait for database to be ready
wait_for_container "synthesis-db" 30

# Wait for Redis
echo -e "${YELLOW}Waiting for Redis...${NC}"
sleep 2
if docker compose exec -T synthesis-redis redis-cli ping >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Redis is ready${NC}"
else
  echo -e "${YELLOW}⚠ Redis may still be starting${NC}"
fi

# Start application containers
docker compose --profile app up -d

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              All Services Running in Docker                ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Backend Server:   http://localhost:3333                   ║${NC}"
echo -e "${GREEN}║  Web Frontend:     http://localhost:5173                   ║${NC}"
echo -e "${GREEN}║  MCP Server:       http://localhost:3334                   ║${NC}"
echo -e "${GREEN}║  PostgreSQL:       localhost:5432                          ║${NC}"
echo -e "${GREEN}║  Ollama:           http://localhost:11434                  ║${NC}"
echo -e "${GREEN}║  Redis:            localhost:6379                          ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Commands:                                                 ║${NC}"
echo -e "${GREEN}║    View logs:  docker compose --profile app logs -f        ║${NC}"
echo -e "${GREEN}║    Stop all:   ./scripts/docker-all.sh --stop              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"

# Follow logs if requested
if [ "$FOLLOW_LOGS" = true ]; then
  echo ""
  echo -e "${CYAN}Following logs (Ctrl+C to exit)...${NC}"
  docker compose --profile app logs -f
fi
