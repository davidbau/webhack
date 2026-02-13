/**
 * Tests for special level generation (sp_lev.js)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
    des, resetLevelState, getLevelState
} from '../../js/sp_lev.js';
import { STONE, ROOM, HWALL, VWALL, STAIRS, LAVAPOOL, PIT, MAGIC_PORTAL, CROSSWALL } from '../../js/config.js';
import { BOULDER, DAGGER } from '../../js/objects.js';

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
        const ox = state.xstart;
        const oy = state.ystart;

        assert.equal(map.locations[ox][oy].typ, HWALL, 'Top-left should be wall');
        assert.equal(map.locations[ox][oy + 1].typ, VWALL, 'Left edge should be wall');
        assert.equal(map.locations[ox + 1][oy + 1].typ, ROOM, 'Inside should be room');
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
        const ox = state.xstart;
        const oy = state.ystart;

        assert.equal(map.locations[ox][oy].typ, HWALL);
        assert.equal(map.locations[ox][oy + 1].typ, VWALL);
        assert.equal(map.locations[ox + 1][oy + 1].typ, ROOM);
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

    it('should preserve leading and trailing blank map lines', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });

        des.map({ map: '..\n..', x: 10, y: 5 });
        let state = getLevelState();
        let map = state.map;
        assert.equal(state.xsize, 2);
        assert.equal(state.ysize, 2);
        assert.equal(map.locations[10][5].typ, ROOM);
        assert.equal(map.locations[10][6].typ, ROOM);

        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });
        des.map({ map: '..\n..\n', x: 10, y: 5 });
        state = getLevelState();
        map = state.map;
        assert.equal(state.xsize, 2);
        assert.equal(state.ysize, 3);
        assert.equal(map.locations[10][5].typ, ROOM);
        assert.equal(map.locations[10][6].typ, ROOM);
        assert.equal(map.locations[10][7].typ, STONE);

        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });
        des.map({ map: '\n..\n..\n', x: 10, y: 5 });
        state = getLevelState();
        map = state.map;
        assert.equal(state.xsize, 2);
        assert.equal(state.ysize, 4);
        assert.equal(map.locations[10][5].typ, STONE);
        assert.equal(map.locations[10][6].typ, ROOM);
        assert.equal(map.locations[10][7].typ, ROOM);
    });

    it('finalize_level map cleanup removes boulders and destroyable traps on liquid', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });

        const state = getLevelState();
        const map = state.map;
        state.coder.allow_flips = 0;
        map.locations[10][10].typ = LAVAPOOL;
        map.locations[11][10].typ = ROOM;

        map.objects.push({ otyp: BOULDER, ox: 10, oy: 10 });
        map.objects.push({ otyp: DAGGER, ox: 10, oy: 10 });

        map.traps.push({ ttyp: PIT, tx: 10, ty: 10 });
        map.traps.push({ ttyp: MAGIC_PORTAL, tx: 10, ty: 10 });
        map.traps.push({ ttyp: PIT, tx: 11, ty: 10 });

        des.finalize_level();

        assert.equal(map.objects.some(o => o.otyp === BOULDER && o.ox === 10 && o.oy === 10), false,
            'boulder on liquid should be removed');
        assert.equal(map.objects.some(o => o.otyp === DAGGER && o.ox === 10 && o.oy === 10), true,
            'non-boulder object on liquid should remain');

        assert.equal(map.traps.some(t => t.ttyp === PIT && t.tx === 10 && t.ty === 10), false,
            'destroyable trap on liquid should be removed');
        assert.equal(map.traps.some(t => t.ttyp === MAGIC_PORTAL && t.tx === 10 && t.ty === 10), true,
            'undestroyable trap on liquid should remain');
        assert.equal(map.traps.some(t => t.ttyp === PIT && t.tx === 11 && t.ty === 10), true,
            'trap on non-liquid terrain should remain');
    });

    it('finalize_level converts touched boundary CROSSWALL tiles to ROOM', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });

        const state = getLevelState();
        const map = state.map;
        state.coder.allow_flips = 0;
        des.terrain(10, 10, 'B'); // touched CROSSWALL
        map.locations[11][10].typ = CROSSWALL; // untouched CROSSWALL

        des.finalize_level();

        assert.notEqual(map.locations[10][10].typ, CROSSWALL,
            'touched CROSSWALL should no longer remain CROSSWALL');
        assert.equal(map.locations[11][10].typ, CROSSWALL,
            'untouched CROSSWALL should remain CROSSWALL');
    });
});
