#!/usr/bin/env node
/**
 * Trace the first RNG call in JS oracle generation
 * Enable detailed logging with stack traces to identify divergence point
 */

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { generate as generateOracle } from './js/levels/oracle.js';

console.log('=== Tracing First JS RNG Call in Oracle Generation ===\n');

// Initialize RNG with seed 42 (same as C trace)
initRng(42);

// Enable RNG logging WITH caller tags (stack traces)
enableRngLog(true);

console.log('Generating oracle level with detailed RNG logging...\n');

try {
    const level = generateOracle();
    const rngLog = getRngLog();

    console.log(`Oracle generated. Total RNG calls: ${rngLog.length}\n`);
    console.log('First 10 RNG calls:\n');

    for (let i = 0; i < Math.min(10, rngLog.length); i++) {
        console.log(`${i + 1}. ${rngLog[i]}`);
    }

    console.log('\n=== Analysis ===');
    console.log('Expected C first call: rn2(100) @ build_room(sp_lev.c:2803)');
    console.log(`Actual JS first call:  ${rngLog[0]}`);

} catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
}
