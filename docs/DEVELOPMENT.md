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

# Run all fast tests (unit + E2E)
npm test

# Run everything including session comparison
npm test && node --test test/comparison/session_runner.test.js
```

## Project Structure

```
js/                    26 ES6 modules — the game engine
├── nethack.js         Entry point, game loop           ← allmain.c
├── dungeon.js         Level generation (~99KB)         ← mklev.c, mkroom.c
├── makemon.js         Monster creation                 ← makemon.c
├── mkobj.js           Object creation                  ← mkobj.c
├── combat.js          Hit/damage/death                 ← uhitm.c, mhitu.c
├── monmove.js         Monster AI                       ← mon.c, dog.c
├── vision.js          Field of view (Algorithm C)      ← vision.c
├── rng.js             PRNG (ISAAC64, bit-exact)        ← rnd.c
├── isaac64.js         ISAAC64 core                     ← isaac64.c
├── display.js         Browser terminal rendering       ← win/tty/*.c
├── input.js           Async keyboard queue
├── config.js          Constants (terrain types, etc.)   ← rm.h, hack.h
├── themerms.js        Theme room generation            ← dat/themerms.lua
├── monsters.js        Monster data table (generated)
├── objects.js         Object data table (generated)
└── ...                More modules

test/
├── unit/              18 unit test files (150 tests, ~0.3s)
├── e2e/               2 Puppeteer browser tests
└── comparison/        Session-based comparison testing
    ├── sessions/      19 session JSON files (ground truth)
    ├── golden/        ISAAC64 reference values
    ├── session_runner.test.js   Unified test runner (635 tests)
    ├── session_helpers.js       Grid compare, RNG compare, structural tests
    ├── gen_typ_grid.js          Generate/regenerate session files
    └── c-harness/               C build + capture infrastructure

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

# Session comparison — dungeon generation at 17 seeds × 5 depths
node --test test/comparison/session_runner.test.js

# Everything at once
npm test && node --test test/comparison/session_runner.test.js
```

### Session Tests In Detail

The session runner auto-discovers all `*.session.json` files in
`test/comparison/sessions/` and verifies whatever data is present:

| Session Type | What It Tests | Example |
|---|---|---|
| `"map"` | typGrid match + structural validation + RNG counts | `seed42_maps.session.json` |
| `"gameplay"` | Startup typGrid + RNG traces + screen rendering | `seed42.session.json` |

Map sessions generate levels 1→5 sequentially on one RNG stream (matching
C's behavior). Each level is checked for:
- Cell-by-cell typGrid match
- RNG call count (when `rngCalls` present)
- RNG trace match (when `rng` present)
- Wall completeness, corridor connectivity, stairs placement
- Determinism (generate twice, compare)

### C Comparison (optional, slower)

```bash
# One-time setup: clone, patch, and build the C binary
bash test/comparison/c-harness/setup.sh

# Capture a C map session for seed 42, depths 1-5
python3 test/comparison/c-harness/gen_map_sessions.py 42 5

# Capture with full RNG traces (for debugging divergence)
python3 test/comparison/c-harness/gen_map_sessions.py 42 5 --with-rng

# The captured session lands in sessions/seed42_maps_c.session.json
# Session runner will auto-discover and test it
node --test test/comparison/session_runner.test.js
```

## Common Development Tasks

### Modifying the dungeon generator

1. Make your changes in `js/dungeon.js` (or related modules)
2. Run `node --test test/comparison/session_runner.test.js` — failures
   show exactly which cells changed and at which seed/depth
3. If the change is intentional, regenerate sessions:
   ```bash
   node test/comparison/gen_typ_grid.js --sessions 5
   ```
4. Run tests again to confirm they pass

### Debugging C-vs-JS divergence

> *"You are hit by a divergent RNG stream! You feel disoriented."*

When a map doesn't match C, use RNG traces to find the exact divergence:

```bash
# Generate JS session with full RNG traces
node test/comparison/gen_typ_grid.js --sessions 5 --with-rng

# Generate C session with full RNG traces
python3 test/comparison/c-harness/gen_map_sessions.py 42 5 --with-rng

# The session runner will compare per-call and report the first mismatch:
#   RNG diverges at call 1449: JS="rn2(100)=37" session="rn2(1000)=377"
node --test test/comparison/session_runner.test.js
```

Then strip the `--with-rng` sessions and regenerate normal ones after fixing.

### Adding a new test seed

1. Add to `CONFIGS` in `test/comparison/gen_typ_grid.js`
2. Run `node test/comparison/gen_typ_grid.js --sessions 5`
3. The session runner auto-discovers the new file

### Regenerating monster/object data

The monster and object tables are auto-generated from C headers:

```bash
python3 gen_monsters.py > js/monsters.js
python3 gen_objects.py > js/objects.js
```

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
Three patches make the C binary testable:

**`001-deterministic-seed.patch`** — Reads `NETHACK_SEED` from the environment
instead of `/dev/urandom`. Crucially, does NOT set `has_strong_rngseed`, so
`reseed_random()` between levels becomes a no-op. One seed → deterministic game.

**`002-map-dumper.patch`** — Adds the `#dumpmap` wizard command, which writes
`levl[x][y].typ` as 21 rows of 80 space-separated integers to `NETHACK_DUMPMAP`.

**`003-prng-logging.patch`** — When `NETHACK_RNGLOG` is set, logs every
`rn2()`/`rnd()`/`d()` call with args, result, and source location.

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

**Testing philosophy**: Three layers of truth —
1. ISAAC64 produces identical sequences (golden reference files)
2. JS map generation is deterministic (session regression tests)
3. JS matches C cell-for-cell (C-captured sessions)

## Code Conventions

- **C references**: Every ported function has `// C ref: filename.c:function_name()`
- **ES6 modules**: No build step, no bundler. Import directly in browser.
- **No frameworks**: Vanilla JS, vanilla DOM. The game ran in 1987 without React.
- **Constants match C**: `STONE`, `VWALL`, `ROOM`, etc. are identical values.
  See `js/config.js`.

## Further Reading

- **[DESIGN.md](DESIGN.md)** — Detailed architecture and module design
- **[DECISIONS.md](DECISIONS.md)** — Design decision log with rationale
- **[SESSION_FORMAT.md](SESSION_FORMAT.md)** — Session JSON format specification
- **[PHASE_1_PRNG_ALIGNMENT.md](PHASE_1_PRNG_ALIGNMENT.md)** — The story of achieving bit-exact C-JS parity

---

> *"You ascend to the next level of understanding. The strident call of
> a test suite echoes through the Mazes of Development. All tests pass!"*
