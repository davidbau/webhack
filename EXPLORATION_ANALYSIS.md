# Exploration & Stuck Situation Analysis

## Problem Statement
4/8 test seeds get stuck at Dlvl 1 despite having reachable downstairs (verified by diagnose_stuck.mjs). Agents oscillate without making exploration progress.

## Root Cause (Confirmed)
**Exploration target selection (`findExplorationTarget()`) doesn't work well for NetHack's corridor-based dungeons.**

The diagnostic tool (diagnose_stuck.mjs) proved that stuck seeds (44444, 77777, 88888) have downstairs that are REACHABLE without secret doors. Yet agents oscillate for 1500+ turns without finding them.

## What Works
1. **Exploration Priority Check** (lines 875-884 in agent.js):
   - Only search for secrets when frontier < 10 OR explored > 50% of map  
   - Prevents premature searching while frontier cells remain
   - Improved seed 44444 from Dlvl 1 → Dlvl 3 ✓

2. **Fallback Search Fix** (lines 1072-1082):
   - Apply same exploration priority check to fallback search path
   - Prevents searching when exploration should continue

## What Doesn't Work
1. **Oscillation Detection via Frontier Progress Tracking**:
   - Tracking frontierStuckTurns and accelerating levelStuckCounter
   - Made results worse (seed 44444 regressed 3→2, overall 3/8→2/8)
   - Too complex, creates unintended interactions with existing stuck detection

2. **Blacklist Clearing on Frontier Stuck**:
   - Clearing failedTargets when frontier stays high
   - Didn't help agents find reachable targets
   - Root issue is target selection, not blacklisting

## The Real Problem
`findExplorationTarget()` in pathing.js likely uses:
- Euclidean distance to pick nearest frontier cell
- No awareness of corridor structure
- No preference for cells along unexplored corridors vs dead-end walls

Result: Agent picks targets that are "close" but hard to reach or lead nowhere, oscillates trying to reach them, blacklists them, picks another bad target, repeat.

## Solution Needed
Improve `findExplorationTarget()` to:
1. Prioritize frontier cells along unexplored corridors (not walls)
2. Detect and avoid repeated targeting of same local area
3. Follow corridor structure systematically (breadth-first by corridor segment?)

This is a significant pathfinding refactor beyond quick fixes.

## Current Results
- **3/8 seeds** reach Dlvl 2+ (baseline was 5/8 after upstairs fix)
- **1/8 seeds** reach Dlvl 3 (seed 44444, up from Dlvl 1)
- Stuck seeds: 55555 (was 2→1 regression), 77777 (1), 88888 (1), 66666 (0)

## Files
- `diagnose_stuck.mjs` - Ground truth map analysis tool
- `selfplay/agent.js` - Exploration priority fixes (commit e08b771)
