# Pet Trap Avoidance Implementation

**Date**: 2026-02-09
**Commit**: ca877e4
**Test Impact**: +32 tests (1020→1052 passing)

## Overview

Implemented complete RNG-faithful pet trap avoidance system matching NetHack 3.7 C behavior. Pets now correctly avoid harmful seen traps with 39/40 probability using rn2(40).

## Problem

After git pull, seed42 test failed due to missing trap avoidance infrastructure:
- JS called rn2(40) when C didn't → RNG desynchronization
- Root cause: Improper wizard mode handling and missing ALLOW_TRAPS mechanism

## Root Causes Found

### 1. Missing mndx Field in Pet Creation
**File**: `js/u_init.js:244`

Pet created by `makedog()` only set `mnum` field, but `m_harmless_trap()` expected `mndx`.

```javascript
// Before (BROKEN):
mnum: pmIdx,  // Only mnum set

// After (FIXED):
mndx: pmIdx,  // Monster type index (primary)
mnum: pmIdx,  // Alias for compatibility
```

**Impact**: m_harmless_trap() failed to check monster attributes, always returned false.

### 2. Incorrect Wizard Mode Trap Revelation
**File**: `test/comparison/session_helpers.js:279, 491`

JS incorrectly set `trap.tseen=true` for ALL traps in wizard mode.

```javascript
// Before (BROKEN):
// Wizard mode: reveal all traps
for (const trap of map.traps) {
    trap.tseen = true;  // Wrong! Pets shouldn't know all traps
}

// After (FIXED):
// Wizard mode gives player omniscience but pets discover traps normally
// Removed automatic trap revelation
```

**Impact**: Spurious rn2(40) calls for traps that weren't actually seen by pets.

### 3. Missing ALLOW_TRAPS Infrastructure
**File**: `js/monmove.js`

C's mfndpos sets ALLOW_TRAPS flag for positions with harmful traps. JS lacked this mechanism.

**C behavior**:
```c
// In mfndpos (mon.c:2347):
if (!m_harmless_trap(mon, ttmp)) {
    data->info[cnt] |= ALLOW_TRAPS;  // Flag harmful trap position
}

// In dog_move (dogmove.c:1182-1204):
if ((mfp.info[i] & ALLOW_TRAPS) && (trap = t_at(nx, ny))) {
    if (trap->tseen && rn2(40))
        continue;  // Avoid trap 39/40 times
}
```

**JS implementation**: Extended mfndpos to return `allowTraps` boolean flag.

## Implementation

### m_harmless_trap() Function
**File**: `js/monmove.js:73-110` (40 lines)

Determines if trap is harmless to specific monster based on attributes:

```javascript
function m_harmless_trap(mon, trap) {
    const mdat = mons[mon.mndx] || {};
    const flags1 = mdat.flags1 || 0;
    const mr1 = mdat.mr1 || 0;
    const msize = mdat.size || 0;

    // Flying monsters avoid floor traps
    const isFloor = trap.ttyp >= 1 && trap.ttyp <= TRAPDOOR;
    if (isFloor && (flags1 & M1_FLY)) return true;

    switch (trap.ttyp) {
        case FIRE_TRAP: return !!(mr1 & MR_FIRE);
        case SLP_GAS_TRAP: return !!(mr1 & MR_SLEEP);
        case BEAR_TRAP: return msize <= MZ_SMALL || !!(flags1 & M1_AMORPHOUS);
        // ... etc
    }
}
```

**Key patterns**:
- Flying monsters (M1_FLY) avoid all floor traps (ARROW through TRAPDOOR)
- Fire resistance (MR_FIRE) makes fire traps harmless
- Small/amorphous monsters escape bear traps
- Clinging monsters avoid pits/holes

### Extended mfndpos()
**File**: `js/monmove.js:153-168`

Returns `allowTraps` flag for positions with harmful traps:

```javascript
// Inside mfndpos loop:
let allowTraps = false;
const trap = map.trapAt(nx, ny);
if (trap) {
    if (!m_harmless_trap(mon, trap)) {
        allowTraps = true;  // Flag harmful trap
    }
}
positions.push({ x: nx, y: ny, allowTraps });
```

### Trap Avoidance in dog_move()
**File**: `js/monmove.js:640-648`

Checks trap avoidance only for flagged positions:

```javascript
// In position evaluation loop:
if (positions[i].allowTraps) {
    const trap = map.trapAt(nx, ny);
    if (trap && !m_harmless_trap(mon, trap)) {
        if (!mon.mleashed) {
            if (trap.tseen && rn2(40))
                continue;  // Skip position 39/40 times
        }
    }
}
```

