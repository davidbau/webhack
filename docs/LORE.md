# Porting Lore

> *You descend into the library. The shelves are lined with scrolls — some*
> *blessed, some cursed, all hard-won. Each records a lesson from the long*
> *campaign to rebuild the Mazes of Menace in JavaScript, stone by stone,*
> *random number by random number.*

These are the durable lessons learned during C-to-JS porting. When you
encounter a parity divergence that doesn't make sense, read here first —
the answer may already be written in blood.

For the full narratives of how these lessons were discovered, see the
[Phase chronicles](#phase-chronicles) at the end of this document.

---

## The Cardinal Rules

### 1. The RNG is the source of truth

If the RNG sequences diverge, everything else is noise. A screen mismatch
caused by an RNG divergence at step 5 tells you nothing about the screen
code — it tells you something consumed or failed to consume a random number
at step 5. Fix the RNG first. Always.

### 2. Read the C, not the comments

C comments lie. C code does not. When porting behavior, trace the actual
execution path in C and replicate it exactly. Comments explain intent, but
parity requires matching *implementation*, including its bugs. When a comment
says "this does X" and the code does Y, port Y.

### 3. Follow the first divergence

The test harness reports the first mismatch per channel for a reason. Every
subsequent mismatch is a cascade. Fix the first one, re-run, and repeat.
Chasing divergence #47 when divergence #1 is unsolved is like fighting the
Wizard of Yendor while the Riders watch — dramatic, but unproductive.

---

## RNG Parity

### STR18 encoding: attribute maximums are not what they seem

C uses `STR18(x) = 18 + x` for strength maximums. A human's STR max is
`STR18(100) = 118`, not `18`. When attribute redistribution rolls `rn2(100)`
and the attribute hasn't hit its max, C continues — but JS with `max=18`
stops early, causing an extra RNG retry. Every retry shifts the entire
sequence.

```c
// attrib.h:36
#define STR18(x) (18 + (x))
// Human STR max = STR18(100) = 118
// Gnome STR max = STR18(50) = 68
```

*Source: `src/role.c`, `src/attrib.c`. See [RNG_ALIGNMENT_GUIDE.md](RNG_ALIGNMENT_GUIDE.md).*

### Loop conditions re-evaluate on every iteration

In C, `for (i=1; i<=d(5,5); i++)` evaluates `d(5,5)` once. In JavaScript,
the condition is re-evaluated every iteration. If the condition contains an
RNG call, JS consumes RNG on every loop pass while C consumed it once.
Always hoist RNG calls out of loop conditions.

```javascript
// WRONG: calls d() up to N times
for (let i = 1; i <= d(5, 5); i++) { ... }

// RIGHT: calls d() exactly once
const count = d(5, 5);
for (let i = 1; i <= count; i++) { ... }
```

*This is the single most common source of RNG drift in ported code.*

### RNG log filtering rules

C's RNG logs exclude certain entries that JS may initially count:

- **Composite entries** (`d(6,6)=17`, `rne(4)=2`, `rnz(10)=2`) — C logs
  only the composite result, not individual dice rolls
- **Midlog markers** (`>makemon`, `<makemon`) — function entry/exit bookmarks,
  not RNG calls
- **Source tags** (`rn2(5) @ foo.c:32`) — the `@ location` suffix is stripped
  before comparison

The comparator in `comparators.js` handles this normalization. If you add new
RNG instrumentation, ensure it follows these conventions.

### rn2(1) is the canonical no-op RNG consumer

When you need to advance the RNG without using the value (to match C's
consumption pattern), use `rn2(1)`, which always returns 0 and consumes
exactly one call. Do not use `rn2(100)` or any other value — the modulus
affects the internal state.

---

## Special Levels

### Deferred execution: create immediately, place later

C's special level engine creates objects and monsters immediately (consuming
RNG for `next_ident()`, `rndmonst_adj()`, etc.) but defers *placement* until
after corridors are generated. JS must match this: immediate creation with
deferred placement. If JS defers both creation and placement, the RNG
sequence shifts by thousands of calls.

```
C execution order:
  1. Parse Lua, create rooms         (RNG: room geometry)
  2. Create objects/monsters          (RNG: identity, properties)
  3. Generate corridors               (RNG: corridor layout)
  4. Place deferred objects/monsters   (no RNG)

Wrong JS order:
  1. Parse, create rooms
  2. Generate corridors
  3. Create AND place objects/monsters (RNG shifted by corridor calls)
```

*Source: `src/sp_lev.c`. See [ORACLE_RNG_DIVERGENCE_ANALYSIS.md](archive/ORACLE_RNG_DIVERGENCE_ANALYSIS.md).*

### Map-relative coordinates after des.map()

After `des.map()` places a map at origin (xstart, ystart), ALL subsequent
Lua coordinate calls — `des.door()`, `des.ladder()`, `des.object()`,
`des.monster()`, `des.trap()` — use coordinates relative to the map origin,
not absolute screen positions. Failing to add the origin offset places every
feature in the wrong position.

```lua
-- tower1.lua: map placed at screen (17, 5)
des.door("closed", 8, 3)
-- Absolute position: (17+8, 5+3) = (25, 8)
-- NOT (8, 3)!
```

*Source: `src/sp_lev.c`. See [MAP_COORDINATE_SYSTEM.md](archive/MAP_COORDINATE_SYSTEM.md).*

### Wallification must run twice around geometric transforms

Any operation that changes cell positions (flipping, rotation) invalidates
wallification corner types. The correct sequence is: wallify, transform,
wallify again. C does this via `wallification()` before flip and
`fix_wall_spines()` after.

