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

## 2026-02-19 - Keep: Attack-Target Telemetry for Low-XP Loop Diagnosis

- Change:
  - `selfplay/agent.js` now tracks attack-target counters:
    - `attackPetClassTurns`,
    - `attackPetClassLowXpDlvl1Turns`,
    - `attackDogTurns`,
    - `attackDogLowXpDlvl1Turns`.
  - `selfplay/runner/c_runner.js` emits:
    - `Attack target telemetry: petClass=... petClassLowXpDlvl1=... dog=... dogLowXpDlvl1=...`.
  - `selfplay/runner/c_role_matrix.js` parses and summarizes these fields.
- Why:
  - Existing `attack` and `petSwap` totals show churn, but not whether attacks are concentrated on likely pet-class targets in low-XP Dlvl1 states.
  - This telemetry makes that distinction explicit so future policy changes can target the right failure mode.
- Evidence (smoke check: `Tourist 41`, 120 turns):
  - `attack=36`, `petSwap=6`,
  - `petClass=36`, `petClassLowXpDlvl1=36`,
  - `dog=36`, `dogLowXpDlvl1=36`,
  - `maxXP=0`.
  - Interpretation:
    - In this known failure case, early attacks are fully concentrated on low-XP Dlvl1 dog targets.
- Evidence (holdout `31..43`, 600 turns):
  - Attack target avg:
    - `petClass=88.08`,
    - `petClassLowXpDlvl1=68.08`,
    - `dog=88.08`,
    - `dogLowXpDlvl1=68.08`.
  - High low-XP Dlvl1 dog concentration examples:
    - Tourist 41: `dogAtkLow=272/272`, `maxXP=0`.
    - Valkyrie 42: `dogAtkLow=186/187`, `maxXP=5`.
    - Samurai 40: `dogAtkLow=142/145`, `maxXP=2`.
    - Caveman 33: `dogAtkLow=177/199`, `maxXP=2`.
  - Counterexample:
    - Priest 37: high dog attacks (`dogAtk=140`) but `dogAtkLow=0` with `maxXP=8`.
  - Interpretation:
    - The main pathology is specifically low-XP Dlvl1 dog-target attack concentration, not all dog combat.

## 2026-02-19 - Rejected: Dog-Loop Escape Policy Variants

- Variant A (hard dog-loop escape to flee):
  - Policy:
    - On Dlvl1 with `XP=0`, no nearby crowding, high stuck counter, and high `dogAtkLowXpDlvl1`, force disengage/flee from adjacent dog.
  - Focus check (`Tourist 41`, 600 turns):
    - Progression improved (`maxXP=6`, depth reached `2`) but survival regressed (died on Dlvl2 at turn 556).
  - Net:
    - Rejected (survival regression).

- Variant B (late-only hard escape thresholds):
  - Policy:
    - Same idea with much stricter late trigger (`turn>=350`, high HP, much higher counters).
  - Focus check (`Tourist 41`, 600 turns):
    - No progression gain (`maxXP=0`), increased churn (`flee=124`, `petSwap=80`).
  - Net:
    - Rejected (no gain, churn worse).

- Variant C (post-pet-swap short wait cooldown):
  - Policy:
    - After pet displacement, wait briefly before re-engaging adjacent lone pet-class monsters on Dlvl1.
  - Quick triage (`Caveman 33`, `Healer 34`, `Tourist 41`, 600 turns):
    - Survived `3/3` (flat),
    - Avg depth `1.000` (flat),
    - XL2+ `0/3` (regression vs baseline `1/3`),
    - XP avg `t600=5.33` (regression),
    - Tourist still near-stalled (`maxXP=1`),
    - Healer regressed (`XL2` lost; `maxXP=10` vs baseline `21`).
  - Net:
    - Rejected (progression regression).

- Variant D (single displaced-pet continuity tracking):
  - Policy:
    - Track one displaced pet entity by local position continuity and treat it as pet to prevent repeat attacks.
  - Quick triage (`Caveman 33`, `Samurai 40`, `Tourist 41`, `Healer 34`, 600 turns):
    - Some seed improvements (e.g., Caveman `maxXP=14`, Tourist depth `2`),
    - but critical regression on control seed:
      - Healer dropped from baseline `maxXP=21`/XL2 to `maxXP=2`/no XL2.
  - Net:
    - Rejected (unacceptable regression on control seed).

- Variant E (tracker only under severe loop evidence):
  - Policy:
    - Same continuity tracker, but only applied when low-XP Dlvl1 dog-loop counters were already high.
  - Quick triage (`Caveman 33`, `Samurai 40`, `Tourist 41`, `Healer 34`, 600 turns):
    - Survived `4/4` (flat), XL2+ `1/4` (flat),
    - XP avg `t600=7.50` (flat-ish),
    - but severe churn regression:
      - failedAdd avg `85.50` (vs baseline subset ~`41.25`),
      - Caveman failedAdd `195`.
  - Net:
    - Rejected (major exploration churn regression).

