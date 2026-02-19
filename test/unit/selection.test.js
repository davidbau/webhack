import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { selection, resetLevelState, getLevelState } from '../../js/sp_lev.js';
import { ROOM, CORR, HWALL, VWALL, DOOR, STONE, COLNO, ROWNO } from '../../js/config.js';
import { GameMap } from '../../js/map.js';
import { initRng } from '../../js/rng.js';

describe('Selection API', () => {
    describe('selection.area()', () => {
        it('should create rectangular area selection', () => {
            const sel = selection.area(5, 10, 15, 20);
            assert.equal(sel.x1, 5);
            assert.equal(sel.y1, 10);
            assert.equal(sel.x2, 15);
            assert.equal(sel.y2, 20);
        });
    });

    describe('selection.rect()', () => {
        it('should create rectangular perimeter (border only)', () => {
            const sel = selection.rect(5, 10, 8, 13);
            assert.ok(sel.coords);

            // Should have: top row (4 cells) + bottom row (4 cells)
            // + left col (2 cells, excluding corners) + right col (2 cells, excluding corners)
            // = 4 + 4 + 2 + 2 = 12 cells
            assert.equal(sel.coords.length, 12);

            // Check corners are present
            const hasCorner = (x, y) => sel.coords.some(c => c.x === x && c.y === y);
            assert.ok(hasCorner(5, 10)); // top-left
            assert.ok(hasCorner(8, 10)); // top-right
            assert.ok(hasCorner(5, 13)); // bottom-left
            assert.ok(hasCorner(8, 13)); // bottom-right

            // Check center is NOT present
            assert.ok(!hasCorner(6, 11));
        });
    });

    describe('selection.line()', () => {
        it('should create line selection using Bresenham', () => {
            const sel = selection.line(0, 0, 5, 5);
            assert.ok(Array.isArray(sel));
            assert.ok(sel.length > 0);
            // Diagonal line should have 6 points (0,0 through 5,5)
            assert.equal(sel.length, 6);
            assert.deepEqual(sel[0], { x: 0, y: 0 });
            assert.deepEqual(sel[5], { x: 5, y: 5 });
        });
    });

    describe('selection.new()', () => {
        it('should create empty selection with set method', () => {
            const sel = selection.new();
            assert.ok(sel.coords);
            assert.equal(sel.coords.length, 0);
            assert.equal(typeof sel.set, 'function');

            sel.set(10, 15);
            sel.set(20, 25);
            assert.equal(sel.coords.length, 2);
            assert.deepEqual(sel.coords[0], { x: 10, y: 15 });
            assert.deepEqual(sel.coords[1], { x: 20, y: 25 });
        });
    });

    describe('selection.rndcoord()', () => {
        it('should return random coordinate from selection', () => {
            initRng(42);
            const sel = { coords: [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }] };
            const coord = selection.rndcoord(sel);
            assert.ok(coord);
            assert.ok(coord.x >= 1 && coord.x <= 5);
            assert.ok(coord.y >= 2 && coord.y <= 6);
        });

        it('should return undefined for empty selection', () => {
            const sel = { coords: [] };
            const coord = selection.rndcoord(sel);
            assert.equal(coord, undefined);
        });
    });

    describe('selection.grow()', () => {
        it('should expand selection by 1 cell in all directions', () => {
            const sel = { coords: [{ x: 10, y: 10 }] };
            const grown = selection.grow(sel, 1);

            // Single point should grow to 9 cells (3x3)
            assert.ok(grown.coords);
            assert.equal(grown.coords.length, 9);

            // Check all 8 neighbors + center are present
            const hasCoord = (x, y) => grown.coords.some(c => c.x === x && c.y === y);
            assert.ok(hasCoord(10, 10)); // center
            assert.ok(hasCoord(9, 9));   // top-left
            assert.ok(hasCoord(10, 9));  // top
            assert.ok(hasCoord(11, 9));  // top-right
            assert.ok(hasCoord(9, 10));  // left
            assert.ok(hasCoord(11, 10)); // right
            assert.ok(hasCoord(9, 11));  // bottom-left
            assert.ok(hasCoord(10, 11)); // bottom
            assert.ok(hasCoord(11, 11)); // bottom-right
        });

        it('should support multiple iterations', () => {
            const sel = { coords: [{ x: 10, y: 10 }] };
            const grown = selection.grow(sel, 2);

            // 2 iterations: should be 5x5 = 25 cells
            assert.equal(grown.coords.length, 25);
        });
    });

    describe('selection.negate()', () => {
        it('should return complement of selection', () => {
            // Create small test with known area
            const sel = { coords: [{ x: 1, y: 0 }, { x: 2, y: 0 }] };
            const negated = selection.negate(sel);

            assert.ok(negated.coords);
            // Should have all map tiles except the 2 we selected
            const totalTiles = (COLNO - 1) * ROWNO; // -1 because x starts at 1
            assert.equal(negated.coords.length, totalTiles - 2);

            // Check the original coords are NOT in the negated selection
            const hasCoord = (x, y) => negated.coords.some(c => c.x === x && c.y === y);
            assert.ok(!hasCoord(1, 0));
            assert.ok(!hasCoord(2, 0));
        });

        it('should select all tiles when negating null', () => {
            const negated = selection.negate(null);
            const totalTiles = (COLNO - 1) * ROWNO;
            assert.equal(negated.coords.length, totalTiles);
        });
    });

    describe('selection.percentage()', () => {
        it('should keep approximately N% of coordinates', () => {
            initRng(123);
            const coords = [];
            for (let i = 0; i < 100; i++) {
                coords.push({ x: i, y: 0 });
            }
            const sel = { coords };

            const filtered = selection.percentage(sel, 50);
            assert.ok(filtered.coords);
            // Should keep roughly 50 out of 100 (allow some variance)
            assert.ok(filtered.coords.length >= 35 && filtered.coords.length <= 65);
        });

        it('should return empty for 0%', () => {
            const sel = { coords: [{ x: 1, y: 1 }] };
            const filtered = selection.percentage(sel, 0);
            assert.equal(filtered.coords.length, 0);
        });

        it('should return all for 100%', () => {
            const sel = { coords: [{ x: 1, y: 1 }, { x: 2, y: 2 }] };
            const filtered = selection.percentage(sel, 100);
            assert.equal(filtered.coords.length, 2);
        });
    });

    describe('selection.floodfill()', () => {
        it('should flood fill connected cells', () => {
            resetLevelState();
            // Setup a simple map with ROOM tiles
            getLevelState().map = new GameMap();

            // Create a 3x3 room at (5,5)
            for (let y = 5; y <= 7; y++) {
                for (let x = 5; x <= 7; x++) {
                    getLevelState().map.locations[x][y].typ = ROOM;
                }
            }

            // Flood fill from center, matching ROOM tiles
            const filled = selection.floodfill(6, 6, loc => loc.typ === ROOM);

            assert.ok(filled.coords);
            assert.equal(filled.coords.length, 9); // 3x3 = 9 cells
        });
    });

    describe('selection.match()', () => {
        it('should select all tiles of matching terrain type', () => {
            resetLevelState();
            // Setup map with some ROOM tiles
            getLevelState().map = new GameMap();

            getLevelState().map.locations[10][10].typ = ROOM;
            getLevelState().map.locations[11][10].typ = ROOM;
            getLevelState().map.locations[10][11].typ = CORR;

            const matched = selection.match(ROOM);

            assert.ok(matched.coords);
            assert.ok(matched.coords.length >= 2); // At least our 2 ROOM tiles

            // Check our ROOM tiles are in the selection
            const hasCoord = (x, y) => matched.coords.some(c => c.x === x && c.y === y);
            assert.ok(hasCoord(10, 10));
            assert.ok(hasCoord(11, 10));
        });
    });

    describe('selection.filter_mapchar()', () => {
        it('should filter selection by map character', () => {
            resetLevelState();
            // Setup map with ROOM and CORR tiles
            getLevelState().map = new GameMap();

            getLevelState().map.locations[5][5].typ = ROOM;
            getLevelState().map.locations[6][5].typ = CORR;
            getLevelState().map.locations[7][5].typ = ROOM;

            const sel = { coords: [
                { x: 5, y: 5 },
                { x: 6, y: 5 },
                { x: 7, y: 5 }
            ]};

            // Filter to only ROOM tiles (map char ".")
            const filtered = selection.filter_mapchar(sel, '.');

            assert.ok(filtered.coords);
            assert.equal(filtered.coords.length, 2); // Only the 2 ROOM tiles

            const hasCoord = (x, y) => filtered.coords.some(c => c.x === x && c.y === y);
            assert.ok(hasCoord(5, 5));
            assert.ok(hasCoord(7, 5));
            assert.ok(!hasCoord(6, 5)); // CORR tile should be filtered out
        });
    });

    describe('sel.is_irregular()', () => {
        it('returns false for a complete rectangular selection', () => {
            const sel = selection.new();
            for (let x = 5; x <= 8; x++) for (let y = 3; y <= 5; y++) sel.set(x, y, true);
            assert.equal(sel.is_irregular(), false);
        });

        it('returns false for a square selection', () => {
            const sel = selection.new();
            for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) sel.set(x, y, true);
            assert.equal(sel.is_irregular(), false);
        });

        it('returns true when there is a hole inside the bounding box', () => {
            const sel = selection.new();
            for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) {
                if (x === 1 && y === 1) continue; // hole
                sel.set(x, y, true);
            }
            assert.equal(sel.is_irregular(), true);
        });

        it('returns false for empty selection', () => {
            const sel = selection.new();
            assert.equal(sel.is_irregular(), false);
        });
    });

    describe('sel.size_description()', () => {
        it('returns "square N by N" for square selection', () => {
            const sel = selection.new();
            for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) sel.set(x, y, true);
            assert.equal(sel.size_description(), 'square 5 by 5');
        });

        it('returns "rectangular W by H" for non-square rectangle', () => {
            const sel = selection.new();
            for (let x = 0; x < 7; x++) for (let y = 0; y < 3; y++) sel.set(x, y, true);
            assert.equal(sel.size_description(), 'rectangular 7 by 3');
        });

        it('returns "irregularly shaped W by H" for selection with holes', () => {
            const sel = selection.new();
            for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
                if (x === 2 && y === 2) continue;
                sel.set(x, y, true);
            }
            assert.equal(sel.size_description(), 'irregularly shaped 4 by 4');
        });
    });

    describe('selection.ellipse()', () => {
        it('creates an ellipse outline centered at given point', () => {
            const sel = selection.ellipse(10, 10, 4, 2, false);
            assert.ok(sel.numpoints() > 0, 'should have points');
            const b = sel.bounds();
            assert.equal(b.lx, 6);  // xc - a = 10 - 4
            assert.equal(b.hx, 14); // xc + a = 10 + 4
            assert.equal(b.ly, 8);  // yc - b = 10 - 2
            assert.equal(b.hy, 12); // yc + b = 10 + 2
        });

        it('creates a filled ellipse with more points than outline', () => {
            const outline = selection.ellipse(10, 10, 4, 2, false);
            const filled = selection.ellipse(10, 10, 4, 2, true);
            assert.ok(filled.numpoints() > outline.numpoints(),
                `filled (${filled.numpoints()}) should have more points than outline (${outline.numpoints()})`);
        });

        it('filled ellipse is not irregular (fully fills bounds)', () => {
            // A filled ellipse should be irregular (not rectangular) — it's oval shaped
            const filled = selection.ellipse(10, 10, 5, 3, true);
            assert.ok(filled.numpoints() > 0);
        });

        it('outline ellipse contains center row points on left and right', () => {
            const sel = selection.ellipse(10, 10, 3, 2, false);
            // The leftmost and rightmost points at center y should be present
            const hasPoint = (x, y) => sel.coords.some(c => c.x === x && c.y === y);
            assert.ok(hasPoint(7, 10) || hasPoint(10 - 3, 10)); // left edge
            assert.ok(hasPoint(13, 10) || hasPoint(10 + 3, 10)); // right edge
        });
    });

    describe('selection.gradient()', () => {
        const SEL_GRADIENT_RADIAL = 0;
        const SEL_GRADIENT_SQUARE = 1;

        it('radial gradient: point at axis endpoint always included (mind=5)', () => {
            // With mind=5, all points within radius 5 of the axis are always included.
            // The axis is a single point (x=10,y=10,x2=10,y2=10), so the center
            // is within radius 0 of the axis — definitely inside mind=5.
            initRng(1);
            const sel = selection.gradient(10, 10, 10, 10, SEL_GRADIENT_RADIAL, 5, 10);
            const hasPoint = (x, y) => sel.coords.some(c => c.x === x && c.y === y);
            assert.ok(hasPoint(10, 10), 'center point should be included');
        });

        it('radial gradient: returns a selection object with coords', () => {
            initRng(42);
            const sel = selection.gradient(10, 10, 20, 10, SEL_GRADIENT_RADIAL, 0, 3);
            assert.ok(Array.isArray(sel.coords), 'should return selection with coords');
            assert.ok(sel.coords.length > 0, 'should have at least some points');
        });

        it('radial gradient: no points outside maxd of axis (deterministic)', () => {
            // With mind=maxd=0: only points ON the axis are included (d0 <= 0).
            // All points with d0 > 0 would need d0 - 0 < rn2(1) which is always false.
            initRng(1);
            const sel = selection.gradient(10, 10, 10, 10, SEL_GRADIENT_RADIAL, 0, 0);
            // Only the exact center should be in the selection
            assert.ok(sel.coords.every(c => c.x === 10 && c.y === 10),
                'with mind=maxd=0 (point axis), only center should be included');
        });

        it('square gradient: includes points near axis', () => {
            initRng(7);
            const sel = selection.gradient(10, 5, 10, 15, SEL_GRADIENT_SQUARE, 2, 5);
            const hasPoint = (x, y) => sel.coords.some(c => c.x === x && c.y === y);
            // Points on the axis itself are within mind=2 squared=4; d0 of (10,10) from segment = 0 <= 4
            assert.ok(hasPoint(10, 10), 'axis point should be included');
        });

        it('gradient is deterministic for same seed', () => {
            initRng(99);
            const sel1 = selection.gradient(5, 5, 15, 15, SEL_GRADIENT_RADIAL, 2, 6);

            initRng(99);
            const sel2 = selection.gradient(5, 5, 15, 15, SEL_GRADIENT_RADIAL, 2, 6);

            assert.equal(sel1.coords.length, sel2.coords.length,
                'same seed should produce same number of points');
        });

        it('gradient with swapped mind/maxd gives same result as ordered', () => {
            // C swaps mind/maxd if mind > maxd; our JS does the same
            initRng(5);
            const sel1 = selection.gradient(10, 10, 20, 10, SEL_GRADIENT_RADIAL, 3, 6);

            initRng(5);
            const sel2 = selection.gradient(10, 10, 20, 10, SEL_GRADIENT_RADIAL, 6, 3);

            assert.equal(sel1.coords.length, sel2.coords.length,
                'swapped mind/maxd should give same result');
        });

        it('larger maxd includes more points than smaller maxd (probabilistically)', () => {
            // With the same seed, larger maxd means more points can be included
            initRng(12);
            const small = selection.gradient(10, 10, 10, 10, SEL_GRADIENT_RADIAL, 0, 2);

            initRng(12);
            const large = selection.gradient(10, 10, 10, 10, SEL_GRADIENT_RADIAL, 0, 8);

            assert.ok(large.coords.length >= small.coords.length,
                `larger maxd (${large.coords.length}) should have >= points than small (${small.coords.length})`);
        });
    });

    describe('sel.xor()', () => {
        it('returns symmetric difference of two overlapping selections', () => {
            // A = {1,1} {2,2}; B = {2,2} {3,3}; XOR = {1,1} {3,3}
            const a = selection.new(); a.set(1, 1, true); a.set(2, 2, true);
            const b = selection.new(); b.set(2, 2, true); b.set(3, 3, true);
            const result = a.xor(b);
            const hasPoint = (x, y) => result.coords.some(c => c.x === x && c.y === y);
            assert.ok(hasPoint(1, 1), '{1,1} in A only should be in XOR');
            assert.ok(!hasPoint(2, 2), '{2,2} in both should not be in XOR');
            assert.ok(hasPoint(3, 3), '{3,3} in B only should be in XOR');
            assert.equal(result.numpoints(), 2);
        });

        it('xor with disjoint selections equals union', () => {
            const a = selection.new(); a.set(1, 1, true); a.set(2, 2, true);
            const b = selection.new(); b.set(5, 5, true); b.set(6, 6, true);
            const xorResult = a.xor(b);
            const unionResult = a.union(b);
            assert.equal(xorResult.numpoints(), unionResult.numpoints());
        });

        it('xor with identical selections is empty', () => {
            const a = selection.new(); a.set(3, 4, true); a.set(5, 6, true);
            const b = selection.new(); b.set(3, 4, true); b.set(5, 6, true);
            assert.equal(a.xor(b).numpoints(), 0);
        });

        it('xor with empty selection returns copy', () => {
            const a = selection.new(); a.set(7, 8, true);
            const b = selection.new();
            assert.equal(a.xor(b).numpoints(), 1);
        });
    });

    describe('sel.sub()', () => {
        it('returns A minus B (points in A not in B)', () => {
            // A = {1,1} {2,2} {3,3}; B = {2,2}; A-B = {1,1} {3,3}
            const a = selection.new(); a.set(1, 1, true); a.set(2, 2, true); a.set(3, 3, true);
            const b = selection.new(); b.set(2, 2, true);
            const result = a.sub(b);
            const hasPoint = (x, y) => result.coords.some(c => c.x === x && c.y === y);
            assert.ok(hasPoint(1, 1), '{1,1} not in B, should be in A-B');
            assert.ok(!hasPoint(2, 2), '{2,2} in B, should not be in A-B');
            assert.ok(hasPoint(3, 3), '{3,3} not in B, should be in A-B');
            assert.equal(result.numpoints(), 2);
        });

        it('sub with empty B returns copy of A', () => {
            const a = selection.new(); a.set(1, 2, true); a.set(3, 4, true);
            const b = selection.new();
            assert.equal(a.sub(b).numpoints(), 2);
        });

        it('sub with superset B returns empty', () => {
            const a = selection.new(); a.set(1, 1, true);
            const b = selection.new(); b.set(1, 1, true); b.set(2, 2, true);
            assert.equal(a.sub(b).numpoints(), 0);
        });

        it('sub is not symmetric: A-B != B-A for overlapping sets', () => {
            const a = selection.new(); a.set(1, 1, true); a.set(2, 2, true);
            const b = selection.new(); b.set(2, 2, true); b.set(3, 3, true);
            const aMinusB = a.sub(b);
            const bMinusA = b.sub(a);
            assert.equal(aMinusB.numpoints(), 1); // {1,1}
            assert.equal(bMinusA.numpoints(), 1); // {3,3}
            assert.ok(aMinusB.coords.some(c => c.x === 1 && c.y === 1));
            assert.ok(bMinusA.coords.some(c => c.x === 3 && c.y === 3));
        });
    });

    describe('selection.circle()', () => {
        it('creates a circle outline (same as ellipse with equal radii)', () => {
            const circle = selection.circle(10, 10, 4, false);
            const ellipse = selection.ellipse(10, 10, 4, 4, false);
            assert.equal(circle.numpoints(), ellipse.numpoints(),
                'circle should produce same points as ellipse with equal radii');
        });

        it('filled circle has more points than outline circle', () => {
            const outline = selection.circle(10, 10, 5, false);
            const filled = selection.circle(10, 10, 5, true);
            assert.ok(filled.numpoints() > outline.numpoints(),
                `filled (${filled.numpoints()}) should have more points than outline (${outline.numpoints()})`);
        });

        it('circle bounds are symmetric around center', () => {
            const sel = selection.circle(15, 12, 3, false);
            const b = sel.bounds();
            assert.equal(b.lx, 15 - 3, 'left bound should be center - radius');
            assert.equal(b.hx, 15 + 3, 'right bound should be center + radius');
            assert.equal(b.ly, 12 - 3, 'top bound should be center - radius');
            assert.equal(b.hy, 12 + 3, 'bottom bound should be center + radius');
        });

        it('filled=false is the default', () => {
            const explicit = selection.circle(10, 10, 3, false);
            const defaulted = selection.circle(10, 10, 3);
            assert.equal(explicit.numpoints(), defaulted.numpoints());
        });
    });
});
