# Core Replay Unification Plan

> Plan hierarchy: This is a subordinate subplan to root [`PROJECT_PLAN.md`](../PROJECT_PLAN.md).  
> If scope, priority, or milestone details conflict, `PROJECT_PLAN.md` is authoritative.

## Purpose

This document replaces the previous cleanup plan.

The project goal now is specific:

1. Move session replay behavior out of the test harness and into core game/runtime code.
2. Keep fidelity checking strict: PRNG, typgrid, and screen parity must stay first-class.
3. Keep debugging quality high: when parity fails, we must still get fast, precise divergence reports.
4. Improve speed for faster insight, not by skipping checks or reducing captured evidence.

In short: the harness should drive and compare; the game should behave.

---

## Motivation

The current session stack still contains game-aware behavior in test infrastructure
(`test/comparison/session_runtime.js`). That creates three problems:

1. Duplication risk: behavior can diverge between gameplay code and replay code.
2. Trust risk: a failing session can come from harness emulation, not game behavior.
3. Maintenance drag: parity fixes require touching test runtime internals and core game paths.

For faithful C parity work, we need one source of behavior truth: core game runtime.

---

## Current State

| File | Lines | Role |
|------|-------|------|
| `js/headless_runtime.js` | 977 | Core game: HeadlessGame, HeadlessDisplay |
| `test/comparison/session_runtime.js` | 1457 | **Game-aware test code (target for elimination)** |
| `test/comparison/session_helpers.js` | 41 | Re-exports (game-unaware) |
| `test/comparison/comparators.js` | ~150 | Pure comparison functions (game-unaware) |
| `test/comparison/session_loader.js` | ~200 | Session file loading (game-unaware) |

**Target**: Delete `session_runtime.js` by pushing functionality into
`js/headless_runtime.js` (game behavior) or keeping only pure comparison
logic in test utilities.

---

## Hard Goals

The end state should satisfy all of these:

1. One official session run path remains:
   - `npm run test:session`
2. Session execution for all session types is driven by one core stepping path.
3. Harness modules do not implement turn logic, prompt logic, or command semantics.
4. PRNG, typgrid, and screen comparisons stay granular and deterministic.
5. Replay debugging remains rich enough to pinpoint first divergence with context.
6. End state is clean: no transitional replay modes, no explicit feature-flag split paths.

---

## Simplicity and Transparency Constraints

These constraints are design guardrails, not optional optimizations:

1. Keep one headless replay module as the execution entrypoint for session tests.
2. Harness code should be easy to audit: load session, run core step API, compare, report.
3. Do not hide behavior behind caching/sampling that changes replay semantics.
4. Do not skip PRNG/typgrid/screen work to improve runtime numbers.
5. Favor clear data flow and direct diagnostics over clever indirection.

---

## Harness/Game Boundary by Category

`session_runtime.js` responsibilities should migrate by category:

### 1. Map Generation (lines ~195-440)

```javascript
generateMapsSequential(seed, maxDepth)
generateMapsWithRng(seed, maxDepth)
```

Custom map generation loop that manually calls `initLevelGeneration()`,
`makelevel()`, etc. **Migration**: Use wizard mode teleport (`teleportToLevel`)
instead of harness loops calling generation internals.

### 2. Startup Generation (lines ~480-565)

```javascript
generateStartupWithRng(seed, session)
```

Manually constructs Player, Map, HeadlessGame. **Migration**: Replace with
one core init path `HeadlessGame.start(seed, options)`.

### 3. Session Replay (lines ~566-1312)

```javascript
async replaySession(seed, session, opts = {})
```

750+ lines implementing turn logic, prompt handling, monster movement, FOV.
**Migration**: Move prompt/turn/continuation/count behavior into core step
execution. Harness becomes a simple key-send loop.

### 4. Structural Validators (lines ~1313-1457)

```javascript
checkWallCompleteness(map)
checkConnectivity(map)
checkStairs(map, depth)
```

**Keep in test infrastructure** as pure assertions over game-provided state.

### 5. Grid/Screen Extraction

```javascript
extractTypGrid(map)
parseTypGrid(text)
```

**Migration**: Keep extraction logic in core accessors (`getTypGrid()`,
`getScreen()`); harness should not inspect map internals.

---

## Non-Goals

1. Rewriting all historical diagnostic scripts immediately.
2. Replacing existing session formats in one step.
3. Requiring full green parity before refactor completion.

---

## Target Architecture

