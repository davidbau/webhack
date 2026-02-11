#!/usr/bin/env node
// Test RNG consumption for two sequential themed rooms

import {initRng, enableRngLog, getRngLog, rn2} from './js/rng.js';
import {initLevelGeneration, init_rect, rnd_rect} from './js/dungeon.js';
import {setLevelContext, clearLevelContext} from './js/sp_lev.js';
import {GameMap} from './js/map.js';

initRng(3);
enableRngLog(false);
rn2(1); // chargen

initLevelGeneration(11);

const map = new GameMap();
init_rect();
setLevelContext(map, 1);

// First make sure rect pool is initialized
rnd_rect();

import * as sp_lev from './js/sp_lev.js';

console.log('Creating Room 1...');
const rng1Before = getRngLog().length;
try {
    sp_lev.room({ type: "ordinary", filled: 1 });
    console.log(`✓ Room 1 created, consumed ${getRngLog().length - rng1Before} RNG calls`);
} catch (e) {
    console.log(`✗ Error: ${e.message}`);
}

console.log('\nCreating Room 2...');
const rng2Before = getRngLog().length;
try {
    sp_lev.room({ type: "ordinary", filled: 1 });
    console.log(`✓ Room 2 created, consumed ${getRngLog().length - rng2Before} RNG calls`);
} catch (e) {
    console.log(`✗ Error: ${e.message}`);
}

clearLevelContext();

const log = getRngLog();
console.log(`\nTotal RNG calls: ${log.length}`);
console.log('\nAll RNG calls:');
for (let i = 0; i < log.length; i++) {
    console.log(`  [${i}] ${log[i]}`);
}
