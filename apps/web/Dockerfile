# Development Dockerfile for Synthesis Web
FROM node:22-alpine

# Install git
RUN apk add --no-cache git bash curl

# Set working directory
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY turbo.json ./

# Copy package.json files for all workspaces
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY apps/mcp/package.json ./apps/mcp/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code (will be overridden by volume mount in dev)
COPY apps/web ./apps/web
COPY packages ./packages

# Expose Vite dev server port
EXPOSE 5173

# Development command (with hot reload)
CMD ["pnpm", "--filter", "@synthesis/web", "dev", "--host", "0.0.0.0"]
