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

## 2026-02-18 - Keep: Early Dlvl2 Recovery Retreat for Low-XP Runs

- Change: in `selfplay/agent.js`, added an early Dlvl2 stabilization guard:
  - if on Dlvl2, `XP <= 1`, and HP is below max, path back to upstairs (allowing unexplored tiles on that retreat path) and ascend to recover before resuming riskier exploration.
- Why: one persistent holdout death pattern was early Dlvl2 collapse in low-XP states (notably seed 36) where small damage spikes converted to deterministic deaths before recovery.
- Validation gate: C role matrix, `turns=600`, `key-delay=0`, `train=21..33`, `holdout=31..43`.
- Train:
  - Baseline: survived `11/13`, avg depth `2.000`.
  - Candidate: survived `11/13`, avg depth `2.000`.
- Holdout:
  - Baseline (after locked-door improvement): survived `12/13`, avg depth `1.385`, XL2+ `1/13`.
  - Candidate: survived `13/13`, avg depth `1.385`, XL2+ `1/13`.
- Net: +1 holdout survival with no train regression and no depth regression; keep.

## 2026-02-18 - Keep: Low-XP Dlvl2 Retreat Triggers on Meaningful Damage (not Chip Damage)

- Change: in `selfplay/agent.js`, relaxed the low-XP Dlvl2 retreat trigger from `hpPercent < 1.0` to `hpPercent < 0.85` for `XP <= 1`.
- Why: the previous rule retreated upstairs after any chip damage, which protected survival but often over-constrained early Dlvl2 progression.
- Validation gate: C role matrix, `turns=600`, `key-delay=0`, `train=21..33`, `holdout=31..43`.
- Train:
  - Baseline: survived `11/13`, avg depth `2.000`, depth>=3 `4/13`, XL2+ `0/13`.
  - Candidate: survived `11/13`, avg depth `2.000`, depth>=3 `4/13`, XL2+ `0/13`.
- Holdout:
  - Baseline: survived `13/13`, avg depth `1.385`, depth>=3 `0/13`, XL2+ `1/13`, failedAdd `43.69`.
  - Candidate: survived `13/13`, avg depth `1.462`, depth>=3 `1/13`, XL2+ `1/13`, failedAdd `43.85`.
- Net: holdout progression improved with unchanged survival and no train regression; keep.

## 2026-02-18 - Keep: Cap Bulk Blacklisting During Stuck Recovery

- Change: in `selfplay/agent.js`, limited bulk failed-target blacklisting in stuck handlers to nearest cells only, and only counted blacklist additions when `_addFailedTarget(...)` inserted a new key.
  - Same-position stuck handler:
    - frontier blacklist now nearest `8` cells within distance `<=3` (instead of all within range),
    - search blacklist now nearest `6` cells within distance `<=3`.
  - High-stuck small-frontier handler:
    - frontier blacklist now nearest `10` cells within distance `<=5`,
    - search blacklist now nearest `6` cells within distance `<=3`.
- Why: broad local blacklisting was creating excessive failed-target churn and repeated retarget loops without improving survival/progression.
- Validation gate: C role matrix, `turns=600`, `key-delay=0`, `train=21..33`, `holdout=31..43`.
- Train:
  - Candidate: survived `11/13`, avg depth `2.000`, depth>=3 `4/13`, XL2+ `0/13`, failedAdd `23.69`.
- Holdout:
  - Baseline (current main): survived `13/13`, avg depth `1.462`, depth>=3 `1/13`, XL2+ `1/13`, noProg `2.31`, failedAdd `43.85`.
  - Candidate: survived `13/13`, avg depth `1.462`, depth>=3 `1/13`, XL2+ `1/13`, noProg `2.08`, failedAdd `36.92`.
- Net: no survival/progression regression with substantial failed-target churn reduction on holdout; keep.

## 2026-02-18 - Keep: XP Checkpoint Telemetry for 600-Turn Tuning

- Change:
  - `selfplay/runner/c_runner.js`: emit `XP checkpoints: t100=... t200=... t400=... t600=...`.
  - `selfplay/runner/c_role_matrix.js`: parse and summarize checkpoint XP (`avg t100/t200/t400/t600` and counts for `XP>=10`/`XP>=20` by turn 600).
- Why: survival at 600 turns was strong, but progression remained shallow; we needed explicit "XP by 600" telemetry to tune for throughput instead of only survival/depth/churn.
- Baseline evidence (holdout `31..43`, `turns=600`, `key-delay=0`):
  - Survived `13/13`, avg depth `1.462`, XL2+ `1/13`.
  - XP avg: `maxXP=8.23`, `t100=0.92`, `t200=1.77`, `t400=4.15`, `t600=8.23`.
  - XP by turn 600: `>=10` in `4/13`, `>=20` in `1/13`.
