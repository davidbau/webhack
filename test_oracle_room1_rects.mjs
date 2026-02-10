#!/usr/bin/env node
/**
 * Test oracle Room 1 rectangle pool behavior
 */

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { resetLevelState, getTypGrid } from './js/sp_lev.js';
import * as des from './js/sp_lev.js';
import { get_rect_count, get_rects } from './js/dungeon.js';

// Enable rectangle debugging
process.env.DEBUG_RECTS = '1';

console.log('=== Oracle Room 1 Rectangle Pool Test ===\n');

initRng(42);
enableRngLog(true);
resetLevelState();

console.log(`Initial rectangle count: ${get_rect_count()}`);
console.log(`Initial rectangles:`, get_rects());

console.log('\n--- Creating Room 1 (ordinary room with explicit coords) ---');
des.level_flags("noflip");

const room1Result = des.room({
    type: "ordinary",
    lit: 1,
    x: 3,
    y: 3,
    xalign: "center",
    yalign: "center",
    w: 11,
    h: 9,
    contents: function() {
        console.log('\n  [Inside Room 1 contents callback]');
        console.log(`  Rectangle count before nested room: ${get_rect_count()}`);

        // Nested delphi room
        des.room({
            type: "delphi",
            lit: 1,
            x: 4,
            y: 3,
            w: 3,
            h: 3
        });

        console.log(`  Rectangle count after nested room: ${get_rect_count()}`);
    }
});

console.log(`\n--- After Room 1 complete ---`);
console.log(`Rectangle count: ${get_rect_count()}`);
console.log(`Rectangles:`, get_rects());
console.log(`\nExpected: 2 rectangles (LEFT and RIGHT splits)`);
console.log(`C has: 1 rectangle (from rn2(1) in trace)`);

const rngLog = getRngLog();
console.log(`\nRNG calls so far: ${rngLog.length}`);
rngLog.forEach((call, i) => {
    console.log(`  ${i+1}. ${call}`);
});

console.log('\n--- Now creating Room 2 to see rectangle selection ---');
try {
    des.room({
        contents: function() {
            des.stair("up");
            des.object();
        }
    });

    const rngLog2 = getRngLog();
    console.log(`\nRNG calls after Room 2:`);
    for (let i = rngLog.length; i < rngLog2.length; i++) {
        console.log(`  ${i+1}. ${rngLog2[i]}`);
    }
} catch (err) {
    console.log(`Room 2 failed: ${err.message}`);
}
