/**
 * Occupancy Map Secret Door Search
 *
 * Implements the occupancy map approach from Campbell & Verbrugge 2017
 * to identify likely secret door locations.
 *
 * Key insight: Use diffusion to identify large unexplored regions ("hidden components"),
 * then only search walls adjacent to these components (not all frontier walls).
 *
 * Expected impact: 2x efficiency (500 vs 1100 actions for 90% discovery rate)
 */

/**
 * Build occupancy grid from current map state.
 * Unexplored cells = 1.0, explored cells = 0.0
 *
 * @param {MapLevel} levelMap - Map level from map_tracker.js
 * @returns {Array<Array<number>>} 2D grid [80][21] with occupancy values
 */
export function buildOccupancyGrid(levelMap) {
    const grid = [];

    // NetHack map dimensions (80 cols × 21 rows)
    const MAP_COLS = 80;
    const MAP_ROWS = 21;

    for (let x = 0; x < MAP_COLS; x++) {
        grid[x] = [];
        for (let y = 0; y < MAP_ROWS; y++) {
            const cell = levelMap.at(x, y);

            // 1.0 = unexplored, 0.0 = explored
            if (!cell || !cell.explored) {
                grid[x][y] = 1.0;
            } else {
                grid[x][y] = 0.0;
            }
        }
    }

    return grid;
}

/**
 * Apply Gaussian blur diffusion to occupancy grid.
 * High values after blur indicate clusters of unexplored space.
 *
 * @param {Array<Array<number>>} grid - Occupancy grid from buildOccupancyGrid()
 * @param {number} sigma - Gaussian kernel standard deviation (default 2.0)
 * @returns {Array<Array<number>>} Blurred grid with same dimensions
 */
export function gaussianBlur(grid, sigma = 2.0) {
    const width = grid.length;      // 80
    const height = grid[0].length;  // 24
    const blurred = [];

    // Build Gaussian kernel
    const kernelSize = Math.ceil(sigma * 3) * 2 + 1; // 5x5 for sigma=2.0
    const kernel = [];
    const center = Math.floor(kernelSize / 2);
    let kernelSum = 0;

    for (let ky = 0; ky < kernelSize; ky++) {
        kernel[ky] = [];
        for (let kx = 0; kx < kernelSize; kx++) {
            const dy = ky - center;
            const dx = kx - center;
            const value = Math.exp(-(dx*dx + dy*dy) / (2 * sigma * sigma));
            kernel[ky][kx] = value;
            kernelSum += value;
        }
    }

    // Normalize kernel (sum = 1.0)
    for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
            kernel[ky][kx] /= kernelSum;
        }
    }

    // Apply convolution
    for (let x = 0; x < width; x++) {
        blurred[x] = [];
        for (let y = 0; y < height; y++) {
            let sum = 0;

            // Convolve with kernel
            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    const sampleX = x + kx - center;
                    const sampleY = y + ky - center;

                    // Handle boundaries (treat out-of-bounds as 0.0 = explored)
                    if (sampleX >= 0 && sampleX < width &&
                        sampleY >= 0 && sampleY < height) {
                        sum += grid[sampleX][sampleY] * kernel[ky][kx];
                    }
                }
            }

            blurred[x][y] = sum;
        }
    }

    return blurred;
}

/**
 * Find hidden components - large connected regions of high occupancy.
 * These represent unexplored areas likely behind secret doors.
 *
 * @param {Array<Array<number>>} grid - Blurred occupancy grid
 * @param {number} minSize - Minimum cells for a component (default 50)
 * @returns {Array<Object>} Components: [{id, cells: [{x,y}], boundary: [{x,y}]}]
 */
export function findHiddenComponents(grid, minSize = 50) {
    const width = grid.length;
    const height = grid[0].length;
    const visited = Array(width).fill().map(() => Array(height).fill(false));
    const components = [];
    let componentId = 0;

    // Threshold for "high occupancy" (cells with ≥0.5 after blur)
    const threshold = 0.5;

    // Flood fill to find connected components
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            if (!visited[x][y] && grid[x][y] >= threshold) {
                const component = floodFill(grid, visited, x, y, threshold);

                // Keep only large components (≥50 cells)
                if (component.cells.length >= minSize) {
                    component.id = componentId++;
                    components.push(component);
                }
            }
        }
    }

    return components;
}

