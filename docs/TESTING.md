# Testing the Dungeons of WebHack

> *"You feel as if someone is testing you."*
> -- The Oracle of Delphi, probably

Welcome, brave adventurer, to WebHack's comparison testing framework! This
document explains how we verify that the JavaScript port faithfully reproduces
the dungeons, corridors, and occasional lava pools of the original C NetHack.

## The Quest

WebHack is a faithful JavaScript port of NetHack 3.7. "Faithful" means
something very specific here: **given the same random seed, the JS and C
versions should produce identical dungeons, cell for cell.** Every wall,
every corridor, every suspiciously placed fountain.

This is possible because:
1. We ported ISAAC64, NetHack's PRNG, to produce **bit-identical** random
   sequences using JavaScript BigInt.
2. We ported the dungeon generation algorithms from `mklev.c` to match the
   C logic exactly.
3. We patch the C binary to accept a deterministic seed, preventing
   `reseed_random()` from re-seeding with `/dev/urandom` between levels.

The comparison tests verify all of this.

## Test Architecture

```
test/
├── unit/                    # 100+ unit tests (fast, always run)
├── e2e/                     # 34 Puppeteer browser tests
└── comparison/              # Ground truth comparison tests
    ├── golden/              # Golden reference files
    │   ├── seed42_depth1.txt       # Rendered map (ASCII art)
    │   ├── typ_seed42_depth1.txt   # Raw terrain type grid
    │   └── isaac64_seed42.txt      # PRNG reference values
    ├── gen_golden.js        # Generate rendered map golden files
    ├── gen_typ_grid.js      # Generate raw typ grid golden files
    ├── map_compare.test.js  # JS golden reference tests
    ├── c_vs_js_map.test.js  # C-vs-JS comparison tests
    └── c-harness/           # C build infrastructure
        ├── setup.sh         # Clone, patch, build C binary
        ├── patches/
        │   ├── 001-deterministic-seed.patch
        │   └── 002-map-dumper.patch
        └── results/         # C test output (gitignored)
```

### Three Levels of Truth

Like NetHack's dungeon, our tests have layers:

**Layer 1: PRNG Verification** (`isaac64_*.txt` golden files)
> *You read a scroll of verification. The random numbers are correct!*

We verify that `js/isaac64.js` produces the exact same uint64 sequence as
the C `isaac64.c` for multiple seeds. This is tested against output from a
compiled C reference program. If this layer fails, nothing else can possibly
match.

**Layer 2: JS Golden References** (`map_compare.test.js`)
> *You sense the presence of determinism.*

We generate dungeon levels with fixed seeds and compare them character-by-
character against golden reference files. This catches regressions in our
own JS code -- if a refactoring changes the RNG call sequence even slightly,
the golden files will catch it.

The golden test suite also validates structural properties:
- Map dimensions (21 rows x 80 columns, always)
- Valid terrain characters (no mysterious '?' symbols)
- Complete wall borders around rooms
- Corridor connectivity (every room reachable via BFS)
- Correct stair placement

**Layer 3: C Ground Truth** (`c_vs_js_map.test.js`)
> *You hear the rumble of distant comparison. The walls of the Mazes of
> Menace tremble as two realities align.*

The ultimate test: we run the **actual C NetHack binary** with the same seed
and compare the raw terrain grid (`levl[x][y].typ`) against the JS output.
This catches cases where both the JS code and its golden files are wrong in
the same way -- a consistent bug that golden tests alone can't detect.

## Running the Tests

### Quick: JS Tests Only (no C binary needed)

```bash
# All JS tests (unit + comparison golden files)
node --test test/unit/*.test.js test/comparison/*.test.js

# Just the comparison tests
node --test test/comparison/map_compare.test.js

# Just the C-vs-JS tests (skipped if C binary not built)
node --test test/comparison/c_vs_js_map.test.js
```

### Full: Including C Comparison

