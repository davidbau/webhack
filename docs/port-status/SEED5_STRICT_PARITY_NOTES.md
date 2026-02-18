# Seed5 Strict Parity Notes

Date: 2026-02-14

This note records concrete C-faithful fixes made while advancing strict replay
parity for `seed5_gnomish_mines_gameplay`.

## What Improved

- Strict replay advanced from an RNG stop at step 201 to step 205.
- Seed replay unit tests (`seed1`..`seed5`) remain green.

## Key Lessons (C-Guided)

1. Corpse age must be stamped at creation time.
   - If kill-generated corpses are created with `age=0`, `dogfood()` treats
     fresh corpses as old/tainted and pet AI diverges.
   - Fix: set corpse `age` to current turn (`player.turns + 1`) when creating
     corpses from kill paths.

2. `eatcorpse()` consumes an early RNG chain even for fresh corpses.
   - For non-nonrotting corpses, C consumes:
     - `rn2(20)` (rotted denominator),
     - `rn2(7)` (rottenfood gate).
   - Then C continues with taste/palatability gates:
     - `rn2(10)` and `rn2(5)`.
   - Missing any of these shifts all downstream monster RNG.

3. Message-row parity depends on terrain lead-ins, not only object text.
   - On doorway tiles with floor objects, C message flow includes
     `"There is a doorway here."` before `"You see here ..."`.
   - Replay harness strict row-0 checks make these omissions visible quickly.

## Practical Guidance

- For replay mismatches, prioritize exact C control flow and object state over
  local heuristics.
- When a divergence appears in pet AI, verify item metadata (especially corpse
  `age`, `corpsenm`, and curse state) before changing movement logic.

---

Date: 2026-02-15

## Additional Progress

- Strict seed5 replay frontier advanced from step 205 to step 330.
- Seed replay unit tests (`seed1`..`seed5`) remain green after each change.

## Additional C-Faithful Fixes

1. Special-level room fill defaults must preserve shop stocking.
   - Bug: special-level rooms were created with `needfill=undefined` for
     non-ordinary room types.
   - Effect: `stock_room()` was skipped for shop rooms on generated levels.
   - Fix: default `needfill` to `FILL_NORMAL` (outside themed-room mode) for
     all room types unless explicitly overridden.

2. Shop stock generation must place objects on map tiles.
   - Bug: `mkshobj_at()` created objects but did not assign `(ox, oy)` or push
     them into `map.objects`.
   - Effect: in-shop monster item logic (`m_search_items`/`mpickstuff`) diverged.
   - Fix: set object coordinates and insert into level object list for all
     shop stock paths (including veggy/special book paths).

3. In-shop checks used by monster AI need roomno/shared fallback.
   - C uses `in_rooms(...)` semantics based on roomno/shared tiles.
   - Fix: replace broad geometry fallback with roomno-first checks plus a
     narrow neighbor-room fallback for shared-like/door-corridor tiles.

4. Monster-to-player to-hit should use displayed AC semantics (`u.uac`).
   - C macro: `AC_VALUE(ac) = ac >= 0 ? ac : -rnd(-ac)`.
   - Fix: base monster-hit AC_VALUE on `player.ac` (with negative AC randomization),
     not `effectiveAC` clamping.

5. Floor-corpse eat prompt and rotten-food RNG chain must follow C order.
   - Added C-style floor prompt: `There is a ... here; eat it? [ynq] (n)`.
   - Implemented rotten-food RNG chain for the early corpse path:
     `rn2(20)`, `rn2(7)`, then rottenfood probes `rn2(4)`, `rn2(4)`, `rn2(3)`.
   - Kept corpse removal at end-of-turn occupation completion so monster phase
     sees expected floor object state.

## Current Remaining Gap

- First strict mismatch is now inside step 330, much later in the same turn
  chunk than before.
- Remaining mismatch appears to be turn-chunk/input-attribution related around
  post-eat continuation, not the earlier shop/knockback/eat control-flow gaps.

---

Date: 2026-02-15 (later checkpoint)

## Additional Progress

- Strict seed5 replay frontier advanced from step 357 to step 374.
- Seed replay unit tests (`seed1`..`seed5`) and `monmove` stayed green.

## Additional C-Faithful Fixes

1. `onlineu` parity fix for shopkeeper movement gating.
   - C `onlineu` uses `online2`: same row/column OR same diagonal.
   - JS incorrectly treated this as orthogonal-only.
   - Fix in `js/monmove.js`: `onlineu` now matches C `online2` semantics.
   - Impact: corrected `shk_move`/`move_special` branching and removed an early
     downstream pet-target RNG drift at step 357.

2. `dosounds` shop branch parity in replay harness.
   - C only consumes the shop message chooser `rn2(2)` when:
     - there is a tended shop, and
     - hero is not currently inside a shop room.
   - JS harness was always consuming `rn2(2)` whenever `has_shop && !rn2(200)`.
   - Fix in `test/comparison/session_helpers.js`: add `playerInShop` and
     `tendedShop` gating before the `rn2(2)` shop message roll.
   - Impact: removed a false RNG divergence in the step-365 area.

## Current Remaining Gap

- New strict frontier is step 374 in `dog_move` candidate evaluation.
- C reports `mfndpos=5` at the relevant sub-turn while JS currently reports a
  larger candidate set in one of the equivalent pet turns, indicating further
  `mfndpos`/pet-candidate filtering parity work remains.

