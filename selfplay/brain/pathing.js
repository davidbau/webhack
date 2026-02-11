// selfplay/brain/pathing.js -- A* pathfinding on the agent's known map
//
// Provides shortest-path navigation, exploration frontier finding, and
// danger-aware routing on the agent's map memory.

const MAP_COLS = 80;
const MAP_ROWS = 21;

// 8-directional neighbors (matches NetHack movement)
const DIRS = [
    { dx: -1, dy: -1, key: 'y' },  // NW
    { dx:  0, dy: -1, key: 'k' },  // N
    { dx:  1, dy: -1, key: 'u' },  // NE
    { dx: -1, dy:  0, key: 'h' },  // W
    { dx:  1, dy:  0, key: 'l' },  // E
    { dx: -1, dy:  1, key: 'b' },  // SW
    { dx:  0, dy:  1, key: 'j' },  // S
    { dx:  1, dy:  1, key: 'n' },  // SE
];

/**
 * Movement costs for different cell types.
 */
const MOVE_COST = {
    floor: 1,
    corridor: 1,
    door_open: 1,
    door_closed: 3,     // need to open it
    door_locked: Infinity,  // can't pass without unlocking/kicking
    stairs_up: 1,
    stairs_down: 1,
    fountain: 1,
    altar: 1,
    throne: 1,
    grave: 1,
    trap: 8,             // prefer to avoid known traps
    gold: 1,
    item: 1,
    player: 0,           // our own position
    monster: 15,          // prefer to avoid, but not impassable
    wall: Infinity,
    stone: Infinity,
    water: Infinity,
    lava: Infinity,
    iron_bars: Infinity,
    tree: Infinity,
    unknown: Infinity,
};

/**
 * A* pathfinding result.
 */
export class PathResult {
    constructor(path, cost) {
        this.path = path;       // array of {x, y} from start to goal
        this.cost = cost;       // total path cost
        this.found = path.length > 0;
    }

    /**
     * Get the first step direction key (h/j/k/l/y/u/b/n) to follow this path.
     */
    get firstKey() {
        if (this.path.length < 2) return null;
        const from = this.path[0];
        const to = this.path[1];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        return directionKey(dx, dy);
    }

    /**
     * Get the next position along this path.
     */
    get nextPos() {
        return this.path.length >= 2 ? this.path[1] : null;
    }
}

/**
 * Find shortest path from (sx,sy) to (gx,gy) on the given level map.
 *
 * @param {LevelMap} levelMap - The agent's map memory for this level
 * @param {number} sx - start x
 * @param {number} sy - start y
 * @param {number} gx - goal x
 * @param {number} gy - goal y
 * @param {Object} [opts] - options
 * @param {boolean} [opts.allowUnexplored=false] - allow pathing through unexplored cells
 * @param {Set} [opts.avoidPositions] - positions to avoid (e.g., known monster locations)
 * @returns {PathResult}
 */