## 2026-02-19 - Rejected: Additional Stuck/Loop Mitigation Variants

- Variant F (door-first bias during severe low-XP dog loops):
  - Policy:
    - In adjacent-combat handling, when `Dlvl1 + XP=0 + lone dog` loop evidence was high, prefer opening/kicking adjacent doors before attacking.
  - Triage (`Caveman 33`, `Samurai 40`, `Tourist 41`, `Healer 34`, 600 turns):
    - Tourist reduced dog-loop churn (`attack 215` vs baseline `272`, `petSwap 71` vs `98`) and attempted door actions (`doorOpen=1`, `doorKick=1`),
    - but Tourist progression remained stalled (`maxXP=0`, depth `1`),
    - aggregate progression remained flat on subset (`XL2+ 1/4`, XP avg `6.25` unchanged).
  - Net:
    - Rejected (no meaningful progression gain despite local churn reduction).

- Variant G (failed random-move direction memory):
  - Policy:
    - Record blocked `random_move` directions per tile and avoid retrying those directions while alternatives exist.
  - Triage (`Caveman 33`, `Samurai 40`, `Tourist 41`, `Healer 34`, 600 turns):
    - severe control regressions:
      - Healer lost XL2 path (`maxXP=2` vs baseline `21`, `XL2=never`),
      - Caveman/Samurai failed-target churn spiked (`failedAdd 143/103`),
      - subset XP average collapsed to `2.00` (vs baseline subset `6.25`),
      - `XL2+` dropped to `0/4` (vs baseline subset `1/4`).
  - Net:
    - Rejected (major progression regression).

## 2026-02-19 - Keep: Dog-Loop Door-Opportunity Telemetry

- Change:
  - `selfplay/agent.js` now tracks three additional counters:
    - `lowXpDogLoopTurns`: turns with lone adjacent `d` while `Dlvl1`, `XL1`, `XP=0`.
    - `lowXpDogLoopDoorAdjTurns`: subset of those turns with adjacent cardinal `door_closed/door_locked`.
    - `attackLowXpDogLoopDoorAdjTurns`: subset where the chosen action was `attack`.
  - `selfplay/runner/c_runner.js` emits:
    - `Dog loop telemetry: lowXpDogLoop=... doorAdj=... attackDoorAdj=...`.
  - `selfplay/runner/c_role_matrix.js` parses and summarizes these fields.

- Why:
  - We tested door-prioritization variants for low-XP dog loops, but lacked direct evidence of how often door opportunities actually co-occurred with loop turns.
  - This telemetry separates:
    - loop prevalence,
    - door-opportunity prevalence,
    - attack decisions made despite such opportunities.

- Evidence (holdout `31..43`, 600 turns):
  - Core metrics unchanged vs baseline:
    - survived `13/13`, avg depth `1.462`, XL2+ `1/13`, XP t600 avg `8.23`.
  - New dog-loop telemetry:
    - avg `lowXpDogLoop=41.62`,
    - avg `doorAdj=0.15`,
    - avg `attackDoorAdj=0.15`.
  - Key seeds:
    - Tourist 41: `lowXpDogLoop=272`, `doorAdj=2`, `attackDoorAdj=2`, `maxXP=0`.
    - Samurai 40: `142/0/0`, `maxXP=2`.
    - Valkyrie 42: `88/0/0`, `maxXP=5`.

- Learning:
  - Severe low-XP dog loops are common, but they almost never coincide with adjacent closed/locked doors.
  - This suggests door-first dog-loop interventions have limited headroom in current failure cases.
  - Next policy work should target non-door loop escape/progression mechanisms.

## 2026-02-19 - Keep: Dog-Loop Blocking vs Non-Blocking Telemetry

- Change:
  - Expanded dog-loop telemetry to split low-XP Dlvl1 lone-dog loop turns by path context:
    - `lowXpDogLoopBlockingTurns`
    - `lowXpDogLoopNonBlockingTurns`
    - `attackLowXpDogLoopBlockingTurns`
    - `attackLowXpDogLoopNonBlockingTurns`
  - `selfplay/runner/c_runner.js` now emits these in `Dog loop telemetry`.
  - `selfplay/runner/c_role_matrix.js` parses and summarizes these fields.

- Why:
  - Door-opportunity telemetry showed door-adjacent interventions have little headroom.
  - We needed to know whether loop attacks happen mostly when dogs are truly path-blocking or also in discretionary (non-blocking) states.