- Learning:
  - Current policy is better at shallow survival than XP throughput.
  - This creates a real long-run starvation risk if XP/kill pace does not improve.

## 2026-02-18 - Rejected: XL1 Favorable-Fight XP Push Variants

- Goal: increase XP accumulation by turn 600 (especially `XP>=10` and XL2+) by taking more early favorable fights.

- Variant A (broad, in `danger.js`): engage at XL1 on Dlvl1-2 for isolated (`nearby=0`) fights up to `MEDIUM` danger when HP >= 80%.
  - Holdout (`31..43`, 600 turns):
    - Survived `12/13` (regression vs `13/13` baseline),
    - XP avg `t600=6.92` (regression vs baseline `8.23`),
    - XP>=10 by 600: `3/13` (regression vs `4/13`),
    - XL2+ `0/13` (regression vs `1/13`).
  - Net: rejected.

- Variant B (narrow, in `agent.js`): force attack only for isolated `LOW`-danger adjacent monsters at XL1 with `XP<=2`, `HP>=90%`, Dlvl1.
  - Holdout (`31..43`, 600 turns):
    - Survived `12/13` (regression),
    - XP avg `t600=7.38` (regression),
    - XP>=10 by 600: `3/13` (regression),
    - XL2+ `1/13` (flat), depth avg `1.462` (flat).
  - Net: rejected.

- Combined learning:
  - Naive "fight more at XL1" rules reduced robustness and did not improve XP throughput in aggregate.
  - Next XP-focused attempts should be more context-aware (weapon readiness, monster class, path safety, and escape routes), not simple HP + adjacency gating.

## 2026-02-18 - Keep: Action-Mix Telemetry for XP Diagnosis

- Change:
  - `selfplay/runner/c_runner.js` now emits `Action telemetry` counts per run (attack/flee/explore/navigate/search/rest/wait/pickup, plus `xl1Attack` turns).
  - `selfplay/runner/c_role_matrix.js` parses those fields and reports matrix averages for `attack`, `flee`, and `xl1Attack`.
- Why:
  - XP checkpoint telemetry alone shows *outcome* (low XP throughput), but action-mix telemetry helps attribute *cause* (e.g., too little productive combat vs too much fleeing/navigation churn).
  - This supports evidence-driven XP-by-600 tuning without changing gameplay policy.

## 2026-02-19 - Keep: Non-Productive Combat Diagnostics (`reallyAttack`, `petSwap`)

- Change:
  - `selfplay/agent.js` now tracks:
    - `reallyAttackPrompts` (count of declined "Really attack?" prompts),
    - `petDisplacements` (count of detected pet swap displacements after attempted attack).
  - `selfplay/runner/c_runner.js` includes these in `Action telemetry` as:
    - `reallyAttack=<count>`,
    - `petSwap=<count>`.
  - `selfplay/runner/c_role_matrix.js` parses and summarizes both fields.
- Why:
  - High `attack` turns with low XP can come from non-productive pet/peaceful interactions rather than useful combat.
  - These counters provide direct evidence to distinguish true combat-pressure from prompt-loop waste before attempting policy changes.
- Evidence (held-out `31..43`, 600 turns):
  - Aggregate: `reallyAttack=0.00`, `petSwap=26.31` (avg per run), `attack=91.46`, `XP t600=8.23`.
  - Concentrated high-churn examples:
    - Tourist seed 41: `attack=272`, `petSwap=98`, `maxXP=0`.
    - Caveman seed 33: `attack=199`, `petSwap=57`, `maxXP=2`.
    - Valkyrie seed 42: `attack=187`, `petSwap=54`, `maxXP=5`.
  - Interpretation:
    - Current low-XP behavior in many runs is driven more by pet displacement churn than by `"Really attack?"` prompt loops.

## 2026-02-19 - Rejected: Pet-Loop Suppression Policy Variants

- Goal:
  - Reduce non-productive `petSwap` churn without regressing progression quality (`XL2+`, XP throughput) on holdout.

- Variant A (broad char-follow in `_updatePets`):
  - Policy:
    - After one displacement confirms a pet character, treat nearby monsters of that character as pets.
  - Holdout (`31..43`, 600 turns):
    - Survived `13/13` (flat),
    - Avg depth `1.615` (up vs `1.462` baseline),
    - XP avg `t600=8.62` (up vs `8.23`),
    - XP>=10 by 600: `6/13` (up vs `4/13`),
    - `petSwap=0.62` (down vs `26.31`),
    - but `XL2+ 0/13` (regression vs `1/13`),
    - and `failedAdd=54.77` (regression vs `36.92`).
  - Net:
    - Rejected due progression/churn tradeoff and loss of XL2 path.

