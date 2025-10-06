#!/bin/bash
# Master script to create all GitHub issues
set -e

REPO="beaulewis1977/synthesis"

echo "🚀 Creating all GitHub issues for Synthesis RAG"
echo "Repository: $REPO"
echo ""

# Make all scripts executable
chmod +x create-milestones.sh
chmod +x create-phase1-issues.sh
chmod +x create-phase2-issues.sh
chmod +x create-phase3-issues.sh
chmod +x create-remaining-issues.sh

# Step 1: Create milestones
echo "📋 Step 1: Creating milestones..."
./create-milestones.sh
echo ""

# Step 2: Create Phase 1 issues
echo "📝 Step 2: Creating Phase 1 issues..."
./create-phase1-issues.sh
echo ""

# Step 3: Create Phase 2 issues
echo "📝 Step 3: Creating Phase 2 issues..."
./create-phase2-issues.sh
echo ""

# Step 4: Create Phase 3 issues
echo "📝 Step 4: Creating Phase 3 issues..."
./create-phase3-issues.sh
echo ""

# Step 5: Create Phase 4-9 issues
echo "📝 Step 5: Creating Phase 4-9 issues..."
./create-remaining-issues.sh
echo ""

echo "✅ All issues created successfully!"
echo ""
echo "📊 Summary:"
echo "  - 4 milestones"
echo "  - 9 epic issues (one per phase)"
echo "  - ~25 story issues (implementation tasks)"
echo ""
echo "🔗 View issues:"
echo "  gh issue list --repo $REPO"
echo ""
echo "📈 View project board:"
echo "  https://github.com/$REPO/issues"
echo ""
echo "🎉 Ready to start building!"
