#!/usr/bin/env bash
set -euo pipefail

# Compare old vs new session runner outputs (both must emit __RESULTS_JSON__).
# Usage:
#   scripts/session-runner-diff.sh --old "node test/comparison/session_test_runner.js" \
#                                  --new "node test/comparison/new_runner.js" \
#                                  [--output test/comparison/runner_diff.json] [--strict]

OLD_CMD=""
NEW_CMD=""
OUTPUT="test/comparison/runner_diff.json"
STRICT=0
SAMPLE_LIMIT=25

while [[ $# -gt 0 ]]; do
  case "$1" in
    --old)
      OLD_CMD="$2"
      shift 2
      ;;
    --new)
      NEW_CMD="$2"
      shift 2
      ;;
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    --sample-limit)
      SAMPLE_LIMIT="$2"
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

if [[ -z "$OLD_CMD" || -z "$NEW_CMD" ]]; then
  echo "Usage: $0 --old \"<cmd>\" --new \"<cmd>\" [--output path] [--sample-limit N] [--strict]" >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT" || exit 1

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

run_cmd() {
  local label="$1"
  local cmd="$2"
  local out_file="$3"
  local meta_file="$4"

  local start end
  start="$(date +%s%3N 2>/dev/null || echo 0)"
  set +e
  bash -lc "$cmd" >"$out_file" 2>&1
  local code=$?
  set -e
  end="$(date +%s%3N 2>/dev/null || echo 0)"

  local duration=0
  if [[ "$start" != "0" && "$end" != "0" ]]; then
    duration=$((end - start))
  fi

  echo "${code},${duration}" > "$meta_file"
}

extract_json_line() {
  local file="$1"
  sed -n '/__RESULTS_JSON__/{n;p;}' "$file" | tail -1
}

echo "Running old runner: $OLD_CMD"
run_cmd "Old" "$OLD_CMD" "$TMP_DIR/old.log" "$TMP_DIR/old.meta"
OLD_JSON_LINE="$(extract_json_line "$TMP_DIR/old.log")"
if [[ -z "$OLD_JSON_LINE" ]] || ! echo "$OLD_JSON_LINE" | jq . >/dev/null 2>&1; then
  echo "Old command output missing valid __RESULTS_JSON__ payload" >&2
  echo "Old command exit code: $(cut -d, -f1 "$TMP_DIR/old.meta")" >&2
  cat "$TMP_DIR/old.log" >&2
  exit 2
fi

echo "Running new runner: $NEW_CMD"
run_cmd "New" "$NEW_CMD" "$TMP_DIR/new.log" "$TMP_DIR/new.meta"
NEW_JSON_LINE="$(extract_json_line "$TMP_DIR/new.log")"
if [[ -z "$NEW_JSON_LINE" ]] || ! echo "$NEW_JSON_LINE" | jq . >/dev/null 2>&1; then
  echo "New command output missing valid __RESULTS_JSON__ payload" >&2
  echo "New command exit code: $(cut -d, -f1 "$TMP_DIR/new.meta")" >&2
  cat "$TMP_DIR/new.log" >&2
  exit 2
fi

OLD_DURATION="$(cut -d, -f2 "$TMP_DIR/old.meta")"
NEW_DURATION="$(cut -d, -f2 "$TMP_DIR/new.meta")"

mkdir -p "$(dirname "$OUTPUT")"