- Evidence (holdout `31..43`, 600 turns):
  - Survived `13/13`, avg depth `1.538`, XL2+ `1/13`, XP t600 avg `8.92`.
  - Dog-loop split:
    - `lowXpDogLoop=41.62`,
    - `blocking=21.15`,
    - `nonBlocking=20.46`,
    - `attackBlocking=21.15`,
    - `attackNonBlocking=20.46`.
  - Key seeds:
    - Tourist 41: `dogLoop 272`, `blocking 121`, `nonBlocking 151` (attacks in both contexts).
    - Samurai 40: `142 = 75 blocking + 67 nonBlocking`.

- Learning:
  - Low-XP dog-loop attacks are not only forced/path-blocking; a substantial share occur in non-blocking contexts.
  - This creates a plausible policy lever, but any suppression must pass train and holdout gates.

## 2026-02-19 - Rejected: Non-Blocking Dog-Loop Attack Suppression

- Candidate policy:
  - In `selfplay/agent.js`, when in low-XP Dlvl1 lone-dog loop context and **not** path-blocked, skip attacks after loop evidence accumulates (`turn>=80` and displacement/attack thresholds).

- Holdout (`31..43`, 600 turns):
  - Candidate showed local churn reductions in target seeds (for example Tourist/Samurai attack-turn drops), with held-out aggregate survival unchanged.
  - However, train gate did not hold robustly.

- Train gate (`21..33`, 600 turns):
  - Baseline (same telemetry stack, no policy): survived `11/13`, avg depth `2.000`.
  - Candidate: survived `10/13`, avg depth `1.846`.
  - Notable train failures under candidate included additional deaths and weaker progression consistency.

- Net:
  - Rejected due train-set regression despite some holdout-side churn improvements.

## 2026-02-19 - Rejected: Stricter Late-Loop Non-Blocking Suppression

- Candidate policy:
  - More conservative non-blocking suppression:
    - only in low-XP Dlvl1 lone-dog context,
    - non-blocking only,
    - no adjacent blocked door,
    - no downstairs found,
    - late + stuck + healthy + severe loop evidence
      (`turn>=140`, `levelStuckCounter>=50`, `HP>=90%`, high displacement/dog-loop counters).

- Subset triage (`Caveman 33`, `Samurai 40`, `Tourist 41`, `Healer 34`, 600 turns):
  - Survival/control stayed flat (`4/4`, XL2+ `1/4`),
  - churn reduced (`attack 137.25` vs baseline subset `162.25`, `petSwap 38.00` vs `47.50`),
  - but progression stayed flat and exploration churn worsened in target case
    (Tourist `failedAdd 71` vs baseline `54`).

- Holdout gate (`31..43`, 600 turns):
  - Survival unchanged (`13/13`), but progression regressed:
    - avg depth `1.462` (vs baseline `1.538`),
    - XP t600 avg `7.92` (vs baseline `8.92`),
    - XP>=10 by 600 `4/13` (vs baseline `5/13`).
  - Churn improved (`attack 82.77` vs `89.54`, `petSwap 22.92` vs `25.85`) but not enough to offset progression loss.

- Net:
  - Rejected at holdout gate (progression regression despite lower churn).

## 2026-02-19 - Keep: Dlvl1-Scoped Tighter Bulk Blacklist Limits

- Change:
  - In `selfplay/agent.js`, reduced bulk failed-target blacklisting counts in the two stuck handlers only while on `Dlvl1`:
    - same-position stuck (`turnsAtSamePosition >= 20`):
      - frontier slice `8 -> 5`
      - search-candidate slice `6 -> 3`
    - high-stuck small-frontier (`levelStuckCounter > 100` and `frontier <= 30`):
      - frontier slice `10 -> 6`
      - search-candidate slice `6 -> 3`
  - On deeper levels, existing limits remain unchanged (`8/6` and `10/6`).

- Why:
  - `#16` churn hotspots are dominated by Dlvl1 loops.
  - Broadly tightening limits at all depths reduced churn but regressed depth-3 XP runs.
  - Scoping the tighter caps to Dlvl1 keeps the churn win where needed while preserving deeper-level behavior.

- Validation gate: C role matrix, `turns=600`, `key-delay=0`.

- Holdout (`31..43`) vs current baseline:
  - Baseline: survived `13/13`, avg depth `1.462`, depth>=3 `1/13`, XL2+ `1/13`, XP t600 `8.23`, XP>=10 `4/13`, failedAdd `36.92`.
  - Candidate: survived `13/13`, avg depth `1.462`, depth>=3 `1/13`, XL2+ `1/13`, XP t600 `8.54`, XP>=10 `5/13`, failedAdd `30.85`.

- Train (`21..33`) vs current baseline:
  - Baseline: survived `11/13`, avg depth `2.000`, depth>=3 `4/13`, XL2+ `0/13`, failedAdd `23.69`.
  - Candidate: survived `11/13`, avg depth `2.077`, depth>=3 `4/13`, XL2+ `0/13`, failedAdd `21.77`.

