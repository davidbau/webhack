#!/usr/bin/env node
import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration } from './js/dungeon.js';

// Test Valkyrie (role 11) pet creation
initRng(163);
enableRngLog(false);
initLevelGeneration(11); // Valkyrie

const log = getRngLog();
console.log('First 20 RNG calls during initLevelGeneration:');
log.slice(0, 20).forEach(call => console.log(`  ${call}`));

console.log('\nLooking for pet_type rn2(2) call...');
const petCall = log.find(call => call.includes('rn2(2)'));
if (petCall) {
    const index = log.indexOf(petCall);
    console.log(`Found at position ${index + 1}: ${petCall}`);
    console.log('\nContext (5 calls before and after):');
    log.slice(Math.max(0, index - 5), index + 6).forEach((call, i) => {
        const marker = i === 5 ? ' ← pet_type' : '';
        console.log(`  ${call}${marker}`);
    });
} else {
    console.log('❌ No rn2(2) call found - bug still present!');
}
