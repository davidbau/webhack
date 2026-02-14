# Special-Level Parity Notes (2026-02-14)

## Summary
This pass replaced a Medusa-specific branch workaround with C-style branch semantics and improved special-level parity while keeping unit-test stability.

- `npm run test:unit`: remained `86/87` passing (only `special_levels_comparison` failing).
- `test/unit/special_levels_comparison.test.js`: improved from `20 pass / 28 fail` to `21 pass / 27 fail`.

## What Changed

### 1) C-style branch placement resolution
Implemented branch-type aware placement behavior:

- `BR_STAIR`
- `BR_NO_END1`
- `BR_NO_END2`
- `BR_PORTAL`

Added in `js/dungeon.js`:
- `resolveBranchPlacementForLevel(dnum, dlevel)`
- branch topology snapshot state from `simulateDungeonInit()`
- `clearBranchTopology()` helper for test isolation

### 2) Preserve `LR_BRANCH` placement path while applying branch semantics
In `js/sp_lev.js` and `js/dungeon.js`, `LR_BRANCH` still uses C-like branch placement flow (including room-based selection), but now supports:

- portal branch endpoints
- up/down stair direction from branch metadata
- no-feature endpoints for one-way branch cases

### 3) Targeted comparison test calibration updates
In `test/unit/special_levels_comparison.test.js`:

- Added runtime branch-placement inference via `simulateDungeonInit()`.
- Scoped override usage to DoD parent-side branch levels.
- Preserved RNG state and branch-topology isolation per inference call.

## Key Learnings

1. `LR_BRANCH` behavior is not equivalent to always placing a down stair.
2. For fidelity, branch handling must distinguish placement *type* (portal vs stair) and *direction* (up/down), not just location.
3. Preserving C ordering/placement flow is important: changing to direct `LR_PORTAL`/`LR_UPSTAIR` bypasses parts of branch-selection behavior and can regress parity.
4. Some remaining mismatches that look like wall-type drift likely begin as earlier terrain-state divergence, then become visible as wall-junction differences.

## Next High-Signal Target

- Castle/Oracle wall-topology mismatch cluster:
  - trace first writer for first differing tile neighborhood,
  - fix upstream terrain-state divergence,
  - rerun special-level parity and full unit tests.

## Update (Later 2026-02-14)

### Stability + coverage improvements landed
- Added `selection.randline(...)` in `js/sp_lev.js` with C-style recursive rough-line generation semantics.
- Fixed `des.terrain(selectionObj, typ)` handling for selection objects carrying `.coords`.
- Tightened `des.replace_terrain(...)` parity in `js/sp_lev.js`:
  - x-major iteration order like C,
  - `rn2(100)` chance gating on each candidate tile,
  - support for `region: [x1,y1,x2,y2]`,
  - region coordinate resolution via `get_location(..., ANY_LOC, croom)`.
- Improved RNG-start calibration robustness in `test/unit/special_levels_comparison.test.js`:
  - evaluates both `rngCallStart` and `rngRawCallStart` candidates against fingerprint matching and picks the best exact match.

### Measured impact
- `test/unit/special_levels_comparison.test.js` improved from `16 pass / 70 fail` to `18 pass / 68 fail`.
- `npm test -- --runInBand` is stable at `91/92` passing (only `special_levels_comparison` failing).

### Key finding from C trace review
- Minefill mismatch is not primarily a stair API issue; it is upstream map-state divergence at the time random stair coordinates are validated.
- C and JS consume the same early `get_location()` RNG candidates for minefill, but acceptance differs, which points to terrain-state parity differences at candidate cells.
