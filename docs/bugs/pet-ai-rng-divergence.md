# Pet AI RNG Divergence (seed1 step 22+) — MOSTLY RESOLVED

## Summary

The JS `dog_move`/`dog_goal` pet AI diverged from C starting at step 22 of the seed1
gameplay session. Five root causes were identified and fixed, recovering 39 of the
original 45 failing steps. seed1 now passes 61/67 steps (was 22/67). The remaining
6 failures (steps 45, 47-50, 66) trace to subtle `do_clear_area` iteration
differences and an unported level-transition sequence.

**Original impact**: 55 of 67 steps in seed1 had pet RNG. Once divergence started at
step 22, all remaining steps cascaded.

**Resolution**: Five fixes applied — gold auto-pickup removal, door auto-open RNG,
ALLOW_M in mfndpos, player tracking with !in_masters_sight goal redirect, and
dog_invent. See `PHASE_1_PRNG_ALIGNMENT.md` Phase 2 for detailed writeup.

## Root Cause Analysis

### What happens at step 22

C trace (calls 0-5):
```
0: rn2(5)=0  @ distfleeck           — pet initial check
1: rn2(100)=15 @ obj_resists [dog_goal] — pet scans map object ← MISSING IN JS
2: rn2(4)=3  @ dog_goal:576         — approach check (!rn2(4))
3: rn2(12)=9 @ dog_move:1263        — position evaluation
4: rn2(12)=0 @ dog_move:1263        — position evaluation
5: rn2(5)=4  @ distfleeck           — pet post-move check
```

JS trace (calls 0-4):
```
0: rn2(5)=0  @ distfleeck           — matches C
1: rn2(4)=3  @ dog_goal:576         — ← should be call 2, but no obj_resists before it
2: rn2(12)=9 @ dog_move:1263        — same value but wrong position
...
```

JS `dog_goal` iterates `map.objects` within `SQSRCHRADIUS` (5) of the pet. Each object
calls `dogfood()` → `obj_resists()` → `rn2(100)`. At step 22, C finds 1 object in range
while JS finds 0. This means either:

1. **The pet is at a different position** — Though RNG matched through step 21, the
   `dog_move` position evaluation logic might interpret the same RNG values differently,
   causing the pet to drift to a slightly different square.

2. **An object exists in C but not in JS** — Object creation during `makelevel()` might
   differ, or an object was dropped/created during gameplay that JS doesn't model.

3. **The scan bounds differ** — The `SQSRCHRADIUS` check or object iteration order might
   differ subtly.

### Why steps 0-21 match

- Steps 0-1: No monster movement (movement points = 0 before first `mcalcmove`)
- Steps 2-21: Pet is adjacent to player (`udist <= 1`), so `dog_goal` skips the
  approach check (`rn2(4)`) and the inventory scan (`obj_resists`). Only
  `distfleeck` + position evaluation calls occur.
- At step 22, the pet is no longer adjacent (player walked away from pet), triggering
  the full `dog_goal` code path including object scans.

## Map of pet AI RNG calls in C

Analysis of all dog/pet RNG across the full seed1 session (67 steps):

### Call sites and frequencies

| Call site | Count | Pattern | Description |
|-----------|-------|---------|-------------|
| `dog_move(dogmove.c:1263)` | 132 | `rn2(12)`, `rn2(3)` | Position evaluation: worse-distance fallback |
| `obj_resists [dog_goal]` | 90 | `rn2(100)` | Object scan during goal evaluation |
| `dog_move(dogmove.c:1256)` | 54 | `rn2(8,12,16,20,24)` | Position evaluation: cursed avoidance |
| `dog_goal(dogmove.c:576)` | 30 | `rn2(4)` | Follow-player approach probability |
| `obj_resists [dog_goal/invscan]` | 16 | `rn2(100)` | Player inventory scan for DOGFOOD |
| `obj_resists [dog_move/food]` | 11 | `rn2(100)` | Food at adjacent position check |
| `dog_goal(dogmove.c:555)` | 10 | `rn2(8)` | Apport check (`edog.apport > rn2(8)`) |
| `dog_move(dogmove.c:1261)` | 8 | `rn2(1,2,3)` | Position evaluation: track avoidance |
| `dog_invent(dogmove.c:445)` | 2 | `rn2(20)` | Inventory drop decision |
| `obj_resists [dog_invent]` | 2 | `rn2(100)` | Drop evaluation |
| `obj_resists [dog_eat/*]` | 2 | `rn2(100)` | Eat reward check + delobj |

