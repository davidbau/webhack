#!/usr/bin/env node
// Trace exact sequence of themed room selection and RNG consumption

import {initRng, enableRngLog, getRngLog, rn2} from './js/rng.js';
import {initLevelGeneration, makelevel} from './js/dungeon.js';

initRng(3);
enableRngLog(false);
rn2(1); // chargen

initLevelGeneration(11);

// Intercept themed room selection to log RNG state
import * as themerms from './js/levels/themerms.js';

console.log('\n=== Tracing themed room execution ===');

try {
    const map = makelevel(1);
    console.log('\n✓ Level generation completed');
} catch (e) {
    console.log(`\n✗ Error during generation: ${e.message}`);
}

const log = getRngLog();
console.log(`\nTotal RNG calls: ${log.length}`);

console.log('\n=== RNG calls 335-360 ===');
for (let i = 335; i <= 360 && i < log.length; i++) {
    const call = log[i];
    // Highlight the mystery calls
    const marker = (i >= 344 && i <= 347) ? ' ← MYSTERY' : '';
    const shuffleMarker = (i >= 348 && i <= 353) ? ' ← SHUFFLE' : '';
    console.log(`  [${i}] ${call}${marker}${shuffleMarker}`);
}
