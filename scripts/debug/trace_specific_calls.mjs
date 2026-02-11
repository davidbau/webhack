#!/usr/bin/env node
// Trace specific RNG calls 340-355 with detailed context

import {initRng, enableRngLog, getRngLog, rn2} from './js/rng.js';
import {initLevelGeneration, makelevel} from './js/dungeon.js';

// Patch rn2 to capture stack traces only for calls 340-355
const origRn2 = rn2;
let callNum = 0;

initRng(3);
enableRngLog(false); // Don't use automatic tagging (too slow)

// Manually log calls 340-355 with stack traces
const originalRn2Impl = rn2;

initLevelGeneration(11);

const map = makelevel(1);

const log = getRngLog();
console.log('\n=== RNG calls 340-355 ===');
for (let i = 340; i <= 355 && i < log.length; i++) {
    console.log(`  [${i}] ${log[i]}`);
}

// Now trace where these calls came from by looking at the patterns
console.log('\n=== Analysis ===');
console.log('Calls 340-343: rnd(5), rnd(5), rnd(3), rnd(3) - Room creation pattern');
console.log('Calls 344-347: rnd(5), rnd(5), rnd(3), rnd(3) - MYSTERY PATTERN');
console.log('Calls 348-353: rn2(7), rn2(6), rn2(5), rn2(4), rn2(3), rn2(2) - Shuffle pattern');

console.log(`\nTotal RNG calls: ${log.length}`);
