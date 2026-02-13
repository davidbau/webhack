/**
 * Test for Medusa's Island level generation
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { resetLevelState, getLevelState } from '../../js/sp_lev.js';
import { generate as generateMedusa } from '../../js/levels/medusa.js';
import { initRng } from '../../js/rng.js';
import { STONE, ROOM, VWALL, TRWALL, MOAT } from '../../js/config.js';

describe('Medusa level generation', () => {
    before(() => {
        initRng(1);
    });

    it('should generate the map with correct terrain', () => {
        resetLevelState();
        generateMedusa();

        const state = getLevelState();
        const map = state.map;

        assert.ok(map, 'Map should be created');

        let wallCount = 0;
        let roomCount = 0;
        let moatCount = 0;
        let objectCount = 0;
        let trapCount = 0;

        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                const typ = map.locations[x][y].typ;
                if (typ >= VWALL && typ <= TRWALL) wallCount++;
                if (typ === ROOM) roomCount++;
                if (typ === MOAT) moatCount++;
            }
        }
        objectCount = map.objects.length;
        trapCount = map.traps.length;

        assert.ok(wallCount > 30, `Should have walls (found ${wallCount})`);
        assert.ok(roomCount > 50, `Should have room cells (found ${roomCount})`);
        assert.ok(moatCount > 1000, `Should have extensive moat (found ${moatCount})`);
        // Perseus statue + 7 empty statues + 8 random objects
        assert.ok(objectCount >= 15, `Should have objects (found ${objectCount})`);
        // 5 random + 2 board traps (some may collide)
        assert.ok(trapCount >= 5, `Should have traps (found ${trapCount})`);
    });

    it('should place Medusa and water monsters', () => {
        resetLevelState();
        initRng(1);
        generateMedusa();

        const state = getLevelState();
        const map = state.map;

        // Check for monsters - Medusa + 8 positioned + 10 random
        const monsterCount = map.monsters.length;
        assert.ok(monsterCount >= 18, `Should have multiple monsters (found ${monsterCount})`);

        // Check that Medusa is present with deterministic relocated position.
        // The scripted target (36,10) is occupied by Perseus statue/stairs, so
        // monster placement resolves to the nearest valid square.
        const medusa = map.monsters.find(m => m.id === 'Medusa');
        assert.ok(medusa, 'Medusa should be present');
        // Coordinates are map-relative after des.map(); medusa.lua uses (36,10)
        // and placement may shift by one tile if occupied plus optional flip.
        assert.ok(medusa.x >= 37 && medusa.x <= 41, `Medusa X near lair center (got ${medusa.x})`);
        assert.ok(medusa.y >= 9 && medusa.y <= 11, `Medusa Y near lair center (got ${medusa.y})`);
        assert.equal(medusa.msleeping, true, 'Medusa should be sleeping');
    });
});
