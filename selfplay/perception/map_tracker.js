// selfplay/perception/map_tracker.js -- Persistent spatial memory
//
// Maintains the agent's knowledge of the dungeon across turns and levels.
// Updated each turn from screen_parser output. Handles partial observability
// (fog of war in corridors, lit rooms, dark rooms).

const MAP_COLS = 80;
const MAP_ROWS = 21;

/**
 * A remembered map cell with persistent state.
 */
export class TrackedCell {
    constructor() {
        this.ch = ' ';           // last seen character
        this.color = 7;          // last seen color
        this.type = 'stone';     // classified type from screen_parser
        this.explored = false;   // have we ever seen this cell?
        this.walkable = false;   // can the player walk on this cell?
        this.lastSeenTurn = -1;  // turn number when last observed
        this.stale = false;      // true if cell is remembered but not currently visible
        this.monster = null;     // monster info if present: {ch, color, lastSeenTurn}
        this.items = [];         // item info: [{ch, color, lastSeenTurn}]
        this.searched = 0;       // how many times we've searched adjacent to this cell (legacy)
        this.searchCount = 0;    // how many times we've searched FROM this position
        this.lastSearchTurn = -1; // turn number when last searched from this position
    }
}

/**
 * Map of a single dungeon level.
 */
export class LevelMap {
    constructor(depth) {
        this.depth = depth;
        this.cells = [];
        for (let y = 0; y < MAP_ROWS; y++) {
            this.cells[y] = [];
            for (let x = 0; x < MAP_COLS; x++) {
                this.cells[y][x] = new TrackedCell();
            }
        }

        // Discovered features
        this.stairsUp = [];    // [{x, y}]
        this.stairsDown = [];  // [{x, y}]
        this.fountains = [];   // [{x, y}]
        this.altars = [];      // [{x, y}]
        this.traps = [];       // [{x, y, type}]
        this.shops = [];       // [{x, y}] approximate shop locations

        // Exploration stats
        this.exploredCount = 0;
        this.fullyExplored = false;
    }

    at(x, y) {
        if (y < 0 || y >= MAP_ROWS || x < 0 || x >= MAP_COLS) return null;
        return this.cells[y][x];
    }

    /**
     * Update this level map from a parsed GameScreen.
     * Only updates cells that are currently visible (not stale/remembered).
     */
    update(screen, turn) {
        // First, mark all previously-visible cells as stale
        // and clear monster info (monsters move)
        for (let y = 0; y < MAP_ROWS; y++) {
            for (let x = 0; x < MAP_COLS; x++) {
                const cell = this.cells[y][x];
                if (cell.explored && !cell.stale) {
                    cell.stale = true;
                }
                cell.monster = null; // monsters may have moved
            }
        }

        // Update from current screen
        for (let y = 0; y < MAP_ROWS; y++) {
            for (let x = 0; x < MAP_COLS; x++) {
                const screenCell = screen.map[y][x];
                if (!screenCell || screenCell.ch === ' ') {
                    // Not visible — keep remembered state
                    continue;
                }

                const cell = this.cells[y][x];
                const oldExplored = cell.explored;
                const oldType = cell.type;

                // When the player or a monster stands on a cell, preserve
                // the underlying terrain type (door, floor, etc.) so the
                // pathfinder can make correct diagonal-through-door checks.
                if (screenCell.type === 'player' || screenCell.type === 'monster') {
                    cell.explored = true;
                    cell.stale = false;
                    cell.lastSeenTurn = turn;
                    // Keep existing terrain type/walkable if already known
                    if (!oldExplored) {
                        cell.ch = '.';   // visual placeholder
                        cell.type = 'floor'; // assume floor under entity if first visit
                        cell.walkable = true;
                    }
                    // Don't overwrite ch/color/type with entity character
                } else {
                    cell.ch = screenCell.ch;
                    cell.color = screenCell.color;
                    cell.type = screenCell.type;
                    cell.explored = true;
                    cell.stale = false;
                    cell.lastSeenTurn = turn;
                    cell.walkable = isWalkable(screenCell.type);
                }

                if (!oldExplored) {
                    this.exploredCount++;
                }

                // Track monsters
                if (screenCell.type === 'monster') {
                    cell.monster = {
                        ch: screenCell.ch,
                        color: screenCell.color,
                        lastSeenTurn: turn,
                    };
                }

                // Track items: update when we see the cell fresh
                if (screenCell.type === 'item' || screenCell.type === 'gold') {
                    cell.items = [{
                        ch: screenCell.ch,
                        color: screenCell.color,
                        lastSeenTurn: turn,
                    }];
                } else if (cell.items.length > 0) {
                    // Cell no longer shows items — they were picked up or gone
                    cell.items = [];
                }

                // Register features (on first discovery or type change)
                if (!oldExplored || oldType !== screenCell.type) {
                    this._registerFeature(x, y, screenCell.type);
                }
            }
        }
    }

