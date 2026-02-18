# Seed212 Wall-Mode Glyph Checkpoint (2026-02-18)

This checkpoint records a validated gameplay-parity improvement for
`seed212_valkyrie_wizard.session.json`.

## What Changed

- Updated DEC wall rendering to respect a proven wall-mode case:
  - `TRWALL` with `wall_mode == WM_T_LONG (1)` now renders as `TLCORNER`
  - symmetric `TLWALL` case added (`WM_T_LONG -> TRCORNER`)
- Applied in both display paths:
  - `js/headless_runtime.js`
  - `js/display.js`
- Also fixed left/right T-junction mapping in `_determineWallType(...)`
  in both files to match wall symbol orientation.

## Why

Seed212 startup showed a stable C-vs-JS glyph mismatch (`'┌'` vs `'├'`) with
RNG still aligned up to step 37, indicating a deterministic render-state
difference rather than an RNG-seed drift.

Probe findings:
- JS tile at the mismatch location used T-wall typing with wall mode bits set.
- Rendering previously ignored wall mode bits and emitted a plain T glyph.
- C capture rendered the corner form for that wall-mode combination.

## Measured Impact

Command:

```bash
node test/comparison/session_test_runner.js --fail-fast test/comparison/sessions/seed212_valkyrie_wizard.session.json
```

Before this change:
- `screens matched: 0 / 407`
- `colors matched: 6812 / 9768`
- first screen divergence at step 0 row 14 (`'├'` vs `'┌'`)

After this change:
- `screens matched: 40 / 407`
- `colors matched: 7072 / 9768`
- startup glyph divergence cleared; first screen divergence moved to step 37

## Remaining Gaps

- RNG first divergence remains at step 37 index 8:
  - JS: `rn2(20)=13`
  - C:  `rn2(32)=25`
- The startup color mismatch noted during this checkpoint was resolved later
  the same day; see
  `docs/port-status/SEED212_HIMETAL_COLOR_CHECKPOINT_2026-02-18.md`.