export function findPath(levelMap, sx, sy, gx, gy, opts = {}) {
    const { allowUnexplored = false, avoidPositions = null } = opts;

    // Edge case: if start equals goal, return empty path (not found)
    // This prevents returning a 1-element path with firstKey=null
    if (sx === gx && sy === gy) {
        return new PathResult([], Infinity);
    }

    // A* with Manhattan distance heuristic
    const openSet = new MinHeap();
    const gScore = new Float64Array(MAP_COLS * MAP_ROWS).fill(Infinity);
    const fScore = new Float64Array(MAP_COLS * MAP_ROWS).fill(Infinity);
    const cameFrom = new Int32Array(MAP_COLS * MAP_ROWS).fill(-1);

    const idx = (x, y) => y * MAP_COLS + x;
    const heuristic = (x, y) => Math.max(Math.abs(x - gx), Math.abs(y - gy)); // Chebyshev

    const startIdx = idx(sx, sy);
    gScore[startIdx] = 0;
    fScore[startIdx] = heuristic(sx, sy);
    openSet.push(startIdx, fScore[startIdx]);

    while (openSet.size > 0) {
        const currentIdx = openSet.pop();
        const cx = currentIdx % MAP_COLS;
        const cy = (currentIdx - cx) / MAP_COLS;

        // Goal reached
        if (cx === gx && cy === gy) {
            return new PathResult(reconstructPath(cameFrom, currentIdx, sx, sy), gScore[currentIdx]);
        }

        for (const dir of DIRS) {
            const nx = cx + dir.dx;
            const ny = cy + dir.dy;

            if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) continue;

            const cell = levelMap.at(nx, ny);
            if (!cell) continue;

            // Cost calculation
            let cost;
            if (!cell.explored) {
                if (!allowUnexplored) continue;
                cost = 2; // mild preference for known paths
            } else {
                cost = MOVE_COST[cell.type] || Infinity;
            }

            if (cost >= Infinity) continue;

            // Avoid specific positions (e.g., dangerous monsters)
            if (avoidPositions && avoidPositions.has(idx(nx, ny))) {
                cost += 50;
            }

            // Diagonal movement through doorways is blocked in NetHack
            if (Math.abs(dir.dx) + Math.abs(dir.dy) === 2) {
                // Check if diagonal passes through a door
                const c1 = levelMap.at(cx + dir.dx, cy);
                const c2 = levelMap.at(cx, cy + dir.dy);
                if (c1 && isDoorType(c1.type) || c2 && isDoorType(c2.type)) {
                    continue; // can't move diagonally through doors
                }
                const currentCell = levelMap.at(cx, cy);
                if (currentCell && isDoorType(currentCell.type)) {
                    continue; // can't move diagonally from a door
                }
                // Can't move diagonally INTO a door either
                const destCell = levelMap.at(nx, ny);
                if (destCell && destCell.explored && isDoorType(destCell.type)) {
                    continue;
                }
            }

            const tentativeG = gScore[currentIdx] + cost;
            const neighborIdx = idx(nx, ny);

            if (tentativeG < gScore[neighborIdx]) {
                cameFrom[neighborIdx] = currentIdx;
                gScore[neighborIdx] = tentativeG;
                fScore[neighborIdx] = tentativeG + heuristic(nx, ny);
                openSet.push(neighborIdx, fScore[neighborIdx]);
            }
        }
    }

    // No path found
    return new PathResult([], Infinity);
}

/**
 * Find the nearest target of a given type from (sx, sy).
 * Uses BFS for finding nearest, then A* for the path.
 *
 * @param {LevelMap} levelMap
 * @param {number} sx - start x
 * @param {number} sy - start y
 * @param {function} predicate - (cell, x, y) => boolean, true for targets
 * @returns {PathResult|null} - path to nearest matching cell, or null
 */
export function findNearest(levelMap, sx, sy, predicate) {
    // BFS to find nearest
    const visited = new Uint8Array(MAP_COLS * MAP_ROWS);
    const queue = [{ x: sx, y: sy }];
    const idx = (x, y) => y * MAP_COLS + x;
    visited[idx(sx, sy)] = 1;

    while (queue.length > 0) {
        const { x, y } = queue.shift();
        const cell = levelMap.at(x, y);

        if (cell && predicate(cell, x, y) && (x !== sx || y !== sy)) {
            // Found a match -- now pathfind to it
            return findPath(levelMap, sx, sy, x, y);
        }

        for (const dir of DIRS) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) continue;
            if (visited[idx(nx, ny)]) continue;
            visited[idx(nx, ny)] = 1;

            const ncell = levelMap.at(nx, ny);
            if (!ncell || !ncell.explored) continue;
            if (!ncell.walkable && !predicate(ncell, nx, ny)) continue;

            queue.push({ x: nx, y: ny });
        }
    }

    return null; // nothing found
}

/**
 * Find the nearest unexplored reachable cell (exploration frontier).
 * Returns a path to the nearest walkable cell that borders unexplored space,
 * preferring cells that are actually in the direction of the unexplored area.
 *
 * @param {LevelMap} levelMap
 * @param {number} sx - start x
 * @param {number} sy - start y
 * @param {Set} [recentTargets] - recently-visited target positions to deprioritize
 * @returns {PathResult|null}
 */