**Logic**:
1. Only check if mfndpos flagged position (ALLOW_TRAPS)
2. Verify trap is harmful (redundant check, but matches C)
3. Leashed pets don't avoid (they whimper instead, not yet implemented)
4. 39/40 probability to avoid if trap is seen

## Testing Results

### Before Implementation
- **1020 pass / 144 fail**
- seed42: FAILING (spurious rn2(40) calls)
- seed2_wizard_fountains: PASSING

### After Implementation
- **1052 pass / 112 fail** (+32 tests, +3.1%)
- seed42: ALL 12 STEPS PASS ✓
- seed2_wizard_fountains: ALL 37 STEPS PASS ✓

## Remaining Issues (112 Failures)

### Special Levels (36 tests)
All seed*_special_* tests fail with "unknown session type".

**Cause**: Special level generation not implemented (bigroom, castle, medusa, oracle, etc.)
**Fix Required**: Implement des.* API (des.room, des.monster, des.trap, etc.)
**Tracked**: Beads issues interface-0yz, interface-5yl, interface-1xn, etc.

### Map Sessions (50 tests)
Depth 2+ RNG mismatches with cascading failures.

**Patterns**:
- Depth 1: ✓ Perfect match (typGrid + RNG)
- Depth 2: ✓ typGrid matches, ✗ RNG diverges late (call 900-2300)
- Depth 3-5: ✗ Cascade failures from depth 2

**Example** (seed16):
- Depth 2: JS=2436 calls, C=2476 calls (-40), diverges at call 1033
- Depth 3: Diverges at call 1 (makelevel)
- Depth 4-5: Diverges at call 0 (getbones)

**Root Cause**: C uses `wizard_level_teleport` between depths (teleport RNG + level gen), JS regenerates each level independently. Complex ordering differences.

### seed1 Level 2 Generation (5 tests)
Steps 0-66 pass, step 67+ fail after descending to level 2.

**Cause**: Algorithmic divergence - same RNG consumed, different result
**Evidence**: Step 66 (descent with level 2 gen) RNG matches exactly
**Result**: JS generates shop (mimic, shopkeeper), C generates regular rooms (jackals, grid bugs)

This is not an RNG consumption bug but a level generation algorithm difference.

### Inventory Sessions (4 tests)
seed42_inventory_* not implemented.

**Cause**: Inventory commands not yet implemented
**Fix Required**: Implement inventory display, pickup, drop commands

## Key Patterns Documented

### Monster Type Fields
Monsters use BOTH `mndx` and `mnum` for type index:
- `makemon()` creates with `mndx`
- `makedog()` now creates with both for compatibility
- Most code uses `mnum`, trap code uses `mndx`

### Trap Discovery
Traps become seen (`tseen=true`) when:
1. Player/pet steps on trap → `commands.js` sets tseen
2. Player searches and finds trap
3. Trap triggers with visible effect

**NOT** automatically revealed in wizard mode (misconception fixed).

### Wizard Mode (-D Flag)
- Gives player omniscience (can see dungeon structure)
- Does NOT make pets aware of trap locations
- Traps still need discovery through normal gameplay

### Pet Trap Avoidance Requirements
1. Trap must exist at position
2. Trap must be harmful to monster type (not m_harmless_trap)
3. Trap must be seen (tseen=true)
4. Pet must not be leashed
5. rn2(40) roll (39/40 probability to avoid)

## Files Modified

| File | Changes | Description |
|------|---------|-------------|
| `js/monmove.js` | +73, -14 | Added m_harmless_trap(), extended mfndpos(), trap avoidance |
| `js/u_init.js` | +1, -0 | Added mndx field to makedog() |
| `test/comparison/session_helpers.js` | +6, -12 | Fixed wizard mode trap handling |
| `js/commands.js` | 0 | Trap discovery already correct |
| `js/dungeon.js` | 0 | Trap creation already correct |

**Total**: ~80 lines changed

## References

### C Source
- `nethack-c/src/dogmove.c:1182-1204` - Pet trap avoidance
- `nethack-c/src/mon.c:2337-2352` - mfndpos ALLOW_TRAPS flagging
- `nethack-c/src/trap.c` - m_harmless_trap() implementation

### Test Sessions
- `test/comparison/sessions/seed42.session.json` - Basic gameplay
- `test/comparison/sessions/seed2_wizard_fountains.session.json` - Wizard mode

## Future Work

1. **Leashed pet whimpering**: When leashed pet encounters trap, call `whimper()` instead of avoiding
2. **Trap type awareness**: Non-pets avoid traps they've seen before (mon_knows_traps)
3. **Special level generation**: Implement des.* API for remaining 36 tests
4. **Map session RNG alignment**: Fix depth 2+ wizard_level_teleport simulation
5. **Level gen algorithmic divergence**: Deep investigation of room/monster placement differences