    /**
     * Register a notable feature at (x, y).
     */
    _registerFeature(x, y, type) {
        const pos = { x, y };
        switch (type) {
            case 'stairs_up':
                if (!this.stairsUp.some(s => s.x === x && s.y === y)) {
                    this.stairsUp.push(pos);
                }
                break;
            case 'stairs_down':
                if (!this.stairsDown.some(s => s.x === x && s.y === y)) {
                    this.stairsDown.push(pos);
                }
                break;
            case 'fountain':
                if (!this.fountains.some(f => f.x === x && f.y === y)) {
                    this.fountains.push(pos);
                }
                break;
            case 'altar':
                if (!this.altars.some(a => a.x === x && a.y === y)) {
                    this.altars.push(pos);
                }
                break;
            case 'trap':
                if (!this.traps.some(t => t.x === x && t.y === y)) {
                    this.traps.push(pos);
                }
                break;
        }
    }

    /**
     * Get unexplored cells that border explored walkable cells.
     * These are the exploration frontier.
     * Cells whose adjacent walkable neighbors have all been heavily searched
     * are deprioritized (likely stone, not openings).
     */
    getExplorationFrontier() {
        const frontier = [];
        for (let y = 0; y < MAP_ROWS; y++) {
            for (let x = 0; x < MAP_COLS; x++) {
                const cell = this.cells[y][x];
                // Frontier = explored, walkable cells that border unexplored space
                // (matches definition used by findExplorationTarget)
                if (!cell.explored || !cell.walkable) continue;

                // Check if any neighbor is unexplored
                let hasUnexplored = false;
                for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) continue;
                    const neighbor = this.cells[ny][nx];
                    if (!neighbor.explored) {
                        hasUnexplored = true;
                        break;
                    }
                }

                if (hasUnexplored) {
                    // Score based on how much this cell has been searched
                    const searchScore = cell.searched || 0;
                    frontier.push({ x, y, searchScore });
                }
            }
        }
        // Sort: least-searched first (more promising)
        frontier.sort((a, b) => a.searchScore - b.searchScore);
        return frontier;
    }

    /**
     * Total search count of walkable neighbors of an unexplored cell.
     * High values mean we've searched next to this cell a lot (probably stone).
     */
    _neighborSearchScore(x, y) {
        let total = 0;
        for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) continue;
            const neighbor = this.cells[ny][nx];
            if (neighbor.explored && neighbor.walkable) {
                total += neighbor.searched;
            }
        }
        return total;
    }

    /**
     * Get cells adjacent to unexplored areas that are worth searching
     * (for secret doors/corridors).
     */
    getSearchCandidates() {
        const candidates = [];
        for (let y = 1; y < MAP_ROWS - 1; y++) {
            for (let x = 1; x < MAP_COLS - 1; x++) {
                const cell = this.cells[y][x];
                if (!cell.explored || !cell.walkable) continue;
                // Check for adjacent walls that might hide secret passages
                // Search up to 30 times per location (1/7 chance each = ~99.5% after 30 tries)
                if (this._hasAdjacentWall(x, y) && cell.searched < 30) {
                    // Calculate priority for likely secret door locations
                    let priority = 0;

                    // Higher priority for dead-ends (likely secret door locations)
                    const walkableNeighbors = this._countWalkableNeighbors(x, y);
                    if (walkableNeighbors <= 2) priority += 10;

                    // Higher priority for corners
                    if (this._isCornerLocation(x, y)) priority += 5;

                    candidates.push({ x, y, searched: cell.searched, priority });
                }
            }
        }
        // Sort by: priority desc (high priority first), then searched asc (least searched first)
        candidates.sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority;
            return a.searched - b.searched;
        });
        return candidates;
    }

    /**
     * Count walkable neighbors for dead-end detection.
     */
    _countWalkableNeighbors(x, y) {
        let count = 0;
        for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) continue;
            const neighbor = this.cells[ny][nx];
            if (neighbor.explored && neighbor.walkable) count++;
        }
        return count;
    }

    /**
     * Check if this is a corner location (higher probability of secret doors).
     */
    _isCornerLocation(x, y) {
        // Check if we're at a corner (walkable in L-shape)
        const n = this.cells[y - 1]?.[x];
        const s = this.cells[y + 1]?.[x];
        const e = this.cells[y]?.[x + 1];
        const w = this.cells[y]?.[x - 1];

        const nWalk = n?.explored && n?.walkable;
        const sWalk = s?.explored && s?.walkable;
        const eWalk = e?.explored && e?.walkable;
        const wWalk = w?.explored && w?.walkable;

        // L-shape patterns indicate corners
        return (nWalk && eWalk && !sWalk && !wWalk) ||
               (nWalk && wWalk && !sWalk && !eWalk) ||
               (sWalk && eWalk && !nWalk && !wWalk) ||
               (sWalk && wWalk && !nWalk && !eWalk);
    }

    _hasWalkableNeighbor(x, y) {
        for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) continue;
            const neighbor = this.cells[ny][nx];
            if (neighbor.explored && neighbor.walkable) return true;
        }
        return false;
    }

    _hasAdjacentWall(x, y) {
        for (const [dx, dy] of CARDINAL_DIRS) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) continue;
            const neighbor = this.cells[ny][nx];
            if (neighbor.explored && neighbor.type === 'wall') return true;
            if (!neighbor.explored) return true; // unexplored = potential wall
        }
        return false;
    }

    /**
     * Get wall positions adjacent to player that could be secret doors.
     * Returns sorted array of candidates [{x, y, fromX, fromY, direction, searchCount, priority}]
     */
    getSecretDoorCandidates(px, py) {
        const candidates = [];
        const DIRS_WITH_NAMES = [
            {dx: -1, dy: 0, name: 'west'},
            {dx: 1, dy: 0, name: 'east'},
            {dx: 0, dy: -1, name: 'north'},
            {dx: 0, dy: 1, name: 'south'},
            {dx: -1, dy: -1, name: 'northwest'},
            {dx: 1, dy: -1, name: 'northeast'},
            {dx: -1, dy: 1, name: 'southwest'},
            {dx: 1, dy: 1, name: 'southeast'},
        ];

        for (const dir of DIRS_WITH_NAMES) {
            const wx = px + dir.dx;
            const wy = py + dir.dy;
            const cell = this.at(wx, wy);

            if (!cell || !cell.explored) continue;

            // Check if this is a wall that could be a secret door
            if (cell.type === 'wall' && cell.searchCount < 20) {
                // Check if there's unexplored space beyond
                const beyondX = wx + dir.dx;
                const beyondY = wy + dir.dy;
                const beyondCell = this.at(beyondX, beyondY);

                // Higher priority if unexplored beyond or low search count
                let priority = 10;
                if (!beyondCell || !beyondCell.explored) priority += 5;
                priority -= cell.searchCount * 0.5;

                candidates.push({
                    x: wx,
                    y: wy,
                    fromX: px,
                    fromY: py,
                    direction: dir.name,
                    searchCount: cell.searchCount,
                    priority: priority,
                });
            }
        }

        candidates.sort((a, b) => b.priority - a.priority);
        return candidates;
    }

    /**
     * Check if player is in dead-end situation needing systematic wall search.
     * Only returns true if we've EXHAUSTED normal exploration options.
     */
    isDeadEnd(px, py) {
        // Don't trigger if there are still frontier cells to explore!
        // Secret door search is a LAST RESORT, not a first option
        const frontier = this.getExplorationFrontier();
        if (frontier.length > 5) {
            return false; // Still have places to explore normally
        }

        // Check 1: No downstairs found and frontier exhausted?
        if (frontier.length <= 5 && this.stairsDown.length === 0) {
            return true;
        }

        // Check 2: Explored a decent amount but still no downstairs?
        const exploredPercent = this.exploredCount / (MAP_COLS * MAP_ROWS);
        if (exploredPercent > 0.10 && this.stairsDown.length === 0 && frontier.length <= 5) {
            return true;
        }

        return false;
    }

    /**
     * Analyze corridor structure around a position to understand dungeon layout.
     * Returns: { inCorridor, corridorDirection, corridorLength, likelyRoomDirection }
     */
    analyzeCorridorStructure(px, py) {
        const cell = this.at(px, py);
        if (!cell || !cell.explored) {
            return { inCorridor: false };
        }

        const isCorridor = cell.type === 'corridor';
        if (!isCorridor) {
            return { inCorridor: false };
        }

        // Detect corridor direction by checking which directions have corridor/walkable cells
        const directions = {
            north: this._hasCorridorInDirection(px, py, 0, -1),
            south: this._hasCorridorInDirection(px, py, 0, 1),
            east: this._hasCorridorInDirection(px, py, 1, 0),
            west: this._hasCorridorInDirection(px, py, -1, 0),
        };

        // Count how many directions the corridor extends
        const openDirections = Object.entries(directions).filter(([_, open]) => open);

        // Trace corridor length in each direction
        const lengths = {};
        for (const [dir, open] of Object.entries(directions)) {
            if (open) {
                const [dx, dy] = this._directionToDelta(dir);
                lengths[dir] = this._traceCorridorLength(px, py, dx, dy);
            }
        }

        // Predict where rooms might be: at corridor endpoints with unexplored space beyond
        const likelyRoomDirections = [];
        for (const [dir, length] of Object.entries(lengths)) {
            if (length > 0) {
                const [dx, dy] = this._directionToDelta(dir);
                const endX = px + dx * length;
                const endY = py + dy * length;

                // Check if corridor ends at unexplored space (likely room beyond)
                const endCell = this.at(endX, endY);
                if (endCell && endCell.explored && endCell.type === 'corridor') {
                    // Check one cell beyond for unexplored space
                    const beyondCell = this.at(endX + dx, endY + dy);
                    if (!beyondCell || !beyondCell.explored) {
                        likelyRoomDirections.push({ direction: dir, distance: length });
                    }
                }
            }
        }

        return {
            inCorridor: true,
            openDirections: openDirections.map(([dir, _]) => dir),
            corridorLengths: lengths,
            likelyRoomDirections,
            isJunction: openDirections.length >= 3,
            isStraight: openDirections.length === 2 && this._isOppositePair(openDirections.map(([d, _]) => d)),
        };
    }

    /**
     * Check if there's a corridor extending in a given direction.
     */
    _hasCorridorInDirection(x, y, dx, dy) {
        const neighbor = this.at(x + dx, y + dy);
        if (!neighbor || !neighbor.explored) return false;
        return neighbor.walkable && (neighbor.type === 'corridor' || neighbor.type === 'room' || neighbor.type === 'door');
    }

    /**
     * Trace how far a corridor extends in a direction (up to 10 cells).
     */
    _traceCorridorLength(x, y, dx, dy, maxDist = 10) {
        let length = 0;
        for (let i = 1; i <= maxDist; i++) {
            const cell = this.at(x + dx * i, y + dy * i);
            if (!cell || !cell.explored) break;
            if (cell.type !== 'corridor' && cell.type !== 'door') break;
            length = i;
        }
        return length;
    }

    /**
     * Convert direction name to delta coordinates.
     */
    _directionToDelta(direction) {
        switch (direction) {
            case 'north': return [0, -1];
            case 'south': return [0, 1];
            case 'east': return [1, 0];
            case 'west': return [-1, 0];
            default: return [0, 0];
        }
    }

    /**
     * Check if two directions are opposite (north/south or east/west).
     */
    _isOppositePair(dirs) {
        if (dirs.length !== 2) return false;
        return (dirs.includes('north') && dirs.includes('south')) ||
               (dirs.includes('east') && dirs.includes('west'));
    }

    /**
     * Get frontier cells weighted by structural analysis.
     * Prioritizes: corridor endpoints, unexplored branches, predicted room locations.
     */
    getStructurallyPrioritizedFrontier(px, py) {
        const frontier = this.getExplorationFrontier();
        const structure = this.analyzeCorridorStructure(px, py);

        // Enhance frontier with structural priorities
        const prioritized = frontier.map(f => {
            let structuralPriority = 0;
            const fCell = this.at(f.x, f.y);

            if (!fCell) return { ...f, structuralPriority: 0 };

            // High priority: corridor cells (lead to new areas)
            if (fCell.type === 'corridor') {
                structuralPriority += 10;
            }

            // If we're in a corridor, prioritize cells in predicted room directions
            if (structure.inCorridor && structure.likelyRoomDirections.length > 0) {
                for (const roomDir of structure.likelyRoomDirections) {
                    const [dx, dy] = this._directionToDelta(roomDir.direction);
                    const fDx = f.x - px;
                    const fDy = f.y - py;

                    // Check if frontier cell is in the predicted direction
                    const sameDirection = (
                        (dx > 0 && fDx > 0) || (dx < 0 && fDx < 0) ||
                        (dy > 0 && fDy > 0) || (dy < 0 && fDy < 0)
                    );

                    if (sameDirection) {
                        structuralPriority += 20; // Very high priority for predicted room direction
                    }
                }
            }

            // If we're in a corridor, deprioritize going backwards
            if (structure.inCorridor && structure.isStraight) {
                // Detect if this frontier cell is "behind" us in the corridor
                // (implementation would need to track which direction we came from)
                // For now, prioritize cells ahead
            }

            return { ...f, structuralPriority };
        });

        // Sort by structural priority (descending), then by searchScore (ascending)
        prioritized.sort((a, b) => {
            if (a.structuralPriority !== b.structuralPriority) {
                return b.structuralPriority - a.structuralPriority;
            }
            return a.searchScore - b.searchScore;
        });

        return prioritized;
    }

    /**
     * Analyze map coverage by quadrant to identify underexplored regions.
     * Returns exploration percentage for each quadrant (NW, NE, SW, SE).
     */
    getQuadrantCoverage() {
        const midX = Math.floor(MAP_COLS / 2); // 40
        const midY = Math.floor(MAP_ROWS / 2); // 10

        const quadrants = {
            NW: { explored: 0, total: 0 },
            NE: { explored: 0, total: 0 },
            SW: { explored: 0, total: 0 },
            SE: { explored: 0, total: 0 }
        };

        for (let y = 0; y < MAP_ROWS; y++) {
            for (let x = 0; x < MAP_COLS; x++) {
                const cell = this.cells[y][x];
                const quadrant = (y < midY ? 'N' : 'S') + (x < midX ? 'W' : 'E');

                quadrants[quadrant].total++;
                if (cell.explored) {
                    quadrants[quadrant].explored++;
                }
            }
        }

        return {
            NW: quadrants.NW.explored / quadrants.NW.total,
            NE: quadrants.NE.explored / quadrants.NE.total,
            SW: quadrants.SW.explored / quadrants.SW.total,
            SE: quadrants.SE.explored / quadrants.SE.total
        };
    }

    /**
     * Calculate the centroid (center of mass) of unexplored space.
     * Returns {x, y} pointing toward where unexplored areas are concentrated.
     * Returns null if everything is explored.
     */
    getUnexploredCentroid() {
        let sumX = 0, sumY = 0, count = 0;

        for (let y = 0; y < MAP_ROWS; y++) {
            for (let x = 0; x < MAP_COLS; x++) {
                const cell = this.cells[y][x];
                if (!cell.explored) {
                    sumX += x;
                    sumY += y;
                    count++;
                }
            }
        }

        if (count === 0) return null;

        return {
            x: Math.round(sumX / count),
            y: Math.round(sumY / count),
            mass: count  // how many unexplored cells
        };
    }

    /**
     * Determine which direction the agent should prioritize for exploration
     * based on quadrant coverage imbalance.
     * Returns {direction: 'N'|'S'|'E'|'W'|null, priority: number}
     */
    getExplorationBias() {
        const coverage = this.getQuadrantCoverage();

        // Calculate N vs S and E vs W coverage
        const northCoverage = (coverage.NW + coverage.NE) / 2;
        const southCoverage = (coverage.SW + coverage.SE) / 2;
        const westCoverage = (coverage.NW + coverage.SW) / 2;
        const eastCoverage = (coverage.NE + coverage.SE) / 2;

        // Find the most underexplored direction
        const biases = [
            { direction: 'N', coverage: northCoverage, bias: southCoverage - northCoverage },
            { direction: 'S', coverage: southCoverage, bias: northCoverage - southCoverage },
            { direction: 'W', coverage: westCoverage, bias: eastCoverage - westCoverage },
            { direction: 'E', coverage: eastCoverage, bias: westCoverage - eastCoverage }
        ];

        // Sort by bias (most underexplored first)
        biases.sort((a, b) => b.bias - a.bias);

        // Only return a bias if there's significant imbalance (>10% difference)
        if (biases[0].bias > 0.10) {
            return {
                direction: biases[0].direction,
                priority: biases[0].bias,
                coverage: biases[0].coverage
            };
        }

        return { direction: null, priority: 0 };
    }
}

