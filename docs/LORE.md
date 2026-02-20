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

### `des.monster({ fleeing = N })` must set runtime flee fields

Special-level Lua options may use C-style names, but JS movement logic reads
runtime `flee`/`fleetim`. Writing only `mflee`/`mfleetim` leaves monsters
effectively non-fleeing for behavior code even though the script asked for
fleeing state.

Practical rule: when loading `fleeing`, set both aliases in sync:
`flee` + `fleetim` and `mflee` + `mfleetim`.

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

### Flee state resets movement memory

C `monflee()` always clears monster `mtrack` history (`mon_track_clear`),
even when flee timing doesn't change. Missing this creates hidden-state drift:
later `m_move` backtrack checks (`rn2(4 * (cnt - j))`) consume a different
number of RNG calls even while visible screens still match.

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

### Interpreting first-divergence reports

The test runner's `firstDivergences.rng` tells you `step` and `index`:

- **`index=0` with JS empty**: JS produced zero RNG for that step. The turn
  itself didn't execute. Common causes: unimplemented command (e.g. JS
  `handleRead` says "Sorry" instead of reading the scroll), or missing
  turn-end cycle because the command returned `tookTime: false`.
- **`index=0` with both non-empty**: The very first RNG call within the step
  differs. Look at function names: `exercise` vs `distfleeck` means the
  turn-end ordering is wrong; `rnd(20)` vs `rn2(20)` means JS used the wrong
  RNG function.
- **`index>0` with same count**: Both sides ran the same turn shape, but one
  call inside differs. This is usually a wrong argument (`rn2(40)` vs
  `rn2(32)` means a parameter like monster level or AC differs), indicating
  hidden state drift from an earlier step.
- **Same values, different counts**: One side has extra or missing calls at the
  end. Suspect missing sub-operations (e.g. JS doesn't call `dmgval` for
  weapon damage after base attack dice).

### Diagnostic script pattern for investigating specific seeds

Use this template to investigate a failing seed. It replays the session in JS
and compares per-step RNG against the C reference:

```javascript
import { replaySession, loadAllSessions }
  from './test/comparison/session_helpers.js';

function normalizeWithSource(entries) {
  return (entries || [])
    .map(e => (e || '').replace(/^\d+\s+/, ''))
    .filter(e => e
      && !(e[0] === '>' || e[0] === '<')
      && !e.startsWith('rne(')
      && !e.startsWith('rnz(')
      && !e.startsWith('d('));
}

const sessions = loadAllSessions({
  sessionPath: 'test/comparison/sessions/SEED_FILE.session.json'
});
const session = sessions[0];
const replay = await replaySession(session.meta.seed, session.raw, {
  captureScreens: false,
  startupBurstInFirstStep: false,
});

// Compare specific step (0-indexed)
const stepIdx = 98; // step 99
const jsStep = replay.steps[stepIdx];
const cStep = session.steps[stepIdx];
const jsNorm = normalizeWithSource(jsStep?.rng || []);
const cNorm = normalizeWithSource(cStep?.rng || []);

console.log(`Step ${stepIdx+1}: JS=${jsNorm.length} C=${cNorm.length}`);
for (let j = 0; j < Math.max(jsNorm.length, cNorm.length); j++) {
  const js = (jsNorm[j] || '(missing)').split(' @ ')[0];
  const c = (cNorm[j] || '(missing)').split(' @ ')[0];
  console.log(`  [${j}] ${js === c ? '✓' : '✗'} JS:${js}  C:${c}`);
}
```

The `normalizeWithSource` function strips midlog markers (`>func`/`<func`),
composite dice (`d(...)`, `rne(...)`, `rnz(...)`), and source locations
(`@ file.c:line`), leaving only the leaf RNG calls that the comparator checks.

### Categories of divergence and what to fix

| Pattern | Root cause | Fix approach |
|---------|-----------|--------------|
| JS has 0 RNG, C has full turn | Unimplemented command or `tookTime:false` | Implement the command or fix time-taking |
| Same functions, different args | Hidden state drift (HP, AC, monster data) | Trace back to earlier state divergence |
| Wrong function name (`rnd` vs `rn2`) | JS uses different RNG wrapper than C | Change to matching function (e.g. `d(1,3)` vs `rnd(3)`) |
| Extra/missing calls in turn-end | Missing sub-system (exercise, dosounds, etc.) | Implement the missing turn-end hook |
| Shift by N calls from a certain step | One-time extra/missing operation cascading | Find the first divergence step and fix it |

### Replay engine pending-command architecture

Multi-keystroke commands (read, wield, throw, etc.) use a promise-based
pending-command pattern in `replay_core.js`:

1. First key (e.g. `r` for read) → `rhack()` called → command blocks on
   `await nhgetch()` → doesn't settle in 1ms → stored as `pendingCommand`
