#!/bin/bash
# Configure automatic git notes syncing for test results
# Run this once to enable notes sync across repos

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
RESULTS_FILE="$REPO_ROOT/teststats/results.jsonl"

echo "Setting up git notes sync for test results..."
echo ""

# Configure automatic fetch/push of notes
echo "📝 Configuring git to sync notes..."
git config --add remote.origin.fetch '+refs/notes/test-results:refs/notes/test-results' 2>/dev/null || true
git config --add remote.origin.push '+refs/notes/test-results:refs/notes/test-results' 2>/dev/null || true
git config notes.rewriteRef refs/notes/test-results

echo "✅ Git notes sync configured"
echo ""
echo "Notes will now:"
echo "  - Auto-fetch with 'git pull'"
echo "  - Push with 'git push' (or explicitly: git push origin refs/notes/test-results)"
echo "  - Survive rebases/amends"
echo ""

# Offer to migrate existing JSONL to notes
if [ -f "$RESULTS_FILE" ] && [ -s "$RESULTS_FILE" ]; then
  LINE_COUNT=$(wc -l < "$RESULTS_FILE")
  echo "Found existing results.jsonl with $LINE_COUNT entries"
  echo ""
  read -p "Migrate existing entries to git notes? [y/N] " -n 1 -r
  echo

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Migrating $LINE_COUNT test results to git notes..."
    MIGRATED=0
    SKIPPED=0

    while IFS= read -r line; do
      # Extract commit hash from JSON
      COMMIT=$(echo "$line" | jq -r '.commit')

      # Check if this commit exists in repo
      if git rev-parse --verify "$COMMIT" >/dev/null 2>&1; then
        # Add note for this commit (overwrites if exists)
        echo "$line" | git notes --ref=test-results add -f -F - "$COMMIT" 2>/dev/null || true
        MIGRATED=$((MIGRATED + 1))
      else
        # Commit doesn't exist in this repo (might be from another branch/remote)
        SKIPPED=$((SKIPPED + 1))
      fi
    done < "$RESULTS_FILE"

    echo "✅ Migrated $MIGRATED entries to git notes"
    if [ $SKIPPED -gt 0 ]; then
      echo "⚠️  Skipped $SKIPPED entries (commits not in this repo)"
    fi
    echo ""
  fi
fi

# Fetch notes from remote if they exist
echo "Fetching notes from remote..."
git fetch origin refs/notes/test-results:refs/notes/test-results 2>/dev/null && \
  echo "✅ Fetched notes from remote" || \
  echo "ℹ️  No notes on remote yet (will be pushed on next push)"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run tests: ./.githooks/test-and-log.sh"
echo "  2. Notes will be created automatically"
echo "  3. Push notes: git push origin refs/notes/test-results"
echo "  4. Other developers run this setup script to enable sync"
