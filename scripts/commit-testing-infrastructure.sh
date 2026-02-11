#!/bin/bash
# Commit the complete testing infrastructure
# Run this to add all testing infrastructure files to git

set -e

echo "=========================================="
echo "Testing Infrastructure - Commit Helper"
echo "=========================================="
echo ""
echo "This script will stage and commit all testing infrastructure files."
echo ""

# Verify we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ Error: Not in a git repository"
  exit 1
fi

# Check for uncommitted changes in non-testing files
OTHER_CHANGES=$(git status --short | grep -v "^??" | grep -v -E "(package.json|README.md)" || true)
if [ -n "$OTHER_CHANGES" ]; then
  echo "⚠️  Warning: You have other uncommitted changes:"
  echo "$OTHER_CHANGES"
  echo ""
  echo "This script will only commit testing infrastructure files."
  echo "Your other changes will remain staged/unstaged."
  echo ""
fi

# Count files to be added
NEW_FILES=$(git status --short | grep "^??" | wc -l)
MODIFIED_FILES=$(git status --short | grep "^ M" | wc -l)

echo "Files to commit:"
echo "  New:      $NEW_FILES files"
echo "  Modified: $MODIFIED_FILES files"
echo ""

# Verify critical files exist
echo "Verifying critical files..."

CRITICAL_FILES=(
  "scripts/setup-testing.sh"
  ".githooks/pre-push"
  ".githooks/pre-push-notes"
  ".githooks/pre-commit"
  ".githooks/check-setup.sh"
  ".githooks/test-and-log-to-note.sh"
  ".githooks/sync-notes-to-jsonl.sh"
  "TESTING_DASHBOARD.md"
  "docs/TESTING_GIT_NOTES.md"
  "teststats/index.html"
  ".github/workflows/test-enforcement.yml"
)

MISSING=0
for file in "${CRITICAL_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing: $file"
    MISSING=$((MISSING + 1))
  fi
done

if [ $MISSING -gt 0 ]; then
  echo ""
  echo "❌ Error: $MISSING critical files are missing"
  echo "   Cannot proceed with commit"
  exit 1
fi

echo "✅ All critical files present"
echo ""

