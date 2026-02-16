#!/usr/bin/env bash
set -euo pipefail

# Compare current session runner output against a captured baseline bundle.
# Usage:
#   scripts/session-baseline-check.sh [--baseline path] [--new-cmd "..."] [--strict]

BASELINE="test/comparison/baseline_results.json"
NEW_CMD="node test/comparison/session_test_runner.js"
STRICT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline)
      BASELINE="$2"
      shift 2
      ;;
    --new-cmd)
      NEW_CMD="$2"
      shift 2
      ;;
    --strict)
      STRICT=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT" || exit 1

if [[ ! -f "$BASELINE" ]]; then
  echo "Baseline file not found: $BASELINE" >&2
  echo "Run: bash scripts/session-baseline-capture.sh --output $BASELINE" >&2
  exit 1
fi

OLD_CMD="printf '__RESULTS_JSON__\\n'; jq -c . '$BASELINE'"

ARGS=(--old "$OLD_CMD" --new "$NEW_CMD" --output "test/comparison/runner_diff.json")
if [[ "$STRICT" -eq 1 ]]; then
  ARGS+=(--strict)
fi

bash scripts/session-runner-diff.sh "${ARGS[@]}"
