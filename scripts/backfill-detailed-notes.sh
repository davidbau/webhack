#!/bin/bash
# backfill-detailed-notes.sh
#
# Backfill detailed test notes for historical commits.
# Uses a robust approach that works across different project states.
#
# Usage:
#   scripts/backfill-detailed-notes.sh --commits 100 --sample 20
#   scripts/backfill-detailed-notes.sh --commits 1000 --code-only
#   scripts/backfill-detailed-notes.sh --commits 1000 --sample 50 --recent 100
#   scripts/backfill-detailed-notes.sh --commits 1000 --timeout 10  # 10s per-test timeout
#
# Options:
#   --commits N     Number of commits to process (from HEAD backwards)
#   --sample N      Run full tests every N commits (default: 1 = all)
#   --recent N      Always run full tests on most recent N commits (default: 0)
#   --timeout N     Per-test timeout in seconds (default: 0 = no timeout)
#   --code-only     Only collect code metrics, skip tests entirely
#   --dry-run       Show what would be done without executing
#   --output DIR    Write notes to files in DIR instead of git notes
#   --resume        Skip commits that already have notes/files
#   --verbose       Show detailed progress

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Defaults
COMMIT_COUNT=10
SAMPLE_RATE=1
RECENT_FULL=0
E2E_SAMPLE=0      # Run full E2E tests every N commits (0 = same as sample rate)
TEST_TIMEOUT=0    # Per-test timeout in seconds (0 = no timeout)
CODE_ONLY=false
DRY_RUN=false
OUTPUT_DIR=""
RESUME=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --commits) COMMIT_COUNT="$2"; shift 2 ;;
        --sample) SAMPLE_RATE="$2"; shift 2 ;;
        --recent) RECENT_FULL="$2"; shift 2 ;;
        --e2e-sample) E2E_SAMPLE="$2"; shift 2 ;;
        --timeout) TEST_TIMEOUT="$2"; shift 2 ;;
        --code-only) CODE_ONLY=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --output) OUTPUT_DIR="$2"; shift 2 ;;
        --resume) RESUME=true; shift ;;
        --verbose) VERBOSE=true; shift ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

# If e2e-sample not set, default to same as sample-rate
if [ "$E2E_SAMPLE" -eq 0 ]; then
    E2E_SAMPLE=$SAMPLE_RATE
fi

# Create output dir if specified
if [ -n "$OUTPUT_DIR" ]; then
    mkdir -p "$OUTPUT_DIR"
fi

