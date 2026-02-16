#!/usr/bin/env bash
set -u

# Capture Phase 0 baseline metrics for unit/e2e/session into test/baseline.json.
# Usage: scripts/phase0-capture-baseline.sh [--output path] [--skip-e2e] [--strict]

OUTPUT="test/baseline.json"
SKIP_E2E=0
STRICT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    --skip-e2e)
      SKIP_E2E=1
      shift
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

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT" || exit 1

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

ms_now() {
  date +%s%3N 2>/dev/null || echo "0"
}

parse_node_tests() {
  local file="$1"
  local total pass fail skipped todo cancelled
  total="$(grep -E '^ℹ tests ' "$file" | tail -1 | awk '{print $3}')"
  pass="$(grep -E '^ℹ pass ' "$file" | tail -1 | awk '{print $3}')"
  fail="$(grep -E '^ℹ fail ' "$file" | tail -1 | awk '{print $3}')"
  skipped="$(grep -E '^ℹ skipped ' "$file" | tail -1 | awk '{print $3}')"
  todo="$(grep -E '^ℹ todo ' "$file" | tail -1 | awk '{print $3}')"
  cancelled="$(grep -E '^ℹ cancelled ' "$file" | tail -1 | awk '{print $3}')"

  if [[ -z "$total" || -z "$pass" || -z "$fail" ]]; then
    total=$(( $(grep -c '^ok\b\|^not ok\b' "$file" 2>/dev/null || echo 0) ))
    pass="$(grep -c '^ok\b' "$file" 2>/dev/null || echo 0)"
    fail="$(grep -c '^not ok\b' "$file" 2>/dev/null || echo 0)"
  fi

  skipped="${skipped:-0}"
  todo="${todo:-0}"
  cancelled="${cancelled:-0}"

  printf '{"total":%s,"passed":%s,"failed":%s,"skipped":%s,"todo":%s,"cancelled":%s}' \
    "${total:-0}" "${pass:-0}" "${fail:-0}" "$skipped" "$todo" "$cancelled"
}

run_and_capture() {
  local label="$1"
  local cmd="$2"
  local log="$3"

  echo ""
  echo "=== Phase 0 Baseline: ${label} ==="
  local start end
  start="$(ms_now)"
  set +e
  bash -lc "$cmd" >"$log" 2>&1
  local code=$?
  set -e
  end="$(ms_now)"
  cat "$log"

  local duration=0
  if [[ "$start" != "0" && "$end" != "0" ]]; then
    duration=$((end - start))
  fi

  echo "$code,$duration"
}

set -e
OVERALL_START="$(ms_now)"

UNIT_LOG="$TMP_DIR/unit.log"
UNIT_META="$(run_and_capture unit 'node --test test/unit/*.test.js' "$UNIT_LOG" | tail -1)"
UNIT_EXIT="${UNIT_META%%,*}"
UNIT_DURATION="${UNIT_META##*,}"
UNIT_COUNTS="$(parse_node_tests "$UNIT_LOG")"

E2E_EXIT="0"
E2E_DURATION="0"
E2E_COUNTS='{"total":0,"passed":0,"failed":0,"skipped":0,"todo":0,"cancelled":0}'
E2E_STATUS='skipped'
if [[ "$SKIP_E2E" -eq 0 ]]; then
  E2E_LOG="$TMP_DIR/e2e.log"
  E2E_META="$(run_and_capture e2e 'node --test --test-concurrency=1 test/e2e/*.test.js' "$E2E_LOG" | tail -1)"
  E2E_EXIT="${E2E_META%%,*}"
  E2E_DURATION="${E2E_META##*,}"
  E2E_COUNTS="$(parse_node_tests "$E2E_LOG")"
  if [[ "$E2E_EXIT" -eq 0 ]] && [[ "$(echo "$E2E_COUNTS" | jq '.failed')" -eq 0 ]]; then
    E2E_STATUS='passed'
  else
    E2E_STATUS='failed'
  fi
fi

