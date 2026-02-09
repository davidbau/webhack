# Fixing Stuck Situations - Action Plan

## Problem Summary
4/8 test seeds get stuck at Dlvl 1, unable to find secret doors even after 1500 turns.

## Immediate Fixes (implement first)

### 1. Increase search attempts: 20 → 30
**File**: `selfplay/perception/map_tracker.js`, line ~235
```javascript
// Change from 20 to 30 for 99.5% success rate
if (this._hasAdjacentWall(x, y) && cell.searched < 30) {
```

**File**: `selfplay/agent.js` (multiple locations)
```javascript
// Update all references to searched < 20
const unsearchedCandidates = searchCandidates.filter(c => c.searched < 30);
if (cell.searched < 30) { ... }
```

### 2. Improve search candidate sorting
**File**: `selfplay/perception/map_tracker.js`, lines ~236-243
```javascript
getSearchCandidates() {
    const candidates = [];
    for (let y = 1; y < MAP_ROWS - 1; y++) {
        for (let x = 1; x < MAP_COLS - 1; x++) {
            const cell = this.cells[y][x];
            if (!cell.explored || !cell.walkable) continue;
            if (this._hasAdjacentWall(x, y) && cell.searched < 30) {
                // Add priority scoring for likely secret door locations
                let priority = 0;

                // Higher priority for dead-ends
                const walkableNeighbors = this._countWalkableNeighbors(x, y);
                if (walkableNeighbors <= 2) priority += 10;

                // Higher priority for corners
                if (this._isCornerLocation(x, y)) priority += 5;

                candidates.push({ x, y, searched: cell.searched, priority });
            }
        }
    }
    // Sort by: priority desc, then searched asc
    candidates.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.searched - b.searched;
    });
    return candidates;
}
```

### 3. Breadth-first wall searching
**File**: `selfplay/agent.js`, section 6.5
```javascript
// When at a search candidate, search ALL adjacent walls before moving
if (px === candidate.x && py === candidate.y) {
    // Search all 8 adjacent cells, not just current position
    for (const [dx, dy] of [[−1,−1], [0,−1], [1,−1], [−1,0], [1,0], [−1,1], [0,1], [1,1]]) {
        const nx = px + dx, ny = py + dy;
        const ncell = level.at(nx, ny);
        if (ncell && ncell.type === 'wall' && ncell.searched < 5) {
            ncell.searched++;
            return { type: 'search', key: 's', reason: `searching adjacent wall at (${nx},${ny})` };
        }
    }
}
```

## Medium-term Improvements

### 4. Track definitely-not-secret walls
After 30 searches, mark walls as confirmed solid to improve pathfinding.

### 5. Alternative stuck strategies
At levelStuckCounter > 200:
- Grid-pattern systematic wall search
- Search frontier walls (even if not adjacent to walkable)
- Aggressive random walk to find unexplored connections

## Expected Impact
- 30 searches instead of 20: reduces "unlucky RNG" failures by ~70%
- Priority scoring: finds secret doors 20-30% faster
- Breadth-first searching: reduces travel time between searches by 40-50%

**Predicted results**: 6-7/8 seeds should reach Dlvl 2+, 4-5/8 reach Dlvl 3+
