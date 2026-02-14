# Selfplay C Validation Notes (2026-02-13)

## Summary
- We confirmed that meaningful agent evaluation must be done against the C NetHack runner (`selfplay/runner/c_runner.js`), not only JS headless runs.
- We fixed a runner/harness stability issue and a command-path bug, then validated C baseline metrics.

## Validated Fixes
- `selfplay/runner/headless_runner.js`
  - Added delayed prompt-rescue input fallback in `HeadlessAdapter.sendKey` to prevent deadlocks under suppressed-output automation.
- `js/commands.js`
  - Fixed kick handling path to pass `game` into `handleKick(...)` so `game.flags.verbose` access is valid.

Note: When replaying onto current `main`, the `js/commands.js` kick-context fix was already present upstream; only the headless-runner delta remained to apply.

## C Held-Out Baseline (600 turns)
Seeds: `2,5,10,50,200,1000,2000,3000,5000,7000`

Observed aggregate:
- Mean max depth: `1.4`
- Median max depth: `1`
- Dlvl 2+: `40%` (4/10)
- Dlvl 3+: `0%` (0/10)
- Death rate: `10%` (1/10)

## Candidate Policy Changes Tried (and reverted)
All candidates below were tested on C development seeds and then held-out where appropriate. None improved held-out aggregate metrics, so they were reverted:
- Prioritize door handling before systematic frontier sweeps when stuck.
- Restrict systematic frontier sweeping to deeper levels only.

## Process Notes
- Continue using dev-seed tuning first, then held-out aggregate check.
- Keep strict acceptance rule: no commit of agent policy changes unless held-out average improves.

## 2026-02-14 Update
### What changed
- `selfplay/perception/map_tracker.js`
  - Dungeon memory is now keyed by `branch:depth` instead of just depth.
  - Added branch-epoch rollover when action/depth transitions are impossible for same-branch numbering:
    - `descend` with numeric depth decrease
    - `ascend` with numeric depth increase
- `selfplay/agent.js`
  - Added descend-loop guard for repeated no-op `>` decisions at the same stair tile.
  - Suppressed immediate descend shortcuts while a stair tile is temporarily blocked by the guard.
  - Fixed locked-door handling loop:
    - Do not immediately abandon `pendingLockedDoor` just because the agent is not adjacent yet.
    - Track non-adjacent age and only give up after sustained failure.

### Why
- We observed pathological loops on C seed `16`:
  - repeated `>` at one tile without progress
  - repeated locked-door retries with "giving up after 0 attempts"
- These loops consumed large turn budgets and inflated timeout risk.

### Held-out paired validation (C runner, 1200 turns, seeds 11-20, timeout-guarded)
- Baseline (`origin/main`): `avg_depth=1.80`, `lvl3+=3/10`, `survived=4/10`
- Candidate (changes above): `avg_depth=1.80`, `lvl3+=3/10`, `survived=5/10`

### Decision
- Keep this change set:
  - depth outcomes held constant
  - survival improved on held-out seeds
  - no regression on aggregate depth metrics

## 2026-02-15 Update
### What changed
- `selfplay/agent.js`
  - Reworked early equipment setup so weapon and armor are both pursued during early turns.
  - Removed one-shot gating that could wield a weapon and then skip armor setup entirely.

### Why
- In previous policy, startup equipment logic set `hasCheckedStarting` as soon as one action fired.
- On many runs, this allowed wielding but prevented early armor wear, reducing survivability and depth progression.

### Held-out paired validation (C runner, 1200 turns, seeds 11-20, timeout-guarded)
- Baseline (`origin/main`): `avg_depth=1.80`, `lvl3+=3/10`, `survived=5/10`
- Candidate (equipment fix): `avg_depth=2.10`, `lvl3+=4/10`, `survived=5/10`

### Decision
- Keep this change set:
  - meaningful depth improvement on held-out seeds
  - survival rate held constant (no regression)
