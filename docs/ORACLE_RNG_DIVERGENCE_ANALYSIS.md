# Oracle Level RNG Divergence Analysis

## Problem Statement

JS oracle level generation diverges from C at the very first RNG call:
- **C first call**: `rn2(100) @ build_room(sp_lev.c:2803)` (call #292)
- **JS first call**: `rnd(2) @ next_ident(mkobj.js:48)` (call #1)

Terrain match rate: ~60% (should be 100%)

## Root Cause: Deferred vs Immediate Execution

### C Execution Flow (Correct)

C uses a **deferred execution model** for special level features:

1. **Parse phase** (calls 292-~800):
   - Execute Lua oracle.lua script
   - Create room structures (`build_room`, `create_room`)
   - **Queue** object/monster/trap placements from `contents` callbacks
   - Bridge calls: `nhl_rn2(1000-1036)` - Lua parameter passing, not actual placement

2. **Corridor phase** (calls ~800-1146):
   - Execute `des.random_corridors()`
   - Generate corridors connecting rooms (`dig_corridor`)

3. **Placement phase** (call 1147+):
   - **Execute all queued** object/monster/trap placements
   - First object creation: `rnd(2) @ next_ident(mkobj.c:522)` (call #1147)

### JS Execution Flow (Incorrect)

JS uses an **immediate execution model**:

1. **Room creation**:
   - Execute oracle.js
   - Create first room
   - Immediately execute `contents` callback
   - **Create objects right away**: `rnd(2) @ next_ident(mkobj.js:48)` ← WRONG!

2. **Continue with more rooms and objects mixed together**

3. **Corridors last**: `des.random_corridors()`

## Evidence from RNG Traces

### C Trace (seed 42)

```
Call 292:    rn2(100) @ build_room       ← First room structure
Call 293:    rnd(2) @ litstate_rnd       ← Room lighting
Call 296-299: create_room calls           ← Room geometry
Call 301-330: nhl_rn2(1000+) calls        ← Lua bridge (parsing contents)
Call 331:    rn2(100) @ build_room       ← Second room structure
...
Call 1141-1146: dig_corridor              ← Corridor generation
Call 1147:   rnd(2) @ next_ident         ← FIRST object creation!
```

### JS Trace (seed 42)

```
Call 1: rnd(2) @ next_ident(mkobj.js:48) ← FIRST call is object creation!
Call 2-10: rndmonst_adj calls             ← Monster generation
```

## Solution

JS must implement **deferred execution** for special level features:

### Required Changes

1. **Modify `des.object()`, `des.monster()`, `des.trap()` in sp_lev.js**:
   - Instead of creating entities immediately, **queue** them in arrays:
     ```js
     levelState.deferredObjects.push({ id, x, y, ... });
     ```

2. **Modify `des.finalize_level()`**:
   - After all room definitions and corridors
   - Execute all deferred placements:
     ```js
     for (const obj of levelState.deferredObjects) {
       // NOW create the object
     }
     ```

3. **Execution order in finalize_level()**:
   ```js
   1. Create all rooms (already done)
   2. Generate corridors (already done by des.random_corridors())
   3. Place all deferred objects
   4. Place all deferred monsters
   5. Place all deferred traps
   6. Place all deferred features
   ```

### Expected Result

After implementing deferred execution:
- JS first RNG call will be `rn2(100) @ create_room` (matching C)
- Object creation will happen after corridors (call #1147+)
- RNG sequence will match C 100%
- Terrain will match C 100%

## Files to Modify

- `js/sp_lev.js`:
  - Add deferred queues to `levelState`
  - Modify `des.object()` to queue instead of create
  - Modify `des.monster()` to queue instead of create
  - Modify `des.trap()` to queue instead of create
  - Modify `des.feature()` to queue instead of create (maybe)
  - Modify `des.finalize_level()` to execute all queued placements

- `js/levels/oracle.js`: No changes needed (already correct)

## Testing

After implementing deferred execution:

```bash
node test_oracle_rng_alignment.mjs
```

Expected output:
```
✅ PERFECT ALIGNMENT - RNG and terrain match exactly!
  Seed 42:  100% RNG match, 100% terrain match
  Seed 1:   100% RNG match, 100% terrain match
  Seed 100: 100% RNG match, 100% terrain match
```

## References

- C implementation: `nethack-c/src/sp_lev.c`
- C Lua bridge: `nethack-c/src/nhlua.c`
- C object creation: `nethack-c/src/mkobj.c`
- JS oracle level: `js/levels/oracle.js`
- C oracle level: `nethack-c/dat/oracle.lua`