### The full finalization pipeline is mandatory

Special levels bypass procedural generation but still require every
finalization step: deferred placement, `fill_ordinary_room()` for OROOM
types, wallification, `bound_digging()`, `mineralize()`. Omitting
`mineralize()` alone causes ~922 missing RNG calls.

---

## Pet AI

### Pet AI is the "final boss" of RNG parity

Pet movement (`dog_move` in `dogmove.c`) is the most RNG-sensitive subsystem
in the game. A single missed or extra RNG call in pet decision-making
cascades through every subsequent turn. The movement candidate evaluation
(`mfndpos`), trap avoidance, food evaluation, and multi-attack combat each
consume RNG in specific orders that must be matched exactly.

### Wizard mode makes all traps visible

The C test harness runs with `-D` (wizard mode), which sets `trap.tseen = true`
on all traps. This changes pet trap avoidance behavior: when `trap.tseen` is
true, pets roll `rn2(40)` to decide whether to step on the trap. When it's
false, they don't roll at all. If JS doesn't match wizard mode's omniscience,
pet movement diverges immediately.

*Source: `src/dogmove.c:1182-1204`.*

### Pet melee has strict attack sequencing

Pet combat (`mattackm`) consumes RNG for multi-attack sequences: to-hit
(`rnd(20+i)`) for each attack, damage rolls, knockback, and corpse creation
(`mkcorpstat`). These must be ported with exact ordering. Additionally, pet
inventory management requires C-style filtering: exclude worn, wielded,
cursed items and specific classes like `BALL_CLASS`.

### Trap harmlessness depends on monster properties

`m_harmless_trap()` determines which traps a monster can safely ignore.
Flyers ignore floor traps. Fire-resistant monsters ignore fire traps.
Small or amorphous monsters ignore bear traps. Getting any of these checks
wrong changes the pet's movement candidate set and shifts all subsequent RNG.

---

## C-to-JS Translation Patterns

### FALSE returns still carry data

C functions like `finddpos()` return FALSE while leaving valid coordinates
in output parameters. FALSE means "didn't find ideal position," not "output
is invalid." JS translations that return `null` on failure break callers
that expect coordinates regardless of the success flag.

### The Lua converter produces systematic errors

The automated Lua→JS converter generates three recurring bugs: labeled
statements instead of `const`/`let` declarations, missing closing braces
for loops, and extra closing braces after loop bodies. Complex Lua modules
(like `themerms.lua`) require full manual conversion. Always review
converter output before running RNG tests.

*See [lua_converter_fixes.md](lua_converter_fixes.md).*

### Integer division must be explicit

C integer division truncates toward zero. JavaScript `/` produces floats.
Every C division of integers must use `Math.trunc()` or `| 0` in JS.
Missing a single truncation can shift coordinates by one cell, which shifts
room geometry, which shifts corridor layout, which shifts the entire RNG
sequence.

### Incremental changes outperform rewrites

When porting complex subsystems (pet AI, combat, special levels), small
tightly-scoped changes with clear validation outperform large logic
rewrites. Port one function, test, commit. Port the next. A rewrite that
breaks parity in twenty places at once is harder to debug than twenty
individual one-function ports.

---

## Debugging Techniques

### Side-by-side RNG trace comparison

Extract the same index range from both C and JS traces and compare
call-by-call. The first mismatch tells you which function diverged.
The `>funcname` midlog entries preceding the mismatch tell you the
call stack.

```bash
node test/comparison/session_test_runner.js --verbose seed42_gameplay
# Look for "rng divergence at step=N index=M"
# Then examine the js/session values and call stacks
```

### The comparison test diagnostics

The session test runner (`sessions.test.js`) reports `firstDivergence` per
channel with call-stack context. The `--verbose` flag shows every session
result. The `--type=chargen` flag isolates one category. The `--fail-fast`
flag stops at the first failure for focused debugging.

### Replay startup topline state matters for count-prefix parity

In replay mode, first-digit count prefix handling intentionally preserves the
current topline (matching C). If replay init does not carry startup topline
state forward, sessions can diverge immediately on key `1` / `2` / ... frames
even when RNG and command flow are otherwise aligned.

Practical rule: preserve startup **message/topline state** for replay, but do
not blindly force startup map rows into later steps, or you'll create unrelated
map-render diffs in wizard sessions.

### Role index mapping

The 13 roles are indexed 0–12 in C order. Wizard is index 12, not 13.
Getting this wrong shifts every role-dependent RNG path.

```
0:Archeologist 1:Barbarian 2:Caveman 3:Healer 4:Knight 5:Monk
6:Priest 7:Ranger 8:Rogue 9:Samurai 10:Tourist 11:Valkyrie 12:Wizard
```

---

## Phase Chronicles

The full narratives of the porting campaign, rich with war stories and
hard-won wisdom:

- **[Phase 1: PRNG Alignment](PHASE_1_PRNG_ALIGNMENT.md)** — The journey
  from xoshiro128 to ISAAC64, achieving perfect map alignment across all
  test seeds. Where it all began.

- **[Phase 2: Gameplay Alignment](PHASE_2_GAMEPLAY_ALIGNMENT.md)** — Extending
  parity to live gameplay: the turn loop, monster AI, pet behavior, vision,
  combat. The "final boss" chapter on pet AI.

- **[Phase 3: Multi-Depth Alignment](PHASE_3_MULTI_DEPTH_ALIGNMENT.md)** —
  Multi-depth dungeon generation, test isolation failures, and the long tail
  of state leaks between levels.

---

*You close the book. The lessons are many, and the dungeon is deep.*
*But forewarned is forearmed, and a ported function is a function that works.*
