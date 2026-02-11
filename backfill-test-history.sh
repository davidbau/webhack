#!/bin/bash
# Backfill test history by running tests on old commits
# This creates git notes for commits that don't have them yet

set -e

echo "=========================================="
echo "Test History Backfill"
echo "=========================================="
echo ""
echo "This script will:"
echo "  1. Find commits without test notes"
echo "  2. Check out each commit"
echo "  3. Run tests (if possible)"
echo "  4. Create git note with results"
echo "  5. Restore your working state"
echo ""

# Verify we're in a clean state
if ! git diff-index --quiet HEAD 2>/dev/null; then
  echo "❌ Error: You have uncommitted changes"
  echo "   Please commit or stash your changes first"
  exit 1
fi

# Save current branch/commit
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
ORIGINAL_COMMIT=$(git rev-parse HEAD)

echo "Current state:"
echo "  Branch: ${ORIGINAL_BRANCH:-detached HEAD}"
echo "  Commit: $ORIGINAL_COMMIT"
echo ""

# Options
DEFAULT_LIMIT=50
LIMIT=${1:-$DEFAULT_LIMIT}
SKIP_RECENT=${2:-0}  # Number of recent commits to skip

echo "Configuration:"
echo "  Max commits to test: $LIMIT"
echo "  Skip recent: $SKIP_RECENT"
echo ""

# Confirm
read -p "Proceed with backfill? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Finding commits without test notes..."

# Get all commits without notes
COMMITS_WITHOUT_NOTES=$(git log --all --pretty=format:"%H" --skip=$SKIP_RECENT | while read commit; do
  if ! git notes --ref=test-results show "$commit" >/dev/null 2>&1; then
    echo "$commit"
  fi
done | head -n "$LIMIT")

TOTAL_COUNT=$(echo "$COMMITS_WITHOUT_NOTES" | wc -l)

if [ -z "$COMMITS_WITHOUT_NOTES" ] || [ "$TOTAL_COUNT" -eq 0 ]; then
  echo "✅ All commits already have test notes!"
  echo "   Nothing to backfill."
  exit 0
fi

echo "Found $TOTAL_COUNT commits without test notes"
echo ""

# Create temporary log file
LOG_FILE="/tmp/backfill-test-history-$(date +%s).log"
echo "Logging to: $LOG_FILE"
echo ""

# Statistics
SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
CURRENT=0

# Function to restore state
cleanup() {
  echo ""
  echo "=========================================="
  echo "Restoring original state..."
  echo "=========================================="

  if [ -n "$ORIGINAL_BRANCH" ] && [ "$ORIGINAL_BRANCH" != "HEAD" ]; then
    git checkout "$ORIGINAL_BRANCH" 2>/dev/null || git checkout "$ORIGINAL_COMMIT"
  else
    git checkout "$ORIGINAL_COMMIT" 2>/dev/null
  fi

  echo "✅ Restored to: $ORIGINAL_COMMIT"
  echo ""

  echo "=========================================="
  echo "Backfill Summary"
  echo "=========================================="
  echo "Processed: $CURRENT / $TOTAL_COUNT commits"
  echo "Success:   $SUCCESS_COUNT"
  echo "Skipped:   $SKIP_COUNT"
  echo "Failed:    $FAIL_COUNT"
  echo ""
  echo "Log file: $LOG_FILE"

  if [ $SUCCESS_COUNT -gt 0 ]; then
    echo ""
    echo "Next steps:"
    echo "  1. Sync notes to JSONL:"
    echo "     .githooks/sync-notes-to-jsonl.sh"
    echo ""
    echo "  2. Commit the updated dashboard:"
    echo "     git add teststats/results.jsonl"
    echo "     git commit -m 'Backfill test history ($SUCCESS_COUNT commits)'"
    echo ""
    echo "  3. Push notes to remote:"
    echo "     git push origin refs/notes/test-results"
  fi
}

trap cleanup EXIT