- Variant B (narrow post-displacement lone `d/f/C` ignore on Dlvl1):
  - Policy:
    - After any pet displacement, ignore lone adjacent `d/f/C` on Dlvl1.
  - Quick triage (`Caveman 33`, `Healer 34`, `Tourist 41`, 600 turns):
    - Survived `3/3`,
    - Avg depth `1.000`,
    - `XL2+ 0/3`,
    - XP avg `t600=6.67`,
    - `petSwap=1.00`.
  - Net:
    - Rejected (Healer/Tourist progression regressed despite lower pet churn).

- Combined learning:
  - Reducing pet-swap churn alone is not sufficient; naive suppression tends to trade away meaningful combat/progression.
  - Next candidate should prioritize "productive combat selection" (target identity/confidence + path/progression context), not blanket pet-class avoidance.

## 2026-02-19 - Rejected: Evidence-Gated Pet-Loop Suppression (Train Regression)

- Goal:
  - Keep holdout improvements from lower `petSwap` churn while avoiding broad blanket pet-class suppression.

- Candidate policy:
  - In `selfplay/agent.js`, suppress lone Dlvl1 adjacent `d/f/C` combat only when loop evidence exists:
    - repeated recent pet displacements (`>=4` in a recent window),
    - sustained no-XP progress window,
    - XL1-only scope.
  - Added candidate-only telemetry (`petLoopIgnore`) during evaluation.

- Holdout A/B (`31..43`, 600 turns):
  - Baseline (main):
    - Survived `13/13`, avg depth `1.462`, XL2+ `1/13`,
    - XP avg `t600=8.23`, XP>=10 `4/13`,
    - petSwap `26.31`, failedAdd `36.92`.
  - Candidate:
    - Survived `13/13`, avg depth `1.462`, XL2+ `1/13`,
    - XP avg `t600=8.69`, XP>=10 `5/13`,
    - petSwap `12.00`, failedAdd `36.38`,
    - petLoopIgnore `43.46`.

- Train guardrail A/B (`21..33`, 600 turns):
  - Baseline (main):
    - Survived `11/13`, avg depth `2.000`, XL2+ `0/13`,
    - XP avg `t600=7.38`, XP>=10 `3/13`,
    - failedAdd `23.69`.
  - Candidate:
    - Survived `10/13` (regression),
    - Avg depth `1.923` (regression),
    - XL2+ `0/13` (flat),
    - XP avg `t600=7.54`,
    - XP>=10 `4/13`,
    - failedAdd `24.92` (regression).
  - Notable new failure:
    - Samurai seed 30 regressed to death with `maxXP=0`.

- Net:
  - Rejected due train-set survival/depth regression despite holdout-side pet-churn and XP improvements.

## 2026-02-19 - Rejected: Additional Pet-Loop Breakers (No Reliable Gain)

- Variant A (Dlvl1 stair-stagnation escape):
  - Policy:
    - In `_shouldDescendStairs()`, force descent on Dlvl1 when XP remained very low and `petDisplacements` was high while HP stayed moderate.
  - Quick triage (`Caveman 33`, `Healer 34`, `Tourist 41`, 600 turns):
    - No meaningful behavior change vs baseline on these seeds (Tourist remained `maxXP=0`, `petSwap=98`).
  - Net:
    - Rejected (insufficient impact).

- Variant B (short post-displacement flee cooldown):
  - Policy:
    - After confirmed pet displacement, temporarily bias lone Dlvl1 `d/f/C` encounters to flee for a few turns.
  - Quick triage (`Caveman 33`, `Healer 34`, `Tourist 41`, 600 turns):
    - Survived `3/3` (flat),
    - Avg depth `1.000` (flat),
    - XL2+ `0/3` (regression vs baseline `1/3`),
    - XP avg `t600=5.67` (regression),
    - petSwap `42.67` (improved vs `53.67` baseline subset),
    - failedAdd `50.67` (regression vs subset baseline `38.33`).
  - Net:
    - Rejected (progression and churn regressions despite lower pet-swap count).

- Variant C (pending-door follow-through broadening):
  - Policy:
    - In pending-door handling, treated both `door_closed` and `door_locked` as active targets and always attempted continued approach/open/kick until resolved.
  - Focus check (`Tourist 41`, 600 turns):
    - No observable change vs baseline:
      - `maxXP=0`, `petSwap=98`,
      - `doorOpen=0`, `doorKick=0`,
      - depth remained `1`.
  - Net:
    - Rejected (no measurable effect on target failure case).
