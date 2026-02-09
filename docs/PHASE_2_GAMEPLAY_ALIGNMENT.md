# Achieving Bit-Exact Per-Turn Gameplay Between C NetHack and JavaScript

> *"The dungeon maps match perfectly. But can you survive one turn of play?"*

Phase 1 proved that WebHack could generate **identical dungeon maps** to C
NetHack, cell for cell. But a map is just the starting position. The moment
a player takes a step, the kitten follows, a jackal wakes up, and the game
loop ticks forward — consuming dozens of RNG calls per turn in an order
dictated by monster AI, vision geometry, combat tables, and a hundred other
subsystems. A single missing `rn2(100)` anywhere makes every subsequent
random decision diverge.

Phase 2 extends the bit-exact alignment from static map generation to
**live gameplay**: 66 turns of a human-played session on seed 1, every RNG
call in every turn matching the C reference, turn for turn, call for call.

## Table of Contents

1. [The Goal](#1-the-goal)
2. [The Session Format](#2-the-session-format)
3. [Capturing C Reference Data](#3-capturing-c-reference-data)
4. [Post-Level Initialization](#4-post-level-initialization)
5. [The Per-Turn Game Loop](#5-the-per-turn-game-loop)
6. [Monster Movement AI](#6-monster-movement-ai)
7. [Pet Behavior: dog_move](#7-pet-behavior-dog_move)
8. [The Vision System](#8-the-vision-system)
9. [Combat](#9-combat)
10. [The Long Tail of Gameplay Bugs](#10-the-long-tail-of-gameplay-bugs)
11. [Final Result](#11-final-result)
12. [Architecture of the Test Infrastructure](#12-architecture-of-the-test-infrastructure)

---

## 1. The Goal

Play a real game of NetHack — seed 1, Valkyrie, 66 turns of walking west,
turning south, walking east — and verify that the JS port consumes the
**exact same sequence of RNG calls** as the C game at every turn. Not
approximately. Not statistically. Bit-exact: same function, same argument,
same result, same order.

Why is this hard? Because a single turn of NetHack play can involve:

- The player moves west (no RNG)
- The kitten evaluates 3 nearby food items (`rn2(100)` each via `obj_resists`)
- The kitten compares 5 adjacent positions against a goal (`rn2(3)`, `rn2(12)`)
- The kitten tracks the player through a remembered path (`gettrack`)
- A jackal across the map gets movement points (`rn2(12)` speed rounding)
- The game checks for monster spawning (`rn2(70)`)
- The game checks for ambient dungeon sounds (`rn2(400)`, `rn2(200)`, ...)
- The player gets hungry (`rn2(20)`)
- The game checks for engraving erosion (`rn2(82)`)

Miss any one of these, and every call after it shifts by one. The only way
to verify alignment is to capture the complete RNG trace from C and compare
it call-by-call against JS.

## 2. The Session Format

Phase 1 used simple typGrid arrays to compare maps. Phase 2 required a richer
format: the **session file**, a single JSON document carrying everything
needed to replay and verify a complete game.

```jsonc
{
  "version": 2,
  "seed": 1,
  "type": "gameplay",
  "character": { "role": "Valkyrie", "race": "human", "gender": "female" },
  "startup": {
    "rngCalls": 2353,
    "rng": ["rn2(2)=1 @ o_init.c:88", ...],
    "typGrid": [[0, 0, ...], ...],
    "screen": ["───── ──────── ──", ...]
  },
  "steps": [
    {
      "key": ":",  "action": "look",  "turn": 0,
      "rng": [],
      "screen": [...]
    },
    {
      "key": "h",  "action": "move-west",  "turn": 1,
      "rng": [
        "rn2(5)=3 @ distfleeck(monmove.c:538)",
        "rn2(100)=83 @ obj_resists(zap.c:1467) [dog_goal]",
        ...
      ],
      "screen": [...]
    }
  ]
}
```

The key innovation is the **per-step RNG trace**. Each step records every
`rn2`/`rnd`/`rn1` call made between one player keystroke and the next,
annotated with the C source location and a context tag (`[dog_goal]`,
`[dog_move/food]`, `[dog_invent]`). These annotations became the primary
debugging tool — when JS diverged, the C annotation at the divergence point
told you exactly which subsystem was wrong.

## 3. Capturing C Reference Data

The C reference harness builds on the tmux-based automation from Phase 1,
extended with two capabilities:

**Per-call RNG logging.** The C PRNG patch intercepts every `rn2()` call
with a macro that records the caller's file, line, and function name:

```c
#define rn2(x) (rng_log_set_caller(__FILE__, __LINE__, __func__), rn2(x))
```

Output: `rn2(100)=83 @ obj_resists(zap.c:1467)`. The context tags
(`[dog_goal]`, `[dog_move/food]`) are added by a post-processing step that
maps C function call sites to semantic labels.

**Screen capture.** After each keystroke, the harness captures the 24×80
terminal state via `tmux capture-pane`. This provides ground-truth screen
output including the status line (HP, attributes, dungeon level), which is
used during replay to synchronize game state.

**Session planning.** The `plan_session.py` script generates a keystroke
sequence for a given seed, choosing actions that exercise interesting
mechanics: movement in all directions, corridor traversal, room entry,
stair descent. The `run_session.py` script then plays these keystrokes
through C NetHack, capturing the full session.

## 4. Post-Level Initialization

Before the first turn, C NetHack runs a startup sequence that consumes
~100 RNG calls after map generation: creating the pet, distributing the
player's starting inventory, rolling attributes, and scheduling the first
clairvoyance event. Each of these had to be ported exactly.

### makedog: pet creation

`makedog()` places a kitten (or pony) adjacent to the player. The placement
algorithm is surprisingly specific: C collects all valid adjacent coordinates
in row-major order, then shuffles them with Fisher-Yates, then picks the
first open position. The shuffle consumes one `rn2()` per coordinate:

```javascript
// js/u_init.js — port of C's makedog() coordinate selection
function collectCoordsShuffle(map, cx, cy) {
    const coords = [];
    for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
            if (isok(cx+dx, cy+dy) && ACCESSIBLE(map.at(cx+dx, cy+dy).typ))
                coords.push({ x: cx+dx, y: cy+dy });
    // Fisher-Yates shuffle: one rn2() per element
    for (let i = coords.length - 1; i > 0; i--) {
        const j = rn2(i + 1);
        [coords[i], coords[j]] = [coords[j], coords[i]];
    }
    return coords;
}
```

The pet then gets HP (`rnd(4)` for level-1 creatures), gender (`rn2(2)`),
and a `peace_minded` check that only consumes RNG for neutral-aligned
players with non-pony pets.

### Starting inventory and attributes

Each of the 13 roles has a different starting inventory table. Some items
are conditional — an Archeologist has a 10% chance (`rn2(10)`) for a tin
opener, a 25% chance (`rn2(4)`) for a lamp. These conditional branches
must fire in the same order as C, or the RNG shifts.

Attribute distribution uses a 75-point budget allocated across 6 stats with
weighted random selection, then a per-attribute variation pass where each
stat has a 20% chance (`rn2(5)`) of being tweaked by `rn2(7)-2`.

### The edog initialization trap

C initializes the pet's `edog` struct with zero-filled memory
(`newmonst(sizeof(struct edog))`). The `ogoal` field — used for
out-of-sight goal caching — starts at `{x:0, y:0}`. The JS code initially
used `{x:-1, y:-1}`, which is truthy — causing the redirect logic to
read a spurious goal from a previous turn. Fixing this to `{x:0, y:0}`
eliminated a class of intermittent goal mismatches.

## 5. The Per-Turn Game Loop

After the player acts, C's `moveloop_core()` runs a fixed sequence of
end-of-turn effects. Each consumes RNG in a specific order:

```
movemon()                    — monster AI (variable, 5-30+ calls)
mcalcmove() × each monster   — speed rounding: rn2(NORMAL_SPEED) per monster
rn2(70)                      — random monster spawn check
rn2(100)                     — HP regeneration (if hurt)
dosounds()                   — ambient sounds: rn2(400), rn2(300), rn2(200)...
rn2(20)                      — hunger/gethungry
rn2(19)                      — exercise check (every 10 turns)
rn2(40 + dex×3)              — engraving erosion
rn1(31, 15)                  — clairvoyance scheduling (if due)
```

The JS port replicates this sequence in `simulateTurnEnd()`. The order
matters absolutely — if `dosounds()` comes before `mcalcmove()`, every
call after shifts.

### The dosounds chain

Ambient dungeon sounds depend on room features. C checks each feature type
in a fixed order, consuming one `rn2()` per check:

```javascript
// js session_helpers.js — port of C's dosounds() from sounds.c
if (f.nfountains && !rn2(400)) rn2(3);     // fountain message
if (f.nsinks && !rn2(300)) rn2(2);          // sink message
if (f.has_court && !rn2(200)) { }           // throne room
if (f.has_swamp && !rn2(200)) rn2(2);       // swamp
if (f.has_vault && !rn2(200)) rn2(2);       // vault guard
if (f.has_beehive && !rn2(200)) { }         // bees
if (f.has_morgue && !rn2(200)) { }          // undead
if (f.has_barracks && !rn2(200)) rn2(3);    // soldiers
if (f.has_zoo && !rn2(200)) { }             // zoo
if (f.has_shop && !rn2(200)) rn2(2);        // shopkeeper
if (f.has_temple && !rn2(200)) { }          // temple
```

The `rn2(200)` call is always consumed regardless of whether the feature
exists. Only the *follow-up* call (the message type selection) is
conditional on both the feature existing AND the 1-in-200 check passing.

### The seerTurn trap

C's clairvoyance timer starts at 0, meaning the check `moves >= seerTurn`
fires on turn 1, consuming `rn1(31, 15)` to schedule the next event. This
was initially missed because the JS timer started at a value that prevented
the turn-1 fire.

## 6. Monster Movement AI

The most complex Phase 2 subsystem. Every non-sleeping monster on the level
gets a chance to act each turn, and the order and logic of their actions
must match C exactly.

### movemon: the outer loop

`movemon()` iterates the monster list (LIFO order — last created moves
first), giving each monster one action per `NORMAL_SPEED` units of
accumulated movement:

```javascript
for (const mon of map.monsters) {
    if (mon.dead) continue;
    while (mon.movement >= NORMAL_SPEED) {
        mon.movement -= NORMAL_SPEED;
        dochug(mon, map, player, display, fov);
    }
}
```

### dochug: the decision tree

`dochug()` implements a multi-phase decision tree from `monmove.c`:

**Phase 2 — Sleep check:** Always consumes `rn2(5)` regardless of whether
the monster is asleep. This was a subtle catch — the call happens even when
the monster stays asleep and does nothing.

**Phase 3 — Condition evaluation:** A complex short-circuit OR chain that
determines whether the monster moves or attacks:

```c
// C ref: monmove.c — the condition evaluation
if (dist2(mx, my, ux, uy) > 36   // far away
    || !rn2(5)                     // random chance
    || (mon->mflee && !mon->mfleetim)  // fleeing
    // ... more conditions ...
    )
    // move
else
    // attack
```

The `||` short-circuits: if an earlier condition is true, later `rn2()`
calls are skipped. Matching C's evaluation order is critical.

**Phase 4 — Move or attack:** Tame monsters call `dog_move()`, hostile
monsters call `m_move()`.

### mfndpos: position collection

Both `dog_move` and `m_move` start by collecting valid adjacent positions
via `mfndpos()`. This function iterates in **column-major order** (x outer,
y inner), which determines the position indices used in all subsequent
distance comparisons. Getting this order wrong would change which `rn2(12)`
corresponds to which position.

Positions are filtered by terrain, doors, other monsters, the player, and
boulders. One critical filter was discovered during Phase 2 debugging:

### The diagonal-through-door rule

C's `mfndpos()` (mon.c:2228) prevents diagonal movement through doorways:

```c
if (nx != x && ny != y
    && ((IS_DOOR(nowtyp) && (doormask & ~D_BROKEN))
     || (IS_DOOR(ntyp) && (doormask & ~D_BROKEN))))
    continue;
```

If either the monster's current position or the target position is a
non-broken door, diagonal moves are blocked. This is a fundamental NetHack
rule — you can only enter or exit a doorway cardinally.

The JS port was missing this check entirely. The consequence: with a kitten
at `(56,3)` next to an open door at `(55,4)`, JS allowed the diagonal move
(6 positions) while C blocked it (5 positions). This changed the position
evaluation from `rn2(12)` to `rn2(3)`, cascading through every subsequent
turn. The fix was adding the diagonal-through-door check to `mfndpos()`.

### How the bug was found: reading the argument

The C trace for the divergent turn showed `rn2(20)` in a backtrack
avoidance call. Since `rn2(MTSZ * (k - j))` with MTSZ=4 gives
`4 × (k - j) = 20`, this meant `k = 5` uncursed positions. But JS had 6.
That single number — `20` instead of `24` — pointed directly to mfndpos
returning a different position count, leading to the missing diagonal check.

This technique — **inferring C's internal state from RNG arguments** —
became the primary debugging method for Phase 2.

## 7. Pet Behavior: dog_move

Pet AI is the most RNG-intensive subsystem per turn. A single kitten
evaluating its options can consume 5–15 RNG calls, and the logic has
several phases that each required careful porting.

### dog_invent: inventory management

Before evaluating where to move, the pet checks its current position for
items to eat or pick up (C ref: dogmove.c:396-477):

```javascript
// If pet has items, maybe drop one
if (hasDroppables) {
    if (!rn2(udist + 1) || !rn2(edog.apport))
        if (rn2(10) < edog.apport)
            // drop item
}
// If no items, check floor for food or pickups
else {
    const food = dogfood(mon, floorObj, turnCount);  // rn2(100) via obj_resists
    if (edible) dog_eat(...);
    else if (rn2(20) < edog.apport + 3)  // pickup check
        if (rn2(udist) || !rn2(edog.apport))
            // pick up item
}
```

Each `dogfood()` call consumes `rn2(100)` via `obj_resists()`, even for
items the pet won't eat. Missing `dog_invent` entirely caused step 44 to
diverge — the C trace had extra `rn2(100)` + `rn2(20)` calls that JS
wasn't producing.

### dog_goal: object scanning

The pet scans all objects within a 5-tile radius for food and items worth
fetching. Each object is classified by `dogfood()` — consuming `rn2(100)`
per object — and the best goal is selected:

| Classification | Value | Behavior |
|---------------|-------|----------|
| DOGFOOD (0) | Best food | Direct approach |
| CADAVER (1) | Edible corpse | Direct approach |
| ACCFOOD (2) | Acceptable food | Approach if hungry |
| MANFOOD (3) | Human food | Carry for master |
| APPORT (4) | Non-food item | Fetch if in sight |
| POISON–TABU (5–7) | Bad/forbidden | Ignore |

### Follow-player and the out-of-sight redirect

If the pet doesn't find good food nearby, it follows the player. But what
if it can't *see* the player? C has an elaborate redirect system
(dogmove.c:614-647) that was completely missing from the initial JS port:

1. **gettrack:** Search a 100-entry circular buffer of player positions
   for the most recent position adjacent to the pet. If found, use it
   as the goal. This lets the pet follow the player's trail.

2. **ogoal:** If no track entry is adjacent, reuse the goal from a
   previous turn (stored in `edog.ogoal`). This provides continuity
   when the pet is far from the player's path.

3. **wantdoor:** As a last resort, find the nearest cell visible from
   the pet that's closest to the player, using line-of-sight checks.
   This gives the pet a direction to start moving.

Implementing the full player track system (`track.c`: 100-entry circular
buffer with `settrack()` called after each turn, `gettrack()` returning
the first adjacent entry iterating newest-to-oldest) fixed the step 41
divergence.

### Position evaluation: the rn2(3)/rn2(12) signature

The position evaluation loop compares each adjacent position against the
goal using squared distance:

```javascript
const j = (dist2(nx, ny, gx, gy) - dist2(nix, niy, gx, gy)) * appr;

if ((j === 0 && !rn2(++chcnt)) || j < 0      // equal or better
    || (j > 0 && !whappr                       // worse, but maybe accept
        && ((omx === nix && omy === niy && !rn2(3)) || !rn2(12)))) {
    nix = nx; niy = ny; nidist = ndist;
}
```

The `rn2(3)` fires only when `omx === nix && omy === niy` — meaning the
pet hasn't found any better position yet. The `rn2(12)` fires when the
pet has already found a better position but might randomly accept a worse
one. Seeing `rn2(3)` vs `rn2(12)` in the C trace immediately tells you
whether the pet had found a better position before that evaluation point.

## 8. The Vision System

NetHack's vision system determines what the player can see, which affects
screen rendering and, indirectly, monster behavior (pets check whether
they can see the player). The JS port implements Algorithm C from
`vision.c` — a recursive line-of-sight scanner.

### Algorithm C

The algorithm works by scanning outward from the player in both directions
(up and down), maintaining left and right shadow boundaries:

```javascript
// js/vision.js — right_side() recursive scanner
function right_side(row, left, right_mark) {
    while (left <= right_mark) {
        // If current cell blocks vision, shrink the visible range
        // and recurse on the remaining open segment
        if (viz_clear[row][left]) {
            // ... continue scanning
        } else {
            // Wall found — recurse on the open segment we've seen so far
            if (left - 1 >= lft_mark)
                right_side(row + step, lft_mark, left - 1);
            // Skip past the wall
            while (!viz_clear[row][left] && left <= right_mark) left++;
            lft_mark = left;
        }
    }
}
```

The `viz_clear` table is precomputed from the terrain grid: each cell is
marked clear (passable to light) or blocked (walls, closed doors, boulders).
The `left_ptrs` and `right_ptrs` arrays cache shadow boundaries to speed
up the recursive scan.

### couldsee vs m_cansee

Two related but different visibility checks:

- **`couldsee(x, y)`**: Can the player see position (x,y) via line-of-sight,
  ignoring lighting? Uses the precomputed COULD_SEE bitfield from the full
  Algorithm C scan.

- **`m_cansee(mon, x, y)`**: Can a monster see position (x,y)? Uses
  Bresenham path checks (`clear_path`) from the monster's position, since
  the full Algorithm C scan is only computed for the player.

The pet AI uses `couldsee` to check `in_masters_sight` (whether the pet is
visible to the player), and `m_cansee` in the `wantdoor` fallback to find
cells the pet can actually see.

### No RNG, but affects everything

The vision system consumes zero RNG calls. But it affects what appears on
screen, which is used for screen comparison testing. Getting the FOV wrong
doesn't cause RNG divergence, but it does cause screen mismatches — a
different class of bug that's tested separately.

## 9. Combat

When the player walks into a monster (or vice versa), combat fires. The
RNG consumption is specific and ordered:

### Player attacking monster

```
rnd(20)              — to-hit roll
rn2(19)              — exercise(A_DEX) on hit
rnd(weapon.wsdam)    — damage roll (small monsters)
rn2(3)               — passive damage (if monster survives)
```

On kill, corpse generation consumes additional RNG:
```
rn2(6)               — treasure drop check
rnd(2)               — object identifier
rndmonst_adj()       — corpse monster type (110+ rn2 calls!)
rn2(2)               — corpse gender
rnz(10)              — corpse rot timer
```

### Monster attacking player

```
rnd(20+i)            — to-hit roll (i = attack index)
rn2(3)               — knockback on hit
rn2(6)               — grab/special effect
```

Each attack in the monster's attack array is processed in order. A jackal
with one claw attack generates different RNG than a soldier with three.

## 10. The Long Tail of Gameplay Bugs

Like Phase 1, the final stretch was a series of specific bugs found by
diffing RNG traces. Each bug had a characteristic signature in the
divergence pattern.

### The somexyspace terrain check

`somexyspace()` finds an empty position in a room for monster/object
placement. C checks `SPACE_POS(typ)` which means `typ > DOOR`, excluding
stairs and positions with the `SPCFLG_NOMON` flag. JS initially checked
`IS_ROOM || IS_CORR || IS_ICE` — a different set. Fixing the terrain
check to match C's `typ > DOOR` predicate aligned the position selection.

### The mineralize overcounting

C's `mineralize()` uses `rn2(1000)` not `rn2(100)` for placing gold and
gem deposits in walls (mklev.c:1504). The factor-of-10 difference meant
JS was placing deposits far too frequently, consuming extra RNG calls for
`mksobj()` and shifting everything after.

### The themeroom fill per-tile RNG

NetHack 3.7's themed rooms use Lua scripts that iterate every tile in a
room, calling `rn2(100)` per tile to decide whether to place a feature
(via `selection:percentage()` in sp_lev.c). JS was doing the selection at
the room level instead of per-tile, consuming one call instead of
`width × height` calls.

### The HP sync technique

Player HP changes during gameplay (damage from monsters, natural
regeneration). The regeneration check `rn2(100)` only fires when
`hp < hpmax`, so the JS engine must know the exact HP at each turn.
Rather than simulating all damage sources, the replay engine syncs HP
from the session's screen capture after each step:

```javascript
// session_helpers.js — sync HP from C's status line
for (const line of step.screen) {
    const hpm = line?.match(/HP:(\d+)\((\d+)\)/);
    if (hpm) { player.hp = parseInt(hpm[1]); player.hpmax = parseInt(hpm[2]); }
}
```

This "ground truth sync" approach sidesteps the need to perfectly simulate
every damage source — a pragmatic choice that let the RNG alignment work
proceed while combat simulation matured.

## 11. Final Result

```
Seed 1, Valkyrie — 67 steps, 66 turns of gameplay

Step  Action       Turn  RNG Calls  Status
0     look         0     0          MATCH
1     move-west    1     17         MATCH
2     move-west    2     17         MATCH
...
44    move-west    44    17         MATCH
45    move-west    45    18         MATCH
...
65    move-east    65    5          MATCH
66    descend      66    —          level generation (separate system)

Steps 0–65: 66/66 PERFECT MATCH
Step 66: level descent — requires getbones (not yet implemented)
```

Every turn of surface gameplay — 66 turns of movement, monster AI, pet
behavior, ambient effects, hunger, exercise — produces identical RNG traces
between C and JS. The only remaining divergence is step 66, where the
player descends stairs and C calls `getbones()` to check for bones files,
a system outside the scope of the current port.

### Progress through the debugging sessions

| Session | Steps Passing | Key Fix |
|---------|--------------|---------|
| Initial | 0/67 | No gameplay engine |
| +dosounds, seerTurn | 8/67 | Per-turn loop skeleton |
| +movemon, dog_goal | 28/67 | Monster AI framework |
| +dochug Phase 3 | 35/67 | Sleep/condition evaluation |
| +combat RNG | 40/67 | Attack/damage/corpse |
| +exercise, HP sync | 41/67 | End-of-turn effects |
| +gettrack/ogoal | 44/67 | Pet out-of-sight redirect |
| +dog_invent | 45/67 | Pet inventory management |
| +diagonal-through-door | **66/67** | mfndpos position filtering |

## 12. Architecture of the Test Infrastructure

### Session replay engine

The `HeadlessGame` class provides a minimal game engine for testing:

```javascript
class HeadlessGame {
    constructor(player, map, opts) {
        this.player = player;
        this.map = map;
        this.fov = new FOV();
        this.turnCount = 0;
        initrack();  // initialize player position tracking
    }

    simulateTurnEnd() {
        settrack(this.player);              // record player position
        this.turnCount++;
        // ... mcalcmove, rn2(70), regen, dosounds, hunger, exercise ...
    }
}
```

The `replaySession()` function drives the full replay:

1. Initialize ISAAC64 with session seed
2. Run startup (o_init, dungeon init, level generation, post-level init)
3. For each step: call `rhack()` with the keystroke, run `movemon()` +
   `simulateTurnEnd()` if the action took time, capture the RNG trace
4. Compare each step's trace against the session reference

### Test runner integration

`session_runner.test.js` auto-discovers all `.session.json` files and runs
appropriate tests based on session type:

- **Map sessions:** typGrid comparison at multiple depths + structural checks
- **Gameplay sessions:** startup verification + per-step RNG comparison
- **Chargen sessions:** character creation RNG for all 13 roles

### Key files

| File | Lines | Purpose |
|------|-------|---------|
| `js/monmove.js` | 745 | Monster AI: movemon, dochug, dog_move, m_move, mfndpos |
| `js/vision.js` | 600 | Algorithm C FOV, couldsee, m_cansee, clear_path |
| `js/dog.js` | 492 | Pet food classification, dog_eat, can_carry |
| `js/u_init.js` | 802 | Post-level init: makedog, inventory, attributes |
| `js/commands.js` | 600 | Player command dispatch: rhack, movement, stairs |
| `js/combat.js` | 250 | Attack rolls, damage, corpse creation, level-up |
| `js/player.js` | 242 | Player class with 13 roles, attributes, equipment |
| `test/comparison/session_helpers.js` | 500 | HeadlessGame, replaySession, grid/RNG comparison |
| `test/comparison/session_runner.test.js` | 350 | Unified test runner for all session types |

### The debugging method

The workflow for finding each gameplay bug:

1. Run `session_runner.test.js` — see which step fails
2. Look at the C trace annotation at the divergence point
3. The annotation tells you the function and context (`[dog_goal]`, etc.)
4. **Read the RNG argument** to infer internal state:
   - `rn2(3)` vs `rn2(12)`: has the pet found a better position?
   - `rn2(MTSZ*(k-j))`: how many positions does C's mfndpos return?
   - Count of `rn2(100)`: how many objects are being evaluated?
5. Compare inferred C state with JS state to identify the mismatch
6. Fix the bug, verify the step passes, check for new failures

This "inference from RNG arguments" technique was the breakthrough that
made Phase 2 debugging tractable. Rather than instrumenting both codebases
with matching debug output, the RNG trace itself encodes enough information
to reconstruct the internal decision state.

---

## Chronological Summary

| Commit | Milestone |
|--------|-----------|
| `2bd7eb0` | Document Phase 2 plan: 10 steps to gameplay matching |
| `5afc46b` | Per-turn loop: dosounds, seerTurn, regen_hp, step replay |
| `26dc783` | Combat RNG: hero attack, monster attack, dochug Phase 3 |
| `d1aeb6b` | End-of-turn exercise/exerper, dochug condition fix |
| `13fea84` | Weapon enchantment to-hit, corpse placement |
| `9c8c95e` | dog_eat, IS_ROOM/ACCESSIBLE terrain fixes |
| `fcda4e5` | Pet eating counter, dog_nutrition size multipliers |
| `d71904d` | HP sync from session screen data |
| *session* | +gettrack/ogoal: player track system, out-of-sight redirect |
| *session* | +dog_invent: pet inventory management |
| *session* | +diagonal-through-door: mfndpos position filtering — **66/67 steps** |

---

> *"The kitten purrs. For 66 turns it has matched its C counterpart's every
> random whim — the same food evaluated, the same positions weighed, the
> same backtrack avoided. At the staircase, you descend into the unknown.
> The bones file awaits."*
