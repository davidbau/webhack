/**
 * Tests for special level generation (sp_lev.js)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
    des, resetLevelState, getLevelState
} from '../../js/sp_lev.js';
import { STONE, ROOM, HWALL, VWALL, STAIRS } from '../../js/config.js';

// Alias for stairs
const STAIRS_UP = STAIRS;
import { initRng } from '../../js/rng.js';

describe('sp_lev.js - des.* API', () => {
    before(() => {
        initRng(42);
    });

    it('should initialize with solidfill style', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });

        const state = getLevelState();
        assert.equal(state.init.style, 'solidfill');
        assert.equal(state.init.fg, STONE);

        // Check that map is filled with stone
        const map = state.map;
        assert.ok(map, 'Map should be created');
        assert.equal(map.locations[0][0].typ, STONE);
        assert.equal(map.locations[40][10].typ, STONE);
        assert.equal(map.locations[79][20].typ, STONE);
    });

    it('should set level flags correctly', () => {
        resetLevelState();
        des.level_flags('noteleport', 'hardfloor', 'mazelevel', 'sokoban');

        const state = getLevelState();
        assert.equal(state.flags.noteleport, true);
        assert.equal(state.flags.hardfloor, true);
        assert.equal(state.flags.is_maze_lev, true);
    });

    it('should place a simple map', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });

        const testMap = `-----
|...|
|...|
-----`;

        des.map(testMap);

        const state = getLevelState();
        const map = state.map;

        // Map should be centered (width=5, height=4)
        // Center X = (80-5)/2 = 37
        // Center Y = (21-4)/2 = 8
        const cx = 37;
        const cy = 8;

        assert.equal(map.locations[cx][cy].typ, HWALL, 'Top-left should be wall');
        assert.equal(map.locations[cx][cy+1].typ, VWALL, 'Left edge should be wall');
        assert.equal(map.locations[cx+1][cy+1].typ, ROOM, 'Inside should be room');
    });

    it('should set individual terrain with des.terrain', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });

        des.terrain(10, 5, '<');
        des.terrain(20, 10, '>');

        const state = getLevelState();
        const map = state.map;

        assert.equal(map.locations[10][5].typ, STAIRS_UP);
        assert.equal(map.locations[20][10].typ, STAIRS_UP); // STAIRS (same as STAIRS_UP)
    });

    it('should handle map alignment options', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });

        const smallMap = `---
|.|
---`;

        des.map({ map: smallMap, halign: 'left', valign: 'top' });

        const state = getLevelState();
        const map = state.map;

        // Left-top alignment: x=1, y=1
        assert.equal(map.locations[1][1].typ, HWALL);
        assert.equal(map.locations[1][2].typ, VWALL);
        assert.equal(map.locations[2][2].typ, ROOM);
    });

    it('should handle explicit x,y coordinates for map placement', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });

        const smallMap = `..
..`;

        des.map({ map: smallMap, x: 50, y: 10 });

        const state = getLevelState();
        const map = state.map;

        assert.equal(map.locations[50][10].typ, ROOM);
        assert.equal(map.locations[51][10].typ, ROOM);
        assert.equal(map.locations[50][11].typ, ROOM);
        assert.equal(map.locations[51][11].typ, ROOM);
    });
});