- Net:
  - Keep.
  - Meets the #16 churn target (`failedAdd` below `39.08 * 0.8`) with no survival regression.
  - Depth/XL progression guardrails remained non-regressive, and holdout XP-by-600 throughput improved.

## 2026-02-19 - Rejected: Sparse Non-Blocking Reposition Escape

- Candidate policy:
  - In low-XP Dlvl1 lone-dog loop context, when not path-blocked and no nearby door/stairs signal, occasionally force `random_move` reposition (`turn % 4 === 0`) after non-blocking attack-loop evidence accumulates.

- Holdout A/B (`31..43`, 600 turns, clean single-process runs):
  - Baseline: survived `13/13`, avg depth `1.462`, XP t600 avg `8.23`.
  - Candidate: survived `13/13`, avg depth `1.538`, XP t600 avg `8.38`.
  - Candidate reduced loop pressure:
    - `lowXpDogLoop` `41.62 -> 33.23`,
    - `attackNonBlocking` `20.46 -> 13.77`.
  - Seed-level mix:
    - improvements: Samurai 40 (`maxXP 2 -> 7`), Tourist 41 loop reduction (`272 -> 168`);
    - regression: Valkyrie 42 (`maxXP 5 -> 2`).

- Train A/B (`21..33`, 600 turns, same gate):
  - Baseline: survived `11/13`, avg depth `2.000`, XP t600 avg `7.38`.
  - Candidate: survived `11/13`, avg depth `1.769`, XP t600 avg `6.62`.
  - Major regressions:
    - Barbarian 22 (`maxXP 6 -> 1`),
    - Ranger 28 (`maxXP 6 -> 1`),
    - both with increased dog-loop counters.

- Net:
  - Rejected. Holdout gained slightly, but train progression regressed materially.
  - Keep as a documented negative result; do not ship policy.

## 2026-02-19 - Keep: Variance-Aware Role Matrix Repeats

- Change:
  - Added `--repeats=N` to `selfplay/runner/c_role_matrix.js`.
  - Added `--exclusive/--no-exclusive` lock control to prevent accidental overlapping matrix runs.
  - Added `--json-out=PATH` to write full machine-readable evaluation artifacts.
  - The runner now executes each role/seed assignment `N` times, prints:
    - overall summary over all runs,
    - per-assignment aggregate summary (when `N > 1`),
    - repeat-variance diagnostics (count and ranges for assignments that differ across repeats),
    - per-run rows with `repeat=K`.

- Why:
  - Recent selfplay checks showed meaningful run-to-run variance on some seeds.
  - Single-run gates can overfit to noise; repeated samples improve signal quality for policy decisions.

- Validation:
  - `node --check selfplay/runner/c_role_matrix.js`
  - Smoke test:
    - `node selfplay/runner/c_role_matrix.js --mode=custom --seeds=40 --roles=Samurai --turns=120 --key-delay=0 --quiet --repeats=2`
    - `node selfplay/runner/c_role_matrix.js --mode=custom --seeds=40 --roles=Samurai --turns=60 --key-delay=0 --quiet --repeats=2 --json-out=/tmp/role_matrix_smoke.json`
  - Confirmed new aggregate + per-run outputs render correctly.

- Usage guidance:
  - Keep default `--exclusive` to avoid contaminated concurrent runs.
  - Keep default `--repeats=1` for fast iteration.
  - Use `--repeats=2` or `3` before commit decisions when candidate deltas are small.
  - Use `--no-exclusive` only when intentionally running multiple matrices in parallel.

## 2026-02-19 - Rejected: Secret-Search Cooldown Clock Fix

- Candidate:
  - In `selfplay/agent.js`, switched secret-search cooldown checks from `turnCount` to `turnNumber`.

- Holdout A/B (`31..43`, 600 turns, fresh current baseline):
  - Baseline: survived `13/13`, avg depth `1.462`, XP t600 `8.54`, failedAdd `30.85`.
  - Candidate: survived `13/13`, avg depth `1.462`, XP t600 `7.77`, failedAdd `31.62`.

- Net:
  - Rejected for now (progression regression without churn benefit).
  - Keep current behavior until a follow-up fix can improve this path without hurting holdout throughput.

## 2026-02-19 - Keep: Message-Aware Pet-Swap Telemetry

- Change:
  - In `selfplay/agent.js`, extended `_detectPetDisplacement()` to treat message text containing `"swap places with"` as a first-class pet-swap signal.
  - Kept geometric displacement detection as a fallback and deduplicated counting when both signals fire on the same turn.
  - On message-detected swaps, now record refused-attack position at the previous player tile immediately.

