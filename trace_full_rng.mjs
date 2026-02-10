#!/usr/bin/env node
import { initRng, enableRngLog, getRngLog, disableRngLog } from './js/rng.js';
import { makelevel, wallification, initLevelGeneration } from './js/dungeon.js';

process.env.DEBUG_CORRIDORS = '0';
process.env.DEBUG_THEMEROOMS = '0';
process.env.DEBUG_RECTS = '0';

initRng(163);
initLevelGeneration(11);

// Enable logging from the start
enableRngLog(false);

const map1 = makelevel(1);
wallification(map1);

const depth1Calls = getRngLog().length;
console.log(`=== After Depth 1: ${depth1Calls} total RNG calls ===`);

const map2 = makelevel(2);
wallification(map2);

const allCalls = getRngLog();
const depth2Calls = allCalls.slice(depth1Calls);

console.log(`=== Depth 2: ${depth2Calls.length} RNG calls (${depth1Calls} + ${depth2Calls.length} = ${allCalls.length} total) ===`);
console.log('\nLast 10 calls of depth 1:');
allCalls.slice(depth1Calls - 10, depth1Calls).forEach(call => {
    console.log(`  ${call}`);
});

console.log('\nFirst 30 calls of depth 2:');
depth2Calls.slice(0, 30).forEach(call => {
    console.log(`  ${call}`);
});

console.log(`\n=== C Expected ===`);
console.log(`Depth 1: 2565 calls`);
console.log(`Depth 2: 2380 calls`);
console.log(`Difference: JS has ${2565 - depth1Calls} fewer at depth 1, ${2380 - depth2Calls.length} fewer at depth 2`);
