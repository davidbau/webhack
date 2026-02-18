#!/bin/bash
# Re-backfill git notes with full session results for commits since START_DATE.
# Uses a single clone with current test infra, swapping only game code per commit.
#
# Usage: oracle/rebackfill.sh [--dry-run] [--limit=N]

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
# Start after 68992c5a (Phase 2: injectable input runtime)
START_DATE="2026-02-16T03:06"
DRY_RUN=false
LIMIT=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --limit=*) LIMIT="${arg#--limit=}" ;;
  esac
done

# Collect commits that need re-backfilling
echo "Scanning notes for backfilled entries since $START_DATE..."
> /tmp/rebackfill_commits.txt
git notes --ref=test-results list 2>/dev/null | while read note_hash commit_hash; do
  note=$(git notes --ref=test-results show "$commit_hash" 2>/dev/null || echo "")
  [ -z "$note" ] && continue
  echo "$note" | jq -e '.results' >/dev/null 2>&1 && continue
  date=$(echo "$note" | jq -r '.date // empty' 2>/dev/null)
  [ -z "$date" ] && continue
  [[ "$date" < "$START_DATE" ]] && continue
  echo "$commit_hash"
done > /tmp/rebackfill_commits.txt

COMMITS=()
while IFS= read -r line; do
  [ -n "$line" ] && COMMITS+=("$line")
done < /tmp/rebackfill_commits.txt
echo "Found ${#COMMITS[@]} commits to re-backfill"

if [ "${#COMMITS[@]}" -eq 0 ]; then
  echo "Nothing to do."
  exit 0
fi

if [ "$LIMIT" -gt 0 ] && [ "$LIMIT" -lt "${#COMMITS[@]}" ]; then
  COMMITS=("${COMMITS[@]:0:$LIMIT}")
  echo "Limiting to $LIMIT commits"
fi

if $DRY_RUN; then
  for c in "${COMMITS[@]}"; do
    echo "  $(git rev-parse --short "$c")"
  done
  exit 0
fi

# Create work clone
WORK_DIR=$(mktemp -d "/tmp/rebackfill-XXXXXX")
echo "Cloning to $WORK_DIR..."
git clone "$REPO_ROOT" "$WORK_DIR" --quiet

# Remove git hooks so they don't interfere
rm -rf "$WORK_DIR/.githooks"
mkdir -p "$WORK_DIR/.githooks"

# Install deps (skip postinstall hooks)
echo "Installing dependencies..."
(cd "$WORK_DIR" && npm install --ignore-scripts --silent 2>/dev/null)
mkdir -p "$WORK_DIR/oracle"

# Stash the current test infra files
INFRA_DIR=$(mktemp -d "/tmp/rebackfill-infra-XXXXXX")
cp -R "$REPO_ROOT/test/comparison" "$INFRA_DIR/comparison"
cp "$REPO_ROOT/scripts/run-session-tests.sh" "$INFRA_DIR/run-session-tests.sh"

DONE=0
FAILED=0
TOTAL=${#COMMITS[@]}

for commit in "${COMMITS[@]}"; do
  short=$(git rev-parse --short "$commit")
  DONE=$((DONE + 1))
  START_TIME=$(date +%s)

  echo -n "[$DONE/$TOTAL] $short... "

  # Swap game code to this commit
  CHECKOUT_OUT=$(cd "$WORK_DIR" && git checkout "$commit" -- js/ dat/ 2>&1) || {
    echo "✗ checkout failed: $CHECKOUT_OUT"
    FAILED=$((FAILED + 1))
    continue
  }

  # Overlay current test infra
  cp -R "$INFRA_DIR/comparison/"* "$WORK_DIR/test/comparison/"
  cp "$INFRA_DIR/run-session-tests.sh" "$WORK_DIR/scripts/run-session-tests.sh"

  # Patch missing exports in old game code so the current test runner can load it
  if ! grep -q 'rn2_on_display_rng' "$WORK_DIR/js/rng.js" 2>/dev/null; then
    echo 'export function rn2_on_display_rng(x) { return 0; }' >> "$WORK_DIR/js/rng.js"
  fi

  # Run session tests (may exit non-zero due to test failures)
  rm -f "$WORK_DIR/oracle/pending.jsonl"
  (cd "$WORK_DIR" && bash ./scripts/run-session-tests.sh --session-timeout-ms=10000 >/dev/null 2>&1) || true

  PENDING="$WORK_DIR/oracle/pending.jsonl"
  if [ -f "$PENDING" ] && jq -e '.results' "$PENDING" >/dev/null 2>&1; then
    PARENT_SHORT=$(git rev-parse --short "${commit}^" 2>/dev/null || echo "none")
    jq --arg commit "$short" --arg parent "$PARENT_SHORT" \
      '.commit = $commit | .parent = $parent' "$PENDING" \
      | git notes --ref=test-results add -f -F - "$commit"
    ELAPSED=$(( $(date +%s) - START_TIME ))
    RESULTS_COUNT=$(jq '.results | length' "$PENDING")
    RNG=$(jq '[.results[].metrics.rngCalls // empty | .matched] | add // 0' "$PENDING")
    echo "✅ ${RESULTS_COUNT} sessions, rng=${RNG} (${ELAPSED}s)"
  else
    ELAPSED=$(( $(date +%s) - START_TIME ))
    echo "✗ no results (${ELAPSED}s)"
    FAILED=$((FAILED + 1))
  fi
done

# Cleanup
rm -rf "$WORK_DIR" "$INFRA_DIR" /tmp/rebackfill_commits.txt

echo ""
echo "Done: $((DONE - FAILED)) succeeded, $FAILED failed out of $TOTAL"
echo ""
echo "To sync: git push origin +refs/notes/test-results:refs/notes/test-results"
echo "Then:    oracle/rebuild.sh"
