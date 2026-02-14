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
