#!/bin/bash
# Rebuild oracle/results.jsonl from git notes, commit and push if changed.
# Intended to be run periodically (e.g., cron, CI, or manually).

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
OUTPUT_FILE="$REPO_ROOT/oracle/results.jsonl"
NO_FETCH=false

for arg in "$@"; do
  case "$arg" in
    --no-fetch) NO_FETCH=true ;;
  esac
done

if ! $NO_FETCH; then
  # Pull latest test notes from remote
  echo "Fetching test notes from remote..."
  git fetch origin 2>/dev/null || echo "ℹ️  Could not fetch from remote"
fi

if $NO_FETCH; then
  echo "Skipping fetch (--no-fetch)"
elif git fetch origin refs/notes/test-results:refs/notes/test-results-remote 2>/dev/null; then
  echo "✅ Fetched test-results notes from remote"

  if git show-ref refs/notes/test-results >/dev/null 2>&1; then
    # Merge remote notes into local (newest wins)
    git notes --ref=test-results-remote list 2>/dev/null | while read note_hash commit_hash; do
      REMOTE_NOTE=$(git notes --ref=test-results-remote show "$commit_hash" 2>/dev/null || echo "")
      LOCAL_NOTE=$(git notes --ref=test-results show "$commit_hash" 2>/dev/null || echo "")

      if [ -z "$LOCAL_NOTE" ]; then
        echo "$REMOTE_NOTE" | git notes --ref=test-results add -f -F - "$commit_hash" 2>/dev/null || true
      elif [ -n "$REMOTE_NOTE" ]; then
        # Prefer raw (has results array) over backfilled
        LOCAL_RAW=$(echo "$LOCAL_NOTE" | jq -e '.results' >/dev/null 2>&1 && echo "1" || echo "0")
        REMOTE_RAW=$(echo "$REMOTE_NOTE" | jq -e '.results' >/dev/null 2>&1 && echo "1" || echo "0")
        if [ "$LOCAL_RAW" = "0" ] && [ "$REMOTE_RAW" = "1" ]; then
          echo "$REMOTE_NOTE" | git notes --ref=test-results add -f -F - "$commit_hash" 2>/dev/null || true
        elif [ "$LOCAL_RAW" = "1" ]; then
          : # keep local raw note
        else
          # Both backfilled — keep newer
          REMOTE_DATE=$(echo "$REMOTE_NOTE" | jq -r '.date' 2>/dev/null || echo "")
          LOCAL_DATE=$(echo "$LOCAL_NOTE" | jq -r '.date' 2>/dev/null || echo "")
          if [ -n "$REMOTE_DATE" ] && [ -n "$LOCAL_DATE" ] && [[ "$REMOTE_DATE" > "$LOCAL_DATE" ]]; then
            echo "$REMOTE_NOTE" | git notes --ref=test-results add -f -F - "$commit_hash" 2>/dev/null || true
          fi
        fi
      fi
    done
    echo "✅ Merged remote notes"
    git update-ref -d refs/notes/test-results-remote 2>/dev/null || true
  else
    git update-ref refs/notes/test-results refs/notes/test-results-remote
    git update-ref -d refs/notes/test-results-remote 2>/dev/null || true
    echo "✅ Initialized local notes from remote"
  fi
else
  echo "ℹ️  No remote test-results notes found"
fi

# Rebuild results.jsonl from notes
echo "Rebuilding oracle/results.jsonl from git notes..."
TEMP_FILE=$(mktemp)

if git show-ref refs/notes/test-results >/dev/null 2>&1; then
  git notes --ref=test-results list | while read note_hash commit_hash; do
    # Skip notes for commits that no longer exist (e.g. rebased away)
    git cat-file -e "${commit_hash}^{commit}" 2>/dev/null || continue
    SHORT=$(git rev-parse --short "$commit_hash" 2>/dev/null || echo "")
    NOTE=$(git notes --ref=test-results show "$commit_hash" 2>/dev/null || echo "")
    if [ -n "$NOTE" ] && echo "$NOTE" | jq empty 2>/dev/null; then
      # Stamp each JSON object with the full commit hash for dedup, short hash for display
      echo "$NOTE" | jq -c --arg fh "$commit_hash" --arg sh "$SHORT" '. + {_fullhash: $fh, commit: $sh}' >> "$TEMP_FILE"
    fi
  done
fi

