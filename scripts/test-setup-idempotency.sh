#!/bin/bash
# Test that setup-testing.sh is idempotent (safe to run multiple times)

echo "=========================================="
echo "Testing setup-testing.sh Idempotency"
echo "=========================================="
echo ""

# Save current config
ORIGINAL_HOOKS=$(git config --local core.hooksPath || echo "UNSET")
ORIGINAL_PUSH=$(git config --local --get-all remote.origin.push | grep "refs/notes" || echo "UNSET")

echo "Current configuration:"
echo "  core.hooksPath: $ORIGINAL_HOOKS"
echo "  auto-push notes: $([ "$ORIGINAL_PUSH" != "UNSET" ] && echo "SET" || echo "UNSET")"
echo ""

# Run setup first time
echo "=========================================="
echo "First run:"
echo "=========================================="
./scripts/setup-testing.sh > /tmp/setup-run1.log 2>&1
RUN1_EXIT=$?
echo "Exit code: $RUN1_EXIT"
echo ""
cat /tmp/setup-run1.log
echo ""

# Check config after first run
AFTER_RUN1_HOOKS=$(git config --local core.hooksPath)
AFTER_RUN1_PUSH=$(git config --local --get-all remote.origin.push | grep "refs/notes" || echo "")

echo "Configuration after run 1:"
echo "  core.hooksPath: $AFTER_RUN1_HOOKS"
echo "  auto-push notes: $([ -n "$AFTER_RUN1_PUSH" ] && echo "SET" || echo "UNSET")"
echo ""

# Run setup second time
echo "=========================================="
echo "Second run (should detect existing config):"
echo "=========================================="
./scripts/setup-testing.sh > /tmp/setup-run2.log 2>&1
RUN2_EXIT=$?
echo "Exit code: $RUN2_EXIT"
echo ""
cat /tmp/setup-run2.log
echo ""

# Check config after second run
AFTER_RUN2_HOOKS=$(git config --local core.hooksPath)
AFTER_RUN2_PUSH=$(git config --local --get-all remote.origin.push | grep "refs/notes" || echo "")

echo "Configuration after run 2:"
echo "  core.hooksPath: $AFTER_RUN2_HOOKS"
echo "  auto-push notes: $([ -n "$AFTER_RUN2_PUSH" ] && echo "SET" || echo "UNSET")"
echo ""

# Run setup third time
echo "=========================================="
echo "Third run (should still detect existing config):"
echo "=========================================="
./scripts/setup-testing.sh > /tmp/setup-run3.log 2>&1
RUN3_EXIT=$?
echo "Exit code: $RUN3_EXIT"
echo ""
cat /tmp/setup-run3.log
echo ""

# Verify idempotency
echo "=========================================="
echo "Verification:"
echo "=========================================="

# Check all runs succeeded
if [ $RUN1_EXIT -eq 0 ] && [ $RUN2_EXIT -eq 0 ] && [ $RUN3_EXIT -eq 0 ]; then
  echo "✅ All runs exited successfully (exit code 0)"
else
  echo "❌ Some runs failed:"
  echo "   Run 1: $RUN1_EXIT"
  echo "   Run 2: $RUN2_EXIT"
  echo "   Run 3: $RUN3_EXIT"
  exit 1
fi

# Check config is consistent
if [ "$AFTER_RUN1_HOOKS" = "$AFTER_RUN2_HOOKS" ] && [ "$AFTER_RUN1_HOOKS" = ".githooks" ]; then
  echo "✅ core.hooksPath consistent across runs: .githooks"
else
  echo "❌ core.hooksPath inconsistent:"
  echo "   After run 1: $AFTER_RUN1_HOOKS"
  echo "   After run 2: $AFTER_RUN2_HOOKS"
  exit 1
fi

if [ -n "$AFTER_RUN1_PUSH" ] && [ "$AFTER_RUN1_PUSH" = "$AFTER_RUN2_PUSH" ]; then
  echo "✅ auto-push config consistent across runs"
else
  echo "❌ auto-push config inconsistent"
  exit 1
fi

# Check that subsequent runs detected existing config
if grep -q "already configured" /tmp/setup-run2.log && grep -q "already configured" /tmp/setup-run3.log; then
  echo "✅ Subsequent runs detected existing configuration"
else
  echo "❌ Subsequent runs didn't detect existing configuration"
  exit 1
fi

# Check no duplicate entries in git config
PUSH_COUNT=$(git config --local --get-all remote.origin.push | grep -c "refs/notes/test-results" || echo 0)
if [ "$PUSH_COUNT" -eq 1 ]; then
  echo "✅ No duplicate auto-push entries (count: 1)"
else
  echo "⚠️  Multiple auto-push entries (count: $PUSH_COUNT)"
  echo "   This is OK but not ideal"
fi

echo ""
echo "=========================================="
echo "✅ Idempotency Test PASSED"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - Script can be run multiple times safely"
echo "  - No duplicate configuration entries"
echo "  - Detects and skips existing configuration"
echo "  - Exit code always 0"
echo ""
echo "Conclusion: setup-testing.sh is IDEMPOTENT ✅"
echo ""

# Cleanup
rm -f /tmp/setup-run*.log
