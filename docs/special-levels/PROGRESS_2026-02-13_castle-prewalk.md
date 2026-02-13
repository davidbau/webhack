# Special Levels Progress - 2026-02-13 (Castle Pre-walk Focus)

## Scope
- Focused on C/JS parity around Castle pre-`mazewalk` behavior.
- Kept changes scoped to monster init parity and stability guards.

## Changes Landed

### 1) Troll loadout parity in `m_initweap`
- File: `js/makemon.js`
- Updated `S_TROLL` weapon table to match C (`RANSEUR`, `PARTISAN`, `GLAIVE`, `SPETUM`) instead of non-C substitutions.
- This removes one known RNG/behavior drift source for special-level monster equipment.

### 2) Browser static-check stability fix
- File: `js/sp_lev.js`
- Fixed unguarded Node `process.env` usage pattern flagged by startup static checks.
- Added `getProcessEnv(name)` helper and used it for `WEBHACK_MAZEWALK_MODE` reads.

## Validation
- `node --test test/unit/makemon.test.js` : pass
- `node --test test/unit/monsters.test.js` : pass
- `node --test test/e2e/startup.e2e.test.js` : pass (regression removed)
- `node /tmp/castle_diff_count.mjs` : `castle diffs 66` (no Castle parity regression from this change)
- `node test/unit/special_levels_comparison.test.js` : still `9 pass / 39 fail`

## What This Means
- This was a **stability/accuracy checkpoint**, not a broad parity breakthrough.
- We removed a concrete C mismatch in monster equipment and fixed a real startup test regression.
- Castle pre-`mazewalk` divergence remains and is still concentrated in pre-walk monster/class RNG alignment.

## Next High-Signal Step
- Continue with trace-driven Castle alignment:
  - map each throne-room `des.monster(...)` call to JS RNG windows and selected class/species,
  - align against C tail before first `walkfrom`,
  - fix the first class/order divergence and re-run focused parity checks.
