#!/bin/bash
# Complete Setup for Synthesis RAG Repository
set -e

REPO='beaulewis1977/synthesis'

echo '🚀 Synthesis RAG - Complete Setup'
echo '=================================='
echo ''

# Step 1: Initialize repo (if not done)
if [ ! -f README.md ]; then
  echo '📝 Creating initial files...'
  
  cat > README.md << 'EOF'
# Synthesis RAG

Autonomous RAG system powered by Claude Agent SDK.

## Documentation
See [docs/00_START_HERE.md](docs/00_START_HERE.md)

## Status
🚧 Phase 1 - Under Development
EOF

  cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF

  touch storage/.gitkeep
  
  git add .
  git commit -m 'chore: initial commit with project structure'
  git remote add origin git@github.com:.git
  git push -u origin main --force
  git checkout -b develop
  git push -u origin develop
fi

echo '✅ Repository initialized'
echo ''

# Step 2: Configure GitHub
echo '🔧 Configuring GitHub...'
gh repo edit  --default-branch develop
echo '✅ Default branch set to develop'
echo ''

# Step 3: Create labels
echo '🏷️  Creating labels...'
for i in {1..9}; do
  gh label create \
