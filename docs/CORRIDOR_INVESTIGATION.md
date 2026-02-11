# Corridor Generation Investigation - 2026-02-10

## Issue
JS makes 121 extra RNG calls from dig_corridor() compared to C (307 vs 186)

## Investigation Summary

### Fix Attempted: finddpos() Return Value ❌ REVERTED
**Hypothesis:** JS's finddpos() was returning a coordinate object even when no valid position found, while C returns FALSE to prevent dig_corridor() calls.

**Fix Applied (Commit e4d6e46, REVERTED in 01f8c39):**
- Changed finddpos() to return `null` instead of `{x: x1, y: y1}` when no valid position found
- join() already checks `if (!cc || !tt) return` to skip dig_corridor() calls

**Result:**
- No change in corridor count (still 307 vs 186)
- **7-test regression** (574 → 567 passing tests)
- Fix reverted in commit 01f8c39

**Conclusion:**
The fix was incorrect. C's finddpos() returns FALSE but STILL SETS coordinates to (x1, y1). The difference is:
- C: When FALSE is returned, join() returns early (doesn't use coordinates)
- JS: When null is returned, join() crashes or skips corridors that SHOULD be created

The semantic difference is subtle: C's FALSE means "couldn't find ideal position, here's fallback coordinates" not "coordinates are invalid". JS needs to preserve this behavior by returning coordinates even in the failure case.

### Current Analysis

The +121 dig_corridor RNG calls must come from one of these sources:

#### 1. More dig_corridor() Function Calls
If JS calls dig_corridor() more times than C, each call contributes ~1-10 RNG calls depending on corridor length and parameters.

**Possible causes:**
- More join() calls in makecorridors() due to different room counts
- Different early-return behavior in join()
- Different needjoining flags on rooms

**How to test:**
```javascript
// Add counter in dig_corridor():
let digCorridorCallCount = 0;
function dig_corridor(...) {
    digCorridorCallCount++;
    // ... rest of function
}
```

#### 2. More Iterations Within dig_corridor()
Each iteration of the while loop in dig_corridor() makes multiple RNG calls:
- `!rn2(35)` - random abandonment (only when nxcor=true)
- `!rn2(dix-diy+1)` or `!rn2(diy-dix+1)` - direction randomization
- `maybe_sdoor(depth, 100)` - secret door check (calls !rn2(100))
- `!rn2(50)` - boulder placement (only when nxcor=true)

If JS corridors loop ~15-20 more times on average, that could account for 121 extra calls.

**Possible causes:**
- Different pathfinding behavior causing longer routes
- Different tile type states (STONE vs CORR vs ROOM) affecting navigation
- Off-by-one errors in termination condition

**How to test:**
```javascript
// Add iteration counter:
while (xx !== tx || yy !== ty) {
    iterationCount++;
    // ... rest of loop
}
```

#### 3. Different nxcor Distribution
The `nxcor` parameter controls extra RNG calls:
- When nxcor=true: calls `!rn2(35)` every iteration + `!rn2(50)` for boulders
- When nxcor=false: fewer RNG calls

**makecorridors() phases:**
- Phase 1-3: nxcor=false (necessary corridors)
- Phase 4: nxcor=true (extra corridors, `rn2(nroom) + 4` times)

**Possible causes:**
- Different nroom values between JS and C
- Phase 4 creating different number of extra corridors

**How to test:**
```bash
# Count makecorridors RNG calls:
grep "@ makecorridors" rng_log.txt | wc -l

# JS should have same count as C (18 calls expected)
```

#### 4. Different Room Layout
If JS creates rooms in different positions, corridors may need to be longer or take different paths.

**How to test:**
- Compare room coordinates between JS and C
- Check if room.needjoining flags match

### Comparison with C Code

**C dig_corridor() (sp_lev.c:2546-2660):**
```c
while (xx != tx || yy != ty) {
    if (cct++ > 500 || (nxcor && !rn2(35)))
        return FALSE;

    xx += dx; yy += dy;

    // Dig or check tile
    if (crm->typ == btyp) {
        if (ftyp == CORR && maybe_sdoor(100))
            crm->typ = SCORR;
        else
            crm->typ = ftyp;
        if (nxcor && !rn2(50))
            mksobj_at(BOULDER, xx, yy);
    }

    // Direction logic with rn2() calls...
}
```

**JS dig_corridor() (dungeon.js:1403-1526):**
Appears to match C logic exactly.

### Recommendations

**Priority 1: Count Function Calls**
Add instrumentation to count how many times dig_corridor() is actually called:
- Expected C: ~20-30 times (rough estimate)
- If JS significantly higher → investigate join() or makecorridors()

**Priority 2: Count Loop Iterations**
Add counters for total while loop iterations across all dig_corridor() calls:
- If JS has ~120+ extra iterations → investigate pathfinding/navigation

**Priority 3: Compare Room Counts**
Verify JS and C create same number of rooms:
```bash
grep "nroom" test_output.txt
# Should show map.nroom matching C's svn.nroom
```

**Priority 4: Trace makecorridors() Execution**
Log each join() call to see if JS makes more attempts:
```javascript
console.log(`join(${a}, ${b}, nxcor=${nxcor})`);
```

### Test Commands

```bash
# Generate RNG log with debugging:
DEBUG_CORRIDORS=1 node test/comparison/gen_rng_log.js 42 > js_rng.txt

# Compare corridor-specific calls:
grep "@ dig_corridor\|@ makecorridors\|@ join" js_rng.txt > corridors_js.txt
grep "@ dig_corridor\|@ makecorridors\|@ join" c_rng.txt > corridors_c.txt
diff corridors_c.txt corridors_js.txt
```

### Next Steps

1. Add function call counters to dig_corridor()
2. Add iteration counters to dig_corridor() while loop
3. Compare room counts and layouts between JS and C
4. If still unclear, add detailed tracing to makecorridors() phases
5. Consider that some discrepancy may be acceptable if functionality is correct

### Related Files
- `js/dungeon.js:1403-1526` - dig_corridor() implementation
- `js/dungeon.js:1524-1586` - join() implementation
- `js/dungeon.js:1588-1627` - makecorridors() implementation
- `nethack-c/src/sp_lev.c:2546-2660` - C dig_corridor()
- `nethack-c/src/mklev.c:429-508` - C join()
- `nethack-c/src/mklev.c:512-542` - C makecorridors()

### Historical Context
- Original divergence: Entry 551 (22.1% aligned)
- Expected dig_corridor improvement: +121 calls closer to C
- After finddpos fix: No change (finddpos rarely fails)
- Current status: Root cause still unknown, requires deeper tracing
