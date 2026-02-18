# RNG Audit Plan: CORE vs DISP Streams

> Plan hierarchy: This is a subordinate subplan to root [`PROJECT_PLAN.md`](../../PROJECT_PLAN.md).  
> If scope, priority, or milestone details conflict, `PROJECT_PLAN.md` is authoritative.

## Goal

Find and eliminate RNG divergence caused by missing or misplaced display-only RNG behavior, while avoiding unnecessary infrastructure churn.

## Ground Truth (C)

- C maintains two RNG streams in `nethack-c/src/rnd.c`:
  - `CORE` (`rn2`)
  - `DISP` (`rn2_on_display_rng`)
- The split is explicit in `nethack-c/src/rnd.c:170` and `nethack-c/src/rnd.c:216`.
- Both streams are initialized in startup via:
  - `init_random(rn2)`
  - `init_random(rn2_on_display_rng)`
  - See `nethack-c/src/options.c:7163`.

## Current JS Status (Audit Summary)

- JS now has explicit core/display stream primitives in `js/rng.js`:
  - `rn2` / `rnd` (core stream)
  - `rn2_on_display_rng` / `rnd_on_display_rng` (display stream)
- `initRng(seed)` seeds both streams to the same deterministic seed, matching C startup intent.
- `js/display.js` itself still does not call RNG directly.
- Most JS gameplay/display callsites are still on core RNG until individually ported to display-stream usage.

## C Display RNG Hotspots

Primary C files with `rn2_on_display_rng` / `newsym_rn2`:

- High density:
  - `nethack-c/src/display.c`
  - `nethack-c/src/detect.c`
  - `nethack-c/src/do_name.c`
- Also present in:
  - `nethack-c/src/dothrow.c`
  - `nethack-c/src/mthrowu.c`
  - `nethack-c/src/zap.c`
  - `nethack-c/src/invent.c`
  - `nethack-c/src/pickup.c`
  - `nethack-c/src/pray.c`
  - `nethack-c/src/role.c`
  - `nethack-c/src/worm.c`
  - and a few others.

Interpretation: most DISP RNG usage is in hallucination glyph/random-display paths, not core map generation.

## Audit Workflow

1. Run baseline session suite and capture first divergence per failing session.
2. Use `rng_step_diff.js` at the failing phase (`--phase startup` or `--step N`).
3. Classify divergence:
   - If map/logic state already differs, fix logic first (not DISP issue).
   - If state is aligned and divergence is around display/hallucination naming/glyph effects, treat as DISP suspect.
4. Run static grep checks:
   - C DISP callsites:
     - `rg -n "rn2_on_display_rng|newsym_rn2" nethack-c/src nethack-c/include -g'*.c' -g'*.h'`
   - JS display-adjacent RNG callsites:
     - `rg -n "rn2\\(|rnd\\(" js/display.js js/animations.js js/nethack.js js/headless_runtime.js js/pager.js -g'*.js'`
5. Port C behavior first, then re-run session tests and confirm no regressions.

## Decision Criteria: Do We Need DISP-Specific Logging Infrastructure?

Use this rule:

- Do **not** add full parallel logging if:
  - divergences are in core gameplay/map logic, or
  - DISP paths are not on the failing session path.
- Add lightweight DISP tracing if:
  - first divergence is repeatedly in display/hallucination-heavy paths across sessions, and
  - core state snapshots are otherwise aligned at divergence time.

## Recommended Implementation Strategy

Stage A (now):

- Keep existing RNG diagnostics (`rng_step_diff`, midlog, phase snapshots).
- Treat DISP as a targeted audit axis, not a blanket infra project.
- Continue direct C logic ports first.
- Use the new `rn2_on_display_rng` primitive only at confirmed C-equivalent callsites.

Stage B (only if DISP becomes a repeated root cause):

- Add optional tagged logging for DISP calls only (off by default), e.g. `drn2(...)`.
- Keep existing session JSON unchanged unless a DISP-specific debug capture is explicitly requested.

This keeps normal test runs stable and low-noise while enabling focused DISP debugging when needed.

## Practical Recommendation

At current maturity, DISP appears to be a secondary risk, not the primary source of special-level divergence.  
Recommendation: **no full new parallel infrastructure yet**. Use targeted DISP tracing only if repeated first-divergence evidence points there.
