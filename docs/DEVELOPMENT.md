# Development Guide

> *"Welcome, strider, to the Mazes of Development!  You fall through a trap
> door into a large room filled with source code."*

## Prerequisites

- **Node.js 25+** (see `.nvmrc`)
- **Python 3** (for `python3 -m http.server` and data generators)
- **Puppeteer** (`npm install` — used by E2E tests)

For C comparison testing (optional):
- **gcc, make, bison, flex** (build tools)
- **ncurses-dev** (`libncurses-dev` on Linux, Xcode command line tools on macOS)
- **tmux** (drives the C binary headlessly)

## Quick Start

```bash
# Install dependencies
npm install

# Run the game locally
npm run serve
# Open http://localhost:8080

# Run all fast tests (unit + session)
npm test

# Run everything (unit + session + e2e)
npm run test:all
```

## Project Structure

```
js/                    32 ES6 modules — the game engine
│
│  Core
├── nethack.js         Entry point, game loop           ← allmain.c
├── config.js          Constants (terrain types, etc.)  ← rm.h, hack.h
├── player.js          Player state                     ← you.h, decl.h
├── commands.js        Command dispatch                 ← cmd.c
│
│  Display & I/O
├── display.js         Browser terminal rendering       ← win/tty/*.c
├── input.js           Async keyboard queue
├── symbols.js         Display symbols & colors         ← defsym.h, drawing.c
├── pager.js           In-terminal text pager           ← pager.c
│
│  RNG
├── isaac64.js         ISAAC64 core (BigInt)            ← isaac64.c
├── rng.js             PRNG interface: rn2, rnd, d      ← rnd.c
│
│  World Generation
├── dungeon.js         Level generation                 ← mklev.c, mkroom.c, sp_lev.c
├── map.js             Map data structures              ← rm.h, mkmap.c
├── themerms.js        Theme room generation            ← dat/themerms.lua
├── vision.js          Field of view (Algorithm C)      ← vision.c
│
│  Creatures
├── monsters.js        Monster data table (generated)
├── mondata.js         Monster predicate functions      ← mondata.h
├── makemon.js         Monster creation                 ← makemon.c
├── monmove.js         Monster AI                       ← monmove.c
├── dog.js             Pet AI helpers                   ← dog.c
│
│  Objects
├── objects.js         Object data table (generated)
├── objdata.js         Object predicate functions       ← objclass.h
├── mkobj.js           Object creation                  ← mkobj.c
├── o_init.js          Object init & desc shuffle       ← o_init.c
│
│  Character Creation
├── u_init.js          Post-level init: pet, inv, attrs ← u_init.c
│
│  Combat
├── combat.js          Hit/damage/death                 ← uhitm.c, mhitu.c
│
│  Persistence
├── storage.js         Save/restore via localStorage    ← save.c, restore.c
├── bones.js           Bones file management            ← bones.c
├── topten.js          High score list                  ← topten.c
│
│  Data Files
├── hacklib.js         xcrypt cipher & data parsing     ← hacklib.c
├── epitaph_data.js    Encrypted epitaphs               ← dat/epitaph
├── engrave_data.js    Encrypted engravings             ← dat/engrave
└── rumor_data.js      Encrypted rumors                 ← dat/rumors

test/
├── unit/              26 unit test files (node --test)
├── e2e/               2 Puppeteer browser tests
└── comparison/        C-vs-JS comparison testing
    ├── seeds.json     Central config: which seeds to test, with RNG traces
    ├── sessions/      96 gameplay + chargen session JSON files (C-captured)
    ├── maps/          C map sessions with RNG traces (for divergence debugging)
    ├── golden/        ISAAC64 reference values (4 seeds)
    ├── sessions.test.js         Unified node:test wrapper
    ├── session_helpers.js       Grid compare, RNG compare, structural tests
    ├── gen_typ_grid.js          JS map generation (for comparison)
    ├── gen_rng_log.js           Generate JS RNG logs
    └── c-harness/               C build + capture infrastructure

dat/                   Help text files (help.txt, hh.txt, etc.)
docs/                  You are here
spoilers/              The guide content (guide.md → HTML/PDF)
```

## Running Tests

> *"You feel as if someone is testing you."*

### Fast Tests (no C binary needed)

