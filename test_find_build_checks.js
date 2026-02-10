// test_find_build_checks.js - Find rn2(100) build checks

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration, makelevel, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';
import { readFileSync } from 'fs';

function extractRngCalls(log) {
    return log.filter(e => e.length > 0 && e[0] !== '>' && e[0] !== '<');
}

// Initialize JS
initrack();
enableRngLog();
initRng(163);
setGameSeed(163);
initLevelGeneration();

const beforeMakelevel = getRngLog().length;
const map1 = makelevel(1);
const afterMakelevel = getRngLog().length;

const jsLog = getRngLog().slice(beforeMakelevel, afterMakelevel);

// Load C session
const cSession = JSON.parse(readFileSync('test/comparison/maps/seed163_maps_c.session.json', 'utf8'));
const cDepth1 = cSession.levels.find(l => l.depth === 1);
const cLog = extractRngCalls(cDepth1.rng);

console.log('=== Finding rn2(100) Build Checks ===\\n');

// Find all rn2(100) in JS
console.log('JS rn2(100) calls:');
let jsCount = 0;
for (let i = 0; i < Math.min(jsLog.length, 500); i++) {
    if (jsLog[i].includes('rn2(100)=')) {
        console.log(`  [${i}] ${jsLog[i]}`);
        jsCount++;
    }
}
console.log(`Total JS rn2(100): ${jsCount}\\n`);

// Find all rn2(100) in C
console.log('C rn2(100) calls:');
let cCount = 0;
for (let i = 0; i < Math.min(cLog.length, 500); i++) {
    if (cLog[i].includes('rn2(100)=')) {
        console.log(`  [${i}] ${cLog[i]}`);
        cCount++;
    }
}
console.log(`Total C rn2(100): ${cCount}\\n`);

console.log(`JS final: ${map1.nroom} rooms, ${map1.nsubroom || 0} subrooms`);
console.log(`Expected room count difference: JS has ${map1.nroom - 5} extra rooms (assuming C has 5)`);
