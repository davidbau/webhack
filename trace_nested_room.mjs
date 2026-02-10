#!/usr/bin/env node
/**
 * Trace nested room creation
 */

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { resetLevelState } from './js/sp_lev.js';
import * as des from './js/sp_lev.js';

console.log('=== Tracing Nested Room ===\n');

initRng(42);
enableRngLog(true);
resetLevelState();

console.log('Creating parent room...');
const result1 = des.room({
    type: "ordinary",
    lit: 1,
    x: 3,
    y: 3,
    w: 11,
    h: 9
});
console.log(`Parent room result: ${result1}`);

const logAfterParent = getRngLog().slice();
console.log(`\nAfter parent room: ${logAfterParent.length} calls`);
logAfterParent.forEach((call, i) => console.log(`  ${i+1}. ${call}`));

console.log('\n--- Now creating nested room INSIDE parent ---\n');

const result2 = des.room({
    type: "ordinary",
    lit: 1,
    x: 3,
    y: 3,
    w: 11,
    h: 9,
    contents: function() {
        console.log('  [Inside contents callback]');
        console.log('  Creating nested delphi room...');
        const nestedResult = des.room({
            type: "delphi",
            lit: 1,
            x: 4,
            y: 3,
            w: 3,
            h: 3
        });
        console.log(`  Nested room result: ${nestedResult}`);
    }
});
console.log(`Parent+nested result: ${result2}`);

const logFinal = getRngLog();
console.log(`\nFinal: ${logFinal.length} calls total`);
console.log('All calls:');
logFinal.forEach((call, i) => console.log(`  ${i+1}. ${call}`));

console.log('\n\nExpected: 2 rn2(100) calls (one for parent, one for nested)');
console.log(`Actual: ${logFinal.length} calls`);