### C code structure (dogmove.c)

```
dog_move(mtmp):
  dog_goal():
    for each obj on map within SQSRCHRADIUS:      ← obj_resists via dogfood()
      classify as DOGFOOD/CADAVER/ACCFOOD/...
    if no good goal:
      follow player
      if udist > 1:
        approach check: !rn2(4)                     ← dog_goal:576
        apport check: edog.apport > rn2(8)          ← dog_goal:555
      if appr == 0:
        scan player inventory for DOGFOOD:           ← obj_resists [invscan]

  dog_invent():                                      ← rn2(20), obj_resists
    maybe drop carried item

  position evaluation loop (mfndpos positions):
    food check at position:                          ← obj_resists [food]
    cursed avoidance: rn2(13 * uncursedcnt)          ← dog_move:1256
    track avoidance: rn2(MTSZ * (k-j))              ← dog_move:1261
    distance comparison:
      j==0: !rn2(++chcnt)                           ← dog_move:1263
      j>0: !rn2(3) or !rn2(12)                      ← dog_move:1263

  if ate: dog_eat():                                 ← obj_resists [eat]
```

## What JS already implements

The JS `dog_move` in `monmove.js` (lines 249-485) implements:
- `dog_goal` object scan (SQSRCHRADIUS, dogfood classification)
- Follow-player logic with approach/flee decisions
- `mfndpos` position collection (column-major, boulder filter)
- Full position evaluation with cursed avoidance, track avoidance, distance comparison
- `dog_eat` with reward check and object removal

The JS `dogfood()` in `dog.js` (lines 131-284) implements the full food classification.

## What's been fixed

1. **Gold auto-pickup removed** (`commands.js`) — JS was auto-collecting gold coins
   during movement; C does not. This removed gold from `map.objects` before pet AI
   ran, causing missing `rn2(100)` calls in `dog_goal`'s object scan. Root cause of
   the original step 22 divergence.

2. **Door auto-open RNG added** (`commands.js`) — JS was opening doors silently during
   movement. C calls `rnl(20)` for strength check + `rn2(19)` for exercise.

3. **`ALLOW_M` in mfndpos** (`monmove.js`) — Pets can consider monster-occupied squares
   as valid movement targets. Missing this produced wrong position counts in `rn2(cnt)`.

4. **Player tracking + `!in_masters_sight` goal redirect** (`monmove.js`, `vision.js`,
   `nethack.js`) — When pet can't see master, C redirects goal via gettrack → ogoal →
   wantdoor/do_clear_area. Required porting `settrack`/`gettrack` (circular buffer of
   100 positions), `do_clear_area` (Algorithm C LOS from non-hero position), and the
   wantdoor callback. Most complex fix.

5. **`dog_invent()`** (`monmove.js`) — Pet inventory management: drop path
   (`rn2(udist+1)`, `rn2(apport)`, `rn2(10)`) and pickup path (`rn2(20)`, `rn2(udist)`).
   Only 2 occurrences in seed1 but critical at steps 44 and 47.

## What's NOT yet implemented

1. **Occupation system for eating** — C's `doeat()` is a multi-turn occupation (~6 turns
   for food rations). Each turn processes monster movement. JS treats eat as instant.
   The seed42_items session step 8 shows 230 RNG calls (6 turns × ~38 per-turn).

2. **Remaining `do_clear_area` iteration differences** — Steps 45 and 47-50 in seed1
   diverge in position evaluation, likely due to subtle differences in wantdoor goal
   selection (LOS iteration order or range boundary handling in `do_clear_area`).

3. **Level transition RNG** — Step 66 in seed1 shows JS=18 vs C=2615 RNG calls,
   suggesting a multi-turn occupation or complex trap/stair sequence not yet ported.

## Debugging approach

### Step 1: Instrument JS to log pet position per step

Add a diagnostic return value from `dog_move` in `monmove.js` to track the pet's
position after each movement decision. Then in `replaySession`, accumulate pet
positions per step and compare against expectations derived from the C trace.

```javascript
// In session_helpers.js replaySession, after movemon:
const petPositions = game.map.monsters
    .filter(m => m.tame)
    .map(m => ({ mx: m.mx, my: m.my, name: m.name }));
stepResults[i].petPositions = petPositions;
```

### Step 2: Derive expected C pet positions from RNG trace

