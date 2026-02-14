#!/bin/bash
# test-5-commits.sh
#
# Test the detailed notes system on 5 representative commits from history.
#
# Commits selected:
#   #50   7ee0e41 - Early (first 50 commits)
#   #300  ef373e0 - Early-mid
#   #650  91fe4a0 - Mid
#   #1000 3915bfa - Late-mid
#   #1300 74f8436 - Recent

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

OUTPUT_DIR="${1:-/tmp/mazesofmenace-notes}"
mkdir -p "$OUTPUT_DIR"

# Define test commits (hash, commit number, description)
COMMITS=(
    "7ee0e41:50:Early"
    "ef373e0:300:Early-mid"
    "91fe4a0:650:Mid"
    "3915bfa:1000:Late-mid"
    "74f8436:1300:Recent"
)

# Save current state
ORIGINAL_HEAD=$(git rev-parse HEAD)
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "detached")

cleanup() {
    echo ""
    echo "Restoring to original state..."
    if [ "$ORIGINAL_BRANCH" = "detached" ]; then
        git checkout "$ORIGINAL_HEAD" --quiet 2>/dev/null || true
    else
        git checkout "$ORIGINAL_BRANCH" --quiet 2>/dev/null || true
    fi
}
trap cleanup EXIT

echo "Testing detailed notes on 5 representative commits"
echo "Output directory: $OUTPUT_DIR"
echo ""

RESULTS_LOG="$OUTPUT_DIR/test-run.log"
> "$RESULTS_LOG"

for entry in "${COMMITS[@]}"; do
    IFS=':' read -r HASH NUM DESC <<< "$entry"

    echo "=============================================="
    echo "Commit #$NUM ($DESC): $HASH"
    echo "=============================================="

    # Get full commit info
    MSG=$(git log -1 --format="%s" "$HASH" 2>/dev/null | head -c 60)
    DATE=$(git log -1 --format="%ci" "$HASH" 2>/dev/null | head -c 10)
    echo "Date: $DATE"
    echo "Message: $MSG"
    echo ""

    # Checkout the commit
    echo "Checking out..."
    if ! git checkout "$HASH" --quiet 2>/dev/null; then
        echo "❌ Failed to checkout commit"
        echo "$HASH,#$NUM,$DESC,checkout_failed" >> "$RESULTS_LOG"
        continue
    fi

    # Check for test infrastructure
    if [ ! -d "test" ]; then
        echo "⚠️  No test directory exists"
        echo "Collecting code metrics only..."

        if "$SCRIPT_DIR/generate-detailed-note.sh" --code-only > "$OUTPUT_DIR/$HASH.json" 2>/dev/null; then
            echo "✅ Code metrics collected"
            echo "$HASH,#$NUM,$DESC,code_only" >> "$RESULTS_LOG"
        else
            echo "❌ Failed to collect code metrics"
            echo "$HASH,#$NUM,$DESC,failed" >> "$RESULTS_LOG"
        fi
        echo ""
        continue
    fi

    if [ ! -f "package.json" ]; then
        echo "⚠️  No package.json exists"
        echo "Collecting code metrics only..."

        if "$SCRIPT_DIR/generate-detailed-note.sh" --code-only > "$OUTPUT_DIR/$HASH.json" 2>/dev/null; then
            echo "✅ Code metrics collected"
            echo "$HASH,#$NUM,$DESC,code_only" >> "$RESULTS_LOG"
        else
            echo "❌ Failed to collect code metrics"
            echo "$HASH,#$NUM,$DESC,failed" >> "$RESULTS_LOG"
        fi
        echo ""
        continue
    fi

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install --silent 2>/dev/null || {
            echo "⚠️  npm install failed, trying code metrics only"
            if "$SCRIPT_DIR/generate-detailed-note.sh" --code-only > "$OUTPUT_DIR/$HASH.json" 2>/dev/null; then
                echo "✅ Code metrics collected"
                echo "$HASH,#$NUM,$DESC,code_only_npm_failed" >> "$RESULTS_LOG"
            fi
            continue
        }
    fi

    # Run full test collection
    echo "Running tests..."
    START_TIME=$(date +%s)

    if "$SCRIPT_DIR/generate-detailed-note.sh" --allow-regression > "$OUTPUT_DIR/$HASH.json" 2>&1; then
        END_TIME=$(date +%s)
        DURATION=$((END_TIME - START_TIME))

        # Extract summary from result
        PASS=$(jq -r '.stats.pass // 0' "$OUTPUT_DIR/$HASH.json")
        FAIL=$(jq -r '.stats.fail // 0' "$OUTPUT_DIR/$HASH.json")
        TOTAL=$(jq -r '.stats.total // 0' "$OUTPUT_DIR/$HASH.json")

        echo "✅ Tests completed in ${DURATION}s"
        echo "   Results: $PASS pass, $FAIL fail, $TOTAL total"
        echo "$HASH,#$NUM,$DESC,full_tests,$PASS,$FAIL,$TOTAL,$DURATION" >> "$RESULTS_LOG"
    else
        echo "⚠️  Test run failed, trying code metrics only"
        if "$SCRIPT_DIR/generate-detailed-note.sh" --code-only > "$OUTPUT_DIR/$HASH.json" 2>/dev/null; then
            echo "✅ Code metrics collected"
            echo "$HASH,#$NUM,$DESC,code_only_tests_failed" >> "$RESULTS_LOG"
        else
            echo "❌ Failed to collect any data"
            echo "$HASH,#$NUM,$DESC,failed" >> "$RESULTS_LOG"
        fi
    fi

    echo ""
done

echo "=============================================="
echo "Summary"
echo "=============================================="
cat "$RESULTS_LOG"
echo ""
echo "Output files in: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"/*.json 2>/dev/null || echo "No output files generated"
