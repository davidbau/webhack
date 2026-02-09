# RNG Alignment Guide

This document captures lessons learned while achieving bit-exact RNG alignment between the JavaScript port and C NetHack 3.7.

## Current Status (2026-02-09)

- **Unit tests**: 454 pass / 0 fail ✓
- **Comparison tests**: 650 pass / 95 fail (87.2% pass rate)
- **Map generation**: All 5 seeds have perfect depth-1 alignment (typGrid + rngCalls + RNG trace match C)
- **Shops**: Fully implemented and RNG-aligned

## Key Discoveries

### 1. STR18 Encoding (attrmax values)

**Problem**: JS used plain `18` for all strength maximums. C uses `STR18(x) = 18 + x` macro.

**C Implementation** (`role.c`):
```c
#define STR18(x) (18 + (x))  // attrib.h:36

// Race attrmax values:
Human:  STR18(100), 18, 18, 18, 18, 18  // [118, 18, 18, 18, 18, 18]
Elf:    18, 20, 20, 18, 16, 18
Dwarf:  STR18(100), 16, 16, 20, 20, 16  // [118, 16, 16, 20, 20, 16]
Gnome:  STR18(50), 19, 18, 18, 18, 18   // [68, 19, 18, 18, 18, 18]
Orc:    STR18(50), 16, 16, 18, 18, 16   // [68, 16, 16, 18, 18, 16]
```

**Impact**: Character attribute initialization calls `init_attr_role_redist()` which rolls `rn2(100)` per attribute. When STR hits its maximum during redistribution, C can continue (max=118) but JS would stop (max=18), causing an extra RNG retry.

**Fix**: Updated `RACE_ATTRMAX` in `js/u_init.js` to use encoded values:
```javascript
const RACE_ATTRMAX = {
    [RACE_HUMAN]: [118, 18, 18, 18, 18, 18],  // STR18(100)
    [RACE_DWARF]: [118, 16, 16, 20, 20, 16],  // STR18(100)
    [RACE_GNOME]: [68, 19, 18, 18, 18, 18],   // STR18(50)
    [RACE_ORC]:   [68, 16, 16, 18, 18, 16],   // STR18(50)
    // ...
};
```

### 2. Wizard Mode Trap Visibility

**Problem**: Pet trap avoidance was consuming different RNG. JS called `rn2(100)` (dogfood check), C called `rn2(40)` (trap avoidance).

**Root Cause**: C test harness runs with `-D` flag (wizard mode):
```python
# test/comparison/c-harness/gen_map_sessions.py:140
f'{NETHACK_BINARY} -u Wizard -D; '
```

Wizard mode enables **omniscience** — all traps are automatically visible (`trap.tseen = true`). JS wasn't simulating this.

**C Implementation** (`dogmove.c:1182-1204`):
```c
// Trap avoidance for pets
if ((mfp.info[i] & ALLOW_TRAPS) && (trap = t_at(nx, ny))) {
    if (mtmp->mleashed) {
        if (!Deaf) whimper(mtmp);
    } else {
        // 1/40 chance of stepping on trap anyway
        if (trap->tseen && rn2(40))
            continue;  // Skip this position
    }
}
```

**Fix**: Set all traps to visible after makelevel in test helpers:
```javascript
// test/comparison/session_helpers.js
const map = makelevel(1);
wallification(map);

// Wizard mode: reveal all traps (matching C's `-D` flag behavior)
for (const trap of map.traps) {
    trap.tseen = true;
}
```

**Result**: seed2_wizard_fountains passes 24 more steps (5-29), overall +21 tests passing.

### 3. Pet Trap Avoidance Logic

**Implementation**: Added `m_harmless_trap()` function to determine which traps monsters can safely ignore:

```javascript
function m_harmless_trap(mon, trap) {
    const mdat = mons[mon.mndx] || {};
    const flags1 = mdat.flags1 || 0;
    const mr1 = mdat.mr1 || 0;
    const msize = mdat.size || 0;

    // Flyers avoid floor traps
    const isFloor = trap.ttyp >= 1 && trap.ttyp <= TRAPDOOR;
    if (isFloor && (flags1 & M1_FLY)) return true;

    switch (trap.ttyp) {
    case STATUE_TRAP:
    case MAGIC_TRAP:
    case VIBRATING_SQUARE:
        return true;
    case RUST_TRAP:
        return mon.mndx !== PM_IRON_GOLEM;  // Only harms iron golems
    case FIRE_TRAP:
        return !!(mr1 & MR_FIRE);
    case SLP_GAS_TRAP:
        return !!(mr1 & MR_SLEEP);
    case BEAR_TRAP:
        return msize <= MZ_SMALL || !!(flags1 & M1_AMORPHOUS);
    case PIT: case SPIKED_PIT: case HOLE: case TRAPDOOR:
        return !!(flags1 & M1_CLING);
    case WEB:
        return !!(flags1 & M1_AMORPHOUS);
    default:
        return false;
    }
}
```

### 4. RNG Counting Rules

**Key insight**: C's RNG logs exclude certain composite entries that JS initially counted.

**C Logging** (`_dumplog.c`):
- Logs `rn2(n)`, `rnd(n)`, `rn1(hi,x)` with values
- Does NOT log individual dice rolls from `d(n,x)` — only composite entry
- Does NOT log midlog entries (`>` / `<` markers)

**JS Filtering** (`session_helpers.js`):
```javascript
const rngCalls = compactRng.filter(e =>
    !isMidlogEntry(e) && !isCompositeEntry(rngCallPart(e))
).length;
```

**What to exclude**:
- Composite entries: `d(6,6)=17`, `rne(4)=2`, `rnz(10)=2`
- Midlog markers: `>makemon`, `<makemon`

