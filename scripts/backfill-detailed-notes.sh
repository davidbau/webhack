#!/bin/bash
# backfill-detailed-notes.sh
#
# Backfill detailed test notes for historical commits.
#
# Usage:
#   scripts/backfill-detailed-notes.sh --commits 5 --sample 1
#   scripts/backfill-detailed-notes.sh --commits 1000 --code-only
#   scripts/backfill-detailed-notes.sh --commits 1000 --sample 50
#
# Options:
#   --commits N     Number of commits to process (from HEAD backwards)
#   --sample N      Run full tests every N commits (default: 1 = all)
#   --code-only     Only collect code metrics, skip tests entirely
#   --dry-run       Show what would be done without executing
#   --output DIR    Write notes to files in DIR instead of git notes
#   --resume        Skip commits that already have notes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Defaults
COMMIT_COUNT=10
SAMPLE_RATE=1
CODE_ONLY=false
DRY_RUN=false
OUTPUT_DIR=""
RESUME=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --commits)
            COMMIT_COUNT="$2"
            shift 2
            ;;
        --sample)
            SAMPLE_RATE="$2"
            shift 2
            ;;
        --code-only)
            CODE_ONLY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --resume)
            RESUME=true
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Create output dir if specified
if [ -n "$OUTPUT_DIR" ]; then
    mkdir -p "$OUTPUT_DIR"
fi

# Get commit list (newest first)
echo "Getting commit list..." >&2
COMMITS=$(git rev-list HEAD -n "$COMMIT_COUNT")
COMMIT_ARRAY=($COMMITS)
TOTAL=${#COMMIT_ARRAY[@]}

echo "Processing $TOTAL commits (sample rate: $SAMPLE_RATE)" >&2
echo "" >&2

# Save current HEAD
ORIGINAL_HEAD=$(git rev-parse HEAD)
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "detached")

# Cleanup function
cleanup() {
    echo "" >&2
    echo "Restoring to $ORIGINAL_BRANCH..." >&2
    if [ "$ORIGINAL_BRANCH" = "detached" ]; then
        git checkout "$ORIGINAL_HEAD" --quiet 2>/dev/null || true
    else
        git checkout "$ORIGINAL_BRANCH" --quiet 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Process each commit
PROCESSED=0
SKIPPED=0
ERRORS=0

for i in "${!COMMIT_ARRAY[@]}"; do
    COMMIT="${COMMIT_ARRAY[$i]}"
    SHORT=$(git rev-parse --short "$COMMIT")
    INDEX=$((i + 1))

    # Check if already has note (resume mode)
    if [ "$RESUME" = true ]; then
        if git notes --ref=test-results show "$COMMIT" >/dev/null 2>&1; then
            echo "[$INDEX/$TOTAL] $SHORT - already has note, skipping" >&2
            SKIPPED=$((SKIPPED + 1))
            continue
        fi
    fi

    # Determine if we should run tests for this commit
    RUN_TESTS=true
    if [ "$CODE_ONLY" = true ]; then
        RUN_TESTS=false
    elif [ "$SAMPLE_RATE" -gt 1 ]; then
        if [ $((i % SAMPLE_RATE)) -ne 0 ]; then
            RUN_TESTS=false
        fi
    fi

    # Get commit message for display
    MSG=$(git log -1 --format="%s" "$COMMIT" | head -c 50)

    if [ "$DRY_RUN" = true ]; then
        if [ "$RUN_TESTS" = true ]; then
            echo "[$INDEX/$TOTAL] $SHORT - would run tests: $MSG" >&2
        else
            echo "[$INDEX/$TOTAL] $SHORT - would collect code metrics only: $MSG" >&2
        fi
        continue
    fi

    echo "[$INDEX/$TOTAL] $SHORT - $MSG" >&2

    # Checkout commit
    git checkout "$COMMIT" --quiet 2>/dev/null || {
        echo "  ⚠️  Failed to checkout, skipping" >&2
        ERRORS=$((ERRORS + 1))
        continue
    }

    # Check if test infrastructure exists
    HAS_TESTS=true
    if [ ! -d "test" ] || [ ! -f "package.json" ]; then
        HAS_TESTS=false
    fi

    # Generate note
    NOTE_FILE=$(mktemp)
    if [ "$RUN_TESTS" = true ] && [ "$HAS_TESTS" = true ]; then
        # Full test run
        if timeout 600 "$SCRIPT_DIR/generate-detailed-note.sh" --allow-regression > "$NOTE_FILE" 2>/dev/null; then
            echo "  ✅ Tests completed" >&2
        else
            echo "  ⚠️  Tests failed, collecting code metrics only" >&2
            "$SCRIPT_DIR/generate-detailed-note.sh" --code-only > "$NOTE_FILE" 2>/dev/null || {
                echo "  ❌ Failed to generate note" >&2
                ERRORS=$((ERRORS + 1))
                rm -f "$NOTE_FILE"
                continue
            }
        fi
    else
        # Code metrics only
        if "$SCRIPT_DIR/generate-detailed-note.sh" --code-only > "$NOTE_FILE" 2>/dev/null; then
            echo "  📊 Code metrics only" >&2
        else
            echo "  ❌ Failed to generate note" >&2
            ERRORS=$((ERRORS + 1))
            rm -f "$NOTE_FILE"
            continue
        fi
    fi

    # Save note
    if [ -n "$OUTPUT_DIR" ]; then
        mv "$NOTE_FILE" "$OUTPUT_DIR/$SHORT.json"
    else
        cat "$NOTE_FILE" | git notes --ref=test-results add -f -F - "$COMMIT" 2>/dev/null || {
            echo "  ⚠️  Failed to save note" >&2
            ERRORS=$((ERRORS + 1))
        }
        rm -f "$NOTE_FILE"
    fi

    PROCESSED=$((PROCESSED + 1))
done

echo "" >&2
echo "Summary:" >&2
echo "  Processed: $PROCESSED" >&2
echo "  Skipped:   $SKIPPED" >&2
echo "  Errors:    $ERRORS" >&2
