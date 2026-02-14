#!/bin/bash
# collect-code-metrics.sh
#
# Extract code change metrics from git diff between two commits.
#
# Usage:
#   scripts/collect-code-metrics.sh [from_commit] [to_commit]
#   scripts/collect-code-metrics.sh HEAD^         # Compare HEAD^ to HEAD
#   scripts/collect-code-metrics.sh               # Compare HEAD^ to HEAD (default)
#
# Output: JSON to stdout

set -e

FROM_COMMIT="${1:-HEAD^}"
TO_COMMIT="${2:-HEAD}"

# Get the repo root
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Check if commits exist
if ! git rev-parse "$FROM_COMMIT" >/dev/null 2>&1; then
    # First commit - no parent
    FROM_COMMIT="$(git hash-object -t tree /dev/null)"
fi

# Get diff stats
DIFF_STATS=$(git diff --numstat "$FROM_COMMIT" "$TO_COMMIT" 2>/dev/null || echo "")

# Initialize counters
TOTAL_FILES=0
TOTAL_ADDED=0
TOTAL_REMOVED=0

JS_FILES=0
JS_ADDED=0
JS_REMOVED=0

TEST_FILES=0
TEST_ADDED=0
TEST_REMOVED=0

DOCS_FILES=0
DOCS_ADDED=0
DOCS_REMOVED=0

SESSION_FILES=0
SESSION_ADDED=0
SESSION_REMOVED=0

OTHER_FILES=0
OTHER_ADDED=0
OTHER_REMOVED=0

# Parse diff stats
while IFS=$'\t' read -r added removed file; do
    # Skip empty lines
    [ -z "$file" ] && continue

    # Handle binary files (show as -)
    [ "$added" = "-" ] && added=0
    [ "$removed" = "-" ] && removed=0

    # Convert to integers
    added=$((added + 0))
    removed=$((removed + 0))

    TOTAL_FILES=$((TOTAL_FILES + 1))
    TOTAL_ADDED=$((TOTAL_ADDED + added))
    TOTAL_REMOVED=$((TOTAL_REMOVED + removed))

    # Categorize by file path/extension
    case "$file" in
        test/*.test.js|test/*/*.test.js)
            TEST_FILES=$((TEST_FILES + 1))
            TEST_ADDED=$((TEST_ADDED + added))
            TEST_REMOVED=$((TEST_REMOVED + removed))
            ;;
        test/comparison/sessions/*.json|test/comparison/maps/*.json|leveltrace/*.json)
            SESSION_FILES=$((SESSION_FILES + 1))
            SESSION_ADDED=$((SESSION_ADDED + added))
            SESSION_REMOVED=$((SESSION_REMOVED + removed))
            ;;
        *.js|*.mjs)
            JS_FILES=$((JS_FILES + 1))
            JS_ADDED=$((JS_ADDED + added))
            JS_REMOVED=$((JS_REMOVED + removed))
            ;;
        *.md|docs/*|README*)
            DOCS_FILES=$((DOCS_FILES + 1))
            DOCS_ADDED=$((DOCS_ADDED + added))
            DOCS_REMOVED=$((DOCS_REMOVED + removed))
            ;;
        *)
            OTHER_FILES=$((OTHER_FILES + 1))
            OTHER_ADDED=$((OTHER_ADDED + added))
            OTHER_REMOVED=$((OTHER_REMOVED + removed))
            ;;
    esac
done <<< "$DIFF_STATS"

# Output JSON
cat <<EOF
{
  "filesChanged": $TOTAL_FILES,
  "linesAdded": $TOTAL_ADDED,
  "linesRemoved": $TOTAL_REMOVED,
  "netLines": $((TOTAL_ADDED - TOTAL_REMOVED)),
  "categories": {
    "js": {
      "files": $JS_FILES,
      "added": $JS_ADDED,
      "removed": $JS_REMOVED
    },
    "test": {
      "files": $TEST_FILES,
      "added": $TEST_ADDED,
      "removed": $TEST_REMOVED
    },
    "session": {
      "files": $SESSION_FILES,
      "added": $SESSION_ADDED,
      "removed": $SESSION_REMOVED
    },
    "docs": {
      "files": $DOCS_FILES,
      "added": $DOCS_ADDED,
      "removed": $DOCS_REMOVED
    },
    "other": {
      "files": $OTHER_FILES,
      "added": $OTHER_ADDED,
      "removed": $OTHER_REMOVED
    }
  }
}
EOF
