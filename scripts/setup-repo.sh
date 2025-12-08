#!/bin/bash
# Fresh Synthesis Repository Setup
# Run this from WSL in /home/kngpnn/dev/synthesis

set -e  # Exit on error

echo "🚀 Setting up fresh Synthesis repository..."

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
*.lcov

# Build
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Storage
storage/*
!storage/.gitkeep

# Misc
.turbo/
.cache/
EOF

# Create README
cat > README.md << 'EOF'
# Synthesis RAG

[![CI](https://github.com/beaulewis1977/synthesis/workflows/CI/badge.svg)](https://github.com/beaulewis1977/synthesis/actions)

Autonomous RAG system powered by Claude Agent SDK for multi-project documentation management.

## 📚 Documentation

See [docs/00_START_HERE.md](docs/00_START_HERE.md) to begin.

## 🚀 Quick Start

1. **Setup Environment:** Follow [docs/10_ENV_SETUP.md](docs/10_ENV_SETUP.md)
2. **Start Building:** See [docs/09_BUILD_PLAN.md](docs/09_BUILD_PLAN.md)
3. **Agent Workflow:** Read [docs/Agent-Collaboration-Workflow.md](docs/Agent-Collaboration-Workflow.md)

## 🎯 Status

🚧 **Under Active Development** - Starting Phase 1

## 📋 Tech Stack

- **Backend:** Node.js 22, Fastify, TypeScript
- **Frontend:** React, Vite, Tailwind CSS
- **Database:** PostgreSQL + pgvector
- **AI:** Claude Agent SDK, Ollama
- **Deployment:** Docker Compose

## 📖 Planning Docs

All planning documentation is in the [docs/](docs/) directory.
EOF

# Create storage directory and .gitkeep
mkdir -p storage
touch storage/.gitkeep

# Create pnpm-workspace.yaml
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF

# Initial commit
git add .
git commit -m "chore: initial commit with project structure and planning docs"

echo "✅ Local repository initialized"

# Setup remote
git remote add origin git@github.com:beaulewis1977/synthesis.git

echo "📤 Pushing to GitHub..."
git push -u origin main

# Create develop branch
git checkout -b develop
git push -u origin develop

echo "✅ Branches created: main, develop"
echo ""
echo "🎉 Repository setup complete!"
echo ""
echo "Next steps:"
echo "2. Setup branch protection"
echo "3. Create milestones and issues"
echo ""
echo "Run: gh repo edit beaulewis1977/synthesis --default-branch develop"
echo "4. Create a new branch for the first feature"
echo "   Run: git checkout -b feature/initial-build"
echo ""