2. Next key (e.g. `i` to select item) → pushed into input queue →
   `pendingCommand` receives it → may settle (command completes) or stay
   pending (more input needed)
3. `pendingKind` tracks special handling: `'extended-command'` for `#`,
   `'inventory-menu'` for `i`/`I`, `null` for everything else

When investigating "missing turn" bugs in multi-key commands, check whether
the pending command actually settles and returns `tookTime: true`. If JS
says "Sorry, I don't know how to do that yet" and returns `tookTime: false`,
the turn won't run and the full movemon/exercise/dosounds cycle is skipped.

### Replay startup topline state matters for count-prefix parity

In replay mode, first-digit count prefix handling intentionally preserves the
current topline (matching C). If replay init does not carry startup topline
state forward, sessions can diverge immediately on key `1` / `2` / ... frames
even when RNG and command flow are otherwise aligned.

Practical rule: preserve startup **message/topline state** for replay, but do
not blindly force startup map rows into later steps, or you'll create unrelated
map-render diffs in wizard sessions.

### Remembered object glyphs need remembered colors

Out-of-sight object memory is not just a remembered character (`mem_obj`); C
rendering behavior also preserves the remembered object color. If memory falls
back to a fixed color (for example always black), gameplay sessions can show
large color drift while RNG and geometry stay unchanged.

Practical rule: store both remembered object glyph **and** color, and render
that pair when tiles are unseen.

### Role index mapping

The 13 roles are indexed 0–12 in C order. Wizard is index 12, not 13.
Getting this wrong shifts every role-dependent RNG path.

```
0:Archeologist 1:Barbarian 2:Caveman 3:Healer 4:Knight 5:Monk
6:Priest 7:Ranger 8:Rogue 9:Samurai 10:Tourist 11:Valkyrie 12:Wizard
```

### C step snapshots narrow hidden-state drift faster than RNG-only diffs

When RNG divergence appears late, capture same-step C and JS monster/object
state and compare coordinates directly. This catches upstream hidden-state
drift before it surfaces as an RNG mismatch.

In `seed212_valkyrie_wizard`, snapshotting showed the first monster-position
drift at step 10 (goblin Y offset). Porting a minimal collector-only
`m_search_items` retargeting subset in JS `m_move` aligned monster positions
at steps 36/37 and moved first RNG divergence from step 37 (`rn2(20)` vs
`rn2(32)`) to step 38 (`distfleeck` `rn2(5)` in C).

Practical rule: use step snapshots to verify state alignment at the first
visual or behavior drift, then apply narrow C-faithful movement-target fixes
before chasing deeper RNG stacks.

### Wizard level-teleport parity has two separate RNG hooks

In `seed212_valkyrie_wizard`, the `^V` level-teleport flow matched C better
only after handling both:

1. `wiz_level_tele` as a no-time command (`ECMD_OK` semantics), and
2. quest-locate pager side effects in `goto_level` (`com_pager("quest_portal")`
   bootstraps Lua and consumes `rn2(3)`, `rn2(2)` via `nhlib.lua` shuffle).

Practical rule: for transition commands, separate "does this consume a turn?"
from "does this command path still consume RNG for messaging/script setup?"

### Lycanthrope RNG happens before movement reallocation

C consumes lycanthrope shift checks in turn-end bookkeeping before
`mcalcmove()`: `decide_to_shapeshift` (`rn2(6)`) then `were_change`
(`rn2(50)`).

Practical rule: when `mcalcmove` aligns but pre-`mcalcmove` RNG is missing,
audit turn-end monster status hooks (not just `movemon`/`dog_move` paths).

### Were-change behavior is not RNG-only: howl wakes nearby sleepers with strict radius semantics

When unseen human-form werejackals/werewolves transform, C prints
`You hear a <jackal|wolf> howling at the moon.` and calls `wake_nearto`
with distance `4*4`.

Two parity-critical details:
- This wake is behavioral (changes `msleeping` state), not just messaging.
- `wake_nearto_core` uses strict `< distance`, not `<=`.

Practical rule: if zoo/special-room monsters diverge from sleeping to active
around were messages, port the wake side effects and strict distance test
before tuning movement logic.

### Runtime shapechanger parity needs persistent `cham` identity

C runs `decide_to_shapeshift()` in `m_calcdistress()` for monsters with a
valid `cham` field, which can trigger `select_newcham_form` and `newmonhp`
RNG side effects during turn-end.

Practical rule: preserve the base shapechanger identity (`cham`) on monster
instances and drive turn-end shapechange from that field; creation-time-only
newcham handling misses later RNG and hidden-state transitions.
### Monster item-search parity needs full intent gates, not broad carry checks

