# Chargen Parity Progress (2026-02-13)

## What improved in this step

- Fixed broken special-level imports that were crashing the test runner:
  - `js/special_levels.js` now imports `./levels/fakewiz1.js` and `./levels/fakewiz2.js` (previously pointed to missing `wizdecoy*.js`).
- `npm run test:chargen` now executes successfully again.
- Replay/startup harness now uses real pet migration (`mon_arrive`) instead of manual RNG burn/deferred simulation.
- Startup now runs post-level init for normal games as well (matching C `newgame()` flow, not wizard-only).
- Ported C `u.umoney0` flow into startup inventory: Healer/Tourist starting money is now emitted via `Money` inventory object (`GOLD_PIECE`) with coin-class quantity semantics.
- Tightened `mktrap_victim` candle object fields to match C (explicit `quan=1`, recalculated weight).
- Replaced `mktrap_victim` landmine breakage approximation with direct C-faithful `breaktest()` + `obj_resists()` logic (including invocation-item immunity and glass-material handling).
- Replaced startup pet `peace_minded` heuristic with a direct C-faithful port from `makemon.c`, including:
  - `always_peaceful` / `always_hostile`,
  - leader/guardian/nemesis and Erinys special case,
  - race-based peaceful/hostile masks,
  - alignment sign checks, amulet hostility, minion handling,
  - final `rn2(16 + clamp(record, -15..)) && rn2(2 + abs(mal))` RNG path.
- Added explicit player alignment-state fields (`alignmentRecord`, `alignmentAbuse`) and persisted them through save/restore state.
- `mktrap_victim` now reuses shared C-ported `obj_resists()` logic (instead of a local duplicate) for landmine `breaktest()` behavior.
- Added C-style dark-square candle ignition behavior in `mktrap_victim` gnome-corpse branch (`begin_burn` analog via `lamplit`).

## Validation snapshot

- `npm run test:chargen`: **PASS**
- Strict session replay probe on `seed1_chargen_healer` still shows startup divergence at index 0:
  - JS startup emits RNG calls while C startup section for this captured chargen session is effectively empty (`(end)`).

## What this means

- The blocking regression (missing module import) is resolved.
- Chargen suite execution is stable again in CI/local `npm test` flow.
- Remaining work is fidelity-oriented, not runner-breakage:
  - bring strict chargen startup parity closer for seed/class cases,
  - continue C-faithful startup logic reductions where role/race/alignment state still uses inferred defaults.

## Immediate next targets

1. Tighten `mktrap_victim` object-generation/consumption behavior to match C RNG side effects in startup traces.
2. Reconcile healer role startup ordering against C (`u_init_role` / inventory+money path), using strict replay diffs.
3. Add focused assertions for strict chargen startup parity once map-generation assumptions are aligned.
