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

## Current Frontier

- First strict no-screen mismatch currently appears at:
  - step `654` (`move-south`)
  - C begins with `rnd(5)=5 @ maybe_smudge_engr(...)`
  - JS begins with turn-end monster movement RNG (`rn2(12)=...`)

This indicates a remaining movement/engraving alignment issue on tutorial map
state near this point, with prompt flow and earlier command semantics now much
closer to C behavior.