---

Date: 2026-02-16

## Additional Progress

- `seed204_multidigit_wait_gameplay` strict RNG parity restored to full pass
  (`2918/2918`) by porting C occupation-stop timing from monster movement.
- `seed5_gnomish_mines_gameplay` first divergence moved substantially later:
  from step 59 to step 201, with matched RNG increasing from 5955 to 12153
  during this pass.
- Seed gameplay baselines remained stable:
  - `seed1_gameplay` pass (`5981/5981`)
  - `seed2_wizard_fountains_gameplay` pass (`6629/6629`)
  - `seed3_gameplay` pass (`2388/2388`)
  - `seed4_selfplay_150turns_gameplay` pass (`7300/7300`)

## Additional C-Faithful Fixes

1. `dochugw` occupation interruption parity in monster phase.
   - C source path: `monmove.c` (`dochugw`) + `allmain.c` (`stop_occupation`).
   - JS now stops occupation when a newly noticed hostile threat moves into
     range during `movemon`, rather than only via pre-input nearby checks.

2. Kick-prefix replay handling for raw `^D` steps.
   - Replay runner previously treated certain zero-RNG `^D` rows as ignorable
     noise unconditionally.
   - For keylog sessions where `^D` is the kick prefix and the directional
     follow-up is captured on the next step, this dropped real command state.
   - Fix: keep the noise-skip path narrow and avoid skipping when the next step
     clearly matches a kick follow-up (`kick_door` RNG/message signature).

3. Level-transition turn-end replay parity refinement.
   - For descend/ascend steps that explicitly contain turn-end RNG signatures,
     replay now executes full timed-turn flow (including `movemon`) in that
     same step, matching C capture boundaries.

4. `mfndpos` monster-vs-monster attack gating tightened toward C.
   - Removed non-C generic hostile-vs-tame/peaceful attack allowance.
   - Kept movement-into-occupied-square allowance to C-style special aggression
     cases (plus existing tame-pet behavior already used in early seeds).

## What We Learned

- A large class of divergences came from replay command-state attribution
  rather than core dungeon RNG: dropping a prefix key (`^D`) can shift entire
  downstream movement/combat streams.
- Occupation stop timing must include the monster-phase threat check from
  `dochugw`, not just pre-input `monster_nearby`/adjacency checks.
- When transition steps include explicit C turn-end RNG, replay should not
  short-circuit movement bookkeeping on destination level for that step.

---

Date: 2026-02-17

## Additional Progress

- First strict screen mismatch for `seed5_gnomish_mines_gameplay` moved from
  step 56 to step 175 while preserving the same first RNG mismatch step (201).
- Seed5 strict screen match count improved from `69/2616` to `207/2616`.

## Additional C-Faithful Fixes

1. Replay screen loader parity for string-backed session captures.
   - Some v3 gameplay fixtures store `step.screen` as a newline-delimited
     string instead of an array.
   - `getSessionScreenLines()` in `js/replay_core.js` now accepts:
     - `screenAnsi: string[] | string`
     - `screen: string[] | string`
   - This prevents accidental empty-screen handling on valid captured steps.

2. Replay status-option inference from captured startup state.
   - For sessions without explicit option bits in metadata, replay now infers
     status formatting toggles from captured startup status lines:
     - `Xp:` vs `Exp:` -> `showexp`
     - presence of `T:` -> `time`
     - presence of `S:` -> `showscore`
   - These inferred flags are applied before the first replay render, keeping
     status text aligned with the recorded C session.

3. Score visibility gating in status renderer.
   - Status line 1 now prints `S:<score>` only when `showscore` is enabled.
   - Added `showscore` to flag defaults and runtime propagation paths.

4. `Xp` formatting parity.
   - In showexp mode, status line 2 now renders as `Xp:<level>` rather than
     `Xp:<level>/<exp>`, matching captured C status format in replay sessions.

---

Date: 2026-02-18

## Additional Progress

- Seed5 strict gameplay replay improved materially via replay-step boundary
  attribution work:
  - RNG matched calls: `11175 -> 11893`
  - first RNG divergence moved from step `44` to step `201`
- Guard sessions remained stable while iterating:
  - `seed42_inventory_wizard_gameplay` still passes
  - `seed3_selfplay_20turns_gameplay` still passes

## Additional C-Guided Learnings

1. Step-boundary attribution can dominate apparent RNG divergence.
   - For `seed5`, the first failure was not an immediate gameplay logic mismatch:
     JS step 44 had trailing RNG that exactly matched the prefix of C step 45.
   - Normalizing this replay boundary (without mutating core engine logic)
     recovered a large block of parity.

2. Prefix-overflow matching should be proof-based.
   - Replay deferral only applies when:
     - current step's expected RNG is a strict prefix of JS produced RNG, and
     - overflow comparable calls are an exact prefix of next step expected calls.
   - This keeps the normalization narrow and avoids broad heuristic shifts.

3. Post-fix frontier now points at real `dog_move` logic.
   - Current first RNG mismatch is in step 201 (`dog_move` stack), where C expects
     `obj_resists`-driven `rn2(100)` in a spot JS currently produces `rn2(8)`.
   - This indicates remaining divergence is in pet object-scan/goal branch order,
     not early replay boundary handling.
