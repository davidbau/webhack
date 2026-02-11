/**
 * Test for Wizard's Tower level generation (wizard1-3)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { resetLevelState, getLevelState } from '../../js/sp_lev.js';
import { generate as generateWizard1 } from '../../js/levels/wizard1.js';
import { generate as generateWizard2 } from '../../js/levels/wizard2.js';
import { generate as generateWizard3 } from '../../js/levels/wizard3.js';
import { initRng } from '../../js/rng.js';
import { STONE, ROOM, VWALL, TRWALL, MOAT, CORR } from '../../js/config.js';

describe('Wizard\'s Tower level generation', () => {
    before(() => {
        initRng(1);
    });

    it('should generate wizard1 (top level) with correct terrain', () => {
        resetLevelState();
        generateWizard1();

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

        assert.ok(wallCount > 50, `Should have walls (found ${wallCount})`);
        assert.ok(roomCount > 100, `Should have room cells (found ${roomCount})`);
        assert.ok(moatCount > 25, `Should have moat around wizard (found ${moatCount})`);
    });

    it('should place Wizard of Yendor and guards in wizard1', () => {
        resetLevelState();
        initRng(1);
        generateWizard1();

        const state = getLevelState();
        const map = state.map;

        // Wizard + guards + water monsters + random monsters
        const monsterCount = map.monsters.length;
        assert.ok(monsterCount >= 15, `Should have multiple monsters (found ${monsterCount})`);

        // Check for the Wizard
        const wizard = map.monsters.find(m => m.id === 'Wizard of Yendor');
        assert.ok(wizard, 'Wizard of Yendor should be present');
        // Wizard1 map is at origin (25,4), so map coords (16,5) become absolute (41,9)
        // But monsters seem to use map-relative coordinates in output
        assert.equal(wizard.x, 16, 'Wizard X position');
        assert.equal(wizard.y, 5, 'Wizard Y position');

        // Check for Book of the Dead (appears as first object at wizard's location)
        // Objects use absolute coordinates after map-relative conversion
        const objectsAtWizard = map.objects.filter(o => o.ox === 41 && o.oy === 9);
        assert.ok(objectsAtWizard.length >= 1, 'Should have object at wizard location (Book of the Dead)');
    });

    it('should generate wizard2 (middle level) with correct terrain', () => {
        resetLevelState();
        initRng(2);
        generateWizard2();

        const state = getLevelState();
        const map = state.map;

        assert.ok(map, 'Map should be created');

        let wallCount = 0;
        let roomCount = 0;

        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                const typ = map.locations[x][y].typ;
                if (typ >= VWALL && typ <= TRWALL) wallCount++;
                if (typ === ROOM || typ === CORR) roomCount++;
            }
        }

        assert.ok(wallCount > 30, `Should have walls (found ${wallCount})`);
        assert.ok(roomCount > 50, `Should have room cells (found ${roomCount})`);

        // Wizard2 has objects and traps
        assert.ok(map.objects.length >= 4, `Should have objects (found ${map.objects.length})`);
        assert.ok(map.traps.length >= 3, `Should have traps (found ${map.traps.length})`);
    });

    it('should generate wizard3 (bottom level) with correct terrain', () => {
        resetLevelState();
        initRng(3);
        generateWizard3();

        const state = getLevelState();
        const map = state.map;

        assert.ok(map, 'Map should be created');

        let wallCount = 0;
        let roomCount = 0;

        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                const typ = map.locations[x][y].typ;
                if (typ >= VWALL && typ <= TRWALL) wallCount++;
                if (typ === ROOM || typ === CORR) roomCount++;
            }
        }

        assert.ok(wallCount > 40, `Should have walls (found ${wallCount})`);
        assert.ok(roomCount > 60, `Should have room cells (found ${roomCount})`);

        // Wizard3 has monsters, objects, and traps
        assert.ok(map.monsters.length >= 5, `Should have monsters (found ${map.monsters.length})`);
        assert.ok(map.objects.length >= 4, `Should have objects (found ${map.objects.length})`);
        assert.ok(map.traps.length >= 3, `Should have traps (found ${map.traps.length})`);
    });
});
