#!/bin/bash
# Re-backfill git notes with full session results for commits since START_DATE.
# Uses a single clone with current test infra, swapping only game code per commit.
#
# Usage: oracle/rebackfill.sh [--dry-run] [--limit=N] [--fix-timeouts]
#
# Modes:
#   (default)        Re-run commits with backfilled (summary-only) notes
#   --fix-timeouts   Re-run commits that have timed-out sessions, replacing
#                    the note only if the re-run has fewer timeouts

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
# Start after 68992c5a (Phase 2: injectable input runtime)
START_DATE="2026-02-16T03:06"
DRY_RUN=false
LIMIT=0
FIX_TIMEOUTS=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --limit=*) LIMIT="${arg#--limit=}" ;;
    --fix-timeouts) FIX_TIMEOUTS=true ;;
  esac
done

# Collect commits to process
> /tmp/rebackfill_commits.txt

if $FIX_TIMEOUTS; then
  echo "Scanning notes for entries with timed-out sessions since $START_DATE..."
  git ls-tree -r refs/notes/test-results | while read mode type hash path; do
    note=$(git cat-file -p "$hash" 2>/dev/null)
    [ -z "$note" ] && continue
    echo "$note" | jq -e '.results | length > 0' >/dev/null 2>&1 || continue
    date=$(echo "$note" | jq -r '(.date // .timestamp) // empty' 2>/dev/null)
    [ -z "$date" ] && continue
    [[ "$date" < "$START_DATE" ]] && continue
    n=$(echo "$note" | jq '[.results[] | select(.error)] | length' 2>/dev/null)
    if [ "$n" -gt 0 ] 2>/dev/null; then
      commit_hash="${path//\//}"
      echo "$commit_hash"
    fi
  done > /tmp/rebackfill_commits.txt
else
  echo "Scanning notes for backfilled entries since $START_DATE..."
  git notes --ref=test-results list 2>/dev/null | while read note_hash commit_hash; do
    note=$(git notes --ref=test-results show "$commit_hash" 2>/dev/null || echo "")
    [ -z "$note" ] && continue
    echo "$note" | jq -e '.results' >/dev/null 2>&1 && continue
    date=$(echo "$note" | jq -r '.date // empty' 2>/dev/null)
    [ -z "$date" ] && continue
    [[ "$date" < "$START_DATE" ]] && continue
    echo "$commit_hash"
  done > /tmp/rebackfill_commits.txt
fi

COMMITS=()
while IFS= read -r line; do
  [ -n "$line" ] && COMMITS+=("$line")