```bash
# Unit tests — module-level correctness
npm run test:unit

# E2E tests — browser rendering via Puppeteer
npm run test:e2e

# Session comparison — replay C reference sessions
npm run test:session

# Everything at once
npm run test:all
```

### Session Tests In Detail

The session runner auto-discovers all `*.session.json` files in
`test/comparison/sessions/` and `test/comparison/maps/` and verifies
JS output against C-captured reference data:

| Session Type | What It Tests | Example |
|---|---|---|
| `"map"` (source: c) | typGrid match + RNG traces + structural validation | `seed16_maps_c.session.json` |
| `"gameplay"` | Startup typGrid + per-step RNG traces + screen rendering | `seed42.session.json` |
| `"chargen"` | Character creation reference data (screens, RNG, inventory) | `seed42_chargen_valkyrie.session.json` |

Map sessions generate levels 1→5 sequentially on one RNG stream (matching
C's behavior). Each level is checked for:
- Cell-by-cell typGrid match against C
- RNG call count match (when `rngCalls` present)
- Per-call RNG trace match (when `rng` present)
- Wall completeness, corridor connectivity, stairs placement

### C Comparison (optional, slower)

```bash
# One-time setup: clone, patch, and build the C binary
bash test/comparison/c-harness/setup.sh

# Regenerate all C sessions and maps from seeds.json config
python3 test/comparison/c-harness/run_session.py --from-config
python3 test/comparison/c-harness/gen_map_sessions.py --from-config

# Generate character creation sessions for all 13 roles
python3 test/comparison/c-harness/gen_chargen_sessions.py --from-config

# Or capture a single seed/role manually
python3 test/comparison/c-harness/gen_map_sessions.py 42 5 --with-rng
python3 test/comparison/c-harness/gen_chargen_sessions.py 42 v h f n Valkyrie

# Session runner auto-discovers all C-captured files
npm run test:session
```

## Common Development Tasks

## C Parity Policy

When working on C-vs-JS parity, follow this rule:

- Use failing unit/session tests to decide what to work on next.
- Use C source code (`nethack-c/src/*.c`) as the behavior spec.
- Do not "fix to the trace" with JS-only heuristics when C code disagrees.
- If a test reveals missing behavior, port the corresponding C logic path.
- Keep changes incremental and keep tests green after each port batch.

### Tutorial Parity Notes

Recent parity work on tutorial sessions established a few stable rules:

- Tutorial status rows should use `Tutorial:<level>` instead of `Dlvl:<level>`.
- Tutorial startup/replay should expose `Xp`-style status output for parity with
  captured interface sessions.
- `nh.parse_config("OPTIONS=...")` options used by tutorial scripts now feed map
  flags (`mention_walls`, `mention_decor`, `lit_corridor`) so movement/rendering
  behavior follows script intent rather than ad-hoc tutorial checks.
- Blocked wall movement now keys off `mention_walls` behavior and matches C
  tutorial captures (`It's a wall.`).

With those in place, tutorial interface screen matching is now complete in the
manual tutorial session. The remaining first mismatch is RNG-only: an early
`nhl_random` (`rn2(100)`) divergence immediately after the first tutorial
`mktrap` call.

### Modifying the dungeon generator

1. Make your changes in `js/dungeon.js` (or related modules)
2. Run `npm run test:session` — failures
   show exactly which cells changed and at which seed/depth
3. If the change is intentional and matches C, the C reference data
   doesn't change. If the C binary also changed, regenerate:
   ```bash
   python3 test/comparison/c-harness/run_session.py --from-config
   python3 test/comparison/c-harness/gen_map_sessions.py --from-config
   ```

### Debugging C-vs-JS divergence

> *"You are hit by a divergent RNG stream! You feel disoriented."*

C map sessions with RNG traces are pre-generated for difficult seeds
(configured in `test/comparison/seeds.json`). The traces include caller
function names for readability:
```
rn2(2)=0 @ randomize_gem_colors(o_init.c:88)
rn2(11)=9 @ shuffle(o_init.c:128)
```

When a map doesn't match C:

```bash
# The session runner compares per-call and reports the first mismatch:
#   RNG diverges at call 1449: JS="rn2(100)=37" session="rn2(1000)=377"
npm run test:session

# To regenerate C traces after a patch change:
python3 test/comparison/c-harness/gen_map_sessions.py --from-config
```

#### Diagnostic Tools for RNG Divergence

Two specialized tools help isolate RNG divergence at specific game turns:

**`selfplay/runner/pet_rng_probe.js`** — Per-turn RNG delta comparison

Compares RNG call counts between C and JS implementations on a per-turn basis,
with filtering for specific subsystems (e.g., dog movement). Runs both C (via
tmux) and JS (headless) simultaneously and shows where RNG consumption diverges.

```bash
# Compare first 9 turns for seed 13296
node selfplay/runner/pet_rng_probe.js --seed 13296 --turns 9

# Show detailed RNG logs for specific turns
node selfplay/runner/pet_rng_probe.js --seed 13296 --turns 20 --show-turn 7 --show-turn 8

# Output shows per-turn RNG call counts and dog_move specific calls:
# Turn | C rng calls | JS rng calls
#    1 |   37         |   37
#    7 |   12         |   16    <- divergence detected
```

**Use when**: RNG traces show divergence but you need to pinpoint exactly which
turn and which subsystem (monster movement, item generation, etc.) is responsible.

**`selfplay/runner/trace_compare.js`** — C trace vs JS behavior comparison

Replays a captured C selfplay trace in JS headless mode and compares turn-by-turn
behavior (actions, position, HP, dungeon level). Supports position offsets for
cases where maps differ slightly but gameplay is similar.

```bash
# Compare C trace against JS headless replay
node selfplay/runner/trace_compare.js --trace traces/captured/trace_13296_valkyrie_score43.json

# Compare with position offset adjustment
node selfplay/runner/trace_compare.js --trace traces/captured/trace_79.json --dx 1 --dy 0

# Ignore position mismatches (focus on actions/HP)
node selfplay/runner/trace_compare.js --trace traces/captured/trace_79.json --ignore-position

# Save JS trace for later inspection
node selfplay/runner/trace_compare.js --trace traces/captured/trace_79.json --output /tmp/js_trace.json

# Output shows first 20 mismatches:
# turn 7: diffs=action,position C={"action":"explore","position":{"x":40,"y":11},"hp":14,"hpmax":14,"dlvl":1} JS={"action":"rest","position":{"x":40,"y":12},"hp":14,"hpmax":14,"dlvl":1}
```

**Use when**: You have a C selfplay trace showing interesting behavior (combat,
prayer, item usage) and want to verify JS reproduces the same decision-making
and outcomes.

**Typical workflow**:
1. Capture C selfplay trace showing the divergence or interesting behavior
2. Run `trace_compare.js` to see when JS behavior diverges from C
3. Use `pet_rng_probe.js` to identify which turn RNG consumption differs
4. Add targeted RNG logging around the suspicious code path
5. Compare RNG logs to find the extra/missing call

### Adding a new test seed

1. Add the seed to `test/comparison/seeds.json`:
   - `map_seeds.with_rng.c` for C map sessions with RNG traces
   - `session_seeds.sessions` for full gameplay sessions
   - `chargen_seeds.sessions` for character creation sessions
2. Regenerate: `python3 test/comparison/c-harness/gen_map_sessions.py --from-config`
3. `npm run test:session` auto-discovers the new file

### Character creation sessions

Chargen sessions capture the full interactive character creation sequence
for all 13 roles, recording every keystroke (including `--More--` as space),
screen state, RNG traces, and starting inventory. Configuration is in
`seeds.json` under `chargen_seeds`:

```bash
# Generate all 13 roles
python3 test/comparison/c-harness/gen_chargen_sessions.py --from-config

# Or a single role
python3 test/comparison/c-harness/gen_chargen_sessions.py 42 v h f n Valkyrie
```

The script adaptively navigates the character creation menus, handling
cases where menus are auto-skipped (e.g., Knight has only one valid race
and alignment). Each session includes the typGrid and inventory display
for comparison with JS.

### Regenerating monster/object data

The monster and object tables are auto-generated from C headers:

```bash
python3 gen_monsters.py > js/monsters.js
python3 gen_objects.py > js/objects.js
```

### Converting Lua special levels to JavaScript

NetHack 3.7 uses Lua scripts for special level generation (Castle, Asmodeus, Oracle,
etc.). The `tools/lua_to_js.py` converter translates these to JavaScript modules:

```bash
# Convert a single level
python3 tools/lua_to_js.py nethack-c/dat/asmodeus.lua > js/levels/asmodeus.js

# Regenerate all converted levels (131 Lua files → 38 active JS files)
for lua_file in nethack-c/dat/*.lua; do
    base=$(basename "$lua_file" .lua)
    # Convert names: bigrm-XX to bigroom-XX
    js_name=$(echo "$base" | sed 's/^bigrm-/bigroom-/')
    python3 tools/lua_to_js.py "$lua_file" > "js/levels/$js_name.js"
done
```

#### What the converter handles

The converter performs careful syntax translation to preserve game semantics:

**String handling:**
- Lua multiline strings `[[ ... ]]` → JavaScript template literals `` `...` ``
- Backticks inside multiline strings are escaped: `` `liberated` `` → `` \`liberated\` ``
- Template literals are protected from regex replacements during expression conversion
- Regular quoted strings (`"..."`, `'...'`) are preserved as-is

**Comments:**
- Lua comments `--` → JavaScript comments `//`
- Comment detection uses string tracking to avoid false matches inside strings

**Expression conversion:**
- String concatenation: `..` → `+`
- Logical operators: `and` → `&&`, `or` → `||`, `not` → `!`
- Method calls: `obj:method()` → `obj.method()`
- Inequality: `~=` → `!==`
- Equality: `==` → `===`
- Table length: `#tbl` → `tbl.length`
- Boolean/null: `nil` → `null`

**Control flow:**
- `for i = 1, n do ... end` → `for (let i = 1; i <= n; i++) { ... }`
- `if ... then ... end` → `if (...) { ... }`
- `function name() ... end` → `function name() { ... }`

**Data structures:**
- Arrays: `{ 1, 2, 3 }` → `[ 1, 2, 3 ]` (simple arrays only)
- Objects: `{ key = value }` → `{ key: value }`

**Special level DSL:**
- Preserves `des.*` calls as-is (same API between Lua and JS)
- Handles nested `des.map({ ..., contents: function() { ... } })` structures
- Maintains proper statement boundaries with depth tracking

#### Known limitations

- Template literals with `${}` interpolation syntax would break (none found in NetHack Lua)
- Complex nested table expressions may need manual adjustment
- Assumes `des.*` functions have identical signatures between Lua and JS

#### Debugging converter issues

When a converted file has problems:

1. **Check ASCII maps** — dots becoming `+` means template literal protection failed
2. **Check comments** — comments eating code means statement splitting is wrong
3. **Check syntax errors** — unbalanced braces usually means multiline collection broke
4. **Run all Lua files** — `for f in nethack-c/dat/*.lua; do python3 tools/lua_to_js.py "$f" > /tmp/test.js || echo "FAILED: $f"; done`

The converter tracks several state machines simultaneously:
- String tracking (single/double quote detection)
- Brace/paren depth (for multiline call collection)
- Template literal extraction (to protect from regex corruption)
- Comment context (to avoid converting `--` inside strings)

### Adding a new C patch

Patches live in `test/comparison/c-harness/patches/` and are applied by
`setup.sh`. To add one:

1. Make changes in `nethack-c/nethack/`
2. `cd nethack-c/nethack && git diff > ../../test/comparison/c-harness/patches/003-your-patch.patch`
3. Add the `git apply` line to `setup.sh`
4. Run `bash test/comparison/c-harness/setup.sh` to verify

## The C Harness

> *"You hear the rumble of distant compilation."*

The C harness builds a patched NetHack 3.7 binary for ground-truth comparison.
The C source is **frozen at commit `79c688cc6`** and never modified directly —
only patches in `test/comparison/c-harness/patches/` are applied on top.
Five patches make the C binary testable:

**`001-deterministic-seed.patch`** — Reads `NETHACK_SEED` from the environment
instead of `/dev/urandom`. Crucially, does NOT set `has_strong_rngseed`, so
`reseed_random()` between levels becomes a no-op. One seed → deterministic game.

**`002-map-dumper.patch`** — Adds the `#dumpmap` wizard command, which writes
`levl[x][y].typ` as 21 rows of 80 space-separated integers to `NETHACK_DUMPMAP`.

**`003-prng-logging.patch`** — When `NETHACK_RNGLOG` is set, logs every
`rn2()`/`rnd()`/`d()` call with args, result, and caller context
(`__func__`, `__FILE__`, `__LINE__`). Format: `rn2(12)=2 @ shuffle(o_init.c:128)`.

**`004-obj-dumper.patch`** — Adds object inspection/dumping support for
verifying inventory and object creation against JS.

**`005-midlog-infrastructure.patch`** — Enables mid-session RNG log control
for capturing traces at specific points during gameplay.

### Why raw terrain grids instead of terminal output?

A `|` on screen could be VWALL, TLWALL, TRWALL, or GRAVE. The raw typ integers
are unambiguous. Terminal output also depends on FOV (the player can't see most
of the map), and requires ANSI escape stripping. Integer grids are faster,
simpler, and definitive.

### Setup gotchas

- **Lua is required** — NetHack 3.7 embeds Lua. `setup.sh` runs `make fetch-lua`.
- **Wizard mode** — `sysconf` must have `WIZARDS=*`. The script sets this.
- **Stale game state** — Lock files (`501wizard.0`), saves, and bones from
  crashed tmux sessions cause "Destroy old game?" prompts. All harness scripts
  clean these up before each run.
- **Parallel Lua build race** — `make -j` can race on `liblua.a`. The script
  builds Lua separately first.

## Architecture in 60 Seconds

> *"You read a blessed scroll of enlightenment."*

**Game loop**: `js/nethack.js` runs an async loop. Player input uses
`await getChar()` which yields to the browser event loop. Every function
that might need input must be `async`.

**PRNG**: `js/isaac64.js` produces bit-identical uint64 sequences to C.
`js/rng.js` wraps it with `rn2()`, `rnd()`, `d()`, etc. The RNG log
(`enableRngLog()` / `getRngLog()`) captures every call for comparison.

**Level generation**: `initRng(seed) → initLevelGeneration() → makelevel(depth) → wallification(map)`. One continuous RNG stream across depths.

**Display**: `<pre>` element with per-cell `<span>` tags. DEC graphics
symbols mapped to Unicode box-drawing characters. No canvas, no WebGL.

**Testing philosophy**: Two layers of truth —
1. ISAAC64 produces identical sequences (golden reference files)
2. JS matches C cell-for-cell (C-captured sessions with RNG traces)

## Code Conventions

- **C references**: Every ported function has `// C ref: filename.c:function_name()`
- **ES6 modules**: No build step, no bundler. Import directly in browser.
- **No frameworks**: Vanilla JS, vanilla DOM. The game ran in 1987 without React.
- **Constants match C**: `STONE`, `VWALL`, `ROOM`, etc. are identical values.
  See `js/config.js`.

## Current Parity Findings (2026-02-17)

- Map-session status is currently **9/10 passing** in `session_test_runner --type map`.
- The remaining map failure is `seed16_maps_c.session.json` at depth 5.
- A meaningful improvement landed in special-level corridor parity:
  `seed16_maps_c` now matches farther before first divergence
  (**12420/13100** RNG calls matched, up from **12276/13154** before this pass).
- Key confirmed C reference:
  `nethack-c/src/sp_lev.c:2611-2614` uses `rn2(dix - diy + 1)` /
  `rn2(diy - dix + 1)` in corridor tie-break logic.
- Remaining drift is now narrowed to a later `dig_corridor`/`maybe_sdoor` transition
  in the same seed/depth trace; use the first divergence context from
  `session_test_runner` to continue.

## Further Reading

- **[DESIGN.md](DESIGN.md)** — Detailed architecture and module design
- **[DECISIONS.md](DECISIONS.md)** — Design decision log with rationale
- **[SESSION_FORMAT.md](SESSION_FORMAT.md)** — Session JSON format specification
- **[COLLECTING_SESSIONS.md](COLLECTING_SESSIONS.md)** — How to capture C reference sessions
- **[PHASE_1_PRNG_ALIGNMENT.md](PHASE_1_PRNG_ALIGNMENT.md)** — The story of achieving bit-exact C-JS parity
- **[PHASE_2_GAMEPLAY_ALIGNMENT.md](PHASE_2_GAMEPLAY_ALIGNMENT.md)** — Gameplay session alignment goals & progress

---

> *"You ascend to the next level of understanding. The strident call of
> a test suite echoes through the Mazes of Development. All tests pass!"*
