// selfplay/test/test_occupancy.js -- Unit tests for occupancy map secret door search

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    buildOccupancyGrid,
    gaussianBlur,
    findHiddenComponents,
    scoreSearchCandidates
} from '../perception/occupancy_map.js';

// Mock MapLevel for testing
class MockMapLevel {
    constructor(exploredCells) {
        this.exploredCells = exploredCells; // Set of "x,y" strings
    }

    at(x, y) {
        const key = `${x},${y}`;
        const explored = this.exploredCells.has(key);
        return explored ? { explored: true, type: 'floor', searchCount: 0 } : { explored: false, type: 'wall', searchCount: 0 };
    }
}

describe('Occupancy Map Secret Door Search', () => {
    describe('buildOccupancyGrid', () => {
        it('should return 1.0 for unexplored cells', () => {
            const exploredCells = new Set(['10,10', '11,10', '12,10']);
            const mockLevel = new MockMapLevel(exploredCells);

            const grid = buildOccupancyGrid(mockLevel);

            // Unexplored cell should be 1.0
            assert.strictEqual(grid[15][10], 1.0);
            assert.strictEqual(grid[20][10], 1.0);
        });

        it('should return 0.0 for explored cells', () => {
            const exploredCells = new Set(['10,10', '11,10', '12,10']);
            const mockLevel = new MockMapLevel(exploredCells);

            const grid = buildOccupancyGrid(mockLevel);

            // Explored cells should be 0.0
            assert.strictEqual(grid[10][10], 0.0);
            assert.strictEqual(grid[11][10], 0.0);
            assert.strictEqual(grid[12][10], 0.0);
        });

        it('should create 80x21 grid', () => {
            const exploredCells = new Set();
            const mockLevel = new MockMapLevel(exploredCells);

            const grid = buildOccupancyGrid(mockLevel);

            assert.strictEqual(grid.length, 80, 'Grid should have 80 columns');
            assert.strictEqual(grid[0].length, 21, 'Grid should have 21 rows');
            assert.strictEqual(grid[79].length, 21, 'Last column should have 21 rows');
        });
    });

    describe('gaussianBlur', () => {
        it('should spread values to neighbors', () => {
            // Create grid with single 1.0 cell in center
            const grid = Array(80).fill().map(() => Array(21).fill(0.0));
            grid[40][10] = 1.0;

            const blurred = gaussianBlur(grid, 2.0);

            // Center should still have highest value
            const centerValue = blurred[40][10];
            assert.ok(centerValue > 0, 'Center should have positive value');

            // Neighbors should have lower but positive values
            const neighborValue = blurred[40][11];
            assert.ok(neighborValue > 0, 'Neighbor should have positive value');
            assert.ok(neighborValue < centerValue, 'Neighbor should be less than center');

            // Distant cell should have very low value
            const distantValue = blurred[40][15];
            assert.ok(distantValue < neighborValue, 'Distant cell should be less than neighbor');
        });

        it('should have higher values at cluster centers', () => {
            // Create 5x5 block of 1.0 values
            const grid = Array(80).fill().map(() => Array(21).fill(0.0));
            for (let x = 38; x <= 42; x++) {
                for (let y = 8; y <= 12; y++) {
                    grid[x][y] = 1.0;
                }
            }

            const blurred = gaussianBlur(grid, 2.0);

            // Center of cluster should have high value
            const centerValue = blurred[40][10];
            // Edge of cluster should have lower value
            const edgeValue = blurred[38][8];

            assert.ok(centerValue > edgeValue, 'Center should have higher value than edge');
            assert.ok(centerValue > 0.5, 'Center of 5x5 cluster should have value > 0.5 after blur');
        });

        it('should normalize kernel (preserve total intensity)', () => {
            // Create grid with some 1.0 cells
            const grid = Array(80).fill().map(() => Array(21).fill(0.0));
            grid[40][10] = 1.0;
            grid[40][11] = 1.0;

            const blurred = gaussianBlur(grid, 2.0);

            // Sum of blurred values should be close to sum of original values
            // (within numerical precision, accounting for boundary effects)
            let originalSum = 0;
            let blurredSum = 0;

            for (let x = 35; x < 45; x++) {
                for (let y = 5; y < 15; y++) {
                    originalSum += grid[x][y];
                    blurredSum += blurred[x][y];
                }
            }

            // Should be approximately equal (within 10% due to boundary effects)
            const ratio = blurredSum / originalSum;
            assert.ok(ratio > 0.9 && ratio < 1.1, `Intensity should be preserved (ratio=${ratio})`);
        });
    });

    describe('findHiddenComponents', () => {
        it('should identify large connected regions', () => {
            // Create grid with 60-cell cluster above threshold
            const grid = Array(80).fill().map(() => Array(21).fill(0.0));

            // Create 6x10 = 60 cell region with value 1.0
            for (let x = 35; x <= 40; x++) {
                for (let y = 5; y <= 14; y++) {
                    grid[x][y] = 1.0;
                }
            }

            const components = findHiddenComponents(grid, 50);

            assert.strictEqual(components.length, 1, 'Should find 1 component');
            assert.ok(components[0].cells.length >= 50, 'Component should have ≥50 cells');
            assert.strictEqual(components[0].id, 0, 'First component should have id=0');
        });

        it('should filter out small components', () => {
            // Create grid with 40-cell cluster (below 50 threshold)
            const grid = Array(80).fill().map(() => Array(21).fill(0.0));

            // Create 5x8 = 40 cell region
            for (let x = 35; x <= 39; x++) {
                for (let y = 5; y <= 12; y++) {
                    grid[x][y] = 1.0;
                }
            }

            const components = findHiddenComponents(grid, 50);

            assert.strictEqual(components.length, 0, 'Should filter out components <50 cells');
        });

        it('should identify multiple separate components', () => {
            // Create grid with 2 separate 60-cell clusters
            const grid = Array(80).fill().map(() => Array(21).fill(0.0));

            // First cluster (6x10 = 60 cells)
            for (let x = 20; x <= 25; x++) {
                for (let y = 5; y <= 14; y++) {
                    grid[x][y] = 1.0;
                }
            }

            // Second cluster (6x10 = 60 cells), separate from first
            for (let x = 50; x <= 55; x++) {
                for (let y = 5; y <= 14; y++) {
                    grid[x][y] = 1.0;
                }
            }

            const components = findHiddenComponents(grid, 50);

            assert.strictEqual(components.length, 2, 'Should find 2 separate components');
            assert.strictEqual(components[0].id, 0, 'First component id=0');
            assert.strictEqual(components[1].id, 1, 'Second component id=1');
        });

        it('should track boundary walls', () => {
            // Create grid with cluster and verify boundary is detected
            const grid = Array(80).fill().map(() => Array(21).fill(0.0));

            // Create 4x4 = 16 cell cluster (too small, but we'll test with minSize=10)
            for (let x = 40; x <= 43; x++) {
                for (let y = 10; y <= 13; y++) {
                    grid[x][y] = 1.0;
                }
            }

            const components = findHiddenComponents(grid, 10);

            assert.strictEqual(components.length, 1, 'Should find component with minSize=10');
            assert.ok(components[0].boundary.length > 0, 'Component should have boundary cells');

            // Boundary should include cells adjacent to cluster
            const boundaryXs = components[0].boundary.map(b => b.x);
            assert.ok(boundaryXs.includes(39) || boundaryXs.includes(44), 'Boundary should include cells adjacent to cluster');
        });
    });

    describe('scoreSearchCandidates', () => {
        it('should score close walls better than far walls', () => {
            // Create components with walls at different distances
            const components = [{
                id: 0,
                cells: [{x: 40, y: 10}],
                boundary: [{x: 39, y: 10}, {x: 50, y: 10}] // Close vs far walls
            }];

            const playerPos = {x: 38, y: 10};

            // Mock level that reports all boundary cells as walls
            const mockLevel = {
                at(x, y) {
                    return {type: 'wall', searchCount: 0};
                }
            };

            const candidates = scoreSearchCandidates(components, playerPos, mockLevel);

            // Close wall (39, 10) should be first
            // Far wall (50, 10) should be last
            assert.strictEqual(candidates[0].x, 39, 'Closest wall should be first');
            assert.strictEqual(candidates[0].y, 10);
            assert.ok(candidates[0].score < candidates[1].score, 'Close wall should have lower score than far wall');
        });

        it('should score unsearched walls better than searched walls', () => {
            const components = [{
                id: 0,
                cells: [{x: 40, y: 10}],
                boundary: [{x: 39, y: 10}, {x: 41, y: 10}] // Two walls at same distance
            }];

            const playerPos = {x: 40, y: 10};

            // Mock level: one wall searched 5 times, one unsearched
            const mockLevel = {
                at(x, y) {
                    if (x === 39) {
                        return {type: 'wall', searchCount: 5};
                    }
                    return {type: 'wall', searchCount: 0};
                }
            };

            const candidates = scoreSearchCandidates(components, playerPos, mockLevel);

            // Unsearched wall (41, 10) should be first
            assert.strictEqual(candidates[0].x, 41, 'Unsearched wall should be first');
            assert.ok(candidates[0].score < candidates[1].score, 'Unsearched should have lower score than searched');
        });

        it('should return sorted list (ascending score)', () => {
            const components = [{
                id: 0,
                cells: [{x: 40, y: 10}],
                boundary: [
                    {x: 39, y: 10}, // Close, unsearched
                    {x: 50, y: 10}, // Far, unsearched
                    {x: 40, y: 11}, // Medium distance, searched
                ]
            }];

            const playerPos = {x: 38, y: 10};

            const mockLevel = {
                at(x, y) {
                    if (x === 40 && y === 11) {
                        return {type: 'wall', searchCount: 10};
                    }
                    return {type: 'wall', searchCount: 0};
                }
            };

            const candidates = scoreSearchCandidates(components, playerPos, mockLevel);

            // Verify sorted in ascending score order
            for (let i = 1; i < candidates.length; i++) {
                assert.ok(candidates[i].score >= candidates[i-1].score, `Candidate ${i} should have score >= candidate ${i-1}`);
            }
        });

        it('should handle empty components', () => {
            const components = [];
            const playerPos = {x: 40, y: 10};
            const mockLevel = {at() { return {type: 'wall', searchCount: 0}; }};

            const candidates = scoreSearchCandidates(components, playerPos, mockLevel);

            assert.strictEqual(candidates.length, 0, 'Should return empty array for no components');
        });

        it('should filter out non-wall cells', () => {
            const components = [{
                id: 0,
                cells: [{x: 40, y: 10}],
                boundary: [
                    {x: 39, y: 10}, // Wall
                    {x: 40, y: 11}, // Floor (not a wall)
                ]
            }];

            const playerPos = {x: 38, y: 10};

            const mockLevel = {
                at(x, y) {
                    if (x === 40 && y === 11) {
                        return {type: 'floor', searchCount: 0}; // Not a wall
                    }
                    return {type: 'wall', searchCount: 0};
                }
            };

            const candidates = scoreSearchCandidates(components, playerPos, mockLevel);

            // Should only include the wall, not the floor
            assert.strictEqual(candidates.length, 1, 'Should filter out non-walls');
            assert.strictEqual(candidates[0].x, 39);
            assert.strictEqual(candidates[0].y, 10);
        });
    });
});