done < /tmp/rebackfill_commits.txt
echo "Found ${#COMMITS[@]} commits to process"

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
    short=$(git rev-parse --short "$c" 2>/dev/null || echo "${c:0:8}")
    if $FIX_TIMEOUTS; then
      # Show timeout count for this commit
      note=$(git cat-file -p "$(git ls-tree -r refs/notes/test-results | grep "${c:0:2}/${c:2}" | awk '{print $3}')" 2>/dev/null)
      n=$(echo "$note" | jq '[.results[] | select(.error)] | length' 2>/dev/null || echo "?")
      echo "  $short ($n timeouts)"
    else
      echo "  $short"
    fi
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
SUCCEEDED=0
SKIPPED=0
TOTAL=${#COMMITS[@]}

for commit in "${COMMITS[@]}"; do
  short=$(git rev-parse --short "$commit" 2>/dev/null || echo "${c:0:8}")
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
  (cd "$WORK_DIR" && bash ./scripts/run-session-tests.sh --session-timeout-ms=20000 >/dev/null 2>&1) || true

  PENDING="$WORK_DIR/oracle/pending.jsonl"
  if [ -f "$PENDING" ] && jq -e '.results' "$PENDING" >/dev/null 2>&1; then
    if $FIX_TIMEOUTS; then
      # Only replace if the new result has fewer timeouts than the old one
      OLD_TIMEOUTS=$(git ls-tree -r refs/notes/test-results | grep "${commit:0:2}/${commit:2}" | awk '{print $3}' | xargs git cat-file -p 2>/dev/null | jq '[.results[] | select(.error)] | length' 2>/dev/null || echo 999)
      NEW_TIMEOUTS=$(jq '[.results[] | select(.error)] | length' "$PENDING" 2>/dev/null || echo 999)

      if [ "$NEW_TIMEOUTS" -lt "$OLD_TIMEOUTS" ]; then
        PARENT_SHORT=$(git rev-parse --short "${commit}^" 2>/dev/null || echo "none")
        jq --arg commit "$short" --arg parent "$PARENT_SHORT" \
          '.commit = $commit | .parent = $parent' "$PENDING" \
          | git notes --ref=test-results add -f -F - "$commit"
        ELAPSED=$(( $(date +%s) - START_TIME ))
        echo "✅ timeouts $OLD_TIMEOUTS→$NEW_TIMEOUTS (${ELAPSED}s)"
        SUCCEEDED=$((SUCCEEDED + 1))
      else
        ELAPSED=$(( $(date +%s) - START_TIME ))
        echo "⏭ no improvement ($OLD_TIMEOUTS→$NEW_TIMEOUTS) (${ELAPSED}s)"
        SKIPPED=$((SKIPPED + 1))
      fi
    else
      PARENT_SHORT=$(git rev-parse --short "${commit}^" 2>/dev/null || echo "none")
      jq --arg commit "$short" --arg parent "$PARENT_SHORT" \
        '.commit = $commit | .parent = $parent' "$PENDING" \
        | git notes --ref=test-results add -f -F - "$commit"
      ELAPSED=$(( $(date +%s) - START_TIME ))
      RESULTS_COUNT=$(jq '.results | length' "$PENDING")
      RNG=$(jq '[.results[].metrics.rngCalls // empty | .matched] | add // 0' "$PENDING")
      echo "✅ ${RESULTS_COUNT} sessions, rng=${RNG} (${ELAPSED}s)"
      SUCCEEDED=$((SUCCEEDED + 1))
    fi
  else
    if ! $FIX_TIMEOUTS; then
      # Mark as attempted so we don't retry next time
      echo "{\"results\":[], \"commit\":\"$short\", \"date\":\"$(date -u +%Y-%m-%dT%H:%M:%S)\", \"skipped\":true}" \
        | git notes --ref=test-results add -f -F - "$commit"
    fi
    ELAPSED=$(( $(date +%s) - START_TIME ))
    echo "✗ no results (${ELAPSED}s)"
    FAILED=$((FAILED + 1))
  fi

  # Push notes after each commit so progress is saved incrementally
  if [ "$SUCCEEDED" -gt 0 ] || ! $FIX_TIMEOUTS; then
    git push --no-verify origin +refs/notes/test-results:refs/notes/test-results 2>/dev/null \
      && echo "  ↳ pushed" || echo "  ↳ push failed (will retry later)"
  fi
done

# Cleanup
rm -rf "$WORK_DIR" "$INFRA_DIR" /tmp/rebackfill_commits.txt

echo ""
if $FIX_TIMEOUTS; then
  echo "Done: $SUCCEEDED improved, $SKIPPED unchanged, $FAILED failed out of $TOTAL"
else
  echo "Done: $SUCCEEDED succeeded, $FAILED failed out of $TOTAL"
fi

if [ "$SUCCEEDED" -gt 0 ]; then
  echo ""
  echo "Final push of notes..."
  git push --no-verify origin +refs/notes/test-results:refs/notes/test-results && echo "✅ Pushed notes" || echo "⚠️  Could not push notes"

  echo ""
  echo "Rebuilding results.jsonl..."
  bash "$REPO_ROOT/oracle/rebuild.sh" --no-fetch
fi
