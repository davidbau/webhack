# Special-Level Parity Checkpoint (2026-02-15)

This checkpoint records a validated harness/runtime step forward for C-vs-JS special-level parity.

## Result

- `test/unit/special_levels_comparison.test.js`: improved from **17 pass / 69 fail** to **19 pass / 67 fail**.
- `Mines Filler` now passes for both seed 1 and seed 100.

## Changes landed

1. `test/unit/special_levels_comparison.test.js`
- Fixed finalize-context ordering: filler-specific `dlevel`/branch overrides are now applied before `setFinalizeContext(...)` is called.
- Fixed generator resolution priority so name-addressed generators are chosen before coordinate lookup.

2. `js/sp_lev.js`
- Strengthened selection API parity:
  - `selection.new()` now includes `bounds()`.
  - `selection.match(...)` now returns a full selection object and supports mapchar-style matching (including wall class `w`).

3. `js/levels/hellfill.js`
- Corrected several Lua-conversion artifacts that were not JS-faithful (loop/table/type/index issues), removing runtime failure paths in filler-generation logic.

## Key findings

- The minefill pass improvement was primarily from harness correctness (finalize-context timing) plus selection API fidelity, not from broad RNG offset masking.
- Remaining filler mismatch is concentrated in `hellfill` and starts at `after_level_init` checkpoint #1, indicating a still-unresolved divergence in style-selection/init parity rather than end-of-level fixups.