- Why:
  - Geometry-only detection undercounted repeated pet swaps in churn-heavy seeds when visibility/order timing obscured the displaced pet position.
  - We need `petSwap` telemetry to be reliable before using it as a tuning signal.

- Validation:
  - `node --check selfplay/agent.js`
  - `node --test selfplay/test/danger.test.js`
  - Baseline vs candidate A/B with JSON artifacts:
    - Holdout baseline: `/tmp/holdout_baseline_20260219b.json`
    - Holdout candidate: `/tmp/holdout_candidate_swapmsg_20260219.json`
    - Train baseline: `/tmp/train_baseline_20260219b.json`
    - Train candidate: `/tmp/train_candidate_swapmsg_20260219.json`
  - Core gameplay outcomes were unchanged on both sets:
    - Holdout: survived `13/13`, avg depth `1.462`, XL2+ `1/13`, XP t600 `8.54`, failedAdd `30.85`.
    - Train: survived `11/13`, avg depth `2.077`, XL2+ `0/13`, XP t600 `6.85`, failedAdd `21.77`.
  - Telemetry correction observed as expected:
    - Holdout `avg petSwap`: `26.62 -> 78.00`
    - Train `avg petSwap`: `19.00 -> 61.54`

- Net:
  - Keep as an observability accuracy improvement (no policy-behavior change, no train/holdout regression).

## 2026-02-19 - Keep: Role-Matrix JSON A/B Comparator with Guardrails

- Change:
  - Added `selfplay/runner/c_role_matrix_diff.js` to compare two `c_role_matrix --json-out` artifacts.
  - Added `selfplay/test/role_matrix_diff.test.js` for guardrail and comparability checks.
  - Comparator reports:
    - summary metric deltas (`candidate - baseline`),
    - default guardrails (survival/depth/XL2/XP non-regression and `failedAdd` non-increase),
    - run-level changed-row counts,
    - top per-assignment regressions/improvements.
  - Added comparability enforcement:
    - fails when baseline/candidate assignment sets differ (e.g., comparing a 13-run matrix to a 7-run triage).
  - Added `--overlap-only` mode for subset triage:
    - compares only overlapping role/seed assignments,
    - recomputes summary/guardrails on overlap scope,
    - still fails if overlap is empty or scoped run counts are misaligned.
  - Added optional action-mix guardrails via `--include-action-guardrails`:
    - `avgAttack` must not increase,
    - `avgFlee` must not increase.
  - Refined top-row scoring so the same assignment is not listed as both regression and improvement.

- Why:
  - We already generate machine-readable matrix artifacts, but candidate acceptance was still mostly manual.
  - This makes train/holdout gate decisions faster, more reproducible, and less error-prone.

- Validation:
  - `node --check selfplay/runner/c_role_matrix_diff.js`
  - `node --check selfplay/test/role_matrix_diff.test.js`
  - `node --test selfplay/test/role_matrix_diff.test.js`
  - Real-data smoke:
    - `node selfplay/runner/c_role_matrix_diff.js --baseline=/tmp/holdout_baseline_20260219b.json --candidate=/tmp/holdout_candidate_swapmsg_20260219.json --top=3` (PASS)
    - `node selfplay/runner/c_role_matrix_diff.js --baseline=/tmp/holdout_baseline_20260219b.json --candidate=/tmp/candidate_dogswap_gate2_triage_20260219.json --top=3` (FAIL with assignment mismatch details)
    - `node selfplay/runner/c_role_matrix_diff.js --baseline=/tmp/holdout_baseline_20260219b.json --candidate=/tmp/candidate_dog_bypass_triage_20260219.json --overlap-only --top=5` (subset guardrail evaluation on overlap scope)
    - `node selfplay/runner/c_role_matrix_diff.js --baseline=/tmp/baseline_triage_7seed_20260219c.json --candidate=/tmp/candidate_triage_7seed_20260219c.json --include-action-guardrails --top=7` (fails on flee regression)

- Usage:
  - `node selfplay/runner/c_role_matrix_diff.js --baseline=<baseline.json> --candidate=<candidate.json> --top=8`
  - For subset triage comparisons:
    - `node selfplay/runner/c_role_matrix_diff.js --baseline=<baseline.json> --candidate=<subset-candidate.json> --overlap-only --top=8`
  - To also gate action-mix regressions:
    - append `--include-action-guardrails`
  - Optional machine-readable diff export:
    - `--json-out=/tmp/role_matrix_diff.json`

## 2026-02-19 - Rejected: Late Non-Blocking Lone-Dog Loop Escape (Strict Gate)

- Candidate policy:
  - In low-XP Dlvl1 lone-dog context, when non-blocking and after strong late-loop evidence (`turn>=180`, high loop/non-blocking attack counters, high `petSwap`), force movement/exploration instead of attacking.