# Verify scripts are executable
echo "Verifying script permissions..."
NON_EXECUTABLE=0
for script in .githooks/*.sh .githooks/pre-* scripts/setup-testing.sh; do
  if [ -f "$script" ] && [ ! -x "$script" ]; then
    echo "⚠️  Not executable: $script"
    chmod +x "$script"
    echo "   Fixed: chmod +x $script"
  fi
done

echo "✅ All scripts executable"
echo ""

# Validate YAML
echo "Validating GitHub Actions workflow..."
if command -v yamllint >/dev/null 2>&1; then
  if yamllint .github/workflows/test-enforcement.yml 2>/dev/null; then
    echo "✅ YAML syntax valid"
  else
    echo "⚠️  YAML validation warnings (may be OK)"
  fi
elif command -v python3 >/dev/null 2>&1; then
  if python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test-enforcement.yml'))" 2>/dev/null; then
    echo "✅ YAML syntax valid"
  else
    echo "⚠️  YAML validation failed (check syntax)"
  fi
else
  echo "ℹ️  YAML validation skipped (no validator found)"
fi
echo ""

# Validate JSON in teststats
echo "Validating JSON files..."
if command -v jq >/dev/null 2>&1; then
  if [ -f teststats/results.jsonl ]; then
    if cat teststats/results.jsonl | jq empty 2>/dev/null; then
      echo "✅ results.jsonl is valid"
    else
      echo "⚠️  results.jsonl has invalid JSON"
    fi
  fi
  if [ -f teststats/schema.json ]; then
    if jq empty teststats/schema.json >/dev/null 2>&1; then
      echo "✅ schema.json is valid"
    else
      echo "❌ schema.json has invalid JSON"
      exit 1
    fi
  fi
else
  echo "ℹ️  JSON validation skipped (jq not found)"
fi
echo ""

# Show what will be staged
echo "Files to be staged:"
echo ""
echo "Infrastructure scripts:"
git status --short | grep -E "(setup-testing\.sh|\.githooks/|commit-testing)" || true
echo ""
echo "Documentation:"
git status --short | grep -E "\.md$" | grep -E "(TESTING|SETUP|AUTOMATION|INFRASTRUCTURE)" || true
echo ""
echo "Dashboard:"
git status --short | grep "teststats/" || true
echo ""
echo "GitHub Actions:"
git status --short | grep "\.github/" || true
echo ""
echo "Configuration:"
git status --short | grep -E "(package\.json|_config\.yml|README\.md)" || true
echo ""

# Confirm
echo "=========================================="
echo "Ready to commit"
echo "=========================================="
echo ""
echo "This will:"
echo "  1. Stage all testing infrastructure files"
echo "  2. Commit with a descriptive message"
echo "  3. Show next steps for pushing"
echo ""
read -p "Proceed? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Staging files..."

# Stage testing infrastructure files
git add .githooks/
git add teststats/
git add scripts/setup-testing.sh
git add scripts/commit-testing-infrastructure.sh
git add TESTING_DASHBOARD.md
git add TESTING_INFRASTRUCTURE_SUMMARY.md
git add AUTOMATION_LAYERS.md
git add SETUP_AFTER_CLONE.md
git add docs/TESTING_GIT_NOTES.md
git add docs/TESTING.md
git add .github/workflows/test-enforcement.yml
git add _config.yml
git add package.json
git add README.md

echo "✅ Files staged"
echo ""

# Create commit
echo "Creating commit..."
echo ""

COMMIT_MESSAGE="Add comprehensive testing infrastructure

Implements a complete testing dashboard and enforcement system with
multiple automation layers and NetHack-themed documentation.

## Features

**Git Notes Approach (Recommended)**:
- Solves chicken-and-egg problem (notes can reference commit hash)
- Clean git history (one commit per change)
- Test data travels with commits
- Dashboard one commit behind (acceptable)

**Automation Layers**:
1. npm postinstall - Automatic setup after npm install
2. Smart hooks - Detect missing setup, prompt to configure
3. Manual setup script - ./setup.sh (one command)
4. Documentation - Clear instructions in multiple places

**Full Schema Compliance**:
- All fields populated (commit, stats, categories, regression, newTests)
- Category breakdowns (map, gameplay, chargen, special)
- Duration tracking
- New test counting

**GitHub Actions Enforcement**:
- Accepts BOTH approaches (git notes OR two-commit)
- Validates JSONL format
- Detects regressions
- Provides helpful error messages

**Documentation** (NetHack-themed):
- TESTING_DASHBOARD.md - Main guide (17KB)
- docs/TESTING_GIT_NOTES.md - Git notes deep dive (8.2KB)
- docs/TESTING.md - Legacy approach (updated)
- .githooks/QUICK_REFERENCE.md - Command cheat sheet
- AUTOMATION_LAYERS.md - Automation explanation
- SETUP_AFTER_CLONE.md - Setup requirements
- teststats/README.md - Dashboard guide

**Dashboard**:
- GitHub Pages ready (teststats/index.html)
- Timeline visualization
- Category breakdowns
- Regression highlighting
- Commit scrubber

## Files Added

New files (15):
- scripts/setup-testing.sh
- scripts/commit-testing-infrastructure.sh
- TESTING_DASHBOARD.md
- TESTING_INFRASTRUCTURE_SUMMARY.md
- AUTOMATION_LAYERS.md
- SETUP_AFTER_CLONE.md
- docs/TESTING_GIT_NOTES.md
- teststats/README.md
- .githooks/*.sh (9 scripts)
- .githooks/pre-commit
- .githooks/pre-push-notes
- .github/workflows/test-enforcement.yml
- _config.yml

Modified files (3):
- package.json - Added postinstall script
- README.md - Added setup instructions
- docs/TESTING.md - Added legacy notice

## Quick Start

After pulling these changes:
\`\`\`bash
npm install  # Automatic setup via postinstall
# OR
./setup.sh  # Full setup (dependencies + testing + C harness)
\`\`\`

Then use the helper script:
\`\`\`bash
.githooks/commit-with-tests-notes.sh \"Your message\" file.js
git push
\`\`\`

## Documentation

Main guide: TESTING_DASHBOARD.md
Setup guide: SETUP_AFTER_CLONE.md
Quick reference: .githooks/QUICK_REFERENCE.md

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

git commit -m "$COMMIT_MESSAGE"

COMMIT_HASH=$(git rev-parse --short HEAD)
echo ""
echo "✅ Committed: $COMMIT_HASH"
echo ""

# Show next steps
echo "=========================================="
echo "✅ Success!"
echo "=========================================="
echo ""
echo "Testing infrastructure committed: $COMMIT_HASH"
echo ""
echo "Next steps:"
echo ""
echo "1. Review the commit:"
echo "   git show --stat"
echo ""
echo "2. Push to GitHub:"
echo "   git push"
echo ""
echo "3. If you have test notes, push them too:"
echo "   git push origin refs/notes/test-results"
echo ""
echo "4. Enable GitHub Pages:"
echo "   - Go to repository settings"
echo "   - Pages section"
echo "   - Source: Deploy from main branch"
echo "   - Dashboard will be at:"
echo "     https://davidbau.github.io/mazesofmenace/teststats/"
echo ""
echo "5. Share with team:"
echo "   - New clones: npm install (auto-setup)"
echo "   - Existing clones: ./setup.sh"
echo ""
echo "Documentation:"
echo "  - Main guide: TESTING_DASHBOARD.md"
echo "  - Quick start: .githooks/QUICK_REFERENCE.md"
echo ""
echo "May your tests always pass!"
echo ""