### 5. Post-Level Initialization Sequence

**Discovery**: Map generation tests were missing post-level initialization that happens in real gameplay.

**C Sequence** (after `makelevel(1)`):
1. `makedog()` - Create starting pet
2. `u_init()` - Player inventory, attributes
3. Player placed at upstair
4. Welcome message

**JS Implementation**:
```javascript
// test/comparison/session_helpers.js
const map = makelevel(1);
wallification(map);

// C map harness runs full game as Valkyrie
if (depth === 1) {
    const player = new Player();
    player.initRole(11); // Valkyrie
    if (map.upstair) {
        player.x = map.upstair.x;
        player.y = map.upstair.y;
    }
    simulatePostLevelInit(player, map, 1);
}
```

**Impact**: Depth 1 maps now have perfect RNG alignment including pet creation, inventory, and attribute rolls.

## Testing Architecture

### Session File Structure

C harness generates three types of sessions:

1. **Map sessions**: Level generation only
   - `type: "map"`
   - Contains `levels[]` with `typGrid`, `rng`, `rngCalls` per depth
   - Example: `seed119_maps_c.session.json`

2. **Gameplay sessions**: Full game replay
   - `type: "gameplay"` (or implicit for v1)
   - Contains `startup` + `steps[]` with per-step RNG traces
   - Example: `seed2_wizard_fountains.session.json`

3. **Chargen sessions**: Character creation diagnostics
   - `type: "chargen"`
   - Tests role/race/alignment combinations
   - Diagnostic only (non-failing)

### C Session File Format

**Important**: C uses **0-indexed** level arrays where index 0 = depth 1:
```javascript
// WRONG:
const depth1Data = data.depths['1'];  // undefined

// CORRECT:
const depth1Data = data.levels[0];    // depth 1
const depth2Data = data.levels[1];    // depth 2
```

## Debugging Techniques

### 1. Side-by-Side RNG Traces

Extract specific ranges for comparison:
```javascript
// Get C trace entries 2570-2690 for seed119 depth 1
const cSession = JSON.parse(readFileSync('seed119_maps_c.session.json'));
const cTrace = cSession.levels[0].rng.slice(2570, 2690);

// Generate JS trace
enableRngLog();
initRng(119);
// ... generate map ...
const jsTrace = getRngLog().slice(2570, 2690);

// Compare call-by-call
for (let i = 0; i < cTrace.length; i++) {
    if (cTrace[i] !== jsTrace[i]) {
        console.log(`DIVERGE at ${i}: JS="${jsTrace[i]}" C="${cTrace[i]}"`);
        break;
    }
}
```

### 2. Finding Divergence Context

When you find a divergence at index N, look backward for function context:
```javascript
// Find what function we're in
for (let i = N; i >= 0; i--) {
    if (trace[i].includes('>') || trace[i].includes('<')) {
        console.log(`Context: ${trace[i]}`);
        break;
    }
}
```

### 3. Role Index Mapping

Common mistake: role names vs indices don't match C order:
```javascript
const roles = [
    'Archeologist',  // 0
    'Barbarian',     // 1
    'Caveman',       // 2
    'Healer',        // 3
    'Knight',        // 4
    'Monk',          // 5
    'Priest',        // 6
    'Ranger',        // 7
    'Rogue',         // 8
    'Samurai',       // 9
    'Tourist',       // 10
    'Valkyrie',      // 11
    'Wizard'         // 12 (NOT 13!)
];
```

## Common Pitfalls

### 1. Using `rn2(1)` for Placeholder Consumption

When you need to advance RNG without using the value:
```javascript
// WRONG: might affect subsequent rn2(2) patterns
rn2(100);

// RIGHT: C-faithful placeholder
rn2(1);  // Always returns 0, consumes 1 RNG call
```

### 2. Assuming Trap Victim = Trapped Monster

**Trap victim** (`mktrap_victim`):
- Creates a **corpse** with scattered items
- NOT a living trapped monster
- Called during level generation for flavor

**Trapped monster** (`mtmp->mtrapped`):
- Living monster stuck in trap
- Can escape with `rn2(40)` each turn
- Reveals trap when seen by player

### 3. Confusing Wizard (role) vs wizard mode

- **Wizard**: Character class (roleIndex = 12)
- **wizard mode**: Debug mode (`-D` flag) with omniscience

## Future Work

### Remaining Gaps

1. **place_lregion / fixup_special**: Post-level fixup for branch stairs
   - Seeds 119, 72 diverge ~65 calls from end of depth 2
   - C calls `fixup_special()` from `sp_lev.c:6040` after makelevel

2. **Depth 2+ map generation**: Branch placement only works for depth 1
   - Seeds 163, 306 diverge mid-generation
   - Need `generate_stairs_find_room()` for Mines entrance

3. **Gameplay commands**: Missing some action handlers
   - seed2 step 30: open-move-east
   - Fountain interactions (quaff-y)
   - Inventory modal dismissal

### Investigation Tools

For deep dives into specific divergences, see:
- Full session transcripts: `~/.claude/projects/-share-u-davidbau-git-shops/*.jsonl`
- Memory notes: `~/.claude/projects/-share-u-davidbau-git-shops/memory/MEMORY.md`

## References

- **C NetHack 3.7**: `nethack-c/` directory
- **Key C files**:
  - `src/dogmove.c` - Pet AI and trap avoidance
  - `src/attrib.c` - Attribute initialization
  - `src/trap.c` - Trap mechanics and `m_harmless_trap()`
  - `src/role.c` - Role/race definitions with STR18 encoding
- **JS Implementation**: `js/` directory
- **Test infrastructure**: `test/comparison/`
