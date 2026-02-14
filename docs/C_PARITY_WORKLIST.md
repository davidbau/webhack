# C Parity Worklist

Scope: replace simulation/stub behavior with faithful C NetHack logic while keeping replay/unit tests green after each batch.

## Phase 1: Gameplay RNG and Turn Logic

- [~] Replace simplified `dochug` condition flow in `js/monmove.js` with full C checks/order.
- [x] Added C leprechaun movement clause and effective blind-monster vision gate.
- [ ] Replace partial pet melee path with fuller `mattackm`/`passivemm` semantics in `js/monmove.js`.
- [~] Complete trap-trigger effects in movement path (`js/commands.js`) for common traps with C-like RNG side effects.
- [x] Added concrete effects + RNG calls for `SLP_GAS_TRAP`, `FIRE_TRAP`, `PIT`, `SPIKED_PIT`.
- [ ] Reduce replay harness-only simulation in `test/comparison/session_helpers.js` by reusing real game logic where possible.
- [ ] Keep strict seed replay parity green for seeds 1-5 after each sub-change.

## Phase 2: Special-Level Generation Fidelity

- [ ] Replace `makemaz` fallback/procedural stubs in `js/dungeon.js` with C-faithful special-level loading paths.
- [ ] Complete deferred/finalization stubs in `js/sp_lev.js` (room finalization, random placement, solidify/premap parity paths).
- [ ] Remove simplified branch/special selection behavior in `js/special_levels.js`.
- [ ] Drive this phase with `test/unit/special_levels_comparison.test.js` and targeted per-level diffs.

## Phase 3: Object and Monster Generation Fidelity

- [ ] Replace simplified retries/shortcuts in `js/mkobj.js` with C loop/termination behavior.
- [ ] Continue porting omitted `makemon` generation constraints/checks in `js/makemon.js` (mvitals/quest/hell/nohell/etc).
- [x] Replaced rider corpse stub in `js/objdata.js` (`PM_DEATH/PESTILENCE/FAMINE` detection).
- [ ] Validate with startup/chargen/special-level replay tests.

## Phase 4: Combat and Status Fidelity

- [ ] Replace approximate XP/leveling in `js/combat.js` with C `exper.c` behavior.
- [ ] Fill remaining AD_* and passive combat side effects in `js/combat.js`.
- [ ] Replace simplified pet status/food edge cases in `js/dog.js`.

## Working Rules

- Make small, reviewable commits.
- Keep replay tests and unit tests green after each batch.
- Prefer direct C behavior over synthetic RNG consumption.
- Use tests to prioritize, not to define behavior.
- For visible behavior changes, port from `nethack-c/src` first; avoid trace-only heuristics.
- For each completed item: record what changed and which tests verified it.
