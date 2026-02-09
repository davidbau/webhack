# NetHack Selfplay Agent - Progress Report

## Current Status (2026-02-09)

The agent can now successfully play both the JS NetHack port (headless) and the C binary (via tmux), with major pathfinding and exploration improvements implemented.

### Performance Benchmarks (seed 42)

| Platform | Max Depth | Turns | Notes |
|----------|-----------|-------|-------|
| JS Port  | Dlvl 3    | 440   | Dies in combat on Dlvl 3 |
| C Binary | Dlvl 1    | 500+  | Efficient exploration (516 cells, 1 failed target) |

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Agent (selfplay/agent.js)                               │
│  - Perceive → Decide → Act loop                         │
│  - Path commitment (anti-oscillation)                   │
│  - Movement failure detection                           │
│  - Target blacklisting                                  │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Perception   │  │ Brain        │  │ Interface    │
│ - screen     │  │ - pathing    │  │ - js_adapter │
│ - status     │  │ - A*/BFS     │  │ - tmux_adp   │
│ - map_track  │  │ - explore    │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Key Design Decision:** Agent perceives only through 80x24 terminal screen buffer (not internal game state). This makes it platform-agnostic and works identically with JS port and C binary.

## Major Bugs Fixed

### 1. Diagonal Movement Through Doorways

**Problem:** Pathfinder allowed diagonal moves into/through doors, which NetHack blocks.

**Root Cause:** Pathfinder only checked if adjacent cells or source cell were doors, not the destination.

**Fix:** Added check for diagonal movement INTO doors:
```javascript
// Can't move diagonally INTO a door either
const destCell = levelMap.at(nx, ny);
if (destCell && destCell.explored && isDoorType(destCell.type)) {
    continue;
}
```

**Impact:** Agent was stuck at (72,7) trying to reach stairs at (72,3) diagonally through door at (71,6). Fix allowed proper cardinal approach.

### 2. Terrain Loss When Player Stands on Cell

**Problem:** When player '@' stands on a door, map tracker overwrites `cell.type = 'player'`, losing the underlying `door_open` info. Pathfinder then allows diagonal movement.

**Fix:** Preserve underlying terrain for player/monster cells:
```javascript
if (screenCell.type === 'player' || screenCell.type === 'monster') {
    cell.explored = true;
    cell.stale = false;
    cell.lastSeenTurn = turn;
    // Keep existing terrain type/walkable if already known
    if (!oldExplored) {
        cell.ch = '.';
        cell.type = 'floor'; // assume floor under entity if first visit
        cell.walkable = true;
    }
    // Don't overwrite ch/color/type with entity character
}
```

### 3. Open Door Detection Without Color Info

**Problem:** In tmux capture (no color), open doors `·` (brown) look identical to floor `.` (gray). Agent couldn't detect doorways.

**Fix:** Structural detection in screen parser:
```javascript
// A '.' cell with walls on exactly two opposite sides is likely a door
if ((isWall(north) && isWall(south)) || (isWall(east) && isWall(west))) {
    cell.type = 'door_open';
}
```

### 4. Movement Failure Detection False Positives

