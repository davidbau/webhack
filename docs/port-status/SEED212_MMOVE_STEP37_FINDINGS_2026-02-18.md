# Seed212 m_move Step-37 Findings (2026-02-18)

This note records the current blocker for
`seed212_valkyrie_wizard.session.json` after the wall-mode and color
checkpoints.

## Current First Divergence

- RNG divergence remains at gameplay `step 37`, RNG index `8`:
  - JS: `rn2(20)=13 @ m_move(...)`
  - C: `rn2(32)=25 @ m_move(monmove.c:1966)`

## Verified C Semantics (source check)

Checked against local C source (`/tmp/nethack-verify-009/src/mon.c` and
`/tmp/nethack-verify-009/include/rm.h`):

- `IS_OBSTRUCTED(typ)` is `typ < POOL`.
- `IS_DOOR(typ)` is `typ == DOOR` (secret doors are not `IS_DOOR`).
- `mfndpos()` skips obstructed terrain unless passwall/dig permissions apply.
- `m_move()` uses `rn2(4 * (cnt - j))` for mtrack backtrack checks.

This confirms the `rn2(32)` denominator reflects a real C `mfndpos` count
of `8`, not a logging artifact.

## JS Trace At The Divergence

Instrumented JS `m_move` at replay step 37 shows:

- `jackal @ (47,5)` with `cnt=3` then `rn2(12)` (matches C sequence shape)
- `goblin @ (32,14)` with `cnt=5` then `rn2(20)` (divergent denominator)

The goblin candidate list in JS is five room tiles; the three excluded
adjacent tiles are blocked wall/secret-door terrain.

## Interpretation

The blocker is still an upstream hidden-state mismatch before this call
(monster position/type and/or local terrain evolution), not just the
`rn2(4*cnt)` formula itself.

## New Root-Cause Narrowing

Using C wizard `#dumpsnap` checkpoints captured at replayed gameplay steps:

- Step 9: C and JS monster positions match.
- Step 10: first hidden-state drift appears:
  - C goblin: `(32,13)`
  - JS goblin: `(32,14)`
  - jackal and pet positions still match.

This means the step-37 RNG mismatch is downstream of an earlier deterministic
movement-choice difference introduced at step 10 (no RNG divergence yet).

Added helper script to capture these C checkpoints directly from session
replays:

- `test/comparison/c-harness/capture_step_snapshot.py`

## Additional Fix Landed During This Pass

- Corrected a typo in `dog_move` candidate filtering:
  - `allowMdisp` -> `allowMDisp`
  - File: `js/monmove.js`

This is a correctness fix for displacement-aware occupancy checks in pet
path evaluation.
