#!/bin/bash
# Unified setup script for Mazes of Menace
# Run this after cloning the repository
set -e

echo "========================================"
echo "Mazes of Menace - Setup"
echo "========================================"
echo ""

# 1. Install npm dependencies (puppeteer for E2E tests)
#    postinstall hook configures git hooks and test automation
echo "Installing dependencies..."
npm install
echo ""

# 2. Build C NetHack binary for comparison tests
if [ -f test/comparison/c-harness/setup.sh ]; then
  echo "Building C NetHack harness for comparison tests..."
  bash test/comparison/c-harness/setup.sh
else
  echo "Skipping C harness setup (test/comparison/c-harness/setup.sh not found)"
fi

echo ""
echo "========================================"
echo "Setup complete!"
echo "========================================"
echo ""
echo "Quick start:"
echo "  npm test           # run all tests"
echo "  npm run serve      # serve locally at http://localhost:8080"
echo ""