`m_search_items` is not "move toward any carryable floor object." In C it
passes through `mon_would_take_item`/`mon_would_consume_item`, load-threshold
limits, in-shop skip behavior, and `MMOVE_DONE`/`mpickstuff` side effects.

Practical rule: if monsters retarget oddly around loot (especially toward
gold/food underfoot), port the full intent gating and pickup semantics before
tuning path selection or RNG order.

### Enter key replay can need a run-style follow-on in pet-displacement flows

In gameplay replay traces, `Enter` (`\n`/`\r`) is usually a one-step keypad-
down movement, but pet-displacement turns can require a run-style follow-on
cycle to stay aligned. Keeping active `cmdKey` tracking in sync with moveloop
repeat state is also required in this path.

Practical rule: if an Enter step matches one turn and then misses an immediate
follow-on monster-turn block, verify keypad Enter + pet-displacement handling
and `cmdKey` bookkeeping before changing monster AI logic.

### Inventory action menus can be parity-critical screen state

Inventory submenu content is part of recorded screen parity, not cosmetic-only
UI. Missing item-specific actions (for example oil-lamp `a - Light ...` and
`R - Rub ...`) can become the first deterministic divergence even when RNG and
movement are aligned.

Practical rule: when screen divergence appears on an item-action frame, diff
the exact action list and row-clearing behavior before touching turn logic.

### Headless `nhgetch()` must see display state to avoid fake prompt concatenation

`nhgetch()` clears topline concatenation state (`messageNeedsMore`) on keypress.
If headless input returns `getDisplay() = null`, prompt loops can concatenate
identical prompts (`X  X`) in replay even when command logic is otherwise
correct.

Practical rule: always bind headless input runtime to the active display so
keypress acknowledgment semantics match tty behavior.

### `f`ire prompt parity depends on wielded-item flow

`dofire()` is not equivalent to "accept any inventory letter then ask
direction." Wielded-item selection can require a confirmation prompt (`Ready it
instead?`) and some held items should not appear in the initial fire-choice
list.

Practical rule: treat fire-prompt candidate filtering and wielded-item prompts
as behavioral parity, not UI polish; they gate subsequent input parsing and can
shift replay screens long before RNG divergence.

### M2_COLLECT does not imply gold-targeting in monster item search

In C `mon_would_take_item`, monsters only path toward `GOLD_PIECE` when their
data `likes_gold` (`M2_GREEDY`) is set. `M2_COLLECT` by itself is not enough.
This matters in early gameplay parity because non-greedy collectors (for
example goblins) can drift movement and downstream RNG if JS treats any
carryable gold as a valid search target.

Practical rule: keep `m_search_items` gold retargeting gated by
`likes_gold` (with leprechaun exception), not by `M2_COLLECT` alone.

### `m_search_items` should not be pre-gated by collect-only monster flags

In C `monmove.c`, `m_search_items()` scans nearby piles for any monster and
relies on `mon_would_take_item()` / `mon_would_consume_item()` to decide
interest per object. Adding an early JS return like "only run for
`M2_COLLECT`" drops legitimate search behavior for other item-affinity
monsters (for example `M2_GREEDY` or `M2_MAGIC`) and causes hidden movement
state drift.

Observed parity effect in `seed212_valkyrie_wizard.session.json` after removing
the collect-only pre-gate:
- RNG matched prefix improved (`8691 -> 8713` calls)
- first RNG divergence shifted later (`step 260 -> step 267`)

Practical rule: keep the broad search loop active and let item-intent helpers
filter per-object eligibility; do not add top-level "collector-only" gates.

### eatfood occupation completes on `++usedtime > reqtime` (not `>=`)

For multi-turn inventory eating, C `eatfood()` ends when the incremented
counter is strictly greater than `reqtime`. Using `>=` drops one timed turn.
That missing turn shifts replay RNG at the tail of eating steps (missing the
final `distfleeck`/monster cycle) and can flip session pass/fail status.

Practical rule: keep food-occupation completion as strict `>` against
`reqtime`, and verify with a replay step that includes `"You're finally
finished."` plus trailing monster-turn RNG.

### Sparse replay frames can shift RNG attribution across later steps

Some C keylog-derived gameplay captures include display-only frames with no RNG
between two comparable RNG-bearing steps. When JS executes a command and
captures extra trailing RNG in the same replay step, that tail may need to be
deferred to a later step (not always the immediate next one) where comparable
RNG resumes.

Practical rule: if a step has an exact expected RNG prefix plus extra tail, and
the first extra comparable call matches a later step's first comparable call
after zero-RNG frames, defer the tail to that later step for comparison.
Treat zero-RNG frames between source and deferred target as display-only
acknowledgement frames (do not execute a new command turn there).

### Hider `restrap()` runs before `dochug` and can consume `rn2(3)` even on sleeping monsters

