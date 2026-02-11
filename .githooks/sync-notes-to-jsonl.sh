#!/bin/bash
# Rebuild teststats/results.jsonl from git notes
# This runs before each commit to keep the JSONL mirror up-to-date

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
OUTPUT_FILE="$REPO_ROOT/teststats/results.jsonl"

# Pull latest test notes from remote (if available)
echo "Fetching test notes from remote..."
if git fetch origin refs/notes/test-results:refs/notes/test-results 2>/dev/null; then
  echo "✅ Fetched latest test notes from remote"
else
  echo "ℹ️  No remote notes to fetch (or offline)"
fi

echo "Rebuilding teststats/results.jsonl from git notes..."

# Create temporary file
TEMP_FILE=$(mktemp)

# Get list of commits with test notes (much faster than git log --all)
# The notes ref contains only commits that have notes
if git show-ref refs/notes/test-results >/dev/null 2>&1; then
  # Get all notes and extract the test data
  git notes --ref=test-results list | while read note_hash commit_hash; do
    # Get the note content
    NOTE=$(git notes --ref=test-results show "$commit_hash" 2>/dev/null || echo "")
    if [ -n "$NOTE" ]; then
      # Validate JSON before adding
      if echo "$NOTE" | jq empty 2>/dev/null; then
        echo "$NOTE" >> "$TEMP_FILE"
      else
        echo "⚠️  Warning: Invalid JSON for commit $commit_hash, skipping"
      fi
    fi
  done
fi

# Sort by date and write to output
if [ -s "$TEMP_FILE" ]; then
  # Sort by .date field, output as JSONL
  jq -s -c 'sort_by(.date) | .[]' "$TEMP_FILE" > "$OUTPUT_FILE"
  LINE_COUNT=$(wc -l < "$OUTPUT_FILE")
  echo "✅ Rebuilt results.jsonl with $LINE_COUNT entries"
else
  # No notes found - check if file already exists
  if [ -f "$OUTPUT_FILE" ]; then
    echo "⚠️  No test notes found, keeping existing results.jsonl"
  else
    echo "⚠️  No test notes found. Initializing empty results.jsonl"
    touch "$OUTPUT_FILE"
  fi
fi

rm -f "$TEMP_FILE"

# Push unpushed test notes to remote (if any)
if git show-ref refs/notes/test-results >/dev/null 2>&1; then
  # Check if there are unpushed notes
  LOCAL_NOTES=$(git rev-parse refs/notes/test-results 2>/dev/null || echo "")
  REMOTE_NOTES=$(git rev-parse refs/remotes/origin/test-results 2>/dev/null || echo "")

  if [ -n "$LOCAL_NOTES" ] && [ "$LOCAL_NOTES" != "$REMOTE_NOTES" ]; then
    echo "Pushing test notes to remote..."
    if git push --no-verify origin refs/notes/test-results 2>/dev/null; then
      echo "✅ Pushed test notes to remote"
    else
      echo "ℹ️  Could not push test notes (offline or no permissions)"
    fi
  fi
fi

exit 0
