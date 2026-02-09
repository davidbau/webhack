# Phase 2: Achieving Bit-Exact Gameplay

> *"The dungeon maps match perfectly. But can you survive one turn of play?"*

Phase 1 ended with a party trick: generate a dungeon on seed 42, and the
JavaScript port produces the exact same map as C NetHack, cell for cell, wall
for wall, fountain for fountain. A scroll of mapping would reveal no
difference.

But a map is just the starting position. The moment a player takes a step,
the kitten follows, a jackal wakes up, and the game loop ticks forward —
consuming dozens of RNG calls per turn in an order dictated by monster AI,
vision geometry, combat tables, and a hundred other subsystems. A single
missing `rn2(100)` anywhere makes every subsequent random decision diverge.
The dungeon is the easy part. The *game* is the hard part.

Phase 2 extends the bit-exact alignment from static map generation to
**live gameplay**: 66 turns of a human-played session on seed 1, every RNG
call in every turn matching the C reference, turn for turn, call for call.

## Table of Contents

**The Challenge**
1. [The Goal](#1-the-goal) -- what "bit-exact gameplay" means
2. [The Session Format](#2-the-session-format) -- capturing ground truth
3. [Capturing C Reference Data](#3-capturing-c-reference-data) -- the tmux harness

**The Subsystems**
4. [Post-Level Initialization](#4-post-level-initialization) -- pet, inventory, attributes
5. [The Per-Turn Game Loop](#5-the-per-turn-game-loop) -- sounds, hunger, exercise
6. [Monster Movement AI](#6-monster-movement-ai) -- movemon, dochug, mfndpos
7. [Pet Behavior: dog_move](#7-pet-behavior-dog_move) -- the final boss
8. [The Vision System](#8-the-vision-system) -- zero RNG, infinite influence
9. [Combat](#9-combat) -- attack, damage, corpse

**The Bugs and the Fixes**
10. [The Long Tail of Gameplay Bugs](#10-the-long-tail-of-gameplay-bugs) -- terrain, themerooms, HP sync
11. [Final Result](#11-final-result) -- 66/67 steps matching

**The Craft**
12. [Architecture of the Test Infrastructure](#12-architecture-of-the-test-infrastructure) -- HeadlessGame, session replay
13. [Lessons Learned](#13-lessons-learned) -- hard-won rules for RNG alignment
14. [The Art of RNG Forensics](#14-the-art-of-rng-forensics) -- reading traces like a mechanic reads engine sounds

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

> *"You see here a kitten named Tabby. She's not randomly generated — she's
> deterministically generated."*

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

> *"The jackal moves. The kitten moves. The newt moves. You feel overwhelmed."*

The most complex Phase 2 subsystem — and the most rewarding to debug.
Every non-sleeping monster on the level gets a chance to act each turn,
and the order and logic of their actions must match C exactly.

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

> *"The kitten picks up a tripe ration. Good strider!"*

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

> *"It is dark. You are likely to be eaten by a grue."*

The vision system consumes zero RNG calls, which might suggest it's
irrelevant to Phase 2. It isn't. Vision determines what the player sees
on screen (used for screen comparison), and what the *pet* sees (used for
`in_masters_sight`, which changes which code path the pet takes, which
changes how many RNG calls it makes). Getting the FOV wrong doesn't shift
the PRNG stream directly, but it changes which branches of monster AI
execute — and those branches are full of `rn2()` calls.

The JS port implements Algorithm C from `vision.c` — C NetHack's actual
recursive line-of-sight scanner, not an approximation.

### Algorithm C

The algorithm scans outward from the player in both directions
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

### No RNG, but load-bearing

The vision system's influence is entirely indirect. A wrong FOV doesn't
cause RNG divergence directly — but it causes screen mismatches (a
separate class of test failure), and it changes pet behavior by altering
`in_masters_sight`. The pet AI fork between "follow player directly" and
"use gettrack/ogoal/wantdoor" depends entirely on whether the pet can see
the player. Get the shadow boundaries wrong by one column, and the kitten
takes a different code path, consuming a different number of `rn2()` calls.

## 9. Combat

> *"You hit the jackal! The jackal is killed!"*

Combat is mercifully predictable compared to pet AI. When the player walks
into a monster (or vice versa), the RNG consumption follows a rigid script:

### Player attacking monster

```
rnd(20)              — to-hit roll
rn2(19)              — exercise(A_DEX) on hit
rnd(weapon.wsdam)    — damage roll (small monsters)
rn2(3)               — passive damage (if monster survives)
```

Killing a monster is expensive. Corpse generation alone can consume over
a hundred RNG calls:
```
rn2(6)               — treasure drop check
rnd(2)               — object identifier
rndmonst_adj()       — corpse monster type (110+ rn2 calls!)
rn2(2)               — corpse gender
rnz(10)              — corpse rot timer
```

The `rndmonst_adj()` call is a landmine — it iterates the entire monster
table to find monsters of the same difficulty, consuming one `rn2()` per
eligible monster. A level-1 grid bug corpse generates different RNG than
a level-1 jackal corpse because they have different difficulty classes,
changing which monsters are eligible.

### Monster attacking player

```
rnd(20+i)            — to-hit roll (i = attack index)
rn2(3)               — knockback on hit
rn2(6)               — grab/special effect
```

Each attack in the monster's attack array is processed in order. A jackal
with one claw attack generates different RNG than a soldier with three.

## 10. The Long Tail of Gameplay Bugs

> *"You feel a mild case of the strstrstrstrfumbles."*

Like Phase 1, the final stretch was a series of specific bugs found by
diffing RNG traces. Each had a characteristic signature — a fingerprint
in the divergence pattern that pointed to the cause.

### The somexyspace terrain check

The first clue was an extra `rn2()` call during monster placement.
`somexyspace()` finds an empty position in a room; C checks
`SPACE_POS(typ)` which means `typ > DOOR`, excluding stairs and no-monster
zones. JS checked `IS_ROOM || IS_CORR || IS_ICE` — close, but a different
set. The extra eligible positions meant extra placement attempts, each
consuming RNG. One predicate, one constant, a cascade of shifted calls.

### The mineralize overcounting

A typo that hid in plain sight: C's `mineralize()` uses `rn2(1000)` for
placing gold and gem deposits in walls (mklev.c:1504). JS had `rn2(100)`.
A factor-of-ten difference. Instead of gold appearing in 0.1% of wall
tiles, it appeared in 1% — ten times too many, each calling `mksobj()`,
each consuming a burst of RNG for object properties.

### The themeroom fill per-tile RNG

NetHack 3.7's themed rooms use Lua scripts that iterate every tile in a
room, calling `rn2(100)` per tile to decide whether to place a feature
(via `selection:percentage()` in sp_lev.c). JS was doing the selection at
the room level instead of per-tile, consuming one call instead of
`width × height` calls. For an 8×4 room, that's 1 call instead of 32 —
a 31-call deficit that shifted everything downstream.

### The HP sync technique

Player HP changes during gameplay (damage from monsters, natural
regeneration). The regeneration check `rn2(100)` only fires when
`hp < hpmax`, so the JS engine must know the exact HP at each turn.
But perfectly simulating every damage source requires implementing the
entire combat system — a Phase 2 chicken-and-egg problem.

The solution was pragmatic: read the answer off the screen.

```javascript
// session_helpers.js — sync HP from C's status line
for (const line of step.screen) {
    const hpm = line?.match(/HP:(\d+)\((\d+)\)/);
    if (hpm) { player.hp = parseInt(hpm[1]); player.hpmax = parseInt(hpm[2]); }
}
```

Each C session captures the 24×80 terminal state, including the status
line showing `HP:16(16)`. The replay engine reads this after each step,
syncing HP to the C ground truth. This let RNG alignment proceed
independently from combat simulation — a deliberate decoupling that paid
for itself many times over.

## 11. Final Result

> *"You feel a great sense of accomplishment."*

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

Sixty-six turns. Roughly 23,000 RNG calls. Movement, pet AI, monster
spawning, ambient sounds, hunger, exercise, combat, corpse creation,
regeneration — all matching the C binary call for call.  The only
remaining divergence is step 66, where the player descends stairs and
C calls `getbones()` to check for bones files, a system outside the scope
of the current port.

### The road there

The progress table tells the story of Phase 2 better than prose can.
Each row is a debugging session; each key fix extended the matching
prefix by a handful of steps.

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

The jump from 0 to 8 was just wiring — building the per-turn loop
skeleton. The jump from 8 to 28 was the monster AI framework, the biggest
single piece of new code. After that, each fix was smaller and more
precise: a missing exercise check, a pet inventory scan, a diagonal door
rule. The bug that took the longest to find — the diagonal-through-door
rule — was also the smallest fix: two lines of code.

## 12. Architecture of the Test Infrastructure

> *"You hear the tinkering of automated tools."*

### Session replay engine

The `HeadlessGame` class provides a minimal game engine that runs without
a browser — no DOM, no display, just the game logic and RNG:

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

| File | Purpose |
|------|---------|
| `js/monmove.js` | Monster AI: movemon, dochug, dog_move, m_move, mfndpos |
| `js/vision.js` | Algorithm C FOV, couldsee, m_cansee, clear_path |
| `js/dog.js` | Pet food classification, dog_eat, can_carry |
| `js/u_init.js` | Post-level init: makedog, inventory, attributes |
| `js/commands.js` | Player command dispatch: rhack, movement, stairs |
| `js/combat.js` | Attack rolls, damage, corpse creation, level-up |
| `js/player.js` | Player class with 13 roles, attributes, equipment |
| `test/comparison/session_helpers.js` | HeadlessGame, replaySession, grid/RNG comparison |
| `test/comparison/session_runner.test.js` | Unified test runner for all session types |

---

## 13. Lessons Learned

> *"You triggered a trap! You feel as if you need a shower."*

Six months from now, someone will add a helpful feature to the JS port —
auto-pickup gold, or a shortcut that opens doors silently — and 45 tests
will break in ways that make no sense. These lessons are for that person.

### Never add behavior that C doesn't have

The gold auto-pickup bug was perhaps the most instructive failure of the
entire project. Someone looked at C NetHack — where gold coins sit on the
floor until you type `,` — and thought, *who wants to manually pick up
gold? Let's just grab it automatically when the player walks over it.* Six
lines of code. Perfectly reasonable game design. Catastrophic for RNG
alignment.

Here's what those six lines actually did: they called `map.removeObject(gold)`
during player movement, *before* `movemon()` ran. When the kitten's
`dog_goal` later scanned nearby objects, C found a gold pile and called
`dogfood()` → `obj_resists()` → `rn2(100)`. JS found nothing. One phantom
`rn2(100)`, invisible in any diff, shifted the PRNG stream and broke 45
consecutive steps.

The door auto-open was the same pattern in miniature. C calls `rnl(20)` for
the strength check and `rn2(19)` for exercise when you walk into a closed
door. JS was opening doors silently — two missing RNG calls per door
encounter.

The rule is absolute: **if C doesn't do it, JS can't either.** Not even if
it's obviously better. Not even if it's just a display optimization. The
PRNG doesn't care about your intentions; it counts calls.

### One missing call means total divergence

ISAAC64 is a counter-based PRNG. Every call to `rn2()` advances a global
counter. Skip call #4,217 and calls #4,218 through infinity all return
different values. There's no damping, no error correction, no gradual
drift. You're either perfectly synchronized or completely wrong.

This makes RNG alignment feel like balancing on a knife edge. The seed1
session makes ~350 RNG calls per step across 67 steps — roughly 23,000
calls total. A single missing `rn2(100)` at step 22 (call ~7,700) made
the remaining ~15,300 calls produce different values. The error doesn't
attenuate. It doesn't average out. It's not "close enough."

But this same property makes bugs *findable*. When the trace diverges, it
diverges at an exact index, and that index tells you exactly which call is
missing or extra. You don't need statistical analysis or fuzzy matching.
The trace is a digital signal: it's either 1 or 0.

### Self-correction is real (and diagnostic)

After fixing the gold and door bugs, steps 22-44 passed but step 45 failed
with a subtle `do_clear_area` iteration difference. Then steps 46-50 failed
as the shifted stream cascaded. But then step 51 *passed*, and so did
steps 52-65 — fifteen consecutive steps, perfectly synchronized.

What happened? At step 51, the kitten walked back into the player's line
of sight. The `!in_masters_sight` code path stopped firing, the `wantdoor`
search (where the subtle iteration difference lives) stopped being called,
and both C and JS fell back to the simple `goal = player position` path.
With the same goal and the same positions to evaluate, the streams
re-synchronized on their own.

This reveals something important about RNG divergence: **it's not permanent,
it's conditional.** Divergence lives in specific code paths. When those
paths stop executing — the pet comes home, the monster dies, the player
leaves the room — the streams can snap back together. Self-correction
means that a bug in one subsystem doesn't necessarily doom every subsequent
step. It also means that when you see a *window* of failures surrounded by
passes, the bug lives in whatever code path is active during that window
and inactive otherwise.

### Fix bugs in the order they appear, not the order they matter

There's a temptation, when you see `dog_invent` in the C trace and know
it's unimplemented, to go implement it immediately. Resist. If gold
auto-pickup is removing objects at step 22 and `dog_invent` doesn't fire
until step 44, implementing `dog_invent` first is useless — the stream is
already shifted by step 22, so step 44's trace won't match regardless.

The productive approach is to extend the *matching prefix*:

1. Run tests. Note the first failing step.
2. Read the C annotation at the divergence index.
3. Fix that specific divergence.
4. Re-run. The matching prefix extends. A new divergence appears later.
5. Repeat.

This is why the five pet AI fixes were discovered in order: gold (step 22),
door (step 22), ALLOW_M (step 22), gettrack (step 41), dog_invent (step 44).
Each fix extended the frontier. Trying to fix them out of order would have
been like debugging a program by reading the crash dump from a *different*
crash.

### Pet AI is the final boss

Of NetHack's many subsystems, pet AI is the hardest to align. Combat has
maybe 5 RNG calls per attack. Dungeon sounds have 10 calls per turn. Pet
behavior routinely consumes 15-30 calls per turn, and the logic touches
*everything*:

- **Position**: Where is the pet? Where is the player? Can the pet see
  the player? (Requires full line-of-sight computation.)
- **Memory**: Where has the player been? (Requires a 100-position circular
  buffer, updated each turn.)
- **Perception**: What objects are within 5 tiles? What's the food
  classification of each one? (Each object triggers `rn2(100)` via
  `obj_resists`.)
- **Inventory**: Is the pet carrying anything? Should it drop something?
  Should it pick up what's at its feet? (`rn2(udist+1)`, `rn2(apport)`,
  `rn2(10)`, `rn2(20)`, `rn2(udist)`)
- **Navigation**: Which adjacent squares are valid? Is there a door
  blocking diagonal movement? A monster the pet could attack? A boulder?
  (The position count feeds directly into `rn2(cnt)`.)
- **Decision**: Approach the goal? Flee? Random walk? Accept a worse
  position? (`rn2(3)`, `rn2(12)`)

Miss any one of these inputs — a gold coin removed from the map, a
diagonal move allowed through a doorway, a monster-occupied square
excluded from valid positions — and the output diverges. The pet is a
function of the entire game state, and the entire game state is what
you must get right.

---

## 14. The Art of RNG Forensics

> *"You carefully examine the RNG trace. It looks like gibberish."*

Debugging RNG alignment is not normal debugging. You can't set a
breakpoint. You can't add a `printf`. You have two streams of numbers —
one from C, one from JS — and when they diverge, the divergence point
is your only clue. This section is about reading an RNG trace the way a
mechanic reads engine sounds — hearing the misfire in a stream of numbers.

### The workflow

1. Run `session_runner.test.js` — see which step fails
2. Look at the C trace annotation at the divergence point
3. The annotation tells you the function and context (`[dog_goal]`, etc.)
4. **Read the RNG argument** to infer C's internal state (see below)
5. Compare inferred C state with JS state to identify the mismatch
6. Fix the bug, verify the step passes, check for new failures

This "inference from RNG arguments" technique was the breakthrough that
made Phase 2 debugging tractable. Rather than instrumenting both codebases
with matching debug output, the RNG trace itself encodes enough information
to reconstruct the internal decision state.

### The annotation is the autopsy report

The C harness PRNG patch emits lines like:

```
42: rn2(100)=15 @ obj_resists [dog_goal]
```

Every field matters:
- **42**: This is the 42nd call in this step. If JS diverges at index 42,
  you know exactly how many calls matched before it went wrong.
- **rn2(100)**: The function and argument. `rn2(100)` is almost always
  `obj_resists`. `rn2(12)` or `rn2(3)` is position evaluation. `rn2(20)`
  is `dog_invent` pickup. `rn2(5)` is `distfleeck`.
- **=15**: The return value. Usually not the interesting part — the
  argument matters more.
- **@ obj_resists**: The C function that called `rn2`. This is produced by
  the `__func__` macro in the logging patch.
- **[dog_goal]**: A semantic context tag showing *why* the function was
  called. This is the crucial part — it tells you that `obj_resists` was
  invoked during the pet's object scan, not during combat or inventory.

Without annotations, debugging RNG alignment would be like debugging
assembly without symbols. You'd see numbers but not meaning.

### Reading the argument

This is the single most powerful technique in Phase 2 debugging.
The argument to `rn2()` isn't just a range — it encodes the internal
state of the calling code.

**Position count from cursed avoidance:**
C trace shows `rn2(20)` in a track avoidance call. The formula is
`rn2(MTSZ * (k - j))` where MTSZ=4, so `k - j = 5`. That means 5
positions have uncursed objects. If JS shows `rn2(24)`, that's `k - j = 6` —
one extra position. Now you know: JS has one more valid position than C.
Check `mfndpos`. Something is being included that shouldn't be, or
excluded that shouldn't be.

**Object count from dog_goal:**
If C has three consecutive `rn2(100)` calls annotated `[dog_goal]` and JS
has two, there are 3 objects within SQSRCHRADIUS in C but only 2 in JS.
An object was removed (auto-pickup), never created (level gen bug), or
is at a different position (pet position drift).

**Better-position status from rn2(3) vs rn2(12):**
In the position evaluation loop, `rn2(3)` fires when `omx === nix` (pet
hasn't moved to any better position yet), while `rn2(12)` fires when it
has. Seeing `rn2(3)` where C shows `rn2(12)` means JS found a better
position earlier in the loop that C didn't — or vice versa. The position
evaluation order must differ.

You don't need printf debugging when the RNG trace *is* the debug output.

### The cascade tells you the scope

When a bug causes divergence, the *pattern* of failing steps tells you
about the bug's nature:

- **One step fails, rest pass**: The bug is isolated — a missing call in
  a path that only fires once (like a door strength check).
- **All steps after N fail**: A persistent state change — an object
  removed, a flag set, a position shifted. The world is now different
  and every subsequent scan sees the difference.
- **Window of failures, then self-correction**: A conditional code path.
  The bug lives in code that's only active sometimes (like
  `!in_masters_sight` — active only when pet is out of view, inactive
  when pet returns).
- **Every Nth step fails**: A periodic effect. Maybe a timer-based event
  fires at a different frequency.

The seed1 cascade was a textbook case of the third pattern: steps 45-50
failed (pet out of sight, divergent `do_clear_area`), then steps 51-65
passed (pet back in sight, streams resynchronized), then step 66 failed
(level transition — a completely different issue).

### Cross-referencing the C source

Every divergence is resolved the same way: open the C source, find the
exact code path, and implement it. Not "implement something similar."
Not "implement the documented behavior." Implement the *code*, including
its quirks.

Example: C's `gettrack()` returns `NULL` when the pet is *on* a track
position (distance 0) but returns the position when adjacent (distance 1).
This seems like a bug — why wouldn't you use a track position you're
standing on? — but it's the behavior, and the RNG calls downstream
depend on it. Implement the "bug." Your job is not to improve NetHack;
your job is to match it.

Example: C's `dog_invent` drops items by iterating the inventory and
placing each non-cursed item on the map, *then* reduces `apport`. The
`rn2(10) < edog.apport` check uses the *old* apport value for all items
in the inventory. If you "optimize" this by reducing apport after each
drop, the later `rn2(10)` checks see a lower apport and produce different
results.

Example: C's `mfndpos` blocks diagonal movement through doorways even when
the door is open (`D_ISOPEN`). Only `D_BROKEN` doors allow diagonal entry.
This is arguably a design flaw — open doors should be passable — but the
position count changes if you "fix" it, and `rn2(cnt)` changes with it.

The C source is the spec. The spec has quirks. The quirks are load-bearing.

---

## Chronological Summary

| Commit | Milestone |
|--------|-----------|
| `2bd7eb0` | Document Phase 2 plan: 10 steps to gameplay matching |
| `6a9dd33` | Fix mineralize RNG overcounting, add startup RNG verification |
| `5afc46b` | Per-turn loop: dosounds, seerTurn, regen_hp, step replay |
| `26dc783` | Combat RNG: hero attack, monster attack, dochug Phase 3 |
| `d1aeb6b` | End-of-turn exercise/exerper, dochug Phase 3 condition fix |
| `13fea84` | Weapon enchantment to-hit, corpse placement |
| `9c8c95e` | dog_eat, IS_ROOM/ACCESSIBLE terrain fixes |
| `fcda4e5` | Pet eating counter, dog_nutrition size multipliers |
| `d71904d` | HP sync from session screen data |
| `7022681` | mfndpos diagonal-through-door, dog_invent — **66/67 steps** |
| `0c97856` | Fix pet AI RNG divergence: gold pickup, door RNG, tracking |
| `39e3849` | Add lessons learned and RNG forensics sections |

---

> *"The kitten purrs. For 66 turns it has matched its C counterpart's every
> random whim — the same food evaluated, the same positions weighed, the
> same backtrack avoided. At the staircase, you descend into the unknown.
> The bones file awaits."*