if [ -s "$TEMP_FILE" ]; then
  # Sort by date and compute aggregate metrics from raw results.
  # When multiple runs exist for the same commit, pick the best (non-timeout)
  # result per session before aggregating.
  jq -s -c '
    # Group raw entries by commit to merge multiple runs
    [.[] | select(.results)] as $raw |
    [.[] | select(.results | not)] as $backfilled |

    # Group raw entries by commit, merge results per session
    ($raw | group_by(._fullhash) | map(
      # For each commit group, collect all session results across runs
      (.[0]) as $first |
      ([.[].results[]] | group_by(.session) | map(
        # Per session: prefer non-error result, then latest
        sort_by(if .error then 1 else 0 end) | .[0]
      )) as $all_results |

      # Deduplicate: when both "foo.session.json" and "foo_gameplay.session.json"
      # exist, drop the non-_gameplay duplicate (these were parallel recordings of
      # the same scenario from create_wizard_sessions.py / create_selfplay_sessions.py).
      ([$all_results[].session | select(test("_gameplay\\.session\\.json$"))
        | gsub("_gameplay\\.session\\.json$"; ".session.json")] ) as $gp_bases |
      [$all_results[] | select(
        (.session | test("_gameplay\\.session\\.json$"))
        or ((.session | IN($gp_bases[])) | not)
      )] |

      # Normalize session names: strip "_gameplay" suffix so old and new names
      # map to the same canonical name in the grid display.
      [.[] | .session |= gsub("_gameplay\\.session\\.json$"; ".session.json")]
      as $best_results |

      ($best_results | length) as $nsessions |
      ([$best_results[].metrics | select(.rngCalls) | .rngCalls.matched] | add) as $rngM |
      ([$best_results[].metrics | select(.rngCalls) | .rngCalls.total]   | add) as $rngT |
      ([$best_results[].metrics | select(.screens)  | .screens.matched]  | add) as $scrM |
      ([$best_results[].metrics | select(.screens)  | .screens.total]    | add) as $scrT |
      ([$best_results[].metrics | select(.grids)    | .grids.matched]    | add) as $grdM |
      ([$best_results[].metrics | select(.grids)    | .grids.total]      | add) as $grdT |
      {
        commit: $first.commit,
        parent: $first.parent,
        date: ($first.date // $first.timestamp),
        author: ($first.author // null),
        message: ($first.message // null),
        stats: {
          total: ($best_results | length),
          pass: ([$best_results[] | select(.passed)] | length),
          fail: ([$best_results[] | select(.passed | not)] | length)
        },
        sessions: $nsessions,
        metrics: {
          rng:     { matched: ($rngM // 0), total: ($rngT // 0) },
          screens: { matched: ($scrM // 0), total: ($scrT // 0) },
          grids:   { matched: ($grdM // 0), total: ($grdT // 0) }
        },
        categories: (
          [$best_results[] | {type, passed}] | group_by(.type) |
          map({
            key: .[0].type,
            value: {
              total: length,
              pass: [.[] | select(.passed)] | length,
              fail: [.[] | select(.passed | not)] | length
            }
          }) | from_entries
        ),
        session_detail: [$best_results[] | {
          s: .session,
          t: .type,
          p: .passed,
          rm: (.metrics.rngCalls.matched // 0),
          rt: (.metrics.rngCalls.total // 0),
          sm: (.metrics.screens.matched // 0),
          st: (.metrics.screens.total // 0),
          gm: (.metrics.grids.matched // 0),
          gt: (.metrics.grids.total // 0)
        }]
      }
    )) as $processed_raw |

    # Combine, strip internal fields, and sort by date
    ($processed_raw + [$backfilled[] | del(._fullhash)]) | sort_by(.date) | .[]
  ' "$TEMP_FILE" > "$OUTPUT_FILE"
  LINE_COUNT=$(wc -l < "$OUTPUT_FILE")
  echo "✅ Rebuilt results.jsonl with $LINE_COUNT entries"
else
  echo "⚠️  No test notes found, keeping existing results.jsonl"
fi
rm -f "$TEMP_FILE"

# Commit and push if results.jsonl changed
if ! git diff --quiet "$OUTPUT_FILE" 2>/dev/null; then
  git add "$OUTPUT_FILE"
  git commit --no-verify -m "Sync oracle/results.jsonl from test notes"
  echo "✅ Committed updated results.jsonl"

  if git push --no-verify 2>/dev/null; then
    echo "✅ Pushed"
  else
    echo "ℹ️  Could not push (try manually)"
  fi
else
  echo "ℹ️  results.jsonl is already up-to-date"
fi