/**
 * Flood fill helper to find connected component.
 * Uses 8-connectivity (including diagonals).
 *
 * @param {Array<Array<number>>} grid - Occupancy grid
 * @param {Array<Array<boolean>>} visited - Visited cells tracker
 * @param {number} startX - Starting x position
 * @param {number} startY - Starting y position
 * @param {number} threshold - Occupancy threshold (0.5)
 * @returns {Object} Component: {cells: [{x,y}], boundary: [{x,y}]}
 */
function floodFill(grid, visited, startX, startY, threshold) {
    const cells = [];
    const boundaryWalls = new Set(); // Store as "x,y" strings
    const stack = [{x: startX, y: startY}];
    const width = grid.length;
    const height = grid[0].length;

    while (stack.length > 0) {
        const {x, y} = stack.pop();

        // Already visited
        if (visited[x][y]) continue;

        // Out of bounds
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        // Below threshold - not part of component
        if (grid[x][y] < threshold) continue;

        visited[x][y] = true;
        cells.push({x, y});

        // Check 8 neighbors (including diagonals for component detection)
        const neighbors = [
            {x: x-1, y: y-1}, {x: x, y: y-1}, {x: x+1, y: y-1},
            {x: x-1, y: y},                    {x: x+1, y: y},
            {x: x-1, y: y+1}, {x: x, y: y+1}, {x: x+1, y: y+1}
        ];

        for (const n of neighbors) {
            if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
                if (grid[n.x][n.y] >= threshold && !visited[n.x][n.y]) {
                    stack.push(n);
                } else if (grid[n.x][n.y] < threshold) {
                    // This is a boundary (potential wall location)
                    boundaryWalls.add(`${n.x},${n.y}`);
                }
            }
        }
    }

    // Convert boundary set to array
    const boundary = Array.from(boundaryWalls).map(str => {
        const [x, y] = str.split(',').map(Number);
        return {x, y};
    });

    return {cells, boundary};
}

/**
 * Score and rank wall positions adjacent to hidden components.
 * Prioritizes walls that are: (1) close to player, (2) not previously searched.
 *
 * Formula: minimize (1-σ)·norm_count + σ·norm_dist where σ=0.7
 * - norm_count: normalized search history (0 = never searched, 1 = most searched)
 * - norm_dist: normalized distance from player (0 = at player, 1 = farthest)
 * - σ=0.7: 70% weight on distance, 30% on search history
 *
 * @param {Array<Object>} components - Components from findHiddenComponents()
 * @param {Object} playerPos - {x, y} current player position
 * @param {MapLevel} levelMap - Map level to check walls and search history
 * @returns {Array<Object>} Sorted candidates: [{x, y, score, componentId}]
 */
export function scoreSearchCandidates(components, playerPos, levelMap) {
    const candidates = [];
    const sigma = 0.7; // Weight toward distance (0.7) vs search count (0.3)

    // Track maxima for normalization
    let maxSearchCount = 0;
    let maxDistance = 0;

    // First pass: collect all wall candidates and compute maxima
    for (const component of components) {
        for (const pos of component.boundary) {
            const cell = levelMap.at(pos.x, pos.y);

            // Only consider actual walls (not doors, not walkable)
            if (!cell || cell.type !== 'wall') continue;

            const searchCount = cell.searchCount || 0;
            maxSearchCount = Math.max(maxSearchCount, searchCount);

            // Chebyshev distance (max of |dx|, |dy|)
            const dist = Math.max(
                Math.abs(pos.x - playerPos.x),
                Math.abs(pos.y - playerPos.y)
            );
            maxDistance = Math.max(maxDistance, dist);

            candidates.push({
                x: pos.x,
                y: pos.y,
                componentId: component.id,
                searchCount,
                distance: dist
            });
        }
    }

    // Avoid division by zero
    if (maxSearchCount === 0) maxSearchCount = 1;
    if (maxDistance === 0) maxDistance = 1;

    // Second pass: compute scores
    for (const cand of candidates) {
        const normCount = cand.searchCount / maxSearchCount;
        const normDist = cand.distance / maxDistance;

        // Formula: minimize (1-σ)·norm_count + σ·norm_dist
        // Lower score = better (close to player + unsearched)
        cand.score = (1 - sigma) * normCount + sigma * normDist;
    }

    // Sort by score (lower = better)
    candidates.sort((a, b) => a.score - b.score);

    return candidates;
}
