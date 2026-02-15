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