## 1) Core Owns Replay Semantics

`js/nethack.js` + `js/headless_runtime.js` should expose replay-safe APIs so tests do
not infer behavior from session metadata heuristics.

Target capabilities in core/runtime:

1. Initialize game from explicit startup options (seed, wizard, role/race/gender/align,
   optional dungeon start context).
2. Submit one input key and run exactly one canonical command/turn boundary.
3. Return structured per-step observation payload.
4. Expose stable hooks for trace capture (without test-only game logic in harness).

## 2) Harness Becomes Thin

`test/comparison/session_test_runner.js` should only:

1. Load and normalize session data.
2. Construct game with requested options.
3. Feed keys through core replay API.
4. Compare expected vs actual streams.
5. Emit diagnostics and result summaries.

**No gameplay simulation in harness.**

Target harness code:

```javascript
async function replaySession(session) {
    const game = await HeadlessGame.start(session.seed, session.options);
    const results = { startup: captureState(game), steps: [] };

    for (const step of session.steps.slice(1)) {
        game.clearRngLog();
        await game.sendKey(step.key);
        results.steps.push(captureState(game));
    }

    return results;
}

function captureState(game) {
    return {
        rng: game.getRngLog(),
        screen: game.getScreen(),
        typGrid: game.getTypGrid(),
    };
}
```

## 3) Comparators Stay Focused

`test/comparison/comparators.js` should remain pure comparison logic.

It may format diffs, but it should not interpret gameplay behavior.

## 4) Performance Model: Lossless, Insight-Oriented

Session harness performance should improve by reducing overhead around comparisons, not
by reducing what is compared.

Allowed acceleration directions:

1. cheaper data plumbing (fewer redundant conversions/copies),
2. faster comparator internals with identical outputs,
3. better failure slicing/filtering that shortens time-to-diagnosis,
4. tight single-session debug runs that still preserve full-fidelity evidence,
5. bounded worker parallelism for independent sessions with unchanged per-session checks,
6. stream/emit first failure details immediately rather than waiting for full-suite completion.

Disallowed acceleration directions:

1. skipping channels (PRNG/typgrid/screen),
2. heuristic sampling of steps,
3. semantic-changing caches that hide divergence evidence.

---

## Required Core API Additions

Add or standardize APIs in core/headless runtime:

```javascript
class HeadlessGame {
    // Initialization
    static async start(seed, options);  // Full startup with all options
    // options: wizard, role/race/gender/align, start level context, symbol/runtime flags

    // Replay stepping
    async sendKey(key);                 // Execute one command/turn
    async sendKeys(keys);               // Execute multiple keys

    // State capture
    getTypGrid();                       // Current level typGrid (21x80)
    getScreen();                        // Current terminal screen (24x80)
    getAnsiScreen();                    // ANSI-encoded screen string

    // RNG instrumentation
    enableRngLogging();
    getRngLog();
    clearRngLog();

    // Wizard mode (for map sessions)
    teleportToLevel(depth);             // Ctrl+V equivalent
    revealMap();                        // Ctrl+F equivalent

    // Debugging
    checkpoint(phase);                  // Capture full state snapshot
}
```

Trace hooks (under `deps.hooks`) for step boundaries:
- `onStepStart`, `onCommandResult`, `onTurnAdvanced`, `onScreenRendered`,
  `onLevelChange`, `onReplayPrompt`

These hooks are observability only, not behavior overrides.

---

## Fidelity Model

Fidelity remains checked in three channels.

## PRNG

Per startup and per step:

1. Compare compact RNG calls with source tags ignored by default.
2. Preserve first divergence payload:
   - step index,
   - rng index,
   - expected call,
   - actual call,
   - optional stage/depth metadata.

## Typgrid

1. For map/special sessions, compare per-level grid with exact cell diffs.
2. Keep deterministic regeneration check for map sessions.

## Screen

1. Compare normalized screen rows per step.
2. Keep row-level first mismatch reporting.
3. Preserve support for ANSI normalization.

---

## Debuggability Requirements

When a session fails, output must still answer quickly:

1. Where did divergence start?
2. Is it startup or gameplay?
3. Is it RNG, grid, screen, or multiple channels?
4. What was the last matching step/key?

Required tooling outputs:

1. machine-readable JSON results bundle,
2. human summary with first divergence,
3. optional verbose trace mode by session/type filter.
4. no-loss evidence: if a run fails, logs retain the same fidelity channels used for pass/fail.

