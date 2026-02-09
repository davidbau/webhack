# Achieving Bit-Exact PRNG Alignment Between C NetHack and JavaScript

This document tells the story of how WebHack — a JavaScript port of NetHack 3.7
running in the browser — was made to produce **identical dungeon maps** to the
original C game, cell for cell, across every seed tested.

NetHack's level generator makes hundreds of pseudorandom decisions per level:
room sizes, corridor paths, door placement, monster and object selection, trap
positions. A single RNG call out of sequence makes every subsequent decision
diverge. Getting this right required building a comparison infrastructure,
porting the PRNG engine itself, then systematically tracing and eliminating
every source of divergence.

## Table of Contents

1. [The Goal](#1-the-goal)
2. [Phase 1: Port ISAAC64](#2-phase-1-port-isaac64)
3. [Phase 2: Build the Comparison Harness](#3-phase-2-build-the-comparison-harness)
4. [Phase 3: Add RNG Call Logging](#4-phase-3-add-rng-call-logging)
5. [Phase 4: Align the Pre-Level RNG Sequence](#5-phase-4-align-the-pre-level-rng-sequence)
6. [Phase 5: Port the Level Generator](#6-phase-5-port-the-level-generator)
7. [Phase 6: Port Object, Monster, and Trap Creation](#7-phase-6-port-object-monster-and-trap-creation)
8. [Phase 7: Fix the Long Tail of Divergences](#8-phase-7-fix-the-long-tail-of-divergences)
9. [Final Result](#9-final-result)
10. [Architecture of the Test Infrastructure](#10-architecture-of-the-test-infrastructure)

---

## 1. The Goal

The C NetHack level generator is deterministic: given the same PRNG seed, it
produces the same dungeon layout every time. The goal was to make the JS port
produce the **exact same 21×80 terrain grid** as the C game for any seed at
depth 1. Not "similar" — identical. Every wall, door, corridor, room, staircase,
trap, and object in the same position.

Why? Because NetHack's logic is deeply intertwined. If room 3 is one tile wider,
the corridor connecting it takes a different path, which shifts where a niche
gets placed, which consumes an extra RNG call, which changes every monster and
object on the level. Approximate porting produces approximate results that
diverge unpredictably. Exact porting lets you test with confidence.

## 2. Phase 1: Port ISAAC64

**Commits:** `0c296c7`, `342f2f5`
**Beads:** `mazesofmenace-dkm`, `mazesofmenace-2ed`

NetHack 3.7 uses ISAAC64, a cryptographic-quality PRNG with 64-bit output.
The JS port initially used xoshiro128**, a different generator. Step one was
replacing it with an exact port of ISAAC64.

### The challenge: 64-bit arithmetic in JavaScript

ISAAC64 is built on unsigned 64-bit integer arithmetic — additions, XORs, and
shifts on `uint64_t` values. JavaScript has no native 64-bit integers. The
port uses `BigInt` with explicit masking to `0xFFFFFFFFFFFFFFFFn`:

```javascript
// From js/isaac64.js — the core ISAAC64 mix step
a = (a ^ (a << 21n)) & MASK;
a = (a + ctx.mm[i + 128]) & MASK;
x = ctx.mm[i];
ctx.mm[i] = y = (ctx.mm[(Number(x >> 3n) & 0xFF)] + a + b) & MASK;
ctx.rr[i] = b = (ctx.mm[Number((y >> 11n) & 0xFFn) + 128] + x) & MASK;
```

### Verification: golden reference values

A small C reference program (`test/comparison/isaac64_reference.c`) generates
500 raw `uint64` values for 4 seeds (0, 42, 1000000, max_uint64). The JS unit
tests compare against these golden files, asserting bit-for-bit equality:

```
seed=42: 500 values match C reference  ✓
seed=0: 500 values match C reference   ✓
seed=1000000: 500 values match C       ✓
seed=max_uint64: 500 values match C    ✓
```

### RNG wrapper functions

The C wrappers — `rn2(x)`, `rnd(x)`, `rn1(x,y)`, `d(n,x)`, `rne(x)`,
`rnz(i)` — were ported with identical semantics. Each consumes one or more
ISAAC64 values in the same order as C. The critical function is `RND(x)`:

```javascript
// js/rng.js — matches C's rnd.c RND() macro exactly
function RND(x) {
    return Number(isaac64_next_uint64(ctx) % BigInt(x));
}
export function rn2(x) { return RND(x); }      // [0, x)
export function rnd(x) { return RND(x) + 1; }  // [1, x]
```

## 3. Phase 2: Build the Comparison Harness

**Commits:** `342f2f5`, `324b9ef`
**Beads:** `mazesofmenace-rgq`, `mazesofmenace-5nd`, `mazesofmenace-b77`

With ISAAC64 matching at the raw value level, the next step was comparing
actual map output. This required building a C NetHack binary that could be
scripted.

### Patching C NetHack for determinism

The C harness (pinned at commit `79c688cc6`) applies three patches:

**Patch 001: Deterministic seed.** Reads a `NETHACK_SEED` environment variable
and uses it to seed ISAAC64 directly. Crucially, it does NOT set
`has_strong_rngseed`, which prevents C NetHack from re-seeding between levels
via `/dev/urandom`. This means the entire game uses one deterministic seed.

**Patch 002: Map dumper.** Adds a `#dumpmap` wizard command that writes the raw
`levl[x][y].typ` grid — 21 rows of 80 space-separated integers — to a file.
This is the ground truth: the terrain type of every cell on the map.

**Patch 003: PRNG logging.** (Described in Phase 3 below.)

### Automated map extraction

The C game has a full-screen terminal UI with menus, prompts, and character
creation. Extracting a map requires navigating all of that. The solution is
`run_dumpmap.py`, a Python script that:

1. Creates a `.nethackrc` forcing Wizard mode + a fixed role/race/alignment
2. Spawns a tmux session running the patched NetHack binary
3. Sends keystrokes to navigate character creation and menus
4. Executes `#dumpmap` to write the terrain grid
5. Reads the output file and returns the 21×80 grid

This TMux-based automation handles the variable prompts reliably across
platforms.

### The comparison test

`c_vs_js_map.test.js` generates maps from both C and JS for the same seed,
then compares cell by cell:

```
Seed 42, Depth 1:
  JS: generateTypGrid(42, 1)    → 21×80 integer grid
  C:  generateCDumpmap(42, 1)   → 21×80 integer grid (via tmux automation)
  Compare: for each (x,y), assert JS[x][y] === C[x][y]
```

Early runs showed hundreds of differences per map. The road to zero began.

## 4. Phase 3: Add RNG Call Logging

**Commits:** `324b9ef`
**Beads:** `mazesofmenace-qha`, `mazesofmenace-0n3`

When maps differ, the question is: *where did the RNG sequences diverge?* A
map-level diff can't answer this — you need to see every RNG call in order.

### C-side logging (Patch 003)

The third patch adds a preprocessor trick that logs every PRNG call with its
caller location, arguments, and return value:

```c
// In hack.h — intercepts rn2() calls with file/line info
#define rn2(x) (rng_log_set_caller(__FILE__, __LINE__), rn2(x))
```

This macro only matches function calls (with parentheses), not bare function
pointers. It uses C99's rule that a macro cannot re-expand during its own
expansion, so the `rn2(x)` in the replacement calls the real function.

Output format (one per line):
```
1 rn2(3) = 1 @ o_init.c:301
2 rn2(15) = 7 @ o_init.c:315
...
257 rn2(5) = 3 @ mklev.c:1276
258 rn2(2) = 1 @ mklev.c:545
```

### JS-side logging

The JS `rng.js` has matching logging controlled by `enableRngLog()`:

```javascript
export function enableRngLog() { rngLog = []; }
export function getRngLog()    { const log = rngLog; rngLog = null; return log; }
```

### Diffing the sequences

With both sides logging, the workflow becomes:

1. Generate C RNG log for seed 42: ~2839 calls
2. Generate JS RNG log for seed 42
3. Filter C log to `rn2`/`rnd` calls only (C logs wrapper calls like `rne`/`rnz`
   as both internal `rn2` calls AND wrapper entries; JS only logs the internals)
4. Diff the two filtered logs
5. First divergence point reveals the bug

This bisection approach was used repeatedly throughout the project.

## 5. Phase 4: Align the Pre-Level RNG Sequence

**Commits:** `e82fecf`, `e553c35`
**Beads:** `mazesofmenace-2xj`, `mazesofmenace-zqi`, `mazesofmenace-1wa`

Before `makelevel()` is called, C NetHack consumes RNG calls during startup.
The JS side must consume the same calls in the same order, or the PRNG state
at level generation entry will differ.

### What C does before generating a level

By analyzing the RNG log, the pre-makelevel sequence was identified:

| Step | C Function | RNG Calls | Purpose |
|------|-----------|-----------|---------|
| 1 | `o_init.c init_objects()` | 198 | Shuffle potion colors, scroll labels, wand materials, etc. |
| 2 | `nhlib.lua shuffle(align)` | 2 | `rn2(3)`, `rn2(2)` — shuffle alignment order |
| 3 | `dungeon.c init_dungeons` | ~13–53 | Variable: depends on Gehennom size and recursive backtracking |
| 4 | `dungeon.c init_castle_tune` | 5 | 5 × `rn2(7)` — castle tune password |
| 5 | `u_init.c` | 1 | `rn2(10)` — handedness |
| 6 | `nhlib.lua pre_themerooms` | 2 | `rn2(3)`, `rn2(2)` — shuffle alignment for themerooms |
| 7 | `bones.c` | 1 | `rn2(3)` — bones check |

Total: 198 + ~24 variable = ~222+ calls before any level geometry is generated.

### Porting o_init: 198 RNG calls exactly

The initial approach used `skipRng(257)` — just consume 257 ISAAC64 values to
approximate the C startup. This worked for some seeds but broke on others
because the dungeon init step (step 3) is variable.

The fix was to port `o_init.c` faithfully. The C function shuffles object
descriptions using Fisher-Yates variants:

```javascript
// js/o_init.js — exact port of C's shuffle_all()
function shuffle(o_low, o_high, domaterial) {
    for (let j = o_low; j < o_high; ) {
        const k = j + rn2(o_high - j + 1);
        if (objects[k].oc_name_known) continue; // retry: no description to shuffle
        // swap descriptions between objects[j] and objects[k]
        ...
        j++;
    }
}
```

The shuffled classes and their approximate call counts:
- Gem colors: 3 calls (`rn2(2)`, `rn2(2)`, `rn2(4)`)
- Amulets, potions, rings, scrolls, spellbooks, wands, venom: ~194 calls total
- WAN_NOTHING direction: 1 call (`rn2(2)`)
- **Total: exactly 198 rn2 calls** — verified against C log

### Simulating dungeon init: variable calls

The hardest part of pre-level alignment is `dungeon.c init_dungeons()`, which
uses recursive backtracking to place special levels within each branch. The
number of RNG calls depends on the seed because some placements require
backtracking (consuming extra `rn2` calls).

The solution was `simulateDungeonInit()` — a JS function that replays the
*exact* sequence of RNG calls that C makes, including the recursive
`place_level()` backtracking algorithm:

```javascript
// js/dungeon.js — simulate C's place_level() for each dungeon
function placeLevelSim(rawLevels, numLevels) {
    function doPlace(idx) {
        if (idx >= rawLevels.length) return true;
        // ... compute valid positions, excluding already-placed levels ...
        for (; npossible > 0; npossible--) {
            const nth = rn2(npossible);  // same call C makes
            // ... pick nth valid position ...
            if (doPlace(idx + 1)) return true;  // recurse
            // backtrack: remove this position, try next
        }
        return false;
    }
    doPlace(0);
}
```

The dungeon definitions (9 dungeons with their level chains) are hardcoded
from `dungeon.lua`:

```javascript
const DUNGEON_DEFS = [
    { base: 25, range: 5, hasParent: false, levels: [...] },  // Dungeons of Doom
    { base: 20, range: 5, hasParent: true, levels: [...] },   // Gehennom (11 levels)
    { base: 8,  range: 2, hasParent: true, levels: [...] },   // Gnomish Mines
    // ... Quest, Sokoban, Fort Ludios, Vlad's Tower, Planes, Tutorial
];
```

For seed 42, `simulateDungeonInit()` consumes 53 RNG calls (dungeon.c portion).
For seed 31337, it consumes 66. The variable count is now handled correctly
because the backtracking algorithm matches C exactly.

## 6. Phase 5: Port the Level Generator

**Commits:** `387fd57`, `53f6acf`, `e553c35`
**Beads:** `mazesofmenace-0sd`, `mazesofmenace-3p3`

With PRNG state aligned at `makelevel()` entry, the next step was porting the
level generator itself. C's `mklev.c` is ~2500 lines; the JS port follows
the same structure.

### Room placement: BSP rectangle splitting (rect.c)

C NetHack places rooms using a BSP algorithm from `rect.c`. A pool of free
rectangles is maintained. When a room is placed, the rectangle it occupies is
removed and the remaining space is split into new rectangles. This was ported
line-for-line:

```javascript
// js/dungeon.js — port of C's split_rects()
function split_rects(map, rx, ry) {
    for (let i = 0; i < rect_cnt; i++) {
        const r = rects[i];
        if (rx.lx > r.lx) add_rect({ lx: r.lx, ly: r.ly, hx: rx.lx - 2, hy: r.hy });
        if (rx.hx < r.hx) add_rect({ lx: rx.hx + 2, ly: r.ly, hx: r.hx, hy: r.hy });
        // ... top and bottom splits ...
        remove_rect(i); i--;
    }
}
```

### Corridors: the join() algorithm

Room connectivity uses `join()` from `mklev.c`, which digs corridors between
pairs of rooms using a direction-biased walk. The exact sequencing of `rn2`
calls during corridor digging had to match C precisely.

### Post-corridor features

After corridors, C processes: `generate_stairs()`, `make_niches()`,
`do_vault()`, `place_branch()`, `fill_ordinary_room()`, and finally
`themerooms()`. Each was ported in order, matching RNG consumption.

### Themerooms: simulating Lua

NetHack 3.7 uses Lua scripts (`themerms.lua`) for themed room decoration. The
Lua callbacks call back into C via `math.random()`, which is overridden to use
NetHack's RNG:

```lua
-- nhlib.lua (C NetHack) — overrides Lua's math.random
math.random = function(...)
    if arg_count == 1 then return 1 + nh.rn2(a) end
    if arg_count == 2 then return a + nh.rn2(b - a + 1) end
end
```

Rather than embedding a Lua interpreter, the JS port directly reimplements the
themeroom logic, calling `rn2()` in the same pattern:

```javascript
// js/dungeon.js — port of themerms.lua themeroom_fill()
function themeroom_fill(map, room) {
    const pick = rn2(3);  // matches Lua's math.random(0, 2) = rn2(3)
    if (pick === 0) {
        // fill with random monsters
        for (let x = room.lx; x <= room.hx; x++)
            for (let y = room.ly; y <= room.hy; y++)
                if (rn2(7) === 0) { /* place monster */ }
    }
    // ...
}
```

## 7. Phase 6: Port Object, Monster, and Trap Creation

**Commits:** `3706d5c`, `e82fecf`, `fcf70a9`
**Beads:** `mazesofmenace-9f9`, `mazesofmenace-6yq`, `mazesofmenace-6kd`

`fill_ordinary_room()` populates rooms with objects, monsters, traps, and
gold. Each of these creates complex chains of RNG calls.

### mkobj: object creation (~3–400+ RNG calls per object)

`mkobj()` selects a random object class via `rnd(100)`, then a random type
within that class via `rnd(prob_total)`. Then `mksobj_init()` initializes
type-specific properties — charges for wands, nutrition for food, contents
for containers. Each class has different RNG consumption:

- Coins: `rnd(level_difficulty()+2) * rnd(75)` = 2 calls
- Weapons: 3–8 calls (enchantment, erosion, bless/curse)
- Food: 5–400+ calls (corpse type selection via `rndmonnum`)
- Containers: variable (box contents create recursive mkobj calls)

### makemon: monster creation (~110–310+ RNG calls per monster)

The heaviest RNG consumer. `rndmonst_adj()` does weighted reservoir sampling
across ~382 monster types, making 110–310+ `rn2` calls per invocation. Then
`m_initweap()` and `m_initinv()` equip the monster:

```javascript
// js/makemon_gen.js — port of C's rndmonst_adj()
export function rndmonst_adj(map, depth, exclusionFlags) {
    let totalWeight = 0;
    let chosen = null;
    for (let i = 0; i < monsterTypes.length; i++) {
        if (!eligible(monsterTypes[i], depth, exclusionFlags)) continue;
        totalWeight += freq;
        if (rn2(totalWeight) < freq) chosen = monsterTypes[i];
    }
    return chosen;
}
```

### mktrap: trap creation

`traptype_rnd()` uses a `rnd(25)` loop with depth-conditional filtering:
certain traps only appear at deeper levels. The loop retries when it selects
an invalid trap type, consuming an RNG call per retry.

### Dependency chain

These three had strict ordering: mkobj depends on the object database,
makemon depends on mkobj (for monster inventory), and mktrap depends on
mkobj (for trap victims like buried objects). They were ported in order:
mktrap → mkobj → makemon.

## 8. Phase 7: Fix the Long Tail of Divergences

**Commits:** `fcf70a9`, `472d3ca`, `157ac22`, `89379b9`
**Beads:** `mazesofmenace-kk4`

After porting the major systems, the RNG log comparison would show matches
for hundreds of calls, then a divergence at some specific point. Each bug
was found by diffing the logs and reading the C source at the divergence
point.

### Examples of bugs found this way

**level_difficulty() formula.** The JS formula returned a different value
than C, causing `mkgold()` to call `rnd()` with a different argument. One
call diverges → everything after it shifts.

**next_ident ordering.** C assigns object identifiers (`o_id`) using a global
counter. The JS version incremented it at a different point, causing container
contents to generate in a different RNG order.

**m_initinv tail calls.** Some monster types get inventory items added in a
specific order. A missing item at the end of the list meant one fewer `mkobj`
call, shifting everything after.

**Venom shuffle fencepost.** The `shuffle_all()` in `o_init` had an off-by-one
in the venom class range, causing 197 RNG calls instead of 198. This shifted
every subsequent call by one.

**undead_to_corpse retry loop.** When creating corpses, C calls `rndmonnum()`
and retries if the result is an undead monster (vampires, zombies, etc.).
Each retry consumes another full `rndmonst_adj` pass of 110+ RNG calls. The
JS code initially didn't retry, causing massive divergence when a corpse was
placed.

**erosion_matters guard.** C's `mkobj_erosions()` skips erosion for objects
where it doesn't apply. A missing guard caused extra `rn2` calls.

### The debugging loop

The workflow for each bug was:

1. Run `c_vs_js_map.test.js` — see N cells differ
2. Generate RNG logs for both C and JS
3. Diff the logs to find first divergence (e.g., call #847)
4. Look at C log for call #847: `rn2(382) = 41 @ makemon.c:123`
5. Look at JS log for call #847: `rn2(100) = 55` — different function!
6. Read C source at `makemon.c:123` to understand what call was expected
7. Find the JS code that should have made that call, fix the bug
8. Re-run, see differences drop from 38 to 16 to 1 to 0

## 9. Final Result

**Commit:** `89379b9` — "Achieve 10/10 perfect C-vs-JS map alignment across
all test seeds"

```
Seed   Depth  Differences
42     1      0  ✓ PERFECT MATCH
100    1      0  ✓ PERFECT MATCH
999    1      0  ✓ PERFECT MATCH
7      1      0  ✓ PERFECT MATCH
314    1      0  ✓ PERFECT MATCH
555    1      0  ✓ PERFECT MATCH
1      1      0  ✓ PERFECT MATCH
200    1      0  ✓ PERFECT MATCH
2468   1      0  ✓ PERFECT MATCH
31337  1      0  ✓ PERFECT MATCH
```

Ten seeds, ten perfect matches. Every cell in the 21×80 terrain grid is
identical between C and JS. The PRNG state is perfectly synchronized from
ISAAC64 initialization through object shuffling, dungeon init, and the
entire level generation pipeline.

## 10. Architecture of the Test Infrastructure

The comparison testing system has multiple layers, each catching different
classes of bugs:

```
Layer 1: ISAAC64 unit tests
  └─ 500 raw uint64 values per seed match C golden files

Layer 2: RNG wrapper tests
  └─ rn2(100) sequences match C golden files

Layer 3: JS self-consistency tests
  └─ Determinism: same seed always produces same map
  └─ Dimensions: 21 rows × 80 columns
  └─ Valid terrain types: all values in [0, 38]

Layer 4: Golden reference tests (map_compare.test.js)
  └─ Visual character maps match saved golden files
  └─ Room walls are complete (no gaps)
  └─ All rooms are connected (BFS reachability)
  └─ Stairs exist and render correctly

Layer 5: C-vs-JS comparison (c_vs_js_map.test.js)
  └─ Cell-by-cell terrain type comparison
  └─ Diagnostic output with terrain type names
  └─ Graceful skip if C binary not available

Layer 6: RNG log comparison (rng_log_compare.test.js)
  └─ Call-by-call RNG sequence comparison
  └─ Finds exact divergence point with context
```

### Running the tests

```bash
# Unit + E2E tests (always available)
npm test

# C-vs-JS map comparison (requires C build + tmux)
bash test/comparison/c-harness/setup.sh      # one-time C build
node --test test/comparison/c_vs_js_map.test.js

# RNG log comparison (diagnostic)
node --test test/comparison/rng_log_compare.test.js
```

### Key files

| File | Purpose |
|------|---------|
| `js/isaac64.js` | ISAAC64 algorithm (BigInt port) |
| `js/rng.js` | RNG wrappers + logging + skipRng |
| `js/o_init.js` | Object description shuffling (198 calls) |
| `js/dungeon.js` | Level generator + `simulateDungeonInit()` |
| `js/mkobj_gen.js` | Object creation (mkobj/mksobj) |
| `js/makemon_gen.js` | Monster creation (makemon/rndmonst_adj) |
| `test/comparison/c-harness/setup.sh` | C binary build script |
| `test/comparison/c-harness/patches/` | Three C patches |
| `test/comparison/c-harness/run_dumpmap.py` | TMux-based C map extraction |
| `test/comparison/c_vs_js_map.test.js` | Cell-by-cell comparison test |
| `test/comparison/rng_log_compare.test.js` | Call-by-call RNG comparison |
| `test/comparison/gen_typ_grid.js` | JS map grid generator |

---

## Chronological Summary

| Date | Commit | Milestone |
|------|--------|-----------|
| Day 1 | `4c4b0e5` | Initial commit: core JS port with xoshiro128** |
| Day 1 | `0c296c7` | ISAAC64 ported, BigInt, bit-for-bit C match |
| Day 1 | `342f2f5` | C comparison framework + golden references |
| Day 1 | `324b9ef` | RNG call logging on both C and JS sides |
| Day 1 | `387fd57` | BSP room placement (rect.c), corridors, niches, secret doors |
| Day 1 | `53f6acf` | Post-corridor: vaults, branches, fill_ordinary_room |
| Day 1 | `e553c35` | Themeroom simulation (Lua → JS) |
| Day 1 | `3706d5c` | mktrap, mkobj, makemon ported from C |
| Day 1 | `e82fecf` | o_init.c object shuffling + next_ident fix |
| Day 1 | `fcf70a9` | level_difficulty, mkgold, m_initinv tail fixes |
| Day 1 | `472d3ca` | is_armed guard, undead_to_corpse, erosion_matters |
| Day 2 | `157ac22` | Venom shuffle fencepost, expanded test seeds |
| Day 2 | `89379b9` | **10/10 perfect C-vs-JS map alignment** |

---

Phase 2 continues in [PHASE_2_GAMEPLAY_ALIGNMENT.md](PHASE_2_GAMEPLAY_ALIGNMENT.md).
