# Plan: Collect Normal Themed Room Sessions

**Goal:** Generate test sessions with normal themed room reservoir sampling (THEMERM debug mode disabled) to verify both code paths work correctly in JS.

**Created:** 2026-02-10
**Status:** Planning

---

## Background

All current C test sessions appear to have been generated with THEMERM debug mode enabled (wizard mode + env vars set). This means:
- Normal dungeons skip reservoir sampling (~30 RNG calls per themed room)
- We only test ONE code path (debug mode)
- We cannot verify that normal reservoir sampling works correctly in JS

To fully validate the JS implementation, we need **paired sessions**:
1. **Debug mode sessions** (current) - THEMERM set, reservoir sampling skipped
2. **Normal mode sessions** (NEW) - THEMERM unset, full reservoir sampling

---

## Requirements

### What We Need

Sessions that satisfy:
1. ✅ **Contains normal dungeon levels** (uses `makerooms()`, not just special levels)
2. ✅ **THEMERM/THEMERMFILL explicitly unset** during generation
3. ✅ **Full RNG traces** to verify reservoir sampling pattern
4. ✅ **Metadata indicating debug mode status** in session JSON
5. ✅ **Same seeds as existing sessions** for direct comparison

### What Success Looks Like

For a normal dungeon level (e.g., seed16 depth 1), the RNG trace should show:
```
Call 1-3:   rn2(2) @ makerooms
Call 4-33:  rn2(1000-1036) @ nhl_rn2  [MT init]
Call 34-63: rn2(1) @ nhl_rn2          [Reservoir sampling starts!]
            rn2(2) @ nhl_rn2
            rn2(3) @ nhl_rn2
            ... ~30 calls with increasing arguments
Call 64:    rn2(100) @ build_room
```

This pattern is **MISSING from all current sessions** - they all skip calls 34-63.

---

## Implementation Plan

### Phase 1: Modify C Harness Generator

**File:** `test/comparison/c-harness/gen_map_sessions.py`

**Changes:**
1. Add `--no-debug-themerm` flag to explicitly disable debug mode
2. Add `debugThemerm` metadata field to session JSON
3. Modify shell command to unset env vars when flag is used

**Code changes:**

```python
def generate_one(seed, max_depth, with_rng, output_filename=None, debug_themerm=False):
    """Generate a single C map session for the given seed.

    Args:
        debug_themerm: If False, explicitly unset THEMERM/THEMERMFILL (default)
                      If True, allow debug mode (for backward compatibility)
    """
    # ... existing setup ...

    # Build the shell command
    rnglog_env = f'NETHACK_RNGLOG={rng_log_file} ' if with_rng else ''

    # CRITICAL: Control debug themed room mode
    if debug_themerm:
        # Allow debug mode (env vars may be inherited)
        themerm_cmd = ''
    else:
        # Explicitly disable debug mode for normal reservoir sampling
        themerm_cmd = 'unset THEMERM THEMERMFILL; '

    cmd = (
        f'{themerm_cmd}'  # ← NEW: Control debug mode
        f'NETHACKDIR={INSTALL_DIR} '
        f'NETHACK_SEED={seed} '
        f'NETHACK_DUMPMAP={dumpmap_file} '
        f'{rnglog_env}'
        f'HOME={RESULTS_DIR} '
        f'TERM=xterm-256color '
        f'{NETHACK_BINARY} -u Wizard -D; '
        f'sleep 999'
    )

    # ... existing generation code ...

    # Build the session JSON
    session = {
        'version': 2,
        'seed': int(seed),
        'type': 'map',
        'source': 'c',
        'wizard': True,  # Always true (uses -D flag)
        'debugThemerm': debug_themerm,  # ← NEW: Document debug mode status
        'levels': levels,
    }

    # ... existing write code ...
```

**CLI interface:**

