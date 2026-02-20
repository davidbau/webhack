# Session Format (v3)

> *"You carefully read the scroll. It describes a unified session format."*

**See also:**
[PARITY_TEST_MATRIX.md](PARITY_TEST_MATRIX.md) (test reference) |
[COLLECTING_SESSIONS.md](COLLECTING_SESSIONS.md) (session collection) |
[TESTING.md](TESTING.md) (testing infrastructure)

## Overview

A **session file** is a JSON document that captures reference data from C NetHack
for verifying the JS port. All sessions use a unified format with:

1. **Options** - settings needed to reproduce the session
2. **Startup** - initial game state with full RNG log
3. **Steps** - sequence of keystrokes with per-step RNG and state changes
4. **Checkpoints** - full state snapshots at key moments during level generation

This format supports all session types: gameplay, chargen, map exploration,
and special level generation. Every keystroke is logged with its RNG calls,
enabling precise debugging when JS diverges from C.

## File Location

All sessions live in `test/comparison/sessions/`.

Naming convention: `seed<N>_<description>.session.json`

Examples:
- `seed42_gameplay.session.json`
- `seed1_chargen_valkyrie.session.json`
- `seed100_castle.session.json`

## Top-Level Structure

```json
{
  "version": 3,
  "seed": 42,
  "source": "c",
  "regen": { "mode": "gameplay", "moves": ":h." },
  "options": { ... },
  "steps": [ ... ]
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | Schema version (3) |
| `seed` | number | PRNG seed for ISAAC64 |
| `source` | string | `"c"` for C-generated sessions |
| `regen` | object | Parameters to regenerate this session |
| `options` | object | Settings to reproduce session |
| `steps` | array | Sequence of actions with RNG (first step is startup) |

### Regen Object

The `regen` object contains mode-specific parameters for regenerating the session:

```json
// Gameplay session
{ "mode": "gameplay", "moves": ":hhlh." }

// Wizload session (special level)
{ "mode": "wizload", "level": "castle" }

// Character generation
{ "mode": "chargen", "selections": "vhfn" }

// Interface capture
{ "mode": "interface", "keys": "O><q" }

