#!/bin/bash
# Rebuild teststats/results.jsonl from git notes
# This runs before each commit to keep the JSONL mirror up-to-date

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
OUTPUT_FILE="$REPO_ROOT/teststats/results.jsonl"

# Pull latest test notes from remote (if available)
# Git notes don't auto-fetch like branches, so we need to explicitly pull them
echo "Fetching test notes from remote..."

# Method 1: Try regular fetch (if configured)
if git fetch origin 2>/dev/null; then
  echo "✅ Fetched from remote (includes notes if configured)"
else
  echo "ℹ️  Could not fetch from remote (offline or no permissions)"
fi

# Method 2: Explicitly fetch notes and merge
# This ensures we get notes even if not in default fetch config
if git fetch origin refs/notes/test-results:refs/notes/test-results-remote 2>/dev/null; then
  echo "✅ Fetched test-results notes from remote"

  # Merge remote notes into local notes (keep newest)
  if git show-ref refs/notes/test-results >/dev/null 2>&1; then
    # Local notes exist - merge with "newest wins" strategy
    # For each commit in remote notes, compare timestamps and keep newest
    git notes --ref=test-results-remote list 2>/dev/null | while read note_hash commit_hash; do
      REMOTE_NOTE=$(git notes --ref=test-results-remote show "$commit_hash" 2>/dev/null || echo "")
      LOCAL_NOTE=$(git notes --ref=test-results show "$commit_hash" 2>/dev/null || echo "")

      if [ -z "$LOCAL_NOTE" ]; then
        # No local note - add remote note
        echo "$REMOTE_NOTE" | git notes --ref=test-results add -f -F - "$commit_hash" 2>/dev/null || true
      elif [ -n "$REMOTE_NOTE" ]; then
        # Both exist - keep the one with newer date
        REMOTE_DATE=$(echo "$REMOTE_NOTE" | jq -r '.date' 2>/dev/null || echo "")
        LOCAL_DATE=$(echo "$LOCAL_NOTE" | jq -r '.date' 2>/dev/null || echo "")

        if [ -n "$REMOTE_DATE" ] && [ -n "$LOCAL_DATE" ]; then
          if [[ "$REMOTE_DATE" > "$LOCAL_DATE" ]]; then
            # Remote is newer - replace local
            echo "$REMOTE_NOTE" | git notes --ref=test-results add -f -F - "$commit_hash" 2>/dev/null || true
          fi
          # If local is newer or same, keep local (do nothing)
        fi
      fi
    done
    echo "✅ Merged remote notes (keeping newest for each commit)"
    # Clean up temporary ref
    git update-ref -d refs/notes/test-results-remote 2>/dev/null || true
  else
    # No local notes yet - just copy remote notes
    git update-ref refs/notes/test-results refs/notes/test-results-remote
    git update-ref -d refs/notes/test-results-remote 2>/dev/null || true
    echo "✅ Initialized local notes from remote"
  fi
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

# Push test notes to remote (if we have any and can reach remote)
if git show-ref refs/notes/test-results >/dev/null 2>&1; then
  echo "Pushing test notes to remote..."
  if git push --no-verify origin refs/notes/test-results:refs/notes/test-results 2>/dev/null; then
    echo "✅ Pushed test notes to remote"
  else
    echo "ℹ️  Could not push test notes (offline, no permissions, or already up-to-date)"
  fi
fi

exit 0
