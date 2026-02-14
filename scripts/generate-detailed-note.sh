#!/bin/bash
# generate-detailed-note.sh
#
# Generate a detailed test note (v2 schema) for the current commit.
# Combines test results, code metrics, and regression analysis.
#
# Usage:
#   scripts/generate-detailed-note.sh [--allow-regression] [--save]
#   scripts/generate-detailed-note.sh --code-only  # Skip tests, just code metrics
#
# Output: JSON to stdout (or saved to git note with --save)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

ALLOW_REGRESSION=false
SAVE_NOTE=false
CODE_ONLY=false

# Parse flags
for arg in "$@"; do
    case "$arg" in
        --allow-regression) ALLOW_REGRESSION=true ;;
        --save) SAVE_NOTE=true ;;
        --code-only) CODE_ONLY=true ;;
    esac
done

# Get commit info
COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_SHORT=$(git rev-parse --short HEAD)
PARENT_HASH=$(git rev-parse HEAD^ 2>/dev/null || echo "")
PARENT_SHORT="${PARENT_HASH:0:7}"
COMMIT_DATE=$(git show -s --format=%cI HEAD)
AUTHOR=$(git show -s --format="%an" HEAD)
MESSAGE=$(git show -s --format=%s HEAD | sed 's/"/\\"/g')

echo "Collecting data for commit $COMMIT_SHORT..." >&2

# Collect code metrics
echo "Collecting code metrics..." >&2
CODE_METRICS=$("$SCRIPT_DIR/collect-code-metrics.sh" "$PARENT_HASH" "$COMMIT_HASH" 2>/dev/null || echo '{"filesChanged":0,"linesAdded":0,"linesRemoved":0,"netLines":0,"categories":{}}')

if [ "$CODE_ONLY" = true ]; then
    # Code-only mode: generate minimal note with just code metrics
    cat <<EOF
{
  "version": 2,
  "commit": "$COMMIT_SHORT",
  "parent": "$PARENT_SHORT",
  "date": "$COMMIT_DATE",
  "author": "$AUTHOR",
  "message": "$MESSAGE",
  "stats": {
    "total": 0,
    "pass": 0,
    "fail": 0,
    "skip": 0,
    "duration": 0
  },
  "categories": {},
  "sessions": {},
  "tests": {
    "pass": [],
    "fail": [],
    "skip": []
  },
  "codeMetrics": $CODE_METRICS,
  "regression": false,
  "regressedTests": [],
  "newlyPassing": [],
  "testSkipped": true,
  "testSkipReason": "code-only mode"
}
EOF
    exit 0
fi

# Run tests and collect results
echo "Running tests..." >&2
TEST_RESULTS_FILE=$(mktemp)
if timeout 300 node "$SCRIPT_DIR/collect-test-results.mjs" > "$TEST_RESULTS_FILE" 2>&1; then
    TEST_RESULTS=$(cat "$TEST_RESULTS_FILE")
else
    # Test run failed - create error result
    echo "Test run failed or timed out" >&2
    TEST_RESULTS='{
      "stats": {"total": 0, "pass": 0, "fail": 0, "skip": 0, "duration": 0},
      "categories": {},
      "sessions": {},
      "tests": {"pass": [], "fail": [], "skip": []},
      "error": "Test run failed"
    }'
fi
rm -f "$TEST_RESULTS_FILE"

# Extract test stats
STATS=$(echo "$TEST_RESULTS" | jq -c '.stats // {"total":0,"pass":0,"fail":0,"skip":0,"duration":0}')
CATEGORIES=$(echo "$TEST_RESULTS" | jq -c '.categories // {}')
SESSIONS=$(echo "$TEST_RESULTS" | jq -c '.sessions // {}')
TESTS=$(echo "$TEST_RESULTS" | jq -c '.tests // {"pass":[],"fail":[],"skip":[]}')
PASS_COUNT=$(echo "$STATS" | jq -r '.pass')

# Check for regression against parent
REGRESSION=false
REGRESSED_TESTS="[]"
NEWLY_PASSING="[]"

if [ -n "$PARENT_HASH" ]; then
    PREVIOUS_NOTE=$(git notes --ref=test-results show "$PARENT_HASH" 2>/dev/null || echo "")
    if [ -n "$PREVIOUS_NOTE" ]; then
        PREV_PASS=$(echo "$PREVIOUS_NOTE" | jq -r '.stats.pass // 0' 2>/dev/null || echo 0)
        if [ "$PASS_COUNT" -lt "$PREV_PASS" ]; then
            REGRESSION=true
            echo "⚠️  REGRESSION DETECTED! ($PREV_PASS → $PASS_COUNT)" >&2

            # Compute regressed tests (were passing, now failing)
            PREV_PASSING=$(echo "$PREVIOUS_NOTE" | jq -c '.tests.pass // []' 2>/dev/null || echo "[]")
            CURR_FAILING=$(echo "$TESTS" | jq -c '.fail // []')

            if [ "$PREV_PASSING" != "[]" ] && [ "$CURR_FAILING" != "[]" ]; then
                REGRESSED_TESTS=$(jq -n --argjson prev "$PREV_PASSING" --argjson curr "$CURR_FAILING" \
                    '[($prev[] | select(. as $p | $curr | index($p) != null))] | unique')
            fi
        fi

        # Compute newly passing tests
        PREV_FAILING=$(echo "$PREVIOUS_NOTE" | jq -c '.tests.fail // []' 2>/dev/null || echo "[]")
        CURR_PASSING=$(echo "$TESTS" | jq -c '.pass // []')

        if [ "$PREV_FAILING" != "[]" ] && [ "$CURR_PASSING" != "[]" ]; then
            NEWLY_PASSING=$(jq -n --argjson prev "$PREV_FAILING" --argjson curr "$CURR_PASSING" \
                '[($prev[] | select(. as $p | $curr | index($p) != null))] | unique' 2>/dev/null || echo "[]")
        fi
    fi
fi

# Build final JSON
NOTE=$(jq -n \
    --arg version "2" \
    --arg commit "$COMMIT_SHORT" \
    --arg parent "$PARENT_SHORT" \
    --arg date "$COMMIT_DATE" \
    --arg author "$AUTHOR" \
    --arg message "$MESSAGE" \
    --argjson stats "$STATS" \
    --argjson categories "$CATEGORIES" \
    --argjson sessions "$SESSIONS" \
    --argjson tests "$TESTS" \
    --argjson codeMetrics "$CODE_METRICS" \
    --argjson regression "$REGRESSION" \
    --argjson regressedTests "$REGRESSED_TESTS" \
    --argjson newlyPassing "$NEWLY_PASSING" \
    '{
        version: ($version | tonumber),
        commit: $commit,
        parent: $parent,
        date: $date,
        author: $author,
        message: $message,
        stats: $stats,
        categories: $categories,
        sessions: $sessions,
        tests: $tests,
        codeMetrics: $codeMetrics,
        regression: $regression,
        regressedTests: $regressedTests,
        newlyPassing: $newlyPassing
    }')

if [ "$SAVE_NOTE" = true ]; then
    echo "$NOTE" | git notes --ref=test-results add -f -F - HEAD
    echo "✅ Note saved for commit $COMMIT_SHORT" >&2
fi

echo "$NOTE"

# Exit with error if regression detected and not allowed
if [ "$REGRESSION" = true ] && [ "$ALLOW_REGRESSION" = false ]; then
    echo "❌ Regression not allowed. Use --allow-regression to override." >&2
    exit 1
fi