export function findExplorationTarget(levelMap, sx, sy, recentTargets = null, options = {}) {
    // BFS outward from player, collecting ALL reachable frontier cells.
    // A frontier cell is an explored walkable cell that borders unexplored space.
    // Pick the best one considering: search history, distance, recency, and corridor continuation.
    //
    // options.preferFar: When true, prefer distant targets to break out of local loops
    const preferFar = options.preferFar || false;

    const visited = new Uint8Array(MAP_COLS * MAP_ROWS);
    const queue = [{ x: sx, y: sy, dist: 0 }];
    const idx = (x, y) => y * MAP_COLS + x;
    visited[idx(sx, sy)] = 1;

    const candidates = [];

    // Check if player is in a corridor and analyze structure
    const playerCell = levelMap.at(sx, sy);
    const playerInCorridor = playerCell && playerCell.type === 'corridor';

    // Analyze corridor structure to predict where rooms might be
    let structure = { inCorridor: false, likelyRoomDirections: [] };
    try {
        if (levelMap.analyzeCorridorStructure) {
            structure = levelMap.analyzeCorridorStructure(sx, sy) || structure;
        }
    } catch (err) {
        // Gracefully handle any errors in structural analysis
        console.error('[STRUCTURE] Analysis error:', err.message);
    }

    while (queue.length > 0) {
        const { x, y, dist } = queue.shift();

        const cell = levelMap.at(x, y);

        // Check if this explored walkable cell borders unexplored space
        if (cell && cell.explored && cell.walkable && (x !== sx || y !== sy)) {
            let hasUnexplored = false;
            let unexploredSearchScore = 0;
            for (const dir of DIRS) {
                const nx = x + dir.dx;
                const ny = y + dir.dy;
                if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) continue;
                const neighbor = levelMap.at(nx, ny);
                if (neighbor && !neighbor.explored) {
                    hasUnexplored = true;
                }
            }
            if (hasUnexplored) {
                const chebyshev = Math.max(Math.abs(x - sx), Math.abs(y - sy));
                const isRecent = recentTargets && recentTargets.has(idx(x, y));
                // How much has this cell been searched? High = less promising
                const searched = cell.searched || 0;

                // Is this target a corridor cell?
                const isCorridor = cell.type === 'corridor';

                // Check if target continues the corridor (player in corridor moving to adjacent corridor)
                const continuesCorridor = playerInCorridor && isCorridor && dist <= 3;

                // Structural priority: is this target in a predicted room direction?
                let inPredictedDirection = false;
                if (structure.inCorridor && structure.likelyRoomDirections && structure.likelyRoomDirections.length > 0 && levelMap._directionToDelta) {
                    try {
                        for (const roomDir of structure.likelyRoomDirections) {
                            const [dx, dy] = levelMap._directionToDelta(roomDir.direction);
                            const targetDx = x - sx;
                            const targetDy = y - sy;

                            // Check if target is in the same direction as predicted room
                            const sameDirection = (
                                (dx > 0 && targetDx > 0) || (dx < 0 && targetDx < 0) ||
                                (dy > 0 && targetDy > 0) || (dy < 0 && targetDy < 0)
                            );

                            if (sameDirection) {
                                inPredictedDirection = true;
                                break;
                            }
                        }
                    } catch (err) {
                        // Gracefully handle direction calculation errors
                    }
                }

                candidates.push({ x, y, dist, chebyshev, isRecent, searched, isCorridor, continuesCorridor, inPredictedDirection });
            }
        }

        // Continue BFS through walkable explored cells (no early termination)
        for (const dir of DIRS) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) continue;
            if (visited[idx(nx, ny)]) continue;
            visited[idx(nx, ny)] = 1;

            const ncell = levelMap.at(nx, ny);
            if (!ncell || !ncell.explored || !ncell.walkable) continue;

            queue.push({ x: nx, y: ny, dist: dist + 1 });
        }
    }

    if (candidates.length === 0) return null;

    // Get spatial awareness: which direction should we prioritize?
    let explorationBias = { direction: null, priority: 0 };
    try {
        if (levelMap.getExplorationBias) {
            explorationBias = levelMap.getExplorationBias();
        }
    } catch (err) {
        // Gracefully handle errors
    }

    // Calculate unexplored centroid for directional bias
    let unexploredCentroid = null;
    try {
        if (levelMap.getUnexploredCentroid) {
            unexploredCentroid = levelMap.getUnexploredCentroid();
        }
    } catch (err) {
        // Gracefully handle errors
    }

    // Score each candidate based on alignment with underexplored direction
    if (explorationBias.direction || unexploredCentroid) {
        for (const cand of candidates) {
            // Calculate if this target is in the underexplored direction
            cand.towardUnexplored = 0;

            if (unexploredCentroid) {
                // Higher score if moving toward unexplored centroid
                const currentDist = Math.sqrt(
                    (sx - unexploredCentroid.x) ** 2 + (sy - unexploredCentroid.y) ** 2
                );
                const targetDist = Math.sqrt(
                    (cand.x - unexploredCentroid.x) ** 2 + (cand.y - unexploredCentroid.y) ** 2
                );
                // Positive if target is closer to centroid than current position
                cand.towardUnexplored = (currentDist - targetDist) * explorationBias.priority;
            }
        }
    }

    // Sort by priority:
    // 1. Strongly prefer non-recently-visited
    // 2. Strongly prefer corridor continuation when in corridor (keeps exploring corridors to completion)
    // 3. Prefer targets toward unexplored regions (map-wide spatial awareness)
    // 4. Prefer targets in predicted room directions (local corridor structure)
    // 5. Prefer corridor cells over room cells (corridors lead to new areas)
    // 6. Prefer less-searched cells (more likely to lead somewhere)
    // 7. Among remaining, prefer nearest by BFS distance (or farthest if preferFar)
    //
    // Note: we do NOT penalize adjacent cells. In corridors, the next
    // frontier cell IS adjacent and we want to keep moving forward.
    // Path commitment handles oscillation instead.
    candidates.sort((a, b) => {
        if (a.isRecent !== b.isRecent) return a.isRecent ? 1 : -1;

        // Corridor continuation gets highest priority (when player is in corridor)
        if (a.continuesCorridor !== b.continuesCorridor) return a.continuesCorridor ? -1 : 1;

        // Spatial awareness: prefer targets toward unexplored regions
        // Only apply if there's significant bias (>0.5 score difference)
        if (a.towardUnexplored !== undefined && b.towardUnexplored !== undefined) {
            const diff = a.towardUnexplored - b.towardUnexplored;
            if (Math.abs(diff) > 0.5) {
                return b.towardUnexplored - a.towardUnexplored;  // Higher score = toward unexplored
            }
        }

        // Predicted room direction (based on local corridor structure)
        if (a.inPredictedDirection !== b.inPredictedDirection) return a.inPredictedDirection ? -1 : 1;

        // Corridor cells generally preferred over room cells
        if (a.isCorridor !== b.isCorridor) return a.isCorridor ? -1 : 1;

        // Strongly prefer unsearched over heavily-searched
        if (a.searched >= 3 && b.searched < 3) return 1;
        if (b.searched >= 3 && a.searched < 3) return -1;

        // When stuck, prefer FAR targets to break out of local loops
        if (preferFar) return b.dist - a.dist;  // Reverse sort for farthest first
        return a.dist - b.dist;  // Normal: nearest first
    });

    const target = candidates[0];
    return findPath(levelMap, sx, sy, target.x, target.y);
}