**Problem:** Agent blacklisted targets after:
- Attacking (position doesn't change, but this is expected)
- Bouncing off closed doors (handled by UI, but failure check still ran)

**Fix:**
- Exclude attacks from movement failure checks
- Clear `_lastMoveAction` when door interactions occur
- Only count true failures (position unchanged after movement-type action)

### 5. Unreachable Stairs Through Unexplored Terrain

**Problem:** Agent found stairs but couldn't reach them because pathfinding didn't allow unexplored cells, even when we KNOW the destination.

**Fix:** Use `allowUnexplored: true` when pathing to known features:
```javascript
const path = findPath(level, px, py, stairs.x, stairs.y, { allowUnexplored: true });
```

## Path Commitment Algorithm

**Problem:** Agent oscillated between nearby frontier cells, recalculating target every turn.

**Solution:** Commit to exploration targets and follow them to completion:

```javascript
_commitToExploration(level, px, py) {
    // Check if we've reached our committed target
    if (this.committedTarget && px === tx && py === ty) {
        this.committedTarget = null;
        this.committedPath = null;
    }

    // Re-path to committed target if still valid
    if (this.committedTarget) {
        const path = findPath(level, px, py, tx, ty);
        if (path.found) return this._followPath(path, 'explore', ...);
        // Can't reach anymore — abandon it
        this.committedTarget = null;
    }

    // Find new target and commit to it
    const explorationPath = findExplorationTarget(level, px, py, recentPositions);
    if (explorationPath && explorationPath.found) {
        const dest = explorationPath.path[explorationPath.path.length - 1];
        if (!this.failedTargets.has(destKey)) {
            this.committedTarget = { x: dest.x, y: dest.y };
            return this._followPath(explorationPath, 'explore', ...);
        }
    }
}
```

## Movement Failure Detection & Blacklisting

Prevents agent from repeatedly trying to reach blocked targets:

```javascript
_checkLastMoveFailed() {
    if (px === prePos.x && py === prePos.y && action.key) {
        this.consecutiveFailedMoves++;

        // Mark unexplored cells as walls if movement failed
        const tx = prePos.x + delta.dx;
        const ty = prePos.y + delta.dy;
        const cell = level.at(tx, ty);
        if (cell && !cell.explored) {
            cell.explored = true;
            cell.type = 'wall';
            cell.walkable = false;
        }

        // Blacklist target after 3 failures
        if (this.consecutiveFailedMoves >= 3 && this.committedTarget) {
            const tKey = this.committedTarget.y * 80 + this.committedTarget.x;
            this.failedTargets.add(tKey);
            this.committedTarget = null;
        }
    } else {
        this.consecutiveFailedMoves = 0;
    }
}
```

## Decision Priority (agent._decide)

1. **Emergency:** HP critical → flee
2. **Emergency:** Hungry → eat
3. **Tactical:** Adjacent monster → attack
4. **Tactical:** Items at position → pickup
5. **Strategic:** On downstairs → descend
6. **Strategic:** Level stuck > 20 turns → head to stairs
7. **Recovery:** Stuck > 3 turns → search, mark dead ends, force-explore
8. **Exploration:** Path commitment to frontier
9. **Fallback:** Head to stairs if fully explored
10. **Fallback:** Search for secrets
11. **Last resort:** Random walk

## Known Issues & Limitations

### C Binary Exploration Speed
- Agent explores efficiently but slowly
- 500 turns only covered ~65% of Dlvl 1 (no stairs found yet)
- Root cause: Dlvl 1 with seed 42 may not have generated downstairs in explored area

### Combat Limitations
- Improved HP management (rests when safe, uses healing potions when critical)
- Limited tactical combat (flee from dangerous monsters, but no kiting/ranged)
- Basic inventory management (healing potions, food) - no scrolls/wands yet

### No Strategic Play
- Can't identify items
- Can't use altars/fountains effectively
- No prayer timing
- No shopping
- No spoiler knowledge integration

## Recent Improvements

### Monster Danger Assessment (2026-02-09)

Added intelligent threat evaluation system in `selfplay/brain/danger.js`:

- **Instadeath Prevention:** Never melee floating eyes (paralyze) or cockatrices (petrification)
- **Threat Levels:** Assess monsters as SAFE/LOW/MEDIUM/HIGH/CRITICAL/INSTADEATH
- **Smart Engagement:** Flee from dangerous monsters when HP < 60%, medium threats when HP < 40%
- **Uppercase Awareness:** Treat uppercase monster letters as more dangerous
- **Known Threats:** Special handling for dragons, liches, demons, vampires, etc.

The agent now makes informed combat decisions based on spoiler knowledge rather than blindly attacking everything.

### HP Management and Rest System (2026-02-09)

Implemented intelligent HP recovery to prevent agent from fighting at dangerously low HP:

- **Probabilistic Regen:** NetHack HP regen is (XL + CON)% chance per turn (only ~11% at level 1!)
- **Rest Strategy:** Agent rests when HP < 50% and no monsters nearby
- **Rest Limits:** Cap at 50 turns (moderate HP) or 100 turns (critical HP < 25%)
- **Progress Tracking:** Reset counter when HP increases (natural regen occurred)
- **Prevent Infinite Loop:** After max rest turns, give up and continue (HP heals while exploring)

Key insight: Since HP regeneration is probabilistic, the agent can't wait indefinitely for full HP. The rest limit ensures the agent doesn't get stuck in an infinite rest loop when regeneration is slow.

### Inventory Management and Item Usage (2026-02-09)

Implemented inventory tracking and basic item usage for survival:

- **Inventory Tracking:** Parse inventory screen ('i' command) to know what items we have
- **Food Management:** Check inventory before eating (prevents infinite eat loop when no food)
- **Healing Potions:** Automatically quaff healing potions when HP < 30% (critical threshold)
- **Smart Refresh:** Update inventory every 100 turns or when items likely changed
- **Category Detection:** Identify items by category (Weapons, Armor, Comestibles, Potions, etc.)

Item usage priority:
1. HP < 30%: Drink healing potion if available
2. HP < 20%: Pray to god if no items and can't flee
3. HP critical: Flee from monsters
4. HP < 50%: Rest when safe (up to 50 turns)
5. Hungry: Eat food if available

This significantly improves survival by using available resources before relying on fleeing or natural regeneration.

### Prayer System (2026-02-09)

Implemented divine intervention as a last-resort survival mechanism:

- **Prayer Tracker:** Monitors god timeout (300 turns minimum between prayers)
- **Smart Prayer:** Only pray when HP < 20%, no healing items, and can't flee
- **Priority System:** Healing potions > prayer > fleeing (use resources wisely)
- **Timeout Management:** Prevents angering god by praying too frequently

Prayer is NetHack's most powerful survival tool - the god can fully heal, cure sickness, and save from certain death. The agent now uses this strategically as a last resort when all other options are exhausted.

## Test Coverage

63 passing unit tests:
- Pathfinding (10 tests): A*, BFS, exploration, diagonal restrictions
- Screen Parser (14 tests): message parsing, cell classification, feature detection
- Status Parser (9 tests): HP, stats, conditions
- Map Tracker (4 tests): explored cells, level changes, features
- Tmux capture (1 test): plain text parsing
- Danger Assessment (10 tests): threat levels, engagement decisions, instadeath prevention
- Inventory Tracking (6 tests): parsing, food/potion detection, item queries
- Prayer Timing (9 tests): timeout management, decision logic, priority system

## Next Steps

Based on open bd issues (selfplay-7 through selfplay-20):

**High Priority:**
1. Combat evaluation - threat assessment, fleeing strategy
2. HP management - when to heal, when to rest
3. Inventory system - pickup logic, item usage
4. Spoiler integration - monster danger levels, item identification

**Medium Priority:**
5. Strategic exploration - prioritize interesting features (altars, shops, fountains)
6. Multi-level navigation - track stairs, return to previous levels
7. Shop handling - recognize shops, buy/sell
8. Prayer timing - use god for rescue

**Low Priority:**
9. Sokoban detection - recognize puzzle levels
10. Resistance tracking - track intrinsics
11. Endgame strategy - ascension path
12. Performance optimization - faster C binary play

## Resources

- **Spoiler Guide:** `spoilers/guide.md` (4786 lines, comprehensive reference)
- **JS Game Code:** `js/` directory (full port implementation)
- **Test Infrastructure:** `test/comparison/` (session replay, C comparison)
- **Memory:** `~/.claude/projects/-share-u-davidbau-git-selfplay/memory/MEMORY.md`

## Performance Notes

- **Node 25 required:** Use `.nvmrc` or `nvm use 25`
- **JS Port:** ~2-5ms per turn (very fast)
- **C Binary:** 40ms key delay + game processing (~50-80ms per turn)
- **Memory:** Dungeon tracker scales linearly with explored area
- **Pathfinding:** A* with Chebyshev heuristic, efficient for 80x21 maps
