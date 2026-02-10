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
- **1-4/8 seeds** reach Dlvl 2+ with 500 turn limit (high RNG variability)
- **Success rate varies**: 12.5% to 50% depending on monster encounters
- **Typical working seeds**: 33333 (Dlvl 2), 77777 (Dlvl 2)
- **Typical stuck seeds**: 22222, 44444, 66666, 88888 (stuck at Dlvl 1)

### Deep Investigation: Secret Doors & Disconnected Maps

**Seed 22222 Analysis** (comprehensive ground-truth investigation):
- Map has **3 secret doors** at (43,1), (3,16), (61,8)
- Only **19 cells initially reachable** from start (7,13) without finding secret doors
- Stairs at (62,7) blocked by secret door at (61,8)
- To reach stairs, must first find SD at (3,16) or (43,1) to unlock new sections
- Agent explores 190/346 walkable cells (54.9%) but misses critical corridor with stairs

**Search Candidate System Analysis**:
- Search candidates ARE created for positions adjacent to secret doors ✓
- Position (3,15) next to SD(3,16) is reachable with path cost 25-26 ✓
- BUT: (3,15) ranked **43/136** by priority (priority=5, not high enough)
- Agent tries top 10 candidates but never reaches rank 43

### Improvements Made (Latest)
1. **Opportunistic wall searching** - Agent now searches whenever at a position with adjacent walls, even during exploration (not just when `shouldSearch` triggers)
   - Result: 34 searches in 200 turns vs 1 search before ✓

2. **Reachable candidate filtering** - Filter search candidates to only reachable ones before selecting top candidates
   - Prevents wasting turns trying to reach unreachable positions ✓

3. **Increased candidate limit** - Try 50 search candidates instead of 10
   - Ensures lower-priority but critical candidates are eventually attempted ✓

4. **Stuck exploration detection** - Abandon committed exploration paths when stuck (frontier high, coverage low)
   - Allows switching to far targets or searching ✓

### Remaining Core Problem: Incomplete Exploration Coverage

**Root Cause**: Agent's exploration algorithm doesn't ensure it visits ALL reachable cells.

**Evidence**:
- Seed 22222: Position (3,15) is REACHABLE (path exists, distance 25-26)
- It's a search candidate (rank 43/136)
- Opportunistic searching works (agent searches 34 times)
- BUT: Agent **never reaches** (3,15) even in 500 turns!
- Agent gets stuck oscillating in initially explored area (~19 cells)
- Never expands to distant but reachable areas like (3,15)

**Why This Happens**:
1. Agent explores locally using nearest frontier targets
2. Gets stuck when local area exhausted
3. Tries far targets but they're often in disconnected sections
4. Oscillates and blacklists targets without systematic coverage
5. Never actually visits all reachable cells before giving up

**Solution Needed**:
The exploration algorithm needs to be fundamentally more systematic:
- **Flood-fill exploration**: Track and ensure all reachable cells are visited
- **Wall-following**: Follow walls to ensure complete corridor coverage
- **Sector-based exploration**: Divide map into sectors, ensure each is thoroughly explored
- **Distance-forcing**: When stuck, force movement to furthest reachable unexplored cell

This is a significant architectural refactor beyond incremental fixes.

## Previous Attempts

3. **Waypoint Search Restriction** (failed):
   - Attempted to only search at committed targets or stuck positions (not waypoints)
   - **Result**: Success rate dropped from 4/8 (50%) to 1/8 (12.5%)
   - **Key Insight**: Searching at waypoints is BENEFICIAL, not harmful
   - Concentrated searching (21x at same position) likely finds secret doors
   - The "repeated position" pattern is actually agent passing through critical junctions
   - **Conclusion**: Opportunistic waypoint searching should remain enabled

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

## Latest Investigation: Blacklist Management & Stuck Detection (Session 2)

### Key Finding: Stuck Exploration Never Triggers
Tested seed 22222 with instrumentation:
- Stuck exploring detection: **0 times** in 300 turns
- Blacklist clears from stuck detection: **0**
- This explains why distant targets remain permanently blacklisted

### Stuck Detection Thresholds (lines 1406-1412 in agent.js)
```javascript
const isStuckExploring = (
    this.turnNumber > 100 &&
    frontier.length > 50 &&      // Current condition
    exploredPercent < 0.20       // Compares to full 80x21 grid
);
```

**Problem**: The thresholds don't match NetHack's actual dungeon structure:
- frontier.length > 50 may be too high for disconnected map sections
- exploredPercent < 0.20 means < 336 cells of 1680 total
- Seed 22222 explores ~190 cells (11.3%) but stuck detection still doesn't fire
- Likely frontier.length is < 50 due to disconnected sections

### Attempted Fix: Periodic Blacklist Clearing
Added: Clear failedTargets every 50 turns when isStuckExploring (line 1413-1416)
**Result**: No improvement because isStuckExploring never triggers

### Root Cause Confirmed
1. **Premature blacklisting**: Distant targets like (3,15) get blacklisted early
2. **Insufficient clearing**: Blacklist only clears when stuck counter hits multiples of 30
3. **Stuck detection gap**: Agent can be "moving without progressing" without triggering stuck
4. **Threshold mismatch**: Current thresholds don't detect stuck state in disconnected maps

### Blocked by Fundamental Architecture
The stuck exploration detection logic cannot reliably identify when the agent is:
- Moving locally without expanding to new areas
- In a disconnected map section with low frontier but high total frontier
- Making "movement progress" but no "exploration progress"

**Next Steps** (requires major refactor):
- Redesign stuck detection to track exploration progress (new cells/turn) not just position
- Lower frontier threshold or make it adaptive to map structure
- Track "exploration velocity" to detect slowdown even when moving
- Or: Implement systematic exploration (flood-fill/wall-following) that doesn't rely on stuck detection

## Files
- `diagnose_stuck.mjs` - Ground truth map analysis tool
- `check_connectivity.mjs` - BFS reachability checker
- `visualize_with_secrets.mjs` - Map visualization with secret doors
- `selfplay/agent.js` - Exploration improvements and opportunistic searching
- `selfplay/brain/pathing.js` - Exploration target selection (findExplorationTarget)
- Test results: 1-4/8 seeds reach Dlvl 2+ (high variance)
