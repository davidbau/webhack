#!/bin/bash
# Check if testing infrastructure is set up
# Called by other hooks to ensure proper configuration

check_setup() {
  local HOOKS_PATH=$(git config core.hooksPath)
  local AUTO_PUSH=$(git config --get-all remote.origin.push | grep -c "refs/notes/test-results" || echo 0)

  if [ "$HOOKS_PATH" != ".githooks" ] || [ "$AUTO_PUSH" -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "⚠️  Testing Infrastructure Not Configured"
    echo "=========================================="
    echo ""
    echo "It looks like you haven't run the setup script yet."
    echo ""
    echo "Quick fix (takes 5 seconds):"
    echo "  ./scripts/setup-testing.sh"
    echo ""
    echo "Or manually:"
    echo "  git config core.hooksPath .githooks"
    echo "  git config --add remote.origin.push '+refs/heads/*:refs/heads/*'"
    echo "  git config --add remote.origin.push '+refs/notes/test-results:refs/notes/test-results'"
    echo ""
    echo "Why this matters:"
    echo "  - Ensures test quality tracking"
    echo "  - Prevents regressions"
    echo "  - Syncs test results to dashboard"
    echo ""
    echo "Documentation: docs/TESTING.md"
    echo ""

    # Ask if user wants to run setup now
    if [ -t 0 ]; then  # Check if stdin is a terminal (interactive)
      echo "Would you like to run setup now? [y/N]"
      read -r response
      if [[ "$response" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Running setup..."
        if [ -x "./scripts/setup-testing.sh" ]; then
          ./scripts/setup-testing.sh
          return 0
        else
          echo "Error: scripts/setup-testing.sh not found or not executable"
          return 1
        fi
      fi
    fi

    return 1
  fi

  return 0
}

# If sourced, just define the function
# If executed directly, run the check
if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
  check_setup
fi