---

## Phased Plan

## Phase 0: Baseline Snapshot

1. Capture current session failure signatures and runtime timings.
2. Freeze a few sentinel sessions (chargen, gameplay, map, special, interface).
3. Capture baseline insight-speed metrics (time to first divergence report, artifact readability).

Exit criteria:

1. Baseline artifact exists for regression comparison.

## Phase 1: Consolidate Core Replay API

1. Finalize one init path and one step path in `HeadlessGame`.
2. Define structured replay-step return schema and hook contracts.
3. Add unit tests for replay-step invariants.

Exit criteria:

1. Core exposes stable replay API used by tests without harness gameplay imports.

## Phase 2: Migrate Map/Special Generation to Wizard-Core Path

1. Replace harness map generation loops with wizard-capable core level navigation.
2. Capture typgrid/screen/RNG through core accessors only.
3. Keep deterministic regeneration checks intact.

Exit criteria:

1. Map/special session execution no longer calls generation internals from harness.

## Phase 3: Migrate Startup/Chargen Semantics to Core Init

1. Replace startup helper emulation with `HeadlessGame.start(seed, options)`.
2. Ensure startup RNG and screen capture are produced by core, not harness heuristics.
3. Preserve chargen and interface startup fidelity checks.

Exit criteria:

1. Startup session categories run through one core init path.

## Phase 4: Move Replay Step Semantics into Core

Move behavior currently emulated in harness into core replay stepping:

1. pending input/prompt continuation semantics,
2. count-prefix handling,
3. staircase transition timing behavior,
4. message boundary behavior used for replay continuity.

Exit criteria:

1. Harness no longer contains replay turn/prompt semantics.

## Phase 5: Replace Harness Runtime Module with Thin Wiring

1. Remove gameplay logic from `test/comparison/session_runtime.js`.
2. Keep only thin adapter wiring or extract retained pure validators to a small utility module.
3. Ensure session runner flow is: load -> start -> step -> compare -> report.

Exit criteria:

1. `session_runtime.js` is deleted or reduced to a thin, game-unaware layer.

## Phase 6: Harden Comparators, Diagnostics, and Insight Speed

1. Keep strict PRNG/typgrid/screen fidelity checks.
2. Improve first-divergence diagnostics where currently vague.
3. Add single-session debug mode with full evidence capture.
4. Optimize comparator/runtime overhead only where outputs remain bit-for-bit equivalent.

Exit criteria:

1. Failure reports are at least as actionable as before and appear faster.

## Phase 7: Final Cleanup and Docs

1. Delete obsolete harness-only compatibility paths.
2. Update docs to describe the final core replay architecture.
3. Keep only three run categories (`unit`, `e2e`, `session`) in docs/scripts.
4. Remove any temporary migration toggles or split replay paths.

Exit criteria:

1. No harness game-awareness detritus remains.

---

## Acceptance Criteria (Final)

All must be true:

1. `npm run test:session` runs all session categories through one core replay path.
2. Harness does not implement game turn logic or command semantics.
3. PRNG, typgrid, and screen diffs retain per-step granularity.
4. Determinism checks remain for map generation replay.
5. Debug output can identify first divergence with step-level context.
6. Session runtime improvements do not reduce captured evidence quality.
7. No explicit feature-flagged replay split remains in final code.
8. `session_runtime.js` is deleted or reduced to a thin game-unaware adapter/validator layer.

---

## Risks and Mitigations

## Risk: Refactor reduces diagnostic quality

Mitigation:

1. Keep existing result bundle schema stable.
2. Add parity checks for diagnostic fields before deleting old paths.

## Risk: Hidden coupling in current replay heuristics

Mitigation:

1. Port behavior incrementally with sentinel sessions.
2. Land small, reviewable steps that keep one replay path live at all times.

## Risk: Overcomplicated migration scaffolding

Mitigation:

1. Allow temporary parity assertions in tests, but no second long-lived replay implementation.
2. Remove transitional helpers in the same phase they were introduced for.

## Risk: Core API churn breaks selfplay

Mitigation:

1. Move selfplay onto shared replay-safe runtime in parallel.
2. Add adapter contract tests in `test/unit`.

---

## Immediate Next Tasks

1. Add a replay-step contract test file under `test/unit`.
2. Introduce core replay hooks under `deps.hooks` with no behavior change.
3. Move one harness heuristic (count-prefix or pending prompt flow) into core and verify no regression in sentinel sessions.
