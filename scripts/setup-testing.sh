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

# Check if auto-fetch is configured
if git config --local --get-all remote.origin.fetch | grep -q "refs/notes/"; then
  echo "✅ Auto-fetch for notes already configured"
else
  echo "Configuring auto-fetch for notes..."
  git config --local --add remote.origin.fetch '+refs/notes/*:refs/notes/*'
  echo "✅ Auto-fetch configured for notes"
fi

# Check if auto-push is configured
if git config --local --get-all remote.origin.push | grep -q "refs/notes/"; then
  echo "✅ Auto-push for notes already configured"
else
  echo "Configuring auto-push for all refs..."
  git config --local remote.origin.push "refs/heads/*:refs/heads/*"
  git config --local --add remote.origin.push "refs/notes/*:refs/notes/*"
  echo "✅ Auto-push configured for branches and notes"
fi

# Configure notes rewriting on rebase
if git config --local notes.rewriteRef | grep -q "refs/notes/"; then
  echo "✅ Notes rewriting already configured"
else
  echo "Configuring notes to survive rebases..."
  git config notes.rewriteRef refs/notes/*
  echo "✅ Notes rewriting configured"
fi

# Make sure all scripts are executable
echo "Ensuring all hook scripts are executable..."
chmod +x .githooks/*.sh .githooks/pre-* 2>/dev/null || true
echo "✅ Scripts are executable"

# Fetch notes if they exist
echo "Fetching notes from remote..."
if git fetch origin 'refs/notes/*:refs/notes/*' 2>/dev/null; then
  echo "✅ Notes fetched"

  # Rebuild dashboard from notes
  if [ -x .githooks/sync-notes-to-jsonl.sh ]; then
    echo "Rebuilding dashboard from test notes..."
    .githooks/sync-notes-to-jsonl.sh
    echo "✅ Dashboard rebuilt"
  fi
else
  echo "ℹ️  No test notes found on remote (this is normal for new repositories)"
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