```python
def main():
    # ... existing arg parsing ...

    if '--from-config' in args:
        # Generate BOTH normal and debug versions
        config = load_seeds_config()
        c_rng_seeds = config['map_seeds']['with_rng']['c']

        print(f"Generating NORMAL mode sessions for seeds: {c_rng_seeds}")
        for seed in c_rng_seeds:
            # Normal mode (reservoir sampling)
            generate_one(str(seed), max_depth=5, with_rng=True,
                        debug_themerm=False,
                        output_filename=f'seed{seed}_maps_c_normal.session.json')

        print(f"Generating DEBUG mode sessions for seeds: {c_rng_seeds}")
        for seed in c_rng_seeds:
            # Debug mode (skip reservoir sampling) - for backward compat
            generate_one(str(seed), max_depth=5, with_rng=True,
                        debug_themerm=True,
                        output_filename=f'seed{seed}_maps_c_debug.session.json')
        return

    # ... existing single-seed generation ...
    debug_themerm = '--debug-themerm' in args
    generate_one(seed, max_depth, with_rng, debug_themerm=debug_themerm)
```

### Phase 2: Generate Paired Sessions

**Naming convention:**
- `seed{N}_maps_c_normal.session.json` - Normal reservoir sampling
- `seed{N}_maps_c_debug.session.json` - Debug mode (current behavior)
- `seed{N}_maps_c.session.json` - Legacy (ambiguous, should be deprecated)

**Seeds to generate:**
```bash
cd test/comparison/c-harness

# Generate BOTH versions for all map seeds
python3 gen_map_sessions.py --from-config

# Result:
# - seed16_maps_c_normal.session.json (NEW)
# - seed16_maps_c_debug.session.json (NEW)
# - seed72_maps_c_normal.session.json (NEW)
# - seed72_maps_c_debug.session.json (NEW)
# ... etc for all 5 seeds
```

**Expected differences:**
For seed16 depth 1 (normal dungeon):
- **Debug version:** ~2500 RNG calls
- **Normal version:** ~2560 RNG calls (+60 from 2 themed rooms × 30 reservoir calls each)

### Phase 3: Update JS Test Infrastructure

**File:** `test/comparison/session_test_runner.js` (or new test file)

**Changes:**
1. Read `session.debugThemerm` metadata
2. Set `process.env.THEMERM` accordingly before running test
3. Test BOTH versions of each seed

**Code:**

```javascript
function setupDebugMode(session) {
    if (session.debugThemerm) {
        // Debug mode: set env vars to trigger debug path
        process.env.THEMERM = '';
        process.env.THEMERMFILL = '';
    } else {
        // Normal mode: ensure env vars are unset
        delete process.env.THEMERM;
        delete process.env.THEMERMFILL;
    }
}

describe('Themed room mode tests', () => {
    const seeds = [16, 72, 119, 163, 306];

    for (const seed of seeds) {
        describe(`Seed ${seed}`, () => {
            it('Normal mode (reservoir sampling)', () => {
                const session = loadSession(`seed${seed}_maps_c_normal.session.json`);
                setupDebugMode(session);  // Unset THEMERM

                const result = runMapTest(session);

                // Verify reservoir sampling happened
                const depth1Rng = result.levels[0].rng;
                const hasReservoirSampling = depth1Rng.some(call =>
                    call.includes('nhl_rn2') &&
                    parseInt(call.match(/rn2\((\d+)\)/)[1]) < 100 &&
                    parseInt(call.match(/rn2\((\d+)\)/)[1]) > 10
                );
                expect(hasReservoirSampling).toBe(true);

                expect(result).toMatchSession(session);
            });

            it('Debug mode (skip reservoir sampling)', () => {
                const session = loadSession(`seed${seed}_maps_c_debug.session.json`);
                setupDebugMode(session);  // Set THEMERM=''

                const result = runMapTest(session);

                // Verify reservoir sampling was skipped
                const depth1Rng = result.levels[0].rng;
                const hasReservoirSampling = depth1Rng.some(call =>
                    call.includes('nhl_rn2') &&
                    parseInt(call.match(/rn2\((\d+)\)/)[1]) < 100 &&
                    parseInt(call.match(/rn2\((\d+)\)/)[1]) > 10
                );
                expect(hasReservoirSampling).toBe(false);

                expect(result).toMatchSession(session);
            });
        });
    }
});
```

