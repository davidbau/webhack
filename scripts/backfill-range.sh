#!/bin/bash
# Backfill test history for a commit range (non-interactive, scriptable)
#
# Usage: ./scripts/backfill-range.sh <start-commit> [end-commit]
#
# Iterates commits from start..end in chronological order,
# runs tests at each commit, and stores results as git notes.
# Skips commits that already have notes (idempotent).
#
# Examples:
#   ./scripts/backfill-range.sh 194861b HEAD
#   ./scripts/backfill-range.sh abc1234 def5678

set -euo pipefail

# --- Arguments ---
FORCE=false
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --force) FORCE=true; shift ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done
set -- "${POSITIONAL[@]}"

START_COMMIT="${1:?Usage: $0 [--force] <start-commit> [end-commit]}"
END_COMMIT="${2:-HEAD}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
LOG_FILE="$REPO_ROOT/oracle/backfill-$(date +%Y%m%d-%H%M%S).log"

# --- Verify clean working tree ---
if ! git diff-index --quiet HEAD 2>/dev/null; then
  echo "❌ Error: uncommitted changes. Commit or stash first." >&2
  exit 1
fi

# --- Save current state for cleanup ---
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
ORIGINAL_COMMIT=$(git rev-parse HEAD)

cleanup() {
  echo ""
  echo "=========================================="
  echo "Restoring original state..."
  echo "=========================================="
  if [ -n "$ORIGINAL_BRANCH" ] && [ "$ORIGINAL_BRANCH" != "HEAD" ]; then
    git checkout -f "$ORIGINAL_BRANCH" -q 2>/dev/null || git checkout -f "$ORIGINAL_COMMIT" -q 2>/dev/null || true
  else
    git checkout -f "$ORIGINAL_COMMIT" -q 2>/dev/null || true
  fi
  echo "✅ Restored to: ${ORIGINAL_BRANCH:-$ORIGINAL_COMMIT}"
  echo ""
  echo "=========================================="
  echo "Backfill Summary"
  echo "=========================================="
  echo "Processed: $CURRENT / $TOTAL_COUNT commits"
  echo "Success:   $SUCCESS_COUNT"
  echo "Skipped:   $SKIP_COUNT (already had notes)"
  echo "Errored:   $ERROR_COUNT"
  echo "Log file:  $LOG_FILE"
  if [ "$SUCCESS_COUNT" -gt 0 ]; then
    echo ""
    echo "Next: .githooks/sync-notes-to-jsonl.sh"
  fi
}
trap cleanup EXIT

# --- Get commit list in chronological order ---
COMMITS=$(git rev-list --reverse "$START_COMMIT".."$END_COMMIT")
TOTAL_COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')

echo "=========================================="
echo "Backfill Test History: $START_COMMIT..$END_COMMIT"
echo "=========================================="
echo "Commits to process: $TOTAL_COUNT"
echo "Log file: $LOG_FILE"
echo ""

# --- Statistics ---
SUCCESS_COUNT=0
SKIP_COUNT=0
ERROR_COUNT=0
CURRENT=0

# Track last package.json hash to know when npm install is needed
LAST_PKGJSON_HASH=""

