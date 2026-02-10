#!/usr/bin/env node
import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { makelevel, wallification, initLevelGeneration } from './js/dungeon.js';

process.env.DEBUG_CORRIDORS = '0';
process.env.DEBUG_THEMEROOMS = '0';
process.env.DEBUG_RECTS = '0';

initRng(163);
initLevelGeneration(11);

// Generate depth 1
const map1 = makelevel(1);
wallification(map1);

// Enable logging for depth 2
enableRngLog(false); // false = no caller tags for simpler output

const map2 = makelevel(2);
wallification(map2);

const trace = getRngLog();
console.log(`=== Depth 2: ${trace.length} RNG calls ===`);
console.log('\nFirst 30 calls:');
trace.slice(0, 30).forEach(call => {
    console.log(`  ${call}`);
});