# Copy scripts to temp location (they persist across checkouts)
TEMP_SCRIPTS=$(mktemp -d)
cp "$SCRIPT_DIR/collect-test-results.mjs" "$TEMP_SCRIPTS/"
cp "$SCRIPT_DIR/collect-code-metrics.sh" "$TEMP_SCRIPTS/"
chmod +x "$TEMP_SCRIPTS"/*.sh

# Get commit list (newest first)
echo "Getting commit list..." >&2
COMMITS=$(git rev-list HEAD -n "$COMMIT_COUNT")
COMMIT_ARRAY=($COMMITS)
TOTAL=${#COMMIT_ARRAY[@]}

echo "Processing $TOTAL commits" >&2
echo "  Sample rate: every $SAMPLE_RATE commits" >&2
echo "  E2E sample rate: every $E2E_SAMPLE commits" >&2
echo "  Recent full tests: $RECENT_FULL commits" >&2
echo "  Test timeout: ${TEST_TIMEOUT}s per test" >&2
echo "  Code only: $CODE_ONLY" >&2
echo "" >&2

# Save current HEAD
ORIGINAL_HEAD=$(git rev-parse HEAD)
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "detached")

# Cleanup function
cleanup() {
    echo "" >&2
    echo "Cleaning up..." >&2
    rm -rf "$TEMP_SCRIPTS"
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
TESTS_RUN=0
START_TIME=$(date +%s)

for i in "${!COMMIT_ARRAY[@]}"; do
    COMMIT="${COMMIT_ARRAY[$i]}"
    SHORT=$(git rev-parse --short "$COMMIT")
    INDEX=$((i + 1))

    # Check if already has note/file (resume mode)
    if [ "$RESUME" = true ]; then
        if [ -n "$OUTPUT_DIR" ] && [ -f "$OUTPUT_DIR/$SHORT.json" ]; then
            [ "$VERBOSE" = true ] && echo "[$INDEX/$TOTAL] $SHORT - already has file, skipping" >&2
            SKIPPED=$((SKIPPED + 1))
            continue
        fi
        if [ -z "$OUTPUT_DIR" ] && git notes --ref=test-results show "$COMMIT" >/dev/null 2>&1; then
            [ "$VERBOSE" = true ] && echo "[$INDEX/$TOTAL] $SHORT - already has note, skipping" >&2
            SKIPPED=$((SKIPPED + 1))
            continue
        fi
    fi

    # Determine if we should run tests for this commit
    RUN_TESTS=false
    RUN_E2E=false
    if [ "$CODE_ONLY" = false ]; then
        # Run tests if within "recent" window
        if [ "$i" -lt "$RECENT_FULL" ]; then
            RUN_TESTS=true
            RUN_E2E=true
        # Or if matches sample rate
        elif [ "$SAMPLE_RATE" -eq 1 ] || [ $((i % SAMPLE_RATE)) -eq 0 ]; then
            RUN_TESTS=true
            # Only run E2E if matches e2e sample rate
            if [ "$E2E_SAMPLE" -eq 1 ] || [ $((i % E2E_SAMPLE)) -eq 0 ]; then
                RUN_E2E=true
            fi
        fi
    fi

    # Get commit message for display
    MSG=$(git log -1 --format="%s" "$COMMIT" 2>/dev/null | head -c 40)

    if [ "$DRY_RUN" = true ]; then
        if [ "$RUN_TESTS" = true ] && [ "$RUN_E2E" = true ]; then
            echo "[$INDEX/$TOTAL] $SHORT - would run full tests: $MSG..." >&2
        elif [ "$RUN_TESTS" = true ]; then
            echo "[$INDEX/$TOTAL] $SHORT - would run unit tests only: $MSG..." >&2
        else
            echo "[$INDEX/$TOTAL] $SHORT - would collect code metrics: $MSG..." >&2
        fi
        continue
    fi

    echo "[$INDEX/$TOTAL] $SHORT - $MSG..." >&2

    # Checkout commit
    if ! git checkout "$COMMIT" --quiet 2>/dev/null; then
        echo "  ⚠️  Failed to checkout, skipping" >&2
        ERRORS=$((ERRORS + 1))
        continue
    fi

    # Collect code metrics (always works)
    PARENT=$(git rev-parse HEAD^ 2>/dev/null || echo "")
    CODE_METRICS=$("$TEMP_SCRIPTS/collect-code-metrics.sh" "$PARENT" "$COMMIT" 2>/dev/null || echo '{"filesChanged":0,"linesAdded":0,"linesRemoved":0}')

    # Check for test infrastructure
    HAS_TESTS=false
    if [ -d "test" ] && [ -f "package.json" ]; then
        HAS_TESTS=true
    fi

    # Get commit info
    COMMIT_DATE=$(git show -s --format=%cI HEAD)
    AUTHOR=$(git show -s --format="%an" HEAD)
    MESSAGE=$(git show -s --format=%s HEAD | sed 's/"/\\"/g' | head -c 200)

    STATS='{"total":0,"pass":0,"fail":0,"skip":0,"duration":0}'
    CATEGORIES='{}'
    SESSIONS='{}'
    TEST_ERROR=""

    if [ "$RUN_TESTS" = true ] && [ "$HAS_TESTS" = true ]; then
        # Install dependencies if needed
        if [ ! -d "node_modules" ]; then
            [ "$VERBOSE" = true ] && echo "  Installing dependencies..." >&2
            npm install --silent 2>/dev/null || {
                TEST_ERROR="npm_install_failed"
                HAS_TESTS=false
            }
        fi

        if [ "$HAS_TESTS" = true ]; then
            if [ "$RUN_E2E" = true ]; then
                [ "$VERBOSE" = true ] && echo "  Running full tests (with E2E)..." >&2
                TEST_ARGS="--summary"
            else
                [ "$VERBOSE" = true ] && echo "  Running unit tests only..." >&2
                TEST_ARGS="--summary --unit-only"
            fi
            # Add timeout if specified
            if [ "$TEST_TIMEOUT" -gt 0 ]; then
                TEST_ARGS="$TEST_ARGS --timeout=$TEST_TIMEOUT"
            fi
            TEST_OUTPUT=$(mktemp)
            TEST_STDERR=$(mktemp)

            # Run from repo root
            if REPO_ROOT="$(pwd)" node "$TEMP_SCRIPTS/collect-test-results.mjs" $TEST_ARGS > "$TEST_OUTPUT" 2>"$TEST_STDERR"; then
                if jq -e . "$TEST_OUTPUT" > /dev/null 2>&1; then
                    STATS=$(jq -c '.stats // {}' "$TEST_OUTPUT")
                    CATEGORIES=$(jq -c '.categories // {}' "$TEST_OUTPUT")
                    SESSIONS=$(jq -c '.sessions // {}' "$TEST_OUTPUT")

                    PASS=$(echo "$STATS" | jq -r '.pass // 0')
                    FAIL=$(echo "$STATS" | jq -r '.fail // 0')
                    if [ "$RUN_E2E" = true ]; then
                        echo "  ✅ $PASS pass, $FAIL fail (full)" >&2
                    else
                        echo "  ✅ $PASS pass, $FAIL fail (unit-only)" >&2
                    fi
                    TESTS_RUN=$((TESTS_RUN + 1))
                else
                    TEST_ERROR="invalid_json"
                fi
            else
                TEST_ERROR="test_failed"
            fi
            rm -f "$TEST_OUTPUT" "$TEST_STDERR"
        fi
    elif [ "$RUN_TESTS" = false ]; then
        echo "  📊 code metrics" >&2
    else
        echo "  📊 code metrics (no test infrastructure)" >&2
    fi

    # Build note JSON using jq
    NOTE=$(jq -n \
        --argjson version 2 \
        --arg commit "$SHORT" \
        --arg date "$COMMIT_DATE" \
        --arg author "$AUTHOR" \
        --arg message "$MESSAGE" \
        --argjson stats "$STATS" \
        --argjson categories "$CATEGORIES" \
        --argjson sessions "$SESSIONS" \
        --argjson codeMetrics "$CODE_METRICS" \
        --argjson hasTests "$HAS_TESTS" \
        --arg testError "$TEST_ERROR" \
        '{
            version: $version,
            commit: $commit,
            date: $date,
            author: $author,
            message: $message,
            stats: $stats,
            categories: $categories,
            sessions: $sessions,
            codeMetrics: $codeMetrics,
            hasTests: $hasTests,
            testError: (if $testError == "" then null else $testError end)
        }')

    # Save note
    if [ -n "$OUTPUT_DIR" ]; then
        echo "$NOTE" > "$OUTPUT_DIR/$SHORT.json"
    else
        echo "$NOTE" | git notes --ref=test-results add -f -F - "$COMMIT" 2>/dev/null || {
            echo "  ⚠️  Failed to save note" >&2
            ERRORS=$((ERRORS + 1))
        }
    fi

    PROCESSED=$((PROCESSED + 1))
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "" >&2
echo "======================================" >&2
echo "Summary:" >&2
echo "  Processed: $PROCESSED commits" >&2
echo "  Skipped:   $SKIPPED commits" >&2
echo "  Errors:    $ERRORS" >&2
echo "  Tests run: $TESTS_RUN commits" >&2
echo "  Duration:  ${DURATION}s" >&2
echo "======================================" >&2

if [ -n "$OUTPUT_DIR" ]; then
    echo "" >&2
    echo "Output files in: $OUTPUT_DIR" >&2
    ls -la "$OUTPUT_DIR"/*.json 2>/dev/null | wc -l | xargs echo "  Total files:"
fi
