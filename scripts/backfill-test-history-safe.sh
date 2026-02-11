#!/bin/bash
# Safe backfill with dry-run option
# Usage: ./backfill-test-history-safe.sh [--dry-run] [limit] [skip]

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  shift
fi

LIMIT=${1:-10}  # Default: only 10 commits (safe!)
SKIP=${2:-0}

if [ "$DRY_RUN" = true ]; then
  echo "=========================================="
  echo "DRY RUN MODE"
  echo "=========================================="
  echo ""
  echo "This will show which commits would be tested"
  echo "without actually running tests or creating notes."
  echo ""
fi

echo "Backfill Configuration:"
echo "  Limit: $LIMIT commits"
echo "  Skip:  $SKIP recent commits"
echo "  Mode:  $([ "$DRY_RUN" = true ] && echo "DRY RUN" || echo "LIVE")"
echo ""

# Find commits without notes
COMMITS=$(git log --all --pretty=format:"%H %cI %an %s" --skip=$SKIP | while read commit date author msg; do
  if ! git notes --ref=test-results show "$commit" >/dev/null 2>&1; then
    echo "$commit|$date|$author|$msg"
  fi
done | head -n "$LIMIT")

COUNT=$(echo "$COMMITS" | wc -l)

if [ -z "$COMMITS" ] || [ "$COUNT" -eq 0 ]; then
  echo "✅ All commits have test notes!"
  exit 0
fi

echo "Found $COUNT commits without test notes:"
echo ""
echo "$COMMITS" | while IFS='|' read commit date author msg; do
  SHORT=$(echo "$commit" | cut -c1-7)
  echo "  $SHORT - $date - $author"
  echo "    $msg"
done

echo ""

if [ "$DRY_RUN" = true ]; then
  echo "=========================================="
  echo "Dry run complete"
  echo "=========================================="
  echo ""
  echo "To run for real:"
  echo "  scripts/backfill-test-history.sh $LIMIT $SKIP"
  echo ""
  echo "Or to backfill ALL history (could take hours!):"
  echo "  scripts/backfill-test-history.sh 1000 0"
  exit 0
fi

# Not dry run - execute the main script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/backfill-test-history.sh" "$LIMIT" "$SKIP"
