#!/usr/bin/env node
/**
 * Show exact RNG calls from room 2
 */

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { resetLevelState } from './js/sp_lev.js';
import * as des from './js/sp_lev.js';

console.log('=== Exact RNG Sequence ===\n');

initRng(42);
enableRngLog(true);
resetLevelState();

// Room 1
des.room({
    type: "ordinary",
    lit: 1,
    x: 3,
    y: 3,
    xalign: "center",
    yalign: "center",
    w: 11,
    h: 9
});

const log1 = getRngLog();
console.log(`After room 1: ${log1.length} calls`);
for (let i = 0; i < log1.length; i++) {
    console.log(`  ${i+1}. ${log1[i]}`);
}

// Room 2
console.log('\n--- Creating room 2 ---\n');
des.room({
    contents: function() {
        des.stair("up");
        des.object();
    }
});

const log2 = getRngLog();
console.log(`\nAfter room 2: ${log2.length} calls`);
console.log('NEW calls from room 2:');
for (let i = log1.length; i < log2.length; i++) {
    console.log(`  ${i+1}. ${log2[i]}`);
}

console.log('\n\nExpected C sequence:');
console.log('  1. rn2(100) @ build_room  (room 1)');
console.log('  2. rnd(2) @ litstate_rnd  (room 2)');
console.log('  3. rn2(77) @ litstate_rnd (room 2)');
console.log('  ...');
