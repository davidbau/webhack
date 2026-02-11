# Evaluation Protocol for NetHack Agent Development

## Seed Sets

### Development Set (5 seeds)
**Seeds**: 1, 42, 100, 500, 777

**Allowed**:
- Analyze individual seed behavior
- Examine logs, coverage patterns, stuck locations
- Debug specific issues
- Tune parameters based on observations

**Purpose**: Development and debugging

### Test Set (10 seeds) - HELD-OUT
**Seeds**: 2, 5, 10, 50, 200, 1000, 2000, 3000, 5000, 7000

**PROHIBITED**:
- ❌ Never examine individual seed logs during development
- ❌ Never debug based on specific seed behavior
- ❌ Never tune parameters to fix specific test seeds

**Allowed**:
- ✓ View aggregate metrics only (median, mean, %)
- ✓ Use as unbiased performance measure

**Purpose**: Unbiased evaluation to detect overfitting

## Metrics to Track

### Primary Metric
- **Progression %**: (median_depth / 50) × 100
  - Target: >6.96% to beat SOTA

### Secondary Metrics
- **Dlvl 2+ Rate**: % reaching depth 2+
- **Dlvl 3+ Rate**: % reaching depth 3+
- **Coverage**: Average cells explored per seed
- **Secret Door Discovery**: % finding ≥1 secret door
- **Timeout Rate**: % timing out (should be 0%)

## Development Workflow

1. **Develop** on development set (5 seeds)
   - Analyze failures, tune parameters
   - Iterate until satisfied

2. **Evaluate** on held-out test set (10 seeds)
   - Run full benchmark
   - Only look at aggregate metrics
   - If performance good, commit

3. **Compare** test vs dev performance
   - Large gap = overfitting
   - Similar performance = generalizes well

4. **Iterate** if needed
   - Go back to step 1
   - Never look at individual test seed behavior

## Current Baseline (Held-Out Test Set)

- Progression: 2.00%
- Dlvl 2+: 10% (1/10 seeds)
- Coverage: 109 cells (6.5%)
- Secret doors: 0%
- Timeouts: 0%

**Status**: Below SOTA by 4.96 percentage points

