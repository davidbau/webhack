/**
 * Tests for special level generation (sp_lev.js)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
    des, resetLevelState, getLevelState
} from '../../js/sp_lev.js';
import { place_lregion } from '../../js/dungeon.js';
import {
    STONE, ROOM, HWALL, VWALL, STAIRS, LAVAPOOL, PIT, MAGIC_PORTAL, CROSSWALL,
    ALTAR, THRONE, A_LAWFUL, A_NEUTRAL, A_CHAOTIC,
} from '../../js/config.js';
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

    it('des.map clears per-cell metadata before applying terrain', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: '.' });

        const map = getLevelState().map;
        map.locations[10][5].flags = 0x7fff;
        map.locations[10][5].horizontal = 1;
        map.locations[10][5].roomno = 42;
        map.locations[10][5].edge = 1;

        des.map({ map: '.', x: 10, y: 5 });

        assert.equal(map.locations[10][5].typ, ROOM);
        assert.equal(map.locations[10][5].flags, 0);
        assert.equal(map.locations[10][5].horizontal, 0);
        assert.equal(map.locations[10][5].roomno, 0);
        assert.equal(map.locations[10][5].edge, 0);
    });

    it('des.altar places ALTAR terrain and alignment metadata', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: '.' });

        des.altar({ x: 12, y: 7, align: 'law' });
        let map = getLevelState().map;
        assert.equal(map.locations[12][7].typ, ALTAR);
        assert.equal(map.locations[12][7].altarAlign, A_LAWFUL);

        des.altar({ x: 13, y: 7, align: 'chaos' });
        map = getLevelState().map;
        assert.equal(map.locations[13][7].typ, ALTAR);
        assert.equal(map.locations[13][7].altarAlign, A_CHAOTIC);
    });

    it('des.altar honors map-relative coordinates after des.map', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });
        des.map({ map: '..\n..', x: 10, y: 5 });

        des.altar({ x: 1, y: 1, align: 'neutral' });
        const map = getLevelState().map;
        assert.equal(map.locations[11][6].typ, ALTAR);
        assert.equal(map.locations[11][6].altarAlign, A_NEUTRAL);
    });

    it('des.feature(\"altar\") places ALTAR terrain', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: '.' });
        des.feature('altar', 20, 8);

        const map = getLevelState().map;
        assert.equal(map.locations[20][8].typ, ALTAR);
        assert.equal(map.locations[20][8].altarAlign, A_NEUTRAL);
    });

    it('des.map parses backslash as THRONE terrain', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });
        des.map({ map: '\\\\', x: 10, y: 5 });

        const map = getLevelState().map;
        assert.equal(map.locations[10][5].typ, THRONE);
    });

    it('des.altar does not overwrite stairs/ladder tiles', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: '.' });
        des.stair('up', 10, 5);
        des.altar({ x: 10, y: 5, align: 'law' });

        const map = getLevelState().map;
        assert.equal(map.locations[10][5].typ, STAIRS_UP);
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

    it('applies des.region coordinates relative to des.map origin by default', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ', lit: 0 });
        des.map({ map: '..\n..', x: 10, y: 5 });

        des.region({ region: [0, 0, 0, 0], lit: true });
        const map = getLevelState().map;
        assert.equal(map.locations[10][5].lit, 1, 'relative region should target map origin');
        assert.equal(map.locations[0][0].lit, false, 'absolute origin should remain unchanged');

        des.region({ region: [0, 0, 0, 0], lit: true, region_islev: true });
        assert.equal(map.locations[0][0].lit, 1, 'region_islev should use absolute level coordinates');
    });

    it('creates room metadata for non-ordinary des.region', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: '.', lit: 0 });
        des.region({ region: [10, 5, 12, 7], lit: true, type: 'temple', filled: 2, joined: false });

        const state = getLevelState();
        const map = state.map;
        assert.equal(map.nroom, 1);
        assert.equal(map.rooms.length, 1);
        assert.equal(map.rooms[0].rtype, 10);
        assert.equal(map.rooms[0].needfill, 2);
        assert.equal(map.rooms[0].needjoining, false);
        assert.equal(map.locations[11][6].roomno, 3, 'room interior should be assigned roomno');
        assert.equal(map.locations[11][6].lit, 1, 'lit region room should be lit');
    });

    it('keeps ordinary rectangular des.region as light-only (no room)', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: '.', lit: 0 });
        des.region({ region: [10, 5, 10, 5], lit: true, type: 'ordinary' });

        const map = getLevelState().map;
        assert.equal(map.nroom, 0);
        assert.equal(map.rooms.length, 0);
        assert.equal(map.locations[10][5].lit, 1);
    });

    it('applies des.non_diggable coordinates relative to des.map origin', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });
        des.map({ map: '..\n..', x: 10, y: 5 });

        des.non_diggable({ x1: 0, y1: 0, x2: 0, y2: 0 });
        const map = getLevelState().map;
        assert.equal(map.locations[10][5].nondiggable, true, 'relative non_diggable should target map origin');
        assert.equal(map.locations[0][0].nondiggable, false, 'absolute origin should remain diggable');
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

    it('finalize_level keeps stair metadata aligned after vertical flip', () => {
        resetLevelState();
        initRng(1); // first rn2(2) => 1, so vertical flip is applied
        des.level_init({ style: 'solidfill', fg: '.', lit: 0 });
        des.stair('up', 10, 5);

        const state = getLevelState();
        state.coder.allow_flips = 1; // vertical only
        const map = des.finalize_level();

        assert.equal(map.locations[10][15].typ, STAIRS, 'stair terrain should flip to mirrored y');
        assert.equal(map.upstair.x, 10, 'upstair x metadata should remain aligned');
        assert.equal(map.upstair.y, 15, 'upstair y metadata should be flipped');
    });

    it('place_lregion oneshot removes destroyable trap blocker', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: '.' });
        const map = getLevelState().map;
        map.traps.push({ ttyp: PIT, tx: 10, ty: 10 });

        place_lregion(map, 10, 10, 10, 10, 0, 0, 0, 0, 5);

        assert.equal(map.trapAt(10, 10), null, 'destroyable trap should be removed in oneshot fallback');
        assert.equal(map.at(10, 10).typ, STAIRS, 'stairs should be placed after removing trap');
    });

    it('place_lregion oneshot keeps undestroyable trap blocker', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: '.' });
        const map = getLevelState().map;
        map.traps.push({ ttyp: MAGIC_PORTAL, tx: 10, ty: 10 });

        place_lregion(map, 10, 10, 10, 10, 0, 0, 0, 0, 5);

        assert.notEqual(map.trapAt(10, 10), null, 'undestroyable trap should remain');
        assert.notEqual(map.at(10, 10).typ, STAIRS, 'stairs should not overwrite undestroyable trap location');
    });
});
