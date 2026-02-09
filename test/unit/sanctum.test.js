/**
 * Test for Sanctum (Moloch's Temple) level generation
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { resetLevelState, getLevelState } from '../../js/sp_lev.js';
import { generate as generateSanctum } from '../../js/levels/sanctum.js';
import { initRng } from '../../js/rng.js';
import { STONE, ROOM, VWALL, TRWALL, FIRE_TRAP } from '../../js/config.js';

describe('Sanctum level generation', () => {
    before(() => {
        initRng(1);
    });

    it('should generate the map with correct terrain', () => {
        resetLevelState();
        generateSanctum();

        const state = getLevelState();
        const map = state.map;

        assert.ok(map, 'Map should be created');

        let wallCount = 0;
        let roomCount = 0;
        let objectCount = 0;
        let trapCount = 0;

        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                const typ = map.locations[x][y].typ;
                if (typ >= VWALL && typ <= TRWALL) wallCount++;
                if (typ === ROOM) roomCount++;
            }
        }
        objectCount = map.objects.length;
        trapCount = map.traps.length;

        assert.ok(wallCount > 200, `Should have walls (found ${wallCount})`);
        assert.ok(roomCount > 300, `Should have room cells (found ${roomCount})`);
        assert.ok(objectCount >= 16, `Should have objects (found ${objectCount})`);
        // Fire traps around temple (34) + random traps (6) - some may collide
        assert.ok(trapCount >= 38, `Should have many traps (found ${trapCount})`);
    });

    it('should place specific monsters and objects', () => {
        resetLevelState();
        initRng(1);
        generateSanctum();

        const state = getLevelState();
        const map = state.map;

        // Check for specific positioned monsters (devils, clerics, etc.)
        // Count total monsters - should have named devils + clerics + random
        const monsterCount = map.monsters.length;
        assert.ok(monsterCount >= 14, `Should have multiple monsters (found ${monsterCount})`);

        // Check for fire trap ring around temple (should be at specific coordinates)
        const fireTraps = map.traps.filter(t => t.ttyp === FIRE_TRAP);
        assert.ok(fireTraps.length >= 30, `Should have fire trap ring (found ${fireTraps.length})`);
    });
});
