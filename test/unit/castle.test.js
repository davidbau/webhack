/**
 * Test for Castle (Stronghold) level generation
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { resetLevelState, getLevelState } from '../../js/sp_lev.js';
import { generate as generateCastle } from '../../js/levels/castle.js';
import { initRng } from '../../js/rng.js';
import { STONE, ROOM, VWALL, TRWALL, MOAT, CORR } from '../../js/config.js';

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

        // Castle has 4 storerooms × 7 objects each × 2 rows = 56 objects
        // Plus wand of wishing + potion + chest + scare monster scroll = 60 total
        assert.ok(map.objects.length >= 55, `Should have many objects (found ${map.objects.length})`);

        // Check that storerooms exist (objects in specific y-ranges)
        // Castle map is at origin (2,2), so map coords (39,5) become absolute (41,7)
        const storeroom1 = map.objects.filter(o => o.oy >= 7 && o.oy <= 8 && o.ox >= 41 && o.ox <= 47);
        const storeroom2 = map.objects.filter(o => o.oy >= 7 && o.oy <= 8 && o.ox >= 51 && o.ox <= 57);

        assert.ok(storeroom1.length >= 10, `Storeroom 1 should have objects (found ${storeroom1.length})`);
        assert.ok(storeroom2.length >= 10, `Storeroom 2 should have objects (found ${storeroom2.length})`);
    });

    it('should place throne room with court monsters', () => {
        resetLevelState();
        initRng(2);
        generateCastle();

        const state = getLevelState();
        const map = state.map;

        // Throne room has 26 monsters in specific positions
        // Castle map is at origin (2,2), so map coords (27-37,5-11) become absolute (29-39,7-13)
        const throneMonsters = map.monsters.filter(m =>
            m.x >= 29 && m.x <= 39 && m.y >= 7 && m.y <= 13
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
