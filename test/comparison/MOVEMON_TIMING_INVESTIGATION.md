# movemon() Timing Investigation

## Problem Statement
`seed1_gameplay` test fails at step 22 with RNG divergence. Steps 0-21 pass perfectly.

## Root Cause Analysis

### Initial Hypothesis (INCORRECT)
- Believed issue was movemon() called at wrong time (after rhack vs before)
- Attempted fix: move movemon() to start of iteration based on prevTookTime
- Result: Broke steps 3+ (only 0-2 passed)

### Actual Root Cause (CORRECT)
**Monster processing order difference**, not timing!

At step 22:
- **C RNG sequence**: `rn2(5)` distfleeck → `rn2(100)=15` obj_resists → `rn2(4)` dog_goal
- **JS RNG sequence**: `rn2(5)` distfleeck → `rn2(4)` dog_goal → ... → `rn2(100)=14` obj_resists (6 calls later)

### Why Steps 0-21 Pass
Monsters start with 0 movement points:
1. Turn 1: movemon() called but monsters can't move (movement=0)
2. simulateTurnEnd() allocates movement points via mcalcmove()
3. Turn 2+: monsters have points and move
4. RNG stays aligned until step 22 when specific positional check triggers

## Detailed Investigation (Turn 22)

### Monster State
- Only ONE monster: kitten (little dog)
- Movement points: 24 (double movement: 12 points per iteration × 2)
- Processes TWICE in same movemon() pass

### Iteration 1
- Pet position: (62,3)
- Search radius: x=57-67, y=0-8
- Objects on map: "undead turning" at (56,4), "food ration" at (56,2)
- **Objects at x=56 < minX=57 → OUT of range!**
- dog_goal finds NO objects in range
- **NO obj_resists() call** ✓

### Iteration 2
- Pet position: (61,4) [moved from (62,3)]
- Search radius: x=56-66, y=0-9
- Same objects at (56,4) and (56,2)
- **Objects at x=56 >= minX=56 → IN range!**
- dog_goal finds 2 objects, calls dogfood() for each
- **obj_resists() called twice** ✓

### The Mystery
**C calls obj_resists in iteration 1, JS in iteration 2**

This means C's pet sees objects in range during first iteration. Either:
1. C's pet is at different position (x=61 or less) vs JS (x=62)
2. C's search radius calculation differs (but code inspection shows it's identical)
3. There's a subtle state difference we haven't found

## Range Check Verification

### C Code (dogmove.c:524)
```c
if (nx >= min_x && nx <= max_x && ny >= min_y && ny <= max_y)
```

### JS Code (monmove.js:496)
```javascript
if (ox < minX || ox > maxX || oy < minY || oy > maxY) continue;
```

**These are logically equivalent** (inverted logic, same result).

### Radius Calculation

**C** (dogmove.c:511-518):
```c
if ((min_x = omx - SQSRCHRADIUS) < 1)
    min_x = 1;
if ((max_x = omx + SQSRCHRADIUS) >= COLNO)
    max_x = COLNO - 1;
```

**JS** (monmove.js:468-470):
```javascript
const minX = Math.max(1, omx - SQSRCHRADIUS);
const maxX = Math.min(COLNO - 1, omx + SQSRCHRADIUS);
```

**These are identical**.

## Next Steps

1. **Determine why pet positions differ** despite steps 0-21 passing
   - Add logging to track pet position history across all turns
   - Check if there's a 1-square drift accumulating over turns
   - Verify pet movement calculation matches C exactly

2. **Alternative theories to investigate**:
   - Pet position might be updated at different time within turn
   - omx/omy might be captured at different moment
   - Map state (objects, walls) might differ subtly
   - Boundary conditions in movement code

3. **Potential fixes**:
   - If pet position is truly different, find where divergence starts
   - If it's a rounding/truncation issue, adjust movement calculation
   - If it's object placement, verify level generation RNG alignment

## Files Involved
- `js/monmove.js`: movemon(), dochug(), dog_move(), dog_goal()
- `js/dog.js`: dogfood() - calls obj_resists()
- `js/objdata.js`: obj_resists() - consumes rn2(100)
- `test/comparison/session_helpers.js`: Session replay loop

## References
- C source: `nethack-c/src/monmove.c`, `nethack-c/src/dogmove.c`
- MEMORY.md: Detailed session notes and key patterns
- Test: `test/comparison/session_runner.test.js`
