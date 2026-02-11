#!/usr/bin/env node
// Test how many RNG calls a single "default" themed room makes

import {initRng, enableRngLog, getRngLog, rn2} from './js/rng.js';
import {initLevelGeneration} from './js/dungeon.js';
import {setLevelContext, clearLevelContext} from './js/sp_lev.js';
import {GameMap} from './js/map.js';
import {init_rect} from './js/dungeon.js';

initRng(3);
enableRngLog(false);
rn2(1); // chargen

initLevelGeneration(11);

// Create a minimal level context
const map = new GameMap();
init_rect();
setLevelContext(map, 1);

console.log('Creating ONE "default" themed room...');
const rngBefore = getRngLog().length;

// Import and call the room creation
import * as sp_lev from './js/sp_lev.js';
try {
    sp_lev.room({ type: "ordinary", filled: 1 });
    console.log('✓ Room created successfully');
} catch (e) {
    console.log(`✗ Error: ${e.message}`);
}

const rngAfter = getRngLog().length;
const consumed = rngAfter - rngBefore;

clearLevelContext();

console.log(`\nRNG calls consumed: ${consumed}`);
console.log(`Total RNG calls: ${rngAfter}`);

if (consumed > 50) {
    console.log('\n⚠ This is too many! Investigating...');
    const log = getRngLog();
    console.log('\nFirst 20 RNG calls:');
    for (let i = rngBefore; i < Math.min(rngBefore + 20, rngAfter); i++) {
        console.log(`  [${i}] ${log[i]}`);
    }
}
