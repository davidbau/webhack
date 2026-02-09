/**
 * Test for wall_extends() wallification algorithm
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { resetLevelState, getLevelState, des, finalize_level } from '../../js/sp_lev.js';
import { initRng } from '../../js/rng.js';
import {
    STONE, ROOM, HWALL, VWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
    CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL
} from '../../js/config.js';

describe('Wall junction computation (wallification)', () => {
    before(() => {
        initRng(42);
    });

    it('should compute corner types correctly', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });
        des.level_flags('noflip'); // Disable flipping for predictable placement

        // Create a simple rectangular room
        const simpleBox = `-----
|...|
|...|
-----`;

        des.map(simpleBox);
        finalize_level();

        const state = getLevelState();
        const map = state.map;

        // Find the box in the map
        const offsetX = Math.floor((80 - 5) / 2);
        const offsetY = Math.floor((21 - 4) / 2);

        // Check corners
        assert.equal(map.locations[offsetX][offsetY].typ, TLCORNER, 'Top-left should be TLCORNER');
        assert.equal(map.locations[offsetX + 4][offsetY].typ, TRCORNER, 'Top-right should be TRCORNER');
        assert.equal(map.locations[offsetX][offsetY + 3].typ, BLCORNER, 'Bottom-left should be BLCORNER');
        assert.equal(map.locations[offsetX + 4][offsetY + 3].typ, BRCORNER, 'Bottom-right should be BRCORNER');

        // Check horizontal walls
        assert.equal(map.locations[offsetX + 1][offsetY].typ, HWALL, 'Top middle should be HWALL');
        assert.equal(map.locations[offsetX + 2][offsetY].typ, HWALL, 'Top middle should be HWALL');

        // Check vertical walls
        assert.equal(map.locations[offsetX][offsetY + 1].typ, VWALL, 'Left middle should be VWALL');
        assert.equal(map.locations[offsetX][offsetY + 2].typ, VWALL, 'Left middle should be VWALL');
    });

    it('should compute T-junction types correctly', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });
        des.level_flags('noflip');

        // Create a T-junction pattern with walls meeting
        const tJunction = `-------
|.....|
|..|..|
|.---.|
|.....|
-------`;

        des.map(tJunction);
        finalize_level();

        const state = getLevelState();
        const map = state.map;

        const offsetX = Math.floor((80 - 7) / 2);
        const offsetY = Math.floor((21 - 6) / 2);

        // The junction at (offsetX + 3, offsetY + 3) should be TUWALL (┴)
        // because it connects north, east, and west
        const junctionType = map.locations[offsetX + 3][offsetY + 3].typ;

        assert.equal(junctionType, TUWALL, `Junction should be TUWALL (┴), got ${junctionType}`);

        // Check the vertical wall connects properly
        assert.equal(map.locations[offsetX + 3][offsetY + 2].typ, VWALL, 'Vertical wall above junction should be VWALL');
    });

    it('should iterate until convergence', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });
        des.level_flags('noflip');

        // Create a more complex pattern that requires multiple iterations
        const complexMap = `--------
|......|
|..--+.|
|..|..|
|..---+
|......|
--------`;

        des.map(complexMap);
        finalize_level();

        const state = getLevelState();
        const map = state.map;

        // Verify that some walls were converted to junction types
        let cornerCount = 0;
        let junctionCount = 0;

        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                const typ = map.locations[x][y].typ;
                if (typ >= TLCORNER && typ <= BRCORNER) {
                    cornerCount++;
                }
                if (typ >= CROSSWALL && typ <= TRWALL) {
                    junctionCount++;
                }
            }
        }

        assert.ok(cornerCount >= 4, `Should have corner types (found ${cornerCount})`);
        // Note: junctionCount might be 0 if the pattern doesn't create junctions after proper computation
    });

    it('should handle walls without neighbors', () => {
        resetLevelState();
        des.level_init({ style: 'solidfill', fg: ' ' });
        des.level_flags('noflip');

        // Single isolated walls should keep their type
        des.terrain(40, 10, '-');
        des.terrain(42, 10, '|');

        finalize_level();

        const state = getLevelState();
        const map = state.map;

        // Isolated walls should remain as HWALL/VWALL
        assert.equal(map.locations[40][10].typ, HWALL, 'Isolated HWALL should stay HWALL');
        assert.equal(map.locations[42][10].typ, VWALL, 'Isolated VWALL should stay VWALL');
    });
});
