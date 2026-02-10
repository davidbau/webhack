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

3. **Corridor-Aware Exploration** (multiple attempts):
   - **Strong priority**: Helped seeds 33333 (2→3), 55555 (1→3), but hurt 11111 (2→1), 22222 (2→1), 44444 (3→2)
   - **Softened priority**: Lost all improvements
   - **Adaptive (only when stuck)**: No improvement
   - **Conclusion**: Different maps need different strategies; no universal heuristic works

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

4. **Directional Diversification** (failed):
   - Pick from farther candidates every N turns to break directional bias
   - **Result**: No improvement; agent still stuck exploring wrong side of map
   - **Issue**: Seed 55555 explores east (x=44-59) while downstairs are west (x=34)
   - Reveals deeper problem: agent finds downstairs but gets stuck navigating to them

## Key Discovery: Navigation Failure - SOLVED!

Investigation of seed 55555 revealed:
- Agent **finds** downstairs at (34, 7) around turn 150
- Agent tries to navigate: "heading to downstairs (level stuck 22)"
- Agent gets **stuck at position (35, 9) trying to move to (35, 8)**
- Screen shows '·' at (35,8), agent memory says `door_open`
- **Message: "This door is locked."**

**ROOT CAUSE**: The agent tries to path through a **LOCKED DOOR** at (35,8).
- Perception bug: agent doesn't distinguish locked vs unlocked doors
- Path appears valid (door_open, walkable=true) but is actually impassable
- Agent needs to: unlock door, kick it down, or find alternate route
- Currently agent just keeps retrying the same blocked path

**Fix needed**:
1. Detect locked door message and mark cell as non-walkable
2. Implement door unlocking/kicking
3. Find alternate paths when doors are locked

## Files
- `diagnose_stuck.mjs` - Ground truth map analysis tool
- `selfplay/agent.js` - Exploration priority fixes (commit e08b771)
- Test results: 3/8 seeds reach Dlvl 2+, 1/8 reaches Dlvl 3
