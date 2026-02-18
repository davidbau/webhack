# Interface Tutorial Parity (2026-02-17)

## What Landed

- Added C-style startup tutorial prompt in live game init:
  - `Do you want a tutorial?` menu with `y/n` choices.
  - `y` enters tutorial branch and shows `Entering the tutorial.--More--`.
  - `n`/`q`/`esc` returns to normal map view.
- Added `tutorial: true` to default option flags (matches C default behavior of asking).
- Extended C harness utilities:
  - `run_session.py --chargen ... --tutorial y|n`
  - `gen_interface_sessions.py --tutorial`
- Captured a manual tutorial interface fixture with post-entry movement:
  - `test/comparison/sessions/manual/interface_tutorial.session.json`
  - Includes tutorial entry plus ~20 movement steps.

## Test Safety Checks

- `node --test test/e2e/startup.e2e.test.js` passes.
- `node test/comparison/session_test_runner.js --type interface --fail-fast` passes for default checked-in interface fixtures.
- `node --test test/unit/replay_tutorial_prompt.test.js test/unit/wizard_mode.test.js` passes.

## Key Findings

- C tutorial captures can differ in where RNG is attributed:
  - some traces place tutorial-map generation RNG on the `y` step,
  - others place it on the following space/ack step.
- Replay logic now supports both tutorial-start timing patterns.
- ANSI cursor-forward (`ESC[nC`) must be preserved as spaces for faithful screen alignment.

## Remaining Gap

- Strict replay parity for `manual/interface_tutorial.session.json` is still not green.
- Current drift is concentrated in tutorial-map RNG ordering after entry, not in basic startup UI behavior.

## Next Targeted Step

- Instrument C+JS around tutorial map materialization and first post-entry movement turn, then align the exact RNG side-effect order before promoting tutorial fixture into the default interface suite.

## Update (2026-02-18)

- Changed tutorial first-percent raw shim default to `WEBHACK_TUT_EXTRA_RAW_BEFORE_PERCENT=2` (still overrideable by env).
- Strict replay for `manual/interface_tutorial.session.json` improved from RNG matched `17/286` to `27/284`.
- Remaining first RNG divergence is still at step 1 index 5 (`rn2(100)` JS `83` vs C `97`), and color parity remains `427/576`.
