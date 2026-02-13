# Progress: Map Wallify Ordering and Flip Parity (2026-02-13)

## Summary

This checkpoint fixes a C-parity bug in special-level map handling: `des.map()` was wallifying terrain too early in JS.

In C (`sp_lev.c`), map load (`lspo_map`) writes terrain and marks `SpLev_Map`, but wallification happens later during level finalization.

## Change

- Removed premature wallification from `des.map()` in `js/sp_lev.js`.
- Left wallification in `finalize_level()` as the single wall-junction pass.

## Why It Matters

Early wallification changed boundary/crosswall semantics before the rest of special-level finalization, which caused structural drifts from C maps.

The clearest symptom was Vlad tower crosswall mismatches (`CROSSWALL` vs `ROOM`) in parity tests.

## Validation

- `node test/unit/special_levels_comparison.test.js`
  - Before this step: `17 pass / 31 fail`
  - After this step: `20 pass / 28 fail`
  - `tower1`, `tower2`, `tower3` all moved to passing.
- Targeted unit checks remained green:
  - `test/unit/castle.test.js`
  - `test/unit/medusa.test.js`
  - `test/unit/sp_lev.test.js`
  - `test/unit/wizard_levels.test.js`

## Notes

- This is a structural parity correction, not a full special-level parity completion.
- Remaining failures are concentrated in Castle/Medusa/Gehennom/Oracle/Mines/Planes/Quest paths and likely involve additional topology or RNG-side-effect parity gaps.
