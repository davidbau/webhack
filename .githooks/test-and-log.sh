#!/bin/bash
# Test runner that executes tests and appends result to teststats/results.jsonl
# Usage: ./test-and-log.sh [--allow-regression]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_HISTORY_DIR="$PROJECT_ROOT/teststats"
RESULTS_FILE="$TEST_HISTORY_DIR/results.jsonl"
ALLOW_REGRESSION=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --allow-regression)
      ALLOW_REGRESSION=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Ensure .test-history directory exists
mkdir -p "$TEST_HISTORY_DIR"

# Get commit information
# NOTE: We log tests for the CURRENT HEAD commit
# The test log entry will be committed SEPARATELY after tests pass
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "pending")
COMMIT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT_AUTHOR=$(git config user.name || echo "unknown")
COMMIT_MESSAGE=$(git show -s --format=%s HEAD 2>/dev/null || echo "uncommitted changes")
PARENT_HASH=$(git rev-parse --short HEAD^ 2>/dev/null || echo "none")

echo "NOTE: Logging tests for commit $COMMIT_HASH"
echo "      Test log will be committed separately"

echo "========================================="
echo "Running tests for commit: $COMMIT_HASH"
echo "Date: $COMMIT_DATE"
echo "Author: $COMMIT_AUTHOR"
echo "Message: $COMMIT_MESSAGE"
echo "========================================="

# Run tests and capture output
TEST_START=$(date +%s)
TEST_OUTPUT=$(mktemp)

cd "$PROJECT_ROOT"

