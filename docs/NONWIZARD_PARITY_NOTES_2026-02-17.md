# Non-Wizard Parity Notes (2026-02-17)

## What was fixed

- `keylog_to_session.py` no longer writes invalid `OPTIONS=symset:ASCII` to `.nethackrc`.
- `keylog_to_session.py` now detects appended keylog files (`seq` reset) and uses the longest monotonic segment.
- `keylog_to_session.py` ready-mode replay now uses only in-moveloop keys and avoids synthetic startup key injection.
- `replay_core.getSessionCharacter()` now supports legacy v1 sessions (`session.character`) instead of only v3 (`session.options`).
- `simulateDungeonInit()`/`initLevelGeneration()` gained wizard-mode-aware behavior:
  - non-wizard dungeon/level chance rolls are consumed;
  - `bigrm` chance (40%) is modeled for DoD.
- `nethack.js` now passes wizard mode into `initLevelGeneration(...)`.
- `u_init.makedog()` no longer calls `peace_minded()` for starting pets (this was adding extra RNG drift).

## Current result

- Startup RNG for `seed7_knight_selfplay_nonwiz.session.json` is now exact:
  - `2878/2878` startup calls match.
- First divergence moved from startup/step0 into deeper gameplay:
  - earlier in this pass: step `109`, `2541/27047` RNG calls matched
  - latest in this pass: step `166`, `3799/27472` RNG calls matched

## Current high-signal mismatch

- Remaining first mismatch is still in pet AI/melee sequencing (`dog_move`/`mattackm` path),
  now after a much longer matching prefix:
  - JS: `rn2(4)=2`
  - C:  `rnd(21)=2`
  - divergence point: step `166`

## Additional fixes in this pass

- `combat.js`: player kill-corpse creation switched to `mkcorpstat(...)` path (closer to C `make_corpse/mkcorpstat` behavior).
- `monmove.js`: pet melee path tightened toward C:
  - multi-attack to-hit handling (`rnd(20 + i)`) and damage ordering;
  - knockback RNG ordering aligned around damage resolution;
  - corpse creation on pet kill uses `mkcorpstat(...)` parity path.
- `monmove.js`: fixed drop-path bug in pet inventory handling:
  - drop path now only drops droppables (not worn, not wielded, not cursed).
- `monmove.js`: avoided in-loop monster-removal mutation drift during `movemon` iteration by deferring physical removal to the existing cleanup pass.