In C, `movemon_singlemon()` calls `restrap()` for `is_hider` monsters before
`dochugw()`. That `restrap()` path can consume `rn2(3)` and may set
`mundetected`, causing the monster to skip `dochug` for that turn.

Practical rule: for parity around piercers/mimics, model the pre-`dochug`
hider gate in the movement loop (not inside `m_move`/`dog_move`), or RNG
alignment will drift by one monster-cycle (`distfleeck`) call.

### `thrwmu` retreat gating uses pre-command hero position (`u.ux0/u.uy0`)

In C `mthrowu.c`, `thrwmu()` can skip a ranged throw when the hero is
retreating relative to the monster:
`URETREATING(x, y) && rn2(BOLT_LIM - distmin(x, y, mux, muy))`.
That pre-throw check consumes RNG (for example `rn2(6)` at `thrwmu`) before
`monshoot()`/`m_throw()` is entered.

Practical rule: track hero pre-command coordinates in JS (C's `u.ux0/u.uy0`)
and run the retreat gate before multishot/flight logic; otherwise JS can
incorrectly execute `m_throw()` and consume extra per-step `rn2(5)` calls.

### Inventory `:` search prompt is modal input, not a one-shot menu dismissal

On C tty inventory overlays, `:` starts a modal `Search for:` line-input prompt
that can consume multiple subsequent keystrokes while leaving inventory rows on
screen. Treating `:` as immediate dismissal-only behavior drops prompt-echo
updates (for example `Search for: k`) and causes step-shifted screen parity
divergence despite matching RNG.

Practical rule: inventory `:` handling should enter `getlin("Search for: ")`
style pending input semantics so replay can consume and render each typed
character before command flow resumes.

### Remove gameplay col-0 compensation heuristics from the comparator

After aligning JS rendering with C tty coordinate mapping (`map x -> term col
x-1`), comparison-layer col-0 padding heuristics became counterproductive.
They could hide real coordinate bugs or create fake mixed-row shifts.

Practical rule: gameplay screen/color comparison should be direct (after basic
control-character normalization), without synthetic leading-space insertion or
pad/no-pad fallback matching.

### Record Book: comparator simplification commits (2026-02-19)

- `e2deeac2` - Removed gameplay comparator col-shift compensation in
  `test/comparison/session_test_runner.js`:
  no synthetic col-0 space prepend, no pad/no-pad fallback chooser, no
  mixed-row map-segment pad logic.
- `48535727` - Removed interface screen left-shift fallback ("remove one
  leading space and retry") in `test/comparison/session_test_runner.js`;
  interface comparisons now use direct normalized-row matching.
- `08da1fac` - Removed legacy col-0 prepend fallback path from
  `test/comparison/test_session_replay.js`, deleting padded-vs-unpadded and
  hybrid mixed-row fallback matching there as well.
- Follow-up simplification (2026-02-19):
  removed remaining gameplay col-0/overlay fallback matching paths from
  `test/comparison/session_test_runner.js` and restored direct normalized-row
  comparison for gameplay screen diffs.

### TTY map x-coordinates are 1-based and render at terminal column x-1

In C tty, map redraw loops emit glyphs for `x` in `[1, COLNO-1]` and call
`tty_curs(window, x, y)`. `tty_curs()` then decrements `x` before terminal
cursor positioning (`cw->curx = --x`), so map cell `x` is displayed at terminal
column `x-1`.

Practical rule: JS map rendering should mirror this mapping (`col = x - 1`)
for both browser and headless displays to match C screen coordinates directly
instead of relying on comparison-layer column compensation.

### `doeat` invalid object selection can stay in a sticky `--More--` loop

In tourist non-wizard traces, invalid eat-object selection can present repeated
`You don't have that object.--More--` frames across multiple non-space keys
before returning to the `What do you want to eat?` prompt.

Practical rule: model this as a modal no-object `--More--` loop in command
logic (non-space keys keep the same `--More--` frame; space/enter/esc resume
the eat prompt) rather than immediately reprompting.

### `doopen` invalid direction wording splits cancel vs invalid keys

For `open` direction prompts, C distinguishes cancel-like keys from other
invalid keys:

- cancel keys (`Esc`, `Enter`, `Space`) -> `Never mind.`
- other invalid direction keys -> `What a strange direction!  Never mind.`

Practical rule: keep this split in command handling and tests; collapsing both
cases to `Never mind.` regresses non-wizard tourist session parity.

### Sparse move key + Enter can imply run-style south in replay captures

Some keylog-derived gameplay captures include a zero-RNG `move-*` byte with an
empty topline immediately before an Enter step whose RNG starts with
`distfleeck`. In these cases, replay alignment can require treating that Enter
as run-style south movement for parity with C turn consumption.

Practical rule: in replay, detect this exact sparse-move/Enter pattern and set
a narrow replay flag so Enter follows run-style handling only for that step.

### `stop_occupation` sparse boundary frames can defer timed turn execution

Some gameplay captures split a single command across two adjacent frames:
- current frame: combat/occupation-stop bookkeeping (`stop_occupation`) with no
  monster-cycle/turn-end RNG markers
- next frame: the deferred timed-turn block (`distfleeck`, `mcalcmove`,
  `moveloop_core`, etc.)

Practical rule: when replay sees this exact signature, do not execute the timed
turn on the bookkeeping frame; defer it to the next captured frame so state and
RNG attribution match C keylog boundaries.

Additional replay rule: apply screen-driven HP/PW/AC stat sync after sparse
boundary carry attribution, and skip that sync on the frame exporting deferred
RNG/state. Otherwise, source-frame HP can be restored too early (for example,
after projectile damage) and later deferred turn-end RNG (`regen_hp`) drifts.

### Throw `?` overlay menus can require a right-offset cap at column 41

In non-wizard tourist gameplay, the throw prompt (`What do you want to throw?`)
`?/*` help overlay can drift horizontally if overlay placement always uses pure
right-alignment (`cols - maxcol - 2`).

Practical rule: clamp overlay menu `offx` to `<= 41` (matching C tty behavior
in these flows) and keep leading-pad header spaces non-inverse when rendering
category headers like ` Weapons`/` Coins`.

### Throw prompt suggestion letters are class-filtered (but manual letters still work)

For `What do you want to throw?` prompt text, C suggests only a filtered set
of inventory letters rather than every possible throwable object:

- always include coins
- include non-wielded weapons when not slinging
- include gems/stones when slinging
- exclude worn/equipped items from prompt suggestions

Practical rule: keep this as prompt suggestion behavior only. Manual letter
selection should still be accepted and validated afterward (including worn-item
rejection at throw execution).

### Double `m` command prefix cancels silently

In C command-prefix flow, entering `m` when the `m` no-pickup prefix is already
active clears the prefix without emitting a message.

Practical rule: second `m` should toggle prefix state off silently (no
`Double m prefix, canceled.` topline), or replay/topline parity can drift.

### Inventory overlay frames are replay-authoritative when command remains modal

For `i` inventory steps that stay pending (menu not yet dismissed), C-captured
overlay text/columns can include details JS does not yet fully reconstruct
(`(being worn)`, identified tin contents). Re-rendering from JS can shift menu
columns and drift screen parity even when gameplay state is unchanged.

Practical rule: while inventory command is still modal/pending and the step has
a captured screen, use the captured frame as authoritative for that step.

### AT_WEAP monster melee has a two-stage parity contract: wield turn, then dmgval

In tourist non-wizard traces, adjacent goblins with AT_WEAP can spend one turn
on `The goblin wields a crude dagger!` before any melee hit roll. On later hit
turns, C consumes base melee `d(1,4)` and then weapon `dmgval` (`rnd(3)` for
orcish dagger in this trace) before knockback RNG.

Practical rule:
- Adjacent AT_WEAP monsters without a wielded weapon should spend the attack
  turn on wielding a carried weapon.
- AT_WEAP melee damage must include weapon `dmgval` RNG after base attack dice.

### `thrwmu` ranged throws are gated by `URETREATING` before `m_throw`

In C `mthrowu.c`, lined-up ranged throws are not unconditional. When the hero
is retreating from the thrower, `thrwmu()` consumes `rn2(BOLT_LIM - dist)` and
returns early on non-zero rolls, so `m_throw()` is skipped that turn.

Practical rule:
- Track previous hero position (`u.ux0/u.uy0` equivalent) each command.
- In `thrwmu`, compute retreating as distance from current hero position to the
  monster being greater than distance from previous hero position.
- Apply this gate before `monshoot`/`m_throw`; otherwise JS enters throw-flight
  RNG when C exits early.

### Monster-thrown projectiles must be materialized on floor and consumed from `minvent`

In C `mthrowu` flow, monster projectiles are real objects: throws consume stack
quantity from monster inventory and the projectile lands on the map unless
destroyed. If JS models only damage/message side effects (without object
consumption/placement), later pet `dog_goal` scans miss `dogfood()->obj_resists`
calls and RNG diverges in pet movement turns.

Practical rule:
- decrement/remove thrown stack entries from `mon.minvent` as missiles are fired
- place each surviving projectile on a valid floor square at end of flight
- avoid adding new RNG in this bookkeeping path (ID assignment included)

### `doread` `?/*` help is a modal `--More--` listing, not a one-key no-op

In tourist traces, pressing `?` (or `*`) at `What do you want to read?` opens a
modal `--More--` item listing (for example
`l - 4 uncursed scrolls of magic mapping.--More--`). Non-dismiss keys keep the
same `--More--` frame; dismissal (`space`/`enter`/`esc`) returns to the read
prompt.

Practical rule: keep read command pending across these keys and model `?/*`
as modal listing acknowledgement flow rather than immediately returning to the
prompt.

### Zero-RNG prompt-start frames should stay capture-authoritative in replay

Some keylog gameplay traces capture prompt-start frames (`What do you want to …?`)
before JS has fully re-rendered row 0 while a command is pending. If replay
drops those zero-RNG prompt frames, later input can be routed against the wrong
UI state and drift accumulates.

Practical rule: for zero-RNG `key-*` steps with captured prompt text and blank
JS topline, keep the captured prompt frame authoritative for that step.

### Partial `dopay` ports should prefer the C "no shopkeeper here" message

When full billing/shopkeeper proximity logic is not yet implemented, emitting
`You do not owe any shopkeeper anything.` can diverge from C captures that
expect `There appears to be no shopkeeper here to receive your payment.`

Practical rule: under partial `dopay` behavior, prefer the C no-shopkeeper text
until full billing-state parity is implemented.

### `dofire` fireassist can consume a turn before direction input resolves

In wizard replay traces, `f` can consume time even when the final frame still
shows `In what direction?`. C `dofire()` may auto-swap to a matching launcher
(`uswapwep`) and then re-enter firing flow; that swap is a timed action.

Practical rule: model fireassist launcher auto-swap as a timed step before the
direction prompt, and preserve the post-turn map frame before leaving the
prompt pending.

### `dofire` routes to `use_whip()` when no quiver and bullwhip is wielded

In C `dofire()` (dothrow.c), when `uquiver == NULL` and `flags.autoquiver` is
false:
- If wielding a **polearm/lance** → `use_pole(uwep, TRUE)` (asks direction)
- If wielding a **bullwhip** → `use_whip(uwep)` (asks "In what direction?",
  consumes direction key, returns without turn if direction invalid)
- Otherwise → "You have no ammunition readied."

JS `handleFire` must check for bullwhip *before* polearm. An archeologist
wizard (seed201) starts with a bullwhip and no quiver, so `f` routes to the
whip direction prompt. If JS instead falls through to the menu-based ammo
selection (`What do you want to fire? [*]`), it consumes the direction key and
subsequent count digits as menu input, causing an RNG divergence of 0 (JS) vs
175 (C) at the first counted-move command after the fire.

Practical rule: in `handleFire`, add a bullwhip guard between the polearm guard
and the inventory scan — show "In what direction?", consume one key, and return
tookTime=false for invalid or valid directions (until whip effects are ported).

### `wipeout_text` makes two `rn2` calls per character erased

In C `wipeout_text(engrave.c)`, for each character erased (cnt iterations),
the function calls **two** rn2s:
1. `rn2(lth)` — picks position in string
2. `rn2(4)` — determines if a "rubout" substitution is used (partial erasure)

JS's `wipeoutEngravingText` only calls `rn2(lth)` and is missing the `rn2(4)`
call. Fixing this requires adding `rn2(4)` and implementing rubout characters
(letters that degrade to similar-looking chars instead of becoming spaces).

Also note: in C, if the picked position is already a space, it does `continue`
(skips that iteration without retry). In JS, the inner `do...while` loop retries
`rn2(lth)` until a non-space is found — which consumes extra RNG calls compared
to C when spaces exist.

### Inventory action menus should use canonical `xname()` nouns

Building item action prompts from ad-hoc `item.name` strings causes drift like
`flints` vs C `flint stones`, plus wrong submenu width/offset.

Practical rule: derive prompt noun text from `xname()` (singular/plural as
needed) so menu wording and right-side offset match C inventory action menus.

### Do not drop typed `#` getlin frames; only skip keyless prompt echoes

In strict gameplay replay, keylog frames for extended commands can appear as:
`#`, then typed letters (`# l`, `# lo`, ...), then `Enter`, all with `rng=0`.
Dropping those keyed frames causes state drift because the command never reaches
`getlin` (for example `#loot` at a door), and a later `Enter` can be misread as
normal movement input.

Practical rule: for `rng=0` frames whose topline starts with `#`, skip only
keyless display-only echoes. Keep keyed frames so extended-command input is
delivered exactly.

### Pickup no-object messages are terrain-dependent in C

`pickup_checks()` in C (`hack.c`) does not always print the generic
`There is nothing here to pick up.` when no object is on the square. It emits
terrain-specific lines for throne/sink/grave/fountain/open-door/altar/stairs.
Missing these lines causes prompt/message screen drift even when RNG is stable.

Practical rule: before the generic pickup message, check terrain and emit C text,
including open-door: `It won't come off the hinges.`

### Stair glyph color parity depends on branch semantics, not up/down direction

In C TTY symbol/color behavior, branch staircases are highlighted (yellow),
while ordinary up/down stairs are gray. Treating all up-stairs as highlighted
causes early color drift in mixed gameplay sessions.

Practical rule: track explicit branch-stair placement metadata and color stairs
from that metadata, not from stair direction alone.

### Shopkeeper-name parity requires `ubirthday`, `ledger_no`, and correct `ident` flow

Shopkeeper greeting/name tokens are sensitive to C initialization details:
- `nameshk()` uses `ubirthday / 257`, not the gameplay seed.
- Name selection uses `ledger_no(&u.uz)`, not raw depth.
- `context.ident` starts at `2`, and object-creation paths (including vault
  fill) consume `next_ident()` in order.

Practical rule: preserve all three inputs in JS; partial fixes can hide one
token mismatch but still leave deterministic drift downstream.

### `#name` must route through `docallcmd`-style object-type selection

A narrow `#name` implementation which only handles level annotation (`a`) can
silently leave a pending `getlin()` and swallow later gameplay keys. In C,
`docallcmd()` routes `o` to object-type calling via `getobj("call", call_ok, ...)`,
and invalid non-callable inventory letters yield `That is a silly thing to call.`
instead of opening level-annotation text entry.

Practical rule: treat `#name` as a selector flow, not a direct getlin branch.
Support the `o` object-type path with callable-class filtering and keep invalid
selections on the C wording path.

### `doapply` shows `[*]` when inventory exists but no items are applicable

For `a` (apply), C `getobj("use or apply", apply_ok, ...)` still presents a prompt
when inventory is non-empty even if no letters are suggested, rendering
`What do you want to use or apply? [*]`. Early-returning with
`You don't have anything to use or apply.` in that case shifts prompt-driven input
and causes downstream drift.

Practical rule: only emit `You don't have anything to use or apply.` when
inventory is truly empty; otherwise show `[*]` and continue `getobj`-style
selection handling.

### Wielded launchers/missiles in melee use ranged-damage semantics

In C `uhitm.c`, melee hits while wielding a launcher (bow/crossbow/slings) or
ammo/missile object route through `hmon_hitmon_weapon_ranged()` damage logic.
That path uses low fixed `rnd(2)`-style damage rather than normal melee
`dmgval + enchantment + strength`.

Practical rule: in JS player melee, detect launcher/ammo/missile weapon subskills
and use the ranged-melee damage path; do not add strength bonus there.

### AT_WEAP monsters can spend turn wielding before movement

C `dochug()` has a phase-two wield gate: hostile in-range `AT_WEAP` monsters can
use their turn to wield a carried weapon before phase-three movement. If this is
missing, monsters may move/throw in turns where C only wields, shifting downstream
monster/pet interactions.

Practical rule: keep the pre-move wield-turn gate in `dochug()` (before phase 3),
not only in phase-four attack dispatch.

### `getobj` `?/*` overlay must return selected letter back to prompt flow

For `drop`/`throw`-style `getobj` prompts, C tty `?/*` opens `display_pickinv`
and keeps the command modal. Two details matter for replay parity:
- non-dismiss keys can be consumed while the overlay remains open (`j`, `k`, etc.);
- typing an inventory letter in the overlay closes it and returns that letter to
  the same prompt flow (rather than discarding it).

If JS treats the overlay as dismiss-only, or ignores in-menu letter selections,
prompt-state drift appears quickly (for example in seed5 around drop prompt/menu
steps near 593-594), then cascades into later RNG divergence.

---

### Armor AC comes from `objectData[otyp].oc1`, not `item.ac`

Items created by `newobj()` do not carry an `ac` property — the armor class
protection for a piece of armor lives in `objectData[item.otyp].oc1` (which
mirrors C's `objects[otyp].a_ac`, a union alias of `oc_oc1`). Enchantment
is `item.spe`, not `item.enchantment`.

The correct `find_ac()` formula (from `do_wear.c`):
```
uac = 10  (base for human player)
for each armor slot: uac -= oc1 + spe - min(max(oeroded, oeroded2), oc1)
for each ring: uac -= ring.spe  (rings have no base oc1 protection)
```

Assigning `item.ac` directly produces `NaN` and breaks the status line. Always
call `find_ac(player)` after any equipment change.

---

### Counted-command occupations and step boundary attribution

When a counted command (e.g. `9s` search) is in progress during replay, C's
`runmode_delay_output` creates step boundaries by consuming buffered input keys.
The replay system must handle three distinct cases:

1. **Deferred boundary pass-through**: The command key itself (`s` after `9`)
   appears as a step but was consumed by `runmode_delay_output`, not `parse()`.
   Emit an empty pass-through frame; do not execute the command again.

2. **OCC-HANDLER** (non-zero comp step with `game.occupation`): Loop
   `occ.fn → movemon → simulateTurnEnd` until `ownComp >= stepTarget`.
   When the occupation ends mid-step (NONOCC), consume subsequent 0-comp buffer
   steps as new commands.

3. **Eager block** (digit step with deferred boundary RNG): The digit step has
   non-zero comp because in C the next command ran within the same step boundary.
   Eagerly execute that command then loop occupation iters to cover the target.

Critical: `simulateTurnEnd()` only calls `dosounds/gethungry/exercise` when
`game.occupation === null`. The "free cycle" turn where the occupation ends
therefore generates more comparable RNG than mid-occupation turns.

The `multi` count left by the eager block is correct for the OCC-HANDLER's
subsequent iterations. For seed5's `9s...9l` sequence: `multi=4` maps to 3
occupation iters (fn returns true) + 1 free cycle (fn returns false, dosounds
fires).

---

## Centralized Bottleneck Functions and Event Logging

### Mirror C's bottleneck architecture, don't scatter logic

C routes all monster deaths through `mondead()` (mon.c), all monster pickups
through `mpickobj()` (steal.c), and all monster drops through `mdrop_obj()`
(steal.c). The JS port originally had these scattered across 10+ call sites
with inconsistent behavior — some sites logged events, some dropped inventory,
some did neither. Centralizing to match C's architecture solved three problems
at once: consistent behavior, correct event logging, and easier maintenance.

The three bottleneck functions live in `js/monutil.js`:

- **`mondead(mon, map)`** — sets `mon.dead = true`, logs `^die`, drops
  inventory to floor via `placeFloorObject`. Does NOT call `map.removeMonster`
  — callers handle that.
- **`mpickobj(mon, obj)`** — logs `^pickup`, adds to monster inventory.
  Caller must extract obj from floor first.
- **`mdrop_obj(mon, obj, map)`** — removes from minvent, logs `^drop`,
  places on floor.

### Death drops use `placeFloorObject`, not `mdrop_obj`

This is a subtle but important distinction. When a monster dies, C's `relobj()`
calls `place_object()` directly — it does NOT go through `mdrop_obj()`. This
means death inventory drops produce `^place` events, not `^drop` events. If JS
routed death drops through `mdrop_obj`, the event logs would show extra `^drop`
entries that don't match C, creating false divergences.

### Event logging is interleaved with the RNG log

Both C and JS write `^`-prefixed event lines into the same stream as RNG calls.
On the C side, `event_log()` (in rnd.c, added by 012-event-logging.patch)
writes to the RNG log file. On the JS side, `pushRngLogEntry('^...')` appends
to the step's RNG array.

Current event types:

| Event | Meaning | C source | JS source |
|-------|---------|----------|-----------|
| `^die[mndx@x,y]` | Monster death | mon.c mondead | monutil.js mondead |
| `^pickup[mndx@x,y,otyp]` | Monster picks up | steal.c mpickobj | monutil.js mpickobj |
| `^drop[mndx@x,y,otyp]` | Monster drops | steal.c mdrop_obj | monutil.js mdrop_obj |
| `^place[otyp,x,y]` | Object on floor | mkobj.c place_object | floor_objects.js |
| `^remove[otyp,x,y]` | Object off floor | mkobj.c obj_extract_self | floor_objects.js |
| `^corpse[corpsenm,x,y]` | Corpse created | mkobj.c mkcorpstat | (corpse creation) |
| `^eat[mndx@x,y,otyp]` | Monster eats | dogmove.c dog_eat | dogmove.js dog_eat |
| `^trap[ttyp,x,y]` | Trap created | trap.c maketrap | (trap creation) |
| `^dtrap[ttyp,x,y]` | Trap deleted | trap.c deltrap | (trap deletion) |
| `^engr[type,x,y]` | Engraving created | engrave.c make_engr_at | engrave.js |
| `^dengr[x,y]` | Engraving deleted | engrave.c del_engr | engrave.js |
| `^wipe[x,y]` | Engraving eroded | engrave.c wipe_engr_at | engrave.js |

Event comparison is informational only — event mismatches appear in
`firstDivergences` but don't set `result.passed = false`. This lets us detect
state drift without blocking on expected differences while JS catches up.

### Thread parameters carefully when centralizing

When `mondead(mon, map)` needs a `map` parameter but the caller doesn't have
one, you must thread it through the entire call chain. For example,
`dog_starve()` didn't have `map`, so it had to be threaded through
`dog_hunger()` → `dog_starve()` → `dog_move()`. Always trace the full call
chain before adding a parameter to a bottleneck function.

### Clean up imports after centralizing

After moving logic into bottleneck functions, callers may have leftover imports
(`addToMonsterInventory`, `pushRngLogEntry`, `placeFloorObject`) that are no
longer used directly. Always verify and clean up.

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
