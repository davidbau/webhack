#!/usr/bin/env node
/**
 * Trace room creation order to understand when litstate_rnd is called
 */

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { resetLevelState } from './js/sp_lev.js';
import * as des from './js/sp_lev.js';

console.log('=== Tracing Room Creation Order ===\n');

initRng(42);
enableRngLog(true);
resetLevelState();

// Manually trace oracle room creation
console.log('Room 1: ordinary, lit=1, x=3, y=3, w=11, h=9');
des.room({
    type: "ordinary",
    lit: 1,
    x: 3,
    y: 3,
    xalign: "center",
    yalign: "center",
    w: 11,
    h: 9,
    contents: function() {
        console.log('  Nested room: delphi, lit=1, x=4, y=3, w=3, h=3');
        des.room({
            type: "delphi",
            lit: 1,
            x: 4,
            y: 3,
            w: 3,
            h: 3
        });
    }
});

const log1 = getRngLog();
console.log(`\nAfter room 1: ${log1.length} RNG calls`);
for (let i = 0; i < Math.min(10, log1.length); i++) {
    console.log(`  ${i+1}. ${log1[i]}`);
}

console.log('\n\nRoom 2: (no type), x/y/w/h unspecified, lit unspecified (defaults to -1)');
des.room({
    contents: function() {
        // up stair and object
    }
});

const log2 = getRngLog();
console.log(`\nAfter room 2: ${log2.length} RNG calls (${log2.length - log1.length} new)`);
for (let i = log1.length; i < Math.min(log1.length + 15, log2.length); i++) {
    console.log(`  ${i+1}. ${log2[i]}`);
}

console.log('\n\n=== Analysis ===');
console.log('Expected C sequence:');
console.log('  1. rn2(100) @ build_room  (room 1 chance)');
console.log('  2. rnd(2) @ litstate_rnd  (room 2 lighting - random!)');
console.log('  3. rn2(77) @ litstate_rnd (room 2 lighting - random!)');
