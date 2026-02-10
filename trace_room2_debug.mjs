#!/usr/bin/env node
/**
 * Debug why room 2 doesn't generate RNG calls
 */

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { resetLevelState } from './js/sp_lev.js';
import * as des from './js/sp_lev.js';

console.log('=== Debugging Room 2 Creation ===\n');

initRng(42);
enableRngLog(true);
resetLevelState();

// Skip room 1 for now
console.log('Skipping room 1 (consumes 2 RNG calls)...\n');
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
console.log(`After room 1: ${log1.length} calls\n`);

// Now try room 2 with DEBUG
process.env.DEBUG_ROOMS = '1';

console.log('Creating room 2 with DEBUG enabled:');
console.log('  des.room({ contents: function() {...} })');
console.log('  (no x, y, w, h, lit specified)\n');

const result = des.room({
    contents: function() {
        des.stair("up");
        des.object();
    }
});

console.log(`\nRoom 2 result: ${result}`);

const log2 = getRngLog();
console.log(`After room 2: ${log2.length} calls (${log2.length - log1.length} new)\n`);

if (log2.length > log1.length) {
    console.log('New RNG calls:');
    for (let i = log1.length; i < log2.length; i++) {
        console.log(`  ${i+1}. ${log2[i]}`);
    }
}