SESSION_LOG="$TMP_DIR/session.log"
SESSION_META="$(run_and_capture session 'node test/comparison/session_test_runner.js' "$SESSION_LOG" | tail -1)"
SESSION_EXIT="${SESSION_META%%,*}"
SESSION_DURATION="${SESSION_META##*,}"
SESSION_JSON_LINE="$(sed -n '/__RESULTS_JSON__/{n;p;}' "$SESSION_LOG" | tail -1)"

SESSION_COUNTS='{"total":0,"passed":0,"failed":0}'
SESSION_BY_TYPE='{}'
SESSION_FAILING='[]'
SESSION_PARSE_ERROR=''

if [[ -n "$SESSION_JSON_LINE" ]] && echo "$SESSION_JSON_LINE" | jq . >/dev/null 2>&1; then
  SESSION_COUNTS="$(echo "$SESSION_JSON_LINE" | jq '{total:(.summary.total//0), passed:(.summary.passed//0), failed:(.summary.failed//0)}')"
  SESSION_BY_TYPE="$(echo "$SESSION_JSON_LINE" | jq '
    [(.results // [])[] | .type = (.type // "other")]
    | group_by(.type)
    | map({key: .[0].type, value: {total: length, passed: ([.[] | select(.passed==true)] | length), failed: ([.[] | select(.passed!=true)] | length)}})
    | from_entries
  ')"
  SESSION_FAILING="$(echo "$SESSION_JSON_LINE" | jq '
    (.results // [])
    | map(select(.passed != true)
      | {session, type:(.type // "other"), firstDivergence:(.firstDivergence // null), error:(.error // null)})
    | .[:20]
  ')"
else
  SESSION_PARSE_ERROR='Missing or invalid __RESULTS_JSON__ payload'
fi

unit_failed="$(echo "$UNIT_COUNTS" | jq '.failed')"
if [[ "$UNIT_EXIT" -eq 0 && "$unit_failed" -eq 0 ]]; then
  UNIT_STATUS='passed'
else
  UNIT_STATUS='failed'
fi

session_failed="$(echo "$SESSION_COUNTS" | jq '.failed')"
if [[ "$SESSION_EXIT" -eq 0 && "$session_failed" -eq 0 ]]; then
  SESSION_STATUS='passed'
else
  SESSION_STATUS='failed'
fi

if [[ "$SKIP_E2E" -eq 1 ]]; then
  E2E_STATUS='skipped'
fi

count_lines() {
  local file="$1"
  if [[ -f "$file" ]]; then
    wc -l < "$file" | tr -d ' '
  else
    echo 0
  fi
}

SESSION_HELPERS_LINES="$(count_lines test/comparison/session_helpers.js)"
SESSION_RUNNER_LINES="$(count_lines test/comparison/session_test_runner.js)"
HEADLESS_GAME_LINES="$(count_lines test/comparison/headless_game.js)"

OVERALL_END="$(ms_now)"
OVERALL_DURATION=0
if [[ "$OVERALL_START" != "0" && "$OVERALL_END" != "0" ]]; then
  OVERALL_DURATION=$((OVERALL_END - OVERALL_START))
fi

mkdir -p "$(dirname "$OUTPUT")"

jq -n \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg commit "$(git rev-parse HEAD)" \
  --arg branch "$(git rev-parse --abbrev-ref HEAD)" \
  --arg nodeVersion "$(node -v)" \
  --arg platform "$(uname -s | tr '[:upper:]' '[:lower:]')/$(uname -m)" \
  --argjson unitCounts "$UNIT_COUNTS" \
  --argjson e2eCounts "$E2E_COUNTS" \
  --argjson sessionCounts "$SESSION_COUNTS" \
  --argjson sessionByType "$SESSION_BY_TYPE" \
  --argjson sessionFailing "$SESSION_FAILING" \
  --arg unitStatus "$UNIT_STATUS" \
  --arg e2eStatus "$E2E_STATUS" \
  --arg sessionStatus "$SESSION_STATUS" \
  --arg sessionParseError "$SESSION_PARSE_ERROR" \
  --argjson unitExit "$UNIT_EXIT" \
  --argjson e2eExit "$E2E_EXIT" \
  --argjson sessionExit "$SESSION_EXIT" \
  --argjson unitDuration "$UNIT_DURATION" \
  --argjson e2eDuration "$E2E_DURATION" \
  --argjson sessionDuration "$SESSION_DURATION" \
  --argjson overallDuration "$OVERALL_DURATION" \
  --argjson sessionHelpersLines "$SESSION_HELPERS_LINES" \
  --argjson sessionRunnerLines "$SESSION_RUNNER_LINES" \
  --argjson headlessGameLines "$HEADLESS_GAME_LINES" \
  --arg skipE2E "$SKIP_E2E" \
  '
  {
    schemaVersion: 1,
    phase: 0,
    generatedAt: $generatedAt,
    commit: $commit,
    branch: $branch,
    nodeVersion: $nodeVersion,
    platform: $platform,
    commands: {
      unit: "node --test test/unit/*.test.js",
      e2e: "node --test --test-concurrency=1 test/e2e/*.test.js",
      session: "node test/comparison/session_test_runner.js"
    },
    categories: {
      unit: {
        status: $unitStatus,
        exitCode: $unitExit,
        durationMs: $unitDuration,
        counts: $unitCounts
      },
      e2e: (
        if $skipE2E == "1" then
          {
            status: "skipped",
            exitCode: null,
            durationMs: 0,
            counts: $e2eCounts,
            note: "Skipped via --skip-e2e"
          }
        else
          {
            status: $e2eStatus,
            exitCode: $e2eExit,
            durationMs: $e2eDuration,
            counts: $e2eCounts
          }
        end
      ),
      session: (
        {
          status: $sessionStatus,
          exitCode: $sessionExit,
          durationMs: $sessionDuration,
          counts: $sessionCounts,
          byType: $sessionByType,
          failingSamples: $sessionFailing
        }
        + (if ($sessionParseError | length) > 0 then {parseError: $sessionParseError} else {} end)
      )
    },
    overall: {
      durationMs: $overallDuration,
      total: ($unitCounts.total + $e2eCounts.total + $sessionCounts.total),
      passed: ($unitCounts.passed + $e2eCounts.passed + $sessionCounts.passed),
      failed: ($unitCounts.failed + $e2eCounts.failed + $sessionCounts.failed)
    },
    fileBaselines: {
      "test/comparison/session_helpers.js": {
        lines: $sessionHelpersLines,
        target: 500,
        note: "Remove HeadlessGame class and game logic"
      },
      "test/comparison/session_test_runner.js": {
        lines: $sessionRunnerLines,
        target: 350,
        note: "Keep only orchestration, no game logic"
      },
      "test/comparison/headless_game.js": {
        lines: $headlessGameLines,
        target: 0,
        note: "Delete after shared runtime adoption"
      }
    }
  }
  ' > "$OUTPUT"

echo ""
echo "=== Baseline Saved ==="
echo "Output: $OUTPUT"
echo "Unit:    $(jq -r '.categories.unit.counts.passed' "$OUTPUT")/$(jq -r '.categories.unit.counts.total' "$OUTPUT")"
echo "E2E:     $(jq -r '.categories.e2e.counts.passed' "$OUTPUT")/$(jq -r '.categories.e2e.counts.total' "$OUTPUT")"
echo "Session: $(jq -r '.categories.session.counts.passed' "$OUTPUT")/$(jq -r '.categories.session.counts.total' "$OUTPUT")"
echo "Overall: $(jq -r '.overall.passed' "$OUTPUT")/$(jq -r '.overall.total' "$OUTPUT")"

if [[ "$STRICT" -eq 1 ]]; then
  failed_total="$(jq -r '.overall.failed' "$OUTPUT")"
  if [[ "$failed_total" -gt 0 ]]; then
    exit 1
  fi
fi
