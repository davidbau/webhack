#!/bin/bash
# Test runner: runs tests and writes results to oracle/pending.jsonl
# The pending entry uses "commit": "HEAD" as a placeholder.
# The pre-push hook replaces "HEAD" with the real hash when creating the git note.
# Usage: ./test-and-log.sh [--allow-regression]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_HISTORY_DIR="$PROJECT_ROOT/oracle"
RESULTS_FILE="$TEST_HISTORY_DIR/results.jsonl"
PENDING_FILE="$TEST_HISTORY_DIR/pending.jsonl"
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

# Ensure directory exists
mkdir -p "$TEST_HISTORY_DIR"

# Get commit information
COMMIT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT_AUTHOR=$(git config user.name || echo "unknown")
COMMIT_MESSAGE=$(git show -s --format=%s HEAD 2>/dev/null || echo "uncommitted changes")

echo "========================================="
echo "Running tests..."
echo "Date: $COMMIT_DATE"
echo "Author: $COMMIT_AUTHOR"
echo "Message: $COMMIT_MESSAGE"
echo "========================================="

# Run tests and capture output
TEST_START=$(date +%s)
SESSION_OUTPUT=$(mktemp)
UNIT_OUTPUT=$(mktemp)

cd "$PROJECT_ROOT"

# Run session runner for structured JSON category data
echo "Running session tests..."
node test/comparison/session_test_runner.js 2>&1 | tee "$SESSION_OUTPUT" || true
BUNDLE_JSON=$(sed -n '/^__RESULTS_JSON__$/{ n; p; }' "$SESSION_OUTPUT" 2>/dev/null)

# Run unit tests separately
if [ -d "test/unit" ]; then
  echo ""
  echo "Running unit tests..."
  node --test test/unit/*.js 2>&1 | tee "$UNIT_OUTPUT" || true
fi

TEST_END=$(date +%s)
DURATION=$((TEST_END - TEST_START))

# Parse session results from JSON bundle
SESSION_PASS=0; SESSION_FAIL=0
CATEGORY_CHARGEN_PASS=0; CATEGORY_CHARGEN_FAIL=0
CATEGORY_GAMEPLAY_PASS=0; CATEGORY_GAMEPLAY_FAIL=0
CATEGORY_MAP_PASS=0; CATEGORY_MAP_FAIL=0
CATEGORY_SPECIAL_PASS=0; CATEGORY_SPECIAL_FAIL=0

if [ -n "$BUNDLE_JSON" ]; then
  SESSION_PASS=$(echo "$BUNDLE_JSON" | jq '.summary.passed // 0')
  SESSION_FAIL=$(echo "$BUNDLE_JSON" | jq '.summary.failed // 0')
  CATEGORY_CHARGEN_PASS=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="chargen" and .passed==true)] | length')
  CATEGORY_CHARGEN_FAIL=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="chargen" and .passed==false)] | length')
  CATEGORY_GAMEPLAY_PASS=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="gameplay" and .passed==true)] | length')
  CATEGORY_GAMEPLAY_FAIL=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="gameplay" and .passed==false)] | length')
  CATEGORY_MAP_PASS=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="map" and .passed==true)] | length')
  CATEGORY_MAP_FAIL=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="map" and .passed==false)] | length')
  CATEGORY_SPECIAL_PASS=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="special" and .passed==true)] | length')
  CATEGORY_SPECIAL_FAIL=$(echo "$BUNDLE_JSON" | jq '[.results[] | select(.type=="special" and .passed==false)] | length')
fi

# Parse unit test counts
CATEGORY_UNIT_PASS=$(grep -c "^✔" "$UNIT_OUTPUT" 2>/dev/null || echo 0)
CATEGORY_UNIT_FAIL=$(grep -c "^✖" "$UNIT_OUTPUT" 2>/dev/null || echo 0)

# Compute totals (session results + unit tests)
PASS_COUNT=$((SESSION_PASS + CATEGORY_UNIT_PASS))
FAIL_COUNT=$((SESSION_FAIL + CATEGORY_UNIT_FAIL))
TOTAL_COUNT=$((PASS_COUNT + FAIL_COUNT))

# Ensure all category variables are valid numbers
for _var in CATEGORY_CHARGEN_PASS CATEGORY_CHARGEN_FAIL \
            CATEGORY_GAMEPLAY_PASS CATEGORY_GAMEPLAY_FAIL \
            CATEGORY_MAP_PASS CATEGORY_MAP_FAIL \
            CATEGORY_SPECIAL_PASS CATEGORY_SPECIAL_FAIL \
            CATEGORY_UNIT_PASS CATEGORY_UNIT_FAIL \
            PASS_COUNT FAIL_COUNT TOTAL_COUNT; do
  eval "$_var=\$(echo \"\$$_var\" | tr -d '[:space:]')"
  eval "$_var=\${$_var:-0}"
done

echo ""
echo "========================================="
echo "Test Results:"
echo "  Total: $TOTAL_COUNT"
echo "  Pass:  $PASS_COUNT"
echo "  Fail:  $FAIL_COUNT"
echo "  Duration: ${DURATION}s"
echo "========================================="

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

# Generate JSON log entry with "HEAD" placeholder for commit
# The pre-push hook will replace "HEAD" with the real commit hash
cat > "$SESSION_OUTPUT.json" <<EOF
{
  "commit": "HEAD",
  "parent": "",
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

# Write to pending.jsonl (single entry, overwritten each run)
cp "$SESSION_OUTPUT.json" "$PENDING_FILE"
echo "✅ Test results written to oracle/pending.jsonl"

# Cleanup
rm -f "$SESSION_OUTPUT" "$SESSION_OUTPUT.json" "$UNIT_OUTPUT"

if [ "$REGRESSION" = true ]; then
  exit 1
fi

exit 0
