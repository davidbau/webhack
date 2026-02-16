# Session Format (v2) - DEPRECATED

> **Note:** This document describes the v2 session format which is deprecated.
> See [SESSION_FORMAT_V3.md](SESSION_FORMAT_V3.md) for the current format.

> *"You carefully read the scroll. It describes a session format."*

## Overview

A **session file** is a single JSON document that captures reference data for
verifying the JS port against C NetHack. All test reference data lives in
session files — there is one unified format for both map-only grid comparison
and full gameplay replay.

**Two session types:**
- **`"map"`** — terrain type grids at multiple dungeon depths (no gameplay)
- **`"gameplay"`** — full playthrough with RNG traces, screens, and step data

All data fields are optional except `version` and `seed`. The session test entrypoint
(`sessions.test.js`) verifies whatever fields are present and skips
the rest. This means a minimal session with just a seed and one typGrid is
a valid test.

**File location:** `test/comparison/maps/` (map sessions), `test/comparison/sessions/` (gameplay sessions)
**Naming:** `seed<N>_maps.session.json` (map) or `seed<N>.session.json` (gameplay)

## Map-Only Sessions

Map sessions capture terrain type grids at multiple dungeon depths.
The test runner generates levels 1→N sequentially on one continuous RNG
stream (matching C's behavior when wizard-teleporting through levels).

```jsonc
{
  "version": 2,
  "seed": 42,
  "type": "map",
  "source": "js",  // "js" = generated from JS, "c" = captured from C binary
  "levels": [
    {
      "depth": 1,
      "typGrid": [[0, 0, ...], ...21 rows of 80 ints],
      "rngCalls": 2686,              // optional: RNG calls consumed for this level
      "rng": ["rn2(2)=1", ...]       // optional: per-call RNG trace (compact format)
    },
    { "depth": 2, "typGrid": [[...], ...], "rngCalls": 2354 },
    // ...
  ]
}
```

Each level has optional RNG fields:
- **`rngCalls`** — integer count of RNG calls consumed generating this level.
  Cheap to include and useful for quick divergence detection.
- **`rng`** — full per-call trace array. Same compact format as gameplay
  sessions: `fn(arg)=result` with optional `@ source:line` suffix. Large
  (thousands of entries per level), so only included on request.

When the test runner finds `rngCalls` or `rng` in a level, it uses
`generateMapsWithRng()` to capture JS RNG traces and compares them.
Cross-language comparison (C session vs JS) compares only the `fn(arg)=result`
portion, ignoring `@ source:line` tags (since C and JS source files differ).

**Generating map sessions from JS:**
```bash
# With rngCalls counts (default, committed to repo):
node test/comparison/gen_typ_grid.js --sessions 5

# With full RNG traces (for debugging):
node test/comparison/gen_typ_grid.js --sessions 5 --with-rng
```

**Generating map sessions from C** (captures ground-truth reference data):
```bash
# With just typGrid + rngCalls:
python3 test/comparison/c-harness/gen_map_sessions.py 42 5

# With full RNG traces:
python3 test/comparison/c-harness/gen_map_sessions.py 42 5 --with-rng
```

## Gameplay Sessions

Gameplay sessions capture a full playthrough: startup state and a sequence
of player actions with per-step RNG traces, screens, and terrain grids.

```jsonc
{
  // Schema version
  "version": 2,

  // Session type
  "type": "gameplay",

  // PRNG seed (passed as NETHACK_SEED to C binary)
  "seed": 42,

  // Wizard mode flag (affects startup sequence and available commands)
  "wizard": true,

  // Character creation options (match .nethackrc)
  "character": {
    "name": "Wizard",
    "role": "Valkyrie",
    "race": "human",
    "gender": "female",
    "align": "neutral"
  },

  // Terminal symbol set used for screen captures
  // "DECgraphics" means box-drawing chars are encoded as DEC VT100 codes
  // (l=TL corner, q=horizontal, k=TR corner, x=vertical, etc.)
  "symset": "DECgraphics",

  // Game state after startup (level generated, post-level init complete,
  // before any player commands)
  "startup": {
    // Total RNG calls consumed during startup
    // (o_init + level gen + post-level init)
    "rngCalls": 2807,

    // Per-call RNG trace for the entire startup sequence (optional).
    // Same compact string format as step rng entries.
    // When present, rng.length === rngCalls.
    // Essential for debugging startup divergences between C and JS —
    // pinpoints exactly which RNG call first diverges.
    "rng": [
      "rn2(2)=1 @ o_init.c:88",
      "rn2(2)=0 @ o_init.c:91",
      "rn2(4)=0 @ o_init.c:94",
      "... rngCalls entries total ..."
    ],

    // Terrain type grid for the starting level (depth 1)
    // 21 rows x 80 columns of integer terrain type codes
    // (STONE=0, VWALL=1, HWALL=2, ..., ROOM=25, STAIRS=26)
    "typGrid": [
      [0, 0, 0, "... 80 values per row ..."],
      "... 21 rows total ..."
    ],

    // Screen state: 24 lines as captured from C terminal
    // Row 0: message line
    // Rows 1-21: map area (DEC graphics encoding)
    // Rows 22-23: status lines
    "screen": [
      "",
      "                                                       lqqqqqqk",
      "                                                       x~%~~~~x",
      "                                                       ~~@~~~~x",
      "... 24 lines total ..."
    ],

    // Optional ANSI-preserving screen capture (24 lines).
    // Contains escape sequences for colors/attributes/charset shifts.
    // Present in newer DECgraphics captures for richer fidelity checks.
    "screenAnsi": [
      "\u001b[0m...",
      "... 24 lines total ..."
    ]
  },

  // Ordered sequence of player actions and their ground truth
  "steps": [
    {
      // The key sent to C NetHack
      "key": ":",

      // Human-readable action description
      "action": "look",

      // Turn number after this step (0 = no game turn consumed)
      "turn": 0,

      // Dungeon level after this step
      "depth": 1,

      // RNG calls consumed during this step
      // Each entry: "fn(arg)=result" with optional " @ source:line"
      // Empty array if no RNG consumed (e.g., look command)
      "rng": [],

      // Screen state after this step (24 lines, same format as startup)
      "screen": [
        "There is a staircase up out of the dungeon here.",
        "                                                       lqqqqqqk",
        "..."
      ],

      // Optional ANSI-preserving screen capture after this step.
      "screenAnsi": [
        "\u001b[0m...",
        "... 24 lines total ..."
      ]
    },
    {
      "key": "h",
      "action": "move-west",
      "turn": 1,
      "depth": 1,
      "rng": [
        "rn2(12)=2 @ mon.c:1145",
        "rn2(12)=9 @ mon.c:1145",
        "rn2(12)=3 @ mon.c:1145",
        "rn2(12)=3 @ mon.c:1145",
        "rn2(70)=52 @ allmain.c:234",
        "rn2(400)=79 @ sounds.c:213",
        "rn2(20)=9 @ eat.c:3186",
        "rn2(82)=26 @ allmain.c:359",
        "rn2(31)=3 @ allmain.c:414"
      ],
      "screen": ["...", "... 24 lines ..."]
    },
    {
      "key": ">",
      "action": "descend",
      "turn": 12,
      "depth": 2,

      // When the level changes, include the new terrain grid
      "typGrid": [
        [0, 0, 0, "... depth 2 terrain ..."],
        "... 21 rows ..."
      ],

      "rng": ["..."],
      "screen": ["..."]
    }
  ]
}
```

## Field Reference

### Top Level (all sessions)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | number | yes | Schema version (currently 2) |
| `seed` | number | yes | PRNG seed for ISAAC64 |
| `type` | string | yes | `"map"` or `"gameplay"` |
| `source` | string | no | `"js"` or `"c"` — which engine generated the data |

### Top Level (gameplay sessions)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wizard` | boolean | yes | Whether wizard mode (`-D`) is enabled |
| `character` | object | yes | Character creation options |
| `symset` | string | yes | Terminal symbol set (`"DECgraphics"`) |
| `startup` | object | yes | Game state after initialization |
| `steps` | array | yes | Ordered player actions with ground truth |

### `levels[i]` (map sessions)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `depth` | number | yes | Dungeon level number |
| `typGrid` | number[][] | yes | 21x80 terrain type grid |
| `rngCalls` | number | no | RNG calls consumed generating this level |
| `rng` | string[] | no | Per-call RNG trace; length === `rngCalls` |

### `character`

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Player name |
| `role` | string | Role (e.g., `"Valkyrie"`, `"Wizard"`) |
| `race` | string | Race (e.g., `"human"`, `"elf"`) |
| `gender` | string | `"male"` or `"female"` |
| `align` | string | `"lawful"`, `"neutral"`, or `"chaotic"` |

### `startup`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rngCalls` | number | yes | Total PRNG consumptions during startup |
| `rng` | string[] | no | Per-call RNG trace (same format as step `rng`); length === `rngCalls` |
| `typGrid` | number[][] | yes | 21x80 terrain type grid for starting level |
| `screen` | string[] | yes | 24-line terminal screen after startup |

### `steps[i]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | yes | Key sent to C NetHack (e.g., `"h"`, `"."`, `">"`) |
| `action` | string | yes | Human-readable description |
| `turn` | number | yes | Game turn after this step |
| `depth` | number | yes | Dungeon level after this step |
| `rng` | string[] | yes | RNG calls consumed (may be empty) |
| `screen` | string[] | yes | 24-line screen after this step |
| `typGrid` | number[][] | no | Terrain grid (on level changes or terrain modifications) |

## RNG Trace Format

Each RNG entry is a compact string:

```
fn(arg)=result @ source:line
```

Examples:
```
rn2(12)=2 @ mon.c:1145
rnd(8)=5 @ makemon.c:320
rn1(31,15)=22 @ allmain.c:414
```

The `@ source:line` suffix is optional but useful for debugging divergences.
It references the C source file where the call originates.

Only primitive RNG functions are logged: `rn2`, `rnd`, `rn1`. Wrapper
functions like `rne` and `rnz` are not logged separately — their internal
`rn2` calls appear individually.

The global RNG call index is not stored per-entry. It can be reconstructed:
`startup.rngCalls + sum of rng.length for all preceding steps + position`.

### Startup RNG (`startup.rng`)

The `startup.rng` array is optional because startup involves thousands of RNG
calls (typically 2000-3000) and adds significant file size. It uses the same
compact string format as step `rng` entries.

When present, `startup.rng` enables line-by-line comparison of the C and JS
startup sequences. This is critical for debugging startup divergences — when
the JS port's `makelevel()` or `simulatePostLevelInit()` consumes a different
number of RNG calls than C, the per-call trace pinpoints the exact call where
they first diverge. Without it, you only know the total count is wrong.

The `startup.rng` array covers the full startup: `o_init` (object/monster
shuffles), `makelevel` (dungeon generation), and post-level init (pet
creation, attribute initialization, welcome messages). The `@ source:line`
annotations reference C source files like `o_init.c`, `mkroom.c`, `mkobj.c`,
`makemon.c`, `attrib.c`, and `allmain.c`.

Example:
```
startup.rng[0]    = "rn2(2)=1 @ o_init.c:88"      // first shuffle
startup.rng[255]  = "rn2(7)=3 @ dungeon.js:289"    // makelevel starts
startup.rng[2350] = "rnd(9000)=3711 @ allmain.c:74" // main loop init
```

The `run_session.py` capture tool automatically includes `startup.rng` in new
sessions. Older session files (like `seed42.session.json`) may lack it — the
field is treated as optional by test code.

## Screen Format

Screens are 24 lines of text as captured from the C terminal via tmux:

- **Row 0**: Message line (may be empty)
- **Rows 1-21**: Map area (21 rows, up to 80 columns)
- **Row 22**: Status line 1 (name, attributes)
- **Row 23**: Status line 2 (level, HP, etc.)

Map rows use DEC graphics encoding when `symset` is `"DECgraphics"`:

| DEC char | Unicode | Meaning |
|----------|---------|---------|
| `l` | `\u250c` | Top-left corner |
| `q` | `\u2500` | Horizontal wall |
| `k` | `\u2510` | Top-right corner |
| `x` | `\u2502` | Vertical wall |
| `m` | `\u2514` | Bottom-left corner |
| `j` | `\u2518` | Bottom-right corner |
| `n` | `\u253c` | Cross wall |
| `t` | `\u251c` | Right T |
| `u` | `\u2524` | Left T |
| `v` | `\u2534` | Bottom T |
| `w` | `\u252c` | Top T |
| `~` | `\u00b7` | Room floor |

Test code converts DEC to Unicode before comparison. The DEC encoding is
preserved in the session file because it's the raw C output — no lossy
transformation.

**Note:** The tmux capture shifts map columns by 1 (column 0 is not
captured). Test code prepends a space to map rows to correct this. This
quirk is documented here so future capture methods can avoid it.

## Terrain Type Grid

The `typGrid` is a 21x80 array of integers matching C's `levl[x][y].typ`
values. Key type codes (from `include/rm.h` / `js/config.js`):

| Code | Constant | Display |
|------|----------|---------|
| 0 | STONE | (empty rock) |
| 1 | VWALL | `\|` |
| 2 | HWALL | `-` |
| 3-12 | corners/T-walls | various |
| 14 | SDOOR | secret door |
| 15 | SCORR | secret corridor |
| 23 | DOOR | `+` or `.` |
| 24 | CORR | `#` |
| 25 | ROOM | `.` |
| 26 | STAIRS | `<` or `>` |

The grid is row-major: `typGrid[y][x]` for row `y`, column `x`.

## Multi-Level Sessions

A session can span multiple dungeon levels. When a step causes a level
change (descending stairs, level teleport), that step includes a `typGrid`
field with the new level's terrain. The `depth` field on each step tracks
the current dungeon level.

```jsonc
{
  "steps": [
    // ... moves on depth 1 ...
    {
      "key": ">",
      "action": "descend",
      "turn": 15,
      "depth": 2,
      "typGrid": [[0, 0, "..."], "..."],  // depth 2 terrain
      "rng": ["..."],
      "screen": ["..."]
    },
    // ... moves on depth 2 ...
    {
      "key": ">",
      "action": "descend",
      "turn": 30,
      "depth": 3,
      "typGrid": [[0, 0, "..."], "..."],  // depth 3 terrain
      "rng": ["..."],
      "screen": ["..."]
    }
  ]
}
```

## Terrain Changes Within a Level

Digging, kicking doors open, creating pits, and other actions can modify
`levl[x][y].typ` without changing levels. When the capture harness detects
that the terrain grid has changed since the last capture, it includes a
`typGrid` on that step.

The harness runs `#dumpmap` after every step and compares to the previous
grid. If any cell differs, the new grid is included. This catches:
- Digging through walls/floors
- Kicking doors open (DOOR flags change)
- Drawbridge destruction
- Pit creation
- Any other terrain modification

This means `typGrid` can appear on any step, not just level-change steps.
Steps without terrain changes omit the field to keep the file compact.

## Generating Session Files

### From existing trace data

```bash
node test/comparison/gen_session.js
```

Converts the scattered trace files in `traces/seed42_reference/` into
`sessions/seed42.session.json`.

### From the C binary (two-step workflow)

Generating a session requires two tools:

1. **`plan_session.py`** — Adaptively discovers the move sequence
2. **`run_session.py`** — Captures the full session with per-step data

#### Step 1: Discover the move sequence

```bash
python3 test/comparison/c-harness/plan_session.py <seed>
```

This script discovers the key sequence to navigate from the upstairs to
the downstairs on Dlvl:1. It works **adaptively**:

1. Launches the C binary and captures the terrain grid via `#dumpmap`
2. Finds the player (`@` on screen) and the downstairs (typ=26 in the grid)
3. Runs BFS to plan a cardinal-only shortest path
4. Sends one move at a time, re-planning after each step
5. Handles obstacles automatically:
   - **Monster encounters**: detects when the player is stuck (didn't move),
     keeps sending the same directional key to attack until the monster dies
   - **Locked doors**: detects stuck state, re-reads the terrain grid after
     the door opens, and continues pathfinding
   - **Wizard mode death**: answers `Die? [yn]` with 'n' to resurrect

The output is the complete key sequence plus a ready-to-run `run_session.py`
command:

```
Reached downstairs at (51,12) after 65 moves!
Descended to Dlvl:2

============================================================
Move sequence (66 keys):
  hhhhhhhhhhhhhhjhhkkhhhhjjhhhhhhhhhhhjjjhhjhhhjhhjhhjjllllllllllll>

To capture this session:
  python3 test/comparison/c-harness/run_session.py 1 \
      test/comparison/sessions/seed1.session.json \
      'hhhhhhhhhhhhhhjhhkkhhhhjjhhhhhhhhhhhjjjhhjhhhjhhjhhjjllllllllllll>'
```

#### Step 2: Capture the session

```bash
python3 test/comparison/c-harness/run_session.py <seed> <output_json> '<move_sequence>'
```

This script replays the discovered sequence and captures full ground-truth
data at each step:

1. Launches the C binary in a tmux session with `NETHACK_SEED=<seed>`
2. Navigates startup prompts (character selection, tutorial, --More--)
3. Captures the startup state (screen + typGrid via `#dumpmap`)
4. Sends each move key one at a time, capturing after each:
   - Screen state (24 lines via `tmux capture-pane`)
   - RNG delta (from the `NETHACK_RNGLOG` file)
   - Terrain grid (via `#dumpmap`; included only if changed)
5. Handles `--More--` prompts and wizard-mode `Die?` prompts automatically
6. Quits the game and writes the session JSON

**Prerequisites:** The C binary must be built first (`bash test/comparison/c-harness/setup.sh`).
Requires `tmux` and `python3`.

**Move encoding:**
- `h/j/k/l` — cardinal movement (west/south/north/east)
- `y/u/b/n` — diagonal movement (NW/NE/SW/SE)
- `.` — wait, `s` — search, `,` — pickup, `i` — inventory
- `:` — look (no turn consumed), `@` — toggle autopickup
- `>` — descend stairs, `<` — ascend stairs
- `F<dir>` — fight in direction (e.g., `Fh` = fight west)

**Timing:** Each step takes ~2-3 seconds (dominated by `#dumpmap`). A 67-step
session takes about 3-4 minutes to capture.

### Why the two-step workflow?

Pre-planning a move sequence by hand is error-prone because obstacles like
monster encounters and locked doors consume move keys without advancing the
player. A 56-step BFS path might need 67 actual keys due to:

- **Monster encounters**: Moving into a monster attacks instead of moving.
  Multiple attacks may be needed to kill it. With seed 1, a fox encounter
  takes 6 combat rounds (4 misses, death/resurrection, kill) plus 1 step
  to the corpse = 7 extra keys.

- **Locked doors**: "The door resists!" consumes a turn without moving.
  Seed 1's door at grid (55,4) takes 3 kicks (2 resists + 1 opens) plus
  1 move to step through = 3 extra keys.

- **Wizard mode death**: `Die? [yn]` prompts are handled by both tools.
  `plan_session.py` injects 'n' between moves. `run_session.py` injects
  'n' during its `--More--` clearing loop.

The adaptive planner discovers these obstacles by checking the player's
screen position after each key, making the process reliable regardless of
what monsters or locked doors a given seed produces.

### Path planning details

**Cardinal-only movement.** The planner uses only `h/j/k/l` (no diagonals)
because diagonal moves in NetHack are blocked when both orthogonal adjacent
tiles are walls. Cardinal paths are always reliable.

**Screen-to-grid coordinate mapping.** The tmux capture has a 1-column
offset from the game's internal grid:
- `grid_col = screen_col + 1`
- `grid_row = screen_row - 1` (screen row 0 is the message line)

**Terrain walkability.** BFS considers these typ codes walkable:
DOOR (23), CORR (24), ROOM (25), STAIRS (26), LADDER (27), FOUNTAIN (28).

**Stuck detection.** If the player's screen position doesn't change after
a move, the planner increments a stuck counter. After 2 stuck moves, it
re-reads the terrain grid (a kicked door changes DOOR flags). After 10
stuck moves, it aborts.

## Using Session Files in Tests

Tests load a session file and replay it in JS:

```javascript
import { readFileSync } from 'fs';

const session = JSON.parse(readFileSync('sessions/seed42.session.json'));

// Verify startup
const game = setupGame(session.seed, session.character);
assert.equal(getRngCount(), session.startup.rngCalls);
compareTypGrid(game.map, session.startup.typGrid);
compareScreen(renderScreen(game), session.startup.screen);

// Replay each step
for (const step of session.steps) {
    applyAction(game, step.key);
    compareRng(getRngLog(), step.rng);
    compareScreen(renderScreen(game), step.screen);
    if (step.typGrid) {
        compareTypGrid(game.map, step.typGrid);
    }
}
```

## Design Rationale

**Why one file per session, not per seed+depth?**
A session captures a continuous play sequence. Multi-level play is a single
RNG stream — splitting it would lose the continuity that makes the test
meaningful.

**Why keep DEC graphics instead of converting to Unicode?**
The session file stores raw C output. Keeping DEC encoding means no lossy
transformation during capture. The conversion to Unicode is a well-defined,
reversible mapping applied at test time.

**Why compact strings for RNG instead of structured objects?**
`"rn2(12)=2 @ mon.c:1145"` is more readable than
`{"fn":"rn2","arg":12,"result":2,"src":"mon.c:1145"}` and produces smaller
files. The string format is trivially parseable with a regex, and the
source location is optional — tests that only check call signatures can
ignore the `@ ...` suffix.

**Why is `startup.rng` optional?**
Startup RNG data adds 2000-3000 entries to the JSON, roughly doubling file
size. It's invaluable during active development (debugging why JS `makelevel`
diverges from C) but not needed for routine regression testing where only the
total `rngCalls` count is checked. Making it optional keeps old session files
valid and lets future sessions include or omit it based on need.

**Why include both screen and typGrid?**
They test different things. The screen tests rendering, FOV, object display,
and status lines. The typGrid tests terrain generation. A screen match
doesn't guarantee correct terrain (FOV hides most of the map), and a
typGrid match doesn't guarantee correct rendering.

---

*"You finish reading the scroll. It crumbles to dust."*