// Option test
{ "mode": "option_test", "option": "verbose", "value": true }
```

## Options Object

The `options` object contains all settings needed to reproduce the session:

```json
{
  "options": {
    "name": "Wizard",
    "role": "Valkyrie",
    "race": "human",
    "gender": "female",
    "align": "neutral",
    "wizard": true,
    "symset": "DECgraphics",
    "autopickup": false,
    "pickup_types": ""
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Player name |
| `role` | string | Role (Valkyrie, Wizard, etc.) |
| `race` | string | Race (human, elf, dwarf, gnome, orc) |
| `gender` | string | `"male"` or `"female"` |
| `align` | string | `"lawful"`, `"neutral"`, or `"chaotic"` |
| `wizard` | boolean | Wizard mode enabled |
| `symset` | string | Symbol set (`"DECgraphics"`) |
| `autopickup` | boolean | Autopickup enabled |
| `pickup_types` | string | Pickup filter string |

## Startup Step

Startup is the **first step** in the `steps` array with `key: null`. This
captures the game state after initialization, before any player commands:

```json
{
  "steps": [
    {
      "key": null,
      "action": "startup",
      "rng": [
        "rn2(2)=1 @ o_init.c:88",
        "rn2(2)=0 @ o_init.c:91",
        ">shuffle",
        "rn2(4)=0 @ o_init.c:94",
        "<shuffle",
        ...
      ],
      "screen": "\u001b[0m\n\u001b[32Clqqqqqqk\u001b[0m\n...",
      "typGrid": "||2:0,3,3:2,9|..."
    },
    { "key": "h", "action": "move-west", ... },
    ...
  ]
}
```

The startup step contains:

| Field | Type | Description |
|-------|------|-------------|
| `key` | null | Always null for startup |
| `action` | string | Always `"startup"` |
| `rng` | string[] | Full RNG log with midlog markers |
| `screen` | string | ANSI-compressed terminal screen (v3 canonical) |
| `typGrid` | string | RLE-encoded terrain grid (gameplay mode) |
| `checkpoints` | array | State snapshots (wizload mode) |

## Steps Array

Each step represents an action and its effects. The first step has `key: null`
and is the startup step. Subsequent steps have string keys:

```json
{
  "steps": [
    {
      "key": null,
      "action": "startup",
      "rng": [...14000 calls...],
      "screen": "...",
      "typGrid": "..."
    },
    {
      "key": ":",
      "action": "look",
      "rng": []
    },
    {
      "key": "h",
      "action": "move-west",
      "rng": [
        "rn2(12)=2 @ mon.c:1145",
        ">movemon",
        "rn2(12)=9 @ mon.c:1145",
        "<movemon",
        "rn2(70)=52 @ allmain.c:234"
      ],
      "screen": "..."
    },
    {
      "key": ">",
      "action": "descend",
      "rng": [...],
      "typGrid": "...",
      "checkpoints": [...]
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string\|null | yes | Key sent to NetHack (null for startup) |
| `action` | string | yes | **Unreliable heuristic label** — assigned by `describe_key()` from the key character alone, with no knowledge of actual game state. Do not use for debugging or replay logic (see below). |
| `rng` | string[] | yes | RNG calls during this step (may be empty) |
| `screen` | string | no | ANSI-compressed screen after this step (v3 canonical) |
| `typGrid` | string | no | RLE terrain grid (on level changes) |
| `checkpoints` | array | no | State snapshots (during level generation) |

> **Warning: `action` labels are unreliable.** The `action` field is generated
> by `describe_key()` in `run_session.py` purely from the key character — `'n'`
> always becomes `"move-se"` even if it's a throw direction, spell direction, or
> text input like "no". Labels are frequently wrong and **must not be used** for
> debugging or replay decisions. See [issue #144](https://github.com/davidbau/menace/issues/144)
> for planned removal.

### Screen Semantics (Important)

- In v3, `screen` is the primary terminal capture and includes ANSI/control data.
- Plain text screen comparison is derived by stripping ANSI/control sequences.
- `screenAnsi` is deprecated for v3 and should be removed from new captures.
  The canonical v3 field is `screen`.
- DECgraphics normalization is applied via SO/SI (`\x0e`/`\x0f`) state with
  a standard DEC-special-graphics to Unicode correspondence before glyph/color
  comparisons.
  Example correspondences: `a -> U+2592` (checkerboard/open door),
  `~ -> U+00B7` (middle dot), `lqkxmjntuvw -> box-drawing`.

**Note:** Turn count is not tracked per-step since a single keystroke can
consume multiple game turns (e.g., running, resting). The RNG delta accurately
captures what happened; turn info can be read from the status line if needed.

## RNG Log Format

Each RNG entry is a string:

```
fn(args)=result @ source:line
```

Examples:
```
rn2(12)=2 @ mon.c:1145
rnd(8)=5 @ makemon.c:320
d(2,6)=7 @ weapon.c:45
```

### Midlog Markers

Function entry/exit markers are interleaved with RNG calls to provide context:

```
>makemon
rn2(5)=3 @ makemon.c:100
>mksobj
rn2(10)=7 @ mkobj.c:150
<mksobj
rn2(3)=1 @ makemon.c:200
<makemon
```

- `>funcname` - entering function
- `<funcname` - exiting function

These help identify which code path generated each RNG call.

### Event Entries

Event entries use `^` prefix with compact bracket notation, interleaved with RNG
calls to record game-state changes for C-vs-JS divergence diagnosis:

```
^place[otyp,x,y]          — object placed on floor
^remove[otyp,x,y]         — object removed from floor
^pickup[mndx@x,y,otyp]    — monster picks up object
^drop[mndx@x,y,otyp]      — monster drops object
^eat[mndx@x,y,otyp]       — pet eats object
^die[mndx@x,y]            — monster dies
^corpse[mndx,x,y]         — corpse created
^engr[type,x,y]           — engraving created
^dengr[x,y]               — engraving deleted
^wipe[x,y]                — engraving wiped (erosion attempted)
^trap[type,x,y]           — trap created
^dtrap[type,x,y]          — trap deleted
```

Example from a gameplay step:
```
>dog_move @ monmove.c:912
rn2(12)=3 @ dogmove.c:587
^eat[38@15,7,472]
rn2(100)=42 @ dogmove.c:300
<dog_move=1 #3017-3021 @ monmove.c:912
```

Event entries are treated as midlog entries by the RNG comparator (filtered out
of RNG matching) but are compared separately via `compareEvents()` in
`comparators.js`. Tools that don't understand events simply ignore them.

#### Identifier References

| Field | Meaning | C source | JS equivalent |
|-------|---------|----------|---------------|
| `otyp` | Object type index | `otmp->otyp` | `obj.otyp` |
| `mndx` | Monster type index | `monsndx(mtmp->data)` | `mon.mndx` |
| `x,y` | Map coordinates | `otmp->ox,otmp->oy` or `mtmp->mx,mtmp->my` | same |
| `type` (engr) | Engraving type | `ep->engr_type` (1=DUST..6=HEADSTONE) | mapped from string via `engrTypeNum()` |
| `type` (trap) | Trap type index | `trap->ttyp` | `trap.ttyp` |

#### C Instrumentation

C patch: `test/comparison/c-harness/patches/012-event-logging.patch`

The `event_log()` helper in `src/rnd.c` writes to the same `rng_logfile` used by
the RNG logging infrastructure. Instrumented functions:

| C File | Function | Event |
|--------|----------|-------|
| `src/mkobj.c` | `place_object()` | `^place` |
| `src/mkobj.c` | `obj_extract_self()` | `^remove` |
| `src/mkobj.c` | `mkcorpstat()` | `^corpse` |
| `src/steal.c` | `mpickobj()` | `^pickup` |
| `src/steal.c` | `mdrop_obj()` | `^drop` |
| `src/dogmove.c` | `dog_eat()` | `^eat` |
| `src/mon.c` | `mondead()` | `^die` |
| `src/engrave.c` | `make_engr_at()` | `^engr` |
| `src/engrave.c` | `del_engr()` | `^dengr` |
| `src/engrave.c` | `wipe_engr_at()` | `^wipe` |
| `src/trap.c` | `maketrap()` | `^trap` |
| `src/trap.c` | `deltrap()` | `^dtrap` |

#### JS Instrumentation

Uses `pushRngLogEntry()` from `js/rng.js`. Instrumented functions:

| JS File | Function | Event |
|---------|----------|-------|
| `js/floor_objects.js` | `placeFloorObject()` | `^place` |
| `js/map.js` | `removeObject()` | `^remove` |
| `js/mkobj.js` | `mkcorpstat()` | `^corpse` |
| `js/dogmove.js` | `dog_eat()` | `^eat` |
| `js/dogmove.js` | `dog_invent()` pickup/drop | `^pickup`, `^drop` |
| `js/uhitm.js` | `handleMonsterKilled()` | `^die` |
| `js/engrave.js` | `make_engr_at()`, `del_engr()` | `^engr`, `^dengr` |
| `js/engrave.js` | `logWipeEvent()` | `^wipe` |
| `js/dungeon.js` | `mktrap()`, `deltrap()` | `^trap`, `^dtrap` |

**JS coverage gap:** ~25 direct `map.objects.push(obj)` calls bypass
`placeFloorObject()` and emit no `^place` event. Tracked in
[issue #150](https://github.com/davidbau/menace/issues/150).

### Traced Functions

The C harness instruments these key functions:

| Function | Purpose |
|----------|---------|
| `makemon` | Monster creation |
| `mksobj` | Object creation |
| `create_room` | Room creation in special levels |
| `wallify_map` | Wall type assignment |
| `mktrap` | Trap creation |
| `somexy` | Random coordinate in room |
| `somexyspace` | Random empty coordinate |
| `rndmonnum` | Random monster selection |
| `dochug` | Monster AI decision |
| `m_move` | Monster movement |
| `dog_move` | Pet movement |
| `mattacku` | Monster attacks player |
| `mfndpos` | Find monster positions |

## Checkpoints

Checkpoints are full state snapshots at key moments during level generation.
They always include complete state (no "unchanged" optimization):

```json
{
  "checkpoints": [
    {
      "phase": "after_level_init",
      "rngCallCount": 2810,
      "typGrid": [[...]],
      "flagGrid": [[...]],
      "monsters": [...],
      "objects": [...],
      "rooms": [...]
    },
    {
      "phase": "after_wallification",
      "rngCallCount": 2850,
      "typGrid": [[...]],
      "flagGrid": [[...]],
      "monsters": [...],
      "objects": [...],
      "rooms": [...]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `phase` | string | Generation phase name |
| `rngCallCount` | number | RNG call count at this point |
| `typGrid` | number[][] | 21x80 terrain types |
| `flagGrid` | number[][] | 21x80 tile flags |
| `monsters` | array | Monster positions and types |
| `objects` | array | Object positions and types |
| `rooms` | array | Room structure metadata |

### Checkpoint Phases

Common phases during level generation:
- `after_level_init` - initial level structure
- `after_map` - after map drawing
- `after_wallification` - after wall type assignment
- `after_levregions_fixup` - after stairs/portals placed

## Terrain Type Grid

The `typGrid` captures terrain types matching C's `levl[x][y].typ`.

### Terrain Codes

| Code | Constant | Display |
|------|----------|---------|
| 0 | STONE | (rock) |
| 1 | VWALL | `\|` |
| 2 | HWALL | `-` |
| 3-12 | corners/T-walls | various |
| 14 | SDOOR | secret door |
| 23 | DOOR | `+` |
| 24 | CORR | `#` |
| 25 | ROOM | `.` |
| 26 | STAIRS | `<` or `>` |

### Format Options

**Array format** (deprecated):
```json
"typGrid": [[0, 0, 25, 25, 1, ...], ...]
```
A 21x80 array of integers, row-major: `typGrid[y][x]`. Legacy format, no longer generated.

**RLE format** (current default):
```json
"typGrid": "||2:0,3,3:2,9|2:0,1,3:p,1,9:h,45:p|..."
```
A single string with rows separated by `|`. Each row uses run-length encoding:
- Format: `count:char` for runs, or just `char` for single cells
- `char` is `0-9` for values 0-9, `a-z` for 10-35
- Trailing zeros are omitted (row fills to 80 with 0)
- All-zero rows are empty (just `||`)

Example: `3:0,p,5:p` means "3 STONE, 1 ROOM, 5 ROOM, then zeros to column 80".

### Flag Grid and Wall Info Grid

The `flagGrid` (tile properties like lit, non-diggable) and `wallInfoGrid`
(wall property flags) use the same RLE format:

```json
"flagGrid": "||||||||55:0,1:4,1:0,1:4||56:0,1:4|..."
```

All three grid types use identical encoding. Mostly-zero grids become very
compact since all-zero rows are just `|` separators.

## Screen Format

Screens are captured from the C terminal in **ANSI format** as a single
compressed string with full escape codes for colors and attributes.

### Format

The screen is a single string with lines separated by `\n`. Each line is
compressed:

1. **Trailing spaces stripped** - implicit fill to column 80
2. **Internal space runs compressed** - runs of 5+ spaces use cursor codes

```json
"screen": "\u001b[0m\n\u001b[32Clqqqqqqk\u001b[0m\n\u001b[32Cx\u001b[0m.....\u001b[1;37m@\u001b[32mx\u001b[0m\n..."
```

### Compression Codes

| Code | Meaning |
|------|---------|
| `\e[nC` | Cursor forward n columns (used for runs of 5+ spaces) |

The cursor forward code is only used when it saves bytes:
- 5 spaces (5 bytes) → `\e[5C` (4 bytes) - saves 1 byte
- 10 spaces (10 bytes) → `\e[10C` (5 bytes) - saves 5 bytes
- 4 spaces remains as 4 literal spaces (no savings)

### Decompression for Comparison

The session reader expands cursor codes to a 24x80 grid of cells, where each
cell has:
- Glyph (character)
- Foreground color
- Background color
- Attributes (bold, underline, etc.)

Comparison happens on the expanded grid - compression is transparent.

- Row 0: Message line
- Rows 1-21: Map area (DECgraphics encoding with ANSI colors)
- Rows 22-23: Status lines

### When to Include Screen

Include `screen` on a step when:
- There's a message (row 0 non-empty)
- A menu is displayed
- Level changes
- Combat or interaction occurs

Omit `screen` on simple movement steps with no message - keeps files compact.

### DECgraphics Characters

| Char | Meaning |
|------|---------|
| `l` | Top-left corner |
| `q` | Horizontal wall |
| `k` | Top-right corner |
| `x` | Vertical wall |
| `~` | Room floor |

## Comparison Report Format

When JS is compared against a C session, the result is a JSON report:

```json
{
  "session": "seed42_gameplay.session.json",
  "seed": 42,
  "source": "c",
  "timestamp": "2026-02-15T10:30:00Z",

  "metrics": {
    "rngCalls": { "matched": 15234, "total": 15234 },
    "keys": { "matched": 67, "total": 67 },
    "grids": { "matched": 3, "total": 3 },
    "screens": { "matched": 47, "total": 47 }
  },

  "passed": true
}
```

### Failure Report

When there's a mismatch, include divergence details:

```json
{
  "session": "seed42_castle.session.json",
  "seed": 42,
  "source": "c",
  "timestamp": "2026-02-15T10:31:00Z",

  "metrics": {
    "rngCalls": { "matched": 2807, "total": 2850 },
    "keys": { "matched": 3, "total": 5 },
    "grids": { "matched": 0, "total": 1 },
    "screens": { "matched": 5, "total": 12 }
  },

  "passed": false,

  "firstDivergence": {
    "key": 4,
    "rngCall": 2808,
    "expected": "rn2(10)=7 @ sp_lev.c:450",
    "actual": "rn2(10)=3 @ sp_lev.js:382",
    "cContext": ">wallify_map >set_wall_type",
    "jsContext": ">wallify_map >set_wall_type",
    "phase": "after_wallification"
  },

  "gridDiffs": [
    { "step": 4, "cellsDifferent": 83 }
  ],

  "screenDiffs": [
    { "step": 6, "description": "message line differs" }
  ]
}
```

### Metrics Summary

| Metric | Description |
|--------|-------------|
| `rngCalls` | Individual RNG calls that match |
| `keys` | Keystrokes where all RNG calls match |
| `grids` | typGrids that match cell-for-cell |
| `screens` | Screens that match glyph-for-glyph |

All metrics are `{ matched, total }` pairs for easy ratio calculation.

### Aggregation

Multiple session reports can be aggregated:

```json
{
  "timestamp": "2026-02-15T10:30:00Z",
  "commit": "abc123",
  "sessions": 150,
  "passed": 142,
  "failed": 8,

  "totals": {
    "rngCalls": { "matched": 1523400, "total": 1524000 },
    "keys": { "matched": 4500, "total": 4520 },
    "grids": { "matched": 298, "total": 300 },
    "screens": { "matched": 2100, "total": 2150 }
  },

  "failures": [
    { "session": "seed42_castle.session.json", "firstDivergence": { ... } },
    ...
  ]
}
```

## Design Principles

1. **Unified format** - All session types use the same structure
2. **Full RNG logs** - Every RNG call logged with source location and midlog context
3. **Step-by-step** - Every keystroke captured with its RNG delta
4. **Full checkpoints** - Complete state at each phase (no diff optimization)
5. **Self-documenting** - Options object makes sessions reproducible
6. **Debugging-first** - Format optimized for finding divergences, not file size

## Generating Sessions

```bash
# Gameplay session
python3 test/comparison/c-harness/run_session.py <seed> <output.json> '<keys>'

# Special level session (via teleport/wizloaddes)
python3 test/comparison/c-harness/gen_special_sessions.py <group> --seeds 42

# Regenerate all from config
python3 test/comparison/c-harness/run_session.py --from-config
```

## Deprecated Fields

The following fields are deprecated and should not be used:

- `startup` object - Now the first step with `key: null`
- `turn` in steps - Single keystroke can span multiple turns; use RNG delta
- `rngCalls` count - Redundant with `rng` array length
- `rngFingerprint` - Use full `rng` array instead
- `type` field at top level - Use `regen.mode` instead
- Separate `character` object - Use `options` instead
- `screen` as array of strings - Now a single compressed string

---

*"The scroll crumbles to dust, but its wisdom remains."*
