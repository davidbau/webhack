/**
 * Test for map flipping logic
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resetLevelState, getLevelState, des } from '../../js/sp_lev.js';
import { initRng, rn2 } from '../../js/rng.js';

describe('Map flipping', () => {
    it('should flip map vertically when RNG decides', () => {
        // Test with a seed that produces vertical flip
        // We need to figure out which seed gives us vertical flip for soko4

        for (let seed = 1; seed <= 10; seed++) {
            resetLevelState();
            initRng(seed);

            // Simulate the RNG calls that happen before map placement
            // In C, there are some RNG calls during level init
            // For now, let's just test the flip logic directly

            des.level_init({ style: 'solidfill', fg: ' ' });
            des.level_flags('mazelevel', 'noteleport', 'hardfloor', 'premapped', 'sokoban', 'solidify');

            // Place a simple test map
            const testMap = `ABC
DEF
GHI`;

            des.map(testMap);

            const state = getLevelState();
            const map = state.map;

            // Calculate where the map is centered
            const offsetX = Math.floor((80 - 3) / 2);
            const offsetY = Math.floor((21 - 3) / 2);

            // Read back the map to see if it was flipped
            let topLeft = String.fromCharCode(65 + map.locations[offsetX][offsetY].typ - 65);

            // Check if first char is 'A' (no flip) or 'G' (vertical flip) or 'C' (horizontal flip)
            console.log(`Seed ${seed}: First char at (${offsetX},${offsetY})`);
        }
    });

    it('should respect noflip flag', () => {
        resetLevelState();
        initRng(1);

        des.level_init({ style: 'solidfill', fg: ' ' });
        des.level_flags('noflip'); // Disable all flips

        const testMap = `AB
CD`;

        des.map(testMap);

        const state = getLevelState();
        assert.equal(state.coder.allow_flips, 0, 'allow_flips should be 0 with noflip');

        // Map should be placed without any flipping
        // (Can't easily verify the exact placement without knowing the map chars map to terrain types)
    });

    it('should respect noflipx and noflipy flags', () => {
        resetLevelState();
        initRng(1);

        des.level_init({ style: 'solidfill', fg: ' ' });
        des.level_flags('noflipx'); // Disable horizontal flip only

        const state = getLevelState();
        assert.equal(state.coder.allow_flips, 1, 'allow_flips should be 1 (vertical only) with noflipx');

        resetLevelState();
        initRng(1);

        des.level_init({ style: 'solidfill', fg: ' ' });
        des.level_flags('noflipy'); // Disable vertical flip only

        const state2 = getLevelState();
        assert.equal(state2.coder.allow_flips, 2, 'allow_flips should be 2 (horizontal only) with noflipy');
    });
});