# Process each commit
while read commit; do
  CURRENT=$((CURRENT + 1))
  SHORT=$(echo "$commit" | cut -c1-7)

  echo "=========================================="
  echo "[$CURRENT/$TOTAL_COUNT] Testing commit $SHORT"
  echo "=========================================="

  # Get commit info
  COMMIT_DATE=$(git show -s --format=%cI "$commit")
  AUTHOR=$(git show -s --format="%an" "$commit")
  MESSAGE=$(git show -s --format=%s "$commit")
  PARENT=$(git rev-parse "$commit^" 2>/dev/null || echo "")
  PARENT_SHORT="${PARENT:0:7}"

  echo "Date:    $COMMIT_DATE"
  echo "Author:  $AUTHOR"
  echo "Message: $MESSAGE"
  echo ""

  # Check out the commit
  echo "Checking out $SHORT..."
  if ! git checkout "$commit" -q 2>/dev/null; then
    echo "❌ Failed to checkout commit"
    echo "$commit,SKIP,checkout_failed" >> "$LOG_FILE"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    continue
  fi

  # Check if test files exist
  if [ ! -d "test/comparison" ]; then
    echo "⚠️  No test/comparison directory - skipping"
    echo "$commit,SKIP,no_tests" >> "$LOG_FILE"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    continue
  fi

  TEST_FILES=$(find test/comparison -name "*.test.js" 2>/dev/null | wc -l)
  if [ "$TEST_FILES" -eq 0 ]; then
    echo "⚠️  No test files found - skipping"
    echo "$commit,SKIP,no_test_files" >> "$LOG_FILE"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    continue
  fi

  echo "Found $TEST_FILES test files"

  # Check if node_modules exists (might need npm install)
  if [ ! -d "node_modules" ]; then
    echo "ℹ️  No node_modules - attempting npm install..."
    if npm install --silent >/dev/null 2>&1; then
      echo "✅ npm install succeeded"
    else
      echo "⚠️  npm install failed - skipping"
      echo "$commit,SKIP,npm_install_failed" >> "$LOG_FILE"
      SKIP_COUNT=$((SKIP_COUNT + 1))
      continue
    fi
  fi

  # Run tests
  echo "Running tests..."
  TEST_OUTPUT=$(mktemp)
  START_TIME=$(date +%s)

  if node --test test/comparison/*.test.js 2>&1 > "$TEST_OUTPUT"; then
    TEST_RESULT="pass"
  else
    TEST_RESULT="completed_with_failures"
  fi

  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))

  # Parse test results
  PASS_COUNT=$(grep -c "^✔" "$TEST_OUTPUT" 2>/dev/null || echo 0)
  FAIL_COUNT=$(grep -c "^✖" "$TEST_OUTPUT" 2>/dev/null || echo 0)
  PASS_COUNT=$(echo "$PASS_COUNT" | tr -d '[:space:]')
  FAIL_COUNT=$(echo "$FAIL_COUNT" | tr -d '[:space:]')
  TOTAL_COUNT=$((PASS_COUNT + FAIL_COUNT))

  if [ "$TOTAL_COUNT" -eq 0 ]; then
    echo "⚠️  No test results parsed - tests may have crashed"
    echo "$commit,SKIP,no_results" >> "$LOG_FILE"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    rm "$TEST_OUTPUT"
    continue
  fi

  echo "Results: $PASS_COUNT pass, $FAIL_COUNT fail (${DURATION}s)"

  # Parse category-specific results by analyzing test NAMES
  # Categories: chargen, gameplay, map, special, inventory, option, c_vs_js, other
  CHARGEN_PASS=$(grep "^✔" "$TEST_OUTPUT" 2>/dev/null | grep -c "_chargen_" 2>/dev/null || echo 0)
  CHARGEN_FAIL=$(grep "^✖" "$TEST_OUTPUT" 2>/dev/null | grep -c "_chargen_" 2>/dev/null || echo 0)
  CHARGEN_PASS=$(echo "$CHARGEN_PASS" | tr -d '[:space:]')
  CHARGEN_FAIL=$(echo "$CHARGEN_FAIL" | tr -d '[:space:]')
  CHARGEN_TOTAL=$((CHARGEN_PASS + CHARGEN_FAIL))

  GAMEPLAY_PASS=$(grep "^✔" "$TEST_OUTPUT" 2>/dev/null | grep -c "_gameplay\\.session" 2>/dev/null || echo 0)
  GAMEPLAY_FAIL=$(grep "^✖" "$TEST_OUTPUT" 2>/dev/null | grep -c "_gameplay\\.session" 2>/dev/null || echo 0)
  GAMEPLAY_PASS=$(echo "$GAMEPLAY_PASS" | tr -d '[:space:]')
  GAMEPLAY_FAIL=$(echo "$GAMEPLAY_FAIL" | tr -d '[:space:]')
  GAMEPLAY_TOTAL=$((GAMEPLAY_PASS + GAMEPLAY_FAIL))

  MAP_PASS=$(grep "^✔" "$TEST_OUTPUT" 2>/dev/null | grep -c "_map\\.session" 2>/dev/null || echo 0)
  MAP_FAIL=$(grep "^✖" "$TEST_OUTPUT" 2>/dev/null | grep -c "_map\\.session" 2>/dev/null || echo 0)
  MAP_PASS=$(echo "$MAP_PASS" | tr -d '[:space:]')
  MAP_FAIL=$(echo "$MAP_FAIL" | tr -d '[:space:]')
  MAP_TOTAL=$((MAP_PASS + MAP_FAIL))

  SPECIAL_PASS=$(grep "^✔" "$TEST_OUTPUT" 2>/dev/null | grep -c "_special_" 2>/dev/null || echo 0)
  SPECIAL_FAIL=$(grep "^✖" "$TEST_OUTPUT" 2>/dev/null | grep -c "_special_" 2>/dev/null || echo 0)
  SPECIAL_PASS=$(echo "$SPECIAL_PASS" | tr -d '[:space:]')
  SPECIAL_FAIL=$(echo "$SPECIAL_FAIL" | tr -d '[:space:]')
  SPECIAL_TOTAL=$((SPECIAL_PASS + SPECIAL_FAIL))

  INVENTORY_PASS=$(grep "^✔" "$TEST_OUTPUT" 2>/dev/null | grep -c "_inventory_" 2>/dev/null || echo 0)
  INVENTORY_FAIL=$(grep "^✖" "$TEST_OUTPUT" 2>/dev/null | grep -c "_inventory_" 2>/dev/null || echo 0)
  INVENTORY_PASS=$(echo "$INVENTORY_PASS" | tr -d '[:space:]')
  INVENTORY_FAIL=$(echo "$INVENTORY_FAIL" | tr -d '[:space:]')
  INVENTORY_TOTAL=$((INVENTORY_PASS + INVENTORY_FAIL))

  OPTION_PASS=$(grep "^✔" "$TEST_OUTPUT" 2>/dev/null | grep -c "_option_\|_selfplay_\|_pickup_types_" 2>/dev/null || echo 0)
  OPTION_FAIL=$(grep "^✖" "$TEST_OUTPUT" 2>/dev/null | grep -c "_option_\|_selfplay_\|_pickup_types_" 2>/dev/null || echo 0)
  OPTION_PASS=$(echo "$OPTION_PASS" | tr -d '[:space:]')
  OPTION_FAIL=$(echo "$OPTION_FAIL" | tr -d '[:space:]')
  OPTION_TOTAL=$((OPTION_PASS + OPTION_FAIL))

  # C-vs-JS golden tests (not tied to specific sessions)
  CVJ_PASS=$(grep "^✔.*golden comparison" "$TEST_OUTPUT" 2>/dev/null | wc -l | tr -d '[:space:]')
  CVJ_FAIL=$(grep "^✖.*golden comparison" "$TEST_OUTPUT" 2>/dev/null | wc -l | tr -d '[:space:]')
  CVJ_TOTAL=$((CVJ_PASS + CVJ_FAIL))

  # Create test note
  TEST_NOTE=$(cat <<EOF
{
  "commit": "$SHORT",
  "parent": "$PARENT_SHORT",
  "date": "$COMMIT_DATE",
  "author": "$AUTHOR",
  "message": "$MESSAGE",
  "stats": {
    "total": $TOTAL_COUNT,
    "pass": $PASS_COUNT,
    "fail": $FAIL_COUNT,
    "skip": 0,
    "duration": $DURATION
  },
  "categories": {
    "chargen": {
      "total": $CHARGEN_TOTAL,
      "pass": $CHARGEN_PASS,
      "fail": $CHARGEN_FAIL
    },
    "gameplay": {
      "total": $GAMEPLAY_TOTAL,
      "pass": $GAMEPLAY_PASS,
      "fail": $GAMEPLAY_FAIL
    },
    "map": {
      "total": $MAP_TOTAL,
      "pass": $MAP_PASS,
      "fail": $MAP_FAIL
    },
    "special": {
      "total": $SPECIAL_TOTAL,
      "pass": $SPECIAL_PASS,
      "fail": $SPECIAL_FAIL
    },
    "inventory": {
      "total": $INVENTORY_TOTAL,
      "pass": $INVENTORY_PASS,
      "fail": $INVENTORY_FAIL
    },
    "option": {
      "total": $OPTION_TOTAL,
      "pass": $OPTION_PASS,
      "fail": $OPTION_FAIL
    },
    "c_vs_js": {
      "total": $CVJ_TOTAL,
      "pass": $CVJ_PASS,
      "fail": $CVJ_FAIL
    }
  },
  "regression": false,
  "newTests": 0,
  "backfilled": true
}
EOF
)

  # Save to git note
  echo "Saving test note..."
  if echo "$TEST_NOTE" | git notes --ref=test-results add -f -F - "$commit" 2>/dev/null; then
    echo "✅ Test note saved"
    echo "$commit,SUCCESS,$PASS_COUNT,$FAIL_COUNT" >> "$LOG_FILE"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo "❌ Failed to save test note"
    echo "$commit,FAIL,note_save_failed" >> "$LOG_FILE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  rm "$TEST_OUTPUT"
  echo ""
done < <(echo "$COMMITS_WITHOUT_NOTES")

# Cleanup and summary handled by trap
exit 0