- 7-seed triage A/B (`roles/seeds=Samurai40,Tourist41,Valkyrie42,Caveman33,Ranger28,Rogue29,Healer34`, `turns=600`):
  - Baseline: survived `7/7`, avg depth `1.143`, XL2+ `1/7`, XP t600 `5.57`, failedAdd `34.29`, attack `186.57`, flee `35.71`.
  - Candidate: survived `7/7`, avg depth `1.143`, XL2+ `1/7`, XP t600 `5.57`, failedAdd `33.43`, attack `168.57`, flee `69.86`.
  - Seed-level shifts:
    - Samurai 40: `maxXP 0 -> 1` but `failedAdd 38 -> 44`.
    - Rogue 29: `failedAdd 38 -> 26` but `maxXP 5 -> 4` and `flee 11 -> 246`.

- Net:
  - Rejected and reverted.
  - No progression gain on the triage gate; action mix destabilized (large flee spike).

## 2026-02-19 - Rejected: Lone-Dog Non-Blocking Ignore (Danger-Layer) + Retreat-Gate Follow-Up

- Baseline reference (`7-seed triage`, 600 turns):
  - Command:
    - `node selfplay/runner/c_role_matrix.js --mode=custom --roles=Samurai,Tourist,Valkyrie,Caveman,Ranger,Rogue,Healer --seeds=40,41,42,33,28,29,34 --turns=600 --key-delay=0 --quiet --json-out=/tmp/baseline_triage_7seed_20260219d.json`
  - Summary:
    - survived `7/7`, avg depth `1.143`, XL2+ `1/7`, XP t600 `5.57`,
    - failedAdd `34.29`, attack `186.57`, flee `35.71`.

- Candidate A (reverted):
  - Change:
    - In `selfplay/brain/danger.js`, lone Dlvl1 dog handling was changed so non-blocking encounters are ignored rather than engaged.
    - Blocking-dog behavior remained engage-when-healthy / flee-when-weak.
  - Triage artifact:
    - `/tmp/candidate_triage_7seed_20260219e.json`

- Candidate B follow-up (reverted):
  - Additional change on top of Candidate A:
    - In `selfplay/agent.js`, added a lone-non-blocking-dog exception in early retreat hostiles calculation (plus shared blocking helper), to prevent retreat preemption from overriding tactical ignore behavior.
  - Triage artifact:
    - `/tmp/candidate_triage_7seed_20260219f.json`

- Result:
  - Candidate B was identical to Candidate A on this triage set (no measurable behavioral change from the retreat-gate tweak).
  - Baseline vs candidate (diff command):
    - `node selfplay/runner/c_role_matrix_diff.js --baseline=/tmp/baseline_triage_7seed_20260219d.json --candidate=/tmp/candidate_triage_7seed_20260219f.json --include-action-guardrails --top=7 --json-out=/tmp/triage_diff_7seed_20260219f.json`
  - Candidate summary:
    - survived `7/7`, avg depth `1.286`, XL2+ `0/7`, XP t600 `4.71`,
    - failedAdd `38.71`, attack `97.14`, flee `95.86`.
  - Guardrails failed on:
    - XL2+ (`1 -> 0`),
    - XP t600 (`5.57 -> 4.71`),
    - failedAdd (`34.29 -> 38.71`),
    - avgFlee (`35.71 -> 95.86`).

- Net:
  - Rejected and reverted.
  - Suppressing non-blocking lone-dog attacks at this layer reduced attack volume but shifted behavior into high-flee/low-progression patterns on the triage gate.

## 2026-02-19 - Keep: Flee-Cause Telemetry Through Runner/Matrix/Diff

- Change:
  - Added flee-cause counters in `selfplay/runner/c_runner.js` and emitted:
    - `hpEmergency`
    - `dlvl2Retreat`
    - `toUpstairs`
    - `oscillation`
    - `danger`
    - `other`
  - Extended `selfplay/runner/c_role_matrix.js` parsing/output/JSON with per-run and averaged flee-cause fields.
  - Extended `selfplay/runner/c_role_matrix_diff.js` summary deltas to include flee-cause averages.

- Why:
  - `avgFlee` alone is not enough to diagnose regressions.
  - Recent rejected candidates showed major flee spikes; we need to distinguish:
    - HP-emergency retreat inflation,
    - upstairs-routing retreat inflation,
    - tactical danger-flee inflation,
    - oscillation escape behavior.

