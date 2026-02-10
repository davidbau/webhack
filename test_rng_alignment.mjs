#!/usr/bin/env node
import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { makelevel, wallification, initLevelGeneration } from './js/dungeon.js';

process.env.DEBUG_CORRIDORS = '0';
process.env.DEBUG_THEMEROOMS = '0';
process.env.DEBUG_RECTS = '0';
process.env.DEBUG_MINERALIZE = '0';
process.env.ALIGN_RNG = '1'; // Enable RNG alignment

initRng(163);
initLevelGeneration(11);

enableRngLog(false);

const map1 = makelevel(1);
wallification(map1);

const depth1Calls = getRngLog().length;
console.log(`=== After Depth 1: ${depth1Calls} RNG calls (C has 2565) ===`);

const map2 = makelevel(2);
wallification(map2);

const allCalls = getRngLog();
const depth2Calls = allCalls.slice(depth1Calls);

console.log(`=== Depth 2: ${depth2Calls.length} RNG calls (C has 2380) ===`);
console.log(`\nFirst 10 depth 2 calls:`);
depth2Calls.slice(0, 10).forEach(call => {
    console.log(`  ${call}`);
});

console.log(`\n=== C Expected ===`);
console.log(`1 rn2(3)=2`);
console.log(`2 rn2(5)=4`);
console.log(`3 rn2(1)=0`);

console.log(`\n=== Room count ===`);
console.log(`JS: ${map2.rooms.length} rooms`);
console.log(`C: 9 rooms`);