```bash
# Step 1: Install build dependencies (one-time)
sudo apt-get install -y gcc make bison flex libncurses-dev

# Step 2: Build and install the C binary (~2 minutes, idempotent)
bash test/comparison/c-harness/setup.sh

# Step 3: Run all tests including C comparison (~45 seconds)
node --test test/comparison/*.test.js
```

The setup script handles everything: cloning the C source at pinned commit
`79c688cc6`, applying patches, fetching Lua (a NetHack 3.7 dependency),
building, and installing to `~/nethack-minimal/`. It also configures the
`sysconf` file to allow wizard mode for all users.

The C-vs-JS comparison uses **tmux** to automate the C binary: it starts
a tmux session, navigates through character selection and startup prompts,
executes `#dumpmap`, and extracts the terrain grid. This requires `tmux`
and `python3` (both standard on Linux).

### Regenerating Golden Files

If you intentionally change the dungeon generator:

```bash
# Regenerate rendered map golden files
node test/comparison/gen_golden.js

# Regenerate raw typ grid golden files
node test/comparison/gen_typ_grid.js
```

> **Warning:** Only regenerate golden files when you're certain the new
> output is correct! The whole point of golden files is to catch unintended
> changes.

## How the C Harness Works

### The Seed Patch (`001-deterministic-seed.patch`)

NetHack's `sys_random_seed()` normally reads from `/dev/urandom` and sets
`has_strong_rngseed = TRUE`. This is a problem because `reseed_random()`
is called in `mklev()` before and after `makelevel()` -- if the seed is
"strong", it re-seeds the PRNG with fresh randomness, destroying
reproducibility.

Our patch reads the `NETHACK_SEED` environment variable and returns it
directly **without** setting `has_strong_rngseed`. This makes the entire
game deterministic from that single seed.

```c
// In sys/unix/unixmain.c:sys_random_seed()
const char *env_seed = getenv("NETHACK_SEED");
if (env_seed) {
    unsigned long seed = strtoul(env_seed, NULL, 10);
    /* has_strong_rngseed remains FALSE */
    return seed;
}
```

### The Map Dumper Patch (`002-map-dumper.patch`)

Adds the `#dumpmap` wizard-mode command, which writes the raw
`levl[x][y].typ` grid to a file. The output is 21 rows of 80
space-separated integers -- the simplest possible format for comparison.

```bash
export NETHACK_SEED=42
export NETHACK_DUMPMAP=/tmp/map42.txt
./nethack -u Wizard -D
# In game: #dumpmap
```

The filename comes from `NETHACK_DUMPMAP` (defaults to `dumpmap.txt`).

### C Build Setup Notes

Several things must be right for the C binary to work in automated tests:

1. **Lua is required.** NetHack 3.7 embeds Lua for scripting special levels.
   The setup script runs `make fetch-lua` to download it.

2. **`ncurses-dev` is required.** The TTY interface needs ncurses headers
   (`curses.h`). Install with `sudo apt-get install libncurses-dev`.

3. **Wizard mode access.** The `sysconf` file controls who can use `-D`
   (wizard mode). The setup script sets `WIZARDS=*` to allow all users.
   Without this, `#dumpmap` (a wizard command) won't be available.

4. **`NETHACKDIR` environment variable.** The installed binary looks for
   data files at its compiled-in `HACKDIR` path. The test automation sets
   `NETHACKDIR` to override this and point to the install directory.

5. **Save files.** If a save file exists from a previous run, the game
   shows a "keep save file?" prompt that can confuse automation. The
   `run_dumpmap.py` script cleans up saves before each run.

6. **Character selection.** The `.nethackrc` pre-selects role/race/gender/
   alignment, but the game still shows "Shall I pick?" and "Is this ok?"
   prompts, plus an intro text ("Book of Odin") and a tutorial offer.
   The automation script handles all of these.

7. **Parallel Lua build race.** The NetHack `make -j` can hit a race
   condition copying `liblua.a`. The setup script builds Lua separately
   first to avoid this.

### Why Not Parse Terminal Output?

You might wonder why we don't just compare screen output. Three reasons:

1. **Terminal rendering adds ambiguity.** A `|` on screen could be VWALL,
   TLWALL, TRWALL, or even GRAVE. The raw typ values are unambiguous.
2. **Screen output depends on FOV.** The C game only shows what the player
   can see. We'd need to run `#wizmap` first, adding complexity.
3. **Faster to compare.** Integer grids parse instantly; terminal output
   needs ANSI escape code stripping.

## The Comparison Format

Both C and JS output the same format:

```
0 0 0 0 0 0 0 2 2 2 2 2 2 0 0 ...
0 0 0 0 0 0 0 1 25 25 25 25 1 0 ...
```

Each integer is a terrain type code from `include/rm.h`:
- `0` = STONE (empty rock)
- `1` = VWALL (vertical wall `|`)
- `2` = HWALL (horizontal wall `-`)
- `23` = DOOR
- `24` = CORR (corridor `#`)
- `25` = ROOM (floor `.`)
- `26` = STAIRS

See `js/config.js` for the full list. The constants are identical between
C and JS by design.

## Current Divergences (Bugs to Fix)

The comparison tests currently show significant differences between C and
JS (500-900 cells per map). These are bugs in the JS dungeon generator,
not "acceptable" differences. The comparison framework exists to track
them and drive them to zero.

Current cell-diff counts (seed/depth=1):
- seed=42: ~889 cells differ
- seed=100: ~543 cells differ
- seed=999: ~696 cells differ

Root causes to investigate (roughly in order of impact):

| Feature | C NetHack | JS WebHack | Impact |
|---------|-----------|------------|--------|
| Room placement RNG | Full `mklev.c` algorithm | Simplified port | Rooms in different positions |
| Special rooms | Shops, temples, etc. | Not yet ported | Missing room types |
| Vaults | Generated by `mkvaults()` | Not yet ported | Missing small rooms |
| Niches | Generated by `mkniche()` | Not yet ported | Missing wall features |
| Secret doors | Full algorithm | Simplified | Different SDOOR placement |
| Corridor algorithm | Full `join()` with retries | Simplified port | Different corridor paths |
| Lua levels | Full support | None | Special levels differ entirely |

The test logs every differing cell with its C and JS terrain type, making
it easy to diagnose which porting gaps cause the most differences. As each
feature is ported, the diff counts should drop.

## Adding New Comparison Tests

### Adding a New Seed/Depth Configuration

1. Add the config to `CONFIGS` in both `gen_golden.js` and `gen_typ_grid.js`
2. Regenerate golden files: `node test/comparison/gen_golden.js`
   and `node test/comparison/gen_typ_grid.js`
3. The tests automatically pick up new configs

### Adding a New Comparison Dimension

To compare something beyond terrain types (e.g., monster placement,
object positions):

1. Add a JS generator function (like `generateTypGrid`)
2. Add a C dumper patch (like `002-map-dumper.patch`)
3. Write a test that runs both and compares output

### Phase 2: Screen-Level Comparison

*Coming soon.* This will compare full terminal screens (character + color)
between C and JS using:
- **C side:** tmux session capture for pixel-perfect terminal output
- **JS side:** Puppeteer headless browser screenshots
- **Comparison:** Cell-by-cell character and color matching

This catches rendering bugs that terrain-grid comparison misses (wrong
symbols, wrong colors, missing status line elements, etc.).

## Philosophy

> *"The strstrstr of the Mazes of Menace are treacherous, but they are
> deterministic. Given the same seed, the same dungeon awaits. This is
> both a comfort and a test."*

NetHack has been continuously developed since 1987. The code is dense,
full of special cases, and deeply interconnected. Porting it faithfully
requires verifying not just "does it look right?" but "does it match
exactly?" The comparison testing framework is how we keep honest.

Every divergence between C and JS is either:
1. **A known gap** (documented above) that we'll fix
2. **A bug** that comparison tests helped us find

The goal: zero differences. When we get there, you can trust that
WebHack's Mazes of Menace are the real thing.

---

*"You hear the strident call of a test suite. All tests pass!"*
