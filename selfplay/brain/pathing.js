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
export function findExplorationTarget(levelMap, sx, sy, recentTargets = null) {
    // BFS outward from player, collecting ALL reachable frontier cells.
    // A frontier cell is an explored walkable cell that borders unexplored space.
    // Pick the best one considering: search history, distance, and recency.
    const visited = new Uint8Array(MAP_COLS * MAP_ROWS);
    const queue = [{ x: sx, y: sy, dist: 0 }];
    const idx = (x, y) => y * MAP_COLS + x;
    visited[idx(sx, sy)] = 1;

    const candidates = [];

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

                candidates.push({ x, y, dist, chebyshev, isRecent, searched });
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

    // Sort by priority:
    // 1. Strongly prefer non-recently-visited
    // 2. Prefer less-searched cells (more likely to lead somewhere)
    // 3. Among remaining, prefer nearest by BFS distance
    //
    // Note: we do NOT penalize adjacent cells. In corridors, the next
    // frontier cell IS adjacent and we want to keep moving forward.
    // Path commitment handles oscillation instead.
    candidates.sort((a, b) => {
        if (a.isRecent !== b.isRecent) return a.isRecent ? 1 : -1;
        // Strongly prefer unsearched over heavily-searched
        if (a.searched >= 3 && b.searched < 3) return 1;
        if (b.searched >= 3 && a.searched < 3) return -1;
        return a.dist - b.dist;
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