jq -n \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg commit "$(git rev-parse HEAD)" \
  --arg oldCmd "$OLD_CMD" \
  --arg newCmd "$NEW_CMD" \
  --argjson oldDuration "$OLD_DURATION" \
  --argjson newDuration "$NEW_DURATION" \
  --argjson sampleLimit "$SAMPLE_LIMIT" \
  --argjson oldBundle "$OLD_JSON_LINE" \
  --argjson newBundle "$NEW_JSON_LINE" \
  '
  def map_by_session($arr):
    reduce ($arr // [])[] as $r ({}; .[$r.session] = $r);

  def changed_rows($oldMap; $newMap):
    [($oldMap | keys[]) as $k
      | select($newMap[$k] != null)
      | ($oldMap[$k]) as $o
      | ($newMap[$k]) as $n
      | select(
          (($o.passed // false) != ($n.passed // false))
          or (($o.type // "other") != ($n.type // "other"))
          or (($o.metrics.rng // null) != ($n.metrics.rng // null))
          or (($o.metrics.grids // null) != ($n.metrics.grids // null))
        )
      | {
          session: $k,
          old: {
            passed: ($o.passed // false),
            type: ($o.type // "other"),
            rng: ($o.metrics.rng // null),
            grids: ($o.metrics.grids // null),
            firstDivergence: ($o.firstDivergence // null),
            error: ($o.error // null)
          },
          newer: {
            passed: ($n.passed // false),
            type: ($n.type // "other"),
            rng: ($n.metrics.rng // null),
            grids: ($n.metrics.grids // null),
            firstDivergence: ($n.firstDivergence // null),
            error: ($n.error // null)
          }
        }
    ];

  ($oldBundle.results // []) as $oldResults
  | ($newBundle.results // []) as $newResults
  | map_by_session($oldResults) as $oldMap
  | map_by_session($newResults) as $newMap
  | ($oldMap | keys) as $oldKeys
  | ($newMap | keys) as $newKeys
  | [ $oldKeys[] | select(($newMap[.] // null) == null) ] as $onlyOld
  | [ $newKeys[] | select(($oldMap[.] // null) == null) ] as $onlyNew
  | changed_rows($oldMap; $newMap) as $changed
  | {
      schemaVersion: 1,
      generatedAt: $generatedAt,
      commit: $commit,
      commands: {
        old: $oldCmd,
        newer: $newCmd
      },
      durationsMs: {
        old: $oldDuration,
        newer: $newDuration
      },
      diff: {
        summary: {
          old: ($oldBundle.summary // {}),
          newer: ($newBundle.summary // {}),
          sameSummary: (
            (($oldBundle.summary.total // 0) == ($newBundle.summary.total // 0))
            and (($oldBundle.summary.passed // 0) == ($newBundle.summary.passed // 0))
            and (($oldBundle.summary.failed // 0) == ($newBundle.summary.failed // 0))
          ),
          onlyOldCount: ($onlyOld | length),
          onlyNewCount: ($onlyNew | length),
          changedCount: ($changed | length)
        },
        onlyOld: ($onlyOld[:$sampleLimit]),
        onlyNew: ($onlyNew[:$sampleLimit]),
        changed: ($changed[:$sampleLimit])
      }
    }
  ' > "$OUTPUT"

echo "--- Session Runner Diff Summary ---"
echo "Old summary: $(jq -c '.diff.summary.old' "$OUTPUT")"
echo "New summary: $(jq -c '.diff.summary.newer' "$OUTPUT")"
echo "Only old: $(jq -r '.diff.summary.onlyOldCount' "$OUTPUT")"
echo "Only new: $(jq -r '.diff.summary.onlyNewCount' "$OUTPUT")"
echo "Changed:  $(jq -r '.diff.summary.changedCount' "$OUTPUT")"
echo "Report:   $OUTPUT"

if [[ "$STRICT" -eq 1 ]]; then
  same_summary="$(jq -r '.diff.summary.sameSummary' "$OUTPUT")"
  only_old="$(jq -r '.diff.summary.onlyOldCount' "$OUTPUT")"
  only_new="$(jq -r '.diff.summary.onlyNewCount' "$OUTPUT")"
  changed="$(jq -r '.diff.summary.changedCount' "$OUTPUT")"
  if [[ "$same_summary" != "true" || "$only_old" -gt 0 || "$only_new" -gt 0 || "$changed" -gt 0 ]]; then
    exit 1
  fi
fi