### Phase 4: Validate Both Code Paths

**Manual verification:**

```bash
# Check normal mode session has reservoir sampling
cat test/comparison/maps/seed16_maps_c_normal.session.json | \
    jq -r '.levels[0].rng[]' | \
    grep "nhl_rn2.*930" | \
    awk '{match($0, /rn2\(([0-9]+)\)/, a); print a[1]}' | \
    head -50

# Expected output should include sequence like:
# 1000, 1001, 1002, ..., 1036  (MT init)
# 1, 2, 3, 4, 5, ... ~30       (Reservoir sampling!)
# Then build_room calls

# Check debug mode session skips reservoir sampling
cat test/comparison/maps/seed16_maps_c_debug.session.json | \
    jq -r '.levels[0].rng[]' | \
    grep "nhl_rn2.*930" | \
    awk '{match($0, /rn2\(([0-9]+)\)/, a); print a[1]}' | \
    head -50

# Expected output:
# 1000, 1001, 1002, ..., 1036  (MT init)
# 3, 2, 3, 2, ...              (Small Lua calls, NOT reservoir sampling)
# Then build_room calls
```

**Automated validation:**

```javascript
function validateReservoirSampling(session) {
    const level = session.levels[0];
    const nhlRn2Calls = level.rng
        .filter(call => call.includes('nhl_rn2(nhlua.c:930)'))
        .map(call => parseInt(call.match(/rn2\((\d+)\)/)[1]));

    // Find MT init end (last 1036 call)
    const mtEndIndex = nhlRn2Calls.lastIndexOf(1036);

    // Check next ~30 calls after MT init
    const postMtCalls = nhlRn2Calls.slice(mtEndIndex + 1, mtEndIndex + 31);

    // Reservoir sampling pattern: increasing small numbers (1, 2, 3, ...)
    // Debug mode pattern: repeated small numbers (3, 2, 3, 2, ...)
    const isIncreasing = postMtCalls.some((val, i) =>
        i > 0 && val > postMtCalls[i-1] && val < 50
    );

    return {
        hasReservoirSampling: isIncreasing,
        postMtPattern: postMtCalls,
    };
}
```

---

## Testing Strategy

### Baseline Verification
1. ✅ Verify current sessions ARE debug mode (check RNG traces)
2. ✅ Generate one normal mode session (seed16)
3. ✅ Verify it shows reservoir sampling pattern
4. ✅ Run JS test with THEMERM unset - should FAIL (different RNG count)
5. ✅ Fix any JS bugs revealed by normal mode
6. ✅ Run JS test again - should PASS

### Full Rollout
1. Generate all 5 seeds × 2 modes = 10 new session files
2. Update test suite to test both modes
3. Verify all 10 sessions pass their respective tests
4. Document which sessions use which mode
5. Update MEMORY.md with new test status

### Regression Prevention
1. Add CI check that validates session metadata
2. Fail if session has `debugThemerm` field missing
3. Fail if JS test doesn't set env vars correctly
4. Add linter rule to prevent accidental THEMERM usage

---

## Expected Discoveries

Generating normal mode sessions may reveal:

### Potential JS Bugs
- Reservoir sampling logic errors (off-by-one, wrong total_frequency)
- Themed room frequency values incorrect
- Eligibility checks not matching C
- MT initialization timing issues

### Themed Room Selection Differences
Normal mode will show WHICH themed rooms are selected:
- Debug mode: always "default" room (or forced room)
- Normal mode: actual probabilistic selection based on frequency

This may reveal:
- Themed room frequency mismatches between C and JS
- Eligibility function differences
- level_difficulty() calculation errors

### Performance Insights
- How much slower is reservoir sampling? (30 extra RNG calls per room)
- Does it affect test execution time significantly?

