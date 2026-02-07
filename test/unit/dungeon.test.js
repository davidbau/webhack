// test/unit/dungeon.test.js -- Tests for dungeon generation
// C ref: mklev.c -- verifies rooms, corridors, doors, and stairs

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COLNO, ROWNO, STONE, ROOM, CORR, DOOR, STAIRS, HWALL, VWALL,
         SDOOR, SCORR, IRONBARS, VAULT,
         IS_WALL, IS_DOOR, ACCESSIBLE, isok } from '../../js/config.js';
function REACHABLE(typ) { return ACCESSIBLE(typ) || typ === SDOOR || typ === SCORR; }
import { initRng } from '../../js/rng.js';
import { generateLevel, wallification } from '../../js/dungeon.js';

describe('Dungeon generation', () => {
    it('generates a level with rooms', () => {
        initRng(42);
        const map = generateLevel(1);
        assert.ok(map.rooms.length >= 1, 'Level should have at least 1 room');
        assert.ok(map.rooms.length <= 10, 'Level should have at most 10 rooms');
    });

    it('rooms have valid dimensions', () => {
        initRng(42);
        const map = generateLevel(1);
        for (const room of map.rooms) {
            assert.ok(room.lx >= 1 && room.lx < COLNO - 1);
            assert.ok(room.hx >= room.lx && room.hx < COLNO - 1);
            assert.ok(room.ly >= 1 && room.ly < ROWNO - 1);
            assert.ok(room.hy >= room.ly && room.hy < ROWNO - 1);
            // Vault rooms can be 2x2; regular rooms should be at least 3x3
            const w = room.hx - room.lx + 1;
            const h = room.hy - room.ly + 1;
            if (room.rtype === VAULT) {
                assert.ok(w >= 2, `Vault width ${w} too small`);
                assert.ok(h >= 2, `Vault height ${h} too small`);
            } else {
                assert.ok(w >= 3, `Room width ${w} too small`);
                assert.ok(h >= 3, `Room height ${h} too small`);
            }
        }
    });

    it('rooms are filled with accessible tiles', () => {
        initRng(42);
        const map = generateLevel(1);
        for (const room of map.rooms) {
            for (let x = room.lx; x <= room.hx; x++) {
                for (let y = room.ly; y <= room.hy; y++) {
                    const typ = map.at(x, y).typ;
                    // Room interiors can contain ROOM, STAIRS, DOOR, FOUNTAIN, etc.
                    assert.ok(ACCESSIBLE(typ),
                        `Expected accessible tile at ${x},${y} inside room, got ${typ}`);
                }
            }
        }
    });

    it('rooms have walls around them', () => {
        initRng(42);
        const map = generateLevel(1);
        wallification(map);
        for (const room of map.rooms) {
            // Check top and bottom walls
            for (let x = room.lx - 1; x <= room.hx + 1; x++) {
                if (isok(x, room.ly - 1)) {
                    const top = map.at(x, room.ly - 1);
                    assert.ok(IS_WALL(top.typ) || IS_DOOR(top.typ) || top.typ === CORR
                        || top.typ === SDOOR || top.typ === SCORR || top.typ === IRONBARS,
                        `Expected wall/door/corr at ${x},${room.ly - 1} (top border), got typ=${top.typ}`);
                }
                if (isok(x, room.hy + 1)) {
                    const bot = map.at(x, room.hy + 1);
                    assert.ok(IS_WALL(bot.typ) || IS_DOOR(bot.typ) || bot.typ === CORR
                        || bot.typ === SDOOR || bot.typ === SCORR || bot.typ === IRONBARS,
                        `Expected wall/door/corr at ${x},${room.hy + 1} (bottom border), got typ=${bot.typ}`);
                }
            }
        }
    });

    it('has a downstairs', () => {
        initRng(42);
        const map = generateLevel(1);
        assert.ok(map.dnstair.x > 0 || map.dnstair.y > 0,
            'Level 1 should have a downstairs');
    });

    it('downstairs is on accessible terrain', () => {
        initRng(42);
        const map = generateLevel(1);
        if (map.dnstair.x > 0 || map.dnstair.y > 0) {
            const loc = map.at(map.dnstair.x, map.dnstair.y);
            assert.ok(ACCESSIBLE(loc.typ),
                `Downstairs at ${map.dnstair.x},${map.dnstair.y} should be accessible`);
        }
    });

    it('corridors connect rooms', () => {
        initRng(42);
        const map = generateLevel(1);
        // Count corridor tiles
        let corrCount = 0;
        for (let x = 0; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                if (map.at(x, y).typ === CORR) corrCount++;
            }
        }
        if (map.rooms.length > 1) {
            assert.ok(corrCount > 0, 'Multiple rooms should be connected by corridors');
        }
    });

    it('all rooms are reachable from the first room', () => {
        initRng(42);
        const map = generateLevel(1);
        // Skip vault rooms -- they are intentionally disconnected in NetHack
        const nonVaultRooms = map.rooms.filter(r => r.rtype !== VAULT);
        if (nonVaultRooms.length <= 1) return;

        // BFS from center of first non-vault room
        const start = nonVaultRooms[0];
        const sx = Math.floor((start.lx + start.hx) / 2);
        const sy = Math.floor((start.ly + start.hy) / 2);

        const visited = Array.from({length: COLNO}, () => new Array(ROWNO).fill(false));
        const queue = [[sx, sy]];
        visited[sx][sy] = true;

        while (queue.length > 0) {
            const [cx, cy] = queue.shift();
            for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
                const nx = cx + dx, ny = cy + dy;
                if (isok(nx, ny) && !visited[nx][ny] && REACHABLE(map.at(nx, ny).typ)) {
                    visited[nx][ny] = true;
                    queue.push([nx, ny]);
                }
            }
        }

        // Check that at least one tile in each non-vault room is reachable
        for (let i = 1; i < nonVaultRooms.length; i++) {
            const room = nonVaultRooms[i];
            const rx = Math.floor((room.lx + room.hx) / 2);
            const ry = Math.floor((room.ly + room.hy) / 2);
            assert.ok(visited[rx][ry],
                `Room ${i} center at ${rx},${ry} should be reachable from room 0`);
        }
    });

    it('produces different layouts with different seeds', () => {
        initRng(1);
        const map1 = generateLevel(1);
        initRng(2);
        const map2 = generateLevel(1);
        // Compare room counts or positions
        const rooms1 = map1.rooms.map(r => `${r.lx},${r.ly}`).join(';');
        const rooms2 = map2.rooms.map(r => `${r.lx},${r.ly}`).join(';');
        assert.notEqual(rooms1, rooms2, 'Different seeds should produce different maps');
    });

    it('deeper levels can be generated', () => {
        for (let depth = 1; depth <= 10; depth++) {
            initRng(42 + depth);
            const map = generateLevel(depth);
            assert.ok(map.rooms.length >= 1, `Level ${depth} should have rooms`);
        }
    });
});
