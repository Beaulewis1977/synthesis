#!/bin/bash
# Setup GitHub repo configuration
# Run after setup-repo.sh

set -e

REPO="beaulewis1977/synthesis"

echo "🔧 Configuring GitHub repository..."

# Set develop as default branch
echo "📌 Setting develop as default branch..."
gh repo edit $REPO --default-branch develop

# Create labels
echo "🏷️  Creating labels..."

# Phase labels
for i in {1..9}; do
  gh label create "phase-$i" --repo $REPO --color "0052CC" --description "Phase $i work" || true
done

# Type labels
gh label create "epic" --repo $REPO --color "8B00FF" --description "Epic/phase-level issue" || true
gh label create "feature" --repo $REPO --color "1D76DB" --description "New feature" || true
gh label create "bugfix" --repo $REPO --color "D73A4A" --description "Bug fix" || true
gh label create "docs" --repo $REPO --color "0075CA" --description "Documentation" || true
gh label create "refactor" --repo $REPO --color "FBCA04" --description "Code refactoring" || true
gh label create "test" --repo $REPO --color "BFD4F2" --description "Testing" || true

# Priority labels
gh label create "priority:low" --repo $REPO --color "C2E0C6" --description "Low priority" || true
gh label create "priority:medium" --repo $REPO --color "FEF2C0" --description "Medium priority" || true
gh label create "priority:high" --repo $REPO --color "FBCA04" --description "High priority" || true
gh label create "priority:critical" --repo $REPO --color "D73A4A" --description "Critical" || true

# Status labels
gh label create "needs-review" --repo $REPO --color "FBCA04" --description "Awaiting review" || true
gh label create "changes-requested" --repo $REPO --color "D93F0B" --description "Changes needed" || true
gh label create "approved" --repo $REPO --color "0E8A16" --description "Approved to merge" || true

# Size labels
gh label create "size:xs" --repo $REPO --color "E0F2F1" --description "Extra small change" || true
gh label create "size:small" --repo $REPO --color "C8E6C9" --description "Small change" || true
gh label create "size:medium" --repo $REPO --color "FFF9C4" --description "Medium change" || true
gh label create "size:large" --repo $REPO --color "FFE0B2" --description "Large change" || true
gh label create "size:xl" --repo $REPO --color "FFCDD2" --description "Extra large change" || true

echo "✅ Labels created"

# Note about branch protection
echo ""
echo "⚠️  Branch protection must be set manually on GitHub:"
echo ""
echo "For 'main' branch:"
echo "  Settings → Branches → Add rule"
echo "  - Require pull request (2 approvals)"
echo "  - Require status checks"
echo "  - Require conversation resolution"
echo ""
echo "For 'develop' branch:"
echo "  Settings → Branches → Add rule"  
echo "  - Require pull request (1 approval)"
echo "  - Require status checks"
echo "  - Require conversation resolution"
echo ""
echo "Or visit: https://github.com/$REPO/settings/branches"
echo ""
echo "✅ GitHub configuration complete!"
