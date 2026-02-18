# Selfplay Learnings

## 2026-02-14 - Dlvl1 Dog Engagement Tweak (C NetHack)

- Change: in `selfplay/brain/danger.js`, treat lone adjacent `d` (dog) on Dlvl 1 as a fight target when HP >= 45%, instead of default passive/avoid behavior.
- Why: repeated early deaths were caused by dog pressure while yielding tempo/space.
- Validation gate: C runner, seeds `1..10`, `1200` turns, `key-delay=0`.
- Baseline: average depth `2.000`, survived `6/10`.
- Candidate: average depth `2.000`, survived `7/10`.
- Net: +1 survival with no depth regression.

## 2026-02-15 - Pre-Dlvl4 Descent Guard (C NetHack)

- Change: in `selfplay/agent.js` `_shouldDescendStairs()`, added a transition guard for Dlvl 3 -> Dlvl 4:
  - if HP < 75% and no healing potions, do not descend yet.
- Why: Dlvl 4 transition was a recurring spike death point (notably gnome-lord pressure) with no upside from forcing early descent.
- Validation gate: C runner, seeds `1..10`, `1200` turns, `key-delay=0`.
- Baseline: average depth `2.000`, survived `7/10`.
- Candidate: average depth `2.000`, survived `8/10`.
- Net: +1 survival with no depth regression.

## 2026-02-15 - Dlvl1 Stair-Pressure Descent Relaxation (C NetHack)

- Change: in `selfplay/agent.js`:
  - `_shouldDescendStairs()`: when on Dlvl 1, allow descent even with `3+` nearby monsters if HP >= 70% and max nearby danger is below `HIGH`.
  - Stair-stall fallback: force descent earlier under repeated "surrounded by N monsters" blocks on Dlvl 1 (threshold from HP>=75% & 8 repeats to HP>=65% & 4 repeats).
- Why: early-floor stair stalls under low-tier monster pressure can consume many turns and convert into avoidable deaths.
- Validation gate: C runner, seeds `1..10`, `1200` turns, `key-delay=0`.
- Baseline (current main): average depth `2.000`, survived `8/10`.
- Candidate: average depth `2.100`, survived `8/10`.
- Net: +0.1 average depth with unchanged survival.

## 2026-02-17 - Rejected: Late Dlvl1 Safe-Fight Budget (C Role Matrix Holdout)

- Attempted change: in `selfplay/agent.js`, added a bounded late-stall override to take selected "safe" solo fights on Dlvl 1 when XL1 and healthy, to force early XP gain.
- Validation gate: C role matrix, held-out seeds `31..40` (13-role sweep with seed cycling), `1200` turns, `key-delay=0`.
- Baseline: survived `8/13`, avg depth `1.385`, depth>=3 `1/13`, XL2+ `1/13`.
- Candidate: survived `7/13`, avg depth `1.308`, depth>=3 `0/13`, XL2+ `1/13`.
- Net: regression on survival and depth; strategy was reverted.

## 2026-02-17 - Harness Reliability Improvements (Kept)

- `selfplay/runner/c_runner.js`:
  - `--quiet` now suppresses high-volume internal agent logs during runs while preserving startup/summary output.
  - Impact: faster, parseable long-run evaluation output with unchanged game behavior.
- `selfplay/runner/c_role_matrix.js`:
  - increased subprocess `maxBuffer` to avoid output-buffer failures during long C runs.
  - improved failure diagnostics (`status`/`signal`/`error`) for subprocess failures.
  - default seed pools updated to unique 13-seed ranges (`train=21..33`, `holdout=31..43`) for class-balanced evaluations without seed cycling.

## 2026-02-17 - Keep: Early `x` Threat Upgrade in Danger Model

- Change: in `selfplay/brain/danger.js`, classify lowercase `x` monsters as at least `MEDIUM` threat and usually `HIGH` threat until stronger (`XL<4` or HP<80%).
- Why: repeated early deaths in held-out games involved `x` encounters being treated too casually.
- Validation gates (C NetHack role matrix, 1200 turns, key-delay=0):
  - Train `21..30`: unchanged vs baseline (`survived 7/13`, `avg depth 1.846`, `depth>=3 5/13`, `XL2+ 2/13`).
  - Holdout `31..40`: improved depth/progression with no survival regression (`survived 8/13` unchanged, `avg depth 1.462` vs `1.385`, `XL2+ 2/13` vs `1/13`).
- Net: keep.

## 2026-02-17 - Keep: Pet Displacement Detection Bug Fix

- Change: in `selfplay/agent.js` `_detectPetDisplacement()`, fixed action-type check from string comparison against `this.lastAction` to object field check `this.lastAction.type === 'attack'`.
- Why: `lastAction` is an action object; the old check always failed, so pet displacement was never detected, causing repeated false-hostile dog loops and exploration stalls.
- Validation gates (C role matrix, 1200 turns, key-delay=20):
  - Train A/B (`21..30`):
    - Baseline: `survived 7/13`, avg depth `~1.692`.
    - Candidate: `survived 10/13`, avg depth `~1.538`.
  - Holdout A/B (`31..40`):
    - Baseline: `survived 9/13`, avg depth `~1.231`.
    - Candidate: `survived 9/13`, avg depth `~1.385`.
- Net: significant train survival gain and holdout depth gain with no holdout survival regression; keep.

## 2026-02-18 - Keep: Stuck-State Locked-Door Approach (C Role Matrix)

- Change: in `selfplay/agent.js`, when `pendingLockedDoor` is set and we are clearly stuck with no downstairs found (`levelStuckCounter >= 80`, `stairsDown.length === 0`), actively path to an explored walkable tile adjacent to that locked door instead of passively waiting for other exploration logic.
- Why: in long Dlvl1 no-stairs runs, the agent was identifying locked doors but repeatedly abandoning them and dying during broad frontier sweeps.
- Validation gate: C role matrix, `turns=600`, `key-delay=0`, `train=21..33`, `holdout=31..43`.
- Train:
  - Baseline: survived `11/13`, avg depth `2.000`.
  - Candidate: survived `11/13`, avg depth `2.000`.
- Holdout:
  - Baseline: survived `11/13`, avg depth `1.385`, XL2+ `0/13`.
  - Candidate: survived `12/13`, avg depth `1.385`, XL2+ `1/13`.
- Net: +1 holdout survival with no train regression and no depth loss; keep.
