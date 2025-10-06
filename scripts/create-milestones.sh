#!/bin/bash
# Create GitHub Milestones for Synthesis Project
set -e

REPO="beaulewis1977/synthesis"

echo "Creating milestones for Synthesis project..."

# Calculate dates (7-9 day build starting Oct 7, 2025)
# Start date: Oct 7, 2025 (Day 1)
# Days 1-2: Oct 7-8
# Days 3-4: Oct 9-10
# Days 5-6: Oct 11-12
# Days 7-9: Oct 13-15

# Milestone 1: Phase 1-2 (Day 1-2)
gh api repos/$REPO/milestones \
  --method POST \
  --field title="Phase 1-2: Core Pipeline" \
  --field description="Database setup, extraction, chunking, embeddings" \
  --field due_on="2025-10-08T23:59:59Z" \
  --field state="open"

# Milestone 2: Phase 3-4 (Day 3-4)
gh api repos/$REPO/milestones \
  --method POST \
  --field title="Phase 3-4: Agent & Autonomy" \
  --field description="Vector search, agent tools, web fetching" \
  --field due_on="2025-10-10T23:59:59Z" \
  --field state="open"

# Milestone 3: Phase 5-6 (Day 5-6)
gh api repos/$REPO/milestones \
  --method POST \
  --field title="Phase 5-6: UI & MCP" \
  --field description="Frontend interface, MCP server" \
  --field due_on="2025-10-12T23:59:59Z" \
  --field state="open"

# Milestone 4: Phase 7-9 (Day 7-9)
gh api repos/$REPO/milestones \
  --method POST \
  --field title="Phase 7-9: Production Ready" \
  --field description="Docker, polish, testing, documentation" \
  --field due_on="2025-10-15T23:59:59Z" \
  --field state="open"

echo "4 milestones created"