/**
 * Tracks the entire dungeon across all levels.
 */
export class DungeonTracker {
    constructor() {
        this.levels = {};       // depth → LevelMap
        this.currentDepth = 1;
        this.maxDepthReached = 1;
        this.turnCount = 0;
    }

    /**
     * Get or create the map for a given depth.
     */
    getLevel(depth) {
        if (!this.levels[depth]) {
            this.levels[depth] = new LevelMap(depth);
        }
        return this.levels[depth];
    }

    /**
     * Get the current level map.
     */
    get currentLevel() {
        return this.getLevel(this.currentDepth);
    }

    /**
     * Update the tracker with a new screen observation.
     * Automatically detects level changes via dungeon level in status.
     */
    update(screen, status) {
        if (status && status.valid) {
            const newDepth = status.dungeonLevel;
            if (newDepth > 0 && newDepth !== this.currentDepth) {
                this.currentDepth = newDepth;
                if (newDepth > this.maxDepthReached) {
                    this.maxDepthReached = newDepth;
                }
            }
            this.turnCount = status.turns;
        }

        const level = this.currentLevel;
        level.update(screen, this.turnCount);
    }
}

// Direction arrays
const DIRS = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1],
];

const CARDINAL_DIRS = [
    [0, -1], [-1, 0], [1, 0], [0, 1],
];

/**
 * Determine if a cell type is walkable.
 */
function isWalkable(type) {
    switch (type) {
        case 'floor':
        case 'corridor':
        case 'door_open':
        case 'door_closed':
        case 'stairs_up':
        case 'stairs_down':
        case 'fountain':
        case 'altar':
        case 'throne':
        case 'grave':
        case 'trap':
        case 'gold':
        case 'item':
        case 'monster':
        case 'player':
            return true;
        default:
            return false;
    }
}