/**
 * Get the direction key for a movement delta.
 */
export function directionKey(dx, dy) {
    for (const dir of DIRS) {
        if (dir.dx === dx && dir.dy === dy) return dir.key;
    }
    return null;
}

/**
 * Get the direction delta for a movement key.
 */
export function directionDelta(key) {
    for (const dir of DIRS) {
        if (dir.key === key) return { dx: dir.dx, dy: dir.dy };
    }
    return null;
}

/**
 * Analyze if player is in a corridor and determine the best direction to continue.
 * A corridor is a narrow passage (typically '#' cells) connecting rooms.
 *
 * Returns {
 *   inCorridor: boolean,
 *   direction: string|null,  // direction key (h/j/k/l/etc) to continue corridor
 *   endReached: boolean      // true if corridor ends here (opens to room or dead-end)
 * }
 */
export function analyzeCorridorPosition(levelMap, px, py) {
    const cell = levelMap.at(px, py);
    if (!cell || !cell.explored) {
        return { inCorridor: false, direction: null, endReached: false };
    }

    // Must be on a corridor or floor cell
    const isCorridor = cell.type === 'corridor';
    const isFloor = cell.type === 'floor';

    if (!isCorridor && !isFloor) {
        return { inCorridor: false, direction: null, endReached: false };
    }

    // Count walkable neighbors (corridors, floors, open doors)
    let walkableNeighbors = [];
    let wallNeighbors = 0;

    for (const dir of DIRS) {
        const nx = px + dir.dx;
        const ny = py + dir.dy;
        if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) continue;

        const ncell = levelMap.at(nx, ny);
        if (!ncell || !ncell.explored) continue;

        if (ncell.walkable && (ncell.type === 'corridor' || ncell.type === 'floor' || ncell.type === 'door_open')) {
            walkableNeighbors.push({ dir, cell: ncell, x: nx, y: ny });
        } else if (ncell.type === 'wall' || ncell.type === 'stone') {
            wallNeighbors++;
        }
    }

    // Corridor characteristics:
    // - Exactly 2 walkable neighbors (linear path), OR
    // - 1 walkable neighbor (dead-end)
    // - Surrounded by walls (at least 4 wall neighbors)

    const isLinearPath = walkableNeighbors.length === 2;
    const isDeadEnd = walkableNeighbors.length === 1;
    const isJunction = walkableNeighbors.length >= 3;

    // If we're on a corridor cell or in a narrow passage
    if (isCorridor || (isFloor && wallNeighbors >= 4)) {
        if (isDeadEnd) {
            // Dead-end reached
            return { inCorridor: true, direction: null, endReached: true };
        } else if (isLinearPath) {
            // Find the direction that continues forward (not backwards)
            // Prefer corridor cells over floor cells
            const corridorDirs = walkableNeighbors.filter(n => n.cell.type === 'corridor');
            const candidates = corridorDirs.length > 0 ? corridorDirs : walkableNeighbors;

            // If we have 2 options, pick the first one (we'll alternate as we move)
            const nextDir = candidates[0].dir;
            return { inCorridor: true, direction: nextDir.key, endReached: false };
        } else if (isJunction) {
            // Reached a junction or room entrance
            return { inCorridor: true, direction: null, endReached: true };
        }
    }

    return { inCorridor: false, direction: null, endReached: false };
}

