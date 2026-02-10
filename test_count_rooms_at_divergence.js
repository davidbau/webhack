// test_count_rooms_at_divergence.js - Count rooms created before divergence

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';
import { readFileSync } from 'fs';

// Monkey-patch add_room_to_map to trace room creation
let roomCreations = [];
await import('./js/dungeon.js').then(async (dungeonModule) => {
    const originalModule = await import('./js/dungeon.js');
    
    // Can't directly monkey-patch, so let's trace via RNG patterns instead
});

// Initialize
initrack();
enableRngLog();
initRng(163);
setGameSeed(163);
initLevelGeneration();

console.log('=== Tracing Room Creation Before Divergence (Call 1172) ===\n');

// Import makelevel and trace
const { makelevel } = await import('./js/dungeon.js');
const map1 = makelevel(1);

const fullLog = getRngLog();

console.log(`Final: ${map1.nroom} rooms, ${map1.nsubroom || 0} subrooms\n`);

// Find all rn2(100) calls before index 1172 (build_room checks)
console.log('Build room checks (rn2(100)) before call 1172:\n');

let buildChecks = [];
for (let i = 0; i < Math.min(fullLog.length, 1172); i++) {
    if (fullLog[i].includes('rn2(100)=')) {
        buildChecks.push({ index: i, entry: fullLog[i] });
    }
}

console.log(`Total rn2(100) calls before divergence: ${buildChecks.length}\n`);
for (const bc of buildChecks) {
    console.log(`  [${bc.index}] ${bc.entry}`);
}

// Load C session to compare
const cSession = JSON.parse(readFileSync('test/comparison/maps/seed163_maps_c.session.json', 'utf8'));
const cDepth1 = cSession.levels.find(l => l.depth === 1);

console.log('\nC build room checks before call 1172:\n');
let cBuildChecks = [];
for (let i = 0; i < Math.min(cDepth1.rng.length, 1172); i++) {
    if (cDepth1.rng[i].includes('rn2(100)=') && cDepth1.rng[i].includes('build_room')) {
        cBuildChecks.push({ index: i, entry: cDepth1.rng[i] });
    }
}

console.log(`Total build_room checks: ${cBuildChecks.length}\n`);
for (const bc of cBuildChecks) {
    console.log(`  [${bc.index}] ${bc.entry}`);
}

console.log(`\nDifference: JS has ${buildChecks.length} rn2(100) calls, C has ${cBuildChecks.length} build_room calls`);
console.log(`This suggests ${buildChecks.length - cBuildChecks.length} extra rn2(100) calls in JS are NOT from build_room`);