# Run all test suites (comparison + unit) and capture results
# IMPORTANT: Must run ALL tests to get full coverage stats
if [ -d "test/unit" ]; then
  node --test test/comparison/*.test.js test/unit/*.js 2>&1 | tee "$TEST_OUTPUT" || true
else
  # Fallback for older commits without test/unit
  node --test test/comparison/*.test.js 2>&1 | tee "$TEST_OUTPUT" || true
fi

TEST_END=$(date +%s)
DURATION=$((TEST_END - TEST_START))

# Parse test results from output
PASS_COUNT=$(grep -c "^✔" "$TEST_OUTPUT" || echo 0)
PASS_COUNT=$(echo "$PASS_COUNT" | tr -d '[:space:]')
PASS_COUNT=${PASS_COUNT:-0}
FAIL_COUNT=$(grep -c "^✖" "$TEST_OUTPUT" || echo 0)
FAIL_COUNT=$(echo "$FAIL_COUNT" | tr -d '[:space:]')
FAIL_COUNT=${FAIL_COUNT:-0}
TOTAL_COUNT=$((PASS_COUNT + FAIL_COUNT))

echo ""
echo "========================================="
echo "Test Results:"
echo "  Total: $TOTAL_COUNT"
echo "  Pass:  $PASS_COUNT"
echo "  Fail:  $FAIL_COUNT"
echo "  Duration: ${DURATION}s"
echo "========================================="

# Parse category-specific results
# Categories: chargen, gameplay, map, special (comparison tests) + unit tests

# Comparison test categories
CATEGORY_MAP_PASS=$(grep "seed[0-9]*_map" "$TEST_OUTPUT" 2>/dev/null | grep -c "^✔" 2>/dev/null || echo 0)
CATEGORY_MAP_FAIL=$(grep "seed[0-9]*_map" "$TEST_OUTPUT" 2>/dev/null | grep -c "^✖" 2>/dev/null || echo 0)
CATEGORY_GAMEPLAY_PASS=$(grep "gameplay" "$TEST_OUTPUT" 2>/dev/null | grep -c "^✔" 2>/dev/null || echo 0)
CATEGORY_GAMEPLAY_FAIL=$(grep "gameplay" "$TEST_OUTPUT" 2>/dev/null | grep -c "^✖" 2>/dev/null || echo 0)
CATEGORY_CHARGEN_PASS=$(grep "chargen" "$TEST_OUTPUT" 2>/dev/null | grep -c "^✔" 2>/dev/null || echo 0)
CATEGORY_CHARGEN_FAIL=$(grep "chargen" "$TEST_OUTPUT" 2>/dev/null | grep -c "^✖" 2>/dev/null || echo 0)
CATEGORY_SPECIAL_PASS=$(grep "_special_" "$TEST_OUTPUT" 2>/dev/null | grep -c "^✔" 2>/dev/null || echo 0)
CATEGORY_SPECIAL_FAIL=$(grep "_special_" "$TEST_OUTPUT" 2>/dev/null | grep -c "^✖" 2>/dev/null || echo 0)

# Unit test categories - parse from test file names in output
CATEGORY_UNIT_PASS=$(grep "test/unit/" "$TEST_OUTPUT" 2>/dev/null | grep -c "^✔" 2>/dev/null || echo 0)
CATEGORY_UNIT_FAIL=$(grep "test/unit/" "$TEST_OUTPUT" 2>/dev/null | grep -c "^✖" 2>/dev/null || echo 0)

# Ensure all category variables are valid numbers (strip whitespace and set defaults)
CATEGORY_MAP_PASS=$(echo "$CATEGORY_MAP_PASS" | tr -d '[:space:]')
CATEGORY_MAP_PASS=${CATEGORY_MAP_PASS:-0}
CATEGORY_MAP_FAIL=$(echo "$CATEGORY_MAP_FAIL" | tr -d '[:space:]')
CATEGORY_MAP_FAIL=${CATEGORY_MAP_FAIL:-0}
CATEGORY_GAMEPLAY_PASS=$(echo "$CATEGORY_GAMEPLAY_PASS" | tr -d '[:space:]')
CATEGORY_GAMEPLAY_PASS=${CATEGORY_GAMEPLAY_PASS:-0}
CATEGORY_GAMEPLAY_FAIL=$(echo "$CATEGORY_GAMEPLAY_FAIL" | tr -d '[:space:]')
CATEGORY_GAMEPLAY_FAIL=${CATEGORY_GAMEPLAY_FAIL:-0}
CATEGORY_CHARGEN_PASS=$(echo "$CATEGORY_CHARGEN_PASS" | tr -d '[:space:]')
CATEGORY_CHARGEN_PASS=${CATEGORY_CHARGEN_PASS:-0}
CATEGORY_CHARGEN_FAIL=$(echo "$CATEGORY_CHARGEN_FAIL" | tr -d '[:space:]')
CATEGORY_CHARGEN_FAIL=${CATEGORY_CHARGEN_FAIL:-0}
CATEGORY_SPECIAL_PASS=$(echo "$CATEGORY_SPECIAL_PASS" | tr -d '[:space:]')
CATEGORY_SPECIAL_PASS=${CATEGORY_SPECIAL_PASS:-0}
CATEGORY_SPECIAL_FAIL=$(echo "$CATEGORY_SPECIAL_FAIL" | tr -d '[:space:]')
CATEGORY_SPECIAL_FAIL=${CATEGORY_SPECIAL_FAIL:-0}
CATEGORY_UNIT_PASS=$(echo "$CATEGORY_UNIT_PASS" | tr -d '[:space:]')
CATEGORY_UNIT_PASS=${CATEGORY_UNIT_PASS:-0}
CATEGORY_UNIT_FAIL=$(echo "$CATEGORY_UNIT_FAIL" | tr -d '[:space:]')
CATEGORY_UNIT_FAIL=${CATEGORY_UNIT_FAIL:-0}

# Check for regression
REGRESSION=false
if [ -f "$RESULTS_FILE" ]; then
  # Get last test run's pass count
  LAST_PASS=$(tail -1 "$RESULTS_FILE" | jq -r '.stats.pass' 2>/dev/null || echo 0)
  LAST_PASS=$(echo "$LAST_PASS" | tr -d '[:space:]')
  LAST_PASS=${LAST_PASS:-0}

  if [ "$PASS_COUNT" -lt "$LAST_PASS" ]; then
    REGRESSION=true
    echo ""
    echo "⚠️  WARNING: REGRESSION DETECTED!"
    echo "  Previous pass count: $LAST_PASS"
    echo "  Current pass count:  $PASS_COUNT"
    echo "  Tests regressed:     $((LAST_PASS - PASS_COUNT))"

    if [ "$ALLOW_REGRESSION" = false ]; then
      echo ""
      echo "❌ Regression not allowed. Push rejected."
      echo "   Use --allow-regression to override (not recommended)"
      rm "$TEST_OUTPUT"
      exit 1
    else
      echo "   (Allowed via --allow-regression flag)"
    fi
  fi
fi

# Calculate new tests
NEW_TESTS=0
if [ -f "$RESULTS_FILE" ]; then
  LAST_TOTAL=$(tail -1 "$RESULTS_FILE" | jq -r '.stats.total' 2>/dev/null || echo 0)
  LAST_TOTAL=$(echo "$LAST_TOTAL" | tr -d '[:space:]')
  LAST_TOTAL=${LAST_TOTAL:-0}
  NEW_TESTS=$((TOTAL_COUNT - LAST_TOTAL))
fi

# Generate JSON log entry
cat > "$TEST_OUTPUT.json" <<EOF
{
  "commit": "$COMMIT_HASH",
  "parent": "$PARENT_HASH",
  "date": "$COMMIT_DATE",
  "author": "$COMMIT_AUTHOR",
  "message": "$COMMIT_MESSAGE",
  "stats": {
    "total": $TOTAL_COUNT,
    "pass": $PASS_COUNT,
    "fail": $FAIL_COUNT,
    "skip": 0,
    "duration": $DURATION
  },
  "categories": {
    "chargen": {
      "total": $((CATEGORY_CHARGEN_PASS + CATEGORY_CHARGEN_FAIL)),
      "pass": $CATEGORY_CHARGEN_PASS,
      "fail": $CATEGORY_CHARGEN_FAIL
    },
    "gameplay": {
      "total": $((CATEGORY_GAMEPLAY_PASS + CATEGORY_GAMEPLAY_FAIL)),
      "pass": $CATEGORY_GAMEPLAY_PASS,
      "fail": $CATEGORY_GAMEPLAY_FAIL
    },
    "map": {
      "total": $((CATEGORY_MAP_PASS + CATEGORY_MAP_FAIL)),
      "pass": $CATEGORY_MAP_PASS,
      "fail": $CATEGORY_MAP_FAIL
    },
    "special": {
      "total": $((CATEGORY_SPECIAL_PASS + CATEGORY_SPECIAL_FAIL)),
      "pass": $CATEGORY_SPECIAL_PASS,
      "fail": $CATEGORY_SPECIAL_FAIL
    },
    "unit": {
      "total": $((CATEGORY_UNIT_PASS + CATEGORY_UNIT_FAIL)),
      "pass": $CATEGORY_UNIT_PASS,
      "fail": $CATEGORY_UNIT_FAIL
    }
  },
  "regression": $REGRESSION,
  "newTests": $NEW_TESTS
}
EOF

# Store test results in git notes (source of truth)
# The pre-commit hook will rebuild results.jsonl from all notes
COMMIT_TO_ANNOTATE="$COMMIT_HASH"
if [ "$COMMIT_TO_ANNOTATE" = "pending" ]; then
  # If no commit yet, we'll annotate HEAD once it exists
  echo "⚠️  No commit yet, will annotate after commit"
else
  # Add git note with test results
  cat "$TEST_OUTPUT.json" | git notes --ref=test-results add -f -F - "$COMMIT_TO_ANNOTATE"
  echo "✅ Test results stored in git notes for commit $COMMIT_TO_ANNOTATE"
fi

# Also append to results file for immediate use (will be rebuilt from notes)
cat "$TEST_OUTPUT.json" >> "$RESULTS_FILE"

# Cleanup
rm "$TEST_OUTPUT" "$TEST_OUTPUT.json"

echo ""
echo "✅ Test results logged"

if [ "$REGRESSION" = true ]; then
  exit 1
fi

exit 0
