#!/usr/bin/env node
// Trace RNG calls with stack traces to identify source of calls 344-347

import {initRng, enableRngLog, getRngLog, rn2} from './js/rng.js';
import {initLevelGeneration, makelevel} from './js/dungeon.js';

initRng(3);
enableRngLog(true); // Enable WITH caller tags
rn2(1); // chargen

initLevelGeneration(11);

const map = makelevel(1);

const log = getRngLog();
console.log('\n=== RNG calls 340-355 with caller info ===');
for (let i = 340; i <= 355 && i < log.length; i++) {
    console.log(`  [${i}] ${log[i]}`);
}

console.log(`\nTotal RNG calls: ${log.length}`);