/**
 * Compute distances from (sx, sy) to all reachable cells.
 * Returns a 2D array where [y][x] = distance (-1 if unreachable).
 */
export function distanceMap(levelMap, sx, sy) {
    const dist = [];
    for (let y = 0; y < MAP_ROWS; y++) {
        dist[y] = new Int32Array(MAP_COLS).fill(-1);
    }

    const queue = [{ x: sx, y: sy, d: 0 }];
    dist[sy][sx] = 0;

    while (queue.length > 0) {
        const { x, y, d } = queue.shift();
        for (const dir of DIRS) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) continue;
            if (dist[ny][nx] >= 0) continue;
            const cell = levelMap.at(nx, ny);
            if (!cell || !cell.explored || !cell.walkable) continue;
            dist[ny][nx] = d + 1;
            queue.push({ x: nx, y: ny, d: d + 1 });
        }
    }

    return dist;
}

// --- Helpers ---

function isDoorType(type) {
    return type === 'door_open' || type === 'door_closed';
}

function reconstructPath(cameFrom, endIdx, sx, sy) {
    const path = [];
    let current = endIdx;
    while (current !== -1) {
        const x = current % MAP_COLS;
        const y = (current - x) / MAP_COLS;
        path.unshift({ x, y });
        if (x === sx && y === sy) break;
        current = cameFrom[current];
    }
    return path;
}

/**
 * Simple min-heap for A* open set.
 */
class MinHeap {
    constructor() {
        this.data = []; // [{idx, priority}]
    }

    get size() { return this.data.length; }

    push(idx, priority) {
        this.data.push({ idx, priority });
        this._bubbleUp(this.data.length - 1);
    }

    pop() {
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) {
            this.data[0] = last;
            this._sinkDown(0);
        }
        return top.idx;
    }

    _bubbleUp(i) {
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.data[i].priority >= this.data[parent].priority) break;
            [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
            i = parent;
        }
    }

    _sinkDown(i) {
        const n = this.data.length;
        while (true) {
            let smallest = i;
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            if (left < n && this.data[left].priority < this.data[smallest].priority) smallest = left;
            if (right < n && this.data[right].priority < this.data[smallest].priority) smallest = right;
            if (smallest === i) break;
            [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
            i = smallest;
        }
    }
}
