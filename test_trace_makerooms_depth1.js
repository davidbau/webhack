// test_trace_makerooms_depth1.js - Trace makerooms loop execution at depth 1

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration, makelevel, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';
import { readFileSync } from 'fs';

// Initialize
initrack();
enableRngLog();
initRng(163);
setGameSeed(163);
initLevelGeneration();

// Monkey-patch to trace room creation
let roomCreations = [];
const originalMakelevel = makelevel;

console.log('=== Tracing Makerooms Loop at Depth 1 (Seed 163) ===\n');

const beforeMakelevel = getRngLog().length;
const map1 = makelevel(1);
const afterMakelevel = getRngLog().length;

const fullLog = getRngLog();
const makelevelLog = fullLog.slice(beforeMakelevel, afterMakelevel);

console.log(`Final room count: ${map1.nroom} rooms, ${map1.nsubroom || 0} subrooms`);
console.log(`Total RNG calls during makelevel: ${makelevelLog.length}\n`);

// Load C session to compare
const cSession = JSON.parse(readFileSync('test/comparison/maps/seed163_maps_c.session.json', 'utf8'));
const cDepth1 = cSession.levels.find(l => l.depth === 1);

console.log(`C room count: ${cDepth1.nroom || 'unknown'} rooms\n`);

// Find rnd_rect patterns (should be rn2(1), rn2(2), rn2(3), etc. returning 0)
console.log('Looking for rnd_rect successes (rn2(N)=0 for small N):\n');

let rndRectSuccesses = [];
for (let i = 0; i < Math.min(makelevelLog.length, 500); i++) {
    const entry = makelevelLog[i];
    const match = entry.match(/rn2\(([1-9])\)=0/);

    if (match) {
        const arg = parseInt(match[1]);
        if (arg >= 1 && arg <= 5) { // rnd_rect typically tries small values
            rndRectSuccesses.push({ index: i, arg, entry });
        }
    }
}

console.log(`Found ${rndRectSuccesses.length} potential rnd_rect successes:\n`);
for (const rr of rndRectSuccesses.slice(0, 10)) {
    console.log(`  [${rr.index}] ${rr.entry}`);

    // Look ahead for vault check (rn2(2)) or reservoir sampling (rn2(1000))
    for (let j = rr.index + 1; j < Math.min(rr.index + 10, makelevelLog.length); j++) {
        const ahead = makelevelLog[j];
        if (ahead.includes('rn2(2)=') || ahead.includes('rn2(1000)=')) {
            console.log(`      [${j}] ${ahead}`);
            break;
        }
    }
}

console.log(`\n\nRoom types in final map:`);
const roomTypes = {};
for (let i = 0; i < map1.nroom; i++) {
    const rtype = map1.rooms[i].rtype;
    roomTypes[rtype] = (roomTypes[rtype] || 0) + 1;
}

const rtypeNames = {
    0: 'OROOM', 1: 'THEMEROOM', 2: 'COURT', 3: 'SWAMP', 4: 'VAULT',
    5: 'BEEHIVE', 6: 'MORGUE', 7: 'BARRACKS', 8: 'ZOO', 9: 'DELPHI',
    10: 'TEMPLE', 11: 'LEPREHALL', 12: 'COCKNEST', 13: 'ANTHOLE',
    14: 'SHOPBASE'
};

for (const [rtype, count] of Object.entries(roomTypes)) {
    const name = rtypeNames[parseInt(rtype)] || `TYPE${rtype}`;
    console.log(`  ${name}: ${count}`);
}
