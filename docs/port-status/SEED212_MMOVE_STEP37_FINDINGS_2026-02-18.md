# Seed212 m_move Step-37 Findings (2026-02-18)

This note records the current blocker for
`seed212_valkyrie_wizard.session.json` after the wall-mode and color
checkpoints.

## Current First Divergence

This note began as a step-37 `m_move` denominator mismatch investigation.
After the landed fixes below, that blocker is cleared. Current state:

- first screen divergence now appears later at gameplay `step 121`
  (post-turn glyph placement mismatch)
- first RNG divergence now appears at gameplay `step 90`, RNG index `20`:
  - JS: `rn2(24)=23 @ m_move(...)`
  - C: `rn2(5)=3 @ distfleeck(monmove.c:539)`

Compared with the pre-fix state (first RNG divergence at step 37),
this is a substantial forward shift in matched replay prefix.

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

## Latest Refinement (same day)

Implemented a minimal `m_search_items` targeting subset in JS `m_move`
for collector monsters (C-style loot-interest retargeting, no extra RNG).

Observed effect:

- C/JS monster positions now align at the previously problematic checkpoints:
  - step 36: `jackal (47,5)`, `goblin (32,13)`, `dog (75,17)`
  - step 37: `jackal (47,4)`, `goblin (33,13)`, `dog (77,16)`
- first RNG divergence moved from step 37 denominator mismatch
  (`rn2(20)` vs `rn2(32)`) to a later step-38 mismatch involving an
  extra C `distfleeck` call during runmode-delay output handling.

This confirms the step-10 goblin drift was one real upstream contributor.

## Follow-on Replay Control Refinement (same day)

Two replay/input semantics fixes were added after the movement-target patch:

- `replay_core`: keep `cmdKey` aligned to the actual executed command key
  each step (matching moveloop repeat bookkeeping).
- `commands`: refine `Enter` (`\\n`/`\\r`) keypad-down handling so pet-
  displacement flows can continue in run-style movement, while defaulting
  to single-step movement outside that context.

Observed effect on `seed212_valkyrie_wizard`:

- RNG matched calls improved from `2305/11044` to `2475/10886`
- first RNG divergence moved from step 38 to step 90
- first screen divergence moved from step 38 to step 80

## Inventory Action-Menu Refinement (same day)

The step-80 screen drift was traced to inventory action-menu content for
oil lamps:

- missing `a - Light this light source`
- missing `R - Rub this oil lamp`
- stale right-side row tails due action rows not being cleared before redraw

Fixes landed in `js/commands.js`:

- add light-source and rub actions for lamp menu variants
- clear each action row before writing menu lines

Observed effect on `seed212_valkyrie_wizard`:

- screen matched frames improved `148/407` -> `150/407`
- first screen divergence moved from step 80 to step 121
- first RNG divergence remains step 90 (`rn2(24)` vs C `distfleeck rn2(5)`)

## Additional Fix Landed During This Pass

- Corrected a typo in `dog_move` candidate filtering:
  - `allowMdisp` -> `allowMDisp`
  - File: `js/monmove.js`

This is a correctness fix for displacement-aware occupancy checks in pet
path evaluation.