---

## Risk Mitigation

### Backward Compatibility
- Keep existing `seed*_map.session.json` files untouched
- Add new files with explicit suffixes (`_normal`, `_debug`)
- Tests default to debug mode if metadata missing
- Gradual migration, not breaking change

### Test Isolation
- Ensure THEMERM env vars don't leak between tests
- Clear env vars in `afterEach()` hooks
- Validate env state before each test

### Documentation
- Update all docs to explain both modes
- Add comments in test files explaining why THEMERM is set
- Create troubleshooting guide for RNG mismatches

---

## Timeline

### Week 1: Implement (2026-02-10 onwards)
- ✅ Day 1: Implement `nh.debug_themerm()` in JS (DONE)
- ✅ Day 1: Create warning documentation (DONE)
- Day 2: Modify gen_map_sessions.py with --no-debug-themerm flag
- Day 2: Generate seed16 normal + debug sessions
- Day 3: Validate seed16 shows expected patterns

### Week 2: Validate
- Day 1: Run JS tests on seed16 normal mode
- Day 2: Fix any JS bugs discovered
- Day 3: Generate all 10 session files (5 seeds × 2 modes)
- Day 4: Run full test suite
- Day 5: Document results

### Week 3: Integration
- Update test infrastructure to handle both modes
- Add metadata validation
- Update CI pipeline
- Final documentation

---

## Success Criteria

✅ **Complete when:**
1. We have paired sessions (normal + debug) for all 5 map seeds
2. JS tests pass for BOTH modes
3. We can toggle between modes via env var or metadata
4. Documentation explains both modes clearly
5. CI enforces proper env var usage

✅ **Evidence of success:**
- Reservoir sampling pattern visible in normal mode traces
- RNG call counts differ by ~60 calls (2 rooms × 30 calls) between modes
- Both test suites show 100% pass rate
- No accidental mixing of modes

---

## Files to Create/Modify

### New Files
- ✅ `docs/bugs/THEMERM_DEBUG_MODE_SESSIONS.md` (DONE)
- ✅ `docs/plans/COLLECT_NORMAL_THEMED_ROOM_SESSIONS.md` (THIS FILE)
- `test/comparison/maps/seed*_maps_c_normal.session.json` (5 files)
- `test/comparison/maps/seed*_maps_c_debug.session.json` (5 files)

### Modified Files
- ✅ `js/sp_lev.js` - Add `nh.debug_themerm()` (DONE)
- ✅ `MEMORY.md` - Update with correct understanding (DONE)
- `test/comparison/c-harness/gen_map_sessions.py` - Add debug mode control
- `test/comparison/session_test_runner.js` - Handle both modes
- `test/comparison/seeds.json` - Add normal mode seed list

---

## Questions to Resolve

1. **Should we keep legacy sessions?**
   - Option A: Keep `seed*_map.session.json` for backward compat
   - Option B: Delete and force migration to explicit modes
   - **Recommendation:** Keep for now, deprecate later

2. **What about gameplay sessions?**
   - Do they also need normal mode versions?
   - Likely yes, but map sessions are higher priority
   - **Recommendation:** Start with map sessions, extend to gameplay later

3. **Should THEMERM be set at session load or test start?**
   - Option A: Session loader sets env vars based on metadata
   - Option B: Test runner sets env vars before each test
   - **Recommendation:** Test runner (more explicit control)

4. **How to handle existing test pass rates?**
   - Current 90.2% pass rate is for debug mode
   - Normal mode might have lower initial pass rate
   - **Recommendation:** Track separately, don't regress debug mode

---

## Related Documentation

- `docs/bugs/THEMERM_DEBUG_MODE_SESSIONS.md` - Comprehensive debug mode explanation
- `docs/notes/special_vs_normal_dungeons.md` - Level generation types
- `MEMORY.md` - Test status and key patterns

---

**Next Steps:** Implement Phase 1 (modify gen_map_sessions.py) and generate first paired session for validation.
