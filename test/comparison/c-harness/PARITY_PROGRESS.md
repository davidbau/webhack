# Special-Level Parity Progress (Checkpoint)

Date: 2026-02-13

## Scope of this checkpoint

Focused on reducing high-signal Knox seed divergence and improving C/JS RNG alignment fidelity in special-level generation.

## What changed

- Added C-style Croesus special-item RNG side effect before `m_initweap/m_initinv` in `js/makemon.js`.
- Implemented non-stub `des.gold()` in `js/sp_lev.js` so gold placement consumes object-creation RNG like C (`mksobj` path).
- Routed explicit `des.trap(...)` placement through `mktrap(...)` in `js/sp_lev.js` to preserve trap-side RNG effects.
- Extended harness fingerprint extraction in `test/comparison/c-harness/gen_special_sessions.py` to include richer ops (`rn2`, `rnd`, `d`, `rne`, `rnz`) and emitted `rngRawCallStart` metadata.
- Extended replay/calibration in `test/unit/special_levels_comparison.test.js` to evaluate those richer fingerprint ops.
- Regenerated Knox C sessions (seeds 1/42/100) with updated harness metadata.

## Key findings

- Earlier Knox drift was not only start-offset calibration; missing RNG-consuming side effects in JS (`des.gold` and trap placement semantics) were major contributors.
- After this checkpoint, Knox mismatches dropped from broad map divergence to small localized branch-local deltas around throne/secret-door outcomes.
- `rngRawCallStart` is useful metadata but cannot yet be applied blindly for all sessions; combined fingerprint + branch-local analysis remains necessary.

## Validation snapshot

- `node --test test/e2e/startup.e2e.test.js`: pass (3/3).
- `test/unit/special_levels_comparison.test.js`: overall still failing broadly, but Knox now much narrower than before this step.

## Remaining work

- Resolve final Knox branch-local `%50` parity around throne/secret-door transformation semantics.
- Generalize calibration logic so special-case heuristics can be removed cleanly.

## Incremental checkpoint (drawbridge + runtime stability)

- Fixed `des.drawbridge()` in `js/sp_lev.js` to use map-relative coordinate resolution (`getLocationCoord`) and drawbridge terrain semantics (`DRAWBRIDGE_UP`/`DRAWBRIDGE_DOWN` plus adjacent `DBWALL`) instead of the previous door/corridor stub.
- Restored compatibility aliases on generated monsters in `js/sp_lev.js` (`id`, `x`, `y` alongside `mx`, `my`) so legacy level tests/tooling can locate named monsters without changing generation flow.
- Fixed runtime regression in `js/makemon.js` by importing `LUCERN_HAMMER` (previously caused `ReferenceError` during mercenary weapon initialization).

### Validation snapshot

- `node --test test/unit/tower.test.js test/unit/wizard_levels.test.js`: pass.
- `node test/unit/special_levels_comparison.test.js`: still `pass 9 / fail 39` overall, with Castle reduced from 69 to 67 mismatches in focused diff checks.
- `npm test`: still failing primarily due broad special-level parity gaps, but the `LUCERN_HAMMER` runtime crash and wizard-level unit assertion regression are resolved.
