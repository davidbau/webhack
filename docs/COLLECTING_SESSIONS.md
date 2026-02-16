# Collecting C Sessions

> *"You enter the C harness laboratory.  Instruments hum and tmux sessions
> flicker on ancient terminals."*

## Overview

The C harness (`test/comparison/c-harness/`) drives a patched C NetHack binary
through tmux to capture deterministic session data — terrain grids, RNG traces,
and screen states — which the JS test suite compares against for fidelity.

**Prerequisites:** gcc, make, bison, flex, ncurses, tmux, Python 3.

## One-Time Setup

```bash
bash test/comparison/c-harness/setup.sh
```

This clones the NetHack C repo at a pinned commit, applies 5 patches
(deterministic seed, map dumper, RNG logging, object dumper, mid-level tracing),
and installs the binary to `nethack-c/install/games/lib/nethackdir/nethack`.

The patches add these environment variables to the C binary:

| Variable | Purpose |
|----------|---------|
| `NETHACK_SEED=N` | Fixed PRNG seed (no re-seeding between levels) |
| `NETHACK_RNGLOG=path` | Log every `rn2`/`rnd`/`rn1`/`d()` call with source location |
| `NETHACK_DUMPMAP=path` | Write 21×80 terrain type grid on `#dumpmap` command |
| `NETHACK_DUMPOBJ=path` | Write object list on `#dumpobj` (debugging) |

## Configuration

All seeds and move sequences live in `test/comparison/seeds.json`:

```jsonc
{
  "session_seeds": {
    "sessions": [
      {"seed": 42, "moves": ":hhlhhhh.hhs"},
      {"seed": 1,  "moves": ":hhhh...>.....", "label": "optional_suffix"}
    ]
  }
}
```

The `moves` string encodes keystrokes (see [Move Encoding](#move-encoding)).
An optional `label` adds a suffix to the filename (`seed1_items.session.json`).

## Collecting Gameplay Sessions

### Regenerate all sessions from config

```bash
python3 test/comparison/c-harness/run_session.py --from-config
```

This reads `seeds.json` and regenerates every session in
`test/comparison/sessions/`.

### Collect a single session

```bash
python3 test/comparison/c-harness/run_session.py <seed> <output.json> '<moves>'
```

Example:

```bash
python3 test/comparison/c-harness/run_session.py 1 \
  test/comparison/sessions/seed1.session.json \
  ':hhhhhhhhhhhhhhjhhkkhhhhjjhhhhhhhhhhhjjjhhjhhhjhhjhhjjllllllllllll>.....'
```

Each step captures: screen state (24 lines), RNG delta, terrain grid (if
changed), turn number, and depth.

### Typical workflow: extending a session

1. Edit `seeds.json` — append moves to the sequence (e.g., add `.....`
   for 5 wait turns after a `>` descent).
2. Run `run_session.py --from-config` (or the single-seed command).
3. Run `npm run test:session` to see results.

## Planning Move Sequences

Use `plan_session.py` to auto-discover a path from upstairs to downstairs:

```bash
python3 test/comparison/c-harness/plan_session.py <seed> [--max-moves N]
```

This uses BFS pathfinding on the actual C game screen. It handles monsters
(keeps attacking until dead), locked doors (waits for open), and wizard-mode
death (auto-resurrects). Output is a key sequence ready to paste into
`seeds.json`.

## Collecting Map-Only Sessions

Map sessions capture terrain grids at multiple depths without gameplay:

```bash
# With RNG traces (for debugging):
python3 test/comparison/c-harness/gen_map_sessions.py --from-config

# Golden grids only (no RNG, depths 1-20):
python3 test/comparison/c-harness/gen_map_sessions.py --c-golden

# Single seed:
python3 test/comparison/c-harness/gen_map_sessions.py <seed> [max_depth] [--with-rng]
```

Output goes to `test/comparison/maps/`.

## Collecting Character Generation Sessions

```bash
python3 test/comparison/c-harness/gen_chargen_sessions.py --from-config
```

Captures the full character creation RNG sequence for each role/race/gender/
alignment combination defined in `seeds.json`.

## Move Encoding

| Key | Action | Takes turn? |
|-----|--------|-------------|
| `h` `j` `k` `l` | Cardinal movement (vi keys) | Yes |
| `y` `u` `b` `n` | Diagonal movement | Yes |
| `.` | Wait | Yes |
| `s` | Search | Yes |
| `,` | Pickup | Yes |
| `>` `<` | Descend / Ascend stairs | Yes |
| `F`+dir | Fight in direction (e.g., `Fj`) | Yes |
| `e`+item | Eat item (e.g., `eb`) | Yes |
| `w`+item | Wield item | Yes |
| `W`+item | Wear item | Yes |
| `T`+item | Takeoff item | Yes |
| `q`+item | Quaff item | Yes |
| `d`+item | Drop item | Yes |
| `r`+item | Read item | Yes |
| `z`+item | Zap item | Yes |
| `a`+item | Apply item | Yes |
| `P`+item | Put on item | Yes |
| `R`+item | Remove item | Yes |
| `:` | Look | No |
| `i` | Inventory | No |
| `@` | Autopickup toggle | No |

## Other Tools

| Script | Purpose |
|--------|---------|
| `run_dumpmap.py` | Quick terrain grid capture at a specific depth |
| `run_trace.py` | Legacy per-move trace to individual files |
| `capture_inventory.py` | Capture object/inventory state |

## Debugging Tips

- The C binary runs inside tmux. If a collection hangs, check for stale
  sessions: `tmux ls` and `tmux kill-session -t <name>`.
- RNG log lines look like: `2808 rn2(12) = 2 @ mon.c:1145`.
  The session tools strip the index and compact the format.
- Mid-level trace entries (`>funcname` / `<funcname`) come from the
  `005-midlog-infrastructure.patch` and are preserved in session RNG arrays.
- Set `NETHACK_SEED` yourself to run the C binary interactively for manual
  investigation.