The C trace contains `dog_move(dogmove.c:1263)` and `dog_move(dogmove.c:1256)` calls
that are consumed during position evaluation. By replaying the C trace's rn2 values
through the JS position eval logic, you can reconstruct where C's pet ended up.

Alternatively: add pet position dumping to the C harness PRNG logging patch
(at the end of dog_move, emit a log line like `DOG_POS x,y`).

### Step 3: Compare object scan ranges at divergence step

At step 22 (the first divergence), dump all objects within SQSRCHRADIUS=5 of both
the JS pet position and the expected C pet position. The C trace shows 1 obj_resists
call from dog_goal, meaning 1 object in range. Finding which object C sees that JS
doesn't will identify the root cause.

```javascript
// Diagnostic script to run after step 21 replay
const pet = game.map.monsters.find(m => m.tame);
const SQSRCHRADIUS = 5;
const nearbyObjs = game.map.objects.filter(obj =>
    Math.abs(obj.ox - pet.mx) <= SQSRCHRADIUS &&
    Math.abs(obj.oy - pet.my) <= SQSRCHRADIUS
);
console.log(`Pet at ${pet.mx},${pet.my}, ${nearbyObjs.length} objects in range`);
nearbyObjs.forEach(obj => console.log(`  ${obj.name} at ${obj.ox},${obj.oy}`));
```

### Step 4: Check mfndpos position ordering

The `mfndpos` function collects adjacent positions in column-major order:
`(x-1,y-1), (x-1,y), (x-1,y+1), (x,y-1), (x,y+1), (x+1,y-1), ...`

If the iteration order differs from C even slightly, the same rn2 values will select
different positions. Verify by comparing the positions array against C's expected
output (derivable from the trace's rn2 arguments: `rn2(12)` means `rn2(cnt)` where
cnt is the number of valid positions).

### Step 5: Verify dogfood() classifications

Each object within SQSRCHRADIUS is evaluated by `dogfood()` which calls
`obj_resists()` → `rn2(100)`. If JS classifies an object as UNDEF or TABU
(skipping it) while C classifies it as APPORT (evaluating it), the rn2(100)
call would be missing. Run dogfood on each nearby object and compare
classifications.

### Possible root causes (prioritized)

1. **Pet position drift** (most likely) — The position evaluation in dog_move
   consumes rn2 with arguments that depend on the number of valid positions
   (`cnt`). If mfndpos returns a different count (e.g., due to boulder/door
   checks differing), the same rn2 value selects a different square.

2. **Object position mismatch** — If makelevel generates objects at different
   positions in JS vs C, the scan would find different objects. Verify by
   comparing the full `map.objects` list against a C object dump.

3. **Missing dog_invent** — If C's pet picked up an object (dog_invent) on an
   earlier turn and dropped it at a different position, that object would appear
   in a different scan range. dog_invent is not yet implemented in JS.

## Related: Eat command RNG (seed42_items step 8)

The eat step in seed42_items has 230 RNG calls broken down as:
- Monster movement: 48 distfleeck + 60 obj_resists + 13 dog_goal + 45 dog_move + 15 m_move
- Per-turn: 24 mcalcmove + 12 moveloop_core + 6 dosounds + 6 gethungry + 1 exercise

This represents 6 game turns of activity during the eating occupation. Implementing this
requires:
- Multi-turn occupation system (player is busy eating for N turns)
- Monster movement continues each turn during occupation
- Proper turn counting and RNG consumption per eating turn

## Test status

| Session | Steps pass | Steps fail | Notes |
|---------|-----------|------------|-------|
| seed42.session.json | 12/12 | 0 | All pass (was 10/12 before ALLOW_M fix) |
| seed42_items.session.json | 8/9 | 1 | Only eat (step 8) fails — needs occupation system |
| seed1.session.json | 61/67 | 6 | Steps 45, 47-50, 66 fail (was 22/67) |

**Overall session runner**: 604 pass, 78 fail (was 565 pass, 117 fail before pet AI fixes)

### Remaining seed1 failures

| Step | Symptom | Likely cause |
|------|---------|-------------|
| 45 | Position eval: C `rn2(3)` vs JS `rn2(12)` | wantdoor goal differs → different omx==nix check |
| 47-50 | Cascading from step 45 divergence | dog_invent at 47 + shifted stream |
| 66 | JS=18 calls vs C=2615 calls | Level transition or multi-turn occupation |
