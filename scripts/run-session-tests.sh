#!/bin/bash
# Run session-based tests and deposit results for git notes
#
# Usage: ./scripts/run-session-tests.sh [--golden]
#
# Runs session_test_runner.js and writes results to oracle/pending.jsonl
# with commit set to "HEAD". The post-commit hook will pick this up and
# attach it as a git note with the actual commit hash.

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
PENDING_FILE="$REPO_ROOT/oracle/pending.jsonl"
RUNNER="$REPO_ROOT/test/comparison/session_test_runner.js"

# Pass through any arguments (e.g., --golden)
ARGS="$@"

echo "Running session tests..."

# Use a temp file to avoid shell variable size limits on large JSON output.
TMPOUT=$(mktemp /tmp/session-tests-XXXXXX)
trap 'rm -f "$TMPOUT"' EXIT

# Run the session runner and capture output to temp file.
# Session failures are expected in parity work; we still want JSON output.
set +e
node "$RUNNER" $ARGS >"$TMPOUT" 2>&1
RUNNER_STATUS=$?
set -e

# Extract the JSON from the output (after __RESULTS_JSON__ marker)
JSON_FILE=$(mktemp /tmp/session-json-XXXXXX)
trap 'rm -f "$TMPOUT" "$JSON_FILE"' EXIT
sed -n '/__RESULTS_JSON__/{n;p;}' "$TMPOUT" > "$JSON_FILE"

if [ ! -s "$JSON_FILE" ]; then
    echo "Error: No JSON results found in output"
    cat "$TMPOUT"
    exit 1
fi

# Ensure oracle directory exists
mkdir -p "$REPO_ROOT/oracle"

# Write results with commit set to HEAD
jq '.commit = "HEAD"' "$JSON_FILE" > "$PENDING_FILE"

# Show summary
PASSED=$(jq -r '.summary.passed' "$JSON_FILE")
TOTAL=$(jq -r '.summary.total' "$JSON_FILE")
FAILED=$(jq -r '.summary.failed' "$JSON_FILE")

echo ""
echo "Session tests complete: $PASSED/$TOTAL passed ($FAILED failed)"
echo "Results written to oracle/pending.jsonl"
echo "Commit to attach results as git note."

if [ "$RUNNER_STATUS" -ne 0 ]; then
    echo "Session runner exited with status $RUNNER_STATUS (results captured)."
fi