for commit in $COMMITS; do
  CURRENT=$((CURRENT + 1))
  SHORT=$(git rev-parse --short "$commit")

  # --- Skip if already has a note (unless --force) ---
  if git notes --ref=test-results show "$commit" >/dev/null 2>&1; then
    if [ "$FORCE" = false ]; then
      SKIP_COUNT=$((SKIP_COUNT + 1))
      echo "[$CURRENT/$TOTAL_COUNT] $SHORT — already has note, skipping"
      echo "$SHORT,SKIP,already_has_note" >> "$LOG_FILE"
      continue
    fi
    echo "[$CURRENT/$TOTAL_COUNT] $SHORT — overwriting (--force)"
  fi

  # --- Get commit metadata ---
  COMMIT_DATE=$(git show -s --format=%cI "$commit")
  AUTHOR=$(git show -s --format="%an" "$commit")
  MESSAGE=$(git show -s --format=%s "$commit")
  PARENT=$(git rev-parse --short "$commit^" 2>/dev/null || echo "none")

  echo "=========================================="
  echo "[$CURRENT/$TOTAL_COUNT] $SHORT — $MESSAGE"
  echo "=========================================="

  # --- Force checkout (npm install/postinstall may have dirtied working tree) ---
  git checkout -f "$commit" -q 2>/dev/null
  if [ $? -ne 0 ]; then
    # Last resort: clean everything and retry
    git clean -fd -q 2>/dev/null || true
    git checkout -f "$commit" -q 2>/dev/null
    if [ $? -ne 0 ]; then
      echo "  ❌ checkout failed"
      echo "$SHORT,ERROR,checkout_failed" >> "$LOG_FILE"
      ERROR_COUNT=$((ERROR_COUNT + 1))
      continue
    fi
  fi

  # --- Check for test infrastructure ---
  if [ ! -d "test/comparison" ]; then
    echo "  ⚠️  no test/comparison dir, skipping"
    echo "$SHORT,ERROR,no_test_dir" >> "$LOG_FILE"
    ERROR_COUNT=$((ERROR_COUNT + 1))
    continue
  fi

  TEST_FILE_COUNT=$(ls test/comparison/*.test.js 2>/dev/null | wc -l || echo 0)
  if [ "$TEST_FILE_COUNT" -eq 0 ]; then
    echo "  ⚠️  no test files, skipping"
    echo "$SHORT,ERROR,no_test_files" >> "$LOG_FILE"
    ERROR_COUNT=$((ERROR_COUNT + 1))
    continue
  fi

  # --- npm install if package.json changed ---
  CURRENT_PKGJSON_HASH=""
  if [ -f "package.json" ]; then
    CURRENT_PKGJSON_HASH=$(git hash-object package.json 2>/dev/null || echo "")
  fi
  if [ "$CURRENT_PKGJSON_HASH" != "$LAST_PKGJSON_HASH" ] || [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    if ! npm install --ignore-scripts --silent 2>/dev/null; then
      echo "  ⚠️  npm install failed, skipping"
      echo "$SHORT,ERROR,npm_install_failed" >> "$LOG_FILE"
      ERROR_COUNT=$((ERROR_COUNT + 1))
      continue
    fi
    LAST_PKGJSON_HASH="$CURRENT_PKGJSON_HASH"
  fi

  # --- Run tests ---
  echo "  Running tests..."
  SESSION_OUTPUT=$(mktemp)
  UNIT_OUTPUT=$(mktemp)
  START_TIME=$(date +%s)

  # Primary: run session_test_runner.js for structured JSON results
  BUNDLE_JSON=""
  if [ -f "test/comparison/session_test_runner.js" ]; then
    timeout 120 node test/comparison/session_test_runner.js > "$SESSION_OUTPUT" 2>&1 || true
    BUNDLE_JSON=$(sed -n '/^__RESULTS_JSON__$/{ n; p; }' "$SESSION_OUTPUT" 2>/dev/null)
  fi

  # Run unit tests separately
  if [ -d "test/unit" ]; then
    timeout 30 node --test test/unit/*.js > "$UNIT_OUTPUT" 2>&1 || true
  fi

  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))

  # --- Parse results ---
  CHARGEN_PASS=0; CHARGEN_FAIL=0
  GAMEPLAY_PASS=0; GAMEPLAY_FAIL=0
  MAP_PASS=0; MAP_FAIL=0
  SPECIAL_PASS=0; SPECIAL_FAIL=0
  UNIT_PASS=0; UNIT_FAIL=0
  SESSION_PASS=0; SESSION_FAIL=0

  if [ -n "$BUNDLE_JSON" ]; then
    # Parse session categories from JSON bundle
    SESSION_PASS=$(echo "$BUNDLE_JSON" | jq '.summary.passed // 0')
    SESSION_FAIL=$(echo "$BUNDLE_JSON" | jq '.summary.failed // 0')
    CHARGEN_PASS=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="chargen" and .passed==true)] | length')
    CHARGEN_FAIL=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="chargen" and .passed==false)] | length')
    GAMEPLAY_PASS=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="gameplay" and .passed==true)] | length')
    GAMEPLAY_FAIL=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="gameplay" and .passed==false)] | length')
    MAP_PASS=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="map" and .passed==true)] | length')
    MAP_FAIL=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="map" and .passed==false)] | length')
    SPECIAL_PASS=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="special" and .passed==true)] | length')
    SPECIAL_FAIL=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="special" and .passed==false)] | length')
    echo "  Session runner: $SESSION_PASS pass, $SESSION_FAIL fail"
  else
    # Fallback: run node --test for combined output
    echo "  (no session runner, falling back to node --test)"
    FALLBACK_OUTPUT=$(mktemp)
    if [ -d "test/unit" ]; then
      timeout 30 node --test test/comparison/*.test.js test/unit/*.js > "$FALLBACK_OUTPUT" 2>&1 || true
    else
      timeout 30 node --test test/comparison/*.test.js > "$FALLBACK_OUTPUT" 2>&1 || true
    fi
    SESSION_PASS=$(grep -c "^✔" "$FALLBACK_OUTPUT" 2>/dev/null || echo 0)
    SESSION_FAIL=$(grep -c "^✖" "$FALLBACK_OUTPUT" 2>/dev/null || echo 0)
    # Old format: individual ✔/✖ lines per session
    CHARGEN_PASS=$(grep "^✔" "$FALLBACK_OUTPUT" 2>/dev/null | grep -c "_chargen_" 2>/dev/null || echo 0)
    CHARGEN_FAIL=$(grep "^✖" "$FALLBACK_OUTPUT" 2>/dev/null | grep -c "_chargen_" 2>/dev/null || echo 0)
    GAMEPLAY_PASS=$(grep "^✔" "$FALLBACK_OUTPUT" 2>/dev/null | grep -c "gameplay" 2>/dev/null || echo 0)
    GAMEPLAY_FAIL=$(grep "^✖" "$FALLBACK_OUTPUT" 2>/dev/null | grep -c "gameplay" 2>/dev/null || echo 0)
    MAP_PASS=$(grep "^✔" "$FALLBACK_OUTPUT" 2>/dev/null | grep -c "seed[0-9]*_map" 2>/dev/null || echo 0)
    MAP_FAIL=$(grep "^✖" "$FALLBACK_OUTPUT" 2>/dev/null | grep -c "seed[0-9]*_map" 2>/dev/null || echo 0)
    SPECIAL_PASS=$(grep "^✔" "$FALLBACK_OUTPUT" 2>/dev/null | grep -c "_special_" 2>/dev/null || echo 0)
    SPECIAL_FAIL=$(grep "^✖" "$FALLBACK_OUTPUT" 2>/dev/null | grep -c "_special_" 2>/dev/null || echo 0)
    rm -f "$FALLBACK_OUTPUT"
  fi

  # Parse unit test counts
  UNIT_PASS=$(grep -c "^✔" "$UNIT_OUTPUT" 2>/dev/null || echo 0)
  UNIT_FAIL=$(grep -c "^✖" "$UNIT_OUTPUT" 2>/dev/null || echo 0)

  # Compute totals
  PASS_COUNT=$((SESSION_PASS + UNIT_PASS))
  FAIL_COUNT_T=$((SESSION_FAIL + UNIT_FAIL))
  TOTAL_TESTS=$((PASS_COUNT + FAIL_COUNT_T))

  # Sanitize all to numbers
  for var in CHARGEN_PASS CHARGEN_FAIL GAMEPLAY_PASS GAMEPLAY_FAIL MAP_PASS MAP_FAIL \
             SPECIAL_PASS SPECIAL_FAIL UNIT_PASS UNIT_FAIL PASS_COUNT FAIL_COUNT_T TOTAL_TESTS; do
    eval "$var=\$(echo \"\$$var\" | tr -d '[:space:]')"
    eval "$var=\${$var:-0}"
  done

  if [ "$TOTAL_TESTS" -eq 0 ]; then
    echo "  ⚠️  no results parsed (crash?), skipping"
    echo "$SHORT,ERROR,no_results" >> "$LOG_FILE"
    ERROR_COUNT=$((ERROR_COUNT + 1))
    rm -f "$SESSION_OUTPUT" "$UNIT_OUTPUT"
    continue
  fi

  echo "  Results: $PASS_COUNT pass, $FAIL_COUNT_T fail (${DURATION}s)"
  rm -f "$SESSION_OUTPUT" "$UNIT_OUTPUT"

  # --- Create and store git note ---
  TEST_NOTE=$(cat <<EOF
{
  "commit": "$SHORT",
  "parent": "$PARENT",
  "date": "$COMMIT_DATE",
  "author": "$AUTHOR",
  "message": "$MESSAGE",
  "stats": {
    "total": $TOTAL_TESTS,
    "pass": $PASS_COUNT,
    "fail": $FAIL_COUNT_T,
    "skip": 0,
    "duration": $DURATION
  },
  "categories": {
    "chargen": {
      "total": $((CHARGEN_PASS + CHARGEN_FAIL)),
      "pass": $CHARGEN_PASS,
      "fail": $CHARGEN_FAIL
    },
    "gameplay": {
      "total": $((GAMEPLAY_PASS + GAMEPLAY_FAIL)),
      "pass": $GAMEPLAY_PASS,
      "fail": $GAMEPLAY_FAIL
    },
    "map": {
      "total": $((MAP_PASS + MAP_FAIL)),
      "pass": $MAP_PASS,
      "fail": $MAP_FAIL
    },
    "special": {
      "total": $((SPECIAL_PASS + SPECIAL_FAIL)),
      "pass": $SPECIAL_PASS,
      "fail": $SPECIAL_FAIL
    },
    "unit": {
      "total": $((UNIT_PASS + UNIT_FAIL)),
      "pass": $UNIT_PASS,
      "fail": $UNIT_FAIL
    }
  },
  "regression": false,
  "newTests": 0,
  "backfilled": true
}
EOF
)

  if echo "$TEST_NOTE" | git notes --ref=test-results add -f -F - "$commit" 2>/dev/null; then
    echo "  ✅ Note saved"
    echo "$SHORT,SUCCESS,$PASS_COUNT/$FAIL_COUNT_T,${DURATION}s" >> "$LOG_FILE"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo "  ❌ Failed to save note"
    echo "$SHORT,ERROR,note_save_failed" >> "$LOG_FILE"
    ERROR_COUNT=$((ERROR_COUNT + 1))
  fi
done

exit 0
