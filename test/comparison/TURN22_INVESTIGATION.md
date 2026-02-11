# Turn 22 RNG Divergence Investigation (2026-02-10)

## Problem Statement

seed1_gameplay test: RNG diverges at turn 22, first failing step after 21 perfect steps (0-21).

## Key Findings

### Turn 21: PERFECT MATCH ✓
- Pet has meating=2→1 (still eating, started at turn 18)
- Pet stays at (62,3), doesn't call dog_move
- RNG trace matches C exactly
- 4 distfleeck calls (2 iterations × 2 per iteration)

### Turn 22: DIVERGENCE ✗

**Expected (C):**
```
0: rn2(5)=0 @ distfleeck          (iteration 1 start)
1: rn2(100)=15 @ obj_resists      ← C CALLS THIS
2: rn2(4)=3 @ dog_goal
3: rn2(12)=9 @ dog_move
4: rn2(12)=0 @ dog_move
5: rn2(5)=4 @ distfleeck          (iteration 1 end)
6: rn2(5)=4 @ distfleeck          (iteration 2 start)
7: rn2(4)=1 @ dog_goal
8-9: rn2(12) @ dog_move
10: rn2(5)=4 @ distfleeck         (iteration 2 end)
```

**Actual (JS):**
```
0: rn2(5)=0                       (iteration 1 start)
1: rn2(4)=3                       ← JS SKIPS obj_resists!
2: rn2(12)=7                      (different value!)
3: rn2(12)=9
4: rn2(5)=1                       (iteration 1 end)
5: rn2(5)=4                       (iteration 2 start)
6: rn2(100)=14 @ obj_resists      ← JS calls it in iteration 2
7: rn2(100)=89 @ obj_resists
8-9: rn2(4), rn2(12)...
```

## Root Cause Analysis

### obj_resists Call Pattern
- **C iteration 1**: Calls obj_resists for objects at (56,4) and (56,2)
- **JS iteration 1**: Does NOT call obj_resists (objects out of range)
- **JS iteration 2**: Calls obj_resists for those same objects

### Range Check Investigation
Pet at **(62,3)** in iteration 1:
- `minX = max(1, omx - SQSRCHRADIUS) = max(1, 62 - 5) = 57`
- Objects at x=56: **56 < 57** → OUT OF RANGE ✗
- JS correctly excludes these objects

**Contradiction**: C's range check code is IDENTICAL to JS's:
```c
// C: dogmove.c
if ((min_x = omx - SQSRCHRADIUS) < 1) min_x = 1;
if (nx >= min_x && nx <= max_x && ny >= min_y && ny <= max_y)
```

```javascript
// JS: monmove.js
const minX = Math.max(1, omx - SQSRCHRADIUS);
if (ox < minX || ox > maxX || oy < minY || oy > maxY) continue;
```

For C to include objects at x=56, C's pet must be at **x ≤ 61**, not x=62!

### Pet Position Verification
- JS pet at (62,3) from turns 18-21 (verified via debug logging)
- meating counter: 4→3→2→1→0 (turns 18-21-22)
- Turns 0-21 all pass perfectly (RNG synchronized)
- **No RNG-based explanation for position divergence!**

### Turn Counter Synchronization
Verified C's turn counter behavior:
- During movemon(): `svm.moves = 21` (not yet incremented)
- After movemon(): `svm.moves++` → 22
- JS compensates: `turnCount = (player.turns || 0) + 1` ✓

### Attempted Fixes

#### 1. Move movemon() Before rhack()
**Rationale**: C calls movemon BEFORE rhack in allmain.c:205

**Implementation**: Added `prevTookTime` flag to delay movemon to next iteration

**Result**: FAILED - All turns 15+ diverge, RNG values shift

**Why it failed**: Initial turn (step 0) has no prior movemon, breaking the pattern

## Unresolved Mystery

**The Paradox**:
1. Turns 0-21 pass perfectly → RNG synchronized, pet positions should match
2. C finds objects at x=56 in range at turn 22 iteration 1
3. JS's pet at (62,3) correctly excludes x=56 (minX=57)
4. C's range check code is identical to JS's
5. **Conclusion**: C's pet must be at x≤61, but how?

## Possible Explanations (Unexplored)

1. **Non-RNG pet movement**: Some movement that doesn't consume RNG?
2. **C logging discrepancy**: RNG log might not reflect actual game state?
3. **Compiler/platform difference**: Extremely unlikely but possible
4. **Missing context**: Some C code path not yet understood

## Debug Code Added

Added comprehensive logging to `js/monmove.js`:
- Pet position before/after each movemon iteration
- phase3Cond/meating status in dochug
- dog_goal object scanning with range checks
- Position evaluation in dog_move
- All logged for turns 21-22

## Next Steps

1. Examine C's actual pet position at runtime (not just RNG trace)
2. Check if C has any non-RNG pet repositioning logic
3. Verify C's omx/omy values match mtmp->mx/my
4. Consider instrumenting C code to log pet positions

## Files Modified

- `js/monmove.js`: Added debug logging (not removed, useful for future investigation)
- Created: `test/comparison/TURN22_INVESTIGATION.md` (this file)

## References

- C source: `nethack-c/src/dogmove.c` (dog_move, dog_goal)
- C source: `nethack-c/src/monmove.c` (movemon, dochug)
- C source: `nethack-c/src/allmain.c` (moveloop_core)
- Session: `test/comparison/sessions/seed1_gameplay.session.json`
