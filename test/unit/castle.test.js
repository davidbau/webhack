/**
 * Test for Castle (Stronghold) level generation
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { resetLevelState, getLevelState } from '../../js/sp_lev.js';
import { generate as generateCastle } from '../../js/levels/castle.js';
import { initRng } from '../../js/rng.js';
import { STONE, ROOM, VWALL, TRWALL, MOAT, CORR } from '../../js/config.js';

function getBounds(map) {
    let minX = 79, minY = 20, maxX = 0, maxY = 0;
    for (let x = 0; x < 80; x++) {
        for (let y = 0; y < 21; y++) {
            if (map.locations[x][y].typ !== STONE) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    return { minX, minY, maxX, maxY };
}

function transformRect(rect, bounds, flipX, flipY) {
    let { x1, y1, x2, y2 } = rect;
    if (flipX) {
        const nx1 = bounds.maxX - x2 + bounds.minX;
        const nx2 = bounds.maxX - x1 + bounds.minX;
        x1 = Math.min(nx1, nx2);
        x2 = Math.max(nx1, nx2);
    }
    if (flipY) {
        const ny1 = bounds.maxY - y2 + bounds.minY;
        const ny2 = bounds.maxY - y1 + bounds.minY;
        y1 = Math.min(ny1, ny2);
        y2 = Math.max(ny1, ny2);
    }
    return { x1, y1, x2, y2 };
}

describe('Castle (Stronghold) level generation', () => {
    before(() => {
        initRng(1);
    });

    it('should generate the map with correct terrain', () => {
        resetLevelState();
        generateCastle();

        const state = getLevelState();
        const map = state.map;

        assert.ok(map, 'Map should be created');

        let wallCount = 0;
        let roomCount = 0;
        let moatCount = 0;

        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                const typ = map.locations[x][y].typ;
                if (typ >= VWALL && typ <= TRWALL) wallCount++;
                if (typ === ROOM || typ === CORR) roomCount++;
                if (typ === MOAT) moatCount++;
            }
        }

        assert.ok(wallCount > 200, `Should have walls (found ${wallCount})`);
        assert.ok(roomCount > 300, `Should have room cells (found ${roomCount})`);
        assert.ok(moatCount > 100, `Should have moat (found ${moatCount})`);
    });

    it('should place soldiers, dragons, and sea monsters', () => {
        resetLevelState();
        initRng(1);
        generateCastle();

        const state = getLevelState();
        const map = state.map;

        // Check for specific monster types
        const soldiers = map.monsters.filter(m => m.id === 'soldier');
        const dragons = map.monsters.filter(m => m.id === 'D');
        const eels = map.monsters.filter(m => m.id === 'giant eel');
        const sharks = map.monsters.filter(m => m.id === 'shark');

        assert.ok(soldiers.length >= 14, `Should have soldiers (found ${soldiers.length})`);
        assert.ok(dragons.length >= 4, `Should have 4 dragons (found ${dragons.length})`);
        assert.ok(eels.length >= 4, `Should have eels in moat (found ${eels.length})`);
        assert.ok(sharks.length >= 4, `Should have sharks in moat (found ${sharks.length})`);

        // Check for lieutenant
        const lieutenant = map.monsters.find(m => m.id === 'lieutenant');
        assert.ok(lieutenant, 'Lieutenant should be present');
    });

    it('should place storerooms with shuffled treasures', () => {
        resetLevelState();
        initRng(1);
        generateCastle();

        const state = getLevelState();
        const map = state.map;
        const ox = state.xstart;
        const oy = state.ystart;
        const bounds = getBounds(map);

        // Castle has 4 storerooms × 7 objects each × 2 rows = 56 objects
        // Plus wand of wishing + potion + chest + scare monster scroll = 60 total
        assert.ok(map.objects.length >= 55, `Should have many objects (found ${map.objects.length})`);

        // Check that storerooms exist at coordinates relative to map origin.
        const base1 = { x1: ox + 39, y1: oy + 5, x2: ox + 45, y2: oy + 6 };
        const base2 = { x1: ox + 49, y1: oy + 5, x2: ox + 55, y2: oy + 6 };
        const flips = [
            { fx: false, fy: false },
            { fx: true, fy: false },
            { fx: false, fy: true },
            { fx: true, fy: true }
        ];

        let storeroom1Count = 0;
        let storeroom2Count = 0;
        for (const f of flips) {
            const r1 = transformRect(base1, bounds, f.fx, f.fy);
            const r2 = transformRect(base2, bounds, f.fx, f.fy);
            const c1 = map.objects.filter(o =>
                o.ox >= r1.x1 && o.ox <= r1.x2 && o.oy >= r1.y1 && o.oy <= r1.y2
            ).length;
            const c2 = map.objects.filter(o =>
                o.ox >= r2.x1 && o.ox <= r2.x2 && o.oy >= r2.y1 && o.oy <= r2.y2
            ).length;
            if (c1 > storeroom1Count) storeroom1Count = c1;
            if (c2 > storeroom2Count) storeroom2Count = c2;
        }

        assert.ok(storeroom1Count >= 10, `Storeroom 1 should have objects (found ${storeroom1Count})`);
        assert.ok(storeroom2Count >= 10, `Storeroom 2 should have objects (found ${storeroom2Count})`);
    });

    it('should place throne room with court monsters', () => {
        resetLevelState();
        initRng(2);
        generateCastle();

        const state = getLevelState();
        const map = state.map;
        const ox = state.xstart;
        const oy = state.ystart;

        // Throne room has 28 court monsters in map-relative coordinates.
        const throneMonsters = map.monsters.filter(m =>
            m.x >= ox + 27 && m.x <= ox + 37 && m.y >= oy + 5 && m.y <= oy + 11
        );

        assert.ok(throneMonsters.length >= 20, `Throne room should have many monsters (found ${throneMonsters.length})`);
    });

    it('should have traps and drawbridge', () => {
        resetLevelState();
        initRng(3);
        generateCastle();

        const state = getLevelState();
        const map = state.map;

        // Castle has 5 trap doors
        assert.ok(map.traps.length >= 5, `Should have traps (found ${map.traps.length})`);

        // Drawbridge is at (5, 8) - should be a door or corridor
        const drawbridge = map.locations[5][8];
        assert.ok(drawbridge.typ !== STONE, 'Drawbridge location should not be stone');
    });
});
