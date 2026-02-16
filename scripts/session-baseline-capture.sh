#!/usr/bin/env bash
set -euo pipefail

# Capture detailed session-runner bundle baseline.
# Usage: scripts/session-baseline-capture.sh [--output path]

OUTPUT="test/comparison/baseline_results.json"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT" || exit 1

TMP_LOG="$(mktemp)"
trap 'rm -f "$TMP_LOG"' EXIT

set +e
node test/comparison/session_test_runner.js >"$TMP_LOG" 2>&1
RUNNER_EXIT=$?
set -e

JSON_LINE="$(sed -n '/__RESULTS_JSON__/{n;p;}' "$TMP_LOG" | tail -1)"
if [[ -z "$JSON_LINE" ]]; then
  echo "Failed to capture session baseline: missing __RESULTS_JSON__ payload" >&2
  cat "$TMP_LOG" >&2
  exit 1
fi

if ! echo "$JSON_LINE" | jq . >/dev/null 2>&1; then
  echo "Failed to capture session baseline: invalid JSON payload" >&2
  echo "$JSON_LINE" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"
echo "$JSON_LINE" | jq . > "$OUTPUT"

echo "Captured session baseline to $OUTPUT"
echo "Runner exit code: $RUNNER_EXIT"
echo "Summary: $(jq -c '.summary' "$OUTPUT")"