- Validation:
  - `node --check selfplay/runner/c_runner.js`
  - `node --check selfplay/runner/c_role_matrix.js`
  - `node --check selfplay/runner/c_role_matrix_diff.js`
  - `node --test selfplay/test/role_matrix_diff.test.js`
  - Smoke:
    - `node selfplay/runner/c_runner.js --seed=41 --turns=120 --role=Tourist --key-delay=0 --quiet`
    - `node selfplay/runner/c_role_matrix.js --mode=custom --roles=Tourist --seeds=41 --turns=120 --key-delay=0 --quiet --json-out=/tmp/role_matrix_smoke_flee_20260219.json`
    - `node selfplay/runner/c_role_matrix_diff.js --baseline=/tmp/role_matrix_smoke_flee_20260219.json --candidate=/tmp/role_matrix_smoke_flee_20260219.json --top=2`

- Example (smoke output):
  - `flee=26` decomposed to:
    - `hpEmergency=18`
    - `dlvl2Retreat=0`
    - `toUpstairs=0`
    - `oscillation=0`
    - `danger=8`
    - `other=0`

- Net:
  - Keep as behavior-neutral observability infrastructure for #15 triage.

## 2026-02-19 - Keep: Optional Flee-Cause Guardrails in Matrix Diff

- Change:
  - Extended `selfplay/runner/c_role_matrix_diff.js` with optional `--include-flee-cause-guardrails`.
  - New optional guardrails gate non-increase of:
    - `avgFleeHpEmergency`
    - `avgFleeDlvl2Retreat`
    - `avgFleeToUpstairs`
    - `avgFleeOscillation`
    - `avgFleeDanger`
    - `avgFleeOther`
  - Kept default behavior unchanged (these guardrails are opt-in).

- Why:
  - After adding flee-cause telemetry, we needed a fast acceptance gate for candidates
    that preserve total outcomes but regress into higher-risk flee compositions.
  - This lets triage fail quickly when regression shifts are hidden inside flat `avgFlee`.

- Validation:
  - `node --check selfplay/runner/c_role_matrix_diff.js`
  - `node --check selfplay/test/role_matrix_diff.test.js`
  - `node --test selfplay/test/role_matrix_diff.test.js`
  - Smoke:
    - `node selfplay/runner/c_role_matrix_diff.js --baseline=/tmp/role_matrix_smoke_flee_20260219.json --candidate=/tmp/role_matrix_smoke_flee_20260219.json --include-flee-cause-guardrails --top=2`

- Net:
  - Keep as behavior-neutral triage hardening for selfplay candidate evaluation.

## 2026-02-19 - Keep: Attack-Decision Telemetry Through Runner/Matrix/Diff

- Change:
  - Added `Attack decision telemetry` in `selfplay/runner/c_runner.js`:
    - `fleeLoopBreak`
    - `forced`
    - `blocking`
    - `loneDog`
    - `other`
  - Extended `selfplay/runner/c_role_matrix.js` parsing/output/JSON with:
    - per-run attack-decision counters,
    - matrix averages for each attack-decision class.
  - Extended `selfplay/runner/c_role_matrix_diff.js` summary deltas to include attack-decision averages.

- Why:
  - We already track attack volume, but not attack quality/cause.
  - For #15 tuning, we need to distinguish:
    - productive engagement,
    - forced/cornered attacks,
    - loop-break attacks,
    - lone-dog concentration.
  - This improves triage precision without changing policy behavior.

- Validation:
  - `node --check selfplay/runner/c_runner.js`
  - `node --check selfplay/runner/c_role_matrix.js`
  - `node --check selfplay/runner/c_role_matrix_diff.js`
  - `node --test selfplay/test/role_matrix_diff.test.js`
  - Smoke:
    - `node selfplay/runner/c_runner.js --seed=41 --turns=120 --role=Tourist --key-delay=0 --quiet`
    - `node selfplay/runner/c_role_matrix.js --mode=custom --roles=Tourist --seeds=41 --turns=120 --key-delay=0 --quiet --json-out=/tmp/role_matrix_smoke_attacktele_20260219.json`
    - `node selfplay/runner/c_role_matrix_diff.js --baseline=/tmp/role_matrix_smoke_attacktele_20260219.json --candidate=/tmp/role_matrix_smoke_attacktele_20260219.json --top=2`

- Example (smoke output):
  - `attack=36` decomposed to:
    - `fleeLoopBreak=0`
    - `forced=0`
    - `blocking=0`
    - `loneDog=36`
    - `other=0`

- Net:
  - Keep as behavior-neutral observability infrastructure for candidate triage.

## 2026-02-19 - Rejected: Pet-Confirmed Non-Blocking Suppression + Blocking Periodic Flee

- Goal:
  - Suppress the low-XP Dlvl1 blocking dog loop without destroying the natural oscillation-flee escape cycle that allows exploration windows.

