# Chargen Parity Progress (2026-02-13)

## What improved in this step

- Fixed broken special-level imports that were crashing the test runner:
  - `js/special_levels.js` now imports `./levels/fakewiz1.js` and `./levels/fakewiz2.js` (previously pointed to missing `wizdecoy*.js`).
- `npm run test:chargen` now executes successfully again.

## Validation snapshot

- `npm run test:chargen`: **PASS**
- Strict session replay probe on `seed1_chargen_healer` still shows startup divergence at index 0:
  - JS startup emits RNG calls while C startup section for this captured chargen session is effectively empty (`(end)`).

## What this means

- The blocking regression (missing module import) is resolved.
- Chargen suite execution is stable again in CI/local `npm test` flow.
- Remaining work is fidelity-oriented, not runner-breakage:
  - bring strict chargen startup parity closer for seed/class cases,
  - continue C-faithful `mktrap_victim` behavior and healer startup/inventory sequencing.

## Immediate next targets

1. Tighten `mktrap_victim` object-generation/consumption behavior to match C RNG side effects in startup traces.
2. Reconcile healer role startup ordering against C (`u_init_role` / inventory+money path), using strict replay diffs.
3. Add focused assertions for strict chargen startup parity once map-generation assumptions are aligned.
