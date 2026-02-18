# Seed212 HI_METAL Color Checkpoint (2026-02-18)

This checkpoint records a validated color-parity improvement for
`seed212_valkyrie_wizard.session.json`.

## What Changed

- Corrected `HI_METAL` color mapping in the objects generator:
  - `scripts/generators/gen_objects.py`: `HI_METAL` now maps to `CLR_CYAN (6)`.
- Added generator path fallback so regeneration works from repo root in this
  project layout.
- Applied the resulting color corrections in `js/objects.js` for affected
  objects (notably amulets/rings and other `HI_METAL` entries), while
  preserving existing exports and runtime structure.

## Why

Seed212 had a stable startup color mismatch on an amulet tile:
- JS: `"` with fg `7`
- C:  `"` with fg `6`

`HI_METAL` objects in C should use cyan (`6`), so JS object color source data
was incorrect for these entries.

## Measured Impact

Command:

```bash
node test/comparison/session_test_runner.js --fail-fast test/comparison/sessions/seed212_valkyrie_wizard.session.json
```

Before this change:
- `colors matched: 7283 / 9768`
- first color divergence at startup step 0 row 17 col 71

After this change:
- `colors matched: 7417 / 9768`
- startup color divergence cleared
- first divergence now begins at RNG step 37 (`m_move` branch)

## Validation

- `node --test test/unit/objects.test.js` passes
- `node --test test/unit/object_colors.test.js` passes
- Issue #11 seed set (`seed103`, `seed112`, `seed42`, `seed5`) shows no new
  earlier first divergence from this change set.
