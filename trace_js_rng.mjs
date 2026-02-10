#!/usr/bin/env node
import { initRng, rn2, rnd } from './js/rng.js';
import { makelevel, wallification, initLevelGeneration } from './js/dungeon.js';

// Disable debug
process.env.DEBUG_CORRIDORS = '0';
process.env.DEBUG_THEMEROOMS = '0';
process.env.DEBUG_RECTS = '0';

// Patch RNG to trace calls
const rngLog = [];
const orig_rn2 = globalThis.rn2;
const orig_rnd = globalThis.rnd;

globalThis.rn2 = function(n) {
    const result = orig_rn2(n);
    rngLog.push(`rn2(${n})=${result}`);
    return result;
};

globalThis.rnd = function(n) {
    const result = orig_rnd(n);
    rngLog.push(`rnd(${n})=${result}`);
    return result;
};

// Generate depth 2
initRng(163);
initLevelGeneration(11);
const map1 = makelevel(1);
wallification(map1);

console.log(`=== Depth 1: ${rngLog.length} RNG calls ===`);
rngLog.length = 0; // Reset for depth 2

const map2 = makelevel(2);
wallification(map2);

console.log(`=== Depth 2: ${rngLog.length} RNG calls ===`);
console.log('First 20 calls:');
rngLog.slice(0, 20).forEach((call, i) => {
    console.log(`  ${i}: ${call}`);
});
