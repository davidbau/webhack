// selfplay/test/pathing.test.js -- Tests for A* pathfinding

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LevelMap } from '../perception/map_tracker.js';
import { findPath, findExplorationTarget, findNearest, directionKey, distanceMap, analyzeCorridorPosition } from '../brain/pathing.js';

// Helper: create a level map from ASCII art
// Characters: . = floor, # = corridor, | - = wall, < > = stairs, + = door, ' ' = stone
function makeLevelMap(lines) {
    const level = new LevelMap(1);
    for (let y = 0; y < lines.length && y < 21; y++) {
        const line = lines[y] || '';
        for (let x = 0; x < line.length && x < 80; x++) {
            const ch = line[x];
            const cell = level.at(x, y);
            if (ch === ' ') {
                // Unexplored
                continue;
            }
            cell.explored = true;
            cell.ch = ch;
            switch (ch) {
                case '.':
                    cell.type = 'floor';
                    cell.walkable = true;
                    break;
                case '#':
                    cell.type = 'corridor';
                    cell.walkable = true;
                    break;
                case '|': case '-':
                    cell.type = 'wall';
                    cell.walkable = false;
                    break;
                case '<':
                    cell.type = 'stairs_up';
                    cell.walkable = true;
                    break;
                case '>':
                    cell.type = 'stairs_down';
                    cell.walkable = true;
                    break;
                case '+':
                    cell.type = 'door_closed';
                    cell.walkable = true;
                    break;
            }
        }
    }
    return level;
}

describe('Pathfinding', () => {
    it('finds straight-line path', () => {
        const level = makeLevelMap([
            '.....',
        ]);
        const result = findPath(level, 0, 0, 4, 0);
        assert.ok(result.found);
        assert.equal(result.path.length, 5);
        assert.equal(result.firstKey, 'l'); // move east
    });

    it('finds diagonal path', () => {
        const level = makeLevelMap([
            '.....',
            '.....',
            '.....',
        ]);
        const result = findPath(level, 0, 0, 2, 2);
        assert.ok(result.found);
        assert.equal(result.firstKey, 'n'); // move SE
    });

    it('navigates around walls', () => {
        const level = makeLevelMap([
            '...|.',
            '...|.',
            '.....',
        ]);
        const result = findPath(level, 0, 0, 4, 0);
        assert.ok(result.found);
        // Path should go around the wall
        assert.ok(result.cost > 4);
    });

    it('returns no path when blocked', () => {
        const level = makeLevelMap([
            '...|..',
            '---|..',
        ]);
        const result = findPath(level, 0, 0, 5, 0);
        assert.equal(result.found, false);
    });

    it('navigates through corridors', () => {
        // Door at (3,1) approached cardinally from (2,1) — NetHack blocks
        // diagonal movement into/out of doors, so the path must go cardinal
        const level = makeLevelMap([
            '...|  ',
            '...+##',
            '   |..',
        ]);
        const result = findPath(level, 0, 0, 5, 2);
        assert.ok(result.found);
    });

    it('finds nearest stairs', () => {
        const level = makeLevelMap([
            '..........>',
            '...........',
        ]);
        const result = findNearest(level, 0, 0, (cell) => cell.type === 'stairs_down');
        assert.ok(result);
        assert.ok(result.found);
    });

    it('finds exploration frontier', () => {
        const level = makeLevelMap([
            '...',  // explored
            // row 1+ is unexplored (spaces)
        ]);
        const result = findExplorationTarget(level, 1, 0);
        assert.ok(result);
        assert.ok(result.found);
    });

    it('returns null when fully explored', () => {
        const level = makeLevelMap([
            '|---|',
            '|...|',
            '|---|',
        ]);
        const result = findExplorationTarget(level, 2, 1);
        // Interior is fully explored, borders are walls -- no exploration frontier
        assert.equal(result, null);
    });

    it('direction key mapping', () => {
        assert.equal(directionKey(-1, -1), 'y');
        assert.equal(directionKey(0, -1), 'k');
        assert.equal(directionKey(1, 0), 'l');
        assert.equal(directionKey(0, 1), 'j');
    });

    it('distance map', () => {
        const level = makeLevelMap([
            '.....',
            '.|...',
            '.....',
        ]);
        const dist = distanceMap(level, 0, 0);
        assert.equal(dist[0][0], 0);
        assert.equal(dist[0][1], 1);
        assert.equal(dist[0][4], 4);
        // (1,1) is a wall, should be unreachable
        assert.equal(dist[1][1], -1);
    });
});

describe('Corridor Following', () => {
    it('detects player in corridor', () => {
        const level = makeLevelMap([
            '|-----|',
            '|#####|',
            '|-----|',
        ]);
        // At position (2,1), in the middle of a corridor with neighbors on both sides
        const analysis = analyzeCorridorPosition(level, 2, 1);
        assert.equal(analysis.inCorridor, true);
        assert.equal(analysis.endReached, false);
        assert.ok(analysis.direction); // should have a direction to continue
    });

    it('detects corridor end at junction', () => {
        const level = makeLevelMap([
            '|####|',
            '|#..#|',
            '|####|',
        ]);
        // At position (1,1), corridor opens into room - junction
        const analysis = analyzeCorridorPosition(level, 1, 1);
        assert.equal(analysis.inCorridor, true);
        assert.equal(analysis.endReached, true);
        assert.equal(analysis.direction, null); // no single direction to continue
    });

    it('detects corridor end at dead-end', () => {
        const level = makeLevelMap([
            '|-----|',
            '|###|--|',
            '|-----|',
        ]);
        // At position (3,1), corridor hits dead-end
        const analysis = analyzeCorridorPosition(level, 3, 1);
        assert.equal(analysis.inCorridor, true);
        assert.equal(analysis.endReached, true);
        assert.equal(analysis.direction, null);
    });

    it('detects not in corridor when in open room', () => {
        const level = makeLevelMap([
            '|-------|',
            '|.......|',
            '|.......|',
            '|-------|',
        ]);
        const analysis = analyzeCorridorPosition(level, 3, 2);
        assert.equal(analysis.inCorridor, false);
        assert.equal(analysis.endReached, false);
        assert.equal(analysis.direction, null);
    });

    it('suggests direction in linear corridor', () => {
        const level = makeLevelMap([
            '|-----|',
            '|#####|',
            '|-----|',
        ]);
        // At position (2,1), should suggest continuing east or west
        const analysis = analyzeCorridorPosition(level, 2, 1);
        assert.equal(analysis.inCorridor, true);
        assert.equal(analysis.endReached, false);
        // Should have a direction (either 'h' for west or 'l' for east)
        assert.ok(analysis.direction === 'h' || analysis.direction === 'l');
    });

    it('handles L-shaped corridor', () => {
        const level = makeLevelMap([
            '|-----|',
            '|###|-|',
            '|-#|-|',
            '|-#|-|',
            '|-------|',
        ]);
        // At corner position (2,2), should detect as corridor junction
        const analysis = analyzeCorridorPosition(level, 2, 2);
        assert.equal(analysis.inCorridor, true);
        // At a corner (2 walkable neighbors), should still be in corridor
    });
});