- Context:
  - 7-seed triage baseline (`Samurai40, Tourist41, Valkyrie42, Caveman33, Ranger28, Rogue29, Healer34`, 600 turns):
    - survived `7/7`, avg depth `1.143`, XL2+ `1/7`, XP t600 `5.57`.
    - Key cases: Healer34 `maxXP=21` (XL2), Ranger28 `maxXP=6` depth 2, Rogue29 `maxXP=5`.

- Key insight on baseline mechanics:
  - The baseline's oscillation-flee mechanism creates "dog-free" exploration windows through a natural cycle:
    - 8 blocking dog attacks → positions bounce → oscillation detected → hold 3 turns → flee.
  - This cycle was responsible for much of the wild-monster XP in Healer/Ranger/Rogue seeds.

- Attempt 1: Pet-confirmed non-blocking suppression (Candidate "pet-confirmed")
  - In `selfplay/agent.js`, added:
    - `isLikelyPetDogContext` check: adjacent `d` on Dlvl1, XL1, XP=0, lone, confirmed via `knownPetChars`/`petPositions`.
    - When non-blocking: skip attack, fall through to exploration.
    - When blocking: attack as normal (pet swap).
    - Oscillation suppression: `&&  !(isLikelyPetDogContext && !isBlocking)` to avoid non-blocking turns polluting position history.
  - 7-seed triage result:
    - survived `7/7` (flat), avg depth `1.286` (improved).
    - But avg XP t600 `3.00` (major regression vs `5.57`):
      - Healer34: `maxXP=1` (regression from 21), Ranger28: `maxXP=1` (from 6), Rogue29: `maxXP=1` (from 5).
      - Tourist41: `maxXP=9` (improved from 1).
  - Root cause: Oscillation suppression prevented the natural hold→flee escape cycle.
    - Non-blocking exploration turns diversified position history → `_detectCombatOscillation` never fired.
    - Without the flee cycle, seeds that relied on it for exploration windows lost all wild-monster combat.

- Attempt 2: Blocking periodic flee (Candidate "blockingflee")
  - Added `this.blockingPetDogLoopCount = 0` to constructor.
  - Moved `isBlocking` computation before oscillation check (bug fix: was declared after first use).
  - Oscillation formula: `&& !(isLikelyPetDogContext && !isBlocking)` (non-blocking suppression retained).
  - Non-blocking pet-dog: fall through to exploration.
  - Blocking pet-dog: accumulate `blockingPetDogLoopCount++`; after 8, trigger explicit flee.
  - 7-seed triage result (blockingflee):
    - survived `4/7` (major regression from `7/7` baseline!):
      - Tourist41: KILLED by rat (r) on Dlvl1 — over-explored into danger after flee.
      - Ranger28: KILLED by dog (d) — periodic flee destabilized safe zone.
      - Rogue29: KILLED by rat (r) — same pattern.
    - Healer34: survived but `fleeHp=301` (HP-emergency flee spike — instability).
    - Valkyrie42: survived, `maxXP=2` (improved from 0).
  - Root cause: Periodic flee from blocking dog drove agents into dangerous open territory.
    - The flee exited the safe dog-adjacent zone and pushed the agent into patchy Dlvl1 rooms with rats/hostile dogs.
    - Natural oscillation-flee had worked better because it was bounded by the local position pattern; explicit periodic flee is less constrained.

- Net:
  - Both attempts rejected.
  - Interference with the oscillation-flee escape cycle is the core hazard for any dog-loop suppression.
  - Any future approach must either preserve that cycle or replace it with an equivalently bounded escape mechanism.
  - Documented: `blockingPetDogLoopCount` strategy is NOT safe; reverted to HEAD.

## 2026-02-19 - Keep: Optional Attack-Decision Guardrails in Matrix Diff

- Change:
  - Extended `selfplay/runner/c_role_matrix_diff.js` with optional `--include-attack-decision-guardrails`.
  - New optional guardrails gate non-increase of:
    - `avgAttackLoneDog`
    - `avgAttackForced`
    - `avgAttackFleeLoopBreak`
  - Kept default behavior unchanged (opt-in only).

- Why:
  - Attack volume alone (`avgAttack`) can hide harmful composition shifts.
  - We now have attack-decision telemetry; this adds a fast gate to catch
    regressions in known problematic attack modes while preserving existing
    default acceptance semantics.

- Validation:
  - `node --check selfplay/runner/c_role_matrix_diff.js`
  - `node --check selfplay/test/role_matrix_diff.test.js`
  - `node --test selfplay/test/role_matrix_diff.test.js`
  - Smoke:
    - `node selfplay/runner/c_role_matrix_diff.js --baseline=/tmp/role_matrix_smoke_attacktele_20260219.json --candidate=/tmp/role_matrix_smoke_attacktele_20260219.json --include-attack-decision-guardrails --top=2`

- Net:
  - Keep as behavior-neutral triage hardening for selfplay candidate evaluation.
