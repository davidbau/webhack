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
        this.searched = 0;       // how many times we've searched adjacent to this cell
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

                cell.ch = screenCell.ch;
                cell.color = screenCell.color;
                cell.type = screenCell.type;
                cell.explored = true;
                cell.stale = false;
                cell.lastSeenTurn = turn;

                // Classify walkability
                cell.walkable = isWalkable(screenCell.type);

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
                if (this.cells[y][x].explored) continue;
                // Check if any neighbor is explored and walkable
                if (this._hasWalkableNeighbor(x, y)) {
                    // Score based on how much adjacent cells have been searched
                    // High search count = probably stone (deprioritize)
                    const searchScore = this._neighborSearchScore(x, y);
                    frontier.push({ x, y, searchScore });
                }
            }
        }
        // Sort: least-searched neighbors first (most likely to be real openings)
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
                if (this._hasAdjacentWall(x, y) && cell.searched < 20) {
                    candidates.push({ x, y, searched: cell.searched });
                }
            }
        }
        // Sort by least-searched first
        candidates.sort((a, b) => a.searched - b.searched);
        return candidates;
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
