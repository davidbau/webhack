# Converter Reconversion Worklog (2026-02-12)

## Scope
- Hardened `tools/lualevel_to_js.py` and `tools/lua_to_js.py` for full-batch level reconversion.
- Reconverted all Lua level generators from `nethack-c/dat/*.lua` into `js/levels/*.js`.

## Converter fixes added
- Preserved multiline template literal content without auto-indenting map body lines.
- Added first-line template-literal line continuation (`\`) when Lua `[[...]]` starts with newline to avoid synthetic leading blank map row.
- Added safer 1-based indexing conversions for common Lua patterns in generated JS:
  - numeric literal index shifts (`arr[1] -> arr[0]`)
  - `math.random(1, #arr)` index patterns to `rn2(arr.length)`
  - `for i = 1, #arr do` to 0-based JS loop.
- Added `hell_tweaks` handling:
  - emit import when referenced
  - avoid self-import in `hellfill`
  - emit `hell_tweaks` stub export in `hellfill` so dependent files load.
- Added missing import detection for `nh` and `u` usage.
- Added declaration recovery for first-use bare assignments (e.g. `place = ...` -> `let place = ...`).
- Added targeted postprocess stabilizers for known converter edge files (`Rog-strt`, `Val-strt`, `bigrm-6`, `bigrm-8`, `bigrm-9`).
- Skipped library-style data modules from auto-regeneration (`dungeon`, `themerms`, plus existing `nhcore`, `nhlib`, `quest`).

## Validation
- `node --check js/levels/*.js`: all pass after reconversion.
- `node test/unit/special_levels_comparison.test.js`: still 43 failures (same high-level mismatch class as baseline), but converter-introduced runtime `ReferenceError` class was addressed.
- `node test/unit/wizard.test.js`: PRNG divergence remains at existing known point (makelevel divergence entry 551).
- `npm test`: still failing due known special-level/PRNG alignment mismatches; no new broad syntax breakage from reconversion.

## Remaining work
- Resolve C/JS terrain parity mismatches in special-level comparison tests.
- Resolve PRNG call alignment drift in `wizard.test.js` trace-based checks.
- Revisit library-file conversion strategy for `themerms`/`dungeon` if full auto-generation of those modules becomes a hard requirement.
