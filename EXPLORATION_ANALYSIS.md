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

## Current Results (After Exploration Improvements)
- **4/8 seeds (50%)** reach Dlvl 2+ with 500 turn limit
- **Working seeds**: 11111 (Dlvl 2), 33333 (Dlvl 2), 55555 (Dlvl 2-3), 77777 (Dlvl 2)
- **Stuck seeds**: 22222, 44444, 66666, 88888 (all stuck at Dlvl 1)

### Improvements Made
1. **Far target selection when stuck** - When frontier > 50 and explored < 20%, pick farthest targets instead of nearest to break out of local loops (pathing.js)
2. **Early secret door searching** - Start searching at turn 150 if stuck (frontier high, exploration low) even if not thoroughly explored (agent.js)

### Remaining Issues
- Stuck seeds (22222, 44444) explore only ~15-17% of map with ~100 frontier cells
- Agent tries far targets but can't reach them (likely behind multiple secret doors)
- Search actions increase but don't find the critical secret doors in time
- Some map layouts may require more sophisticated exploration strategies

## Previous Attempts

4. **Directional Diversification** (failed):
   - Pick from farther candidates every N turns to break directional bias
   - **Result**: No improvement; agent still stuck exploring wrong side of map
   - **Issue**: Seed 55555 explores east (x=44-59) while downstairs are west (x=34)
   - Reveals deeper problem: agent finds downstairs but gets stuck navigating to them

## Key Discovery: Movement Execution is Working

Investigation revealed the movement execution hypothesis was **INCORRECT**:

### Issue 1: Locked Doors (FIXED)
- Seed 55555 early runs showed "This door is locked" messages
- Implemented detection and door_locked cell type
- Doors are now properly avoided

### Issue 2: Movement Execution - NOT THE PROBLEM
**Testing revealed**: Movement commands execute correctly!

Seed 55555 testing with diagnostic tools:
- Reaches Dlvl 2 by turn 100
- Reaches Dlvl 3 by turn 150
- Movement execution is functioning properly

**Actual current results** (500 turn limit):
- Seed 11111: Dlvl 2 ✓
- Seed 22222: Dlvl 1 (stuck)
- Seed 33333: Dlvl 2 ✓
- Seed 44444: Dlvl 1 (stuck)
- Seed 55555: Dlvl 3 ✓ (when tested individually)

**Success rate**: At least 3/5 seeds progress beyond Dlvl 1

**Remaining issue**: Seeds 22222 and 44444 are stuck, but this is due to exploration/pathfinding problems, NOT movement execution failure. The agent correctly sends movement commands and they execute - the problem is choosing the right targets to navigate to.

## Files
- `diagnose_stuck.mjs` - Ground truth map analysis tool
- `selfplay/agent.js` - Exploration priority fixes (commit e08b771)
- Test results: 3/8 seeds reach Dlvl 2+, 1/8 reaches Dlvl 3
