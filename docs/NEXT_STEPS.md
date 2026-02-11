# Next Steps for RNG Alignment

## Current Status
- **RNG Divergence:** Entry 551 (22.1% aligned: 551/2491)
- **Improvement:** +84 calls from entry 467 (+18% progress)
- **Test Suite:** 568/1811 passing

## Core Issue Identified

**Fundamental Path Difference:**
- **C:** Executes `dat/themerms.lua` → uses `nhl_random/nhl_rn2` (Lua RNG: 288 calls)
- **JS:** Executes `js/levels/themerms.js` → uses `rndmonst_adj` (C object RNG: 216 calls)

**Why This Matters:**
C's Lua code path uses different RNG functions than C's native object creation. Perfect alignment may require Lua RNG simulation, which I removed as "obsolete" - but C still executes Lua!

## Key Discrepancies

### 1. Monster Type Selection (+81 calls)
- `rndmonst_adj`: JS=216, C=135 (+81)
- `nhl_rn2`: JS=0, C=288 (-288)
- **Cause:** Lua uses `nh.random()`, JS uses `rndmonnum()` → different RNG functions

### 2. Corridor Generation (+121 calls)
- `dig_corridor`: JS=307, C=186 (+121)
- **Cause:** Unknown - could be algorithmic difference or retry logic

### 3. Object Creation Overhead (+57 calls)
- `mksobj_postinit`: JS=57, C=0 (+57)
- **Cause:** JS logging overhead or initialization differences

## Recommended Approach

### Option A: Accept Hybrid Alignment (Current)
**Pros:**
- Already achieved 22.1% alignment (significant progress)
- Avoids complex Lua simulation
- Code is cleaner and more maintainable

**Cons:**
- Can't achieve perfect alignment for themed rooms
- Some tests will always have discrepancies

### Option B: Implement Selective Lua RNG Simulation
**Approach:**
1. Keep native object creation for most cases
2. Add Lua RNG simulation ONLY for themed room object generation
3. Detect when des.object() is called from themed room vs special level

**Implementation:**
```javascript
// In des.object():
if (isThemedRoomContext()) {
    // Simulate Lua nh.random() behavior
    simulateLuaObjectCreation(name_or_opts);
} else {
    // Use direct C object creation (current approach)
    obj = mksobj(otyp, true, false);
}
```

**Pros:**
- Could achieve better alignment for themed rooms
- Matches C's actual execution path

**Cons:**
- More complex code
- Need to accurately simulate Lua behavior
- May introduce new bugs

### Option C: Focus on Other Alignment Opportunities
**Areas:**
1. Fix corridor generation differences (+121 calls)
2. Reduce object initialization overhead (+57 calls)
3. Investigate mineralize differences (-157 calls)
4. Fix niche generation differences (-14 calls)

## Immediate Actions

### 1. Document Current Achievement ✓
- Created comprehensive session summaries
- Documented all fixes with evidence
- Commits pushed to origin/main

### 2. Investigate Corridor Generation
**Question:** Why does JS call dig_corridor 121 more times?
- Check makecorridors algorithm
- Compare corridor retry logic
- Look for loop condition bugs (like themerms.js)

### 3. Test Suite Regression Analysis
**Goal:** Identify which 5 tests regressed
- Run test suite with detailed output
- Compare against baseline
- Determine if tests or implementation need fixing

### 4. Create Measurement Framework
**Track Progress:**
```javascript
// RNG alignment metrics
{
  divergencePoint: 551,
  alignmentPercent: 22.1,
  totalCalls: { js: 3005, c: 2924 },
  majorDiscrepancies: {
    rndmonst_adj: +81,
    dig_corridor: +121,
    nhl_rn2: -288
  }
}
```

## Long-Term Strategy

### Phase 1: Low-Hanging Fruit (Current)
- ✓ Fix loop condition bugs
- ✓ Remove truly obsolete code
- ✓ Fix timing issues (immediate object creation)

### Phase 2: Algorithmic Alignment
- Investigate corridor generation differences
- Fix mineralize discrepancies
- Align niche generation

### Phase 3: Lua Simulation (If Needed)
- Implement selective Lua RNG for themed rooms
- Create test harness to verify simulation accuracy
- Measure alignment improvement

### Phase 4: Test Suite Cleanup
- Fix or update regressed tests
- Add RNG alignment metrics to CI
- Document expected vs actual alignment

## Success Metrics

**Immediate (Next Session):**
- Divergence point: 551 → 600+ (+50 calls)
- Identify corridor generation root cause
- Resolve test regression

**Short Term (Next 3 Sessions):**
- Alignment: 22% → 30% (+8 percentage points)
- Reduce major discrepancies by 50%
- All tests passing or documented

**Long Term (Overall Goal):**
- Alignment: 30% → 50%+ (stretch goal)
- Understand and document all major RNG differences
- Stable test suite with no regressions

## Decision Points

**Question 1:** Should we implement Lua RNG simulation for themed rooms?
- **If Yes:** Better alignment, matches C behavior
- **If No:** Simpler code, accept hybrid alignment

**Question 2:** Should we prioritize test regression fixes over RNG alignment?
- **If Yes:** More stable baseline, easier to measure progress
- **If No:** Continue improving alignment, fix tests later

**Question 3:** Should we investigate corridor generation deeply?
- **If Yes:** Could yield significant alignment gains (+121 calls)
- **If No:** Complex subsystem, may not be worth effort

## Conclusion

Current work represents **solid, measurable progress** (18% improvement in alignment). The path forward depends on goals:

- **For maximum alignment:** Implement selective Lua RNG simulation
- **For code quality:** Continue current approach, fix algorithmic issues
- **For stability:** Fix test regression first, then resume alignment work

**Recommendation:** Fix corridor generation issue (potential +121 call improvement) as next high-value target, then reassess whether Lua simulation is needed.
