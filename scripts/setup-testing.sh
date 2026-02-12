#!/bin/bash
# One-time setup for testing infrastructure
# Run this after cloning the repository

set -e

echo "========================================"
echo "Mazes of Menace - Testing Setup"
echo "========================================"
echo ""
echo "This script will configure git hooks and test automation."
echo ""

# Check if already configured
CURRENT_HOOKS=$(git config --local core.hooksPath || echo "")
if [ "$CURRENT_HOOKS" = ".githooks" ]; then
  echo "✅ Hooks already configured"
else
  echo "Configuring git hooks..."
  git config core.hooksPath .githooks
  echo "✅ Hooks configured: .githooks"
fi

# Clean up any stale notes fetch/push refspecs before adding correct ones
echo "Configuring notes fetch/push..."
git config --local --unset-all remote.origin.fetch '+refs/notes.*' 2>/dev/null || true
git config --local --unset-all remote.origin.push '.*refs/notes.*' 2>/dev/null || true
# Also clean push refspec for heads if we previously set it
git config --local --unset-all remote.origin.push 'refs/heads.*' 2>/dev/null || true

# Fetch notes directly with force (remote wins — backfills are authoritative)
git config --local --add remote.origin.fetch '+refs/notes/*:refs/notes/*'
echo "✅ Auto-fetch for notes configured (remote-over-local)"
echo "✅ Notes auto-push via pre-push hook"

# Configure notes rewriting on rebase
git config --local notes.rewriteRef 'refs/notes/*'
echo "✅ Notes rewriting configured"

# Make sure all scripts are executable
echo "Ensuring all hook scripts are executable..."
chmod +x .githooks/*.sh .githooks/pre-* 2>/dev/null || true
echo "✅ Scripts are executable"

# Fetch notes from remote (force-overwrites local with remote)
echo "Fetching notes from remote..."
if git fetch origin 2>/dev/null; then
  echo "✅ Notes fetched"

  # Rebuild dashboard from notes
  if [ -x .githooks/sync-notes-to-jsonl.sh ]; then
    echo "Rebuilding dashboard from test notes..."
    .githooks/sync-notes-to-jsonl.sh
    echo "✅ Dashboard rebuilt"
  fi
else
  echo "ℹ️  Could not fetch from remote"
fi

echo ""
echo "========================================"
echo "✅ Setup Complete!"
echo "========================================"
echo ""
echo "Your repository is now configured for testing."
echo ""
echo "Quick Start:"
echo "  1. Make changes to code"
echo "  2. Run: .githooks/commit-with-tests-notes.sh \"message\" file.js"
echo "  3. Run: git push"
echo ""
echo "Documentation:"
echo "  - Quick Reference: .githooks/QUICK_REFERENCE.md"
echo "  - Main Guide: docs/TESTING.md"
echo "  - Git Notes: docs/TESTING_GIT_NOTES.md"
echo ""
echo "View dashboard:"
echo "  - Local: open teststats/index.html"
echo "  - GitHub Pages: https://davidbau.github.io/mazesofmenace/teststats/"
echo ""
echo "May your tests always pass!"
echo ""
