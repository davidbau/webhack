# Seed5 Parity Progress Notes (2026-02-14)

This checkpoint records C-faithful replay improvements made while advancing
strict no-screen RNG parity for:

- `test/comparison/sessions/seed5_gnomish_mines_gameplay.session.json`

## What Improved

- Strict no-screen seed5 frontier advanced from early-session divergence
  (step ~152) to a later divergence at step `654`.
- Replay remained stable for seed1..seed5 replay unit tests.

## C-Faithful Logic Ported

- `kick` behavior refinements in `js/commands.js`:
  - `kick_dumb`-style empty-space kick path with proper message and RNG.
  - `kick_ouch`-style hard terrain path with exercise/wounded-legs/damage RNG.
- `read` command (`r`) added as a blocking prompt flow (`What do you want to read? [*]`)
  to keep step alignment with C trace interaction.
- `#name` extended command flow added (minimal prompt-compatible behavior):
  - `What do you want to name?`
  - dungeon-level naming prompt path.
- `drop` prompt behavior made persistent (C-like):
  - `What do you want to drop? [*]` remains active across non-selection keys.
- `search` RNG corrected:
  - `dosearch0` now uses `rnl(7)` rather than `rn2(7)`.

## Replay Harness Fixes

- Extended-command shorthand auto-Enter injection fixed to run only once,
  preventing accidental premature close of nested prompts.
- Tutorial replay state adjusted to remove carried comestibles when entering
  tutorial branch, matching observed C tutorial-state behavior in traces.

## Additional Progress (later in same day)

- Added C-faithful tutorial key resolution in `js/levels/tut-1.js`:
  - fixed `tut_key()` return path and Ctrl/Alt regex handling.
  - restored tutorial key text output (instead of `undefined`) and
    enabled `tut_key_help()` engraving placement when Ctrl keys are used.
- Added C-faithful command/prompt behavior in `js/commands.js`:
  - `r` (read) blocking prompt flow.
  - `#name` prompt flow for dungeon-level naming path.
  - persistent drop prompt (`What do you want to drop? [*]`).
  - Enter key handling aligned to replayed tty behavior (`j`/south movement).
  - `dosearch0` uses `rnl(7)` and now applies successful-search exercise RNG.

## Current Frontier

- First strict no-screen mismatch now appears at:
  - step `719` (`move-ne`)
  - C has no RNG on this step, JS still consumes movement-turn RNG.

This is a further improvement from the earlier step-654 frontier and points to
remaining state divergence in later tutorial movement flow.

## Fixture Generation Update (2026-02-14, later)

- `test/comparison/c-harness/keylog_to_session.py` now supports
  `--startup-mode auto|ready|from-keylog`.
- `auto` detects manual keylogs containing startup keys (`in_moveloop=0`) and
  replays startup from the keylog instead of auto-advancing startup prompts.
- Seed5 fixture was regenerated from raw keylog with this mode, removing
  incorrect `Tutorial:` status labeling in the generated session screen rows.
- Resulting fixture is more faithful to capture setup, even though current JS
  strict no-screen parity frontier is now earlier (`step 59`) and needs further
  C-faithful gameplay logic porting from that new baseline.

## Replay Alignment Progress (2026-02-15)

- Seed replay baseline is green for:
  - `test/unit/seed1_gameplay_replay.test.js`
  - `test/unit/seed2_gameplay_replay.test.js`
  - `test/unit/seed3_gameplay_replay.test.js`
  - `test/unit/seed4_gameplay_replay.test.js`
  - `test/unit/seed5_gameplay_replay.test.js`
- Strict seed5 replay alignment advanced from step `234` to step `245`
  before first RNG divergence.

### What Changed

- Added sparse-capture replay handling in `test/comparison/session_helpers.js`
  for keylog sessions that defer movement-turn RNG to a following
  acknowledgement key (`space`), including:
  - deferred movement execution,
  - turn-RNG attribution to the captured step,
  - top-line message row cleanup for blank captured rows.
- Updated headless map rendering memory behavior to keep `mem_obj` synchronized
  under visible monsters, matching C-like remembered-glyph behavior.
- Added runtime display parity for the same remembered-object-under-monster case
  in `js/display.js`.

### Learned

- Seed5 keylog-derived sessions include sparse capture patterns that are not
  one-command/one-capture. Replay must model these patterns explicitly instead
  of assuming per-key complete capture.
- The remaining frontier mismatch sits in `dog_move` candidate evaluation order
  and per-candidate side effects (`dogfood`/`obj_resists` path), making
  `dogmove.c` a high-value next C-port target for strict parity.

## Latest Progress (2026-02-15, later)

- Strict seed5 no-screen frontier advanced from step `330` to step `357`.
- Replay/unit baseline remains green:
  - `test/unit/seed1_gameplay_replay.test.js`
  - `test/unit/seed2_gameplay_replay.test.js`
  - `test/unit/seed3_gameplay_replay.test.js`
  - `test/unit/seed4_gameplay_replay.test.js`
  - `test/unit/seed5_gameplay_replay.test.js`
  - `test/unit/monmove.test.js`

### C-Faithful Ports Added

- `js/commands.js`:
  - floor-corpse eating path now uses C-like timing (`eatcorpse`-style reqtime)
    and completion (`eatfood`-style `++usedtime > reqtime`),
  - rotten-corpse path shortens meal duration in a C-like way (`consume_oeaten`
    effect),
  - floor object consumption now includes `obj_resists(...,0,0)` before removal
    (C `useupf -> delobj_core` path).

- `js/nethack.js`:
  - real game loop now executes occupation `onFinishAfterTurn` callbacks after
    the final occupation turn (matching replay-harness timing).

- `js/monmove.js`:
  - added C-like `passivemm` RNG gate behavior for pet-vs-monster melee, with
    AD_ACID and AD_ENCH special handling.
  - `find_targ` now checks pet perceived player location via `mux/muy` before
    selecting monsters on a line.

- `test/comparison/session_helpers.js`:
  - added `--More--` boundary normalization so trailing RNG from a split C
    capture can be attributed to the following acknowledgement step when prefix
    alignment proves the split.

### Current First Strict Mismatch

- step `357` (`move-east`):
  - JS: `rnd(5)=3` (`score_targ` fuzz factor)
  - C: `rn2(5)=2 @ distfleeck(monmove.c:539)`

This pinpoints remaining drift to pet ranged-target eligibility in `dogmove.c`
paths (`best_target/find_targ/score_targ`) rather than earlier eating or
occupation timing.
