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

# Run the session runner and capture output.
# Session failures are expected in parity work; we still want JSON output.
set +e
OUTPUT=$(node "$RUNNER" $ARGS 2>&1)
RUNNER_STATUS=$?
set -e

# Extract the JSON from the output (after __RESULTS_JSON__ marker)
JSON=$(echo "$OUTPUT" | sed -n '/__RESULTS_JSON__/{n;p;}')

if [ -z "$JSON" ]; then
    echo "Error: No JSON results found in output"
    echo "$OUTPUT"
    exit 1
fi

# Ensure oracle directory exists
mkdir -p "$REPO_ROOT/oracle"

# Write results with commit set to HEAD
echo "$JSON" | jq '.commit = "HEAD"' > "$PENDING_FILE"

# Show summary
PASSED=$(echo "$JSON" | jq -r '.summary.passed')
TOTAL=$(echo "$JSON" | jq -r '.summary.total')
FAILED=$(echo "$JSON" | jq -r '.summary.failed')

echo ""
echo "Session tests complete: $PASSED/$TOTAL passed ($FAILED failed)"
echo "Results written to oracle/pending.jsonl"
echo "Commit to attach results as git note."

if [ "$RUNNER_STATUS" -ne 0 ]; then
    echo "Session runner exited with status $RUNNER_STATUS (results captured)."
fi
